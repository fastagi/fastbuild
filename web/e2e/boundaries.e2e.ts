import { expect, test } from '@playwright/test';
import { registerMember } from './support';

test('an organization the member cannot see shows a retryable error in the console', async ({
  page,
}) => {
  await registerMember(page);
  await page.goto('/console/organizations/999999999');
  await expect(page.getByText('The organization does not exist')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Organizations' })).toBeVisible();
});

test('a signed-out visitor is sent to sign-in from every console page', async ({ page }) => {
  for (const path of ['/console/organizations', '/console/assets', '/console/settings']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
  }
});

test('devtools stay reachable in development builds', async ({ page }) => {
  await registerMember(page);
  const response = await page.goto('/styleguide');
  expect(response?.status()).toBe(200);
});
