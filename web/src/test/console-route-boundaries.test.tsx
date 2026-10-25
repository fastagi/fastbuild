import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ConsoleError from '@/app/(protected)/(console)/console/error';
import { ApiErrorCode } from '@/http/codes';
import { ApiError } from '@/http/request';
import { CLIENT_MESSAGE_NAMESPACES } from '@/i18n/client-message-namespaces';
import { selectMessageNamespaces } from '@/i18n/message-selection';
import { messages } from '@/i18n/modules';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const consoleDirectory = resolve(process.cwd(), 'src/app/(protected)/(console)/console');

function readConsoleSource(path: string): string {
  return readFileSync(resolve(consoleDirectory, path), 'utf8');
}

// The boundary only receives what the console route group serializes to the client.
function renderBoundary(error: Error & { digest?: string }, retry = vi.fn()) {
  render(
    <NextIntlClientProvider
      locale="en-US"
      messages={selectMessageNamespaces(messages, [
        ...CLIENT_MESSAGE_NAMESPACES.global,
        ...CLIENT_MESSAGE_NAMESPACES.console,
      ])}
    >
      <ConsoleError error={error} retry={retry} />
    </NextIntlClientProvider>
  );
  return retry;
}

describe('console route boundaries', () => {
  afterEach(() => {
    replace.mockReset();
    vi.restoreAllMocks();
  });

  it('shows translated copy and the API request id instead of the upstream message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = renderBoundary(
      new ApiError('database exploded', ApiErrorCode.COMMON_INTERNAL, 500, 'req_123')
    );

    expect(screen.getByRole('alert')).toHaveTextContent('This console page could not be loaded');
    expect(screen.getByText('Request ID: req_123')).toBeInTheDocument();
    expect(screen.queryByText('database exploded')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to console' })).toHaveAttribute(
      'href',
      '/console'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('falls back to the server error digest for Server Component failures', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderBoundary(Object.assign(new Error('An error occurred'), { digest: '4041' }));

    expect(screen.getByText('Error reference: 4041')).toBeInTheDocument();
  });

  it('sends an expired session to sign-in instead of rendering the boundary', async () => {
    renderBoundary(new ApiError('Unauthorized', ApiErrorCode.AUTH_UNAUTHORIZED, 401));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login?returnUrl=%2F'));
  });

  it('keeps loading and not-found as server conventions inside the console shell', () => {
    const error = readConsoleSource('error.tsx');
    const loading = readConsoleSource('loading.tsx');
    const notFound = readConsoleSource('not-found.tsx');

    expect(error).toMatch(/^\s*['"]use client['"];?/);
    expect(error).toContain('onClick={() => retry()}');
    for (const source of [loading, notFound]) {
      expect(source).not.toMatch(/['"]use client['"]/);
    }
    expect(loading).toContain("from '@/i18n/server'");
    expect(notFound).toContain("from '@/i18n/server'");
  });
});
