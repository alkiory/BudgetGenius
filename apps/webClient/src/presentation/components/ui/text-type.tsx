import { useEffect, useMemo, useRef, useState } from "react";

interface TextTypeProps {
  text: string;
  className?: string;
  /** Milliseconds between characters. */
  typingSpeed?: number;
  initialDelay?: number;
  /** Blinking caret after the typed text. */
  cursor?: boolean;
  /** Start typing once the element enters the viewport. */
  startOnVisible?: boolean;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * TextType — the ReactBits typing effect, implemented locally (no dependency).
 *
 * Characters appear one by one with a blinking caret for a live
 * "someone is typing this to you" feel, which is what makes a backoffice
 * announcement read as a fresh message instead of a static banner.
 *
 * Reduced motion: the final text renders at once, caret included but static.
 * The full string is also exposed to assistive tech, so screen readers never
 * hear a half-typed sentence.
 */
export function TextType({
  text,
  className,
  typingSpeed = 45,
  initialDelay = 0,
  cursor = false,
  startOnVisible = false,
}: TextTypeProps) {
  const reduced = useMemo(prefersReducedMotion, []);
  const [typed, setTyped] = useState(reduced ? text : "");
  const [started, setStarted] = useState(!startOnVisible || reduced);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!startOnVisible || reduced) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setStarted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed.some((item) => item.isIntersecting)) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [startOnVisible, reduced]);

  useEffect(() => {
    if (reduced) {
      setTyped(text);
      return;
    }
    if (!started) return;

    setTyped("");
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      index += 1;
      setTyped(text.slice(0, index));
      if (index < text.length) timer = setTimeout(tick, typingSpeed);
    };

    timer = setTimeout(tick, initialDelay);
    return () => clearTimeout(timer);
  }, [text, typingSpeed, initialDelay, started, reduced]);

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {typed}
        {cursor && (
          <span className="animate-caret ml-0.5 inline-block text-current">
            |
          </span>
        )}
      </span>
    </span>
  );
}
