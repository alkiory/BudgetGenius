import { useSidebar } from "@adapters/hooks/sidebarContext";
import { useMobile } from "@adapters/hooks/useMobile";
import { ReactNode } from "react";

export function MainContent({ children }: { children: ReactNode }) {
  const { isCollapsed } = useSidebar();
  const isMobile = useMobile();

  return (
    <div
      className={`flex flex-1 flex-col ${
        isMobile ? "" : isCollapsed ? "md:pl-20" : "md:pl-64"
      } transition-all duration-300`}
    >
      {children}
    </div>
  );
}
