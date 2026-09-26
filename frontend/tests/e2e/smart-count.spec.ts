import { test, expect } from '@playwright/test';

const countPriority = [
  {
    product_id: 12,
    sku: 'STL001',
    product_name: 'Steel Rod',
    uom: 'kg',
    location_id: 4,
    location_name: 'WH/Production Floor',
    quantity: '17.000',
    last_counted_at: null,
    days_since_count: 3,
    movements_since_count: 7,
    past_discrepancies: 0,
    score: 18,
    level: 'low',
    reasons: ['Never counted (first movement 3 days ago)', '7 movements since last count'],
  },
  {
    product_id: 15,
    sku: 'CPR014',
    product_name: 'Copper Wire',
    uom: 'kg',
    location_id: 2,
    location_name: 'WH/Rack A',
    quantity: '4.000',
    last_counted_at: '2026-08-01T00:00:00Z',
    days_since_count: 40,
    movements_since_count: 22,
    past_discrepancies: 2,
    score: 78,
    level: 'high',
    reasons: ['40 days since last count', '2 past discrepancies recorded'],
  },
];

async function mockAdjustments(page: import('@playwright/test').Page) {
  await page.route('**/api/inventory/count-priority**', (route) =>
    route.fulfill({ json: countPriority }),
  );
  await page.route('**/api/operations**', (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } }),
  );
  await page.route('**/api/locations**', (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route('**/api/products**', (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } }),
  );
}

test('risk map renders real count-priority data, not hardcoded SKUs', async ({
  page,
}) => {
  await mockAdjustments(page);
  await page.goto('/operations/adjustments');
  await expect(page.getByText('STL001').first()).toBeVisible();
  await expect(page.getByText('CPR014').first()).toBeVisible();
  // The fabricated prototype SKUs must never appear.
  await expect(page.getByText('RAW-STL-01')).toHaveCount(0);
  await expect(page.getByText('ALGORITHM: RISK_WEIGHT_V2')).toHaveCount(0);
});

test('selecting a cell reveals the backend reasons, keyboard-reachable', async ({
  page,
}) => {
  await mockAdjustments(page);
  await page.goto('/operations/adjustments');
  const highRiskCell = page.getByRole('button', { name: /CPR014/ });
  await highRiskCell.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('40 days since last count')).toBeVisible();
  await expect(page.getByText('2 past discrepancies recorded')).toBeVisible();
});

test('start count goes through the real adjustment form, no fake commit', async ({
  page,
}) => {
  await mockAdjustments(page);
  await page.goto('/operations/adjustments');
  await page.getByRole('link', { name: /Start count/ }).click();
  await expect(page).toHaveURL(/\/operations\/adjustments\/new$/);
  await expect(
    page.getByRole('heading', { name: 'New adjustment' }),
  ).toBeVisible();
  // No local "Commit Physical Count" shortcut anywhere.
  await expect(page.getByText('Commit Physical Count')).toHaveCount(0);
});
