import { clearAuthAndStateForLogout } from "@adapters/auth/clearAuthAndStateForLogout";
import { changePassword } from "@application/user/user.service";
import {
  isValidPassword,
  UserPasswordNotMatchError,
  UserPasswordNotValidError,
} from "@domain/user/UserPassword";
import { errorToast, successToast } from "@presentation/utils/toast";
import { RoutePaths } from "@presentation/utils/routes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router";
import { Eye, EyeOff } from "@presentation/components/ui/animated-icons";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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

export function SecuritySettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const { mutate: updatePasswordMutation } = useMutation({
    mutationKey: ["changePassword"],
    mutationFn: changePassword,
    onMutate: () => setIsSaving(true),
    onSuccess: () => {
      setIsSaving(false);
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      successToast(t("profile.passwordUpdateSuccess"), 3000, "password-update");
      // The API bumped the session epoch, so the access token this tab holds
      // is already rejected. Staying here would 401 on the next request;
      // reset the client state and let the user sign in with the new
      // password.
      clearAuthAndStateForLogout(dispatch, queryClient);
      navigate(`${RoutePaths.Auth}/${RoutePaths.Login}`, { replace: true });
    },
    onError: (
      error: unknown & {
        response?: { status?: number; data?: { message?: string } };
      },
    ) => {
      console.error(error);
      // The 429 carries the API's Spanish message, which the English UI must
      // not show; translate it by status instead of passing it through.
      const message =
        error?.response?.status === 429
          ? t("profile.passwordRateLimited")
          : error?.response?.data?.message ?? t("profile.passwordUpdateError");
      setError(message);
      errorToast(message, 3000, "password-update");
      setIsSaving(false);
    },
  });

  const togglePasswordVisibility = (field: "current" | "new" | "confirm") => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.currentPassword.trim()) {
      setError(t("profile.currentPasswordRequired"));
      return;
    }
    if (!isValidPassword(formData.newPassword)) {
      setError(UserPasswordNotValidError().message);
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError(UserPasswordNotMatchError().message);
      return;
    }

    updatePasswordMutation({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword,
    });
  };

  return (
    <Card className="bg-card dark:bg-card dark:text-neutral">
      <CardHeader>
        <CardTitle>{t("profile.securitySettings")}</CardTitle>
        <CardDescription>{t("profile.securitySettingsDesc")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              {success}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">
              {t("profile.currentPassword")}
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                name="currentPassword"
                type={showPasswords.current ? "text" : "password"}
                value={formData.currentPassword}
                onChange={handleChange}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => togglePasswordVisibility("current")}
              >
                {showPasswords.current ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("profile.newPassword")}</Label>
            <div className="relative">
              <Input
                id="newPassword"
                name="newPassword"
                type={showPasswords.new ? "text" : "password"}
                value={formData.newPassword}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => togglePasswordVisibility("new")}
              >
                {showPasswords.new ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("profile.passwordHint")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              {t("profile.confirmNewPassword")}
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showPasswords.confirm ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                onClick={() => togglePasswordVisibility("confirm")}
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t("profile.updating") : t("profile.updatePassword")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
