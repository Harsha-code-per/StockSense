'use client';

import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { useMotionCapabilities } from '@/lib/useMotionCapabilities';
import { useAutoPauseVideo } from '@/lib/useAutoPauseVideo';

const SPRING = { stiffness: 120, damping: 25, mass: 0.5 };

/**
 * Full-viewport decorative background for the login page only. Fixed + a
 * negative z-index so it paints behind the real (auth) layout and the login
 * card without needing to touch either — the card's opaque background simply
 * covers it where they overlap.
 *
 * Layers (BG_GRID, AMBIENT, WAREHOUSE, FOREGROUND_GLOW) never touch the real
 * form: no shared ancestor transform, no shared motion values.
 *
 * Scroll-linked motion binds to this component's own scroll progress rather
 * than manufacturing extra page height — the login form fits in one viewport
 * by design, so the scroll effect only engages if the viewport is naturally
 * short (small laptop, zoomed browser, landscape mobile) and never forces a
 * scrollbar that wasn't already there.
 */
export function LoginEnvironment() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { reducedMotion, interactiveParallax } = useMotionCapabilities();
  useAutoPauseVideo(videoRef, containerRef, reducedMotion);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const pointerX = useSpring(rawX, SPRING);
  const pointerY = useSpring(rawY, SPRING);

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!interactiveParallax || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    rawX.set(Math.max(-1, Math.min(1, nx)));
    rawY.set(Math.max(-1, Math.min(1, ny)));
  }
  function handlePointerLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });
  const scrollProgress = useSpring(scrollYProgress, SPRING);
  const warehouseScale = useTransform(
    scrollProgress,
    [0, 0.25, 0.5, 0.75, 1],
    [1, 1.025, 1.05, 1.075, 1.1],
  );
  const warehouseScrollY = useTransform(
    scrollProgress,
    [0, 0.25, 0.5, 0.75, 1],
    [0, -12, -28, -42, -55],
  );

  const bgX = useTransform(pointerX, [-1, 1], [-4, 4]);
  const bgY = useTransform(pointerY, [-1, 1], [-4, 4]);
  const ambientX = useTransform(pointerX, [-1, 1], [-6, 6]);
  const ambientY = useTransform(pointerY, [-1, 1], [-6, 6]);
  const warehousePointerX = useTransform(pointerX, [-1, 1], [-10, 10]);
  const warehousePointerY = useTransform(pointerY, [-1, 1], [-10, 10]);
  const warehouseY = useTransform(
    [warehousePointerY, warehouseScrollY],
    (values) => (values as number[]).reduce((a, b) => a + b, 0),
  );
  const warehouseRotateY = useTransform(pointerX, [-1, 1], [-1.2, 1.2]);
  const warehouseRotateX = useTransform(pointerY, [-1, 1], [0.8, -0.8]);
  const foregroundX = useTransform(pointerX, [-1, 1], [-16, 16]);
  const foregroundY = useTransform(pointerY, [-1, 1], [-16, 16]);

  if (reducedMotion) {
    // Static fallback: single frame, no transforms, no video decode/playback.
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 overflow-hidden bg-background"
      >
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(rgba(67,56,202,0.15)_1px,transparent_1px)] [background-size:28px_28px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/videos/posters/warehouse-login.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="fixed inset-0 -z-10 overflow-hidden bg-background"
      style={{ perspective: 1400 }}
    >
      {/* BG_GRID */}
      <motion.div
        className="absolute -inset-10 opacity-30 bg-[radial-gradient(rgba(67,56,202,0.18)_1px,transparent_1px)] [background-size:28px_28px]"
        style={{ x: interactiveParallax ? bgX : 0, y: interactiveParallax ? bgY : 0 }}
      />

      {/* AMBIENT */}
      <motion.div
        className="absolute -inset-10"
        style={{
          x: interactiveParallax ? ambientX : 0,
          y: interactiveParallax ? ambientY : 0,
        }}
      >
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 size-80 rounded-full bg-amber-400/10 blur-3xl" />
      </motion.div>

      {/* WAREHOUSE */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-0 lg:pr-[8%]"
        style={{
          x: interactiveParallax ? warehousePointerX : 0,
          y: warehouseY,
          rotateX: interactiveParallax ? warehouseRotateX : 0,
          rotateY: interactiveParallax ? warehouseRotateY : 0,
          scale: warehouseScale,
          transformStyle: 'preserve-3d',
        }}
      >
        <video
          ref={videoRef}
          src="/videos/warehouse-login.mp4"
          poster="/videos/posters/warehouse-login.jpg"
          muted
          playsInline
          loop
          preload="metadata"
          className="h-[70%] w-[60%] max-w-3xl rounded-2xl object-cover opacity-70"
        />
      </motion.div>

      {/* Bottom mask so the video blends into the page instead of a hard rectangle edge */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-background to-transparent" />
      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-background via-background/70 to-transparent" />

      {/* FOREGROUND_GLOW */}
      <motion.div
        className="absolute -inset-10"
        style={{
          x: interactiveParallax ? foregroundX : 0,
          y: interactiveParallax ? foregroundY : 0,
        }}
      >
        <div className="absolute top-1/3 right-1/4 size-40 rounded-full bg-indigo-400/10 blur-2xl" />
      </motion.div>
    </div>
  );
}
