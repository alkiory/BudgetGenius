import { useTranslation } from 'react-i18next';
import { forgotPassword } from "@application/auth/auth.service";
import { Button } from "@presentation/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@presentation/components/ui/card";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { RoutePaths } from "@presentation/utils/routes";
import { useMutation } from "@tanstack/react-query";
import { Wallet, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const { mutate } = useMutation({
    mutationKey: ['forgotPassword'],
    mutationFn: forgotPassword,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      alert(data.message);
      navigate(RoutePaths.Auth + '/' + RoutePaths.ForgotPasswordConfirmation);
    },
    onError: (error: Error & { status: number, response: { data: { message: string } } }) => {
      if (error.status === 401 || error.status === 404) {
        setError(error.response.data.message);
        return;
      }
      setError(error.message);
    },
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    mutate(email);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-2">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{t('auth.resetPassword')}</CardTitle>
        <CardDescription>{t('auth.sendRecoveryLink')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              onChange={(e) => setEmail(e.target.value)}
              required />
          </div>
          {error && <p className="text-red-500">{error}</p>}            <Button type="submit" className="w-full">
            {t('auth.sendRecoveryLink')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link to={RoutePaths.Auth + '/' + RoutePaths.Login} className="flex items-center text-sm text-primary hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t('auth.goBack')}
        </Link>
      </CardFooter>
    </Card>
  )
}