import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * Magnetic hover, ported from the ReactBits `Magnet` pattern
 * (https://reactbits.dev/animations/magnet) without pulling in a motion
 * library: the element follows the pointer with a damped translate and springs
 * back when the pointer leaves.
 *
 * Falls back to a static wrapper when the user prefers reduced motion or the
 * device has no hover-capable pointer (touch), so the button stays a plain
 * tap target there.
 */
interface MagnetProps {
  children: ReactNode;
  className?: string;
  /** 0 = no pull, 1 = element centre follows the cursor exactly. */
  strength?: number;
  maxOffset?: number;
}

const isHoverPointer = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Magnet({
  children,
  className = "",
  strength = 0.35,
  maxOffset = 18,
}: MagnetProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isHoverPointer() && !prefersReducedMotion());
  }, []);

  const handleMove = (event: MouseEvent<HTMLSpanElement>) => {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    setOffset({
      x: Math.max(-maxOffset, Math.min(maxOffset, dx * strength)),
      y: Math.max(-maxOffset, Math.min(maxOffset, dy * strength)),
    });
  };

  const reset = () => setOffset({ x: 0, y: 0 });

  return (
    <span
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className={`inline-block ${className}`}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: enabled ? "transform" : undefined,
      }}
    >
      {children}
    </span>
  );
}
