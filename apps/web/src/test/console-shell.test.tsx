import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GreetingClock } from '@/app/(protected)/(console)/console/_components/greeting-clock';
import ConsoleLayout from '@/app/(protected)/(console)/console/layout';
import { messages } from '@/i18n/modules';
import { CLIENT_MESSAGE_NAMESPACES } from '@/i18n/client-message-namespaces';
import { selectMessageNamespaces } from '@/i18n/message-selection';

const state = vi.hoisted(() => ({
  user: { id: '1', email: 'ada@example.com', name: 'Ada Lovelace' } as {
    id: string;
    email: string;
    name: string;
  } | null,
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/console/assets' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('@/config/features', () => ({
  // The shell's lazy feature widgets are not under test; the navigation entries are.
  isWebFeatureEnabled: (feature: string) => feature === 'asset' || feature === 'usage',
}));
vi.mock('@/features/auth/hooks/use-auth', () => ({
  useLogout: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/features/auth/store/auth-store', () => ({
  useAuthStore: { use: { user: () => state.user } },
}));
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/hooks/use-locale', () => ({
  useLocale: () => ({ locale: 'en-US', setLocale: vi.fn(), isPending: false }),
}));

function withMessages(children: React.ReactNode) {
  return (
    <NextIntlClientProvider
      locale="en-US"
      messages={selectMessageNamespaces(messages, [
        ...CLIENT_MESSAGE_NAMESPACES.global,
        ...CLIENT_MESSAGE_NAMESPACES.console,
      ])}
    >
      {children}
    </NextIntlClientProvider>
  );
}

function consoleSource(path: string): string {
  return readFileSync(
    resolve(process.cwd(), 'src/app/(protected)/(console)/console', path),
    'utf8'
  );
}

describe('console shell', () => {
  beforeEach(() => {
    state.user = { id: '1', email: 'ada@example.com', name: 'Ada Lovelace' };
  });

  it('opens the same navigation on phones, with locale and return-to-site', async () => {
    render(withMessages(<ConsoleLayout>content</ConsoleLayout>));

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const menu = await screen.findByRole('dialog', { name: 'FastBuild Console' });

    for (const name of ['Console', 'Assets', 'Usage', 'Settings', 'Return to site']) {
      expect(within(menu).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(menu).getByRole('link', { name: 'Assets' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(menu).getByRole('button', { name: 'Toggle language' })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('link', { name: 'Usage' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows initials instead of a shared picture, and keeps the control name', () => {
    render(withMessages(<ConsoleLayout>content</ConsoleLayout>));

    const trigger = screen.getByRole('button', { name: 'Profile' });
    expect(trigger).toHaveTextContent('AL');
    expect(trigger.querySelector('img')).toBeNull();
  });

  it('links Settings from the user menu and offers no Profile item', async () => {
    render(withMessages(<ConsoleLayout>content</ConsoleLayout>));

    const trigger = screen.getByRole('button', { name: 'Profile' });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    const menu = await screen.findByRole('menu');

    expect(within(menu).getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/console/settings'
    );
    expect(within(menu).queryByRole('menuitem', { name: 'Profile' })).not.toBeInTheDocument();
    expect(within(menu).getByText('ada@example.com')).toBeInTheDocument();
  });

  it('routes unknown console paths to the not-found page inside the shell', () => {
    expect(consoleSource('[...slug]/page.tsx')).toMatch(/notFound\(\)/);
  });

  it('keeps the setup notes behind the devtools check', () => {
    const page = consoleSource('page.tsx');

    expect(page.indexOf('devtoolsEnabled ? (')).toBeGreaterThan(-1);
    expect(page.indexOf('devtoolsEnabled ? (')).toBeLessThan(page.indexOf('NEXT_PUBLIC_API_URL'));
  });
});

describe('console greeting', () => {
  it('greets the signed-in user from the auth store', () => {
    render(withMessages(<GreetingClock />));
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
  });

  it('falls back to the email, then to the generic name', () => {
    state.user = { id: '1', email: 'ada@example.com', name: '' };
    const { unmount } = render(withMessages(<GreetingClock />));
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument();
    unmount();

    state.user = null;
    render(withMessages(<GreetingClock />));
    expect(screen.getByText(/there/)).toBeInTheDocument();
  });
});
