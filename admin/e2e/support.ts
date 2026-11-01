import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

// Accounts created by the API seeders that `make dev` runs; `make dev` grants admin@ the operator role.
export const operator = { identifier: 'admin@example.com', password: 'secret' };
export const member = { identifier: 'user@example.com', password: 'secret' };

export async function signIn(page: Page, account: { identifier: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Username or email').fill(account.identifier);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signInAsOperator(page: Page) {
  await signIn(page, operator);
  await expect(page).toHaveURL(/\/console/);
  // The palette shortcut and the header exist only once the console shell has mounted.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Fail on any WCAG 2 A or AA violation, listing each rule and the elements that broke it. */
export async function expectAccessible(page: Page) {
  // A fade-in measured midway would report contrast the settled page does not have.
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished)));
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    nodes: nodes.map((node) => {
      const contrast = node.any[0]?.data as { contrastRatio?: number; fgColor?: string; bgColor?: string } | undefined;
      return [node.target.join(' '), contrast?.contrastRatio, contrast?.fgColor, contrast?.bgColor]
        .filter(Boolean)
        .join(' ');
    }),
  }));
  expect(summary).toEqual([]);
}
