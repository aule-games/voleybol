import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { NOW, sample, TEAM } from '../fixtures.ts';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
  await page.route('**/content.json', route => route.fulfill({ json: sample() }));
});

for (const width of [320, 640]) test(`brand layouts retain navigation and game controls at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  for (const mode of ['home', 'tahmin', 'takim', 'quiz']) {
    if (mode !== 'home') await page.getByRole('navigation').getByRole('link', { name: mode === 'takim' ? 'Takımını kur' : mode === 'tahmin' ? 'Tahmin' : 'Quiz', exact: true }).click();
    await expect(page.locator(`main[data-mode="${mode}"] h1`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const sizes = await page.getByRole('navigation').getByRole('link').evaluateAll(links => links.map(a => ({ width: a.getBoundingClientRect().width, height: a.getBoundingClientRect().height })));
    for (const size of sizes) { expect(size.width).toBeGreaterThanOrEqual(44); expect(size.height).toBeGreaterThanOrEqual(44); }
  }
  await page.getByRole('button', { name: 'Quiz’e başla' }).click();
  await expect(page.getByRole('radio')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('brand artwork stays local and decorative; progress is not announced twice', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const art = page.locator('.hero-art');
  expect(await art.getAttribute('alt')).toBe('');
  expect(new URL((await art.getAttribute('src'))!).origin).toBe('http://127.0.0.1:4173');
  await expect(art).toHaveJSProperty('complete', true);
  expect(await art.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBe(420);
  await page.getByRole('navigation').getByRole('link', { name: 'Takımını kur' }).click();
  await expect(page.locator('.progress-marks')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.court-panel')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.locator('.button').first().evaluate(button => getComputedStyle(button).transitionDuration)).toBe('0s');
});

test('branded PNG keeps the portrait size and a full-name text fallback', async ({ page }, info) => {
  await page.goto(`/#/takim?v=1&r=demo-v1&p=${TEAM.join(',')}`);
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  const image = page.locator('.share-preview img');
  await expect(image).toBeVisible();
  await expect(image).toHaveJSProperty('naturalWidth', 1080);
  await expect(image).toHaveJSProperty('naturalHeight', 1350);
  const colors = await image.evaluate(async img => {
    await (img as HTMLImageElement).decode();
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(img as HTMLImageElement, 0, 0);
    const at = (x: number, y: number) => [...ctx.getImageData(x, y, 1, 1).data];
    return { paper: at(0, 0), court: at(65, 341), libero: at(65, 953) };
  });
  // This decoder is exported by the pinned Playwright runtime; no extra dependency.
  // Assert the actual download as well as the preview's second-canvas copy.
  const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNG indir', exact: true }).click();
  const path = info.outputPath('branded-team.png');
  await (await pendingDownload).saveAs(path);
  const png = PNG.sync.read(await readFile(path));
  const at = (x: number, y: number) => [...png.data.subarray((png.width * y + x) * 4, (png.width * y + x) * 4 + 4)];
  const encodedColors = { paper: at(0, 0), court: at(65, 341), libero: at(65, 953) };
  if (JSON.stringify(colors) !== JSON.stringify(encodedColors)) console.log('PNG_DIAGNOSTIC', JSON.stringify({ browserCopy: colors, encoded: encodedColors }));
  expect([png.width, png.height]).toEqual([1080, 1350]);
  expect(encodedColors).toEqual({ paper: [255, 249, 242, 255], court: [72, 38, 61, 255], libero: [238, 227, 237, 255] });
  expect(colors).toEqual({ paper: [255, 249, 242, 255], court: [72, 38, 61, 255], libero: [238, 227, 237, 255] });
  for (const id of TEAM) await expect(page.getByLabel('Takım metni ve bağlantısı')).toHaveValue(new RegExp(sample().roster.players.find(p => p.id === id)!.name));
});
