import { useTranslation } from 'react-i18next';
import type React from "react"

import { useState } from "react"
import { Label } from "../ui/label"
import { Button } from "../ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card"
import { Switch } from "../ui/switch"

interface NotificationSetting {
  id: string
  title: string
  description: string
  enabled: boolean
}

export function NotificationSettings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: "email-notifications",
      title: t('profile.emailNotifications'),
      description: t('profile.emailNotificationsDesc'),
      enabled: true,
    },
    {
      id: "push-notifications",
      title: t('profile.pushNotifications'),
      description: t('profile.pushNotificationsDesc'),
      enabled: true,
    },
    {
      id: "budget-alerts",
      title: t('profile.budgetAlerts'),
      description: t('profile.budgetAlertsDesc'),
      enabled: true,
    },
    {
      id: "transaction-alerts",
      title: t('profile.transactionAlerts'),
      description: t('profile.transactionAlertsDesc'),
      enabled: false,
    },
    {
      id: "marketing-emails",
      title: t('profile.marketingEmails'),
      description: t('profile.marketingEmailsDesc'),
      enabled: false,
    },
  ])

  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = (id: string) => {
    setSettings((prev) =>
      prev.map((setting) => (setting.id === id ? { ...setting, enabled: !setting.enabled } : setting)),
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setIsSaving(false)
  }

  return (
    <Card className="bg-card dark:bg-card dark:text-neutral">
      <CardHeader>
        <CardTitle>{t('profile.notificationPreferences')}</CardTitle>
        <CardDescription>{t('profile.notificationPreferencesDesc')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {settings.map((setting) => (
            <div key={setting.id} className="flex items-start space-x-4">
              <Switch id={setting.id} checked={setting.enabled} onCheckedChange={() => handleToggle(setting.id)} />
              <div className="space-y-1">
                <Label htmlFor={setting.id} className="text-base font-medium">
                  {setting.title}
                </Label>
                <p className="text-sm text-slate-500 dark:text-slate-400">{setting.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t('profile.saving') : t('profile.saveChanges')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
