'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, Copy, RotateCw, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDisableMfaTotp,
  useEnrollMfaTotp,
  useMfaStatus,
  useVerifyMfaTotp,
} from '@/features/auth/hooks/use-mfa';
import type { MfaTotpEnrollResponse } from '@/features/auth/types';
import { useT } from '@/i18n';

export function MfaSecurityPanel() {
  const t = useT('settings.security');
  const locale = useLocale();
  const mfaStatus = useMfaStatus();
  const enrollMfa = useEnrollMfaTotp();
  const verifyMfa = useVerifyMfaTotp();
  const disableMfa = useDisableMfaTotp();

  const [enrollment, setEnrollment] = useState<MfaTotpEnrollResponse | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale]
  );

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyError'));
    }
  };

  const handleStartSetup = async () => {
    setVerifyError(null);
    try {
      const data = await enrollMfa.mutateAsync();
      setEnrollment(data);
      setVerifyCode('');
    } catch {
      toast.error(t('enrollError'));
    }
  };

  const handleVerifySetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = verifyCode.trim();
    if (!trimmed) {
      setVerifyError(t('codeRequired'));
      return;
    }

    setVerifyError(null);
    try {
      const result = await verifyMfa.mutateAsync({ code: trimmed });
      setEnrollment(null);
      setVerifyCode('');
      setRecoveryCodes(result.recovery_codes);
      toast.success(t('enabledSuccess'));
    } catch {
      setVerifyError(t('verifyError'));
    }
  };

  const handleDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = disableCode.trim();
    if (!trimmed) {
      setDisableError(t('disableCodeRequired'));
      return;
    }

    setDisableError(null);
    try {
      await disableMfa.mutateAsync({ code: trimmed });
      setDisableCode('');
      setRecoveryCodes(null);
      toast.success(t('disabledSuccess'));
    } catch {
      setDisableError(t('disableError'));
    }
  };

  if (mfaStatus.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('loading')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (mfaStatus.isError || !mfaStatus.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" className="size-4" />
            <AlertTitle>{t('loadErrorTitle')}</AlertTitle>
            <AlertDescription>{t('loadError')}</AlertDescription>
          </Alert>
          <Button type="button" variant="outline" onClick={() => void mfaStatus.refetch()}>
            <RotateCw aria-hidden="true" className="size-4" />
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = mfaStatus.data;

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
              {t('title')}
            </CardTitle>
            <CardDescription>{t('description')}</CardDescription>
          </div>
          <Badge variant={status.enabled ? 'default' : 'secondary'}>
            {status.enabled ? t('statusEnabled') : t('statusDisabled')}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-5">
          <dl className="grid gap-3 rounded-lg border border-border bg-bg-surface/60 p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-text-muted">{t('methodLabel')}</dt>
              <dd className="mt-1 font-medium text-text-main">{t('methodTotp')}</dd>
            </div>
            <div>
              <dt className="text-text-muted">{t('remainingCodesLabel')}</dt>
              <dd className="mt-1 font-medium text-text-main">
                {status.remaining_recovery_codes}
              </dd>
            </div>
            {status.enrolled_at ? (
              <div>
                <dt className="text-text-muted">{t('enrolledAtLabel')}</dt>
                <dd className="mt-1 font-medium text-text-main">
                  {dateFormatter.format(new Date(status.enrolled_at))}
                </dd>
              </div>
            ) : null}
          </dl>

          {recoveryCodes && (
            <div className="space-y-4 rounded-lg border border-border bg-bg-surface p-4">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-text-main">{t('recoveryTitle')}</h3>
                <p className="text-sm text-text-muted">{t('recoveryDescription')}</p>
              </div>

              <Alert>
                <ShieldAlert aria-hidden="true" className="size-4" />
                <AlertTitle>{t('recoveryWarningTitle')}</AlertTitle>
                <AlertDescription>{t('recoveryWarning')}</AlertDescription>
              </Alert>

              <div
                className="grid grid-cols-2 gap-2 rounded-md border border-border bg-bg-canvas p-3 font-mono text-sm"
                data-testid="mfa-recovery-codes"
              >
                {recoveryCodes.map(code => (
                  <span key={code} className="select-all">
                    {code}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void copyText(recoveryCodes.join('\n'))}
                >
                  <Copy aria-hidden="true" className="size-4" />
                  {t('copyAllCodes')}
                </Button>
                <Button type="button" onClick={() => setRecoveryCodes(null)}>
                  {t('done')}
                </Button>
              </div>
            </div>
          )}

          {!status.enabled && !enrollment && (
            <div>
              <Button
                type="button"
                loading={enrollMfa.isPending}
                onClick={() => void handleStartSetup()}
              >
                <ShieldCheck aria-hidden="true" className="size-4" />
                {t('startSetup')}
              </Button>
            </div>
          )}

          {!status.enabled && enrollment && (
            <div className="space-y-4 rounded-lg border border-border bg-bg-surface/60 p-4">
              <p className="text-sm text-text-muted">{t('setupInstructions')}</p>

              <div className="space-y-2">
                <Label htmlFor="mfa-otpauth-uri">{t('otpauthUriLabel')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="mfa-otpauth-uri"
                    readOnly
                    value={enrollment.otpauth_uri}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copyText(enrollment.otpauth_uri)}
                  >
                    <Copy aria-hidden="true" className="size-4" />
                    {t('copyUri')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mfa-secret-key">{t('secretLabel')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="mfa-secret-key"
                    readOnly
                    value={enrollment.secret}
                    className="font-mono tracking-wider"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void copyText(enrollment.secret)}
                  >
                    <Copy aria-hidden="true" className="size-4" />
                    {t('copySecret')}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleVerifySetup} className="space-y-3" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="mfa-verify-code">{t('codeLabel')}</Label>
                  <Input
                    id="mfa-verify-code"
                    name="code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t('codePlaceholder')}
                    disabled={verifyMfa.isPending}
                    value={verifyCode}
                    errorText={verifyError ?? undefined}
                    className="max-w-xs font-mono tracking-wider"
                    onChange={event => {
                      setVerifyCode(event.target.value);
                      setVerifyError(null);
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={verifyMfa.isPending}>
                    {t('verifyAndEnable')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={verifyMfa.isPending}
                    onClick={() => {
                      setEnrollment(null);
                      setVerifyCode('');
                      setVerifyError(null);
                    }}
                  >
                    {t('cancelSetup')}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {status.enabled && (
            <form
              onSubmit={handleDisable}
              className="space-y-4 rounded-lg border border-border bg-bg-surface/60 p-4"
              noValidate
            >
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-text-main">{t('disableTitle')}</h3>
                <p className="text-sm text-text-muted">{t('disableDescription')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mfa-disable-code">{t('disableCodeLabel')}</Label>
                <Input
                  id="mfa-disable-code"
                  name="code"
                  type="text"
                  autoComplete="one-time-code"
                  placeholder={t('disableCodePlaceholder')}
                  disabled={disableMfa.isPending}
                  value={disableCode}
                  errorText={disableError ?? undefined}
                  className="max-w-xs font-mono tracking-wider"
                  onChange={event => {
                    setDisableCode(event.target.value);
                    setDisableError(null);
                  }}
                />
              </div>
              <Button
                type="submit"
                variant="destructive"
                loading={disableMfa.isPending}
              >
                <ShieldOff aria-hidden="true" className="size-4" />
                {t('disableSubmit')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
