'use client';

import { formatMoney } from '@scope/engine';
import { useState } from 'react';
import { useMeasure } from './useMeasure';

/**
 * Charts, hand-rolled in SVG.
 *
 * Shared rules, applied everywhere: 2px lines, recessive grid, a legend whenever
 * there is more than one series, direct labels rather than a number on every point,
 * and a crosshair tooltip on anything plotted over time.
 */

const PAD = { top: 14, right: 18, bottom: 26, left: 60 };

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  for (const step of steps) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

function shortMoney(minor: number): string {
  const major = Math.abs(minor) / 100;
  const sign = minor < 0 ? '−' : '';
  if (major >= 1_000_000) return `${sign}£${(major / 1_000_000).toFixed(1)}m`;
  if (major >= 1_000) return `${sign}£${Math.round(major / 1_000)}k`;
  return `${sign}£${Math.round(major)}`;
}

interface Tip {
  x: number;
  y: number;
  head: string;
  rows: { label: string; value: string; colour?: string }[];
}

function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  const flip = tip.x > width - 190;
  return (
    <div
      className="tooltip"
      style={{
        left: flip ? undefined : tip.x + 14,
        right: flip ? width - tip.x + 14 : undefined,
        top: Math.max(0, tip.y - 10),
      }}
      role="status"
    >
      <div className="tt-head">{tip.head}</div>
      {tip.rows.map((row) => (
        <div className="tt-row" key={row.label}>
          <span className="k">
            {row.colour && <span className="swatch" style={{ background: row.colour }} />}
            {row.label}
          </span>
          <span className="v">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export interface Series {
  id: string;
  label: string;
  colour: string;
  values: number[];
}

/**
 * Cumulative money over weeks — the burn and revenue curves.
 * One y-axis, always. Two measures of different scale would be two charts.
 */
export function CumulativeChart({
  series,
  weeks,
  height = 240,
  weekLabel = (week: number) => `Week ${week}`,
}: {
  series: Series[];
  weeks: number;
  height?: number;
  weekLabel?: (week: number) => string;
}) {
  const { setRef, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const plotWidth = Math.max(120, width - PAD.left - PAD.right);
  const plotHeight = height - PAD.top - PAD.bottom;
  const max = niceCeil(Math.max(1, ...series.flatMap((entry) => entry.values)));
  const x = (index: number) => PAD.left + (weeks <= 1 ? 0 : (index / (weeks - 1)) * plotWidth);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * max);
  const weekTicks = Array.from({ length: weeks }, (_, i) => i).filter(
    (i) => i === 0 || i === weeks - 1 || (i + 1) % Math.max(2, Math.round(weeks / 7)) === 0,
  );

  const tip: Tip | null =
    hover == null
      ? null
      : {
          x: x(hover),
          y: PAD.top + 4,
          head: weekLabel(hover + 1),
          rows: series.map((entry) => ({
            label: entry.label,
            value: formatMoney(entry.values[hover] ?? 0),
            colour: entry.colour,
          })),
        };

  return (
    <div className="chart-wrap" ref={setRef}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((entry) => (
            <span className="item" key={entry.id}>
              <span className="swatch line" style={{ background: entry.colour }} />
              {entry.label}
            </span>
          ))}
        </div>
      )}
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${series.map((s) => s.label).join(' and ')} over ${weeks} weeks`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="grid-line" x1={PAD.left} x2={PAD.left + plotWidth} y1={y(tick)} y2={y(tick)} />
            <text className="axis-label" x={PAD.left - 9} y={y(tick) + 3.5} textAnchor="end">
              {shortMoney(tick)}
            </text>
          </g>
        ))}
        {weekTicks.map((index) => (
          <text
            key={index}
            className="axis-label"
            x={x(index)}
            y={height - 8}
            textAnchor="middle"
          >
            {index + 1}
          </text>
        ))}

        {series.map((entry) => (
          <polyline
            key={entry.id}
            fill="none"
            stroke={entry.colour}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={entry.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')}
          />
        ))}

        {hover != null && (
          <line
            className="zero-line"
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + plotHeight}
          />
        )}
        {hover != null &&
          series.map((entry) => (
            <circle
              key={entry.id}
              cx={x(hover)}
              cy={y(entry.values[hover] ?? 0)}
              r={4.5}
              fill={entry.colour}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}

        {/* Hit targets, wider than the marks. */}
        {Array.from({ length: weeks }, (_, index) => (
          <rect
            key={index}
            x={x(index) - plotWidth / weeks / 2}
            y={PAD.top}
            width={plotWidth / weeks}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </svg>
      {tip && <Tooltip tip={tip} width={width} />}
    </div>
  );
}

/**
 * Cash position around zero — polarity, so a diverging treatment with a neutral
 * baseline. Below the line is money we are out of pocket.
 */
export function CashChart({
  values,
  height = 210,
  weekLabel = (week: number) => `Week ${week}`,
}: {
  values: number[];
  height?: number;
  weekLabel?: (week: number) => string;
}) {
  const { setRef, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const plotWidth = Math.max(120, width - PAD.left - PAD.right);
  const plotHeight = height - PAD.top - PAD.bottom;
  // Above and below zero are scaled independently and both are labelled. The exposure
  // is usually a fraction of the closing position, and a symmetric axis buries the one
  // number on this chart anybody is looking for.
  const up = niceCeil(Math.max(1, ...values.map((value) => Math.max(0, value))));
  const down = niceCeil(Math.max(1, ...values.map((value) => Math.max(0, -value))));
  const count = values.length;
  const barWidth = Math.max(3, plotWidth / Math.max(1, count) - 2); // 2px gap between bars
  const x = (index: number) => PAD.left + (index / Math.max(1, count)) * plotWidth;
  const upShare = up / (up + down);
  const zeroY = PAD.top + plotHeight * upShare;
  const y = (value: number) =>
    value >= 0
      ? zeroY - (value / up) * (plotHeight * upShare)
      : zeroY + (-value / down) * (plotHeight * (1 - upShare));

  return (
    <div className="chart-wrap" ref={setRef}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Cash position by week"
        onMouseLeave={() => setHover(null)}
      >
        {[up, 0, -down].map((tick) => (
          <g key={tick}>
            <line
              className={tick === 0 ? 'zero-line' : 'grid-line'}
              x1={PAD.left}
              x2={PAD.left + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="axis-label" x={PAD.left - 9} y={y(tick) + 3.5} textAnchor="end">
              {shortMoney(tick)}
            </text>
          </g>
        ))}

        {values.map((value, index) => {
          const positive = value >= 0;
          const top = positive ? y(value) : zeroY;
          const barHeight = Math.max(1, Math.abs(y(value) - zeroY));
          return (
            <rect
              key={index}
              x={x(index) + 1}
              y={top}
              width={barWidth}
              height={barHeight}
              rx={3}
              fill={positive ? 'var(--series-1)' : 'var(--series-3)'}
              opacity={hover == null || hover === index ? 1 : 0.45}
              onMouseEnter={() => setHover(index)}
            />
          );
        })}

        {Array.from({ length: count }, (_, index) => (
          <rect
            key={`hit-${index}`}
            x={x(index)}
            y={PAD.top}
            width={plotWidth / Math.max(1, count)}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}

        <text className="axis-label" x={PAD.left} y={height - 8}>
          1
        </text>
        <text className="axis-label" x={PAD.left + plotWidth} y={height - 8} textAnchor="end">
          {count}
        </text>
      </svg>
      {hover != null && (
        <Tooltip
          tip={{
            x: x(hover),
            y: PAD.top,
            head: weekLabel(hover + 1),
            rows: [
              {
                label: (values[hover] ?? 0) >= 0 ? 'Cash in hand' : 'Out of pocket',
                value: formatMoney(Math.abs(values[hover] ?? 0)),
                colour: (values[hover] ?? 0) >= 0 ? 'var(--series-1)' : 'var(--series-3)',
              },
            ],
          }}
          width={width}
        />
      )}
    </div>
  );
}

/** Ordered magnitude — a sequential ramp, light to dark, never categorical hues. */
export function RankBars({
  rows,
  formatValue,
}: {
  rows: { id: string; label: string; sublabel?: string; value: number; fraction: number }[];
  formatValue: (value: number) => string;
}) {
  // Rows arrive most-senior first, so the ramp runs dark to light: weight of colour
  // tracks seniority, which is what the reader expects it to mean.
  const ramp = ['var(--seq-6)', 'var(--seq-5)', 'var(--seq-4)', 'var(--seq-3)', 'var(--seq-2)', 'var(--seq-1)'];
  const max = Math.max(...rows.map((row) => row.fraction), 0.0001);
  return (
    <div className="stack" style={{ gap: 12 }}>
      {rows.map((row, index) => (
        <div key={row.id}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="small" style={{ color: 'var(--ink-700)' }}>
              {row.label}
              {row.sublabel && <span className="muted tiny"> · {row.sublabel}</span>}
            </span>
            <span className="small mono-num" style={{ color: 'var(--ink-900)' }}>
              {formatValue(row.value)}
              <span className="muted tiny"> · {(row.fraction * 100).toFixed(0)}%</span>
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--sand-150)', borderRadius: 4 }}>
            <div
              style={{
                width: `${Math.max(1.5, (row.fraction / max) * 100)}%`,
                height: '100%',
                borderRadius: 4,
                background: ramp[Math.min(ramp.length - 1, index)],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** FTE demand week by week — one series, so no legend; the title names it. */
export function DemandBars({
  values,
  height = 120,
  weekLabel = (week: number) => `Week ${week}`,
  capacityHint,
}: {
  values: number[];
  height?: number;
  weekLabel?: (week: number) => string;
  capacityHint?: number;
}) {
  const { setRef, width } = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 10, right: 8, bottom: 18, left: 30 };
  const plotWidth = Math.max(80, width - pad.left - pad.right);
  const plotHeight = height - pad.top - pad.bottom;
  const max = Math.max(1, ...values, capacityHint ?? 0);
  const slot = plotWidth / Math.max(1, values.length);
  const barWidth = Math.max(3, slot - 2);

  return (
    <div className="chart-wrap" ref={setRef}>
      <svg width={width} height={height} role="img" aria-label="FTE demand by week" onMouseLeave={() => setHover(null)}>
        <line className="grid-line" x1={pad.left} x2={pad.left + plotWidth} y1={pad.top} y2={pad.top} />
        <text className="axis-label" x={pad.left - 6} y={pad.top + 4} textAnchor="end">
          {max.toFixed(1)}
        </text>
        {capacityHint != null && (
          <line
            x1={pad.left}
            x2={pad.left + plotWidth}
            y1={pad.top + plotHeight - (capacityHint / max) * plotHeight}
            y2={pad.top + plotHeight - (capacityHint / max) * plotHeight}
            stroke="var(--terracotta-600)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}
        {values.map((value, index) => {
          const barHeight = Math.max(1, (value / max) * plotHeight);
          return (
            <rect
              key={index}
              x={pad.left + index * slot + 1}
              y={pad.top + plotHeight - barHeight}
              width={barWidth}
              height={barHeight}
              rx={3}
              fill="var(--series-1)"
              opacity={hover == null || hover === index ? 0.92 : 0.4}
              onMouseEnter={() => setHover(index)}
            />
          );
        })}
        <line className="zero-line" x1={pad.left} x2={pad.left + plotWidth} y1={pad.top + plotHeight} y2={pad.top + plotHeight} />
      </svg>
      {hover != null && (
        <Tooltip
          tip={{
            x: pad.left + hover * slot,
            y: 0,
            head: weekLabel(hover + 1),
            rows: [{ label: 'Demand', value: `${(values[hover] ?? 0).toFixed(2)} FTE`, colour: 'var(--series-1)' }],
          }}
          width={width}
        />
      )}
    </div>
  );
}
