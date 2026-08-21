'use client';

import {
  analyse,
  applySensitivity,
  blankEngagement,
  meridian,
  practiceReference,
  reconcileReferences,
  validate,
  type Engagement,
  type EngagementAnalysis,
  type Finding,
  type Sensitivity,
} from '@scope/engine';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/**
 * The app's only state.
 *
 * Everything numeric comes back from the engine — this store holds the engagement
 * document and the sensitivity settings, and nothing else. If a component finds
 * itself doing arithmetic, the calculation belongs in the engine.
 */

const STORAGE_KEY = 'scope.engagement.v1';
const HISTORY_KEY = 'scope.history.v1';

interface ModelContextValue {
  engagement: Engagement;
  /** The engagement with sensitivity applied — what every number on screen reflects. */
  stressed: Engagement;
  analysis: EngagementAnalysis;
  findings: Finding[];
  sensitivity: Sensitivity;
  setSensitivity: (next: Sensitivity) => void;
  update: (mutate: (draft: Engagement) => Engagement, edit?: EditMeta) => void;
  /** Discard everything and return to the seeded sample engagement. */
  reset: () => void;
  /** Start a new engagement from nothing but the practice's own reference data. */
  startBlank: () => void;
  undo: () => void;
  redo: () => void;
  /** What the next undo would take back, for the control's label. Null when there is none. */
  undoLabel: string | null;
  redoLabel: string | null;
  /** What changed when a saved model was brought onto the current rate card. */
  reconciliation: string[];
  dismissReconciliation: () => void;
  isDirty: boolean;
  selectedScenarioId: string;
  setSelectedScenarioId: (id: string) => void;
  /**
   * The margin the practice is pricing towards, as a fraction.
   *
   * Shared across the page on purpose. The pricing desk solves for it and the floor is
   * measured against it, and two controls that disagree about what "target" means would
   * be worse than either alone. It starts from the gross-margin guardrail, because that
   * is the bar the practice has already written down.
   */
  targetMarginPct: number;
  setTargetMarginPct: (pct: number) => void;
  /** True when what is on screen is a frozen snapshot rather than the working model. */
  readOnly: boolean;
}

/** The practice's own gross-margin bar, where it has stated one. */
export function guardrailTarget(engagement: Engagement): number {
  const rail = engagement.guardrails.find(
    (guardrail) => guardrail.metric === 'grossMarginPct' && guardrail.operator === 'gte',
  );
  return rail?.threshold ?? 0.2;
}

const ModelContext = createContext<ModelContextValue | null>(null);

const NO_SENSITIVITY: Sensitivity = { slipWeeks: 0, extraDiscountPct: 0 };

/**
 * Describes an edit for the undo stack.
 *
 * `coalesce` groups a run of changes to the same thing into one step. Without it, typing
 * "900" into a rate box is three separate edits and undo walks back a character at a
 * time, which is worse than no undo at all.
 */
export interface EditMeta {
  label?: string;
  coalesce?: string;
}

interface HistoryEntry {
  /** The document as it stood *before* the edit. */
  engagement: Engagement;
  label: string;
}

