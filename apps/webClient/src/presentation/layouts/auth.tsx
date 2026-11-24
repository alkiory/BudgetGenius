import { AnimatedBackground } from "@presentation/components/animated-background";
import { RoutePaths } from "@presentation/utils/routes";
import { Outlet, useLocation } from "react-router";

// Auth uses the same deep-navy/teal family as the app shell. Signup
// leans one step further into cyan so the two flows stay visually
// distinguishable without leaving the rebranded palette.
const LOGIN_GRADIENT = ["from-slate-950", "via-teal-950", "to-cyan-900"];
const SIGNUP_GRADIENT = ["from-slate-950", "via-cyan-950", "to-teal-900"];

export default function AuthLayout() {
  const { pathname } = useLocation();
  const isSignup = pathname.toLowerCase().includes(RoutePaths.Signup);

  return (
    <div className="relative flex min-h-screen flex-col">
      <AnimatedBackground
        gradientColors={isSignup ? SIGNUP_GRADIENT : LOGIN_GRADIENT}
        particleColor="bg-white"
        particleCount={50}
      />

      <main className="relative z-10 flex flex-grow items-center justify-center px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <Outlet />
      </main>
    </div>
  );
}
