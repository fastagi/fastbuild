import { expect, test } from '@playwright/test';
import { expectAccessible, registerMember } from './support';

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('sign-in and registration meet WCAG AA', async ({ page }) => {
      for (const path of ['/login', '/register']) {
        await page.goto(path);
        await expect(page.getByRole('button', { name: /Sign (In|Up)/ })).toBeVisible();
        await expectAccessible(page);
      }
    });

    test('console pages meet WCAG AA', async ({ page }) => {
      await registerMember(page);
      for (const path of [
        '/console',
        '/console/organizations',
        '/console/assets',
        '/console/usage',
        '/console/settings',
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading').first()).toBeVisible();
        await expectAccessible(page);
      }
    });
  });
}
