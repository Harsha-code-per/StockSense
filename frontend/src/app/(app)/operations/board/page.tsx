'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  CheckCircle2,
  ClipboardCheck,
  GripVertical,
  type LucideIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/DataState';
import { useApi } from '@/components/ui/useApi';
import { confirmOperation, validateOperation } from '@/lib/operations';
import type {
  OperationStatus,
  OperationSummary,
  OperationType,
  Page,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const TYPES: {
  key: OperationType;
  label: string;
  plural: string;
  path: string;
  icon: LucideIcon;
}[] = [
  {
    key: 'receipt',
    label: 'Receipt',
    plural: 'Receipts',
    path: 'receipts',
    icon: ArrowDownToLine,
  },
  {
    key: 'delivery',
    label: 'Delivery',
    plural: 'Deliveries',
    path: 'deliveries',
    icon: ArrowUpFromLine,
  },
  {
    key: 'transfer',
    label: 'Transfer',
    plural: 'Transfers',
    path: 'transfers',
    icon: ArrowLeftRight,
  },
  {
    key: 'adjustment',
    label: 'Adjustment',
    plural: 'Adjustments',
    path: 'adjustments',
    icon: ClipboardCheck,
  },
];
const typeInfo = (t: OperationType) => TYPES.find((x) => x.key === t)!;

type Column = {
  status: OperationStatus;
  title: string;
  hint: string;
  accent: string;
};
const COLUMNS: Column[] = [
  {
    status: 'draft',
    title: 'Draft',
    hint: 'Being prepared',
    accent: 'bg-slate-400',
  },
  {
    status: 'waiting',
    title: 'Waiting',
    hint: 'Not enough stock yet',
    accent: 'bg-amber-500',
  },
  {
    status: 'ready',
    title: 'Ready',
    hint: 'Picked & packed',
    accent: 'bg-blue-600',
  },
  {
    status: 'done',
    title: 'Done',
    hint: 'Stock updated',
    accent: 'bg-emerald-600',
  },
];

/** What dropping a card of `from` into `to` means, or null if not allowed. */
function actionFor(
  from: OperationStatus,
  to: OperationStatus,
): 'confirm' | 'validate' | null {
  if (from === 'done' || from === 'canceled' || from === to) return null;
  if (to === 'done') return 'validate';
  if (
    (to === 'ready' || to === 'waiting') &&
    (from === 'draft' || from === 'waiting' || from === 'ready')
  )
    return 'confirm';
  return null;
}

function route(op: OperationSummary) {
  if (op.type === 'receipt') return op.destination_location?.full_name ?? '';
  if (op.type === 'transfer')
    return `${op.source_location?.full_name ?? ''} → ${op.destination_location?.full_name ?? ''}`;
  return op.source_location?.full_name ?? '';
}

export default function OperationsBoardPage() {
  const [type, setType] = useState<OperationType | ''>('');
  const [dragging, setDragging] = useState<OperationSummary | null>(null);
  const [over, setOver] = useState<OperationStatus | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const typeParam = type ? `&type=${type}` : '';
  const open = useApi<Page<OperationSummary>>(
    `/api/operations?status=draft,waiting,ready&page_size=100${typeParam}`,
  );
  const done = useApi<Page<OperationSummary>>(
    `/api/operations?status=done&page_size=12${typeParam}`,
  );

  const cards = [...(open.data?.items ?? []), ...(done.data?.items ?? [])];
  const reload = () => {
    open.reload();
    done.reload();
  };

  async function run(op: OperationSummary, action: 'confirm' | 'validate') {
    setPending(op.id);
    try {
      if (action === 'confirm') {
        const result = await confirmOperation(op.id);
        if (result.status === 'waiting')
          toast.warning(
            `${op.reference}: not enough stock yet, moved to Waiting.`,
          );
        else toast.success(`${op.reference} is ready.`);
      } else {
        const result = await validateOperation(op.id);
        const effects = result.stock_effects
          .map(
            (e) =>
              `${e.sku} ${e.quantity_delta.startsWith('-') ? '' : '+'}${e.quantity_delta} at ${e.location_name}`,
          )
          .join('; ');
        toast.success(
          `${op.reference} validated.${effects ? ` ${effects}` : ''}`,
        );
      }
    } catch (error) {
      toast.error(
        `${op.reference}: ${error instanceof Error ? error.message : 'Action failed.'}`,
      );
    } finally {
      setPending(null);
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Operations board"
        description="Every open receipt, delivery, transfer and count at a glance. Drag a card to Ready to check availability, or to Done to validate it and move stock."
      />

      <div
        role="group"
        aria-label="Filter by type"
        className="mb-5 flex flex-wrap gap-2"
      >
        {[{ key: '' as const, plural: 'All types' }, ...TYPES].map((t) => (
          <button
            key={t.key || 'all'}
            type="button"
            onClick={() => setType(t.key)}
            aria-pressed={type === t.key}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              type === t.key
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-muted',
            )}
          >
            {t.plural}
          </button>
        ))}
      </div>

      {(open.error || done.error) && (
        <DataState error={open.error ?? done.error} retry={reload} />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = cards.filter((c) => c.status === col.status);
          const droppable = dragging
            ? actionFor(dragging.status, col.status)
            : null;
          return (
            <section
              key={col.status}
              id={col.status}
              aria-label={`${col.title} column`}
              onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                setOver(col.status);
              }}
              onDragLeave={() => setOver((s) => (s === col.status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (dragging && droppable) void run(dragging, droppable);
                setDragging(null);
              }}
              className={cn(
                'flex min-h-72 flex-col rounded-xl border bg-muted/40 p-3 transition-all',
                dragging &&
                  droppable &&
                  'border-dashed border-primary/50 bg-accent/60',
                over === col.status && 'ring-2 ring-primary',
                dragging &&
                  !droppable &&
                  dragging.status !== col.status &&
                  'opacity-60',
              )}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn('size-2.5 rounded-full', col.accent)}
                    aria-hidden="true"
                  />
                  <h2 className="text-sm font-semibold">{col.title}</h2>
                  <span className="rounded-full bg-card px-2 text-xs font-medium text-muted-foreground">
                    {open.loading || done.loading ? '…' : items.length}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {col.hint}
                </span>
              </header>

              {open.loading || done.loading ? (
                <div className="space-y-2">
                  {[0, 1].map((i) => (
                    <div
                      key={i}
                      className="h-24 animate-pulse rounded-lg bg-card"
                    />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <p className="m-auto px-4 text-center text-xs text-muted-foreground">
                  {dragging && droppable
                    ? `Drop to ${droppable === 'validate' ? 'validate' : 'check availability'}`
                    : 'Nothing here'}
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((op) => {
                    const t = typeInfo(op.type);
                    const Icon = t.icon;
                    const movable = op.status !== 'done';
                    const busy = pending === op.id;
                    return (
                      <li
                        key={op.id}
                        draggable={movable && !busy}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', op.reference);
                          setDragging(op);
                        }}
                        onDragEnd={() => {
                          setDragging(null);
                          setOver(null);
                        }}
                        className={cn(
                          'group rounded-lg border bg-card p-3 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md',
                          movable && 'cursor-grab active:cursor-grabbing',
                          busy && 'animate-pulse',
                          dragging?.id === op.id && 'opacity-40',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Link
                            href={`/operations/${t.path}/${op.id}`}
                            className="font-mono text-sm font-semibold text-foreground hover:underline"
                          >
                            {op.reference}
                          </Link>
                          {movable ? (
                            <GripVertical
                              className="size-4 shrink-0 text-muted-foreground/60"
                              aria-hidden="true"
                            />
                          ) : (
                            <CheckCircle2
                              className="size-4 shrink-0 text-emerald-600"
                              aria-label="Done"
                            />
                          )}
                        </div>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Icon className="size-3.5" aria-hidden="true" />
                          {t.label} · {op.line_count} line
                          {op.line_count === 1 ? '' : 's'}
                        </p>
                        <p className="mt-1 truncate text-xs text-foreground/80">
                          {op.partner_name ? `${op.partner_name} · ` : ''}
                          {route(op)}
                        </p>
                        {movable && (
                          <div className="mt-2.5 flex gap-1.5">
                            {op.status !== 'ready' && (
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={busy}
                                onClick={() => run(op, 'confirm')}
                                aria-label={`Check availability for ${op.reference}`}
                              >
                                Confirm
                              </Button>
                            )}
                            <Button
                              size="xs"
                              disabled={busy}
                              onClick={() => run(op, 'validate')}
                              aria-label={`Validate ${op.reference}`}
                            >
                              Validate
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
