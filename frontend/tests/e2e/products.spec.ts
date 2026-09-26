import { test, expect } from '@playwright/test';
import { mockApi } from './mockApi';
test.beforeEach(async ({ page }) => {
  await mockApi(page);
});
test('product list, filters, detail and responsive navigation', async ({
  page,
}, testInfo) => {
  await page.goto('/products');
  await expect(
    page.getByRole('heading', { name: 'Products', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Steel Rod' })).toBeVisible();
  await page.getByLabel('Search products').fill('steel');
  const searchRequest = page.waitForRequest(
    (req) =>
      req.url().includes('/api/products?') &&
      req.url().includes('search=steel'),
  );
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await searchRequest;
  await expect(page.getByRole('link', { name: 'Steel Rod' })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath('products.png'),
    fullPage: true,
  });
  await page.getByRole('link', { name: 'Steel Rod' }).click();
  await expect(
    page.getByRole('heading', { name: 'Stock by location' }),
  ).toBeVisible();
  await expect(page.getByText('WH/Stock', { exact: true })).toBeVisible();
  if (testInfo.project.name !== 'desktop') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page
      .getByRole('link', { name: 'Warehouses', exact: true })
      .last()
      .click();
  } else
    await page.getByRole('link', { name: 'Warehouses', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Warehouses', exact: true }),
  ).toBeVisible();
});
test('product form keeps quantities as strings and maps server errors', async ({
  page,
}) => {
  await page.goto('/products/new');
  await page.getByLabel('SKU', { exact: true }).fill('STL001');
  await page.getByLabel('Product name').fill('Steel Rod');
  await page.getByLabel('Unit of measure').selectOption('kg');
  await page.route('**/api/products', async (route) => {
    const body = route.request().postDataJSON();
    expect(body.sku).toBe('STL001');
    expect(body.min_qty).toBe('0');
    expect(body.initial_quantity).toBe('0');
    await route.fulfill({
      status: 409,
      json: {
        code: 'DUPLICATE',
        message: 'SKU already exists.',
        details: { field: 'sku' },
        field_errors: [{ field: 'sku', message: 'Choose a unique SKU.' }],
      },
    });
  });
  await page
    .getByRole('button', { name: 'Create product', exact: true })
    .click();
  await expect(page.getByLabel('SKU', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(
    page.getByRole('button', { name: 'Create product', exact: true }),
  ).toBeEnabled();
});
test('API failure offers retry and empty results are clear', async ({
  page,
}) => {
  await page.route('**/api/products?**', (route) =>
    route.fulfill({
      status: 500,
      json: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to load products.',
        field_errors: [],
        details: {},
      },
    }),
  );
  await page.goto('/products');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.route('**/api/products?**', (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } }),
  );
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('No products match your filters.')).toBeVisible();
});

test('opening stock requires a location and sends decimal strings unchanged', async ({
  page,
}) => {
  await page.goto('/products/new');
  await page.getByLabel('SKU', { exact: true }).fill('NEW001');
  await page.getByLabel('Product name').fill('New product');
  await page.getByLabel('Opening quantity').fill('12.125');
  await page
    .getByRole('button', { name: 'Create product', exact: true })
    .click();
  await expect(
    page.getByText('Choose a location for opening stock.'),
  ).toBeVisible();
  await page.getByLabel('Opening location').selectOption('1');
  const request = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/api/products'),
  );
  await page
    .getByRole('button', { name: 'Create product', exact: true })
    .click();
  const body = (await request).postDataJSON();
  expect(body.initial_quantity).toBe('12.125');
  expect(body.initial_location_id).toBe(1);
  await expect(page).toHaveURL(/\/products\/12$/);
});
test('product editing excludes opening stock and persists active status', async ({
  page,
}) => {
  await page.goto('/products/12/edit');
  await expect(page.getByLabel('Product name')).toHaveValue('Steel Rod');
  await expect(page.getByLabel('Opening quantity')).toHaveCount(0);
  await page.getByLabel('Product name').fill('Steel Rod Updated');
  await page.getByLabel('Active product', { exact: true }).uncheck();
  const request = page.waitForRequest(
    (req) => req.method() === 'PATCH' && req.url().endsWith('/api/products/12'),
  );
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  const body = (await request).postDataJSON();
  expect(body.name).toBe('Steel Rod Updated');
  expect(body.is_active).toBe(false);
  expect(body.initial_quantity).toBeUndefined();
  expect(body.initial_location_id).toBeUndefined();
  await expect(page).toHaveURL(/\/products\/12$/);
});
test('manager can create a category inline from the product form', async ({
  page,
}) => {
  await page.goto('/products/new');
  const newCategoryButton = page.getByRole('button', {
    name: 'New category',
  });
  await expect(newCategoryButton).toBeVisible();
  await newCategoryButton.click();

  // Empty submission is rejected client-side, no request sent.
  let requested = false;
  await page.route('**/api/categories', (route) => {
    if (route.request().method() === 'POST') {
      requested = true;
      return route.fulfill({ json: { id: 9, name: 'Fasteners' } });
    }
    return route.fulfill({
      json: [{ id: 1, name: 'Raw Material' }, { id: 9, name: 'Fasteners' }],
    });
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Enter a category name.')).toBeVisible();
  expect(requested).toBe(false);

  // Successful creation posts the trimmed name and auto-selects it.
  await page
    .getByPlaceholder('New category name')
    .fill('  Fasteners  ');
  const createRequest = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/api/categories'),
  );
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const body = (await createRequest).postDataJSON();
  expect(body).toEqual({ name: 'Fasteners' });
  await expect(page.getByLabel('Category')).toHaveValue('9');
  await expect(page.getByPlaceholder('New category name')).toHaveCount(0);
});

test('backend category creation error is displayed, not swallowed', async ({
  page,
}) => {
  await page.goto('/products/new');
  await page.getByRole('button', { name: 'New category' }).click();
  await page.getByPlaceholder('New category name').fill('Raw Material');
  await page.route('**/api/categories', (route) =>
    route.fulfill({
      status: 409,
      json: {
        code: 'DUPLICATE',
        message: 'A category with that name already exists.',
        details: { field: 'name' },
        field_errors: [],
      },
    }),
  );
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByText('A category with that name already exists.'),
  ).toBeVisible();
  // The inline creator stays open so the user can correct and retry.
  await expect(page.getByPlaceholder('New category name')).toBeVisible();
});

test('staff can browse but cannot access product changes', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 2, name: 'Staff', role: 'staff' } }),
  );
  await page.goto('/products');
  await expect(page.getByRole('link', { name: 'Steel Rod' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New product' })).toHaveCount(0);
  await page.goto('/products/new');
  await expect(
    page.getByText('Only managers can change product details.'),
  ).toBeVisible();
});
