import { loginAction, setUser } from "@adapters/slices/auth/authSlice";
import { login } from "@application/auth/auth.service";
import { isNativePlatform } from "@infrastructure/platform";
import { SocialLoginButtons } from "@presentation/components/social-buttons-login";
import { BrandDots } from "@presentation/components/loader";
import { Button } from "@presentation/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@presentation/components/ui/card";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { Separator } from "@presentation/components/ui/separator";
import { goToLanding } from "@presentation/utils/landing";
import { RoutePaths } from "@presentation/utils/routes";
import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router";

export default function LoginPage() {
  const { t } = useTranslation();
  // The Google OAuth callback is a browser navigation, so the 409 of a
  // concurrent signup reaches the SPA as `?error=email_in_use`
  // (`AuthController.googleCallback`). Surface it instead of dropping the user
  // on a silent login form.
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  // Derived on every render instead of seeded into state: a language switch
  // re-translates the banner, and a failed submit takes precedence over the
  // stale query parameter.
  const oauthError =
    searchParams.get("error") === "email_in_use" ? t("auth.emailInUse") : null;
  const error = formError ?? oauthError;
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Module-scope lazy cache in @infrastructure/native makes this cheap
  // (O(1) cache hit on every call after the first).
  const isNative = isNativePlatform();

  const { mutate: loginMutation } = useMutation({
    mutationKey: ["login"],
    mutationFn: login,
    onSuccess: (data: any) => {
      // The backend returns `{ user, message }` from /auth/login.
      // Populate the store immediately so dashboard components don't
      // break while useRestoreSession's /user/profile is still in-flight.
      if (data?.user) {
        dispatch(setUser(data.user));
      }
      dispatch(loginAction());
      setLoading(true);
      setTimeout(() => {
        navigate(RoutePaths.App + "/" + RoutePaths.Dashboard);
        setLoading(false);
      }, 1000);
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      const serverMessage = error.response?.data?.message;
      const status = error.response?.status;

      if (status === 401) {
        setFormError(serverMessage || "Credenciales incorrectas");
      } else {
        setFormError(JSON.stringify(error));
      }

      setLoading(false);
    },
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    loginMutation({ email, password });
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-4 pt-12 pb-12"
          >
            <BrandDots
              size="lg"
              className="text-teal-600 dark:text-teal-300"
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {t("common.loading")}
            </span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      {!isNative && (
        <Button
          variant="default"
          className="absolute left-4 top-[max(env(safe-area-inset-top),1rem)] md:left-8 md:top-8 animate-shake"
          onClick={goToLanding}
        >
          {t("auth.goBack")}
        </Button>
      )}
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-primary"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18.5 4H5.5C4.12 4 3 5.12 3 6.5v11C3 18.88 4.12 20 5.5 20h13c1.38 0 2.5-1.12 2.5-2.5v-11C21 5.12 19.88 4 18.5 4Z" />
                <path d="M3 6.5l9 6 9-6" />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {t("auth.welcomeBack")}
          </CardTitle>
          <CardDescription>{t("auth.signInToAccount")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-rose-500">{error}</p>}
            <Button
              variant="default"
              type="submit"
              className="star-cta w-full"
            >
              {t("auth.signIn")}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                {t("auth.orContinueWith")}
              </span>
            </div>
          </div>

          <SocialLoginButtons />
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("auth.dontHaveAccount")}{" "}
            <Link
              to={RoutePaths.Auth + "/" + RoutePaths.Signup}
              className="text-primary hover:underline"
            >
              {t("auth.signUp")}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
