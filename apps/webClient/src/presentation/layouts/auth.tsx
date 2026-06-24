import { AnimatedBackground } from "@presentation/components/animated-background";
import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="relative flex flex-col min-h-screen">
      <AnimatedBackground
        gradientColors={["from-blue-500", "via-indigo-500", "to-purple-500"]} // Personaliza los colores
        particleColor="bg-white" // Personaliza el color de las partículas
        particleCount={50} // Personaliza el número de partículas
      />

      <main className="relative z-10 flex-grow flex items-center justify-center pb-[max(env(safe-area-inset-bottom),1rem)]">
        <Outlet />
      </main>
    </div>
  );
}
