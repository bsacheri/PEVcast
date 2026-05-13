const { test, expect } = require('@playwright/test');

test('PEVcast homepage renders the main controls', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/index.html');

  await expect(page).toHaveTitle('PEVcast');
  await expect(page.getByRole('heading', { name: 'PEVcast' })).toBeVisible();
  await expect(page.locator('#cityTitle')).toContainText('Moon Township, PA');
  await expect(page.locator('#quickSelect')).toBeVisible();
  await expect(page.locator('#cityInput')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Range:/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chart Compare' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Menu/ })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
