'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
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
import { useLogin } from '@/features/auth/hooks/use-auth';
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

/** Login entry point with localized, contract-aware mutation feedback. */
export function LoginForm({ demoCredentials }: LoginFormProps) {
  const t = useT();
  const { mutate: login, isPending, error, reset } = useLogin();
  const [email, setEmail] = useState(demoCredentials?.email ?? '');
  const [password, setPassword] = useState(demoCredentials?.password ?? '');
  const [clientErrors, setClientErrors] = useState<Partial<Record<LoginField, string>>>({});
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
