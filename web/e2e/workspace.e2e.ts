import { expect, test } from '@playwright/test';
import { registerMember } from './support';

test('a new member creates an organization and manages a webhook endpoint', async ({ page }) => {
  const { id } = await registerMember(page);
  const organization = `E2E Org ${id}`;

  await page.goto('/console/organizations');
  await page.getByRole('button', { name: 'Create organization' }).first().click();
  const createDialog = page.getByRole('dialog');
  await createDialog.getByLabel('Organization name').fill(organization);
  await createDialog.getByRole('button', { name: 'Create organization' }).click();
  await expect(page).toHaveURL(/\/console\/organizations\/\d+/);
  await expect(page.getByText(organization).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Members' }).click();
  await expect(page.getByRole('tabpanel').getByText('E2E Member')).toBeVisible();

  await page.getByRole('tab', { name: 'Webhooks' }).click();
  await page.getByRole('button', { name: 'Create endpoint' }).first().click();
  const endpointDialog = page.getByRole('dialog');
  await endpointDialog.getByLabel('Name').fill('E2E endpoint');
  // An IP literal needs no DNS, and `make dev` allows private targets.
  await endpointDialog.getByLabel('Target URL').fill('https://127.0.0.1:9/fastbuild');
  await endpointDialog.getByRole('checkbox').first().check();
  await endpointDialog.getByRole('button', { name: 'Create endpoint' }).click();

  // The signing secret is shown exactly once, then only the endpoint remains.
  await expect(page.getByRole('textbox', { name: 'Signing secret' })).not.toHaveValue('');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('cell', { name: /E2E endpoint/ })).toBeVisible();
});

test('a member creates an API key, sees it once, and revokes it', async ({ page }) => {
  await registerMember(page);
  await page.goto('/console/settings');
  await page.getByRole('tab', { name: 'API' }).click();

  await page.getByRole('button', { name: 'Create key' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('E2E key');
  await dialog.getByLabel('Scopes').fill('reports:read');
  await dialog.getByRole('button', { name: 'Create key' }).click();
  await expect(dialog.getByLabel('API key')).toHaveValue(/^fastbuild_/);
  await dialog.getByRole('button', { name: 'Done' }).click();

  const row = page.getByRole('row', { name: /E2E key/ });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Revoke' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Revoke' }).click();
  await expect(row.getByText('Revoked')).toBeVisible();
});

test('a member uploads an asset and deletes it', async ({ page }) => {
  await registerMember(page);
  await page.goto('/console/assets');

  // A 1x1 PNG, so the content inspection sees a real image.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/AAAMBAQAY3Y2wAAAAAElFTkSuQmCC',
    'base64'
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'e2e-pixel.png', mimeType: 'image/png', buffer: png });

  const row = page.getByRole('row', { name: /e2e-pixel\.png/ });
  await expect(row.getByText('Ready')).toBeVisible({ timeout: 15_000 });
  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete asset' }).click();
  await expect(row).toHaveCount(0);
});

test('a member reads a usage summary', async ({ page }) => {
  await registerMember(page);
  await page.goto('/console/usage');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveCount(0);
});
