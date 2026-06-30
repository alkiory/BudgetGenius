import type { CSSProperties, ReactNode } from "react";

interface MockupFrameProps {
  variant: "mobile" | "tablet" | "desktop";
  src?: string;
  alt: string;
  /** Tilt the frame in degrees. Default 0. */
  rotate?: number;
  /** Scale relative to 1. Default 1. */
  scale?: number;
  /** Extra classes for the outer container. */
  className?: string;
  /** Optional children (rendered inside the screen area in place of an image). */
  children?: ReactNode;
  /** Image fetch priority. Defaults to lazy. */
  loading?: "eager" | "lazy";
}

/**
 * Shared "device frame" wrapper used across Hero / Showcase / FinalCTA.
 * Renders a tinted bezel + screen area; option to tilt and scale via inline CSS.
 * All sizing comes from the `variant`.
 */
export function MockupFrame({
  variant,
  src,
  alt,
  rotate = 0,
  scale = 1,
  className = "",
  children,
  loading = "lazy",
}: MockupFrameProps) {
  const dims = {
    mobile: { w: "w-64", h: "h-[34rem]", radius: "rounded-[2.25rem]" },
    tablet: { w: "w-72", h: "h-[26rem]", radius: "rounded-2xl" },
    desktop: {
      w: "w-full max-w-3xl",
      h: "h-auto",
      radius: "rounded-xl",
    },
  }[variant];

  const style: CSSProperties = {
    transform: `rotate(${rotate}deg) scale(${scale})`,
    transformOrigin: "center",
  };

  return (
    <div className={`relative ${dims.w} ${dims.h} ${className}`} style={style}>
      <div
        className={`relative h-full w-full overflow-hidden border-[10px] border-slate-900 bg-slate-900 shadow-2xl shadow-slate-900/30 dark:shadow-black/50 ${dims.radius}`}
      >
        <div
          className={`h-full w-full overflow-hidden bg-black ${dims.radius}`}
        >
          {src ? (
            <img
              src={src}
              alt={alt}
              className="block h-full w-full object-cover"
              loading={loading}
            />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
