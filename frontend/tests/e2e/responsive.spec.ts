import { test, expect } from '@playwright/test';
import { mockApi } from './mockApi';

const viewports = [
  { name: '1440px', width: 1440, height: 900 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '768px', width: 768, height: 1024 },
  { name: '375px', width: 375, height: 667 },
];

const paths = [
  '/products',
  '/products/new',
  '/products/12',
  '/products/12/edit',
  '/warehouses',
];

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

for (const vp of viewports) {
  test(`no page-level horizontal overflow at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasOverflow, `Overflow detected on ${path} at ${vp.name}`).toBeFalsy();
    }
  });
}

test('warehouse dialog keyboard focus trap, Esc close, and focus restore', async ({ page }) => {
  await page.goto('/warehouses');
  const newWarehouseBtn = page.getByRole('button', { name: 'New warehouse' });
  await newWarehouseBtn.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Esc closes dialog
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Focus restored
  await expect(newWarehouseBtn).toBeFocused();
});

test('location dialog keyboard focus trap, Esc close, and focus restore', async ({ page }) => {
  await page.goto('/warehouses');
  const locBtn = page.getByRole('button', { name: 'Locations for Main Warehouse' });
  await locBtn.click();
  await expect(page.getByRole('heading', { name: 'Main Warehouse locations' })).toBeVisible();

  const newLocBtn = page.getByRole('button', { name: 'New location' });
  await newLocBtn.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Esc closes dialog
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  // Focus restored
  await expect(newLocBtn).toBeFocused();
});
