import { toast } from 'sonner';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api';
export function formErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
) {
  const message =
    error instanceof Error
      ? error.message
      : 'Unable to save. Please try again.';
  toast.error(message);
  setError('root', { message });
  if (error instanceof ApiError) {
    for (const item of error.field_errors) {
      if (fields.includes(item.field))
        setError(item.field as Path<T>, { message: item.message });
    }
    if (
      error.code === 'DUPLICATE' &&
      typeof error.details.field === 'string' &&
      fields.includes(error.details.field)
    ) {
      setError(error.details.field as Path<T>, { message });
    }
  }
}
