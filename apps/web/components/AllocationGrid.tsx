'use client';

import {
  addAssignment,
  addPhase,
  addWorkstream,
  allocationToDays,
  contentsOf,
  fillAllocationDays,
  formatDays,
  formatMoney,
  headerSpans,
  quarterLabel,
  removeAssignment,
  removePhase,
  setPersonAnnualLeave,
  setPersonLeave,
  removeWorkstream,
  setAllocationDays,
  setAssignmentGrade,
  setAssignmentRole,
  setPersonName,
  setPhase,
  WEEKS_PER_YEAR,
  setWorkstream,
  sprintNumber,
  weekStartLabel,
  type Assignment,
  type EffortLine,
  type Engagement,
} from '@scope/engine';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmButton } from './ConfirmButton';
import { useModel } from '@/lib/store';

/**
 * The allocation grid — roles down, weeks across, FTE in the cells.
 *
 * Deliberately the view that most resembles the spreadsheet people already use, and
 * editable in the same way: every box takes a number of **days a week**, including the
 * empty ones — five is a full week. Typing outside a row's current range extends it (the
 * weeks stepped over are set to zero, so nothing is staffed that nobody asked for).
 *
 * Phase and workstream dates are edited here too, and the timeline above is a view of
 * the same fields — there is no second copy to keep in step. The containment rules live
 * in the engine (`edit.ts`), not in this component.
 *
 * ## Filling more than one cell
 *
 * A resource plan is not built a week at a time. The real unit is "three days a week,
 * weeks four to eleven", and typing that cell by cell is what sends people back to
 * Excel — so the grid borrows Excel's gesture rather than inventing one. Drag across
 * cells, or click one and shift-click another, then type a number: every selected cell
 * takes it, as one edit and one undo step. Arrow keys move, shift-arrows extend.
 *
 * Left and right arrows only jump cells once the caret is already at the end of the
 * value, so "2.5" can still be edited a character at a time.
 */
type Mode = 'allocation' | 'leave';

interface Selection {
  anchorRow: number;
  anchorWeek: number;
  focusRow: number;
  focusWeek: number;
}

