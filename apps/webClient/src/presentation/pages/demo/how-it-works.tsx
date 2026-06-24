import { Button } from "@presentation/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@presentation/components/ui/tabs";
import { RoutePaths } from "@presentation/utils/routes";
import { ArrowLeft, Monitor, Smartphone } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { DesktopDemo } from "./components/desktop-demo";
import { MobileDemo } from "./components/mobile-demo";

export default function HowItWorksPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="min-h-screen bg-background text-primary">
      {/* Main Content */}
      <main className="container mx-auto px-4 pt-[max(env(safe-area-inset-top),3rem)] pb-[max(env(safe-area-inset-bottom),3rem)] bg-background">
        <div className="mb-8 grid md:flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" className="mb-2">
              <Link to={RoutePaths.Home} className="flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                {t("demo.backToHome")}
              </Link>
            </Button>
            <h1 className="text-3xl font-bold  text-primary dark:text-neutral">
              {t("demo.title")}
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              {t("demo.subtitle")}
            </p>
          </div>
          <Tabs
            defaultValue="desktop"
            className="md:w-[400px]"
            onValueChange={(value) => setView(value as "desktop" | "mobile")}
          >
            <TabsList className="grid w-full gap-4 grid-cols-2 bg-muted dark:bg-muted text-primary dark:text-neutral">
              <TabsTrigger value="desktop" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                {t("demo.desktop")}
              </TabsTrigger>
              <TabsTrigger value="mobile" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                {t("demo.mobile")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex justify-center">
          {view === "desktop" ? <DesktopDemo /> : <MobileDemo />}
        </div>

        <div className="mt-16 text-center">
          <h2 className="mb-4 text-2xl font-bold text-primary dark:text-neutral">
            {t("demo.readyToStart")}
          </h2>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg">
              <Link to={RoutePaths.Auth + "/" + RoutePaths.Signup}>
                {t("demo.getStarted")}
              </Link>
            </Button>
            <Button variant="secondary" size="lg">
              <Link to={RoutePaths.Auth + "/" + RoutePaths.Login}>
                {t("demo.logIn")}
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
