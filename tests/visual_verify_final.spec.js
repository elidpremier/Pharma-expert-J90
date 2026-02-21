import { test, expect } from '@playwright/test';

test('mobile view test', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('http://localhost:8080');

  // Wait for sidebar to be hidden initially (it is hidden on mobile by default)
  const sidebar = page.locator('#sidebar');
  // In CSS: left: -100% !important;

  await page.screenshot({ path: 'screenshots/mobile_hidden.png' });

  // Click menu button
  await page.click('button:has(.fa-bars)');
  await page.waitForTimeout(500); // Animation
  await page.screenshot({ path: 'screenshots/mobile_open.png' });

  // Click close button
  await page.click('#sidebar button:has(.fa-xmark)');
  await page.waitForTimeout(500); // Animation
  await page.screenshot({ path: 'screenshots/mobile_closed_again.png' });
});

test('desktop toggle test', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:8080');

  await page.screenshot({ path: 'screenshots/desktop_initial.png' });

  // Toggle sidebar
  await page.click('button:has(.fa-bars)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/desktop_collapsed.png' });
});
