'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpFromLine,
  BellRing,
  Boxes,
  ChevronDown,
  ClipboardCheck,
  Database,
  History,
  Lock,
  MonitorSmartphone,
  Server,
  ShieldCheck,
  Sparkles,
  Warehouse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShaderHero } from './ShaderHero';
import { SpotlightCard } from './SpotlightCard';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const API_DOCS = 'https://stocksense-api-vs0b.onrender.com/docs';
const REPO = 'https://github.com/Harsha-code-per/StockSense';

const STEPS = [
  {
    title: 'Receive',
    ref: 'WH/IN/0001',
    detail: '100 kg of steel from the vendor',
    delta: '+100',
    total: 100,
  },
  {
    title: 'Transfer',
    ref: 'WH/INT/0001',
    detail: '40 kg Stock → Production Floor',
    delta: '±40',
    total: 100,
  },
  {
    title: 'Deliver',
    ref: 'WH/OUT/0001',
    detail: '20 kg to a customer',
    delta: '−20',
    total: 80,
  },
  {
    title: 'Count',
    ref: 'WH/ADJ/0001',
    detail: 'Floor has 17, books said 20',
    delta: '−3',
    total: 77,
  },
];

const FEATURES = [
  {
    icon: ArrowDownToLine,
    title: 'Receipts',
    body: 'Goods from vendors. Stock rises only when validated.',
    span: '',
  },
  {
    icon: ArrowUpFromLine,
    title: 'Deliveries',
    body: 'Availability check (Waiting / Ready) before anything leaves. Overselling is refused.',
    span: '',
  },
  {
    icon: ArrowLeftRight,
    title: 'Internal transfers',
    body: 'Rack to rack, warehouse to warehouse. The company total never changes.',
    span: '',
  },
  {
    icon: Sparkles,
    title: 'Count next',
    body: 'Ranks which shelves to count first, with plain-language reasons: movements since the last count, days since, past mismatches. Record the count in one click.',
    span: 'md:col-span-2',
  },
  {
    icon: ClipboardCheck,
    title: 'Physical counts',
    body: 'Enter what you counted; see the difference before it posts.',
    span: '',
  },
  {
    icon: BellRing,
    title: 'Low-stock alerts',
    body: 'Min/max reorder rules and one-click draft receipts.',
    span: '',
  },
  {
    icon: History,
    title: 'Move history',
    body: 'Who, when, from where to where, balance after. Export to CSV.',
    span: '',
  },
  {
    icon: Warehouse,
    title: 'Multi-warehouse',
    body: 'Warehouses, racks, floors and zones, all tracked per location.',
    span: 'md:col-span-2',
  },
];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Nav glass on scroll
        ScrollTrigger.create({
          start: 80,
          end: 'max',
          toggleClass: { targets: '[data-nav]', className: 'nav-scrolled' },
        });

        // Hero entrance
        // Split only the plain line: splitting gradient-clipped text would hide it.
        const split = SplitText.create('[data-hero-split]', {
          type: 'chars,words',
          mask: 'chars',
        });
        gsap
          .timeline({ defaults: { ease: 'expo.out' } })
          .from(split.chars, { yPercent: 110, duration: 1.1, stagger: 0.025 })
          .from(
            '[data-hero-accent]',
            { yPercent: 40, opacity: 0, filter: 'blur(10px)', duration: 1.2 },
            '-=0.6',
          )
          .from(
            '[data-hero-fade]',
            { y: 24, opacity: 0, duration: 0.9, stagger: 0.12 },
            '-=0.7',
          );
        // Hero drifts away as you scroll
        gsap.to('[data-hero-content]', {
          yPercent: -18,
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: '[data-hero]',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });

        // Problem → one ledger (pinned, scrubbed)
        const words = gsap.utils.toArray<HTMLElement>('[data-problem-word]');
        const problem = gsap.timeline({
          scrollTrigger: {
            trigger: '[data-problem]',
            start: 'top top',
            end: '+=160%',
            scrub: 0.6,
            pin: true,
          },
        });
        words.forEach((w, i) => {
          problem.from(
            w,
            { opacity: 0.08, filter: 'blur(8px)', duration: 1 },
            i,
          );
          problem.to(
            w.querySelector('[data-strike]'),
            { scaleX: 1, duration: 0.6 },
            i + 0.6,
          );
        });
        problem
          .to(words, { opacity: 0.25, duration: 0.8 }, words.length + 0.4)
          .from(
            '[data-one-ledger]',
            { opacity: 0, scale: 0.85, filter: 'blur(12px)', duration: 1.2 },
            words.length + 0.4,
          );

        // Steel rod story (pinned): counter, step cards and ledger rows advance together
        const counter = { v: 0 };
        const counterEl = document.querySelector<HTMLElement>('[data-counter]');
        const cards = gsap.utils.toArray<HTMLElement>('[data-step-card]');
        const rows = gsap.utils.toArray<HTMLElement>('[data-ledger-row]');
        gsap.set(cards, { opacity: 0.35, scale: 0.97 });
        gsap.set(rows, { opacity: 0, x: -16 });
        if (counterEl) counterEl.textContent = '0';
        const story = gsap.timeline({
          scrollTrigger: {
            trigger: '[data-story]',
            start: 'top top',
            end: '+=260%',
            scrub: 0.8,
            pin: true,
          },
        });
        STEPS.forEach((step, i) => {
          story
            .to(
              cards[i],
              {
                opacity: 1,
                scale: 1,
                borderColor: 'rgba(129,140,248,0.6)',
                duration: 0.5,
              },
              i,
            )
            .to(rows[i], { opacity: 1, x: 0, duration: 0.5 }, i)
            .to(
              counter,
              {
                v: step.total,
                duration: 0.6,
                ease: 'power2.out',
                onUpdate: () => {
                  if (counterEl)
                    counterEl.textContent = String(Math.round(counter.v));
                },
              },
              i,
            );
          if (i > 0)
            story.to(
              cards[i - 1],
              {
                opacity: 0.55,
                borderColor: 'rgba(255,255,255,0.1)',
                duration: 0.4,
              },
              i,
            );
        });
        story.from(
          '[data-reconciled]',
          { opacity: 0, y: 12, duration: 0.5 },
          STEPS.length - 0.2,
        );

        // Product: tilted screen straightens (Aceternity "container scroll")
        gsap.fromTo(
          '[data-screen]',
          { rotateX: 28, scale: 0.86, y: 60 },
          {
            rotateX: 0,
            scale: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: '[data-showcase]',
              start: 'top 85%',
              end: 'center center',
              scrub: true,
            },
          },
        );

        // Bento cards and trust blocks reveal in batches
        ScrollTrigger.batch('[data-reveal]', {
          start: 'top 88%',
          onEnter: (els) =>
            gsap.from(els, {
              y: 40,
              opacity: 0,
              duration: 0.9,
              ease: 'expo.out',
              stagger: 0.08,
              overwrite: true,
            }),
          once: true,
        });

        // Data beam through the architecture
        gsap.fromTo(
          '[data-beam]',
          { strokeDashoffset: 1 },
          {
            strokeDashoffset: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: '[data-arch]',
              start: 'top 80%',
              end: 'bottom 55%',
              scrub: true,
            },
          },
        );

        return () => split.revert();
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className="landing min-h-dvh bg-[#070a1a] text-white">
      {/* Nav */}
      <header
        data-nav
        className="fixed inset-x-0 top-0 z-30 border-b border-transparent transition-all duration-300 [&.nav-scrolled]:border-white/10 [&.nav-scrolled]:bg-[#070a1a]/75 [&.nav-scrolled]:backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-indigo-900/50">
              <Boxes className="size-5" aria-hidden="true" />
            </span>
            StockSense
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              className="bg-white text-[#070a1a] hover:bg-white/90"
            >
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero: WebGL */}
        <section
          data-hero
          className="relative flex min-h-dvh items-center overflow-hidden"
        >
          <ShaderHero className="absolute inset-0 h-full w-full" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#070a1a]" />
          <div
            data-hero-content
            className="relative mx-auto w-full max-w-6xl px-4 pt-24 pb-16 sm:px-8"
          >
            <p
              data-hero-fade
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-100 backdrop-blur"
            >
              <span
                className="size-1.5 animate-pulse rounded-full bg-emerald-400"
                aria-hidden="true"
              />
              Inventory management, accuracy first
            </p>
            <h1
              data-hero-title
              className="mt-6 max-w-4xl text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-7xl"
            >
              <span data-hero-split>Every movement.</span>{' '}
              <span
                data-hero-accent
                className="inline-block bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-200 bg-clip-text pb-2 text-transparent"
              >
                Accounted for.
              </span>
            </h1>
            <p
              data-hero-fade
              className="mt-6 max-w-2xl text-lg text-indigo-100/80 text-pretty sm:text-xl"
            >
              StockSense replaces registers and spreadsheets with one live
              system where every receipt, delivery, transfer and count is a
              validated operation with a permanent audit trail.
            </p>
            <div data-hero-fade className="mt-9 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="bg-white text-[#070a1a] hover:bg-white/90"
              >
                <Link href="/signup">
                  Get started
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-white/5 text-white backdrop-blur hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
            <p data-hero-fade className="mt-5 text-sm text-indigo-100/60">
              Demo:{' '}
              <span className="font-mono text-indigo-100/90">
                manager@stocksense.dev
              </span>{' '}
              /{' '}
              <span className="font-mono text-indigo-100/90">Manager@123</span>
            </p>
          </div>
          <a
            href="#problem"
            aria-label="Scroll to the story"
            className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full p-2 text-white/60 hover:text-white"
          >
            <ChevronDown
              className="size-6 motion-safe:animate-bounce"
              aria-hidden="true"
            />
          </a>
        </section>

        {/* Problem → one ledger */}
        <section
          id="problem"
          data-problem
          className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4"
        >
          <div
            className="absolute left-1/2 top-1/2 size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-700/15 blur-[140px]"
            aria-hidden="true"
          />
          <div className="relative text-center">
            <p className="text-sm font-medium tracking-[0.25em] text-indigo-300/80 uppercase">
              Today, stock lives in
            </p>
            <ul className="mt-6 space-y-2 text-4xl font-semibold tracking-tight sm:text-6xl">
              {['Registers.', 'Spreadsheets.', 'Guesswork.'].map((w) => (
                <li
                  key={w}
                  data-problem-word
                  className="relative mx-auto w-fit"
                >
                  {w}
                  <span
                    data-strike
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 h-1 w-full origin-left scale-x-0 rounded bg-rose-400/80"
                  />
                </li>
              ))}
            </ul>
            <p
              data-one-ledger
              className="mt-10 bg-gradient-to-r from-indigo-200 via-white to-cyan-200 bg-clip-text text-5xl font-semibold tracking-tight text-transparent sm:text-7xl"
            >
              One ledger.
            </p>
          </div>
        </section>

        {/* Steel rod story */}
        <section
          data-story
          className="relative flex min-h-dvh items-center overflow-hidden px-4 py-16 sm:px-8"
        >
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-sm font-medium tracking-[0.25em] text-indigo-300/80 uppercase">
                Follow one steel rod
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Four operations. One number you can explain.
              </h2>
              <div className="mt-8 flex items-baseline gap-3">
                <span
                  data-counter
                  className="font-mono text-8xl font-semibold tabular-nums tracking-tighter sm:text-9xl"
                  aria-label="77 kilograms on hand"
                >
                  77
                </span>
                <span className="text-3xl text-indigo-200/70">kg</span>
              </div>
              <p
                data-reconciled
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-200"
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                Ledger reconciled: 100 − 20 − 3 = 77
              </p>
            </div>
            <div className="space-y-4">
              <ol className="grid gap-3 sm:grid-cols-2">
                {STEPS.map((s, i) => (
                  <li
                    key={s.ref}
                    data-step-card
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur"
                  >
                    <p className="text-xs text-indigo-200/60">Step {i + 1}</p>
                    <p className="mt-0.5 font-semibold">{s.title}</p>
                    <p className="mt-1 text-sm text-indigo-100/70">
                      {s.detail}
                    </p>
                  </li>
                ))}
              </ol>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 font-mono text-sm">
                <p className="border-b border-white/10 px-4 py-2 text-xs text-indigo-200/60">
                  stock_ledger · append-only
                </p>
                <ul>
                  {STEPS.map((s) => (
                    <li
                      key={s.ref}
                      data-ledger-row
                      className="flex items-center justify-between border-b border-white/5 px-4 py-2 last:border-0"
                    >
                      <span className="text-indigo-200/80">{s.ref}</span>
                      <span
                        className={
                          s.delta.startsWith('−')
                            ? 'text-rose-300'
                            : 'text-emerald-300'
                        }
                      >
                        {s.delta} kg
                      </span>
                      <span className="text-white/80">→ {s.total} kg</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Product showcase */}
        <section
          data-showcase
          className="relative px-4 py-24 sm:px-8"
          style={{ perspective: '1200px' }}
        >
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-sm font-medium tracking-[0.25em] text-indigo-300/80 uppercase">
              The command center
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              See everything. Act in one click.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-indigo-100/70">
              KPIs, low-stock alerts with one-click reorder, what to count next,
              and every open operation, all computed live from the ledger.
            </p>
          </div>
          <div
            data-screen
            className="mx-auto mt-14 max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-2 shadow-[0_40px_120px_-20px_rgba(79,70,229,0.55)]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
              <Image
                src="/landing/dashboard.png"
                alt="StockSense dashboard: stock KPIs, low-stock alerts with reorder, count-next list and recent operations"
                fill
                sizes="(min-width: 1024px) 1000px, 100vw"
                className="object-cover object-top"
              />
            </div>
          </div>
        </section>

        {/* Bento features */}
        <section aria-labelledby="features" className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2
              id="features"
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Everything a warehouse does
            </h2>
            <p className="mt-3 max-w-2xl text-indigo-100/70">
              From the dock to the shelf to the customer, and back to the
              physical count.
            </p>
            <ul className="mt-12 grid gap-4 md:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, body, span }) => (
                <li key={title} data-reveal className={span}>
                  <SpotlightCard className="h-full">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-200 ring-1 ring-indigo-400/20">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm text-indigo-100/70">{body}</p>
                  </SpotlightCard>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Trust + architecture */}
        <section aria-labelledby="trust" className="px-4 py-24 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2
              id="trust"
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Numbers you can trust
            </h2>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Lock,
                  title: 'All or nothing',
                  body: 'Each validation is one database transaction. A transfer can never update one side and not the other.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Enforced by the database',
                  body: 'Stock never goes negative, double clicks never move stock twice, and history cannot be edited.',
                },
                {
                  icon: History,
                  title: 'Proves itself',
                  body: 'A live check confirms every balance equals the sum of its movements: "Ledger reconciled ✓".',
                },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} data-reveal>
                  <SpotlightCard className="h-full">
                    <Icon
                      className="size-6 text-indigo-300"
                      aria-hidden="true"
                    />
                    <h3 className="mt-3 font-semibold">{title}</h3>
                    <p className="mt-1.5 text-sm text-indigo-100/70">{body}</p>
                  </SpotlightCard>
                </div>
              ))}
            </div>

            <div
              data-arch
              className="mt-16 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-10"
            >
              <p className="text-sm text-indigo-200/70">
                Every request travels one path, and every stock change lands in
                one place.
              </p>
              <div className="relative mt-8 grid grid-cols-3 items-center gap-4">
                <svg
                  className="absolute inset-x-[16%] top-1/2 hidden h-2 w-[68%] -translate-y-1/2 sm:block"
                  viewBox="0 0 100 2"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <line
                    x1="0"
                    y1="1"
                    x2="100"
                    y2="1"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="0.6"
                  />
                  <line
                    data-beam
                    x1="0"
                    y1="1"
                    x2="100"
                    y2="1"
                    stroke="url(#beam)"
                    strokeWidth="0.8"
                    pathLength={1}
                    strokeDasharray="1"
                  />
                  <defs>
                    <linearGradient id="beam" x1="0" x2="1">
                      <stop offset="0" stopColor="#818cf8" />
                      <stop offset="1" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                </svg>
                {[
                  { icon: MonitorSmartphone, title: 'Next.js', body: 'Vercel' },
                  { icon: Server, title: 'FastAPI', body: 'Render' },
                  {
                    icon: Database,
                    title: 'PostgreSQL',
                    body: 'Neon · constraints & row locks',
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <div
                    key={title}
                    className="relative flex flex-col items-center rounded-xl border border-white/10 bg-[#0b1026] p-4 text-center"
                  >
                    <Icon
                      className="size-6 text-indigo-300"
                      aria-hidden="true"
                    />
                    <p className="mt-2 font-semibold">{title}</p>
                    <p className="text-xs text-indigo-200/60">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden px-4 py-28 text-center sm:px-8">
          <div
            className="absolute left-1/2 top-1/2 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/20 blur-[140px]"
            aria-hidden="true"
          />
          <div data-reveal className="relative mx-auto max-w-3xl">
            <h2 className="text-4xl font-semibold tracking-tight sm:text-6xl">
              Try the whole flow in a minute.
            </h2>
            <p className="mt-4 text-lg text-indigo-100/70">
              Sign in with the demo manager, receive some steel, move it, ship
              it, count it, and watch the ledger explain every kilogram.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="bg-white text-[#070a1a] hover:bg-white/90"
              >
                <Link href="/login">
                  Open StockSense
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/signup">Create an account</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-indigo-100/60 sm:px-8">
          <p>StockSense · Built for the Odoo Hackathon 2026 · MIT licensed</p>
          <nav aria-label="Project links" className="flex gap-5">
            <a
              href={API_DOCS}
              className="hover:text-white"
              target="_blank"
              rel="noreferrer"
            >
              API docs
            </a>
            <a
              href={REPO}
              className="hover:text-white"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
