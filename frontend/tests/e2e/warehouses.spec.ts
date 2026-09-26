import { test, expect } from '@playwright/test';
import { mockApi } from './mockApi';
test.beforeEach(async ({ page }) => {
  await mockApi(page);
});
test('warehouse and location creation', async ({ page }, testInfo) => {
  await page.goto('/warehouses');
  await page.getByRole('button', { name: 'New warehouse' }).click();
  await page.getByLabel('Warehouse code').fill('NEW');
  await page.getByLabel('Warehouse name').fill('New Warehouse');
  const created = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/api/warehouses'),
  );
  await page
    .getByRole('button', { name: 'Create warehouse', exact: true })
    .click();
  expect((await created).postDataJSON().code).toBe('NEW');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page
    .getByRole('button', { name: 'Locations for Main Warehouse' })
    .click();
  await expect(page.getByText('WH/Stock', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New location' }).click();
  await page.getByLabel('Location name').fill('Rack A');
  const location = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/api/locations'),
  );
  await page
    .getByRole('button', { name: 'Create location', exact: true })
    .click();
  expect((await location).postDataJSON()).toEqual({
    warehouse_id: 1,
    name: 'Rack A',
  });
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath('warehouses.png'),
    fullPage: true,
  });
});
test('location with stock cannot be deactivated and the form remains editable', async ({
  page,
}) => {
  await page.route('**/api/locations/1', (route) =>
    route.fulfill({
      status: 409,
      json: {
        code: 'INVALID_STATE',
        message: 'Move stock before deactivating this location.',
        details: {},
        field_errors: [],
      },
    }),
  );
  await page.goto('/warehouses');
  await page
    .getByRole('button', { name: 'Locations for Main Warehouse' })
    .click();
  await page.getByRole('button', { name: 'Edit WH/Stock' }).click();
  await page.getByLabel('Active location', { exact: true }).uncheck();
  await page
    .getByRole('button', { name: 'Save location', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog')
      .getByText('Move stock before deactivating this location.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save location', exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('warehouse edits keep the code immutable and clear stale locations', async ({
  page,
}) => {
  await page.route('**/api/warehouses/1', (route) =>
    route.fulfill({
      json: { id: 1, code: 'WH', ...route.request().postDataJSON() },
    }),
  );
  await page.goto('/warehouses');
  await page
    .getByRole('button', { name: 'Locations for Main Warehouse' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Main Warehouse locations' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Edit Main Warehouse', exact: true })
    .click();
  await expect(page.getByLabel('Warehouse code')).toHaveAttribute(
    'readonly',
    '',
  );
  await page.getByLabel('Warehouse name').fill('Renamed warehouse');
  await page.getByLabel('Active warehouse', { exact: true }).uncheck();
  const request = page.waitForRequest(
    (req) =>
      req.method() === 'PATCH' && req.url().endsWith('/api/warehouses/1'),
  );
  await page
    .getByRole('button', { name: 'Save warehouse', exact: true })
    .click();
  const body = (await request).postDataJSON();
  expect(body.name).toBe('Renamed warehouse');
  expect(body.is_active).toBe(false);
  expect(body.code).toBeUndefined();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'Main Warehouse locations' }),
  ).toHaveCount(0);
});
