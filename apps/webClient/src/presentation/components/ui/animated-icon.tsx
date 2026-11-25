import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  ForwardRefExoticComponent,
  RefAttributes,
} from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { IconHandle } from "@animateicons/react";

type AnimateIconProps = Omit<ComponentPropsWithoutRef<"div">, "color"> & {
  size?: number;
  color?: string;
  duration?: number;
  isAnimated?: boolean;
  /** Legacy Lucide prop: maps to the icon stroke width. */
  strokeWidth?: number | string;
};

export type AnimatedIconComponent = ForwardRefExoticComponent<
  AnimateIconProps & RefAttributes<IconHandle>
>;

/** Read the Lucide-style Tailwind size class (h-4, h-3.5, h-[1.2rem]) so the
 * AnimateIcons SVG is rendered at the same size the old icons occupied. */
function sizeFromClassName(className?: string) {
  if (!className) return undefined;

  const arbitrary = className.match(
    /(?:^|\s)(?:h|w|size)-\[([\d.]+)(px|rem|em)\]/,
  );
  if (arbitrary) {
    const value = Number(arbitrary[1]);
    return arbitrary[2] === "px" ? value : value * 16;
  }

  const token = className.match(/(?:^|\s)(?:h|w|size)-(\d+(?:\.\d+)?)/);
  return token ? Number(token[1]) * 4 : undefined;
}

const PARENT_SELECTOR = [
  "button",
  "a",
  "[role='button']",
  "[role='link']",
  "label",
  "summary",
  ".card",
  ".glass-panel",
  ".hover-glow",
  ".glow-row",
].join(", ");

/**
 * Wraps an AnimateIcons icon with the old Lucide API and moves the hover
 * trigger to the nearest containing component. The icon itself is set to
 * `isAnimated={false}`, so it only plays when its button, link, card or row
 * is hovered/focused.
 */
export function createAnimatedIcon(BaseIcon: AnimatedIconComponent) {
  const AnimatedIcon = forwardRef<IconHandle, AnimateIconProps>(
    function AnimatedIcon(
      {
        className,
        size,
        color,
        duration,
        isAnimated = false,
        strokeWidth,
        style,
        ...props
      },
      ref,
    ) {
      const iconRef = useRef<IconHandle>(null);
      const hostRef = useRef<HTMLSpanElement>(null);
      const pixelSize = size ?? sizeFromClassName(className) ?? 24;

      useImperativeHandle(
        ref,
        () => ({
          startAnimation: () => iconRef.current?.startAnimation(),
          stopAnimation: () => iconRef.current?.stopAnimation(),
        }),
        [],
      );

      useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        const parent =
          host.closest(PARENT_SELECTOR) ?? host.parentElement ?? undefined;
        if (!parent) return;

        const play = () => iconRef.current?.startAnimation();
        const stop = () => iconRef.current?.stopAnimation();

        parent.addEventListener("mouseenter", play);
        parent.addEventListener("mouseleave", stop);
        parent.addEventListener("focusin", play);
        parent.addEventListener("focusout", stop);

        return () => {
          parent.removeEventListener("mouseenter", play);
          parent.removeEventListener("mouseleave", stop);
          parent.removeEventListener("focusin", play);
          parent.removeEventListener("focusout", stop);
        };
      }, []);

      const iconStyle = {
        ...style,
        ...(strokeWidth !== undefined
          ? { "--app-icon-stroke": strokeWidth }
          : {}),
      } as CSSProperties;

      return (
        <span ref={hostRef} style={{ display: "contents" }}>
          <BaseIcon
            {...props}
            ref={iconRef}
            className={["app-icon", className].filter(Boolean).join(" ")}
            size={pixelSize}
            color={color}
            duration={duration}
            isAnimated={isAnimated}
            style={iconStyle}
          />
        </span>
      );
    },
  );

  AnimatedIcon.displayName = `Animated(${BaseIcon.displayName ?? "Icon"})`;
  return AnimatedIcon;
}
