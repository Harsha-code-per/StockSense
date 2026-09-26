// Owner: Member 3. Confirm / Validate / Cancel actions for one operation.
// The backend is the state authority: buttons only hint at allowed actions
// (INVENTORY_RULES §Status lifecycle), and every button uses the API response
// as the new truth — no local status mutation, no frontend stock math.

'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { ApiError } from '@/lib/api';
import type { Operation, OperationType } from '@/lib/types';
import {
  cancelOperation,
  confirmOperation,
  TYPE_LABELS,
  validateOperation,
} from '@/lib/operations';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Action = 'confirm' | 'validate' | 'cancel';

export function OperationActions({
  operation,
  onChanged,
}: {
  operation: Operation;
  onChanged: (updated: Operation) => void;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const label = TYPE_LABELS[operation.type as OperationType];
  const { status } = operation;
  const canConfirm = status === 'draft' || status === 'waiting';
  const canValidate =
    status === 'draft' || status === 'waiting' || status === 'ready';
  const canCancel = status !== 'done' && status !== 'canceled';

  function failure(error: unknown, action: string) {
    const message =
      error instanceof Error ? error.message : `Could not ${action}.`;
    toast.error(message);
    // Stale-state rejections mean the operation changed elsewhere — reload so
    // the buttons reflect the backend's current status.
    if (error instanceof ApiError && (error.code === 'INVALID_STATE' || error.code === 'NOT_FOUND')) {
      onChanged(operation);
    }
  }

  async function run(action: Action) {
    if (pending) return; // double-submit protection
    setPending(action);
    try {
      if (action === 'confirm') {
        const updated = await confirmOperation(operation.id);
        toast.success(
          `${label} ${updated.reference} confirmed — status: ${updated.status}.`,
        );
        onChanged(updated);
      } else if (action === 'validate') {
        const result = await validateOperation(operation.id);
        const effects = result.stock_effects
          .map(
            (effect) =>
              `${effect.sku} ${effect.quantity_delta} at ${effect.location_name} (now ${effect.balance_after})`,
          )
          .join('; ');
        toast.success(
          result.already_done
            ? `${label} ${result.reference} was already validated.`
            : `${label} ${result.reference} validated.${effects ? ` ${effects}.` : ''}`,
        );
        onChanged(result);
      } else {
        const updated = await cancelOperation(operation.id);
        toast.success(`${label} ${updated.reference} canceled.`);
        setCancelOpen(false);
        onChanged(updated);
      }
    } catch (error) {
      failure(error, action);
    } finally {
      setPending(null);
    }
  }

  if (!canConfirm && !canValidate && !canCancel) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {canConfirm && (
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null}
          onClick={() => run('confirm')}
        >
          {pending === 'confirm' ? 'Confirming…' : 'Confirm'}
        </Button>
      )}
      {canValidate && (
        <Button
          type="button"
          disabled={pending !== null}
          onClick={() => run('validate')}
        >
          {pending === 'validate' ? 'Validating…' : 'Validate'}
        </Button>
      )}
      {canCancel && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={pending !== null}
            onClick={() => setCancelOpen(true)}
          >
            Cancel {label.toLowerCase()}
          </Button>
          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Cancel {label.toLowerCase()} {operation.reference}?
                </DialogTitle>
                <DialogDescription>
                  A canceled operation will never execute and cannot be undone.
                  Stock is not changed by canceling.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending !== null}
                  onClick={() => setCancelOpen(false)}
                >
                  Keep {label.toLowerCase()}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending !== null}
                  onClick={() => run('cancel')}
                >
                  {pending === 'cancel' ? 'Canceling…' : 'Yes, cancel it'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
