import { Boxes } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Pills keep the brand and footer readable over the login page's video backdrop. */}
        <div className="mx-auto mb-8 flex w-fit items-center justify-center gap-3 rounded-full bg-card/90 py-1.5 pl-1.5 pr-5 text-xl font-semibold tracking-tight shadow-xs backdrop-blur">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Boxes className="size-5" aria-hidden="true" />
          </span>
          StockSense
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-xs sm:p-8">
          {children}
        </div>
        <p className="mx-auto mt-6 w-fit rounded-full bg-card/90 px-3 py-1 text-center text-xs text-muted-foreground shadow-xs backdrop-blur">
          Every stock change is validated and recorded in the move history.
        </p>
      </div>
    </main>
  );
}
