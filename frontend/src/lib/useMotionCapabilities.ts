'use client';

import { useSyncExternalStore } from 'react';

function subscribeMedia(query: string, callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(query);
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => subscribeMedia('(prefers-reduced-motion: reduce)', cb),
    () =>
      typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
    () => false,
  );
}

export function useIsTouch(): boolean {
  return useSyncExternalStore(
    (cb) => subscribeMedia('(hover: none) and (pointer: coarse)', cb),
    () =>
      typeof window !== 'undefined'
        ? window.matchMedia('(hover: none) and (pointer: coarse)').matches
        : false,
    () => false,
  );
}

/** Single source of truth for whether interactive parallax/tilt should run. */
export function useMotionCapabilities() {
  const reducedMotion = useReducedMotion();
  const isTouch = useIsTouch();
  return {
    reducedMotion,
    isTouch,
    interactiveParallax: !reducedMotion && !isTouch,
  };
}
