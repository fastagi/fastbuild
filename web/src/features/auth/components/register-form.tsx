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
import { FormControlError } from '@/components/ui/form-control';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useRegister } from '@/features/auth/hooks/use-auth';
import { hasAuthFieldError, resolveAuthErrorKey } from '@/features/auth/utils/auth-error';
import { useT } from '@/i18n';

// The browser-facing register contract (contracts/AUTHENTICATION.md), which the Route Handler
// enforces before the looser Go DTO ever sees the payload.
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const EMAIL_MAX_LENGTH = 100;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 50;
const emailSchema = emailFormat();

const FIELD_ORDER = ['name', 'email', 'password', 'terms'] as const;
type RegisterField = (typeof FIELD_ORDER)[number];

interface RegisterFormProps {
  /**
   * Where this deployment publishes its legal documents, passed by the route that renders the
   * form. Without them the form says the documents are unpublished instead of linking nowhere.
   */
  legalLinks?: {
    termsUrl: string;
    privacyUrl: string;
  };
}

/** Registration entry point with localized, contract-aware mutation feedback. */
export function RegisterForm({ legalLinks }: RegisterFormProps) {
  const t = useT();
  const { mutate: register, isPending, error, reset } = useRegister();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [clientErrors, setClientErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const nameError =
    clientErrors.name ?? (hasAuthFieldError(error, 'name') ? t.auth('nameInvalid') : undefined);
  const emailError =
    clientErrors.email ?? (hasAuthFieldError(error, 'email') ? t.auth('emailInvalid') : undefined);
  const passwordError =
    clientErrors.password ??
    (hasAuthFieldError(error, 'password') ? t.auth('passwordLengthInvalid') : undefined);
  const termsError = clientErrors.terms;

  const clearFieldError = (field: RegisterField) => {
    setClientErrors(current => ({ ...current, [field]: undefined }));
    if (error) {
      reset();
    }
  };

  const validate = () => {
    const errors: Partial<Record<RegisterField, string>> = {};
    const trimmedName = name.trim();

    if (!trimmedName) {
      errors.name = t.auth('nameRequired');
    } else if (trimmedName.length < NAME_MIN_LENGTH) {
      errors.name = t.auth('nameMinLength');
    } else if (trimmedName.length > NAME_MAX_LENGTH) {
      errors.name = t.auth('nameTooLong');
    }

    if (!email) {
      errors.email = t.auth('emailRequired');
    } else if (email.length > EMAIL_MAX_LENGTH || !emailSchema.safeParse(email).success) {
      errors.email = t.auth('emailInvalid');
    }

    if (!password) {
      errors.password = t.auth('passwordRequired');
    } else if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      errors.password = t.auth('passwordLengthInvalid');
    }

    if (!acceptedTerms) {
      errors.terms = t.auth('termsRequired');
    }

    return errors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    setClientErrors(errors);

    const firstInvalidField = FIELD_ORDER.find(field => errors[field]);
    if (firstInvalidField) {
      document.getElementById(firstInvalidField)?.focus();
      return;
    }

    register({ name, email, password });
  };

  const legalLinkClassName =
    'rounded-sm text-primary underline underline-offset-2 transition-colors hover:text-primary-deep focus-ring';

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardHeader className="space-y-1 px-0">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {t.auth('createAccount')}
        </CardTitle>
        <CardDescription>{t.auth('getStarted')}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isPending} noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" className="size-4" />
              <AlertDescription>{t(resolveAuthErrorKey(error, 'register'))}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t.auth('fullName')}</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder={t.auth('enterFullName')}
              required
              disabled={isPending}
              root
              className="bg-bg-canvas"
              value={name}
              errorText={nameError}
              onChange={event => {
                setName(event.target.value);
                clearFieldError('name');
              }}
            />
          </div>
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
            <Label htmlFor="password">{t.auth('password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              aria-describedby={passwordError ? undefined : 'password-hint'}
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
            {!passwordError && (
              <p id="password-hint" className="text-xs text-muted-foreground">
                {t.auth('passwordHint')}
              </p>
            )}
          </div>

          <div className="flex items-start space-x-2 pt-2">
            {/* The pseudo-element grows the hit area up to the label; the box itself stays 16px. */}
            <Checkbox
              id="terms"
              name="terms"
              checked={acceptedTerms}
              disabled={isPending}
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? 'terms-error' : undefined}
              className="relative after:absolute after:-inset-y-[15px] after:-left-[15px] after:-right-[9px] after:content-[''] aria-invalid:border-destructive"
              onCheckedChange={checked => {
                setAcceptedTerms(Boolean(checked));
                clearFieldError('terms');
              }}
              required
            />
            <div className="grid gap-1.5">
              <label
                htmlFor="terms"
                className="text-xs font-medium leading-4 peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {t.auth('agreeToTerms')}{' '}
                {legalLinks ? (
                  <>
                    <a
                      href={legalLinks.termsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={legalLinkClassName}
                    >
                      {t.auth('termsOfService')}
                    </a>{' '}
                    {t.auth('and')}{' '}
                    <a
                      href={legalLinks.privacyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={legalLinkClassName}
                    >
                      {t.auth('privacyPolicy')}
                    </a>
                  </>
                ) : (
                  <>
                    {t.auth('termsOfService')} {t.auth('and')} {t.auth('privacyPolicy')}
                  </>
                )}
              </label>
              {!legalLinks && (
                <p className="text-xs text-muted-foreground">
                  {t.auth('legalDocumentsUnpublished')}
                </p>
              )}
              {termsError && (
                <FormControlError id="terms-error" className="mt-0">
                  {termsError}
                </FormControlError>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full font-semibold"
            loading={isPending}
          >
            {t.auth('signUp')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="px-0 flex flex-wrap items-center justify-center gap-1.5 text-sm text-muted-foreground mt-2">
        {t.auth('hasAccount')}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline hover:text-primary-deep transition-colors"
        >
          {t.auth('signIn')}
        </Link>
      </CardFooter>
    </Card>
  );
}
