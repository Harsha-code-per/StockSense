'use client';

import { useEffect, useRef } from 'react';

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Indigo aurora (fbm noise) over a receding "warehouse floor" grid with a travelling
// light trace: the visual metaphor for stock moving through tracked locations.
const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res.xy) / u_res.y;
  float t = u_time * 0.06;

  // Aurora sky
  vec2 q = vec2(fbm(p * 1.4 + t), fbm(p * 1.4 - t + 4.0));
  float n = fbm(p * 1.8 + q * 1.6 + vec2(t * 0.8, -t) + u_mouse * 0.15);
  vec3 deep = vec3(0.027, 0.039, 0.102);
  vec3 indigo = vec3(0.263, 0.220, 0.792);
  vec3 violet = vec3(0.486, 0.227, 0.929);
  vec3 cyan = vec3(0.133, 0.827, 0.933);
  vec3 col = mix(deep, indigo, smoothstep(0.25, 0.85, n) * 0.85);
  col = mix(col, violet, smoothstep(0.55, 0.95, n) * 0.45 * (1.0 - uv.y * 0.4));
  col += cyan * pow(smoothstep(0.62, 0.98, n), 3.0) * 0.25;

  // Perspective floor grid on the lower half
  float horizon = 0.42;
  if (uv.y < horizon) {
    float depth = (horizon - uv.y);
    float z = 0.12 / max(depth, 0.001);
    vec2 g = vec2((uv.x - 0.5) * z * 6.0, z + u_time * 0.35);
    // Line width grows with distance (WebGL1 has no fwidth without an extension).
    vec2 gl = abs(fract(g) - 0.5) / vec2(0.035 * z + 0.02);
    float line = 1.0 - min(min(gl.x, gl.y), 1.0);
    float fade = smoothstep(0.0, 0.35, depth) * (1.0 - smoothstep(0.0, 1.0, depth * 1.6)) + depth * 0.4;
    col += vec3(0.35, 0.36, 0.95) * line * fade * 0.55;

    // Travelling trace: one bright path lighting up across the floor
    float lane = abs((uv.x - 0.5) * z * 6.0 - sin(z * 0.9 + u_time * 0.6) * 1.2);
    float trace = smoothstep(0.06, 0.0, lane) * smoothstep(0.02, 0.2, depth);
    col += vec3(0.45, 0.55, 1.0) * trace * 0.9;
  }

  // Horizon glow + vignette
  col += vec3(0.30, 0.28, 0.95) * exp(-abs(uv.y - horizon) * 22.0) * 0.35;
  float vig = smoothstep(1.25, 0.25, length(p * vec2(0.9, 1.15)));
  col *= mix(0.55, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Full-bleed WebGL canvas. Decorative (aria-hidden). Caps DPR at 1.5, pauses when
 * off-screen or the tab is hidden, and renders a single still frame under
 * prefers-reduced-motion. Falls back to a CSS gradient if WebGL is unavailable.
 */
export function ShaderHero({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return; // CSS gradient fallback stays visible

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let raf = 0;
    let visible = true;
    const start = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const draw = (now: number) => {
      resize();
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduced ? 12 : (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const loop = (now: number) => {
      draw(now);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const restart = () => {
      cancelAnimationFrame(raf);
      if (!reduced && visible && !document.hidden)
        raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      restart();
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', restart);
    window.addEventListener('pointermove', onMove, { passive: true });
    const onResize = () => draw(performance.now());
    window.addEventListener('resize', onResize);

    // Paint one frame right away so the canvas is never blank (e.g. opened in a
    // background tab, where requestAnimationFrame is paused), then animate.
    draw(performance.now());
    if (!reduced) restart();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener('visibilitychange', restart);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', onResize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`bg-[radial-gradient(ellipse_at_top,#312e81_0%,#070a1a_70%)] ${className}`}
    />
  );
}
