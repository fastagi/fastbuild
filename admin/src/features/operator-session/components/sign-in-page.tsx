import { useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { env } from '@/config/env';
import { useSignIn } from '@/features/operator-session/hooks/use-operator-session';
import { signInErrorKey } from '@/features/operator-session/sign-in-errors';

export function SignInPage({ redirectTo }: { redirectTo: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signIn = useSignIn();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    signIn.mutate(
      { identifier: identifier.trim(), password },
      {
        onSuccess: () => {
          setPassword('');
          void navigate({ to: redirectTo, replace: true });
        },
      },
    );
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <div className="flex items-center gap-2.5">
        <span className="brand-mark" aria-hidden="true">
          {env.APP_NAME.charAt(0).toUpperCase()}
        </span>
        <span className="grid text-sm leading-tight">
          <span className="font-semibold">{env.APP_NAME}</span>
          <span className="text-xs text-muted-foreground">{t('app.shell')}</span>
        </span>
      </div>
      <SectionCard
        icon={ShieldCheck}
        titleId="sign-in-title"
        titleAs="h1"
        title={t('auth.title')}
        description={t('auth.description')}
        className="w-full max-w-sm"
        contentClassName="p-0"
      >
        <form className="p-5 flex flex-col gap-4" onSubmit={submit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sign-in-identifier">{t('auth.identifier')}</Label>
            <Input
              id="sign-in-identifier"
              name="identifier"
              autoComplete="username"
              required
              maxLength={100}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sign-in-password">{t('auth.password')}</Label>
            <div className="relative">
              <Input
                id="sign-in-password"
                name="password"
                type={revealed ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                className="pr-10"
                aria-describedby={capsLock ? 'sign-in-caps-lock' : undefined}
                onChange={(event) => setPassword(event.target.value)}
                onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
                onBlur={() => setCapsLock(false)}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
                aria-label={revealed ? t('auth.hidePassword') : t('auth.showPassword')}
                aria-pressed={revealed}
                title={revealed ? t('auth.hidePassword') : t('auth.showPassword')}
                onClick={() => setRevealed((value) => !value)}
              >
                {revealed ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
            {capsLock ? (
              <p id="sign-in-caps-lock" className="text-xs text-warning-strong">
                {t('auth.capsLock')}
              </p>
            ) : null}
          </div>
          {signIn.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {t(signInErrorKey(signIn.error))}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={signIn.isPending || identifier.trim() === '' || password === ''}
          >
            <LogIn aria-hidden="true" />
            {signIn.isPending ? t('auth.submitting') : t('auth.submit')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('auth.operatorNote')}</p>
        </form>
      </SectionCard>
    </main>
  );
}
