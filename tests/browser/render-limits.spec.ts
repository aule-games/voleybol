import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { NOW, sample, TEAM } from '../fixtures.ts';

const teamRoute = `/#/takim?v=1&r=demo-v1&p=${TEAM.join(',')}`;
type Probe = { canvases: HTMLCanvasElement[]; callbacks: (() => void)[]; created: number; files: number; ink: { text: string; font: string; width: number; top: number; bottom: number }[] };
const probe = () => (window as unknown as { __limits: Probe }).__limits;

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(NOW) });
  await page.clock.pauseAt(new Date(NOW));
  await page.route('**/content.json', route => route.fulfill({ json: sample() }));
});

async function instrument(page: Page, stall = true) {
  await page.addInitScript(stall => {
    const state: Probe = { canvases: [], callbacks: [], created: 0, files: 0, ink: [] };
    Object.defineProperty(window, '__limits', { value: state });
    const encode = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
      state.canvases.push(this);
      encode.call(this, blob => {
        if (stall) state.callbacks.push(() => callback(blob));
        else callback(blob);
      }, ...args);
    };
    const draw = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(...args) {
      const metrics = this.measureText(args[0]);
      state.ink.push({ text: args[0], font: this.font, width: metrics.width, top: args[2] - metrics.actualBoundingBoxAscent, bottom: args[2] + metrics.actualBoundingBoxDescent });
      draw.apply(this, args);
    };
    const create = URL.createObjectURL;
    URL.createObjectURL = blob => { state.created++; return create(blob); };
    const NativeFile = File;
    window.File = class extends NativeFile {
      constructor(...args: ConstructorParameters<typeof File>) { super(...args); state.files++; }
    };
  }, stall);
}

async function start(page: Page, count = 1) {
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __limits: Probe }).__limits.callbacks.length)).toBe(count);
}

test('T17 an exact-expiry download click is rejected before the interval runs', async ({ page }) => {
  await instrument(page, false); await page.goto(teamRoute);
  const downloads: string[] = []; page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.getByRole('button', { name: 'PNG indir' })).toBeVisible();
  await page.clock.setSystemTime(new Date(NOW + 59_999));
  await expect(page.getByRole('button', { name: 'PNG indir' })).toBeEnabled();
  await page.clock.setSystemTime(new Date(NOW + 60_000));
  await page.getByRole('button', { name: 'PNG indir' }).click();
  await expect(page.getByTestId('message')).toContainText('doğrulaması sona erdi');
  await expect(page.getByRole('button', { name: 'PNG indir' })).toHaveCount(0);
  await page.clock.runFor(5000);
  expect(downloads).toEqual([]);
  expect(await page.evaluate(probe).then(p => ({ files: p.files, created: p.created, canvases: p.canvases.length }))).toEqual({ files: 1, created: 1, canvases: 1 });
});

test('T17 stalled encoding expires at five seconds, releases canvas and ignores late output', async ({ page }) => {
  await instrument(page); await page.goto(teamRoute); await start(page);
  await page.clock.runFor(4999);
  await expect(page.getByRole('button', { name: 'Önizleme hazırlanıyor…' })).toBeDisabled();
  await page.clock.runFor(1);
  await expect(page.getByLabel('Takım metni ve bağlantısı')).toBeVisible();
  await expect(page.locator('#share-preview')).toContainText('Görsel oluşturulamadı');
  await expect(page.getByRole('button', { name: 'PNG indir' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __limits: Probe }).__limits.canvases.map(c => [c.width, c.height]))).toEqual([[0, 0]]);
  const before = await page.getByLabel('Takım metni ve bağlantısı').inputValue();
  await page.evaluate(() => (window as unknown as { __limits: Probe }).__limits.callbacks.shift()!());
  expect(await page.evaluate(probe).then(p => ({ files: p.files, created: p.created }))).toEqual({ files: 0, created: 0 });
  await expect(page.getByLabel('Takım metni ve bağlantısı')).toHaveValue(before);
  // Recovery is explicit, never an automatic encoder retry.
  await start(page); await page.evaluate(() => (window as unknown as { __limits: Probe }).__limits.callbacks.shift()!());
  await expect(page.getByRole('button', { name: 'PNG indir' })).toBeVisible();
});

