import Link from 'next/link';
import { Activity, ArrowUpRight, Code2, KeyRound, Rocket } from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/common';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isDevtoolsEnabled } from '@/config/devtools';
import { ROUTES } from '@/constants/routes';
import { getT } from '@/i18n/server';

import { GreetingClock } from './_components/greeting-clock';

/**
 * Console home (RSC).
 *
 * Default landing for authenticated users. Kept deliberately minimal —
 * this is a scaffold example, not a product. Replace with your real
 * domain UI.
 *
 * Pattern: page is a Server Component; the only client island is
 * `GreetingClock` which re-renders the wall-clock every minute.
 */
export default async function ConsoleHomePage() {
  const t = await getT('console');
  const devtoolsEnabled = isDevtoolsEnabled();

  const quickLinks = [
    {
      title: t('home.quickLinks.apiAccess.title'),
      description: t('home.quickLinks.apiAccess.description'),
      href: ROUTES.CONSOLE.SETTINGS,
      icon: KeyRound,
    },
    ...(devtoolsEnabled
      ? [
          {
            title: t('home.quickLinks.styleguide.title'),
            description: t('home.quickLinks.styleguide.description'),
            href: ROUTES.DEVTOOLS.STYLEGUIDE,
            icon: Code2,
          },
          {
            title: t('home.quickLinks.i18nTest.title'),
            description: t('home.quickLinks.i18nTest.description'),
            href: ROUTES.DEVTOOLS.I18N_TEST,
            icon: Activity,
          },
        ]
      : []),
  ];

  return (
    <PageContainer>
      <PageHeader
        title={<GreetingClock />}
        description={t('home.welcomeDescription')}
        actions={
          <Button asChild variant="outline">
            <Link href={ROUTES.SITE.HOME}>
              {t('returnToSite')}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map(({ title, description, href, icon: Icon }) => (
          <Card
            key={href}
            className="group relative transition-colors hover:border-primary/40 has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50"
          >
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">
                  {/* The stretched link makes the whole card one target with one accessible name. */}
                  <Link
                    href={href}
                    className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
                  >
                    {title}
                  </Link>
                </CardTitle>
                <CardDescription className="mt-1">{description}</CardDescription>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon aria-hidden="true" className="h-4.5 w-4.5" />
              </div>
            </CardHeader>
            <CardContent>
              <span
                aria-hidden="true"
                className="inline-flex items-center gap-1 text-xs font-medium text-text-subtle transition-colors group-hover:text-primary"
              >
                {t('home.open')}
                <ArrowUpRight className="size-3.5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      {devtoolsEnabled ? (
        <section className="mt-10 rounded-xl border bg-bg-surface p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Rocket aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{t('home.nextSteps')}</h2>
              <ul className="mt-2 space-y-1 text-sm wrap-anywhere text-text-muted">
                <li>
                  {t('home.steps.apiBefore')}{' '}
                  <code className="font-mono text-xs">NEXT_PUBLIC_API_URL</code>{' '}
                  {t('home.steps.apiAfter')}
                </li>
                <li>
                  {t('home.steps.replaceBefore')}
                  <code className="font-mono text-xs">
                    src/app/(protected)/(console)/console/page.tsx
                  </code>
                  {t('home.steps.replaceAfter')}
                </li>
                <li>
                  {t('home.steps.featuresBefore')}{' '}
                  <code className="font-mono text-xs">src/features/</code>{' '}
                  {t('home.steps.featuresBetween')}{' '}
                  <code className="font-mono text-xs">(protected)/(console)/</code>
                  {t('home.steps.featuresAfter')}
                </li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}
