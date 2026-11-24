import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { Label } from "./label";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  name?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  value?: string;
  id?: string;
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  "aria-label"?: string;
}

interface PanelPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/**
 * Palette-aware dropdown. Native `<select>` popups are painted by the
 * operating system, so their white surface and blue highlight ignore the
 * app theme. This component renders the same control surface with the
 * app's glass/teal tokens and a portal-positioned listbox, which also
 * escapes the modal's scroll container instead of being clipped by it.
 */
export const Select = ({
  label,
  name,
  options,
  onChange,
  value,
  id,
  className = "",
  triggerClassName = "",
  placeholder,
  disabled = false,
  size = "md",
  icon,
  "aria-label": ariaLabel,
}: SelectProps) => {
  const autoId = React.useId();
  const selectId = id ?? name ?? autoId;
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [position, setPosition] = React.useState<PanelPosition | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const optionRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const openMenu = React.useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setActiveIndex(
      selectedIndex >= 0
        ? selectedIndex
        : options.findIndex((option) => !option.disabled),
    );
  }, [disabled, options, selectedIndex]);

  const closeMenu = React.useCallback((restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const commit = React.useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      onChange(option.value);
      closeMenu(true);
    },
    [closeMenu, onChange],
  );

  // Keep the portal panel anchored to the trigger while the page, the
  // modal body or the window scrolls or resizes.
  React.useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const width = Math.min(
        Math.max(rect.width, 160),
        viewportWidth - 16,
      );
      const left = Math.min(
        Math.max(rect.left, 8),
        viewportWidth - width - 8,
      );
      const spaceBelow = viewportHeight - rect.bottom;
      const openUp = spaceBelow < 200 && rect.top > spaceBelow;

      setPosition(
        openUp
          ? {
              left,
              width,
              bottom: viewportHeight - rect.top + 6,
              maxHeight: Math.min(256, Math.max(120, rect.top - 16)),
            }
          : {
              left,
              width,
              top: rect.bottom + 6,
              maxHeight: Math.min(256, Math.max(120, spaceBelow - 16)),
            },
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Capture phase: keep the surrounding modal open.
        event.preventDefault();
        event.stopPropagation();
        closeMenu(true);
        return;
      }

      if (event.key === "Tab") {
        setOpen(false);
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const direction = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((previous) => {
          for (let step = 1; step <= options.length; step += 1) {
            const next =
              (previous + direction * step + options.length * step) %
              options.length;
            if (!options[next]?.disabled) return next;
          }
          return previous;
        });
        return;
      }

      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const indexes =
          event.key === "Home"
            ? options.map((_, index) => index)
            : options.map((_, index) => options.length - 1 - index);
        const next = indexes.find((index) => !options[index]?.disabled);
        if (next !== undefined) setActiveIndex(next);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        const option = options[activeIndex];
        if (option) {
          event.preventDefault();
          commit(option);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [activeIndex, closeMenu, commit, open, options]);

  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const triggerSize =
    size === "sm" ? "px-2.5 py-1.5 text-sm" : "px-3 py-2 text-sm";
  const panelPosition = position
    ? {
        left: position.left,
        width: position.width,
        top: position.top,
        bottom: position.bottom,
        maxHeight: position.maxHeight,
      }
    : undefined;

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label htmlFor={selectId}>{label}</Label>}

      <button
        ref={triggerRef}
        type="button"
        id={selectId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${selectId}-listbox` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(event) => {
          if (
            !open &&
            (event.key === "ArrowDown" ||
              event.key === "ArrowUp" ||
              event.key === "Enter" ||
              event.key === " ")
          ) {
            event.preventDefault();
            openMenu();
          }
        }}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-200/90 bg-white/80 text-left text-slate-700 shadow-sm outline-none transition-colors hover:border-teal-400/40 focus-visible:border-teal-400 focus-visible:ring-2 focus-visible:ring-teal-400/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-teal-400/30 ${triggerSize} ${triggerClassName}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon && (
            <span className="shrink-0 text-slate-500 dark:text-slate-400">
              {icon}
            </span>
          )}
          <span
            className={`truncate ${
              selected ? "" : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {selected?.label ?? placeholder ?? ""}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        panelPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={`${selectId}-listbox`}
            role="listbox"
            aria-labelledby={label ? selectId : undefined}
            aria-label={!label ? ariaLabel : undefined}
            className="animate-scale-in fixed z-[110] origin-top overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white/95 p-1 text-sm shadow-[0_24px_60px_-24px_rgb(15_23_42/0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0b1424]/95 dark:text-slate-200"
            style={panelPosition}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;

              return (
                <button
                  key={`${option.value}-${index}`}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(option)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                    isSelected
                      ? "bg-teal-500/15 font-medium text-teal-700 dark:bg-teal-400/15 dark:text-teal-200"
                      : isActive
                        ? "bg-slate-100 text-slate-900 dark:bg-white/[0.07] dark:text-slate-100"
                        : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-300"
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
};
