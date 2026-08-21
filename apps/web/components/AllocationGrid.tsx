'use client';

import {
  addAssignment,
  addPhase,
  addWorkstream,
  allocationToDays,
  contentsOf,
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
import { useMemo, useState } from 'react';
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
 */
type Mode = 'allocation' | 'leave';

export function AllocationGrid() {
  const { stressed, analysis, update } = useModel();
  const [trace, setTrace] = useState<EffortLine | null>(null);
  const [mode, setMode] = useState<Mode>('allocation');

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
          {mode === 'allocation'
            ? 'Days a week each role is booked for.'
            : 'Days of leave booked, by person. Booking leave moves when it is taken, not how much of it there is — the allowance is already provided for.'}
        </span>
      </div>

      <div className="table-scroll">
        <table className="alloc">
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
                                    assignment={assignment}
                                    line={linesByCell.get(`${assignment.id}:${week}`)}
                                    workingDays={stressed.calendar.workingDaysPerWeek}
                                    sprintEdge={sprintStarts.has(week)}
                                    onTrace={setTrace}
                                    onChange={(value) =>
                                      update(
                                        (draft) => setAllocationDays(draft, assignment.id, week, value),
                                        { label: 'the allocation', coalesce: `cell:${assignment.id}:${week}` },
                                      )
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
  assignment,
  line,
  workingDays,
  sprintEdge,
  onTrace,
  onChange,
}: {
  week: number;
  assignment: Assignment;
  line?: EffortLine;
  workingDays: number;
  sprintEdge: boolean;
  onTrace: (line: EffortLine | null) => void;
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
    <td className={`cell${sprintEdge ? ' sprint-edge' : ''}`}>
      <div
        className="cellbox"
        onMouseEnter={() => line && onTrace(line)}
        onMouseLeave={() => onTrace(null)}
        title={
          short
            ? `Only ${formatDays(line?.availableDays)} days available this week — holiday or leave`
            : undefined
        }
      >
        <input
          className={`cellinput${inRange ? '' : ' outside'}${override != null ? ' override' : ''}`}
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
