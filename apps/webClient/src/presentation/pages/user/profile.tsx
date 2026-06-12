import { AccountSettings } from '@presentation/components/profile/account-settings';
import { NotificationSettings } from '@presentation/components/profile/notification-settings';
import { PersonalInfoForm } from '@presentation/components/profile/personal-info-form';
import { SecuritySettings } from '@presentation/components/profile/security-settings';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@presentation/components/ui/tabs';
import { useState } from 'react';
import ProfileLoading from './loading-profile';
import { useSelector } from 'react-redux';
import { RootState } from '@adapters/store/rootStore';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const { t } = useTranslation();
  const user = useSelector((state: RootState) => state.auth.user);
  const [activeTab, setActiveTab] = useState("personal-info")

  if (!user) {
    return <ProfileLoading />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('profile.title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">{t('profile.description')}</p>
      </div>

      <Tabs defaultValue="personal-info" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto bg-accent/35 dark:bg-accent/30">
          <TabsTrigger className='text-primary dark:text-neutral' value="personal-info">{t('profile.personalInfo')}</TabsTrigger>
          <TabsTrigger className='text-primary dark:text-neutral' value="security">{t('profile.security')}</TabsTrigger>
          <TabsTrigger className='text-primary dark:text-neutral' value="notifications">{t('profile.notifications')}</TabsTrigger>
          <TabsTrigger className='text-primary dark:text-neutral' value="account">{t('profile.account')}</TabsTrigger>
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
  )
}
