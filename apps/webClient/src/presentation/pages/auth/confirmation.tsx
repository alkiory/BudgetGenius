import { Button } from "@presentation/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@presentation/components/ui/card";
import { RoutePaths } from "@presentation/utils/routes";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export default function ForgotPasswordConfirmationPage() {
  const { t } = useTranslation();
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">
          {t("auth.checkEmail")}
        </CardTitle>
        <CardDescription>{t("auth.resetLinkSent")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          {t("auth.checkSpamFolder")}
        </p>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link to={RoutePaths.Auth + "/" + RoutePaths.Login}>
          <Button variant="outline">{t("auth.returnToLogin")}</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
