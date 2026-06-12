import * as React from "react"

interface TabsProps {
  children: React.ReactNode
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
}

interface TabsListProps {
  children: React.ReactNode
  className?: string
}

interface TabsTriggerProps {
  children: React.ReactNode
  value: string
  className?: string
  disabled?: boolean
}

interface TabsContentProps {
  children: React.ReactNode
  value: string
  className?: string
}

const TabsContext = React.createContext<{
  activeTab: string
  setActiveTab: (value: string) => void
}>({
  activeTab: '',
  setActiveTab: () => { }
})

export const Tabs = ({
  children,
  defaultValue = '',
  value,
  className,
  onValueChange
}: TabsProps) => {
  const [activeTab, setActiveTab] = React.useState(defaultValue)

  const handleValueChange = (newValue: string) => {
    setActiveTab(newValue)
    if (onValueChange) {
      onValueChange(newValue)
    }
  }

  return (
    <TabsContext.Provider value={{
      activeTab: value || activeTab,
      setActiveTab: handleValueChange
    }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ children, className = '' }, ref) => (
    <div
      ref={ref}
      className={`inline-flex h-10 gap-2 items-center justify-center rounded-md p-1 bg-primary-foreground dark:bg-primary-foreground ${className}`}
    >
      {children}
    </div>
  )
)
TabsList.displayName = 'TabsList'

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ children, value, className = '', disabled = false }, ref) => {
    const { activeTab, setActiveTab } = React.useContext(TabsContext)

    return (
      <button
        ref={ref}
        onClick={() => setActiveTab(value)}
        disabled={disabled}
        className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all 
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 
          disabled:pointer-events-none disabled:opacity-50 bg-foreground/10
          ${activeTab === value ? 'dark:bg-secondary-foreground text-muted-foreground shadow-md' : 'hover:text-gray-700'} 
          ${className}`}
      >
        {children}
      </button>
    )
  }
)
TabsTrigger.displayName = 'TabsTrigger'

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ children, value, className = '' }, ref) => {
    const { activeTab } = React.useContext(TabsContext)

    return activeTab === value ? (
      <div
        ref={ref}
        className={`mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${className}`}
      >
        {children}
      </div>
    ) : null
  }
)
TabsContent.displayName = 'TabsContent'