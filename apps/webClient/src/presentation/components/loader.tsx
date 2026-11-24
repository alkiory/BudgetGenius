export type BrandDotsSize = "xs" | "sm" | "md" | "lg";

const DOT_SIZE: Record<BrandDotsSize, number> = {
  xs: 3,
  sm: 4,
  md: 6,
  lg: 9,
};

const DOT_GAP: Record<BrandDotsSize, number> = {
  xs: 2,
  sm: 3,
  md: 4,
  lg: 6,
};

interface BrandDotsProps {
  size?: BrandDotsSize;
  className?: string;
  /** When set, the triplet is announced as a live loading status. */
  label?: string;
}

/**
 * The app-wide loading mark: three brand dots with the same staggered
 * bounce as the full-page loader. Uses `currentColor`, so it inherits
 * the surrounding palette (`text-primary`, the Finny composer's navy,
 * the avatar's white, ...) instead of hard-coded spinner colours.
 */
export function BrandDots({
  size = "md",
  className = "",
  label,
}: BrandDotsProps) {
  const dots = (
    <span
      aria-hidden="true"
      className={`inline-flex items-end ${className}`}
      style={{ gap: DOT_GAP[size] }}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="brand-loader-dot"
          style={{
            width: DOT_SIZE[size],
            height: DOT_SIZE[size],
            animationDelay: `${index * 0.16}s`,
          }}
        />
      ))}
    </span>
  );

  if (!label) return dots;

  return (
    <span role="status" aria-live="polite" aria-label={label}>
      {dots}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export default function Loader() {
  return (
    <div className="flex items-center justify-center py-6 text-primary">
      <BrandDots size="md" label="Loading" />
    </div>
  );
}
