import { expect, test } from '@playwright/test';

test.describe('Finply shell', () => {
  test('homepage loads and shows the main workspace', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Finply/i);
    await expect(page.getByText('Interactive paper trading workspace')).toBeVisible();
    await expect(page.getByPlaceholder('Search stocks, crypto, or companies...')).toBeVisible();
  });

  test('can navigate to technical analysis from the sidebar', async ({ page }) => {
    await page.goto('/');

    await page.getByText('Technical Analysis', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Technical Analysis' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analyze' })).toBeVisible();
  });
});
