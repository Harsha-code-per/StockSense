import { Boxes } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3 text-xl font-semibold tracking-tight">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="size-5" aria-hidden="true" />
          </span>
          StockSense
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-xs sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Every stock change is validated and recorded in the move history.
        </p>
      </div>
    </main>
  );
}
