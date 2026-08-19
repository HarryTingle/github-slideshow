'use client';

import { weekStartLabel, type Engagement } from '@scope/engine';

const PHASE_FILL = ['var(--olive-100)', 'var(--aegean-100)', 'var(--terracotta-100)'];
const PHASE_EDGE = ['var(--olive-300)', 'var(--aegean-200)', 'var(--terracotta-200)'];

export function Timeline({ engagement }: { engagement: Engagement }) {
  const weeks = engagement.weeks;
  const left = (week: number) => ((week - 1) / weeks) * 100;
  const span = (from: number, to: number) => ((to - from + 1) / weeks) * 100;
  const phases = [...engagement.phases].sort((a, b) => a.order - b.order);

  const tickEvery = Math.max(1, Math.round(weeks / 8));
  const ticks = Array.from({ length: weeks }, (_, i) => i + 1).filter(
    (week) => week === 1 || week === weeks || week % tickEvery === 0,
  );

  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="timeline-row">
        <span />
        <div className="timeline-scale">
          {ticks.map((week) => (
            <span className="timeline-tick" key={week} style={{ left: `${left(week) + span(week, week) / 2}%` }}>
              {weekStartLabel(engagement.startDate, week)}
            </span>
          ))}
        </div>
      </div>

      {phases.map((phase, phaseIndex) => {
        const workstreams = engagement.workstreams.filter((ws) => ws.phaseId === phase.id);
        return (
          <div key={phase.id} className="stack" style={{ gap: 2, marginTop: 10 }}>
            <div className="timeline-row">
              <span className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--ink-500)', fontWeight: 600 }}>
                {phase.name}
              </span>
              <div className="timeline-track">
                <div
                  className="timeline-bar"
                  style={{
                    left: `${left(phase.startWeek)}%`,
                    width: `${span(phase.startWeek, phase.endWeek)}%`,
                    background: PHASE_FILL[phaseIndex % PHASE_FILL.length],
                    border: `1px solid ${PHASE_EDGE[phaseIndex % PHASE_EDGE.length]}`,
                    fontWeight: 500,
                  }}
                >
                  Weeks {phase.startWeek}–{phase.endWeek}
                </div>
              </div>
            </div>
            {workstreams.map((workstream) => (
              <div className="timeline-row" key={workstream.id}>
                <span className="small" style={{ paddingLeft: 14, color: 'var(--ink-500)' }}>
                  {workstream.name}
                </span>
                <div className="timeline-track">
                  <div
                    className="timeline-bar"
                    style={{
                      left: `${left(workstream.startWeek)}%`,
                      width: `${span(workstream.startWeek, workstream.endWeek)}%`,
                      background: 'var(--sand-150)',
                      border: '1px solid var(--line)',
                      color: 'var(--ink-500)',
                    }}
                  >
                    {workstream.startWeek}–{workstream.endWeek}
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      <div className="timeline-row" style={{ marginTop: 18 }}>
        <span className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          Milestones
        </span>
        <div style={{ position: 'relative', height: 34 }}>
          {engagement.milestones.map((milestone) => (
            <span
              className="milestone-pin"
              key={milestone.id}
              style={{ left: `${left(milestone.week) + span(milestone.week, milestone.week) / 2}%` }}
            >
              <span className="diamond" />
              <span className="label">{milestone.name}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
