'use client';

import {
  formatDays,
  formatMoney,
  leaveView,
  marginEffectOfLeave,
  setPersonLeaveAdjustment,
  type Engagement,
  type LeaveLine,
} from '@scope/engine';
import { useMemo } from 'react';
import { useModel } from '@/lib/store';

/**
 * Leave as a commercial lever.
 *
 * It lives here rather than in the delivery plan because that is where it bites. On a
 * fixed price the client pays the same whoever is in the room, so a day somebody does
 * not work is a day we do not pay for — straight to margin. Under time and materials the
 * same day is not billed either, and a charge rate exceeds a cost rate, so the identical
 * change makes the deal *worse*. One lever, opposite signs, decided entirely by the
 * structure — which is why the effect column is scenario-aware.
 *
 * The column that stops this being dangerous is *days lost*. Margin taken out of
 * somebody's absence is only real if the work still fits in the days that remain.
 */
export function LeaveDesk() {
  const { stressed, analysis, selectedScenarioId, update, readOnly } = useModel();

  const entry =
    analysis.scenarios.find((s) => s.scenario.scenarioId === selectedScenarioId) ??
    analysis.scenarios[0]!;
  const followsEffort = entry.scenario.revenueFollowsEffort;

  const view = useMemo(() => leaveView(stressed, analysis.plan), [stressed, analysis]);

  const totalEffect = view.lines.reduce(
    (total, line) => total + marginEffectOfLeave(line, followsEffort),
    0,
  );

  const setAdjustment = (line: LeaveLine, days: number | null) => {
    if (!line.personId) return;
    update(
      (draft: Engagement) => setPersonLeaveAdjustment(draft, line.personId!, days),
      { label: `${line.name}’s leave`, coalesce: `leave:${line.personId}` },
    );
  };

  return (
    <>
      <div>
        <div className="leave-summary">
          <div className="desk-metric">
            <span className="k">Delivery days lost</span>
            <span className="v">{formatDays(view.totals.daysLostToLeave)}</span>
            <span className="sub">
              of {formatDays(view.totals.deliveryDays + view.totals.daysLostToLeave)} before leave
            </span>
          </div>
          <div className="desk-sep" />
          <div className="desk-metric">
            <span className="k">Cost avoided</span>
            <span className="v">{formatMoney(view.totals.costSaved)}</span>
            <span className="sub">days we do not pay for</span>
          </div>
          <div className="desk-sep" />
          <div className="desk-metric">
            <span className="k">Effect on {entry.scenario.name}</span>
            <span
              className="v"
              style={{ color: totalEffect >= 0 ? 'var(--status-good)' : 'var(--status-breach)' }}
            >
              {totalEffect >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(totalEffect))}
            </span>
            <span className="sub">
              {followsEffort
                ? 'billed for time, so the days are not billed either'
                : 'price is fixed, so the cost avoided is margin'}
            </span>
          </div>
        </div>

        <div className="desk-note">
          {followsEffort ? (
            <>
              Under <strong>{entry.scenario.name}</strong> leave is not a lever. The day is not
              billed any more than it is worked, and a charge rate exceeds a cost rate — so
              every day of leave takes more off revenue than it takes off cost. Switch to a
              fixed-price scenario to see it work in your favour.
            </>
          ) : (
            <>
              Under <strong>{entry.scenario.name}</strong> the client pays the same either way,
              so every day nobody works is margin. It is only margin you keep if the work still
              fits in the days that remain — <strong>{formatDays(view.totals.daysLostToLeave)} delivery
              days</strong> have come out of this plan, and after signature that is scope risk
              rather than profit.
            </>
          )}
        </div>

        <div className="table-scroll">
          <table className="leave-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Level</th>
                <th className="num">Weeks</th>
                <th className="num">Due</th>
                <th className="num">Booked</th>
                <th className="num">Adjust</th>
                <th className="num">Planned</th>
                <th className="num">Delivering</th>
                <th className="num">Days lost</th>
                <th className="num">Effect</th>
              </tr>
            </thead>
            <tbody>
              {view.lines.map((line) => {
                const effect = marginEffectOfLeave(line, followsEffort);
                const varies = Math.abs(line.varianceDays) >= 0.05;
                return (
                  <tr key={line.holderId}>
                    <td className={line.staffed ? undefined : 'muted'}>{line.name}</td>
                    <td className="muted">{line.gradeName}</td>
                    <td className="num muted">{line.weeksOnEngagement}</td>
                    <td className="num muted" title="The 23-day allowance, pro-rated to their weeks here">
                      {formatDays(line.entitlementDays)}
                    </td>
                    <td className="num muted">
                      {line.bookedDays > 0 ? formatDays(line.bookedDays) : '—'}
                    </td>
                    <td className="num">
                      {line.staffed ? (
                        <input
                          className={`rate-input adjust${line.adjustmentDays !== 0 ? ' overridden' : ''}`}
                          type="number"
                          step="0.5"
                          disabled={readOnly}
                          aria-label={`Adjust ${line.name}’s leave, in days`}
                          placeholder="±"
                          value={line.adjustmentDays === 0 ? '' : line.adjustmentDays}
                          onChange={(event) => {
                            const raw = event.target.value.trim();
                            if (raw === '') return setAdjustment(line, null);
                            const parsed = Number.parseFloat(raw);
                            if (!Number.isNaN(parsed)) setAdjustment(line, parsed);
                          }}
                        />
                      ) : (
                        <span className="tiny muted" title="Name the role in the delivery plan to flex its leave">
                          unnamed
                        </span>
                      )}
                    </td>
                    <td
                      className="num"
                      style={{ color: varies ? 'var(--olive-800)' : undefined, fontWeight: varies ? 600 : undefined }}
                      title={
                        varies
                          ? `${formatDays(Math.abs(line.varianceDays))} days ${line.varianceDays > 0 ? 'more' : 'less'} than they are due`
                          : undefined
                      }
                    >
                      {formatDays(line.plannedLeaveDays)}
                    </td>
                    <td className="num">{formatDays(line.deliveryDays)}</td>
                    <td className="num" style={{ color: 'var(--terracotta-700)' }}>
                      {formatDays(line.daysLostToLeave)}
                    </td>
                    <td
                      className="num"
                      style={{ color: effect >= 0 ? 'var(--status-good)' : 'var(--status-breach)' }}
                    >
                      {effect >= 0 ? '+' : '−'}
                      {formatMoney(Math.abs(effect))}
                    </td>
                  </tr>
                );
              })}
              <tr className="total">
                <td colSpan={3}>Total</td>
                <td className="num">{formatDays(view.totals.entitlementDays)}</td>
                <td className="num">
                  {view.totals.bookedDays === 0 ? '—' : formatDays(view.totals.bookedDays)}
                </td>
                <td className="num">
                  {view.totals.adjustmentDays === 0 ? '—' : formatDays(view.totals.adjustmentDays)}
                </td>
                <td className="num">{formatDays(view.totals.plannedLeaveDays)}</td>
                <td className="num">{formatDays(view.totals.deliveryDays)}</td>
                <td className="num">{formatDays(view.totals.daysLostToLeave)}</td>
                <td className="num" style={{ color: totalEffect >= 0 ? 'var(--status-good)' : 'var(--status-breach)' }}>
                  {totalEffect >= 0 ? '+' : '−'}
                  {formatMoney(Math.abs(totalEffect))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="tiny muted" style={{ margin: '12px 0 0' }}>
          <strong>Due</strong> is the {stressed.annualLeaveDays ?? 0}-day allowance pro-rated to
          the weeks each person is on this engagement — the sourced figure.{' '}
          <strong>Adjust</strong> is the assumption laid over it: days on top, or days taken
          back. Booked leave is a fact and cannot be adjusted away; book it week by week in the
          delivery plan.
        </p>
      </div>
    </>
  );
}
