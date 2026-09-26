import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { AuthBackdrop } from '@/components/auth/AuthBackdrop';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center px-4 py-10 sm:px-10 lg:px-20">
      <AuthBackdrop />
      <div className="w-full max-w-md lg:ml-[4%]">
        <Link
          href="/"
          className="mb-8 flex w-fit items-center gap-3 rounded-md text-xl font-semibold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-indigo-900/40">
            <Boxes className="size-5" aria-hidden="true" />
          </span>
          StockSense
        </Link>
        <div className="rounded-2xl border border-white/20 bg-card/95 p-6 shadow-2xl shadow-black/40 ring-1 ring-black/5 backdrop-blur-xl sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-sm text-white/70">
          Every stock change is validated and recorded in the move history.
        </p>
      </div>
      <p
        aria-hidden="true"
        className="pointer-events-none absolute bottom-10 right-12 hidden text-right text-3xl font-semibold leading-tight tracking-tight text-white/90 drop-shadow-lg xl:block"
      >
        Every movement.
        <br />
        <span className="text-indigo-300">Accounted for.</span>
      </p>
    </main>
  );
}
