import { expect, test } from '@playwright/test';

const routes = [
  { name: 'registro', path: '/registro' },
  { name: 'perfil', path: '/perfil', auth: true },
  { name: 'wallet', path: '/wallet', auth: true },
  { name: 'gift-cards', path: '/gift-cards' },
];

for (const viewport of [
  { label: 'desktop', width: 1440, height: 1000 },
  { label: 'mobile', width: 390, height: 844 },
]) {
  for (const route of routes) {
    test(`${route.name} ${viewport.label}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // Protected routes require an authenticated storageState configured before baselines are approved.
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(`${route.name}-${viewport.label}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
    });
  }
}
