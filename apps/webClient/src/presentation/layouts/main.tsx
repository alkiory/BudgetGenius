import { SidebarProvider } from "@adapters/hooks/sidebarContext";
import { DashboardHeader } from "@presentation/components/dashboard/header";
import { MainContent } from "@presentation/components/dashboard/main-content";
import { DashboardSidebar } from "@presentation/components/dashboard/sidebar";
import { Outlet } from "react-router";

export default function MainLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
        <DashboardSidebar />
        <MainContent>
          <DashboardHeader />
          {/* px-4 pt-4 (instead of p-4) so the safe-area-aware pb-declaration
              is the only one touching padding-bottom at <md. `max(env(...))`
              is used (rather than env(... , 1rem)) because modern browsers
              define safe-area-inset-* as 0 (not undefined) when no inset
              exists — only `max()` reliably clamps to a sensible floor. */}
          {/* `min-w-0` (alongside `MainContent`'s own `min-w-0`) keeps
              the main pane shrinking to the viewport on mobile so a
              wide child like the transactions `<Table />` (which has
              its own `overflow-x-auto`) can fall back to a horizontal
              scroll instead of pushing this `<main>` past the right
              edge of the screen. `flex-1` does NOT set `min-width`;
              it has to be declared explicitly. */}
          <main className="min-w-0 flex-1 px-4 pt-4 md:p-6 pb-[max(env(safe-area-inset-bottom),1rem)] text-primary dark:text-neutral">
            <Outlet />
          </main>
        </MainContent>
      </div>
    </SidebarProvider>
  );
}
