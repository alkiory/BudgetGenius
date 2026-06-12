/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SocialLoginButtons } from '@presentation/components/social-buttons-login';
import { Button } from '@presentation/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@presentation/components/ui/card';
import { Checkbox } from '@presentation/components/ui/checkbox';
import { Input } from '@presentation/components/ui/input';
import { Label } from '@presentation/components/ui/label';
import { Separator } from '@presentation/components/ui/separator';
import { Wallet } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import { signup } from '@application/auth/auth.service';
import { useDispatch } from 'react-redux';
import { setUser } from '@adapters/slices/auth/authSlice';
import { ensureUserIsValid } from '@domain/user/user.entity';
import { RoutePaths } from '@presentation/utils/routes';

export default function SignupPage() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, _setRole] = useState('user');
  const [isPremium, _setIsPremium] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');

  const dispatch = useDispatch();

  const navigate = useNavigate();

  const { mutate: createNewUser } = useMutation({
    mutationKey: ['signup'],
    mutationFn: signup,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (data: any) => {
      alert('Signup successful');
      dispatch(setUser(data));
      navigate(RoutePaths.App + '/' + RoutePaths.Dashboard);
    },
    onError: (error: Error & { status: number, response: { data: { message: string } } }) => {
      if (error.status === 401) {
        setError(error.response.data.message);
        return;
      }
      setError(error.message);
    },
  })

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!termsAccepted) {
      setError('You must accept the terms and conditions');
      return;
    }

    createNewUser({
      name,
      surname,
      email,
      password,
      role,
      isPremium,
      authProvider: 'email'
    });
  };

  useEffect(() => {
    try {
      ensureUserIsValid({ name, surname, email, password, role, isPremium, authProvider: 'email' });
      setError('');
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      }
    }

    return () => {
      setError('');
    };

  }, [name, surname, email, password, role, isPremium]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Button
        variant="default"
        className="absolute left-4 top-4 md:left-8 md:top-8 animate-shake"          onClick={() => navigate(RoutePaths.Home)}
      >
        {t('auth.goBack')}
      </Button>
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-2">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">{t('auth.createAccount')}</CardTitle>
          <CardDescription>{t('auth.startTracking')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first-name">{t('auth.firstName')}</Label>
                <Input id="first-name" placeholder={t('auth.firstNamePlaceholder')} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last-name">{t('auth.lastName')}</Label>
                <Input id="last-name" placeholder={t('auth.lastNamePlaceholder')} onChange={(e) => setSurname(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input id="email" type="email" placeholder={t('auth.emailPlaceholder')} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input id="password" type="password" onChange={(e) => setPassword(e.target.value)} required />
              <p className="text-xs text-slate-500">
                {t('auth.passwordRequirements')}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
              <label
                htmlFor="terms"
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t('auth.agreeToTerms')}{" "}
                <Link to={RoutePaths.PrivacyPolicy} className="text-purple-600 hover:underline dark:text-purple-400">
                  {t('auth.privacyPolicy')}
                </Link>{" "}
                {t('auth.and')}{" "}
                <Link to={RoutePaths.TersmsAndConditions} className="text-purple-600 hover:underline dark:text-purple-400">
                  {t('auth.termsOfService')}
                </Link>
              </label>
            </div>
            {error && <p className="text-red-500">{error}</p>}
            <Button
              type="submit"
              variant='default'
              disabled={!name || !surname || !email || !password}
              className="w-full">
              {t('auth.createAccount')}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-2 text-xs text-slate-500">{t('auth.orContinueWith')}</span>
            </div>
          </div>

          <SocialLoginButtons />
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
    </div>
  )
}