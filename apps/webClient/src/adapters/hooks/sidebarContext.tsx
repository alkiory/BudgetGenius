import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useMobile } from "./useMobile";

interface SidebarContextType {
  isOpen: boolean;
  isCollapsed: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useMobile();

  // Update sidebar state based on screen size
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
      setIsCollapsed(false);
    } else {
      setIsOpen(true);
    }
  }, [isMobile]);

  const toggleSidebar = () => {
    if (isMobile) {
      setIsOpen(!isOpen);
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const closeSidebar = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  return (
    <SidebarContext.Provider
      value={{ isOpen, isCollapsed, toggleSidebar, closeSidebar }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
