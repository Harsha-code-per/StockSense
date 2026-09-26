'use client';

import { useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/useMotionCapabilities';
import { useAutoPauseVideo } from '@/lib/useAutoPauseVideo';

interface LazyMotionVideoProps {
  src: string;
  poster: string;
  ariaLabel: string;
  className?: string;
}

/**
 * Ambient, decorative background video. `src` is set once and never toggled —
 * offscreen/reduced-motion pauses playback via play()/pause() only, so the
 * browser keeps whatever it already buffered instead of refetching from byte 0
 * every time the element scrolls back into view.
 */
export function LazyMotionVideo({
  src,
  poster,
  ariaLabel,
  className = '',
}: LazyMotionVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const reducedMotion = useReducedMotion();
  useAutoPauseVideo(videoRef, containerRef, reducedMotion);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-950 ${className}`}
    >
      {!videoFailed ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          aria-label={ariaLabel}
          role="img"
          muted
          playsInline
          loop
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="h-full w-full object-cover select-none"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt={ariaLabel}
          className="h-full w-full object-cover opacity-90"
        />
      )}
    </div>
  );
}
