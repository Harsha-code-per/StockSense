'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, ClipboardCheck } from 'lucide-react';
import { useApi } from '@/components/ui/useApi';
import { DataState } from '@/components/ui/DataState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useReducedMotion } from '@/lib/useMotionCapabilities';
import type { CountPriorityItem } from '@/lib/types';

const levelStyles: Record<CountPriorityItem['level'], string> = {
  high: 'bg-danger-soft text-danger border-destructive/30',
  medium: 'bg-warning-soft text-warning border-warning/30',
  low: 'bg-success-soft text-success border-success/30',
};
const levelLabels: Record<CountPriorityItem['level'], string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

/**
 * Real count-priority data (GET /api/inventory/count-priority) rendered as a
 * rack-style grid, additive above the real OperationListPage. Every value —
 * score, level, reasons — comes straight from the backend; nothing is
 * computed here. Starting a count always goes through the real adjustment
 * lifecycle (OperationForm), never a local "commit" shortcut.
 */
export function SmartCountRiskPanel() {
  const priority = useApi<CountPriorityItem[] | { items: CountPriorityItem[] }>(
    '/api/inventory/count-priority?limit=12',
  );
  const items: CountPriorityItem[] = Array.isArray(priority.data)
    ? priority.data
    : Array.isArray(priority.data?.items)
      ? priority.data.items
      : [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();
  const selected = items.find((item) => item.product_id === selectedId) ?? items[0];

  if (priority.loading || priority.error || items.length === 0) {
    return (
      <section
        aria-label="Cycle count risk map"
        className="overflow-hidden rounded-xl border bg-card shadow-xs"
      >
        <DataState
          loading={priority.loading}
          error={priority.error}
          retry={priority.reload}
          empty="No cycle-count priorities right now — every location was recently verified."
        />
      </section>
    );
  }

  return (
    <section
      aria-label="Cycle count risk map"
      className="grid gap-6 rounded-xl border bg-card p-5 shadow-xs lg:grid-cols-3"
    >
      <div className="lg:col-span-2">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Cycle count risk map
          </h2>
          <p className="text-xs text-muted-foreground">
            Real priority scores from the count-priority engine — click or tab
            into a cell for the backend&apos;s reasons.
          </p>
        </div>
        <div
          role="group"
          aria-label="Product-location cells by count priority"
          className="grid grid-cols-3 gap-2.5 sm:grid-cols-4"
        >
          {items.map((item) => {
            const isSelected = item.product_id === selected?.product_id;
            const Cell = reducedMotion ? 'button' : motion.button;
            return (
              <Cell
                key={`${item.product_id}-${item.location_id}`}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedId(item.product_id)}
                whileHover={reducedMotion ? undefined : { scale: 1.03 }}
                transition={{ duration: 0.15 }}
                className={`flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  levelStyles[item.level]
                } ${isSelected ? 'ring-2 ring-primary' : ''}`}
              >
                <span className="font-mono font-semibold">{item.sku}</span>
                <span className="truncate text-[11px] opacity-80">
                  {item.location_name}
                </span>
              </Cell>
            );
          })}
        </div>
      </div>

      {/* Real explanation card — static DOM, never encoded into the animation */}
      {selected && (
        <div className="flex flex-col justify-between rounded-lg border bg-muted/20 p-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-foreground">
                {selected.sku}
              </span>
              <Badge className={levelStyles[selected.level]}>
                {levelLabels[selected.level]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-foreground">{selected.product_name}</p>
            <p className="text-xs text-muted-foreground">{selected.location_name}</p>

            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">On hand</dt>
                <dd className="font-mono font-medium text-foreground">
                  {selected.quantity} {selected.uom}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Score</dt>
                <dd className="font-mono font-medium text-foreground">
                  {selected.score}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Days since count</dt>
                <dd className="font-mono font-medium text-foreground">
                  {selected.days_since_count}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Movements since count</dt>
                <dd className="font-mono font-medium text-foreground">
                  {selected.movements_since_count}
                </dd>
              </div>
            </dl>

            {selected.reasons.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {selected.reasons.map((reason, i) => (
                  <li key={i}>• {reason}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Always the real adjustment lifecycle — no local commit/shortcut. */}
          <Button asChild size="sm" className="mt-4 w-full gap-1.5">
            <Link href="/operations/adjustments/new">
              <ClipboardCheck className="size-3.5" aria-hidden="true" />
              Start count
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
