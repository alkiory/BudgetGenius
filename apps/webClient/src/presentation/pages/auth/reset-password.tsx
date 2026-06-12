import { useTranslation } from 'react-i18next';
import { setCookie } from "@adapters/index";
import { resetPassword } from "@application/auth/auth.service";
import { Button } from "@presentation/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@presentation/components/ui/card";
import { Input } from "@presentation/components/ui/input";
import { Label } from "@presentation/components/ui/label";
import { RoutePaths } from "@presentation/utils/routes";
import { useMutation } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const [searchParam] = useSearchParams();
  const token = searchParam.get('token');

  const { mutate } = useMutation({
    mutationKey: ['resetPassword'],
    mutationFn: resetPassword,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      alert(data.message);
      navigate(RoutePaths.Auth + '/' + RoutePaths.Login);
    },
    onError: (error: Error & { status: number, response: { data: { message: string } } }) => {
      if (error.status === 400 || error.status === 401 || error.status === 404) {
        setError(error.response.data.message);
        return;
      }
      setError(error.message);
    },
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (token) {
      mutate({ newPassword, confirmPassword, token });
    } else {
      setError('⚠️ Invalid token or token expired');
    }
  };

  useEffect(() => {
    if (newPassword !== confirmPassword) {
      setError('⚠️ Passwords do not match');
    } else {
      setError('');
    }
  }, [newPassword, confirmPassword]);

  useEffect(() => {
    if (!token) {
      navigate(RoutePaths.Auth + '/' + RoutePaths.Login, { replace: true });
    } else {
      setCookie('resetPasswordToken', token);
    }

  }, [token, navigate]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-primary/10 p-2">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{t('auth.resetPassword')}</CardTitle>
        <CardDescription>{t('auth.passwordRequirements')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              placeholder="********"
              onChange={(e) => setNewPassword(e.target.value)}
              required />
            <p className="text-xs text-slate-500">
              {t('auth.passwordRequirements')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('auth.password')}</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="********"
              onChange={(e) => setConfirmPassword(e.target.value)}
              required />
          </div>
          {error && <p className="text-red-500">{error}</p>}            <Button type="submit" className="w-full">
            {t('auth.resetPassword')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-slate-500">
          {t('auth.alreadyHaveAccount')}{" "}
          <Link to={RoutePaths.Auth + '/' + RoutePaths.Login} className="text-primary hover:underline">
            {t('auth.signIn')}
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}