for (const event of ['navigation', 'hide', 'pagehide', 'offline']) test(`T17 ${event} cancels a never-returning encoder without blocking a new preview`, async ({ page }) => {
  await instrument(page); await page.goto(teamRoute); await start(page);
  if (event === 'navigation') {
    await page.getByRole('navigation').getByRole('link', { name: 'Quiz', exact: true }).click();
  } else await page.evaluate(event => {
    if (event === 'hide') {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    } else window.dispatchEvent(new Event(event));
  }, event);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __limits: Probe }).__limits.canvases[0]!.width)).toBe(0);
  // Start a new request while the old native callback is still outstanding.
  await page.evaluate(hash => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    location.hash = hash;
  }, `#/takim?v=1&r=demo-v1&p=${['p2', ...TEAM.slice(1)].join(',')}`);
  await expect(page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' })).toBeEnabled();
  await start(page, 2);
  await page.evaluate(() => (window as unknown as { __limits: Probe }).__limits.callbacks.shift()!());
  await expect(page.getByRole('button', { name: 'Önizleme hazırlanıyor…' })).toBeDisabled();
  expect(await page.evaluate(probe).then(p => ({ files: p.files, created: p.created }))).toEqual({ files: 0, created: 0 });
  await page.evaluate(() => (window as unknown as { __limits: Probe }).__limits.callbacks.shift()!());
  await expect(page.getByRole('button', { name: 'PNG indir' })).toBeVisible();
  await expect(page.getByLabel('Takım metni ve bağlantısı')).toHaveValue(new RegExp(sample().roster.players.find(p => p.id === 'p2')!.name));
});

// Synthetic names exercise Turkish, accented and compound glyphs, not real athletes.
const names = ['Çiğdem Özgecan Örnekgül', 'İpek Özge Deneme', 'Éléa Şirin Örnek', 'Duru-Ece Örnek', 'Güneş Öykü Test', 'Çiğdem Işık Örnek', 'İnci Öykü Uzun Örnek'];
test('T16 full compound names survive PNG, text, link and a 360px picker', async ({ page }, info) => {
  const data = sample(); TEAM.forEach((id, i) => { data.roster.players.find(p => p.id === id)!.name = names[i]!; });
  await page.route('**/content.json', route => route.fulfill({ json: data }));
  await instrument(page, false); await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(teamRoute);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.locator('#share-preview img')).toHaveJSProperty('naturalWidth', 1080);
  const text = await page.getByLabel('Takım metni ve bağlantısı').inputValue();
  for (const name of names) expect(text).toContain(name);
  const ink = await page.evaluate(probe).then(p => p.ink);
  const nameInk = ink.filter(i => /^bold (40|42|44)px/.test(i.font));
  expect(nameInk.slice(0, 3).map(i => i.text)).toEqual(['Çiğdem', 'Özgecan', 'Örnekgül']);
  expect(nameInk[2]!.bottom).toBeLessThanOrEqual(ink.find(i => i.text === 'Pasör')!.top);
  expect(nameInk.map(i => i.text).join(' ')).toBe(names.join(' '));
  for (const line of nameInk.slice(0, -1)) expect(line.width).toBeLessThanOrEqual(952 / 3 - 36);
  const url = text.split('\n').at(-1)!;
  expect(new URLSearchParams(new URL(url).hash.split('?')[1]).get('p')).toBe(TEAM.join(','));
  const png = await page.locator('#share-preview img').evaluate(async img => [...new Uint8Array(await (await fetch((img as HTMLImageElement).src)).arrayBuffer())]);
  await writeFile(info.outputPath('compound-names.png'), Buffer.from(png));
  await info.attach('compound-names.png', { path: info.outputPath('compound-names.png'), contentType: 'image/png' });
  await page.locator('#share-preview img').evaluate(img => { (img as HTMLElement).style.width = '270px'; });
  await page.locator('#share-preview img').screenshot({ path: info.outputPath('compound-names-270.png') });
  await page.goto(url);
  for (const name of names) await expect(page.locator('main')).toContainText(name);
  await page.getByRole('button', { name: 'Kendi takımını kur', exact: true }).click();
  await page.getByRole('button', { name: 'Bu takımla değiştir', exact: true }).click();
  await page.locator('#slot-0').click();
  await expect(page.locator('.player-option').first()).toContainText(names[0]!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await expect(page.locator('#slot-0')).toBeFocused();
});

for (const [label, index, name] of [
  ['single token', 0, 'Ç'.repeat(120)],
  ['four lines', 0, 'Çiğdem Çiğdem Çiğdem Çiğdem'],
  ['libero overflow', 6, 'İnci Öykü Uzun Deneme Örnek Soyadı Deneme'],
] as const) test(`T16 ${label} refuses a clipped PNG and preserves the full name`, async ({ page }) => {
  const data = sample(); data.roster.players.find(p => p.id === TEAM[index])!.name = name;
  await page.route('**/content.json', route => route.fulfill({ json: data }));
  await page.setViewportSize({ width: 360, height: 900 }); await page.goto(teamRoute);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.locator('#share-preview')).toContainText('Oyuncu adları görsele eksiksiz sığmıyor');
  await expect(page.getByLabel('Takım metni ve bağlantısı')).toHaveValue(new RegExp(name));
  await expect(page.getByRole('button', { name: 'PNG indir' })).toHaveCount(0);
  await expect(page.locator('#share-preview img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Kendi takımını kur', exact: true }).click();
  await page.getByRole('button', { name: 'Bu takımla değiştir', exact: true }).click();
  await page.locator(`#slot-${index}`).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.player-option').filter({ hasText: name })).toBeVisible();
});
