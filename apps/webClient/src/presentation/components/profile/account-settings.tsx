import { updateSettingsAction } from "@adapters/slices/user-settings/settingsSlice";
import { RootState } from "@adapters/store/rootStore";
import { updateUserSettings } from "@application/user/user.service";
import { Currency } from "@presentation/utils/currencyService";
import { errorToast, successToast } from "@presentation/utils/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector, useDispatch } from "react-redux";
import { Button } from "../ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";

export function AccountSettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const userSetting = useSelector((state: RootState) => state.userSettings);

  const { settings } = userSetting;

  const [settingsToUpdate, setSettingsToUpdate] = useState({
    timezone: settings?.timezone || "America/New_York",
    currency: settings?.currency || "USD",
    locale: settings?.locale || "en-US",
  });

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const queryClient = useQueryClient();

  const { mutate: updateSettings, isSuccess } = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: (data) => {
      successToast(
        t("profile.settingsSavedSuccessfully"),
        3000,
        "settings-update",
      );
      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      dispatch(updateSettingsAction(data ?? settingsToUpdate));
    },
    onError: (error) => {
      errorToast(
        error.message || t("profile.failedToUpdateSettings"),
        3000,
        "settings-update",
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      settingsToUpdate.timezone === settings?.timezone &&
      settingsToUpdate.currency === settings?.currency &&
      settingsToUpdate.locale === settings?.locale
    ) {
      errorToast(t("profile.noChangesDetected"), 3000, "settings-update");
      return;
    }

    // if only change one field, update only that field
    if (settingsToUpdate.timezone !== settings?.timezone) {
      settingsToUpdate.timezone = settingsToUpdate.timezone;
    }
    if (settingsToUpdate.currency !== settings?.currency) {
      settingsToUpdate.currency = settingsToUpdate.currency as Currency;
    }
    if (settingsToUpdate.locale !== settings?.locale) {
      settingsToUpdate.locale = settingsToUpdate.locale;
    }

    updateSettings(settingsToUpdate);
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== "delete my account") return;

    setIsDeleting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Redirect to login page
    window.location.href = "/auth/login";
  };

  useEffect(() => {
    if (settings) {
      setSettingsToUpdate({
        timezone: settings.timezone,
        currency: settings.currency,
        locale: settings.locale as string,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSetting]);

  return (
    <div className="space-y-6">
      <Card className="bg-card dark:bg-card dark:text-neutral">
        <CardHeader>
          <CardTitle>{t("settings.accountPreferences")}</CardTitle>
          <CardDescription>{t("settings.managePreferences")}</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <CardContent className="space-y-4">
            <Select
              label={t("settings.timezone")}
              name="Timezone"
              value={settingsToUpdate.timezone}
              onChange={(value) => {
                setSettingsToUpdate((prev) => ({ ...prev, timezone: value }));
              }}
              options={[
                { value: "America/New_York", label: "Eastern Time (ET)" },
                { value: "America/Bogota", label: "Colombia Time (CT)" },
                { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
                { value: "Europe/Paris", label: "Central European Time (CET)" },
                { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
              ]}
            />

            <Select
              label={t("settings.currency")}
              name="Currency"
              value={settingsToUpdate.currency}
              onChange={(value) => {
                setSettingsToUpdate((prev) => ({
                  ...prev,
                  currency: value as Currency,
                }));
              }}
              options={[
                { value: "USD", label: "United States Dollar (USD)" },
                { value: "EUR", label: "Euro (EUR)" },
                { value: "COP", label: "Colombian Peso (COP)" },
              ]}
            />

            <Select
              label={t("settings.language")}
              name="Language"
              value={settingsToUpdate.locale}
              onChange={(value) => {
                setSettingsToUpdate((prev) => ({ ...prev, locale: value }));
              }}
              options={[
                { value: "en-US", label: "English" },
                { value: "es-CO", label: "Spanish" },
              ]}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSuccess}>
              {t("settings.savePreferences")}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="border-red-200 dark:border-red-900 dark:bg-slate-950">
        <CardHeader className="text-red-600 dark:text-red-500">
          <CardTitle>{t("settings.dangerZone")}</CardTitle>
          <CardDescription className="text-red-600/80 dark:text-red-500/80">
            {t("settings.deleteWarning")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirmation ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("settings.deleteDescription")}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-600 dark:text-red-500">
                      {t("settings.warning")}
                    </h3>
                    <div className="mt-2 text-sm text-red-600/80 dark:text-red-500/80">
                      <p>{t("profile.deleteConfirmationWarning")}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirm-delete"
                  className="text-red-600 dark:text-red-500"
                >
                  {" "}
                  {t("settings.typeToConfirm")}
                </Label>
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="border-red-200 focus-visible:ring-red-500 dark:border-red-900"
                />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {!showDeleteConfirmation ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirmation(true)}
            >
              {t("settings.deleteAccount")}
            </Button>
          ) : (
            <div className="flex w-full flex-col space-y-2 sm:flex-row sm:justify-end sm:space-x-2 sm:space-y-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setConfirmText("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={confirmText !== "delete my account" || isDeleting}
              >
                {isDeleting
                  ? t("settings.deleting")
                  : t("settings.permanentlyDelete")}
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
