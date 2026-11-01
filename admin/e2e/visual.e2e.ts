import { expect, test } from '@playwright/test';
import { signInAsOperator } from './support';

// Baselines are rendered on the CI runner, because fonts and antialiasing differ per platform.
// Refresh them with the End-to-End workflow's `update_snapshots` input.
test.skip(process.platform !== 'linux', 'Screenshot baselines exist for the CI runner only.');

const auditPage = {
  code: 0,
  message: 'success',
  data: [
    {
      id: 2,
      created_at: '2026-01-15T09:30:00Z',
      user_id: 1,
      actor_type: 'user',
      action: 'store',
      resource: 'operator.session',
      method: 'POST',
      path: '/v1/operator/session',
      status_code: 201,
      request_id: 'visual-request-id',
      result: 'success',
    },
    {
      id: 1,
      created_at: '2026-01-15T09:00:00Z',
      actor_type: 'system',
      action: 'grant',
      resource: 'platform_operators',
      method: 'CLI',
      path: 'operator:grant',
      status_code: 200,
      result: 'success',
    },
  ],
  meta: { per_page: 50, has_more: false, next_cursor: null },
};

const viewports = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

for (const colorScheme of ['light', 'dark'] as const) {
  for (const [device, viewport] of Object.entries(viewports)) {
    test.describe(`${colorScheme} ${device}`, () => {
      test.use({ colorScheme, viewport, reducedMotion: 'reduce', timezoneId: 'UTC' });

      test('sign-in', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
        await expect(page).toHaveScreenshot(`sign-in-${colorScheme}-${device}.png`);
      });

      test('audit log with an open row', async ({ page }) => {
        await page.route('**/v1/operator/audit-logs*', (route) => route.fulfill({ json: auditPage }));
        await signInAsOperator(page);
        await page.goto('/console/audit');
        await page.getByRole('button', { name: 'Show details for store' }).click();
        await expect(page.getByText('visual-request-id').first()).toBeVisible();
        await expect(page).toHaveScreenshot(`audit-${colorScheme}-${device}.png`, {
          fullPage: true,
        });
      });

      test('page not found', async ({ page }) => {
        await signInAsOperator(page);
        await page.goto('/console/does-not-exist');
        await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
        await expect(page).toHaveScreenshot(`not-found-${colorScheme}-${device}.png`);
      });
    });
  }
}
