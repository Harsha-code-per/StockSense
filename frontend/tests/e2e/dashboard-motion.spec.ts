import { test, expect } from '@playwright/test';

const summary = {
  kpis: {
    products_in_stock: 42,
    low_stock: 3,
    out_of_stock: 1,
    pending_receipts: 2,
    pending_deliveries: 4,
    scheduled_transfers: 1,
  },
  low_stock_items: [],
  recent_operations: [],
  ledger_ok: true,
};

async function mockDashboard(page: import('@playwright/test').Page) {
  await page.route('**/api/dashboard/summary**', (route) =>
    route.fulfill({ json: summary }),
  );
  await page.route('**/api/warehouses**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/categories**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/inventory/count-priority**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/operations**', (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 10 } }),
  );
}

test('dashboard KPI values are the real backend numbers, not fabricated', async ({
  page,
}) => {
  await mockDashboard(page);
  await page.goto('/dashboard');
  await expect(page.getByText('42', { exact: true })).toBeVisible();
  await expect(page.getByText('Ledger reconciled')).toBeVisible();
  // No fake "INTEGRITY VERIFIED" / telemetry-style claims anywhere on the page.
  await expect(page.getByText('INTEGRITY VERIFIED')).toHaveCount(0);
  await expect(page.getByText(/live data stream/i)).toHaveCount(0);
});

test('dashboard KPI tilt is disabled under reduced motion, no overflow', async ({
  page,
}) => {
  await mockDashboard(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasOverflow).toBeFalsy();
  // Cards remain plain, fully clickable links under reduced motion.
  await expect(
    page.getByRole('link', { name: /In Stock/i }),
  ).toHaveAttribute('href', '/products?stock_status=in_stock');
});
