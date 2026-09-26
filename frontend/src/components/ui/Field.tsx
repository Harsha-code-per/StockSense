import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
export function Field({
  name,
  label,
  error,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error && (
        <p
          id={`${name}-error`}
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
export const selectClass =
  'h-11 w-full min-w-0 rounded-md border bg-card px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';
