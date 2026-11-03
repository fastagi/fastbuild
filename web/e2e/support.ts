import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Register a fresh account so a flow never depends on what earlier runs left in the database. */
export async function registerMember(page: Page) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${id}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Full Name').fill('E2E Member');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('E2e-Passw0rd!');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page).toHaveURL(/\/console$/);
  return { id, email };
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

/**
 * Remove what a screenshot must not depend on. The Next.js overlay changes with compilation and
 * logged errors, and its zero-sized host cannot be masked, so development tools are hidden instead.
 */
export async function prepareForScreenshot(page: Page) {
  await page.addStyleTag({
    content: 'nextjs-portal, .tsqd-open-btn-container { display: none !important; }',
  });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** Fail on any WCAG 2 A or AA violation; the Next.js dev overlay is not part of the product. */
export async function expectAccessible(page: Page) {
  // A fade-in measured midway would report contrast the settled page does not have.
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map(a => a.finished)));
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('nextjs-portal')
    .analyze();
  const summary = violations.map(({ id, impact, nodes }) => ({
    id,
    impact,
    nodes: nodes.map(node => {
      const contrast = node.any[0]?.data as
        | { contrastRatio?: number; fgColor?: string; bgColor?: string }
        | undefined;
      return [node.target.join(' '), contrast?.contrastRatio, contrast?.fgColor, contrast?.bgColor]
        .filter(Boolean)
        .join(' ');
    }),
  }));
  expect(summary).toEqual([]);
}
