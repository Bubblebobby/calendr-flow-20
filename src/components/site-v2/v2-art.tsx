import { useId } from "react";

import { cn } from "@/lib/utils";

/*
 * Decorative artwork for /v2, drawn here rather than borrowed: the warm-to-indigo ribbon behind
 * the hero (Stripe's gradient mesh), a dotted burst for the facts band, and the hover arrow used
 * on buttons and links.
 */

/** Chevron that grows a stem on hover (needs a `group` parent). */
export function HoverArrow({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={cn("mt-px shrink-0", className)}
    >
      <path
        d="M0 5h7"
        className="opacity-0 transition-opacity duration-150 group-hover:opacity-100"
      />
      <path
        d="M1 1l4 4-4 4"
        className="transition-transform duration-150 group-hover:translate-x-[3px]"
      />
    </svg>
  );
}

/**
 * Wide curved bands in cream, orange, pink, magenta and indigo, softly blurred and drifting.
 * Sits behind the hero copy on the right.
 */
export function GradientRibbon({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      aria-hidden
      viewBox="0 0 900 800"
      preserveAspectRatio="xMidYMid slice"
      className={cn("v2-ribbon pointer-events-none", className)}
    >
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5e9d4" />
          <stop offset="0.3" stopColor="#ffb36b" />
          <stop offset="0.55" stopColor="#ff5c8a" />
          <stop offset="0.75" stopColor="#f96bee" />
          <stop offset="1" stopColor="#533afd" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9b8cff" />
          <stop offset="0.5" stopColor="#ea2261" />
          <stop offset="1" stopColor="#ffd3a3" />
        </linearGradient>
        <filter id={`${id}blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>
      <g filter={`url(#${id}blur)`} opacity="0.95">
        <path
          d="M140 -60 C 360 180, 420 420, 980 520"
          stroke={`url(#${id}a)`}
          strokeWidth="230"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M420 -120 C 520 160, 700 300, 1000 300"
          stroke={`url(#${id}b)`}
          strokeWidth="150"
          fill="none"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M260 40 C 420 260, 560 520, 980 760"
          stroke="#533afd"
          strokeWidth="70"
          fill="none"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>
    </svg>
  );
}

/** Rays of dots fanning up from a point, orange at the centre to indigo at the edge. */
export function DotBurst({ className }: { className?: string }) {
  const dots: { x: number; y: number; r: number; c: string }[] = [];
  const cx = 600;
  const cy = 520;
  for (let a = -84; a <= 84; a += 4) {
    const rad = ((a - 90) * Math.PI) / 180;
    const steps = 22 - Math.round(Math.abs(a) / 8);
    for (let i = 6; i < steps; i++) {
      const d = i * 22;
      const t = i / 22;
      dots.push({
        x: cx + Math.cos(rad) * d,
        y: cy + Math.sin(rad) * d,
        r: 1.2 + (1 - t) * 1.4,
        c: t < 0.35 ? "#ffb36b" : t < 0.6 ? "#ff5c8a" : "#533afd",
      });
    }
  }
  return (
    <svg aria-hidden viewBox="0 0 1200 540" className={cn("pointer-events-none", className)}>
      <defs>
        <radialGradient id="v2-burst-glow" cx="0.5" cy="1" r="0.8">
          <stop offset="0" stopColor="#ffd3a3" stopOpacity="0.7" />
          <stop offset="0.5" stopColor="#c7d2ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1200" height="540" fill="url(#v2-burst-glow)" />
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x.toFixed(1)}
          cy={dot.y.toFixed(1)}
          r={dot.r.toFixed(2)}
          fill={dot.c}
          opacity="0.8"
        />
      ))}
    </svg>
  );
}

/** Soft pastel wash behind a bento card's picture. */
export function CardWash({ tone }: { tone: "warm" | "cool" | "pink" | "violet" }) {
  const backgrounds = {
    warm: "radial-gradient(120% 80% at 100% 100%, #ffd3a3 0%, #ffe9d6 35%, transparent 70%)",
    cool: "radial-gradient(120% 80% at 100% 100%, #c7d2ff 0%, #e6ebff 40%, transparent 72%)",
    pink: "radial-gradient(120% 80% at 0% 100%, #ffc2d6 0%, #ffe3ec 40%, transparent 72%)",
    violet: "radial-gradient(100% 70% at 50% 100%, #b9b9f9 0%, #e9e6ff 45%, transparent 75%)",
  };
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{ background: backgrounds[tone] }}
    />
  );
}
