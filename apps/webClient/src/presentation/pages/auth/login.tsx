import { loginAction } from "@adapters/slices/auth/authSlice";
import { login } from "@application/auth/auth.service";
import { SocialLoginButtons } from "@presentation/components/social-buttons-login";
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
import { RoutePaths } from "@presentation/utils/routes";
import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router";

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { mutate: loginMutation } = useMutation({
    mutationKey: ["login"],
    mutationFn: login,
    onSuccess: () => {
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
        setError(serverMessage || "Credenciales incorrectas");
      } else {
        setError(JSON.stringify(error));
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
      <div className="w-full h-full flex items-center justify-center">
        <svg
          className="animate-spin h-8 w-8 text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            strokeWidth="4"
            stroke="currentColor"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2.93 6.364A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3.93-1.574zM12 20a8 8 0 008-8h4c0 5.627-4.373 10-10 10v-4zm6.364-2.93A7.962 7.962 0 0120 12h4c0 3.042-1.135 5.824-3 7.938l-3.636-1.868zM12 4a8 8 0 00-8 8H0c0-5.627 4.373-10 10-10v4zm2.93-.636A7.962 7.962 0 0112 4V0c3.042 0 5.824 1.135 7.938 3l-1.574 3.93z"
          ></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <Button
        variant="default"
        className="absolute left-4 top-4 md:left-8 md:top-8 animate-shake"
        onClick={() => navigate(RoutePaths.Home)}
      >
        {t("auth.goBack")}
      </Button>
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
            {error && <p className="text-red-500">{error}</p>}
            <Button variant="default" type="submit" className="w-full">
              {t("auth.signIn")}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-2 text-xs text-slate-500">
                {t("auth.orContinueWith")}
              </span>
            </div>
          </div>

          <SocialLoginButtons />
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-slate-500">
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
