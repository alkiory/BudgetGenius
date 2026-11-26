import { SidebarProvider } from "@adapters/hooks/sidebarContext";
import { useGetSettings } from "@adapters/query/userQuery";
import { setSettingsAction } from "@adapters/slices/user-settings/settingsSlice";
import { useCrossDeviceSync } from "@infrastructure/use-cross-device-sync";
import { AmbientBackground } from "@presentation/components/dashboard/ambient-background";
import { AnnouncementBanner } from "@presentation/components/dashboard/announcement-banner";
import { DashboardHeader } from "@presentation/components/dashboard/header";
import { FinnyRail } from "@presentation/components/dashboard/finny-rail";
import { MainContent } from "@presentation/components/dashboard/main-content";
import { DashboardSidebar } from "@presentation/components/dashboard/sidebar";
import { AppTour } from "@presentation/components/tour/app-tour";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Outlet } from "react-router";

export default function MainLayout() {
  useCrossDeviceSync();

  // The signed-in user's preferences (currency, language, timezone) are
  // hydrated here rather than on the dashboard only: every money surface
  // reads `state.userSettings`, so landing straight on /app/budgets (deep
  // link, refresh, mobile cold start) used to format amounts with the EUR
  // default until the dashboard was visited.
  const dispatch = useDispatch();
  const { data: settings } = useGetSettings();

  useEffect(() => {
    if (settings) dispatch(setSettingsAction(settings));
  }, [dispatch, settings]);

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen bg-background text-slate-700 dark:text-slate-200">
        <AmbientBackground />
        <DashboardSidebar />
        <div className="relative z-10 flex min-w-0 flex-1">
          <MainContent>
            <DashboardHeader />
            <AnnouncementBanner />
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
            {/* The extra bottom padding clears the floating buttons: the
              mobile stack (Finny + quick-add + menu) and, from md to xl,
              the Finny launcher on its own. */}
            <main className="min-w-0 flex-1 px-4 pt-4 pb-[calc(max(env(safe-area-inset-bottom),1rem)_+_12rem)] md:pb-24 md:pt-6 md:px-6 xl:p-6">
              <Outlet />
            </main>
          </MainContent>
          <FinnyRail />
        </div>
        <AppTour />
      </div>
    </SidebarProvider>
  );
}
