'use client';

import {
  analyse,
  applySensitivity,
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

interface ModelContextValue {
  engagement: Engagement;
  /** The engagement with sensitivity applied — what every number on screen reflects. */
  stressed: Engagement;
  analysis: EngagementAnalysis;
  findings: Finding[];
  sensitivity: Sensitivity;
  setSensitivity: (next: Sensitivity) => void;
  update: (mutate: (draft: Engagement) => Engagement, edit?: EditMeta) => void;
  reset: () => void;
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

/** How long a run of edits to the same field stays a single undo step. */
const COALESCE_MS = 700;
const HISTORY_LIMIT = 100;

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [engagement, setEngagement] = useState<Engagement>(meridian);
  const [sensitivity, setSensitivity] = useState<Sensitivity>(NO_SENSITIVITY);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(meridian.scenarios[0]!.id);
  const [isDirty, setIsDirty] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [reconciliation, setReconciliation] = useState<string[]>([]);
  const [past, setPast] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
  const lastEdit = useRef<{ coalesce?: string; at: number }>({ at: 0 });

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
        setEngagement(reconciled);
        setReconciliation(notes);
        setIsDirty(true);
      }
    } catch {
      // A corrupt saved model should never stop the app loading.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !isDirty) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(engagement));
    } catch {
      // Out of quota, private mode — not worth interrupting the user over.
    }
  }, [engagement, hydrated, isDirty]);

  const update = useCallback((mutate: (draft: Engagement) => Engagement, edit?: EditMeta) => {
    const now = Date.now();
    const previous = lastEdit.current;
    const continues =
      edit?.coalesce != null &&
      edit.coalesce === previous.coalesce &&
      now - previous.at < COALESCE_MS;

    setEngagement((current) => {
      const next = mutate(current);
      if (next === current) return current;
      // A continued run of edits to the same field extends the step already on the
      // stack rather than adding another, so undo takes back the whole change.
      if (!continues) {
        setPast((entries) =>
          [...entries, { engagement: current, label: edit?.label ?? 'change' }].slice(-HISTORY_LIMIT),
        );
        setFuture([]);
      }
      return next;
    });

    lastEdit.current = { coalesce: edit?.coalesce, at: now };
    setIsDirty(true);
  }, []);

  const undo = useCallback(() => {
    setPast((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return entries;
      setEngagement((current) => {
        setFuture((ahead) => [...ahead, { engagement: current, label: entry.label }]);
        return entry.engagement;
      });
      lastEdit.current = { at: 0 };
      setIsDirty(true);
      return entries.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return entries;
      setEngagement((current) => {
        setPast((behind) => [...behind, { engagement: current, label: entry.label }]);
        return entry.engagement;
      });
      lastEdit.current = { at: 0 };
      setIsDirty(true);
      return entries.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => {
    setEngagement(meridian);
    setSensitivity(NO_SENSITIVITY);
    setIsDirty(false);
    setReconciliation([]);
    setPast([]);
    setFuture([]);
    lastEdit.current = { at: 0 };
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing to do */
    }
  }, []);

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
      undo,
      redo,
      undoLabel: past[past.length - 1]?.label ?? null,
      redoLabel: future[future.length - 1]?.label ?? null,
      isDirty,
      reconciliation,
      dismissReconciliation: () => setReconciliation([]),
      selectedScenarioId,
      setSelectedScenarioId,
    }),
    [
      engagement,
      stressed,
      analysis,
      findings,
      sensitivity,
      update,
      reset,
      undo,
      redo,
      past,
      future,
      isDirty,
      reconciliation,
      selectedScenarioId,
    ],
  );

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
