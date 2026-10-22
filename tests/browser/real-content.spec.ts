import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import raw from '../../public/content.json' with { type: 'json' };
import { GameStore } from '../../src/platform/storage.ts';
import { memoryStorage, sample, TEAM } from '../fixtures.ts';
import { beginAttempt } from '../../src/domain/quiz.ts';
const indices = [0, 2, 4, 6, 8, 9, 12];
const ids = indices.map(i => raw.roster.players[i]!.id);
const artifactDir = '.gstack/qa-reports/real-content-20261022';
const teamLink = `/#/takim?v=1&r=${raw.roster.version}&p=${ids.join(',')}`;
// No content mocking: these checks consume the actual built JSON and local assets.
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(Date.parse(raw.publishedAt) + 1000)); });
async function pickTeam(page: Page) {
  for (let i = 0; i < indices.length; i++) {
    await page.locator(`#slot-${i}`).click();
    await page.locator('.player-option').filter({ hasText: raw.roster.players[indices[i]!]!.name }).click();
  }
}

// Rehost the real built bytes at the approved origin; this is not live CDN/TLS proof.
test('Pages project path loads real content and exports a cross-device team link', async ({ page, request }) => {
  const base = 'https://aule-games.github.io/voleybol/';
  const errors: string[] = []; const external: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {
    const url = new URL(r.url());
    // WebKit emits local PNG blob requests too; these do not access the network.
    if (['http:', 'https:'].includes(url.protocol) && !r.url().startsWith(base)) external.push(r.url());
  });
  await page.route(`${base}**`, async route => {
    const remote = new URL(route.request().url());
    const local = new URL(remote.pathname.slice('/voleybol'.length), 'http://127.0.0.1:4173');
    await route.fulfill({ response: await request.get(local.href) });
  });
  await page.goto(`${base}#/takim`);
  await expect(page.locator('.demo-banner')).toContainText('Herkese açık test sürümü');
  await pickTeam(page); await page.getByRole('button', { name: 'Takımımı onayla', exact: true }).click();
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  const exported = (await page.getByLabel('Takım metni ve bağlantısı').inputValue()).split('\n').at(-1)!;
  expect(exported).toContain(`${base}#/takim?`);
  await expect(page.getByText('Bu test bağlantısını başka bir cihazda açabilirsin.', { exact: false })).toBeVisible();
  await page.goto(exported); await page.reload();
  await expect(page.getByText('7/7 oyuncu seçildi', { exact: true })).toBeVisible();
  await expect(page.locator('.slot-list img')).toHaveCount(14);
  for (const img of await page.locator('.slot-list img').all()) await expect.poll(() => img.evaluate(i => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('navigation').getByRole('link', { name: 'Quiz', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'On soru. Sıfır acele.' })).toBeVisible();
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('all 14 current identities load both marks without third-party traffic', async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (new URL(r.url()).origin !== 'http://127.0.0.1:4173') external.push(r.url()); });
  await page.goto('/#/takim'); await expect(page.locator('.demo-banner')).toContainText('Gerçek oyuncular');
  const observed: string[] = [];
  for (const slot of [0, 1, 2, 4, 6]) {
    await page.locator(`#slot-${slot}`).click();
    const options = page.locator('.player-option');
    for (let i = 0; i < await options.count(); i++) {
      const item = options.nth(i); observed.push(await item.innerText());
      await expect(item.locator('.identity-badge')).toHaveCount(2);
      await expect(item.locator('.identity-badge.country')).toContainText('Türkiye');
      for (const img of await item.locator('img').all()) await expect.poll(() => img.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
  }
  expect(observed).toHaveLength(14);
  expect(observed.find(s => s.includes('Derya Cebecioğlu'))).toContain('Türk Hava Yolları');
  expect(observed.find(s => s.includes('Saliha Şahin'))).toContain('Fenerbahçe Medicana');
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

for (const width of [320, 360, 1440]) test(`real lineup at ${width}px keeps complete names, marks and export`, async ({ page, browserName }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto('/#/takim'); await pickTeam(page);
  await expect(page.locator('.slot-list img')).toHaveCount(14); await expect(page.locator('.court img')).toHaveCount(14);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Takımımı onayla', exact: true }).click();
  await page.reload(); await expect(page.locator('#slot-0')).toContainText('Cansu Özbay');
  await mkdir(artifactDir, { recursive: true });
  await page.screenshot({ path: `${artifactDir}/${browserName}-team-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  const img = page.locator('#share-preview img'); await expect(img).toHaveJSProperty('naturalWidth', 1080); await expect(img).toHaveJSProperty('naturalHeight', 1350);
  const field = page.getByLabel('Takım metni ve bağlantısı'); await expect(field).toHaveValue(/Gerçek oyuncular/); await expect(field).not.toHaveValue(/Kurgusal/);
  for (const i of indices) expect(await field.inputValue()).toContain(raw.roster.players[i]!.name);
  if (width === 1440) { const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'PNG indir', exact: true }).click(); const file = await download; expect(file.suggestedFilename()).toBe('hayalimdeki-takim-test.png'); await file.saveAs(`${artifactDir}/${browserName}-team-export.png`); }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('ten factual answers retain progress after reload and show ten sources on completion', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 360, height: 900 }); await page.goto('/#/quiz');
  await expect(page.getByRole('heading', { name: 'On soru. Sıfır acele.' })).toBeVisible();
  await page.getByRole('button', { name: 'Quiz’e başla', exact: true }).click();
  for (let i = 0; i < 10; i++) {
    await expect(page.getByText(`Soru ${i + 1}/10`, { exact: true })).toBeVisible();
    const q = raw.quiz.questions[i]!;
    await page.locator(`input[value="${q.correctId}"]`).check(); await page.getByRole('button', { name: 'Cevabımı onayla', exact: true }).click();
    await expect(page.locator('.question-source a')).toHaveAttribute('href', q.source.url);
    await expect(page.locator('.question-source a')).toHaveAttribute('rel', 'noopener noreferrer');
    if (i === 4) { await page.reload(); await expect(page.getByText('Soru 6/10', { exact: true })).toBeVisible(); }
    else await page.getByRole('button', { name: i === 9 ? 'Sonucumu gör' : 'Sonraki soru', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.locator('.quiz-score')).toHaveText('10 / 10'); await expect(page.locator('.question-source a')).toHaveCount(10);
  await page.reload(); await expect(page.locator('.quiz-score')).toHaveText('10 / 10');
  await mkdir(artifactDir, { recursive: true }); await page.screenshot({ path: `${artifactDir}/${browserName}-quiz-complete.png`, fullPage: true });
});

test('failed logo assets retain readable current club and represented country', async ({ page }) => {
  await page.route('**/marks/**', route => route.abort()); await page.goto('/#/takim'); await page.locator('#slot-2').click();
  const derya = page.locator('.player-option').filter({ hasText: 'Derya Cebecioğlu' });
  await expect(derya).toContainText('Türk Hava Yolları'); await expect(derya).toContainText('Türkiye'); await derya.click();
  await expect(page.locator('#slot-2')).toContainText('Türk Hava Yolları');
});

test('old fictional links cannot silently select real athletes or export', async ({ page }) => {
  await page.goto(`/#/takim?v=1&r=demo-v1&p=${TEAM.join(',')}`);
  await expect(page.getByText('0/7 oyuncu seçildi', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla', exact: true })).toBeDisabled();
});

test('old local records stay stored without remapping into the new roster or quiz', async ({ page }) => {
  const storage = memoryStorage(); let i = 0; const store = new GameStore(storage, () => `legacy-${++i}`);
  store.save('lineup:own', { kind: 'lineup', data: { roster: 'demo-v1', ids: TEAM } }, []);
  store.save('quiz:old-quiz', { kind: 'quiz', data: beginAttempt(sample().quiz, 'old-quiz', false) }, []);
  const records = Array.from({ length: storage.length }, (_, n) => { const key = storage.key(n)!; return [key, storage.getItem(key)!]; });
  await page.addInitScript(entries => { for (const [key, value] of entries) localStorage.setItem(key!, value!); }, records);
  await page.goto('/#/takim'); await expect(page.getByText('0/7 oyuncu seçildi', { exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Quiz', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Güncel paketle yeniden başla' })).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:')).length)).toBe(2);
});

test('test preview never offers native external share even when browser supports it', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'canShare', { value: () => true }); Object.defineProperty(navigator, 'share', { value: () => { throw Error('Must not call'); } }); });
  await page.goto(teamLink); await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.getByRole('button', { name: 'PNG indir', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Paylaş…', exact: true })).toHaveCount(0);
});

test('the remaining seven real names fit the export and quiz answer sources fit mobile', async ({ page, browserName }) => {
  const remaining = [1, 3, 5, 7, 10, 11, 13];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/#/takim?v=1&r=${raw.roster.version}&p=${remaining.map(i => raw.roster.players[i]!.id).join(',')}`);
  await expect(page.locator('.slot-list')).toContainText('Galatasaray Daikin');
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.locator('#share-preview img')).toHaveJSProperty('naturalWidth', 1080);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'PNG indir', exact: true }).click();
  await mkdir(artifactDir, { recursive: true }); await (await download).saveAs(`${artifactDir}/${browserName}-remaining-export.png`);
  for (const i of remaining) expect(await page.getByLabel('Takım metni ve bağlantısı').inputValue()).toContain(raw.roster.players[i]!.name);
  await page.setViewportSize({ width: 360, height: 900 }); await page.goto('/#/quiz'); await page.getByRole('button', { name: 'Quiz’e başla', exact: true }).click();
  await page.locator(`input[value="${raw.quiz.questions[0]!.correctId}"]`).check(); await page.getByRole('button', { name: 'Cevabımı onayla', exact: true }).click();
  await page.screenshot({ path: `${artifactDir}/${browserName}-quiz-answer-360.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
