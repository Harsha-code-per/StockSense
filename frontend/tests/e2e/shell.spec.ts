import { test, expect } from '@playwright/test';

test('shell navigation, keyboard focus, and reduced motion', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  if (testInfo.project.name !== 'desktop') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Open navigation' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Open navigation' }).click();
  }
  const nav = page.getByRole('navigation', { name: 'Main navigation' }).last();
  for (const label of [
    'Dashboard',
    'Products',
    'Receipts',
    'Deliveries',
    'Transfers',
    'Adjustments',
    'Move history',
    'Warehouses',
    'Profile',
  ]) {
    await expect(
      nav.getByRole('link', { name: label, exact: true }),
    ).toBeVisible();
  }
  expect(
    await nav
      .getByRole('link', { name: 'Products', exact: true })
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe('0s');
  await page.screenshot({
    path: testInfo.outputPath('shell.png'),
    fullPage: true,
  });
  await nav.getByRole('link', { name: 'Receipts', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Receipts', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