export function AllocationGrid() {
  const { stressed, analysis, update } = useModel();
  const [trace, setTrace] = useState<EffortLine | null>(null);
  const [mode, setMode] = useState<Mode>('allocation');
  const [selection, setSelection] = useState<Selection | null>(null);
  const dragging = useRef(false);

  // A drag can end anywhere, including outside the table.
  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener('mouseup', stop);
    return () => window.removeEventListener('mouseup', stop);
  }, []);

  const linesByCell = useMemo(() => {
    const map = new Map<string, EffortLine>();
    for (const line of analysis.plan.lines) map.set(`${line.assignmentId}:${line.week}`, line);
    return map;
  }, [analysis]);

  const weeks = Array.from({ length: stressed.weeks }, (_, i) => i + 1);
  const sprintWeeks = stressed.sprintWeeks ?? 2;
  const quarters = headerSpans(stressed.weeks, (week) => quarterLabel(stressed.startDate, week));
  const sprints = headerSpans(stressed.weeks, (week) => `Sprint ${sprintNumber(week, sprintWeeks)}`);
  const sprintStarts = new Set(sprints.map((span) => span.from));

  const grades = [...stressed.grades].sort((a, b) => a.order - b.order);
  const roles = stressed.roles;
  const people = new Map(stressed.people.map((person) => [person.id, person]));
  const phases = [...stressed.phases].sort((a, b) => a.order - b.order);

  const columns = weeks.length + 1;

  // Assignment ids in the order they are drawn, so a selection can run down the grid
  // across phase and workstream headings without caring that they are there.
  const rowOrder = useMemo(() => {
    const ids: string[] = [];
    for (const phase of phases) {
      for (const workstream of stressed.workstreams.filter((ws) => ws.phaseId === phase.id)) {
        for (const assignment of stressed.assignments.filter(
          (candidate) => candidate.workstreamId === workstream.id,
        )) {
          ids.push(assignment.id);
        }
      }
    }
    return ids;
  }, [phases, stressed.workstreams, stressed.assignments]);

  const rect = selection && {
    fromRow: Math.min(selection.anchorRow, selection.focusRow),
    toRow: Math.max(selection.anchorRow, selection.focusRow),
    fromWeek: Math.min(selection.anchorWeek, selection.focusWeek),
    toWeek: Math.max(selection.anchorWeek, selection.focusWeek),
  };
  const selectedCells = rect
    ? (rect.toRow - rect.fromRow + 1) * (rect.toWeek - rect.fromWeek + 1)
    : 0;
  const isSelected = (row: number, week: number) =>
    rect != null &&
    row >= rect.fromRow &&
    row <= rect.toRow &&
    week >= rect.fromWeek &&
    week <= rect.toWeek;

  /**
   * Which sides of a selected cell sit on the edge of the selection.
   *
   * Drawn as one outline around the whole rectangle rather than a border on every cell:
   * a filled span is a single act, and a run of individually-boxed cells reads as a
   * mess of separate ones.
   */
  const selectionEdges = (row: number, week: number) =>
    rect == null
      ? null
      : {
          left: week === rect.fromWeek,
          right: week === rect.toWeek,
          top: row === rect.fromRow,
          bottom: row === rect.toRow,
        };

  const focusCell = useCallback((row: number, week: number) => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-cell="${row}:${week}"]`);
      el?.focus();
      el?.select();
    });
  }, []);

  const moveTo = useCallback(
    (row: number, week: number, extend: boolean) => {
      const nextRow = Math.max(0, Math.min(rowOrder.length - 1, row));
      const nextWeek = Math.max(1, Math.min(stressed.weeks, week));
      setSelection((previous) =>
        extend && previous
          ? { ...previous, focusRow: nextRow, focusWeek: nextWeek }
          : { anchorRow: nextRow, anchorWeek: nextWeek, focusRow: nextRow, focusWeek: nextWeek },
      );
      focusCell(nextRow, nextWeek);
    },
    [rowOrder.length, stressed.weeks, focusCell],
  );

  /**
   * One value, however many cells are selected.
   *
   * A fill is a single edit and deliberately not coalesced: a run of keystrokes in one
   * box should collapse into one undo step, but two separate fills are two decisions.
   */
  const applyDays = useCallback(
    (row: number, week: number, value: number | null) => {
      const id = rowOrder[row];
      if (!id) return;
      if (rect && selectedCells > 1 && isSelected(row, week)) {
        const ids = rowOrder.slice(rect.fromRow, rect.toRow + 1);
        update(
          (draft) => fillAllocationDays(draft, ids, rect.fromWeek, rect.toWeek, value),
          { label: `${selectedCells} cells` },
        );
        return;
      }
      update((draft) => setAllocationDays(draft, id, week, value), {
        label: 'the allocation',
        coalesce: `cell:${id}:${week}`,
      });
    },
    [rowOrder, rect, selectedCells, update],
  );

  const onCellKeyDown = useCallback(
    (row: number, week: number, event: React.KeyboardEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const atStart = (input.selectionStart ?? 0) === 0 && (input.selectionEnd ?? 0) === 0;
      const atEnd =
        (input.selectionStart ?? 0) === input.value.length &&
        (input.selectionEnd ?? 0) === input.value.length;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          return moveTo(row - 1, week, event.shiftKey);
        case 'ArrowDown':
        case 'Enter':
          event.preventDefault();
          return moveTo(row + 1, week, event.shiftKey && event.key !== 'Enter');
        case 'ArrowLeft':
          // Only once the caret has run out of value to walk through.
          if (!atStart && !event.shiftKey) return;
          event.preventDefault();
          return moveTo(row, week - 1, event.shiftKey);
        case 'ArrowRight':
          if (!atEnd && !event.shiftKey) return;
          event.preventDefault();
          return moveTo(row, week + 1, event.shiftKey);
        case 'Escape':
          event.preventDefault();
          return setSelection({
            anchorRow: row,
            anchorWeek: week,
            focusRow: row,
            focusWeek: week,
          });
        default:
      }
    },
    [moveTo],
  );

  const onCellMouseDown = useCallback(
    (row: number, week: number, event: React.MouseEvent) => {
      if (event.button !== 0) return;
      // Pressing inside an input starts the browser's own text-selection drag, which
      // captures the pointer — so no other cell ever sees a mouseenter and dragging
      // across the grid selects nothing. Suppressing it means focusing the box
      // ourselves, and selecting its contents so the next keystroke replaces the value
      // rather than appending to it.
      event.preventDefault();
      dragging.current = true;
      setSelection((previous) =>
        event.shiftKey && previous
          ? { ...previous, focusRow: row, focusWeek: week }
          : { anchorRow: row, anchorWeek: week, focusRow: row, focusWeek: week },
      );
      focusCell(row, week);
    },
    [focusCell],
  );

  const onCellMouseEnter = useCallback((row: number, week: number) => {
    if (!dragging.current) return;
    setSelection((previous) =>
      previous ? { ...previous, focusRow: row, focusWeek: week } : previous,
    );
  }, []);

  return (
    <>
      <div className="row gap-16 wrap" style={{ marginBottom: 14 }}>
        <div className="segmented">
          <button aria-pressed={mode === 'allocation'} onClick={() => setMode('allocation')}>
            Allocation
          </button>
          <button aria-pressed={mode === 'leave'} onClick={() => setMode('leave')}>
            Leave
          </button>
        </div>
        <span className="tiny muted">
          {mode === 'allocation' ? (
            selectedCells > 1 ? (
              <strong style={{ color: 'var(--olive-800)' }}>
                {selectedCells} cells selected — type a number to fill them all, or clear the box
                to empty them
              </strong>
            ) : (
              'Days a week each role is booked for. Drag across cells, or shift-click, to fill a whole span at once.'
            )
          ) : (
            'Days of leave booked, by person. Booking leave moves when it is taken, not how much of it there is — the allowance is already provided for.'
          )}
        </span>
      </div>

      <div className="table-scroll">
        <table className={`alloc${selectedCells > 1 ? ' selecting' : ''}`}>
          <thead>
            <tr className="r-quarter">
              <th className="rowhead" rowSpan={3}>
                <span className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Phase · workstream · role
                </span>
              </th>
              {quarters.map((span) => (
                <th className="ruler" key={span.from} colSpan={span.span}>
                  {span.label}
                </th>
              ))}
            </tr>
            <tr className="r-sprint">
              {sprints.map((span) => (
                <th className="ruler" key={span.from} colSpan={span.span}>
                  {span.span > 1 ? span.label : span.label.replace('Sprint ', 'S')}
                </th>
              ))}
            </tr>
            <tr className="r-week">
              {weeks.map((week) => (
                <th key={week} scope="col">
                  {week}
                  <span className="wk-date">{weekStartLabel(stressed.startDate, week)}</span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {phases.map((phase) => {
              const workstreams = stressed.workstreams.filter((ws) => ws.phaseId === phase.id);
              return (
                <FragmentRows key={phase.id}>
                  <tr className="phase-row">
                    <td className="rowhead">
                      <div className="rh-line">
                        <span className="grow">
                          <input
                            className="name-input phase"
                            aria-label={`Phase name: ${phase.name}`}
                            value={phase.name}
                            onChange={(event) =>
                              update((draft) => setPhase(draft, phase.id, { name: event.target.value }), {
                                label: 'the phase name',
                                coalesce: `phase-name:${phase.id}`,
                              })
                            }
                          />
                        </span>
                        <button
                          className="add-role"
                          onClick={() =>
                            update((draft) => addWorkstream(draft, phase.id), { label: 'adding a workstream' })
                          }
                          title="Add a workstream to this phase"
                        >
                          + workstream
                        </button>
                        <ConfirmButton
                          label="×"
                          title={`Delete ${phase.name}`}
                          confirmLabel={deleteWarning(stressed, phase.id)}
                          onConfirm={() =>
                            update((draft) => removePhase(draft, phase.id), {
                              label: `deleting ${phase.name}`,
                            })
                          }
                        />
                      </div>
                    </td>
                    <td colSpan={columns - 1} />
                  </tr>

                  {workstreams.map((workstream) => {
                    const assignments = stressed.assignments.filter(
                      (assignment) => assignment.workstreamId === workstream.id,
                    );
                    return (
                      <FragmentRows key={workstream.id}>
                        <tr className="ws-row">
                          <td className="rowhead">
                            <div className="rh-line" style={{ paddingLeft: 10 }}>
                              <span className="grow">
                                <input
                                  className="name-input ws"
                                  aria-label={`Workstream name: ${workstream.name}`}
                                  value={workstream.name}
                                  onChange={(event) =>
                                    update(
                                      (draft) => setWorkstream(draft, workstream.id, { name: event.target.value }),
                                      { label: 'the workstream name', coalesce: `ws-name:${workstream.id}` },
                                    )
                                  }
                                />
                              </span>
                              <button
                                className="add-role"
                                onClick={() =>
                                  update((draft) => addAssignment(draft, workstream.id), {
                                    label: 'adding a role',
                                  })
                                }
                                title="Add a role to this workstream"
                              >
                                + role
                              </button>
                              <ConfirmButton
                                label="×"
                                title={`Delete ${workstream.name}`}
                                confirmLabel={
                                  assignments.length
                                    ? `Delete + ${assignments.length} role${assignments.length === 1 ? '' : 's'}?`
                                    : 'Delete?'
                                }
                                onConfirm={() =>
                                  update((draft) => removeWorkstream(draft, workstream.id), {
                                    label: `deleting ${workstream.name}`,
                                  })
                                }
                              />
                            </div>
                          </td>
                          <td colSpan={columns - 1} />
                        </tr>

                        {assignments.map((assignment) => {
                          const person = assignment.personId ? people.get(assignment.personId) : undefined;
                          return (
                            <tr className="assignment-row" key={assignment.id}>
                              <td className="rowhead">
                                <div className="rh" style={{ paddingLeft: 20 }}>
                                  <div className="rh-line">
                                    <span className="grow">
                                      <input
                                        className={`name-input${person ? '' : ' unstaffed'}`}
                                        aria-label="Consultant name"
                                        placeholder="Unstaffed — type a name"
                                        value={person?.name ?? ''}
                                        onChange={(event) =>
                                          update(
                                            (draft) => setPersonName(draft, assignment.id, event.target.value),
                                            { label: 'the name', coalesce: `name:${assignment.id}` },
                                          )
                                        }
                                        // Tidied on the way out, never while typing —
                                        // trimming on each keystroke eats the space
                                        // between a first name and a surname.
                                        onBlur={(event) =>
                                          update(
                                            (draft) => setPersonName(draft, assignment.id, event.target.value.trim()),
                                            { label: 'the name', coalesce: `name:${assignment.id}` },
                                          )
                                        }
                                      />
                                    </span>
                                    <ConfirmButton
                                      label="×"
                                      title="Remove this role"
                                      confirmLabel="Remove?"
                                      onConfirm={() =>
                                        update((draft) => removeAssignment(draft, assignment.id), {
                                          label: 'removing a role',
                                        })
                                      }
                                    />
                                  </div>
                                  {mode === 'leave' ? (
                                    <LeaveRowHead
                                      person={person}
                                      engagement={stressed}
                                      weeks={weeks}
                                      onAllowance={(days) =>
                                        person &&
                                        update((draft) => setPersonAnnualLeave(draft, person.id, days), {
                                          label: 'the leave allowance',
                                          coalesce: `allowance:${person.id}`,
                                        })
                                      }
                                    />
                                  ) : (
                                  <div className="rh-line">
                                    <select
                                      className="rh-select"
                                      aria-label="Level"
                                      value={assignment.gradeId}
                                      onChange={(event) =>
                                        update(
                                          (draft) => setAssignmentGrade(draft, assignment.id, event.target.value),
                                          { label: 'the level' },
                                        )
                                      }
                                    >
                                      {grades.map((grade) => (
                                        <option key={grade.id} value={grade.id}>
                                          {grade.name}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      className="rh-select"
                                      aria-label="Capability"
                                      value={assignment.roleId}
                                      onChange={(event) =>
                                        update(
                                          (draft) => setAssignmentRole(draft, assignment.id, event.target.value),
                                          { label: 'the capability' },
                                        )
                                      }
                                    >
                                      {roles.map((role) => (
                                        <option key={role.id} value={role.id}>
                                          {role.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  )}
                                </div>
                              </td>

                              {weeks.map((week) =>
                                mode === 'leave' ? (
                                  <LeaveCell
                                    key={week}
                                    week={week}
                                    person={person}
                                    line={linesByCell.get(`${assignment.id}:${week}`)}
                                    sprintEdge={sprintStarts.has(week)}
                                    onChange={(value) =>
                                      person &&
                                      update((draft) => setPersonLeave(draft, person.id, week, value), {
                                        label: 'leave',
                                        coalesce: `leave:${person.id}:${week}`,
                                      })
                                    }
                                  />
                                ) : (
                                  <Cell
                                    key={week}
                                    week={week}
                                    row={rowOrder.indexOf(assignment.id)}
                                    assignment={assignment}
                                    line={linesByCell.get(`${assignment.id}:${week}`)}
                                    workingDays={stressed.calendar.workingDaysPerWeek}
                                    sprintEdge={sprintStarts.has(week)}
                                    selected={isSelected(rowOrder.indexOf(assignment.id), week)}
                                    edges={
                                      isSelected(rowOrder.indexOf(assignment.id), week)
                                        ? selectionEdges(rowOrder.indexOf(assignment.id), week)
                                        : null
                                    }
                                    onTrace={setTrace}
                                    onMouseDown={onCellMouseDown}
                                    onMouseEnter={onCellMouseEnter}
                                    onKeyDown={onCellKeyDown}
                                    onChange={(value) =>
                                      applyDays(rowOrder.indexOf(assignment.id), week, value)
                                    }
                                  />
                                ),
                              )}
                            </tr>
                          );
                        })}
                      </FragmentRows>
                    );
                  })}
                </FragmentRows>
              );
            })}
          </tbody>
          {/*
            The team total, in the grid rather than in a chart next to it. It answers the
            resourcing question — how many people, which week — in the same row-and-column
            frame the numbers were typed into, so peak demand is read off the same object
            it was created in rather than inferred from a bar chart alongside.
          */}
          <tfoot>
            <tr className="totals-row">
              <td className="rowhead">
                <div className="rh">
                  <span className="totals-label">Team, FTE</span>
                  <span className="tiny muted">
                    Peak {analysis.plan.peakHeadcount.toFixed(1)} in week {analysis.plan.peakWeek ?? '—'}
                  </span>
                </div>
              </td>
              {weeks.map((week) => {
                const fte = analysis.plan.fteByWeek.get(week) ?? 0;
                const peak = analysis.plan.peakHeadcount;
                return (
                  <td key={week} className={`cell${sprintStarts.has(week) ? ' sprint-edge' : ''}`}>
                    <div className="cellbox totals-cell">
                      <span
                        className="totals-bar"
                        style={{ height: peak > 0 ? `${Math.max(2, (fte / peak) * 22)}px` : '2px' }}
                      />
                      <span className={fte > 0 ? '' : 'muted'}>{fte > 0 ? fte.toFixed(1) : '·'}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button
          className="add-phase"
          onClick={() => update((draft) => addPhase(draft), { label: 'adding a phase' })}
        >
          + Add phase
        </button>
      </div>

      <div className="sep" />
      <div className="row gap-24 wrap tiny muted">
        <span className="row gap-6">
          <span style={{ color: 'var(--olive-800)', fontWeight: 600 }}>3</span> Per-week override
        </span>
        <span>
          Drag or shift-click to select a span, then type once. Arrows move, shift-arrows extend,
          Escape collapses.
        </span>
        <span>
          {mode === 'allocation' ? (
            <>
              Boxes are days a week — {stressed.calendar.workingDaysPerWeek} is full time. Typing
              past a row&apos;s dates extends it; clearing the box at either end shortens it.
            </>
          ) : (
            <>
              Leave belongs to the person, so it shows on every row they appear on. Unstaffed roles
              carry the allowance but have nobody to book it for.
            </>
          )}
        </span>
      </div>

      {trace && <CellTrace line={trace} engagement={stressed} />}
    </>
  );
}

/**
 * Leave for one person: their allowance, and what is already against it.
 *
 * Shown rather than left implicit because it explains the thing that surprises people —
 * booking leave usually does not change the total effort. The allowance is provided for
 * across the weeks somebody works whether or not it is in the diary; putting it in the
 * diary only decides which weeks lose the capacity.
 */
function LeaveRowHead({
  person,
  engagement,
  weeks,
  onAllowance,
}: {
  person?: { id: string; annualLeaveDays?: number; leave?: Record<number, number> };
  engagement: Engagement;
  weeks: number[];
  onAllowance: (days: number | null) => void;
}) {
  if (!person) {
    return (
      <div className="rh-line">
        <span className="tiny muted">Unstaffed — nobody to book leave for</span>
      </div>
    );
  }
  const allowance = person.annualLeaveDays ?? engagement.annualLeaveDays ?? 0;
  const booked = weeks.reduce((total, week) => total + (person.leave?.[week] ?? 0), 0);
  const proRata = allowance * (weeks.length / WEEKS_PER_YEAR);
  const over = booked > proRata + 1e-9;

  return (
    <div className="rh-line">
      <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
        Allowance
      </span>
      <input
        className="wk-input"
        type="number"
        min={0}
        max={60}
        aria-label="Annual leave allowance for this person"
        value={allowance}
        onChange={(event) => {
          const raw = event.target.value.trim();
          onAllowance(raw === '' ? null : Number.parseFloat(raw) || 0);
        }}
        style={{ width: 46 }}
      />
      <span
        className="tiny"
        style={{
          whiteSpace: 'nowrap',
          // Booking beyond the pro-rata allowance is not an error — people do take more
          // leave in some quarters than others — but it does cost real capacity, so it
          // should not read the same as a booking the provision already covers.
          color: over ? 'var(--terracotta-700)' : 'var(--ink-400)',
        }}
        title={
          over
            ? `${(booked - proRata).toFixed(1)} days beyond the ${proRata.toFixed(1)} provided for over these weeks — that much capacity comes out of the plan.`
            : 'Within the allowance already provided for, so the total effort is unchanged.'
        }
      >
        {booked.toFixed(1)} of {proRata.toFixed(1)} booked
      </span>
    </div>
  );
}

/** One week of one person's leave. */
function LeaveCell({
  week,
  person,
  line,
  sprintEdge,
  onChange,
}: {
  week: number;
  person?: { id: string; leave?: Record<number, number> };
  line?: EffortLine;
  sprintEdge: boolean;
  onChange: (value: number | null) => void;
}) {
  const booked = person?.leave?.[week];
  return (
    <td className={`cell${sprintEdge ? ' sprint-edge' : ''}`}>
      <div className="cellbox">
        {person ? (
          <input
            className={`cellinput${booked ? ' override' : ' outside'}`}
            aria-label={`Leave in week ${week}`}
            placeholder="·"
            value={booked ?? ''}
            onChange={(event) => {
              const raw = event.target.value.trim();
              if (raw === '') return onChange(null);
              const parsed = Number.parseFloat(raw);
              if (!Number.isNaN(parsed)) onChange(parsed);
            }}
          />
        ) : (
          <span style={{ color: 'var(--ink-300)' }}>·</span>
        )}
      </div>
    </td>
  );
}

/** What deleting a phase would take with it — shown on the confirm step. */
function deleteWarning(engagement: Engagement, phaseId: string): string {
  const { workstreams, roles } = contentsOf(engagement, phaseId);
  if (roles === 0 && workstreams === 0) return 'Delete?';
  const parts = [];
  if (workstreams) parts.push(`${workstreams} workstream${workstreams === 1 ? '' : 's'}`);
  if (roles) parts.push(`${roles} role${roles === 1 ? '' : 's'}`);
  return `Delete + ${parts.join(', ')}?`;
}

/** Rows have to be siblings of <tr>, so grouping needs a fragment rather than a wrapper. */
function FragmentRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/** Trim trailing zeros so 5 shows as "5" and 2.5 as "2.5". */
function tidy(value: number): string {
  return Number.parseFloat(value.toFixed(2)).toString();
}

function Cell({
  week,
  row,
  assignment,
  line,
  workingDays,
  sprintEdge,
  selected,
  edges,
  onTrace,
  onMouseDown,
  onMouseEnter,
  onKeyDown,
  onChange,
}: {
  week: number;
  row: number;
  assignment: Assignment;
  line?: EffortLine;
  workingDays: number;
  sprintEdge: boolean;
  selected: boolean;
  edges: { left: boolean; right: boolean; top: boolean; bottom: boolean } | null;
  onTrace: (line: EffortLine | null) => void;
  onMouseDown: (row: number, week: number, event: React.MouseEvent) => void;
  onMouseEnter: (row: number, week: number) => void;
  onKeyDown: (row: number, week: number, event: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange: (value: number | null) => void;
}) {
  const inRange = week >= assignment.startWeek && week <= assignment.endWeek;
  const override = assignment.allocationByWeek?.[week];
  // A short week is no longer tinted. Leave is a commercial question — how much the team
  // takes and what that is worth is decided on the Commercials page, where the margin it
  // moves is on the same screen. Colouring it here made the plan look like it had a
  // problem when the plan was fine. The arithmetic is still on hover.
  const short = line != null && line.availableDays + line.leaveProvision < workingDays - 1e-9;
  const allocation = inRange ? (override ?? assignment.allocation) : override;
  const value = allocation == null ? '' : tidy(allocationToDays(allocation, workingDays));

  return (
    <td
      className={`cell${sprintEdge ? ' sprint-edge' : ''}${selected ? ' selected' : ''}`}
      style={
        edges
          ? {
              boxShadow: [
                edges.left ? 'inset 1px 0 0 var(--olive-600)' : null,
                edges.right ? 'inset -1px 0 0 var(--olive-600)' : null,
                edges.top ? 'inset 0 1px 0 var(--olive-600)' : null,
                edges.bottom ? 'inset 0 -1px 0 var(--olive-600)' : null,
              ]
                .filter(Boolean)
                .join(', '),
            }
          : undefined
      }
    >
      <div
        className="cellbox"
        onMouseDown={(event) => onMouseDown(row, week, event)}
        onMouseEnter={() => {
          onMouseEnter(row, week);
          if (line) onTrace(line);
        }}
        onMouseLeave={() => onTrace(null)}
        title={
          short
            ? `Only ${formatDays(line?.availableDays)} days available this week — holiday or leave`
            : undefined
        }
      >
        <input
          className={`cellinput${inRange ? '' : ' outside'}${override != null ? ' override' : ''}`}
          data-cell={`${row}:${week}`}
          onKeyDown={(event) => onKeyDown(row, week, event)}
          aria-label={`Days a week in week ${week}`}
          placeholder="·"
          value={value}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (raw === '') return onChange(null);
            const parsed = Number.parseFloat(raw);
            if (Number.isNaN(parsed)) return;
            onChange(parsed);
          }}
        />
      </div>
    </td>
  );
}

/** "Where did this number come from?" — answered from the line itself. */
function CellTrace({ line, engagement }: { line: EffortLine; engagement: Engagement }) {
  const grade = engagement.grades.find((candidate) => candidate.id === line.gradeId);
  return (
    <div className="trace-formula mt-16">
      <strong>Week {line.week}</strong> · {grade?.name} ·{' '}
      <code>
        {tidy(allocationToDays(line.allocation, engagement.calendar.workingDaysPerWeek))} days
        booked of {formatDays(line.availableDays, 2)} available
        {line.rampFactor < 1 ? ` × ${line.rampFactor.toFixed(2)} ramp` : ''} ={' '}
        {line.effortDays.toFixed(2)} delivered
      </code>
      <br />
      <code>
        {line.effortDays.toFixed(2)} days × {formatMoney(line.costRate)} cost ={' '}
        {formatMoney(line.cost)}
      </code>{' '}
      ·{' '}
      <code>
        × {formatMoney(line.chargeRate)} charge = {formatMoney(line.revenueAtRates)}
      </code>
    </div>
  );
}
