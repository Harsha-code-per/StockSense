import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import Link from 'next/link';
export function DataState({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: Error;
  empty?: string;
  retry?: () => void;
}) {
  if (loading)
    return (
      <div role="status" aria-label="Loading data" className="space-y-4 p-8">
        <span className="sr-only">Loading data</span>
        {[1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-11 w-full" />
        ))}
      </div>
    );
  if (error)
    return (
      <div role="alert" className="space-y-4 p-8 text-center">
        <p className="font-medium">{error.message}</p>
        {error instanceof ApiError && error.status === 401 ? (
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={retry}>
            Try again
          </Button>
        )}
      </div>
    );
  return (
    <div
      role="status"
      className="p-12 text-center text-sm text-muted-foreground"
    >
      {empty}
    </div>
  );
}
