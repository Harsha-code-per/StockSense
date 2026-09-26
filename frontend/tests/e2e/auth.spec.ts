import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('signed-out visitors are sent to sign in and returned after login', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      json: {
        code: 'UNAUTHORIZED',
        message: 'Please log in to continue.',
        details: {},
        field_errors: [],
      },
    }),
  );
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      json: {
        id: 1,
        name: 'Asha',
        email: 'asha@example.test',
        role: 'manager',
        created_at: '2026-09-26T09:00:00Z',
      },
      headers: {
        'set-cookie': 'ss_session=e2e-session; Path=/; HttpOnly; SameSite=Lax',
      },
    }),
  );
  await page.route('**/api/products?**', (route) =>
    route.fulfill({ json: { items: [], total: 0, page: 1, page_size: 20 } }),
  );
  await page.goto('/products');
  await expect(page).toHaveURL(/\/login\?next=%2Fproducts$/);

  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter your email address.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();

  await page.getByLabel('Email').fill('asha@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Manager@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/products$/);
});

test('bad credentials show one generic error and clear the password', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route('**/api/auth/login', (route) =>
    route.fulfill({
      status: 401,
      json: {
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password.',
        details: {},
        field_errors: [],
      },
    }),
  );
  await page.goto('/login');
  await page.getByLabel('Email').fill('asha@example.test');
  await page.getByLabel('Password', { exact: true }).fill('wrong-pass1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').first()).toContainText(
    'Invalid email or password.',
  );
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
});
