import * as React from "react"

interface DropdownMenuProps {
  children: React.ReactNode
}

interface DropdownMenuContextType {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  triggerRef: React.RefObject<HTMLButtonElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
}

const DropdownMenuContext = React.createContext<DropdownMenuContextType | undefined>(undefined)

function useDropdownMenu() {
  const context = React.useContext(DropdownMenuContext)
  if (!context) {
    throw new Error("Dropdown components must be used within a DropdownMenu")
  }
  return context
}

export function DropdownMenu({ children }: DropdownMenuProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        open &&
        contentRef.current &&
        triggerRef.current &&
        !contentRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (open && event.key === "Escape") {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open])

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      {children}
    </DropdownMenuContext.Provider>
  )
}

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export function DropdownMenuTrigger({ children, asChild = false, ...props }: DropdownMenuTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdownMenu()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setOpen(!open)
    props.onClick?.(e)
  }

  if (asChild) {
    const child = React.Children.only(children) as React.ReactElement;
    const ForwardedChild = React.forwardRef((props, ref) => (
      <child.type {...props} ref={ref} />
    ));
    return <ForwardedChild onClick={handleClick} aria-expanded={open} aria-haspopup={true} {...props} ref={triggerRef} />;
  }

  return (
    <button type="button" ref={triggerRef} onClick={handleClick} aria-expanded={open} aria-haspopup={true} {...props}>
      {children}
    </button>
  )
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end"
  sideOffset?: number
}

export function DropdownMenuContent({
  children,
  className = "",
  align = "end",
  sideOffset = 4,
  ...props
}: DropdownMenuContentProps) {
  const { open, contentRef } = useDropdownMenu()

  if (!open) return null

  const alignmentClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }

  return (
    <div
      ref={contentRef}
      className={`absolute z-50 mt-${sideOffset} min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-md animate-in fade-in-80 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-slate-800 dark:bg-slate-950 ${alignmentClasses[align]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  inset?: boolean
}

export function DropdownMenuItem({ className = "", inset = false, ...props }: DropdownMenuItemProps) {
  const { setOpen } = useDropdownMenu()

  return (
    <button
      className={`relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:hover:bg-slate-800 dark:focus:bg-slate-800 dark:focus:text-slate-50 ${inset ? "pl-8" : ""
        } ${className}`}
      onClick={() => setOpen(false)}
      {...props}
    />
  )
}

interface DropdownMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean
}

export function DropdownMenuLabel({ className = "", inset = false, ...props }: DropdownMenuLabelProps) {
  return <div className={`px-2 py-1.5 text-sm font-semibold ${inset ? "pl-8" : ""} ${className}`} {...props} />
}

interface DropdownMenuSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  separatorType?: "horizontal" | "vertical"
}

export function DropdownMenuSeparator({ className = "", ...props }: DropdownMenuSeparatorProps) {
  return <div className={`-mx-1 my-1 h-px bg-slate-100 dark:bg-slate-800 ${className}`} {...props} />
}

export function DropdownMenuShortcut({ className = "", ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`ml-auto text-xs tracking-widest opacity-60 ${className}`} {...props} />
}

export function DropdownMenuIcon({ className = "", ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`mr-2 text-sm opacity-60 ${className}`} {...props} />
}