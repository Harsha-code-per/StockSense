'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useApi } from '@/components/ui/useApi';
import { DataState } from '@/components/ui/DataState';
import type { OperationType } from '@/lib/types';

interface ActivityDay {
  date: string;
  receipt: number;
  delivery: number;
  transfer: number;
  adjustment: number;
}
interface DashboardActivity {
  days: ActivityDay[];
  pipeline: { draft: number; waiting: number; ready: number };
}

// Categorical order fixed by operation type (validated: CVD ΔE 9.1, normal ΔE 22.9 on white).
// Aqua/yellow are < 3:1 on white, so the legend and table view below are required relief.
const SERIES: { key: OperationType; label: string; color: string }[] = [
  { key: 'receipt', label: 'Receipts', color: '#2a78d6' },
  { key: 'delivery', label: 'Deliveries', color: '#eb6834' },
  { key: 'transfer', label: 'Transfers', color: '#1baf7a' },
  { key: 'adjustment', label: 'Adjustments', color: '#eda100' },
];

// Workflow stages keep the app-wide status colors (gray / amber / blue), with labels.
const STAGES = [
  { key: 'draft', label: 'Draft', color: '#94a3b8' },
  { key: 'waiting', label: 'Waiting', color: '#d97706' },
  { key: 'ready', label: 'Ready', color: '#2563eb' },
] as const;

