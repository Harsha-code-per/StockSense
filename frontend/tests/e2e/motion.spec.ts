import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
});

test('login environment does not block inputs and login still succeeds', async ({
  page,
}) => {
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
  await page.goto('/login');
  // The decorative environment is aria-hidden and must never intercept focus/clicks.
  await expect(page.locator('[aria-hidden="true"] video')).toHaveCount(1);
  await page.getByLabel('Email').fill('asha@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Manager@123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('reduced motion shows a static poster, no video element', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.locator('video')).toHaveCount(0);
  await expect(page.locator('[aria-hidden="true"] img')).toHaveCount(1);
  // Form remains fully usable under reduced motion.
  await expect(page.getByLabel('Email')).toBeEditable();
});

test('no page-level horizontal overflow on login at 1440/768/375', async ({
  page,
}) => {
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflow, `Overflow at ${width}px`).toBeFalsy();
  }
});
