import { Building } from "@presentation/components/ui/animated-icons";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@presentation/components/ui/tabs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiKeysTab } from "./api-keys-tab";
import { ModulesTab } from "./modules-tab";
import { NotificationsTab } from "./notifications-tab";
import { OverviewTab } from "./overview-tab";

/**
 * Superadmin backoffice.
 *
 * Scope is the product itself — modules, API keys, announcements and aggregate
 * usage. There is deliberately no user list or per-account data anywhere here.
 *
 * Each tab lives in its own module next to this file, so a change to one
 * surface no longer has to travel through the other three.
 */
export default function SuperAdminBackofficePage() {
  const { t } = useTranslation();
  // Controlled so the module flow can hand control to the announcements tab
  // right after an announcement is created.
  const [tab, setTab] = useState("overview");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-600 ring-1 ring-inset ring-teal-500/25 dark:bg-teal-400/10 dark:text-teal-300">
          <Building className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {t("superadmin.title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("superadmin.subtitle")}
          </p>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">
            {t("superadmin.tabs.overview")}
          </TabsTrigger>
          <TabsTrigger value="modules">
            {t("superadmin.tabs.modules")}
          </TabsTrigger>
          <TabsTrigger value="api-keys">
            {t("superadmin.tabs.apiKeys")}
          </TabsTrigger>
          <TabsTrigger value="notifications">
            {t("superadmin.tabs.notifications")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="modules">
          <ModulesTab onShowNotifications={() => setTab("notifications")} />
        </TabsContent>
        <TabsContent value="api-keys">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
