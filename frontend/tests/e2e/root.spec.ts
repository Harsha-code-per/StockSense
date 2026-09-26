import { test, expect } from '@playwright/test';

test('root path redirects to the dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/);
});

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('root path shows the landing page with sign-in and sign-up', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { level: 1, name: /Every movement/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Sign in' }).first(),
    ).toHaveAttribute('href', '/login');
    await page
      .getByRole('link', { name: /Get started/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/signup$/);
  });
});