/** The undo and redo stacks as they are written to storage. */
interface PersistedHistory {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

/** How long a run of edits to the same field stays a single undo step. */
const COALESCE_MS = 700;
const HISTORY_LIMIT = 100;

/**
 * How many steps survive a reload.
 *
 * Undo living only in memory meant a stray refresh threw away an afternoon of pricing
 * with no warning — the one failure this app has no answer for, since the model itself
 * is saved and the way back to it was not. A document is around 7KB, so thirty steps is
 * a couple of hundred kilobytes: worth the space, and far short of the in-memory depth
 * because nobody reloads and then undoes a hundred times.
 */
const PERSISTED_HISTORY = 30;

/** Writing the stack on every keystroke would be wasteful; a beat behind is enough. */
const HISTORY_WRITE_MS = 800;

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [engagement, setEngagement] = useState<Engagement>(meridian);
  const [sensitivity, setSensitivity] = useState<Sensitivity>(NO_SENSITIVITY);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(meridian.scenarios[0]!.id);
  const [isDirty, setIsDirty] = useState(false);
  const [target, setTarget] = useState<number>(() => guardrailTarget(meridian));
  const [hydrated, setHydrated] = useState(false);
  const [reconciliation, setReconciliation] = useState<string[]>([]);
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const lastEdit = useRef<{ coalesce?: string; at: number }>({ at: 0 });
  const historyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /*
   * The document and both stacks are mirrored into refs, and every change goes through
   * the setters below.
   *
   * This is not belt-and-braces — it is the only correct shape. The previous version
   * pushed the undo step from *inside* a `setEngagement` updater, and React invokes
   * updaters more than once on purpose to catch exactly that. Every edit therefore
   * landed twice on the stack, so undo appeared to do nothing every other press. The
   * rule it broke is simple: a state updater must be pure, and pushing history is not.
   */
  const engagementRef = useRef<Engagement>(meridian);
  const pastRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);

  const applyDocument = useCallback((next: Engagement) => {
    engagementRef.current = next;
    setEngagement(next);
  }, []);
  const applyPast = useCallback((next: HistoryEntry[]) => {
    pastRef.current = next;
    setPast(next);
  }, []);
  const applyFuture = useCallback((next: HistoryEntry[]) => {
    futureRef.current = next;
    setFuture(next);
  }, []);

  // Load after mount so the server and client render the same thing first.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        // A saved document carries the plan, not the practice's rate card. Bring it onto
        // the current ladder, capabilities and rates before anything is shown, or the
        // document silently prices itself off whatever card existed when it was saved.
        const { engagement: reconciled, notes } = reconcileReferences(
          JSON.parse(saved) as Engagement,
          practiceReference,
        );
        applyDocument(reconciled);
        setReconciliation(notes);
        setIsDirty(true);

        // History is restored only alongside a saved document. Undoing into a state that
        // belongs to a different model would be worse than having no history at all.
        const savedHistory = window.localStorage.getItem(HISTORY_KEY);
        if (savedHistory) {
          const { past: behind, future: ahead } = JSON.parse(savedHistory) as PersistedHistory;
          // Every stored step gets the same treatment as the live document, or undo
          // would quietly restore whatever rate card existed when the step was taken.
          const onto = (entries: HistoryEntry[]) =>
            (entries ?? []).map((entry) => ({
              ...entry,
              engagement: reconcileReferences(entry.engagement, practiceReference).engagement,
            }));
          applyPast(onto(behind));
          applyFuture(onto(ahead));
        }
      }
    } catch {
      // A corrupt saved model should never stop the app loading.
    }
    setHydrated(true);
  }, [applyDocument, applyPast, applyFuture]);

  useEffect(() => {
    if (!hydrated || !isDirty) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(engagement));
    } catch {
      // Out of quota, private mode — not worth interrupting the user over.
    }
  }, [engagement, hydrated, isDirty]);

  // The stack is written a beat behind the model, and only the tail of it.
  useEffect(() => {
    if (!hydrated || !isDirty) return;
    if (historyTimer.current) clearTimeout(historyTimer.current);
    historyTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(
          HISTORY_KEY,
          JSON.stringify({
            past: past.slice(-PERSISTED_HISTORY),
            future: future.slice(-PERSISTED_HISTORY),
          } satisfies PersistedHistory),
        );
      } catch {
        // Over quota. The model itself matters more than the way back to it, so drop
        // the stored history rather than let it crowd the document out.
        try {
          window.localStorage.removeItem(HISTORY_KEY);
        } catch {
          /* nothing left to try */
        }
      }
    }, HISTORY_WRITE_MS);
    return () => {
      if (historyTimer.current) clearTimeout(historyTimer.current);
    };
  }, [past, future, hydrated, isDirty]);

  const update = useCallback(
    (mutate: (draft: Engagement) => Engagement, edit?: EditMeta) => {
      const current = engagementRef.current;
      const next = mutate(current);
      if (next === current) return;
      // An edit that changes nothing is not a step. Editors rebuild the document rather
      // than mutate it, so a keystroke landing on the value already there produces a new
      // object with identical content, which a reference check waves through.
      if (JSON.stringify(next) === JSON.stringify(current)) return;

      const now = Date.now();
      const previous = lastEdit.current;
      // A continued run of edits to the same field extends the step already on the stack
      // rather than adding another, so undo takes back the whole change.
      const continues =
        edit?.coalesce != null &&
        edit.coalesce === previous.coalesce &&
        now - previous.at < COALESCE_MS;

      if (!continues) {
        applyPast(
          [...pastRef.current, { engagement: current, label: edit?.label ?? 'change' }].slice(
            -HISTORY_LIMIT,
          ),
        );
        applyFuture([]);
      }

      lastEdit.current = { coalesce: edit?.coalesce, at: now };
      applyDocument(next);
      setIsDirty(true);
    },
    [applyDocument, applyPast, applyFuture],
  );

  const undo = useCallback(() => {
    const entries = pastRef.current;
    const entry = entries[entries.length - 1];
    if (!entry) return;
    applyFuture([...futureRef.current, { engagement: engagementRef.current, label: entry.label }]);
    applyPast(entries.slice(0, -1));
    applyDocument(entry.engagement);
    lastEdit.current = { at: 0 };
    setIsDirty(true);
  }, [applyDocument, applyPast, applyFuture]);

  const redo = useCallback(() => {
    const entries = futureRef.current;
    const entry = entries[entries.length - 1];
    if (!entry) return;
    applyPast([...pastRef.current, { engagement: engagementRef.current, label: entry.label }]);
    applyFuture(entries.slice(0, -1));
    applyDocument(entry.engagement);
    lastEdit.current = { at: 0 };
    setIsDirty(true);
  }, [applyDocument, applyPast, applyFuture]);

  /**
   * A fresh start.
   *
   * Deliberately clears the undo stack rather than making the old engagement recoverable
   * through it. Undo is for taking back a keystroke, not for restoring a document you
   * decided to abandon — a stray ctrl-Z resurrecting a different client's model would be
   * far worse than having to press the button again.
   */
  const startBlank = useCallback(() => {
    const monday = new Date();
    monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
    applyDocument(
      blankEngagement(practiceReference, { startDate: monday.toISOString().slice(0, 10) }),
    );
    setSensitivity(NO_SENSITIVITY);
    setReconciliation([]);
    applyPast([]);
    applyFuture([]);
    lastEdit.current = { at: 0 };
    setIsDirty(true);
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* nothing to do */
    }
  }, [applyDocument, applyPast, applyFuture]);

  const reset = useCallback(() => {
    applyDocument(meridian);
    setSensitivity(NO_SENSITIVITY);
    setIsDirty(false);
    setReconciliation([]);
    applyPast([]);
    applyFuture([]);
    lastEdit.current = { at: 0 };
    if (historyTimer.current) clearTimeout(historyTimer.current);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* nothing to do */
    }
  }, [applyDocument, applyPast, applyFuture]);

  const stressed = useMemo(
    () => applySensitivity(engagement, sensitivity),
    [engagement, sensitivity],
  );
  const analysis = useMemo(() => analyse(stressed), [stressed]);
  const findings = useMemo(() => validate(stressed, analysis.plan), [stressed, analysis]);

  const value = useMemo<ModelContextValue>(
    () => ({
      engagement,
      stressed,
      analysis,
      findings,
      sensitivity,
      setSensitivity,
      update,
      reset,
      startBlank,
      undo,
      redo,
      undoLabel: past[past.length - 1]?.label ?? null,
      redoLabel: future[future.length - 1]?.label ?? null,
      isDirty,
      reconciliation,
      dismissReconciliation: () => setReconciliation([]),
      selectedScenarioId,
      setSelectedScenarioId,
      targetMarginPct: target,
      setTargetMarginPct: setTarget,
      readOnly: false,
    }),
    [
      engagement,
      stressed,
      analysis,
      findings,
      sensitivity,
      update,
      reset,
      startBlank,
      undo,
      redo,
      past,
      future,
      isDirty,
      reconciliation,
      selectedScenarioId,
      target,
    ],
  );

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

