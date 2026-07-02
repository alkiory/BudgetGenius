import { clearAuthAndStateForLogout } from "@adapters/auth/clearAuthAndStateForLogout";
import { updateSettingsAction } from "@adapters/slices/user-settings/settingsSlice";
import { RootState } from "@adapters/store/rootStore";
import { deleteUser, updateUserSettings } from "@application/user/user.service";
import { Currency } from "@presentation/utils/currencyService";
import { UserSettings } from "@domain/user/userSettings";
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
  // Needed for the `handleDeleteAccount` real DELETE call (v1.7.2 fix;
  // the previous implementation was a 2-second `setTimeout` placeholder
  // that never invoked the backend).
  const currentUser = useSelector((state: RootState) => state.auth.user);

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

  const deleteConfirmPhrase = t("settings.deleteConfirmPhrase");
  const isDeleteConfirmed =
    confirmText.trim().toLowerCase() ===
    deleteConfirmPhrase.trim().toLowerCase();

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

    // v1.7.2 — type `delta` as `Partial<UserSettings>` (instead of a
    // hand-rolled `{timezone?: string; currency?: string; locale?: string}`
    // literal) so the `currency` field carries the literal-union type
    // `Currency` from `Currency` (`"USD" | "EUR" | "COP"`) — the bare
    // `string` annotation previously caused `TS2345` at
    // `updateSettings(delta)` because `string` is NOT assignable to the
    // narrow `Currency` union. `Partial<UserSettings>` is the canonical
    // shape; the fields stay OPTIONAL, the types stay correct, and any
    // future UserSettings reshape (new currency support, new locale
    // type) ripples here automatically.
    const delta: Partial<UserSettings> = {};
    if (settingsToUpdate.timezone !== settings?.timezone) {
      delta.timezone = settingsToUpdate.timezone;
    }
    if (settingsToUpdate.currency !== settings?.currency) {
      delta.currency = settingsToUpdate.currency;
    }
    if (settingsToUpdate.locale !== settings?.locale) {
      delta.locale = settingsToUpdate.locale;
    }

    if (Object.keys(delta).length === 0) {
      errorToast(t("profile.noChangesDetected"), 3000, "settings-update");
      return;
    }

    updateSettings(delta);
  };

  // v1.7.2 — real DELETE call. The previous implementation was a
  // 2-second `setTimeout` placeholder that NEVER invoked the backend,
  // and that became the v1.7.2 production regression: the user was
  // never actually deleted, the React Query cache and Redux slices
  // lingered, and a re-login with the same email authenticated as an
  // existing user (no onboarding, stale per-user data). See
  // `rpi/delete-account-cleanup/{research.md, plan.md}` and
  // `knowledge.md §6.8.5`.
  const {
    mutate: deleteAccountMutation,
    isPending: isDeletingAccount,
  } = useMutation({
    mutationKey: ["delete-account"],
    mutationFn: () => {
      if (!currentUser?.id) {
        // Defensive: if for any reason we don't have a valid user id,
        // refuse to call DELETE with `NaN`/undefined — the backend
        // would 401/400 and the user would be left wondering what
        // happened. Surface the error to the toast instead.
        throw new Error(
          t(
            "settings.deleteMissingUserId",
            "No authenticated user — please log in again before deleting your account.",
          ),
        );
      }
      return deleteUser(currentUser.id);
    },
    onSuccess: () => {
      // Order matters: clear BEFORE hard reload so the freshly
      // mounted /auth/login tree cannot read stale tokens or settings.
      // `clearAuthAndStateForLogout` codifies the order in
      // knowledge.md §6.8.5:
      //   1. localStorage.removeItem(accessToken + refreshToken)
      //   2. sessionStorage.removeItem("mobile.splash.shown")
      //   3. queryClient.clear()
      //   4. dispatch(logoutAction())
      clearAuthAndStateForLogout(dispatch, queryClient);
      // Hard reload: the user is GONE server-side. There is no
      // soft-navigation target — every closure must be torn down.
      window.location.href = "/auth/login";
    },
    onError: (error: Error) => {
      console.error("Error deleting account:", error);
      errorToast(
        error?.message ??
          t(
            "settings.deleteError",
            "Failed to delete account. Please try again.",
          ),
        4000,
        "delete-account",
      );
      // Flip the local UI state back so the destructive button
      // re-enables. (We intentionally do NOT dispatch `logoutAction()`
      // here — the user's account still exists, we just failed to
      // delete it. A successful soft-delete UX would be: stay logged
      // in, show an error toast, let the user retry.)
      setIsDeleting(false);
    },
  });

  const handleDeleteAccount = () => {
    if (!isDeleteConfirmed) return;
    setIsDeleting(true);
    deleteAccountMutation();
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
                  {t("settings.typeToConfirm", {
                    phrase: deleteConfirmPhrase,
                  })}
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
                disabled={!isDeleteConfirmed || isDeleting || isDeletingAccount}
                data-testid="delete-account-button"
              >
                {isDeleting || isDeletingAccount
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
