import { useId } from "react";

export type FinnyMood = "teal" | "cyan" | "amber" | "rose";

const MOOD_ACCENTS: Record<
  FinnyMood,
  { ringStart: string; ringEnd: string; glow: string }
> = {
  teal: { ringStart: "#2dd4bf", ringEnd: "#0ea5e9", glow: "#38bdf8" },
  cyan: { ringStart: "#22d3ee", ringEnd: "#3b82f6", glow: "#22d3ee" },
  amber: { ringStart: "#fbbf24", ringEnd: "#f97316", glow: "#fbbf24" },
  rose: { ringStart: "#fb7185", ringEnd: "#ec4899", glow: "#fb7185" },
};

/**
 * Custom SVG recreation of Finny (the AI financial sidekick) with
 * blinking eyes, head-tilt sway, a waving hand, and mood-reactive glow.
 *
 * `asleep` is the unplugged state: Finny cannot reach its provider, so it
 * closes its eyes, stops waving and floats a quiet “z” instead of pretending
 * to be listening.
 */
export function FinnyAvatar({
  mood = "cyan",
  className = "h-10 w-10",
  animate = true,
  asleep = false,
}: {
  mood?: FinnyMood;
  className?: string;
  animate?: boolean;
  asleep?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const palette = MOOD_ACCENTS[mood];

  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${
        animate ? (asleep ? "animate-finny-sleep" : "animate-finny-bob") : ""
      }`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`finny-ring-${uid}`}
          x1="12"
          y1="12"
          x2="108"
          y2="108"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={palette.ringStart} />
          <stop offset="100%" stopColor={palette.ringEnd} />
        </linearGradient>
        <radialGradient id={`finny-bg-${uid}`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#0f294a" />
          <stop offset="100%" stopColor="#050c1a" />
        </radialGradient>
        <linearGradient
          id={`finny-shell-${uid}`}
          x1="60"
          y1="28"
          x2="60"
          y2="92"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient
          id={`finny-hair-${uid}`}
          x1="60"
          y1="8"
          x2="60"
          y2="68"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#2c3e66" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      {/* Outer badge */}
      <circle cx="60" cy="60" r="56" fill={`url(#finny-bg-${uid})`} />
      <circle
        cx="60"
        cy="60"
        r="55"
        stroke={`url(#finny-ring-${uid})`}
        strokeWidth="3.2"
      />

      {/* Neck & shoulders/vest */}
      <rect x="52" y="83" width="16" height="12" rx="5" fill="#0f172a" />
      <path d="M30 109C33 94 45 88 60 88C75 88 87 94 90 109" fill="#1e293b" />
      <path d="M43 90L60 104L77 90" fill="#e2e8f0" opacity="0.92" />
      {/* Mini chart emblem on vest */}
      <path
        d="M68 99L72 95L75 97L80 92"
        stroke={palette.glow}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Waving hand — asleep Finny keeps its arms still. */}
      <g className={animate && !asleep ? "finny-hand" : undefined}>
        <path
          d="M28 97L21 82"
          stroke="#cbd5e1"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle cx="19" cy="77" r="5.5" fill={`url(#finny-shell-${uid})`} />
        <path
          d="M17 72L15 65"
          stroke="#ffffff"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <path
          d="M11 71L8 69M14 66L12 63"
          stroke={palette.glow}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.85"
        />
      </g>

      {/* Head group with gentle look-around sway (still while asleep) */}
      <g className={animate && !asleep ? "finny-head" : undefined}>
        {/* Top hair bun + glowing hairband */}
        <circle cx="68" cy="20" r="13" fill={`url(#finny-hair-${uid})`} />
        <path
          d="M56 26C62 23 73 24 79 29"
          stroke={palette.glow}
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Headphones */}
        <rect
          x="19"
          y="48"
          width="12"
          height="26"
          rx="6"
          fill={`url(#finny-shell-${uid})`}
        />
        <rect
          x="21.5"
          y="53"
          width="5"
          height="16"
          rx="2.5"
          fill={palette.glow}
        />
        <rect
          x="89"
          y="48"
          width="12"
          height="26"
          rx="6"
          fill={`url(#finny-shell-${uid})`}
        />
        <rect
          x="93.5"
          y="53"
          width="5"
          height="16"
          rx="2.5"
          fill={palette.glow}
        />

        {/* Robot head shell */}
        <rect
          x="27"
          y="32"
          width="66"
          height="55"
          rx="26"
          fill={`url(#finny-shell-${uid})`}
        />

        {/* Hair bangs */}
        <path
          d="M26 52C26 33 41 22 60 22C79 22 94 33 94 52C88 41 74 35 60 36C46 35 32 41 26 52Z"
          fill={`url(#finny-hair-${uid})`}
        />

        {/* Dark visor */}
        <rect x="34" y="42" width="52" height="36" rx="16" fill="#06101f" />

        {asleep ? (
          /* Closed eyes: a soft downward curve reads as sleeping */
          <g
            stroke={palette.glow}
            strokeWidth="3.2"
            strokeLinecap="round"
            opacity="0.9"
          >
            <path d="M41 57C44.5 62 49.5 62 53 57" />
            <path d="M67 57C70.5 62 75.5 62 79 57" />
          </g>
        ) : (
          /* Blinking eyes + lashes */
          <g className={animate ? "finny-eyes" : undefined}>
            <path
              d="M42 58C44 53 50 53 52 58"
              stroke={palette.glow}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M40 55L42.5 57M43 52.5L44.5 55"
              stroke={palette.glow}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <path
              d="M68 58C70 53 76 53 78 58"
              stroke={palette.glow}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M80 55L77.5 57M77 52.5L75.5 55"
              stroke={palette.glow}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Smile */}
        <path
          d={
            asleep ? "M55 67C58 69 62 69 65 67" : "M54 66C57 69.5 63 69.5 66 66"
          }
          stroke={palette.glow}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </g>

      {/* Dream bubbles, only while Finny is asleep */}
      {asleep && (
        <g
          className={animate ? "finny-zzz" : undefined}
          fill={palette.glow}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight="700"
        >
          <text x="88" y="34" fontSize="11">
            z
          </text>
          <text x="84" y="22" fontSize="14">
            z
          </text>
          <text x="78" y="11" fontSize="17">
            Z
          </text>
        </g>
      )}
    </svg>
  );
}
