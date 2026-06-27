import { useSidebar } from "@adapters/hooks/sidebarContext";
import { useMobile } from "@adapters/hooks/useMobile";
import { ReactNode } from "react";

export function MainContent({ children }: { children: ReactNode }) {
  const { isCollapsed } = useSidebar();
  const isMobile = useMobile();

  return (
    // `min-w-0` is required here because this `<div>` is a DIRECT
    // `flex-direction: row` child of `MainLayout`'s outer
    // `<div className="flex ...">`. Flex items default to
    // `min-width: auto` (fit-content), and our content includes a
    // wide `<table>` whose natural width is ~800px on desktop. On
    // mobile the viewport (~375px) is smaller than that intrinsic
    // size, so without an explicit `min-w-0` this wrapper would
    // refuse to shrink below the table's width — pushing the page
    // past the right edge of the screen and defeating the table's
    // inner `overflow-x-auto`. Setting `min-w-0` lets the wrapper
    // shrink to the viewport, after which the table's own scroll
    // wrapper takes over. `flex-1` (`flex: 1 1 0%`) on its own is
    // NOT enough — the CSS shorthand `flex: 1` doesn't reset
    // `min-width: auto`.
    <div
      className={`min-w-0 flex flex-1 flex-col ${
        isMobile ? "" : isCollapsed ? "md:pl-20" : "md:pl-64"
      } transition-all duration-300`}
    >
      {children}
    </div>
  );
}
