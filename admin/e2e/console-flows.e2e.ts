import { expect, test } from '@playwright/test';
import { signInAsOperator } from './support';

test.beforeEach(async ({ page }) => {
  await signInAsOperator(page);
});

test('the command palette filters pages and navigates with the keyboard', async ({ page }) => {
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('combobox');
  await expect(search).toBeFocused();
  await search.fill('audit');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/console\/audit/);
  await expect(page.getByRole('heading', { level: 1, name: 'Audit log' })).toBeVisible();

  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('combobox')).toHaveCount(0);
});

test('an audit row expands to its details, and filter chips can be removed', async ({ page }) => {
  await page.goto('/console/audit');
  const toggle = page.getByRole('button', { name: /^Show details for/ }).first();
  await toggle.click();
  await expect(page.getByRole('button', { name: /^Hide details for/ })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(page.getByRole('term').filter({ hasText: 'Resource' })).toBeVisible();

  await page.getByLabel('Action', { exact: true }).fill('no-such-action');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('No audit entries match these filters.')).toBeVisible();
  await page.getByRole('button', { name: /^Remove .*Action.* filter$/ }).click();
  await expect(page.getByRole('button', { name: /^Show details for/ }).first()).toBeVisible();
  await expect(page).not.toHaveURL(/action=/);
});

test('users, settings, and deliveries load from the API', async ({ page }) => {
  await page.goto('/console/users');
  await expect(page.getByRole('cell').getByText(/^\S+@\S+$/).first()).toBeVisible();

  await page.goto('/console/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'App settings' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.goto('/console/notifications');
  await expect(page.getByRole('heading', { level: 1, name: 'Notification deliveries' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('an unknown route and an unknown organization explain themselves', async ({ page }) => {
  await page.goto('/console/does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to console' }).click();
  await expect(page).toHaveURL(/\/console\/?$/);

  await page.goto('/console/organizations/999999999');
  await expect(page.getByRole('alert')).toContainText('does not exist');
});

test('a failed session check shows the route error page, and retry recovers', async ({ page }) => {
  let failing = true;
  await page.route('**/v1/operator/session', async (route) => {
    if (failing && route.request().method() === 'GET') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 500,
          message: 'failed',
          error_code: 'COMMON.INTERNAL_ERROR',
          request_id: 'e2e-request-id',
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/console/users');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('e2e-request-id')).toBeVisible();

  failing = false;
  await page.getByRole('button', { name: /try again|retry/i }).click();
  await expect(page.getByRole('cell').getByText(/^\S+@\S+$/).first()).toBeVisible();
});

test('the theme preference applies and survives a reload', async ({ page }) => {
  await page.goto('/console/preferences');
  await page.getByRole('radio', { name: /dark/i }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('radio', { name: /light/i }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});
