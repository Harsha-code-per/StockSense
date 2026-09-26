import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpFromLine,
  BellRing,
  Boxes,
  ClipboardCheck,
  History,
  Lock,
  ShieldCheck,
  Sparkles,
  Warehouse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const API_DOCS = 'https://stocksense-api-vs0b.onrender.com/docs';
const REPO = 'https://github.com/Harsha-code-per/StockSense';

const features = [
  {
    icon: ArrowDownToLine,
    title: 'Receipts',
    body: 'Record goods from vendors. Stock rises only when the receipt is validated.',
  },
  {
    icon: ArrowUpFromLine,
    title: 'Deliveries',
    body: 'Check availability (Waiting / Ready), then validate. Overselling is refused.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Internal transfers',
    body: 'Rack to rack or warehouse to warehouse. The company total never changes.',
  },
  {
    icon: ClipboardCheck,
    title: 'Physical counts',
    body: 'Enter what you counted and see the difference before it is posted.',
  },
  {
    icon: History,
    title: 'Move history',
    body: 'Every change with who, when, from where to where and the balance after. Export to CSV.',
  },
  {
    icon: Warehouse,
    title: 'Multi-warehouse',
    body: 'Warehouses with racks, floors and zones. Stock is tracked per location.',
  },
  {
    icon: BellRing,
    title: 'Low-stock alerts',
    body: 'Reorder rules (min/max) with a suggested quantity and one-click draft receipt.',
  },
  {
    icon: Sparkles,
    title: 'Count next',
    body: 'Ranks what to count first, with plain-language reasons. No black box.',
  },
];

const story = [
  {
    step: 'Receive',
    detail: '100 kg of steel from the vendor',
    total: '100 kg',
  },
  {
    step: 'Transfer',
    detail: '40 kg to the production floor',
    total: '100 kg',
  },
  { step: 'Deliver', detail: '20 kg to a customer', total: '80 kg' },
  {
    step: 'Count',
    detail: 'The floor has 17, not 20: −3 posted',
    total: '77 kg',
  },
];

const trust = [
  {
    icon: Lock,
    title: 'All or nothing',
    body: 'Each validation is one database transaction. A transfer can never leave one side updated and the other not.',
  },
  {
    icon: ShieldCheck,
    title: 'Enforced by the database',
    body: 'Stock can never go negative, double clicks never move stock twice, and history cannot be edited.',
  },
  {
    icon: History,
    title: 'Proves itself',
    body: 'A live check confirms every balance equals the sum of its recorded movements: "Ledger reconciled ✓".',
  },
];

export function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Boxes className="size-5" aria-hidden="true" />
            </span>
            StockSense
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-8 lg:grid-cols-[1fr_1.15fr] lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <span
                className="size-1.5 rounded-full bg-success"
                aria-hidden="true"
              />
              Inventory management, accuracy first
            </p>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Every movement.
              <br />
              <span className="text-primary">Accounted for.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
              Replace registers and spreadsheets with one app where every stock
              change is a validated operation with a permanent audit trail. Know
              what you have, where it is, and why the number changed.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Get started
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Demo: <span className="font-mono">manager@stocksense.dev</span> /{' '}
              <span className="font-mono">Manager@123</span>
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card shadow-lg">
            <div
              className="flex items-center gap-1.5 border-b bg-muted/60 px-4 py-2.5"
              aria-hidden="true"
            >
              <span className="size-2.5 rounded-full bg-destructive/40" />
              <span className="size-2.5 rounded-full bg-warning/40" />
              <span className="size-2.5 rounded-full bg-success/40" />
            </div>
            <div className="relative aspect-[16/10]">
              <Image
                src="/landing/dashboard.png"
                alt="StockSense dashboard with stock KPIs, low-stock alerts with reorder, and the count-next list"
                fill
                priority
                sizes="(min-width: 1024px) 600px, 100vw"
                className="object-cover object-top"
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="features" className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
            <h2
              id="features"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Everything a warehouse does, in one place
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              From the dock to the shelf to the customer, and back to the
              physical count.
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ icon: Icon, title, body }) => (
                <li key={title} className="rounded-xl border bg-background p-5">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          aria-labelledby="how"
          className="mx-auto max-w-6xl px-4 py-16 sm:px-8"
        >
          <h2
            id="how"
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            Follow one steel rod
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Four operations, and the move history explains exactly why the
            system says 77 kg.
          </p>
          <ol className="mt-10 grid gap-4 md:grid-cols-4">
            {story.map(({ step, detail, total }, index) => (
              <li key={step} className="relative rounded-xl border bg-card p-5">
                <p className="text-xs font-medium text-muted-foreground">
                  Step {index + 1}
                </p>
                <h3 className="mt-1 font-semibold">{step}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{detail}</p>
                <p className="mt-4 font-mono text-2xl font-semibold text-primary">
                  {total}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="trust" className="border-t bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8">
            <h2
              id="trust"
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
            >
              Numbers you can trust
            </h2>
            <ul className="mt-10 grid gap-6 md:grid-cols-3">
              {trust.map(({ icon: Icon, title, body }) => (
                <li key={title}>
                  <Icon className="size-6 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-background p-6">
              <div>
                <p className="font-semibold">Try the full flow in a minute</p>
                <p className="text-sm text-muted-foreground">
                  Sign in with the demo manager and receive, move, deliver and
                  count.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/login">
                  Open StockSense
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-8">
        <p>StockSense · Built for the Odoo Hackathon 2026 · MIT licensed</p>
        <nav aria-label="Project links" className="flex gap-5">
          <a
            href={API_DOCS}
            className="hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            API docs
          </a>
          <a
            href={REPO}
            className="hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </footer>
    </div>
  );
}
