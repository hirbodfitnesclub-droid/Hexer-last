import { expect, test } from '@playwright/test';

test('loads the production app shell without a fatal error', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#root')).toBeAttached();
  await expect(page.locator('body')).not.toContainText('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required');
});