const W = 640;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 28 };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / step) * step;
}
const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export function ActivityCharts({ warehouseId }: { warehouseId: string }) {
  const path = `/api/dashboard/activity?days=14${warehouseId ? `&warehouse_id=${warehouseId}` : ''}`;
  const activity = useApi<DashboardActivity>(path);
  const [hover, setHover] = useState<number | null>(null);

  if (activity.loading || activity.error || !activity.data) {
    return (
      <section className="rounded-xl border bg-card p-5 shadow-xs">
        <DataState
          loading={activity.loading}
          error={activity.error}
          retry={activity.reload}
        />
      </section>
    );
  }

  const { days, pipeline } = activity.data;
  const totals = days.map((d) => SERIES.reduce((sum, s) => sum + d[s.key], 0));
  const grand = totals.reduce((a, b) => a + b, 0);
  const max = niceMax(Math.max(...totals, 1));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / days.length;
  const barW = Math.min(28, band * 0.62);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const hovered = hover !== null ? days[hover] : null;
  const pipelineTotal = pipeline.draft + pipeline.waiting + pipeline.ready;
  const pipelineMax = Math.max(
    pipeline.draft,
    pipeline.waiting,
    pipeline.ready,
    1,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
      {/* Validated operations per day */}
      <section
        aria-labelledby="activity-title"
        className="rounded-xl border bg-card p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="activity-title"
              className="text-base font-semibold tracking-tight"
            >
              Validated operations, last 14 days
            </h2>
            <p className="text-xs text-muted-foreground">
              {grand} operation{grand === 1 ? '' : 's'} moved stock in this
              period
            </p>
          </div>
          <ul
            className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
            aria-label="Legend"
          >
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm"
                  style={{ background: s.color }}
                  aria-hidden="true"
                />
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-4">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label={`Stacked columns of validated operations per day for the last 14 days, ${grand} in total. The table view lists every value.`}
            onPointerLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 6}
                  y={y(t) + 3}
                  textAnchor="end"
                  fontSize={10}
                  fill="#6b7280"
                >
                  {t}
                </text>
              </g>
            ))}
            {days.map((d, i) => {
              const cx = PAD.left + band * i + band / 2;
              const x = cx - barW / 2;
              let acc = 0;
              const top = y(totals[i]);
              return (
                <g key={d.date}>
                  <clipPath id={`col-${i}`}>
                    <rect
                      x={x}
                      y={top}
                      width={barW}
                      height={PAD.top + innerH - top + 4}
                      rx={4}
                    />
                  </clipPath>
                  <g
                    clipPath={`url(#col-${i})`}
                    opacity={hover === null || hover === i ? 1 : 0.45}
                  >
                    {SERIES.map((s) => {
                      const v = d[s.key];
                      if (!v) return null;
                      const y1 = y(acc + v);
                      const y0 = y(acc);
                      acc += v;
                      // 2px surface gap between stacked segments
                      return (
                        <rect
                          key={s.key}
                          x={x}
                          y={y1}
                          width={barW}
                          height={Math.max(y0 - y1 - 2, 1)}
                          fill={s.color}
                        />
                      );
                    })}
                  </g>
                  {/* every other day, anchored on today so the last labels never collide */}
                  {(days.length - 1 - i) % 2 === 0 && (
                    <text
                      x={cx}
                      y={H - 8}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#6b7280"
                    >
                      {dayLabel(d.date)}
                    </text>
                  )}
                  {/* Hit target: the full band, bigger than the mark */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onPointerEnter={() => setHover(i)}
                  />
                </g>
              );
            })}
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(0)}
              y2={y(0)}
              stroke="#d1d5db"
              strokeWidth={1}
            />
          </svg>

          {hovered && hover !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-lg border bg-card p-3 text-xs shadow-lg"
              style={{
                left: `${((PAD.left + band * hover + band / 2) / W) * 100}%`,
              }}
            >
              <p className="font-semibold text-foreground">
                {dayLabel(hovered.date)}
              </p>
              <ul className="mt-1.5 space-y-1">
                {SERIES.map((s) => (
                  <li
                    key={s.key}
                    className="flex items-center justify-between gap-3 text-muted-foreground"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-sm"
                        style={{ background: s.color }}
                        aria-hidden="true"
                      />
                      {s.label}
                    </span>
                    <span className="font-mono text-foreground">
                      {hovered[s.key]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 flex justify-between border-t pt-1.5 font-medium text-foreground">
                Total <span className="font-mono">{totals[hover]}</span>
              </p>
            </div>
          )}
        </div>

        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-medium text-primary">
            View as table
          </summary>
          <div className="mt-2 max-h-56 overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60 text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-1.5 text-left font-medium">
                    Day
                  </th>
                  {SERIES.map((s) => (
                    <th
                      key={s.key}
                      scope="col"
                      className="px-3 py-1.5 text-right font-medium"
                    >
                      {s.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="px-3 py-1.5 text-right font-medium"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {days.map((d, i) => (
                  <tr key={d.date} className="border-t">
                    <th scope="row" className="px-3 py-1 text-left font-normal">
                      {dayLabel(d.date)}
                    </th>
                    {SERIES.map((s) => (
                      <td
                        key={s.key}
                        className="px-3 py-1 text-right font-mono"
                      >
                        {d[s.key]}
                      </td>
                    ))}
                    <td className="px-3 py-1 text-right font-mono font-medium">
                      {totals[i]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* Open pipeline */}
      <section
        aria-labelledby="pipeline-title"
        className="flex flex-col rounded-xl border bg-card p-5 shadow-xs"
      >
        <h2
          id="pipeline-title"
          className="text-base font-semibold tracking-tight"
        >
          Operation pipeline
        </h2>
        <p className="text-xs text-muted-foreground">
          {pipelineTotal} open operation{pipelineTotal === 1 ? '' : 's'} waiting
          to be validated
        </p>
        <ul className="mt-5 flex-1 space-y-4">
          {STAGES.map((s) => {
            const v = pipeline[s.key];
            return (
              <li key={s.key}>
                <Link
                  href={`/operations/board#${s.key}`}
                  className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground group-hover:underline">
                      {s.label}
                    </span>
                    <span className="font-mono text-foreground">{v}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-muted">
                    <div
                      className="h-2.5 rounded-full transition-[width] duration-500"
                      style={{
                        width: `${(v / pipelineMax) * 100}%`,
                        background: s.color,
                        minWidth: v ? 10 : 0,
                      }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/operations/board"
          className="mt-5 text-sm font-medium text-primary hover:underline"
        >
          Open the operations board →
        </Link>
      </section>
    </div>
  );
}
