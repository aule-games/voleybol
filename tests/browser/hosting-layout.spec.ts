import { test, expect } from '@playwright/test';
import { NOW, sample, TEAM } from '../fixtures.ts';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
  await page.route('**/content.json', route => route.fulfill({ json: sample() }));
});

test('T14 nested static placement loads all games and exports only the nested query-free URL', async ({ page, request }) => {
  const base = 'http://127.0.0.1:4175/games/demo/';
  expect((await request.get('http://127.0.0.1:4175/content.json')).status()).toBe(404);
  const paths: string[] = []; const errors: string[] = []; const badResponses: string[] = [];
  page.on('request', r => { if (r.url().startsWith('http')) paths.push(new URL(r.url()).pathname); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) badResponses.push(r.url()); });
  await page.goto(base + '?test=1&email=private');
  await expect(page.getByRole('heading', { name: 'Filede söz sende.' })).toBeVisible();
  await expect(page.locator('.hero-art')).toHaveJSProperty('naturalWidth', 420);
  await page.getByRole('navigation').getByRole('link', { name: 'Tahmin', exact: true }).click();
  const match = page.locator('.match-row').first();
  await match.getByRole('radio', { name: '3 – 0', exact: true }).check();
  await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('bu cihazda kayıtlı');
  await page.goto(base + `?test=1&email=private#/takim?v=1&r=demo-v1&p=${TEAM.join(',')}`);
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  const field = page.getByLabel('Takım metni ve bağlantısı'); await expect(field).toBeVisible();
  const exported = new URL((await field.inputValue()).split('\n').at(-1)!);
  expect(exported.origin + exported.pathname).toBe(base); expect(exported.search).toBe('');
  await page.goto(exported.href); await page.reload();
  await expect(page.getByText('Paylaşılan takım · Salt okunur. Kendi taslağın değişmedi.')).toBeVisible();
  await expect(page.getByText('7/7 oyuncu seçildi', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Quiz', exact: true }).click();
  await page.getByRole('button', { name: 'Quiz’e başla' }).click();
  for (let i = 0; i < 5; i++) {
    await page.locator(`input[value="${sample().quiz.questions[i]!.correctId}"]`).check();
    await page.getByRole('button', { name: 'Cevabımı onayla' }).click();
    await page.getByRole('button', { name: i === 4 ? 'Sonucumu gör' : 'Sonraki soru' }).click();
  }
  await expect(page.getByText('5 / 5', { exact: true })).toBeVisible();
  expect(paths.every(path => path.startsWith('/games/demo/'))).toBe(true);
  expect(paths).toContain('/games/demo/content.json');
  expect(errors).toEqual([]); expect(badResponses).toEqual([]);
});

// CSS magnification exercises text/control fit, not native browser zoom or screen-reader certification.
test('T30 200 percent CSS magnification keeps all three game controls reachable', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 1000 });
  await page.goto('/'); await page.addStyleTag({ content: 'html { zoom: 2; }' });
  for (const mode of ['home', 'tahmin', 'takim', 'quiz']) {
    if (mode !== 'home') await page.getByRole('navigation').getByRole('link', { name: mode === 'takim' ? 'Takımını kur' : mode === 'tahmin' ? 'Tahmin' : 'Quiz', exact: true }).click();
    await expect(page.locator(`main[data-mode="${mode}"] h1`)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (mode === 'tahmin') {
      const row = page.locator('.match-row').first(); await row.getByRole('radio', { name: '3 – 0', exact: true }).check();
      await row.getByRole('button', { name: 'Tahminimi kaydet' }).click(); await expect(page.getByTestId('message')).toContainText('bu cihazda kayıtlı');
    }
    if (mode === 'takim') {
      await page.locator('#slot-0').click(); await page.getByRole('button', { name: 'Ada Örnek', exact: true }).click();
      await expect(page.locator('#slot-0')).toBeFocused();
    }
    if (mode === 'quiz') {
      await page.getByRole('button', { name: 'Quiz’e başla' }).click(); await page.locator('input[value="q1-c1"]').check();
      await page.getByRole('button', { name: 'Cevabımı onayla' }).click(); await expect(page.getByRole('button', { name: 'Sonraki soru' })).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.screenshot({ path: test.info().outputPath('magnification-200.png'), fullPage: true });
});

test.describe('T08 Lisbon daylight saving boundary', () => {
  test.use({ timezoneId: 'Europe/Lisbon' });
  for (const [utc, tsi] of [['2026-10-25T00:30:00.000Z', '03:30'], ['2026-10-25T01:30:00.000Z', '04:30']]) {
    test(`UTC ${utc} remains ${tsi} TSİ despite repeated local hour`, async ({ page }) => {
      const starts = Date.parse(utc!); const data = sample(starts - 60_000);
      data.fixtures[0]!.startsAt = data.fixtures[0]!.locksAt = utc!;
      await page.clock.setFixedTime(new Date(starts - 1));
      await page.route('**/content.json', route => route.fulfill({ json: data }));
      await page.goto('/#/tahmin'); const match = page.locator('.match-row').first();
      await expect(match.locator('.eyebrow')).toContainText(`${tsi} TSİ`);
      expect(await page.evaluate(utc => new Date(utc).getHours(), utc!)).toBe(1);
      await match.getByRole('radio', { name: '3 – 0', exact: true }).check();
      await page.route('**/content.json', async route => { await page.clock.setFixedTime(new Date(starts)); await route.fulfill({ json: data }); });
      await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
      await expect(page.getByTestId('message')).toContainText('Tahmin süresi doldu');
      expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:')))).toEqual([]);
    });
  }
});
