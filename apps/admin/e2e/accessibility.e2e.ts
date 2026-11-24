import { expect, test } from '@playwright/test';
import { expectAccessible, signInAsOperator } from './support';

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('the sign-in page meets WCAG AA', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
      await expectAccessible(page);
    });

    test('console pages meet WCAG AA', async ({ page }) => {
      await signInAsOperator(page);
      for (const path of [
        '/console',
        '/console/users',
        '/console/audit',
        '/console/settings',
        '/console/organizations',
        '/console/notifications',
        '/console/preferences',
        '/console/does-not-exist',
      ]) {
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        await expectAccessible(page);
      }
    });

    test('the destructive confirmation dialog meets WCAG AA', async ({ page }) => {
      await signInAsOperator(page);
      await page.goto('/console/users');
      await page.getByRole('button', { name: /^Actions for / }).first().click();
      await page.getByRole('menuitem', { name: 'Disable' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('button', { name: 'Disable', exact: true })).toBeVisible();
      await expectAccessible(page);
      await dialog.getByRole('button', { name: 'Cancel' }).click();
    });

    test('the open command palette meets WCAG AA', async ({ page }) => {
      await signInAsOperator(page);
      await page.keyboard.press('ControlOrMeta+k');
      await expect(page.getByRole('combobox')).toBeFocused();
      await expectAccessible(page);
    });
  });
}