/**
 * Render a frozen engagement in place of the live one.
 *
 * An issued pack has to show what its recipient saw, so the Outputs views are handed a
 * different model rather than being taught about snapshots. Read-only is structural:
 * every mutator here is a no-op, so nothing rendered inside can write to the working
 * document even by accident.
 */
export function FrozenModelProvider({
  engagement,
  scenarioId,
  children,
}: {
  engagement: Engagement;
  scenarioId: string;
  children: React.ReactNode;
}) {
  const value = useMemo<ModelContextValue>(() => {
    const analysis = analyse(engagement);
    const noop = () => {};
    return {
      engagement,
      // A snapshot is what was issued, not a stress of it. Sensitivity does not apply.
      stressed: engagement,
      analysis,
      findings: validate(engagement, analysis.plan),
      sensitivity: NO_SENSITIVITY,
      setSensitivity: noop,
      update: noop,
      reset: noop,
      startBlank: noop,
      undo: noop,
      redo: noop,
      undoLabel: null,
      redoLabel: null,
      isDirty: false,
      reconciliation: [],
      dismissReconciliation: noop,
      selectedScenarioId: engagement.scenarios.some((scenario) => scenario.id === scenarioId)
        ? scenarioId
        : (engagement.scenarios[0]?.id ?? scenarioId),
      setSelectedScenarioId: noop,
      targetMarginPct: guardrailTarget(engagement),
      setTargetMarginPct: noop,
      readOnly: true,
    };
  }, [engagement, scenarioId]);

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

export function useModel(): ModelContextValue {
  const context = useContext(ModelContext);
  if (!context) throw new Error('useModel must be used inside a ModelProvider');
  return context;
}

/** The scenario currently being looked at, with its metrics and guardrail status. */
export function useSelectedScenario() {
  const { analysis, selectedScenarioId } = useModel();
  return (
    analysis.scenarios.find((entry) => entry.scenario.scenarioId === selectedScenarioId) ??
    analysis.scenarios[0]!
  );
}

/** Fixed-order categorical colour for a scenario. Follows the entity, never its rank. */
export function scenarioColour(engagement: Engagement, scenarioId: string): string {
  const index = engagement.scenarios.findIndex((scenario) => scenario.id === scenarioId);
  const slots = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
  return slots[index % slots.length]!;
}
