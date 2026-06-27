import * as React from "react";

interface TabsProps {
  children: React.ReactNode;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  children: React.ReactNode;
  value: string;
  className?: string;
  disabled?: boolean;
}

interface TabsContentProps {
  children: React.ReactNode;
  value: string;
  className?: string;
}

const TabsContext = React.createContext<{
  activeTab: string;
  setActiveTab: (value: string) => void;
}>({
  activeTab: "",
  setActiveTab: () => {},
});

export const Tabs = ({
  children,
  defaultValue = "",
  value,
  className,
  onValueChange,
}: TabsProps) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue);

  const handleValueChange = (newValue: string) => {
    setActiveTab(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <TabsContext.Provider
      value={{
        activeTab: value || activeTab,
        setActiveTab: handleValueChange,
      }}
    >
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className = "" }, ref) => (
    // Wave 2 [T2.5]: `role="tablist"` exposes the container as a proper
    // tab group to assistive tech. `aria-orientation` is omitted
    // (defaults to horizontal) which matches our layout.
    <div
      ref={ref}
      role="tablist"
      className={`inline-flex h-10 gap-2 items-center justify-center rounded-md p-1 bg-primary-foreground dark:bg-primary-foreground ${className}`}
    >
      {children}
    </div>
  ),
);
TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ children, value, className = "", disabled = false }, ref) => {
  const { activeTab, setActiveTab } = React.useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      ref={ref}
      onClick={() => setActiveTab(value)}
      disabled={disabled}
      // Wave 2 [T2.5]: full WAI-ARIA tab semantics — `role="tab"` +
      // `aria-selected` for active state conveys selection to AT users.
      // Per WAI-ARIA Authoring Practices, tabs do NOT use `aria-current`
      // ("page"/"step"/"true") — selection is expressed exclusively via
      // `aria-selected`. The companion `id={`tab-${value}`}` feeds the
      // `TabsContent`'s `aria-labelledby` so screen readers announce
      // "tab panel: <tab name>" instead of an orphaned "tab panel:".
      //
      // NOTE: We DO NOT apply the "roving tabindex" pattern here. The
      // pattern requires Left/Right arrow-key navigation between tabs +
      // focus management; without those handlers, roving tabIndex traps
      // non-AT keyboard users on the active tab and breaks the second
      // of the two reachable tab keypresses. TODO (Wave 3): implement
      // proper arrow-key tab navigation (UP/DOWN/Home/End per WAI-ARIA
      // Authoring Practices) and reintroduce the roving tabIndex then.
      role="tab"
      id={`tab-${value}`}
      aria-selected={isActive}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
          disabled:pointer-events-none disabled:opacity-50 bg-foreground/10
          ${
            activeTab === value
              ? "dark:bg-secondary-foreground text-muted-foreground shadow-md"
              : "hover:text-gray-700"
          }
          ${className}`}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ children, value, className = "" }, ref) => {
    const { activeTab } = React.useContext(TabsContext);
    const isActive = activeTab === value;

    return isActive ? (
      // Wave 2 [T2.5]: `role="tabpanel"` + `aria-labelledby` so screen
      // readers announce which tab owns this content. The label ID
      // follows a `tab-${value}` convention; consumers wire
      // `id={"tab-personal-info"}` on the TabsTrigger at the call site
      // if they want strict labelledby mapping. Without that wiring
      // a11y tools still announce "tab panel" + the value.
      <div
        ref={ref}
        role="tabpanel"
        aria-labelledby={`tab-${value}`}
        className={`mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className}`}
      >
        {children}
      </div>
    ) : null;
  },
);
TabsContent.displayName = "TabsContent";
