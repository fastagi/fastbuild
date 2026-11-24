'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { email as emailFormat } from 'zod/mini';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useLogin,
  useSsoProviders,
  useStartSsoOidc,
  useVerifyMfaChallenge,
} from '@/features/auth/hooks/use-auth';
import type { MfaChallengeResponse } from '@/features/auth/types';
import { hasAuthFieldError, resolveAuthErrorKey } from '@/features/auth/utils/auth-error';
import { useT } from '@/i18n';

const emailSchema = emailFormat();

const FIELD_ORDER = ['email', 'password'] as const;
type LoginField = (typeof FIELD_ORDER)[number];

interface LoginFormProps {
  demoCredentials?: {
    email: string;
    password: string;
  };
}

/** Login entry point with localized, contract-aware mutation feedback, SSO, and MFA challenge support. */
export function LoginForm({ demoCredentials }: LoginFormProps) {
  const t = useT();
  const verifyMfa = useVerifyMfaChallenge();
  const ssoProviders = useSsoProviders();
  const startSso = useStartSsoOidc();

  const [email, setEmail] = useState(demoCredentials?.email ?? '');
  const [password, setPassword] = useState(demoCredentials?.password ?? '');
  const [clientErrors, setClientErrors] = useState<Partial<Record<LoginField, string>>>({});
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallengeResponse | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaCodeError, setMfaCodeError] = useState<string | undefined>(undefined);
  const [activeSsoProvider, setActiveSsoProvider] = useState<string | null>(null);

  const { mutate: login, isPending, error, reset } = useLogin({
    onMfaChallenge: challenge => {
      setMfaChallenge(challenge);
      setMfaCode('');
      setMfaCodeError(undefined);
      verifyMfa.reset();
    },
  });

  const emailError =
    clientErrors.email ?? (hasAuthFieldError(error, 'email') ? t.auth('emailInvalid') : undefined);
  const passwordError =
    clientErrors.password ??
    (hasAuthFieldError(error, 'password') ? t.auth('passwordInvalid') : undefined);

  const clearFieldError = (field: LoginField) => {
    setClientErrors(current => ({ ...current, [field]: undefined }));
    if (error) {
      reset();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<Record<LoginField, string>> = {};

    if (!email) {
      errors.email = t.auth('emailRequired');
    } else if (!emailSchema.safeParse(email).success) {
      errors.email = t.auth('emailInvalid');
    }
    // Sign-in checks presence only: existing accounts may predate the current registration rule.
    if (!password) {
      errors.password = t.auth('passwordRequired');
    }
    setClientErrors(errors);

    const firstInvalidField = FIELD_ORDER.find(field => errors[field]);
    if (firstInvalidField) {
      document.getElementById(firstInvalidField)?.focus();
      return;
    }

    login({ email, password });
  };

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaChallenge) {
      return;
    }

    const trimmed = mfaCode.trim();
    if (!trimmed) {
      setMfaCodeError(t.auth('mfaCodeRequired'));
      document.getElementById('mfa-code')?.focus();
      return;
    }

    setMfaCodeError(undefined);
    verifyMfa.mutate({
      challenge_token: mfaChallenge.challenge_token,
      code: trimmed,
    });
  };

  const handleSsoSignIn = (providerSlug: string) => {
    setActiveSsoProvider(providerSlug);
    startSso.mutate(
      { provider: providerSlug },
      {
        onSuccess: data => {
          window.location.assign(data.authorize_url);
        },
        onSettled: () => {
          setActiveSsoProvider(null);
        },
      }
    );
  };

  if (mfaChallenge) {
    return (
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="space-y-1 px-0">
          <div className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
            <CardTitle className="text-2xl font-bold tracking-tight">
              {t.auth('mfaTitle')}
            </CardTitle>
          </div>
          <CardDescription>{t.auth('mfaDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-4">
          <form
            onSubmit={handleMfaSubmit}
            className="space-y-4"
            aria-busy={verifyMfa.isPending}
            noValidate
          >
            {verifyMfa.error && (
              <Alert variant="destructive">
                <AlertCircle aria-hidden="true" className="size-4" />
                <AlertDescription>{t(resolveAuthErrorKey(verifyMfa.error, 'mfa'))}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="mfa-code">{t.auth('mfaCodeLabel')}</Label>
              <Input
                id="mfa-code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder={t.auth('mfaCodePlaceholder')}
                required
                disabled={verifyMfa.isPending}
                root
                className="bg-bg-canvas font-mono tracking-wider"
                value={mfaCode}
                errorText={mfaCodeError}
                onChange={event => {
                  setMfaCode(event.target.value);
                  setMfaCodeError(undefined);
                  if (verifyMfa.error) {
                    verifyMfa.reset();
                  }
                }}
              />
            </div>

            <Button type="submit" className="w-full font-semibold" loading={verifyMfa.isPending}>
              {t.auth('mfaVerifySubmit')}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={verifyMfa.isPending}
              onClick={() => {
                setMfaChallenge(null);
                setMfaCode('');
                setMfaCodeError(undefined);
                verifyMfa.reset();
              }}
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t.auth('backToSignIn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  const providers = ssoProviders.data ?? [];

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="space-y-1 px-0">
        <CardTitle className="text-2xl font-bold tracking-tight">{t.auth('signIn')}</CardTitle>
        <CardDescription>{t.auth('signInToContinue')}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isPending} noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" className="size-4" />
              <AlertDescription>{t(resolveAuthErrorKey(error, 'login'))}</AlertDescription>
            </Alert>
          )}

          {startSso.error && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" className="size-4" />
              <AlertDescription>{t(resolveAuthErrorKey(startSso.error, 'sso'))}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t.auth('email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t.auth('enterEmail')}
              required
              disabled={isPending}
              root
              className="bg-bg-canvas"
              value={email}
              errorText={emailError}
              onChange={event => {
                setEmail(event.target.value);
                clearFieldError('email');
              }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t.auth('password')}</Label>
              {demoCredentials && (
                <span className="text-sm text-text-muted">
                  {t.auth('demoCredentialsHint')}
                </span>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={isPending}
              root
              className="bg-bg-canvas"
              value={password}
              errorText={passwordError}
              onChange={event => {
                setPassword(event.target.value);
                clearFieldError('password');
              }}
            />
          </div>
          <Button type="submit" className="w-full font-semibold" loading={isPending}>
            {t.auth('login')}
          </Button>
        </form>

        {providers.length > 0 && (
          <div className="mt-5 space-y-3">
            <div className="relative flex items-center justify-center">
              <span className="w-full border-t border-border" aria-hidden="true" />
              <span className="bg-bg-canvas px-2 text-xs uppercase tracking-wider text-text-muted whitespace-nowrap">
                {t.auth('orContinueWith')}
              </span>
              <span className="w-full border-t border-border" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              {providers.map(provider => (
                <Button
                  key={provider.slug}
                  type="button"
                  variant="outline"
                  className="w-full font-medium"
                  disabled={isPending || startSso.isPending}
                  loading={activeSsoProvider === provider.slug && startSso.isPending}
                  onClick={() => handleSsoSignIn(provider.slug)}
                >
                  <KeyRound aria-hidden="true" className="size-4" />
                  {t.auth('signInWithProvider', { provider: provider.name })}
                </Button>
              ))}
            </div>
          </div>
        )}

        {demoCredentials && (
          <div className="mt-4 rounded-lg border border-border/60 bg-bg-surface/80 p-3 text-sm text-text-subtle">
            <p className="font-medium text-text-main">{t.auth('demoCredentials')}</p>
            <p>
              {demoCredentials.email} / {demoCredentials.password}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="px-0 flex flex-wrap items-center justify-center gap-1.5 text-sm text-muted-foreground mt-2">
        {t.auth('noAccount')}
        <Link
          href="/register"
          className="font-medium text-primary hover:underline hover:text-primary-deep transition-colors"
        >
          {t.auth('signUp')}
        </Link>
      </CardFooter>
    </Card>
  );
}
