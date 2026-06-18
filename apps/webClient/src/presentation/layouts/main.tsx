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
          <main className="flex-1 p-4 md:p-6 text-primary dark:text-neutral">
            <Outlet />
          </main>
        </MainContent>
      </div>
    </SidebarProvider>
  );
}
