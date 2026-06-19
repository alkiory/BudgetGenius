import { RootState } from "@adapters/store/rootStore";
import { AccountSettings } from "@presentation/components/profile/account-settings";
import { NotificationSettings } from "@presentation/components/profile/notification-settings";
import { PersonalInfoForm } from "@presentation/components/profile/personal-info-form";
import { SecuritySettings } from "@presentation/components/profile/security-settings";
import { PageHeader } from "@presentation/components/ui/page-header";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@presentation/components/ui/tabs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import ProfileLoading from "./loading-profile";

export default function Profile() {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState("personal-info");

  if (!user) {
    return <ProfileLoading />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("profile.title")}
        description={t("profile.description")}
      />

      <Tabs
        defaultValue="personal-info"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4 lg:w-auto bg-accent/35 dark:bg-accent/30">
          <TabsTrigger
            className="text-primary dark:text-neutral"
            value="personal-info"
          >
            {t("profile.personalInfo")}
          </TabsTrigger>
          <TabsTrigger
            className="text-primary dark:text-neutral"
            value="security"
          >
            {t("profile.security")}
          </TabsTrigger>
          <TabsTrigger
            className="text-primary dark:text-neutral"
            value="notifications"
          >
            {t("profile.notifications")}
          </TabsTrigger>
          <TabsTrigger
            className="text-primary dark:text-neutral"
            value="account"
          >
            {t("profile.account")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal-info" className="space-y-4">
          <PersonalInfoForm />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <SecuritySettings />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <AccountSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
