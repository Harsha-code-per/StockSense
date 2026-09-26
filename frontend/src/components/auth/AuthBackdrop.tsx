'use client';

import { useRef } from 'react';
import { useAutoPauseVideo } from '@/lib/useAutoPauseVideo';
import { useMotionCapabilities } from '@/lib/useMotionCapabilities';

const VIDEO = '/videos/warehouse-login.mp4';
const POSTER = '/videos/posters/warehouse-login.jpg';

/**
 * Full-viewport cinematic backdrop shared by login, signup and forgot-password.
 * Decorative only (aria-hidden). Muted looping video that pauses off-screen;
 * under prefers-reduced-motion it renders the poster frame and no <video> at all.
 */
export function AuthBackdrop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { reducedMotion } = useMotionCapabilities();
  useAutoPauseVideo(videoRef, containerRef, reducedMotion);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden bg-[#0b1026]"
    >
      {reducedMotion ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={POSTER}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full scale-[1.04] object-cover"
          poster={POSTER}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src={VIDEO} type="video/mp4" />
        </video>
      )}
      {/* Legibility: deep navy on the form side, the warehouse stays vivid on the right. */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b1026]/95 via-[#0b1026]/60 to-[#0b1026]/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b1026]/80 via-transparent to-[#0b1026]/40" />
      {/* Brand glow */}
      <div className="absolute -left-32 top-1/4 size-[36rem] rounded-full bg-indigo-600/25 blur-[120px]" />
      {/* Soft vignette (also hides the corner watermark of the source clip). */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(11,16,38,0.85)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_91%_83%,rgba(11,16,38,0.97)_0%,rgba(11,16,38,0.9)_7%,transparent_16%)]" />
    </div>
  );
}
