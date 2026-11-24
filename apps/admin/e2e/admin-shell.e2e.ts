import { expect, type Page, test } from '@playwright/test';
import { expectAccessible, signInAsOperator } from './support';

const override = {
  scope: 'app',
  key: 'branding.display_name',
  kind: 'string',
  visibility: 'public',
  value: 'Live Name',
  version: 3,
  source: 'override',
  updated_at: '2026-01-15T09:00:00Z',
};

async function stubOneOverride(page: Page) {
  await page.route('**/v1/operator/settings', (route) =>
    route.fulfill({ json: { code: 0, message: 'success', data: [override] } }),
  );
}

/** Holds the application bundle back so the assertions see what exists before React mounts. */
async function holdApplicationModule(page: Page) {
  await page.route(/\/src\/main\.tsx|\/assets\/index-[^/]+\.js/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    await route.continue();
  });
}

test.describe('first paint', () => {
  test('a dark system preference is applied before the application runs', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await holdApplicationModule(page);
    await page.goto('/login', { waitUntil: 'commit' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('#root')).toBeEmpty();
    await context.close();
  });

  test('a saved light theme wins over a dark system preference', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.addInitScript(() =>
      window.localStorage.setItem(
        'fastbuild-spa-preferences',
        JSON.stringify({ state: { sidebarOpen: true, theme: 'light' }, version: 0 }),
      ),
    );
    await holdApplicationModule(page);
    await page.goto('/login', { waitUntil: 'commit' });
    await page.locator('#root').waitFor({ state: 'attached' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await context.close();
  });
});

test('the theme-color tag follows the theme tokens', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', /^oklch\(/);
});

test('sign-in validates on submit without calling the API', async ({ page }) => {
  let requests = 0;
  await page.route('**/v1/operator/session', async (route) => {
    if (route.request().method() === 'POST') {
      requests += 1;
    }
    await route.continue();
  });
  await page.goto('/login');
  const submit = page.getByRole('button', { name: 'Sign in' });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.getByText('Enter your username or email.')).toBeVisible();
  await expect(page.getByLabel('Username or email')).toBeFocused();
  expect(requests).toBe(0);
});

test.describe('signed in', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsOperator(page);
  });

  test('an unknown console path keeps the shell and names itself', async ({ page }) => {
    await page.goto('/console/does-not-exist');
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(
      'Page not found',
    );
  });

  test('the search trigger stays on one line and the palette shows every group', async ({
    page,
  }) => {
    const trigger = page.getByRole('button', { name: /search commands/i });
    const label = trigger.locator('span');
    const { height } = (await label.boundingBox()) ?? { height: 0 };
    expect(height).toBeLessThanOrEqual(20);

    await page.keyboard.press('ControlOrMeta+k');
    const list = page.getByRole('listbox');
    const fits = await list.evaluate((node) => node.scrollHeight <= node.clientHeight);
    expect(fits).toBe(true);
  });

  test('the overview leads with what an operator acts on', async ({ page }) => {
    const summary = page.locator('.metric-grid');
    await expect(summary).toContainText('API');
    await expect(summary).toContainText('Database');
    await expect(summary).toContainText('Failed deliveries');
    await expect(summary).not.toContainText('OSS / CDN');
    const profile = page.getByRole('region', { name: 'Release profile' });
    await expect(profile).toContainText('OSS / CDN');
    await expect(profile).toContainText('Static browser');
  });

  test('settings show Save only after a change', async ({ page }) => {
    await page.goto('/console/settings');
    const input = page.getByLabel('branding.display_name');
    await expect(input).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
    await input.fill('Draft name');
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
  });

  test('resetting an override asks first', async ({ page }) => {
    await stubOneOverride(page);
    let deletes = 0;
    await page.route('**/v1/operator/settings/**', async (route) => {
      deletes += route.request().method() === 'DELETE' ? 1 : 0;
      await route.abort();
    });
    await page.goto('/console/settings');
    await page.getByRole('button', { name: 'Reset to default' }).click();
    await expect(page.getByRole('dialog')).toContainText('Live Name');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(deletes).toBe(0);
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test('the reset confirmation meets WCAG AA', async ({ page }) => {
      await stubOneOverride(page);
      await signInAsOperator(page);
      await page.goto('/console/settings');
      await page.getByRole('button', { name: 'Reset to default' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectAccessible(page);
    });
  });
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the navigation drawer is opaque', async ({ page }) => {
    await signInAsOperator(page);
    await page.getByRole('button', { name: 'Toggle sidebar' }).first().click();
    const drawer = page.locator('[data-mobile="true"]');
    await expect(drawer).toBeVisible();
    const alpha = await drawer.evaluate((node) => {
      const canvas = document.createElement('canvas').getContext('2d');
      if (!canvas) return 0;
      canvas.fillStyle = getComputedStyle(node).backgroundColor;
      canvas.fillRect(0, 0, 1, 1);
      return canvas.getImageData(0, 0, 1, 1).data[3];
    });
    expect(alpha).toBe(255);
  });

  test('needs attention sits above the status summary', async ({ page }) => {
    await signInAsOperator(page);
    const attention = await page.getByRole('region', { name: 'Needs attention' }).boundingBox();
    const summary = await page.locator('.metric-grid').boundingBox();
    expect(attention?.y ?? Infinity).toBeLessThan(summary?.y ?? 0);
  });
});
