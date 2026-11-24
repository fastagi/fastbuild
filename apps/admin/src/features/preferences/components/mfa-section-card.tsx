import { Copy, RotateCw, ShieldCheck, ShieldOff } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useDisableMfaTotp,
  useEnrollMfaTotp,
  useMfaStatus,
  useVerifyMfaTotp,
} from '@/features/operator-session/hooks/use-operator-session';
import type { MfaTotpEnroll } from '@/features/operator-session/types';

export function MfaSectionCard() {
  const { t } = useTranslation();
  const mfaStatus = useMfaStatus();
  const enrollMfa = useEnrollMfaTotp();
  const verifyMfa = useVerifyMfaTotp();
  const disableMfa = useDisableMfaTotp();

  const [enrollment, setEnrollment] = useState<MfaTotpEnroll | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState<string | null>(null);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('preferences.mfa.copied'));
    } catch {
      toast.error(t('preferences.mfa.copyError'));
    }
  };

  const handleStartSetup = async () => {
    setVerifyError(null);
    try {
      const data = await enrollMfa.mutateAsync();
      setEnrollment(data);
      setVerifyCode('');
    } catch {
      toast.error(t('preferences.mfa.enrollError'));
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = verifyCode.trim();
    if (trimmed === '') {
      setVerifyError(t('preferences.mfa.codeRequired'));
      return;
    }

    setVerifyError(null);
    try {
      const result = await verifyMfa.mutateAsync(trimmed);
      setEnrollment(null);
      setVerifyCode('');
      setRecoveryCodes(result.recovery_codes);
      toast.success(t('preferences.mfa.enabledSuccess'));
    } catch {
      setVerifyError(t('preferences.mfa.verifyError'));
    }
  };

  const handleDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = disableCode.trim();
    if (trimmed === '') {
      setDisableError(t('preferences.mfa.disableCodeRequired'));
      return;
    }

    setDisableError(null);
    try {
      await disableMfa.mutateAsync(trimmed);
      setDisableCode('');
      setRecoveryCodes(null);
      toast.success(t('preferences.mfa.disabledSuccess'));
    } catch {
      setDisableError(t('preferences.mfa.disableError'));
    }
  };

  const statusBadge = mfaStatus.data ? (
    <Badge variant={mfaStatus.data.enabled ? 'default' : 'secondary'}>
      {mfaStatus.data.enabled
        ? t('preferences.mfa.statusEnabled')
        : t('preferences.mfa.statusDisabled')}
    </Badge>
  ) : null;

  return (
    <SectionCard
      icon={ShieldCheck}
      titleId="mfa-security-title"
      title={t('preferences.mfa.title')}
      description={t('preferences.mfa.description')}
      actions={statusBadge}
    >
      {mfaStatus.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('preferences.mfa.loading')}</p>
      ) : mfaStatus.isError || !mfaStatus.data ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-destructive">
            {t('preferences.mfa.loadError')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void mfaStatus.refetch()}>
            <RotateCw aria-hidden="true" />
            {t('preferences.mfa.retry')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grid gap-3 rounded-md border border-border/70 bg-muted/30 p-3.5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t('preferences.mfa.methodLabel')}</dt>
              <dd className="mt-0.5 font-medium">{t('preferences.mfa.methodTotp')}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t('preferences.mfa.remainingCodesLabel')}
              </dt>
              <dd className="mt-0.5 font-medium">{mfaStatus.data.remaining_recovery_codes}</dd>
            </div>
          </dl>

          {recoveryCodes ? (
            <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-4">
              <div>
                <h3 className="text-sm font-semibold">{t('preferences.mfa.recoveryTitle')}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('preferences.mfa.recoveryDescription')}
                </p>
              </div>
              <div
                className="grid grid-cols-2 gap-2 rounded-md border border-border bg-background p-3 font-mono text-xs"
                data-testid="admin-mfa-recovery-codes"
              >
                {recoveryCodes.map((code) => (
                  <span key={code} className="select-all">
                    {code}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void copyText(recoveryCodes.join('\n'))}
                >
                  <Copy aria-hidden="true" />
                  {t('preferences.mfa.copyAllCodes')}
                </Button>
                <Button type="button" size="sm" onClick={() => setRecoveryCodes(null)}>
                  {t('preferences.mfa.done')}
                </Button>
              </div>
            </div>
          ) : null}

          {!mfaStatus.data.enabled && !enrollment ? (
            <div>
              <Button
                type="button"
                loading={enrollMfa.isPending}
                onClick={() => void handleStartSetup()}
              >
                <ShieldCheck aria-hidden="true" />
                {t('preferences.mfa.startSetup')}
              </Button>
            </div>
          ) : null}

          {!mfaStatus.data.enabled && enrollment ? (
            <div className="flex flex-col gap-4 rounded-md border border-border/80 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">
                {t('preferences.mfa.setupInstructions')}
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="admin-mfa-otpauth-uri">
                  {t('preferences.mfa.otpauthUriLabel')}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="admin-mfa-otpauth-uri"
                    readOnly
                    value={enrollment.otpauth_uri}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText(enrollment.otpauth_uri)}
                  >
                    <Copy aria-hidden="true" />
                    {t('preferences.mfa.copyUri')}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="admin-mfa-secret">{t('preferences.mfa.secretLabel')}</Label>
                <div className="flex gap-2">
                  <Input
                    id="admin-mfa-secret"
                    readOnly
                    value={enrollment.secret}
                    className="font-mono tracking-wider"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyText(enrollment.secret)}
                  >
                    <Copy aria-hidden="true" />
                    {t('preferences.mfa.copySecret')}
                  </Button>
                </div>
              </div>

              <form onSubmit={(event) => void handleVerify(event)} className="flex flex-col gap-3" noValidate>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="admin-mfa-verify-code">{t('preferences.mfa.codeLabel')}</Label>
                  <Input
                    id="admin-mfa-verify-code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder={t('preferences.mfa.codePlaceholder')}
                    disabled={verifyMfa.isPending}
                    value={verifyCode}
                    className="max-w-xs font-mono tracking-wider"
                    onChange={(event) => {
                      setVerifyCode(event.target.value);
                      setVerifyError(null);
                    }}
                  />
                  {verifyError ? (
                    <p role="alert" className="text-xs text-destructive">
                      {verifyError}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" loading={verifyMfa.isPending}>
                    {t('preferences.mfa.verifyAndEnable')}
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
                    {t('preferences.mfa.cancelSetup')}
                  </Button>
                </div>
              </form>
            </div>
          ) : null}

          {mfaStatus.data.enabled ? (
            <form
              onSubmit={(event) => void handleDisable(event)}
              className="flex flex-col gap-3 rounded-md border border-border/80 bg-muted/20 p-4"
              noValidate
            >
              <div>
                <h3 className="text-sm font-semibold">{t('preferences.mfa.disableTitle')}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('preferences.mfa.disableDescription')}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="admin-mfa-disable-code">
                  {t('preferences.mfa.disableCodeLabel')}
                </Label>
                <Input
                  id="admin-mfa-disable-code"
                  name="code"
                  autoComplete="one-time-code"
                  placeholder={t('preferences.mfa.disableCodePlaceholder')}
                  disabled={disableMfa.isPending}
                  value={disableCode}
                  className="max-w-xs font-mono tracking-wider"
                  onChange={(event) => {
                    setDisableCode(event.target.value);
                    setDisableError(null);
                  }}
                />
                {disableError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {disableError}
                  </p>
                ) : null}
              </div>
              <div>
                <Button type="submit" variant="destructive" loading={disableMfa.isPending}>
                  <ShieldOff aria-hidden="true" />
                  {t('preferences.mfa.disableSubmit')}
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
