import HeaderComponent from "@presentation/components/ui/header";
import { Outlet } from "react-router";

export default function LandingLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <HeaderComponent />
      <main className="flex-1 px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)] bg-background">
        <Outlet />
      </main>
    </div>
  );
}
