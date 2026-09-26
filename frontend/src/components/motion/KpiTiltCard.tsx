'use client';

import { useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useMotionCapabilities } from '@/lib/useMotionCapabilities';

const SPRING = { stiffness: 200, damping: 22, mass: 0.4 };
// Deliberately restrained: max 1.5deg, not the 3.5deg "gaming card" tilt this
// replaces. Disabled entirely for touch and prefers-reduced-motion.
const MAX_TILT = 1.5;

export function KpiTiltCard({
  href,
  className = '',
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const { interactiveParallax } = useMotionCapabilities();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const springX = useSpring(px, SPRING);
  const springY = useSpring(py, SPRING);
  const rotateX = useTransform(springY, [-0.5, 0.5], [MAX_TILT, -MAX_TILT]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-MAX_TILT, MAX_TILT]);
  const liftY = useSpring(0, SPRING);
  const specularOpacity = useSpring(0, SPRING);
  const specularX = useTransform(springX, [-0.5, 0.5], [20, 80]);
  const specularY = useTransform(springY, [-0.5, 0.5], [20, 80]);
  const specularBackground = useTransform(
    [specularX, specularY],
    ([x, y]) =>
      `radial-gradient(220px circle at ${x}% ${y}%, rgba(255,255,255,0.35), transparent 60%)`,
  );

  function handlePointerMove(e: React.PointerEvent<HTMLAnchorElement>) {
    if (!interactiveParallax || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width - 0.5);
    py.set((e.clientY - rect.top) / rect.height - 0.5);
  }
  function handlePointerEnter() {
    if (!interactiveParallax) return;
    liftY.set(-2);
    specularOpacity.set(1);
  }
  function handlePointerLeave() {
    px.set(0);
    py.set(0);
    liftY.set(0);
    specularOpacity.set(0);
  }

  return (
    <motion.div
      style={{
        perspective: 800,
        rotateX: interactiveParallax ? rotateX : 0,
        rotateY: interactiveParallax ? rotateY : 0,
        y: interactiveParallax ? liftY : 0,
      }}
    >
      <Link
        ref={ref}
        href={href}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-4 transition-colors ${className}`}
      >
        {interactiveParallax && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ opacity: specularOpacity, background: specularBackground }}
          />
        )}
        {children}
      </Link>
    </motion.div>
  );
}
