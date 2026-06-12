import { Wallet } from "lucide-react"

export default function LoadingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-8 w-8 text-purple-600" />
          <span className="text-2xl font-bold">Budget Genius</span>
        </div>
        <div className="relative h-2 w-48 overflow-hidden rounded-full bg-purple-100">
          <div className="absolute left-0 top-0 h-full w-1/3 animate-[loading_1.5s_ease-in-out_infinite] rounded-full bg-purple-600"></div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Loading, please wait...</p>
      </div>
    </div>
  )
}