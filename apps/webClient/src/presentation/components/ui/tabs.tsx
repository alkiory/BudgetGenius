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
    <div
      ref={ref}
      role="tablist"
      className={`flex w-full flex-wrap items-center justify-start gap-1 rounded-xl border border-slate-200/80 bg-white/60 p-1 shadow-sm backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.04] md:w-auto md:flex-nowrap ${className}`}
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
      role="tab"
      id={`tab-${value}`}
      aria-selected={isActive}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 disabled:pointer-events-none disabled:opacity-50 ${
        isActive
          ? "bg-teal-500/15 text-teal-700 shadow-[0_0_22px_-10px_rgb(45_212_191_/_0.9)] ring-1 ring-inset ring-teal-400/30 dark:bg-teal-400/15 dark:text-teal-300"
          : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-slate-100"
      } ${className}`}
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
      <div
        ref={ref}
        role="tabpanel"
        aria-labelledby={`tab-${value}`}
        className={`mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40 ${className}`}
      >
        {children}
      </div>
    ) : null;
  },
);
TabsContent.displayName = "TabsContent";
