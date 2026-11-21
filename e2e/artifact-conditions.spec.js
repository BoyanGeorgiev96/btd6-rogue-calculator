import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) test(`conditional artifact links open and focus Battle conditions at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await expect(page.locator('#result-count')).not.toHaveText(/Loading catalog|Catalog unavailable/);

  const primal = page.locator('[data-id="PrimalInstinct"]');
  const link = primal.locator('[data-condition-hint="close"]');
  await expect(link).toHaveText('Set Target priority is Close →');
  await expect(page.locator('#condition-close')).not.toBeChecked();

  await link.click();

  await expect(page.locator('#advanced-settings')).toHaveJSProperty('open', true);
  await expect(page.locator('.conditions')).toHaveJSProperty('open', true);
  await expect(page.locator('#condition-close')).toBeFocused();
  await expect(page.locator('#condition-close')).toBeVisible();
});
