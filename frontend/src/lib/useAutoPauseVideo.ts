'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * Shared offscreen-pause behavior for decorative `<video>` elements: play while
 * intersecting and motion is allowed, pause otherwise. Never touches `src`, so
 * the browser resumes from its existing buffer instead of refetching.
 */
export function useAutoPauseVideo(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  reducedMotion: boolean,
) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(!!entry?.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reducedMotion || !isVisible) {
      video.pause();
    } else {
      video.play().catch(() => {});
    }
  }, [videoRef, reducedMotion, isVisible]);

  return isVisible;
}
