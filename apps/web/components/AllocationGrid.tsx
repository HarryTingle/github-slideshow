'use client';

import { formatMoney, type Assignment, type EffortLine, type Engagement } from '@scope/engine';
import { useMemo, useState } from 'react';
import { useModel } from '@/lib/store';

/**
 * The allocation grid — roles down, weeks across, FTE in the cells.
 *
 * Deliberately the view that most resembles the spreadsheet people already use, and
 * directly editable for the same reason. Changing a cell writes a per-week override
 * on that assignment; every number elsewhere in the app moves with it.
 */
export function AllocationGrid() {
  const { stressed, analysis, update } = useModel();
  const [trace, setTrace] = useState<EffortLine | null>(null);

  const linesByCell = useMemo(() => {
    const map = new Map<string, EffortLine>();
    for (const line of analysis.plan.lines) map.set(`${line.assignmentId}:${line.week}`, line);
    return map;
  }, [analysis]);

  const weeks = Array.from({ length: stressed.weeks }, (_, i) => i + 1);
  const grades = new Map(stressed.grades.map((grade) => [grade.id, grade]));
  const roles = new Map(stressed.roles.map((role) => [role.id, role]));
  const people = new Map(stressed.people.map((person) => [person.id, person]));
  const phases = [...stressed.phases].sort((a, b) => a.order - b.order);

  const setAllocation = (assignment: Assignment, week: number, raw: string) => {
    const parsed = Number.parseFloat(raw);
    update((draft: Engagement) => ({
      ...draft,
      assignments: draft.assignments.map((candidate) => {
        if (candidate.id !== assignment.id) return candidate;
        const overrides = { ...(candidate.allocationByWeek ?? {}) };
        if (raw.trim() === '' || Number.isNaN(parsed)) delete overrides[week];
        else overrides[week] = Math.max(0, Math.min(2, parsed));
        return { ...candidate, allocationByWeek: overrides };
      }),
    }));
  };

  return (
    <>
      <div className="table-scroll">
        <table className="alloc">
          <thead>
            <tr>
              <th className="rowhead">Role / person</th>
              {weeks.map((week) => (
                <th key={week} scope="col">
                  {week}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {phases.map((phase) => {
              const workstreams = stressed.workstreams.filter((ws) => ws.phaseId === phase.id);
              const assignments = workstreams.flatMap((ws) =>
                stressed.assignments.filter((a) => a.workstreamId === ws.id).map((a) => ({ a, ws })),
              );
              if (assignments.length === 0) return null;
              return (
                <>
                  <tr className="phase-row" key={phase.id}>
                    <td colSpan={weeks.length + 1}>{phase.name}</td>
                  </tr>
                  {assignments.map(({ a, ws }) => {
                    const grade = grades.get(a.gradeId);
                    const person = a.personId ? people.get(a.personId) : undefined;
                    return (
                      <tr key={a.id}>
                        <td className="rowhead">
                          <div className="who">
                            {person?.name ?? (
                              <span style={{ color: 'var(--terracotta-700)' }}>
                                {roles.get(a.roleId)?.name} — unstaffed
                              </span>
                            )}
                          </div>
                          <div className="meta">
                            {grade?.name} · {ws.name}
                            {a.rampWeeks ? ` · ${a.rampWeeks}-week ramp` : ''}
                          </div>
                        </td>
                        {weeks.map((week) => {
                          const line = linesByCell.get(`${a.id}:${week}`);
                          const inRange = week >= a.startWeek && week <= a.endWeek;
                          const reduced = line != null && line.availableDays < stressed.calendar.workingDaysPerWeek;
                          const overridden = a.allocationByWeek?.[week] != null;
                          return (
                            <td className="cell" key={week}>
                              {inRange ? (
                                <div
                                  className="cellbox"
                                  onMouseEnter={() => line && setTrace(line)}
                                  onMouseLeave={() => setTrace(null)}
                                  style={{
                                    background: reduced ? 'var(--terracotta-100)' : undefined,
                                    borderRadius: 4,
                                  }}
                                  title={
                                    reduced
                                      ? `${line?.availableDays} days available this week — holiday or leave`
                                      : undefined
                                  }
                                >
                                  <input
                                    className="cellinput"
                                    aria-label={`Allocation for ${person?.name ?? roles.get(a.roleId)?.name} in week ${week}`}
                                    value={a.allocationByWeek?.[week] ?? a.allocation}
                                    onChange={(event) => setAllocation(a, week, event.target.value)}
                                    style={{
                                      color: overridden ? 'var(--olive-800)' : 'var(--ink-700)',
                                      fontWeight: overridden ? 600 : 400,
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="cellbox" style={{ color: 'var(--ink-300)' }}>
                                  ·
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sep" />
      <div className="row gap-24 wrap tiny muted">
        <span className="row gap-6">
          <span style={{ width: 12, height: 12, background: 'var(--terracotta-100)', borderRadius: 3, display: 'inline-block' }} />
          Reduced by holiday or leave
        </span>
        <span className="row gap-6">
          <span style={{ color: 'var(--olive-800)', fontWeight: 600 }}>0.6</span> Per-week override
        </span>
        <span>Type in any cell to change that week only. Everything downstream updates.</span>
      </div>

      {trace && <CellTrace line={trace} engagement={stressed} />}
    </>
  );
}

/** "Where did this number come from?" — answered from the line itself. */
function CellTrace({ line, engagement }: { line: EffortLine; engagement: Engagement }) {
  const grade = engagement.grades.find((candidate) => candidate.id === line.gradeId);
  return (
    <div className="trace-formula mt-16">
      <strong>Week {line.week}</strong> · {grade?.name} ·{' '}
      <code>
        {line.allocation} FTE × {line.availableDays} available days
        {line.rampFactor < 1 ? ` × ${line.rampFactor.toFixed(2)} ramp` : ''} ={' '}
        {line.effortDays.toFixed(2)} days
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
