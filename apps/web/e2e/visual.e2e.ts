import { expect, test } from '@playwright/test';
import { prepareForScreenshot, signIn } from './support';

// Baselines are rendered on the CI runner, because fonts and antialiasing differ per platform.
// Refresh them with the End-to-End workflow's `update_snapshots` input.
test.skip(process.platform !== 'linux', 'Screenshot baselines exist for the CI runner only.');

const viewports = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
};

for (const colorScheme of ['light', 'dark'] as const) {
  for (const [device, viewport] of Object.entries(viewports)) {
    test.describe(`${colorScheme} ${device}`, () => {
      test.use({ colorScheme, viewport, reducedMotion: 'reduce', timezoneId: 'UTC' });

      for (const path of ['login', 'register']) {
        test(path, async ({ page }) => {
          await page.goto(`/${path}`);
          await expect(page.getByRole('button', { name: /Sign (In|Up)/ })).toBeVisible();
          await prepareForScreenshot(page);
          await expect(page).toHaveScreenshot(`${path}-${colorScheme}-${device}.png`, {
            // The copyright year changes every January.
            mask: [page.getByText(/© \d{4}/)],
          });
        });
      }

      test('organization directory', async ({ page }) => {
        await signIn(page, 'user@example.com', 'secret');
        await expect(page).toHaveURL(/\/console$/);
        await page.goto('/console/organizations');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByText('No organizations yet')).toBeVisible();
        await prepareForScreenshot(page);
        await expect(page).toHaveScreenshot(`organizations-${colorScheme}-${device}.png`, {
          // The avatar is generated, so it is not part of the page under test.
          mask: [page.getByRole('button', { name: 'Profile', exact: true })],
        });
      });
    });
  }
}
