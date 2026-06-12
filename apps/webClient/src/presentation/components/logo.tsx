import { DollarSign, Sparkles } from "lucide-react"

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "default" | "minimal"
  className?: string
}
export function Logo({ size = "md", variant = "default", className = "" }: LogoProps) {
  // Size mappings
  const sizeClasses = {
    sm: "h-8",
    md: "h-10",
    lg: "h-12",
    xl: "h-16",
  }

  // Text size mappings
  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
    xl: "text-3xl",
  }

  // Icon size mappings
  const iconSizeClasses = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-7 w-7",
    xl: "h-8 w-8",
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`relative ${sizeClasses[size]}`}>
        <div className="inset-0 flex items-center justify-center">
          <div className="rounded-full bg-gradient-to-r from-purple-600 to-purple-400 p-1.5 shadow-lg">
            <DollarSign className={`${iconSizeClasses[size]} text-white`} />
          </div>
        </div>
        <div className="absolute -right-1 -top-1">
          <Sparkles className="h-4 w-4 text-purple-400" />
        </div>
      </div>

      {variant === "default" && (
        <div className="flex flex-col">
          <span className={`font-bold leading-none tracking-tight dark:text-white ${textSizeClasses[size]}`}>
            Budget<span className="text-purple-600">Genius</span>
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">AI-Powered Finance</span>
        </div>
      )}
    </div>
  )
}
