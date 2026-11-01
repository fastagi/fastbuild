'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/features/auth/store/auth-store';
import { useT } from '@/i18n';

/**
 * Small client island for the console greeting + wall-clock.
 * Keeps the parent page a pure Server Component.
 *
 * The name comes from the auth store because it is resolved in every auth mode; the mock session
 * cookie exists only in mock mode.
 */
export function GreetingClock() {
  const [now, setNow] = useState<Date | null>(null);
  const locale = useLocale();
  const t = useT('console');
  const user = useAuthStore.use.user();

  useEffect(() => {
    const update = () => setNow(new Date());
    const firstTick = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 60_000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(interval);
    };
  }, []);

  const greetingKey = pickGreeting(now);
  const time = now?.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const name = user?.name || user?.email || t('home.defaultUser');

  return (
    <>
      {t(`greeting.${greetingKey}`, { name })}
      {time ? (
        <>
          {' '}
          <span className="mt-1 block text-base font-normal text-text-muted sm:mt-0 sm:ml-3 sm:inline sm:align-middle">
            {time}
          </span>
        </>
      ) : null}
    </>
  );
}

type GreetingKey = 'hello' | 'late' | 'morning' | 'afternoon' | 'evening';

function pickGreeting(now: Date | null): GreetingKey {
  if (!now) return 'hello';
  const h = now.getHours();
  if (h < 5) return 'late';
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
