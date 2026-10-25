import { Languages, Monitor, MonitorCog, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/layout/section-card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { changeLocale } from '@/i18n';
import type { SupportedLocale } from '@/i18n/resources';
import {
  type ThemePreference,
  usePreferencesStore,
} from '@/features/preferences/store/preferences-store';

const themes = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const satisfies readonly { value: ThemePreference; icon: typeof Sun }[];

export function PreferencesPage() {
  const { t, i18n } = useTranslation();
  const theme = usePreferencesStore((state) => state.theme);
  const setTheme = usePreferencesStore((state) => state.setTheme);

  return (
    <div className="page-stack">
      <header className="page-header">
        <p className="page-eyebrow">{t('preferences.eyebrow')}</p>
        <h1>{t('preferences.title')}</h1>
        <p>{t('preferences.description')}</p>
      </header>

      <div className="content-grid">
        <SectionCard
          icon={MonitorCog}
          titleId="appearance-title"
          title={t('preferences.appearanceTitle')}
          description={t('preferences.appearanceDescription')}
        >
          <Label id="theme-label" className="mb-2 block">
            {t('preferences.theme')}
          </Label>
          <ToggleGroup
            type="single"
            className="segmented-control"
            aria-labelledby="theme-label"
            value={theme}
            onValueChange={(value) => {
              if (value) setTheme(value as ThemePreference);
            }}
          >
            {themes.map(({ value, icon: Icon }) => (
              <ToggleGroupItem key={value} value={value}>
                <Icon aria-hidden="true" />
                {t(`preferences.${value}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </SectionCard>

        <SectionCard
          icon={Languages}
          titleId="language-title"
          title={t('preferences.languageTitle')}
          description={t('preferences.languageDescription')}
        >
          <Label htmlFor="locale" className="mb-2 block">
            {t('preferences.language')}
          </Label>
          <Select
            value={i18n.language}
            onValueChange={(value) => void changeLocale(value as SupportedLocale)}
          >
            <SelectTrigger id="locale">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en-US">{t('preferences.english')}</SelectItem>
              <SelectItem value="zh-Hans">{t('preferences.chinese')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-3 text-xs text-subtle">{t('preferences.storageNote')}</p>
        </SectionCard>
      </div>
    </div>
  );
}
