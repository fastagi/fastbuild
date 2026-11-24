import { RotateCcw, Save, SlidersHorizontal, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { SectionCard } from '@/components/layout/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Switch } from '@/components/ui/switch';
import {
  useAppSettings,
  useChangeAppSetting,
} from '@/features/app-settings/hooks/use-app-settings';
import { isInactiveStarter, settingErrorKey } from '@/features/app-settings/setting-errors';
import type { AppSetting, AppSettingValue } from '@/features/app-settings/types';
import { cn } from '@/lib/cn';

/** What the operator has typed or picked; integers stay text so an empty field stays empty. */
type Draft = string | boolean;

function draftFromValue(value: AppSettingValue): Draft {
  return typeof value === 'boolean' ? value : String(value);
}

function parseInteger(draft: Draft): number | undefined {
  const text = String(draft).trim();
  const value = Number(text);
  return text !== '' && Number.isInteger(value) ? value : undefined;
}

function SettingEditor({ setting }: { setting: AppSetting }) {
  const { t } = useTranslation();
  const change = useChangeAppSetting();
  // Null means untouched, so the row follows refetches until the operator edits it, and an edit
  // outlives a refetch (a version conflict refetches the setting the operator is still editing).
  const [draft, setDraft] = useState<Draft | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const current = draft ?? draftFromValue(setting.value);
  const parsed = setting.kind === 'integer' ? parseInteger(current) : current;
  const dirty = draft !== null && parsed !== setting.value;
  const display = (value: Draft) =>
    typeof value === 'boolean'
      ? value
        ? t('settings.on')
        : t('settings.off')
      : value === ''
        ? t('settings.emptyValue')
        : value;

  const edit = (next: Draft) => {
    setDraft(next);
    setInvalid(false);
  };

  const discard = () => {
    setDraft(null);
    setInvalid(false);
    change.reset();
  };

  const save = () => {
    if (parsed === undefined) {
      setInvalid(true);
      return;
    }
    change.mutate(
      { kind: 'set', key: setting.key, value: parsed, version: setting.version },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success(t('settings.saved', { key: setting.key }));
        },
      },
    );
  };

  const reset = () => {
    change.mutate(
      { kind: 'reset', key: setting.key, version: setting.version },
      {
        onSuccess: () => {
          setDraft(null);
          setInvalid(false);
          toast.success(t('settings.resetDone', { key: setting.key }));
        },
        onSettled: () => setConfirmingReset(false),
      },
    );
  };

  let control;
  if (setting.kind === 'boolean') {
    control = (
      <div className="flex h-9 items-center gap-2">
        <Switch
          aria-label={setting.key}
          checked={current === true}
          onCheckedChange={(checked) => edit(checked)}
        />
        <span className="text-sm text-muted-foreground">
          {current === true ? t('settings.on') : t('settings.off')}
        </span>
      </div>
    );
  } else if (setting.kind === 'enum') {
    control = (
      <Select value={String(current)} onValueChange={(value) => edit(value)}>
        <SelectTrigger aria-label={setting.key}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(setting.options ?? []).map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else {
    control = (
      <Input
        aria-label={setting.key}
        aria-invalid={invalid || undefined}
        type={setting.kind === 'integer' ? 'number' : 'text'}
        value={String(current)}
        onChange={(event) => edit(event.target.value)}
      />
    );
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-2 border-b px-4 py-3 transition-colors last:border-0 md:flex-row md:flex-wrap md:items-start',
        dirty && 'bg-brand-subtle/60',
      )}
    >
      <div className="min-w-0 md:w-1/3">
        <code className="text-sm font-medium">{setting.key}</code>
        <div className="mt-1 flex flex-wrap gap-1">
          {setting.source === 'override' ? (
            <StatusBadge tone="brand">{t('settings.source.override')}</StatusBadge>
          ) : (
            <Badge variant="secondary" className="font-medium">
              {t('settings.source.default')}
            </Badge>
          )}
          <Badge variant="outline" className="font-medium text-muted-foreground">
            {t('settings.version', { version: setting.version })}
          </Badge>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {control}
        {dirty ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-xs break-words text-brand-strong" aria-live="polite">
              {t('settings.unsaved', {
                from: display(draftFromValue(setting.value)),
                to: display(current),
              })}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={change.isPending}
                onClick={discard}
              >
                <Undo2 aria-hidden="true" />
                {t('settings.discard')}
              </Button>
              <Button
                type="button"
                size="sm"
                loading={change.isPending && change.variables?.kind === 'set'}
                disabled={change.isPending}
                onClick={save}
              >
                <Save aria-hidden="true" />
                {t('settings.save')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      {setting.source === 'override' ? (
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="self-start md:mt-0.5"
            disabled={change.isPending}
            onClick={() => setConfirmingReset(true)}
          >
            <RotateCcw aria-hidden="true" />
            {t('settings.reset')}
          </Button>
          <Dialog
            open={confirmingReset}
            onOpenChange={(open) => {
              if (!change.isPending) {
                setConfirmingReset(open);
              }
            }}
          >
            <DialogContent>
              <DialogTitle className="leading-snug break-words">
                {t('settings.resetConfirm.title', { key: setting.key })}
              </DialogTitle>
              <DialogDescription className="break-words">
                {t('settings.resetConfirm.description', {
                  value: display(draftFromValue(setting.value)),
                })}
              </DialogDescription>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={change.isPending}>
                    {t('common.cancel')}
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="destructive"
                  loading={change.isPending}
                  onClick={reset}
                >
                  <RotateCcw aria-hidden="true" />
                  {t('settings.reset')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      {invalid ? (
        <p role="alert" className="text-sm text-destructive md:basis-full">
          {t('settings.errors.invalid')}
        </p>
      ) : change.isError ? (
        <p role="alert" className="text-sm text-destructive md:basis-full">
          {t(settingErrorKey(change.error))}
        </p>
      ) : null}
    </li>
  );
}

export function AppSettingsPage() {
  const { t } = useTranslation();
  const settings = useAppSettings();

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="page-eyebrow">{t('settings.eyebrow')}</p>
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.description')}</p>
      </header>
      <SectionCard
        icon={SlidersHorizontal}
        titleId="settings-title"
        title={t('settings.listTitle')}
        description={t('settings.concurrencyNote')}
        contentClassName="p-0"
      >
        {settings.isPending ? (
          <div className="flex flex-col gap-2 p-4" aria-busy="true">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : settings.isError ? (
          <p role="alert" className="p-4 text-sm text-muted-foreground">
            {isInactiveStarter(settings.error)
              ? t('settings.inactive')
              : t('settings.errors.unavailable')}
          </p>
        ) : settings.data.length === 0 ? (
          <EmptyState>{t('settings.empty')}</EmptyState>
        ) : (
          <ul>
            {settings.data.map((setting) => (
              <SettingEditor key={setting.key} setting={setting} />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
