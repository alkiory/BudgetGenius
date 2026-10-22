import { AnimatedBackground } from "@presentation/components/animated-background";
import { RoutePaths } from "@presentation/utils/routes";
import { Outlet, useLocation } from "react-router";

// Each auth flow keeps the same blue/purple family so the pages feel
// related, but registration leans deeper into indigo/violet so the two
// forms are visually distinguishable at a glance.
const LOGIN_GRADIENT = ["from-blue-500", "via-indigo-500", "to-purple-500"];
const SIGNUP_GRADIENT = ["from-indigo-600", "via-violet-700", "to-purple-900"];

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
