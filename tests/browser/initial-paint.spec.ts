import { test, expect } from '@playwright/test';

test('brand mark stays bounded before scripts/styles arrive', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 800 } });
  const page = await context.newPage();
  await page.route('**/*.css', route => route.abort());
  await page.goto('http://127.0.0.1:4173/');
  const mark = await page.locator('.brand-ball').boundingBox();
  expect(mark).not.toBeNull(); expect(mark!.width).toBeLessThanOrEqual(36); expect(mark!.height).toBeLessThanOrEqual(36);
  await context.close();
});
