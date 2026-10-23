import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import raw from '../../public/content.json' with { type: 'json' };
const indices = [1, 2, 5, 6, 9, 11, 13];
const artifactDir = '.gstack/qa-reports/international-20261023';
const saveName = 'Takımımı kaydet ve bağlantı oluştur';
const linkLabel = 'Takımının benzersiz bağlantısı';
const challenge = 'Benim kurduğum takım bu, katılıyor musun?';
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(Date.parse(raw.publishedAt) + 1000)); });
async function pick(page: Page, slot: number, name: string) {
  await page.locator(`#slot-${slot}`).click();
  await page.locator('.player-option').filter({ has: page.locator('strong', { hasText: new RegExp(`^${name}$`) }) }).click();
}
async function complete(page: Page) {
  for (let i = 0; i < 7; i++) await pick(page, i, raw.roster.players[indices[i]!]!.name);
  await pick(page, 7, 'Daniele Santarelli');
}
async function attempt(page: Page) {
  return page.evaluate(() => {
    const records = Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:')).map(k => JSON.parse(localStorage.getItem(k)!));
    const quiz = records.filter(r => r.value.kind === 'quiz');
    const parents = new Set(quiz.flatMap(r => r.parents));
    return quiz.find(r => !parents.has(r.id) && r.value.data.id === history.state?.attemptId)?.value.data as { questions: { id: string }[]; answers: { questionId: string }[]; id: string };
  });
}

test('all 100 players and ten coaches are searchable with local country flags', async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { const u = new URL(r.url()); if (['https:', 'http:'].includes(u.protocol) && u.origin !== 'http://127.0.0.1:4173') external.push(u.href); });
  await page.goto('/#/takim');
  await expect(page.getByRole('heading', { name: '65 puan. Senin takımın.' })).toBeVisible();
  const names: string[] = [];
  for (const slot of [0, 1, 2, 4, 6]) {
    await page.locator(`#slot-${slot}`).click();
    names.push(...await page.locator('.player-option strong').allTextContents());
    for (const img of await page.locator('.player-option img').all()) await expect.poll(() => img.evaluate(i => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  expect(new Set(names).size).toBe(100);
  await page.locator('#slot-2').click(); await page.getByLabel('Ülkeye göre filtrele').selectOption('JP');
  await expect(page.locator('.player-option').first()).toContainText('Japonya');
  expect(await page.locator('.player-option').count()).toBeGreaterThan(0);
  await page.getByLabel('Oyuncu ara').fill('not-a-player'); await expect(page.getByText('Bu aramayla eşleşen seçenek yok.')).toBeVisible();
  await page.locator('#slot-7').click(); await expect(page.locator('.coach-option')).toHaveCount(10);
  await page.getByLabel('Koç ara').fill('akbas'); await expect(page.locator('.coach-option')).toHaveCount(1);
  await expect(page.locator('.coach-option')).toContainText('Ferhat Akbaş');
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

for (const width of [320, 360, 1440]) test(`65-point budget saved team at ${width}px keeps its UUID after reload and exports PNG`, async ({ page, browserName }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto('/#/takim');
  await expect(page.getByRole('button', { name: saveName })).toBeDisabled();
  await complete(page); await expect(page.locator('.budget-remaining')).toHaveText('Kalan: 15 / 65 puan');
  await page.getByRole('button', { name: saveName }).click();
  const url = await page.getByLabel(linkLabel).inputValue(); expect(url).toContain('v=2'); expect(new URLSearchParams(new URL(url).hash.split('?')[1]).get('t')).toMatch(/^[a-f0-9-]{36}$/);
  await page.reload(); await expect(page.getByLabel(linkLabel)).toHaveValue(url);
  await expect(page.locator('#slot-7')).toContainText('Daniele Santarelli');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir(artifactDir, { recursive: true }); await page.screenshot({ path: `${artifactDir}/${browserName}-team-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.locator('#share-preview img')).toHaveJSProperty('naturalWidth', 1080);
  const text = await page.getByLabel('Takım metni ve bağlantısı').inputValue();
  expect(text).toContain('Daniele Santarelli'); expect(text).toContain('50/65'); expect(text).toContain(challenge);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width === 1440) { const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'PNG indir', exact: true }).click(); await (await download).saveAs(`${artifactDir}/${browserName}-team-export.png`); }
});

test('replacement refunds cost, blocks duplicate selections and creates a new ID only after editing', async ({ page }) => {
  await page.goto('/#/takim'); await complete(page); await page.getByRole('button', { name: saveName }).click();
  const original = await page.getByLabel(linkLabel).inputValue();
  await page.getByRole('button', { name: saveName }).click(); await expect(page.getByLabel(linkLabel)).toHaveValue(original);
  await page.locator('#slot-0').click(); await expect(page.locator('.player-option').filter({ hasText: 'Cansu Özbay' })).toBeEnabled();
  await page.locator('#slot-3').click(); await expect(page.locator('.player-option').filter({ hasText: 'Hande Baladın' })).toBeDisabled();
  await pick(page, 1, 'Alexia Carutasu'); await expect(page.locator('.budget-remaining')).toHaveText('Kalan: 22 / 65 puan');
  await expect(page.getByLabel(linkLabel)).toHaveCount(0);
  await pick(page, 0, 'Cansu Özbay'); await expect(page.locator('.budget-remaining')).toHaveText('Kalan: 20 / 65 puan');
  await page.getByRole('button', { name: saveName }).click(); expect(await page.getByLabel(linkLabel).inputValue()).not.toBe(original);
  await page.locator('#slot-7').click(); await page.getByRole('button', { name: 'Seçimi kaldır', exact: true }).click();
  await expect(page.getByRole('button', { name: saveName })).toBeDisabled();
});

test('65-point boundary works in the picker, saved link, recipient and PNG; 66 is rejected', async ({ page }) => {
  await page.goto('/#/takim');
  const names = ['Alessia Orro', 'Paola Egonu', 'Gabi Guimarães', 'Mayu Ishikawa', 'Anna Danesi', 'Zehra Güneş', 'Simge Aköz'];
  for (let i = 0; i < names.length; i++) await pick(page, i, names[i]!);
  await pick(page, 7, 'Zhao Yong');
  await expect(page.locator('.budget-remaining')).toHaveText('Kalan: 0 / 65 puan');
  await page.locator('#slot-7').click();
  await expect(page.locator('.coach-option').filter({ hasText: 'Ferhat Akbaş' })).toBeDisabled();
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await page.getByRole('button', { name: saveName }).click();
  const url = await page.getByLabel(linkLabel).inputValue();
  await page.goto(url); await expect(page.locator('.budget-remaining')).toHaveText('Kalan: 0 / 65 puan');
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.locator('#share-preview img')).toHaveJSProperty('naturalWidth', 1080);
  await expect(page.getByLabel('Takım metni ve bağlantısı')).toHaveValue(/65\/65/);
  await page.goto(url.replace('coach-zhao', 'coach-akbas'));
  await expect(page.getByText('Bu takımın kadro veya puan sürümü artık kullanılamıyor.', { exact: false })).toBeVisible();
  await expect(page.locator('.budget-bar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' })).toHaveCount(0);
});

test('a saved 50-point-version record survives unchanged and its old link is not silently repriced', async ({ page }) => {
  const old = { schema: 1, id: 'budget-old', entity: 'lineup:budget', parents: [], createdAt: '2026-10-23T13:00:00.000Z',
    value: { kind: 'budget-team', data: { roster: 'world-20261023-v1', ids: indices.map(i => raw.roster.players[i]!.id), coachId: 'coach-santarelli', teamId: '12345678-1234-4234-8234-123456789abc' } } };
  await page.addInitScript(record => { if (!localStorage.getItem('voleybol:v1:record:budget-old')) localStorage.setItem('voleybol:v1:record:budget-old', JSON.stringify(record)); }, old);
  await page.goto('/#/takim');
  await expect(page.getByText('Puan sürümü değişti.', { exact: false })).toBeVisible();
  await expect(page.getByLabel(linkLabel)).toHaveCount(0);
  await expect(page.locator('.budget-remaining')).toHaveText('Kalan: 15 / 65 puan');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('voleybol:v1:record:budget-old')!))).toEqual(old);
  await page.getByRole('button', { name: saveName }).click();
  const url = await page.getByLabel(linkLabel).inputValue();
  expect(url).toContain('r=world-20261023-v2'); expect(url).not.toContain(old.value.data.teamId);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('voleybol:v1:record:budget-old')!))).toEqual(old);
  const oldUrl = `/#/takim?${new URLSearchParams({ v: '2', r: old.value.data.roster, p: old.value.data.ids.join(','), c: old.value.data.coachId, t: old.value.data.teamId })}`;
  await page.goto(oldUrl);
  await expect(page.getByText('Bu takımın kadro veya puan sürümü artık kullanılamıyor.', { exact: false })).toBeVisible();
  await expect(page.locator('.budget-bar')).toHaveCount(0);
});

test('a restored old-version draft reconciles another update before its first builder visit', async ({ page }) => {
  const old = { schema: 1, id: 'budget-old-home', entity: 'lineup:budget', parents: [], createdAt: '2026-10-23T13:00:00.000Z',
    value: { kind: 'budget-team', data: { roster: 'world-20261023-v1', ids: indices.map(i => raw.roster.players[i]!.id), coachId: 'coach-santarelli', teamId: '12345678-1234-4234-8234-123456789abc' } } };
  await page.addInitScript(record => localStorage.setItem('voleybol:v1:record:budget-old-home', JSON.stringify(record)), old);
  await page.goto('/'); await expect(page.locator('.team-path')).toBeVisible();
  const updated = structuredClone(raw); updated.revision++; updated.roster.version = 'world-home-update';
  updated.roster.players[1]!.id = 'real-new-setter'; updated.roster.players[2]!.id = 'real-new-opposite';
  await page.route('**/content.json', route => route.fulfill({ json: updated }));
  const refresh = page.waitForResponse('**/content.json');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await refresh;
  await page.locator('.team-path').click();
  await expect(page.locator('#slot-0')).toContainText('Oyuncu seç');
  await expect(page.locator('#slot-1')).toContainText('Oyuncu seç');
  await pick(page, 0, raw.roster.players[1]!.name); await pick(page, 1, raw.roster.players[2]!.name);
  await expect(page.getByRole('button', { name: saveName })).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('voleybol:v1:record:budget-old-home')!))).toEqual(old);
});

test('a fresh recipient sees a read-only shared team and explicitly chooses whether to copy it', async ({ page, browser }) => {
  await page.goto('/#/takim'); await complete(page); await page.getByRole('button', { name: saveName }).click(); const url = await page.getByLabel(linkLabel).inputValue();
  const context = await browser.newContext(); const recipient = await context.newPage();
  await recipient.clock.setFixedTime(new Date(Date.parse(raw.publishedAt) + 1000)); await recipient.goto(url);
  await expect(recipient.getByRole('heading', { name: challenge })).toBeVisible();
  await expect(recipient.locator('.slot-list li')).toHaveCount(8); await expect(recipient.locator('.slot-button')).toHaveCount(0);
  await expect(recipient.locator('.budget-remaining')).toHaveText('Kalan: 15 / 65 puan');
  expect(await recipient.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:')).length)).toBe(0);
  await recipient.getByRole('button', { name: 'Bu kadrodan kendi takımını kur' }).click();
  await expect(recipient.getByRole('region', { name: 'Taslağı değiştirme onayı' })).toBeVisible();
  await recipient.getByRole('button', { name: 'Bu takımla değiştir', exact: true }).click();
  await expect(recipient.locator('#slot-7')).toContainText('Daniele Santarelli');
  await recipient.getByRole('button', { name: saveName }).click(); expect(await recipient.getByLabel(linkLabel).inputValue()).not.toBe(url);
  await context.close();
});

test('rehosted Pages path creates a portable budget link and rejects old cost versions', async ({ page, request }) => {
  const base = 'https://aule-games.github.io/voleybol/';
  await page.route(`${base}**`, async route => { const remote = new URL(route.request().url()); const local = new URL(remote.pathname.slice('/voleybol'.length), 'http://127.0.0.1:4173'); await route.fulfill({ response: await request.get(local.href) }); });
  await page.goto(`${base}#/takim`); await complete(page); await page.getByRole('button', { name: saveName }).click();
  const url = await page.getByLabel(linkLabel).inputValue(); expect(url.startsWith(`${base}#/takim?`)).toBe(true);
  await page.goto(url); await expect(page.getByRole('heading', { name: challenge })).toBeVisible();
  await page.goto(url.replace(raw.roster.version, 'old-cost-version'));
  await expect(page.getByText('Bu takımın kadro veya puan sürümü artık kullanılamıyor.', { exact: false })).toBeVisible();
  await expect(page.locator('.budget-bar')).toHaveCount(0);
});

test('a new price version leaves the old saved record intact and requires an explicit new save', async ({ page }) => {
  await page.goto('/#/takim'); await complete(page); await page.getByRole('button', { name: saveName }).click();
  const original = await page.getByLabel(linkLabel).inputValue();
  const updated = structuredClone(raw); updated.revision++; updated.roster.version = 'world-new-costs'; updated.roster.players[1]!.cost = 3;
  await page.route('**/content.json', route => route.fulfill({ json: updated }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Puan sürümü değişti.', { exact: false })).toBeVisible();
  await expect(page.getByLabel(linkLabel)).toHaveCount(0); await expect(page.locator('.budget-remaining')).toHaveText('Kalan: 17 / 65 puan');
  await page.getByRole('button', { name: saveName }).click(); const next = await page.getByLabel(linkLabel).inputValue();
  expect(next).not.toBe(original); expect(next).toContain('r=world-new-costs');
  const versions = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:')).map(k => JSON.parse(localStorage.getItem(k)!)).filter(r => r.value.kind === 'budget-team').map(r => r.value.data.roster));
  expect(versions).toContain(raw.roster.version); expect(versions).toContain('world-new-costs');
});

for (const saved of [true, false]) test(`a live roster update clears incompatible IDs from a ${saved ? 'saved' : 'unsaved'} draft without trapping its pickers`, async ({ page }) => {
  await page.goto('/#/takim'); await complete(page);
  if (saved) await page.getByRole('button', { name: saveName }).click();
  const updated = structuredClone(raw); updated.revision++; updated.roster.version = 'world-replaced-players';
  updated.roster.players[1]!.id = 'real-replacement-setter'; updated.roster.players[2]!.id = 'real-replacement-opposite';
  updated.roster.coaches[0]!.id = 'coach-replacement';
  await page.route('**/content.json', route => route.fulfill({ json: updated }));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Puan sürümü değişti.', { exact: false })).toBeVisible();
  await expect(page.locator('#slot-0')).toContainText('Oyuncu seç');
  await expect(page.locator('#slot-1')).toContainText('Oyuncu seç');
  await expect(page.locator('#slot-7')).toContainText('Koç seç');
  await pick(page, 0, raw.roster.players[1]!.name); await pick(page, 1, raw.roster.players[2]!.name);
  await pick(page, 7, 'Daniele Santarelli');
  await expect(page.getByRole('button', { name: saveName })).toBeEnabled();
  await page.getByRole('button', { name: saveName }).click();
  await expect(page.getByLabel(linkLabel)).toHaveValue(/r=world-replaced-players/);
});

test('ten-question round persists selection before answering, shows both result states and avoids answered repeats', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 360, height: 900 }); await page.goto('/#/quiz');
  await expect(page.getByText('100 soruluk havuzdan 10 soru:', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Quiz’e başla', exact: true }).click();
  const original = await attempt(page); expect(original.questions).toHaveLength(10);
  await page.reload(); expect((await attempt(page)).questions).toEqual(original.questions);
  for (let i = 0; i < 10; i++) {
    await expect(page.getByText(`Soru ${i + 1}/10`, { exact: true })).toBeVisible();
    const q = raw.quiz.questions.find(q => q.id === original.questions[i]!.id)!;
    const choice = i === 0 ? q.choices.find(c => c.id !== q.correctId)!.id : q.correctId;
    await page.locator(`input[value="${choice}"]`).check();
    await expect(page.locator('.answer-choice.is-selected')).toContainText('Seçildi');
    await page.getByRole('button', { name: 'Cevabımı onayla', exact: true }).click();
    await expect(page.locator('.answer-choice.is-correct')).toContainText('✓ Doğru cevap');
    await expect(page.locator(`.quiz-feedback.${i === 0 ? 'incorrect' : 'correct'}`)).toBeVisible();
    await expect(page.locator('.question-source a')).toHaveAttribute('href', q.source.url);
    if (i <= 1) {
      await mkdir(artifactDir, { recursive: true }); await page.screenshot({ path: `${artifactDir}/${browserName}-quiz-${i === 0 ? 'wrong' : 'correct'}-360.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole('button', { name: i === 9 ? 'Sonucumu gör' : 'Sonraki soru', exact: true }).click();
  }
  await expect(page.locator('.quiz-score')).toHaveText('9 / 10'); await expect(page.locator('.explanation')).toHaveCount(10);
  await page.getByRole('button', { name: 'Yeniden dene', exact: true }).click(); const next = await attempt(page);
  expect(next.questions.some(q => original.questions.some(p => p.id === q.id))).toBe(false);
  await page.reload(); expect((await attempt(page)).id).toBe(next.id);
  await expect(page.getByText('Soru 1/10', { exact: true })).toBeVisible();
});

test('keyboard focus returns to the edited slot; reduced motion disables quiz feedback animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/#/takim');
  await page.locator('#slot-0').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#picker-0')).toBeFocused();
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click(); await expect(page.locator('#slot-0')).toBeFocused();
  await page.goto('/#/quiz'); await page.getByRole('button', { name: 'Quiz’e başla', exact: true }).click();
  await page.locator('input[name=quiz-answer]').first().check(); await page.getByRole('button', { name: 'Cevabımı onayla', exact: true }).click();
  expect(await page.locator('.quiz-feedback').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
});

test('Back and Forward across quiz rounds restore the referenced round consistently with reload', async ({ page }) => {
  await page.goto('/#/quiz'); await page.getByRole('button', { name: 'Quiz’e başla', exact: true }).click();
  const first = await attempt(page);
  for (let i = 0; i < 10; i++) {
    const question = raw.quiz.questions.find(q => q.id === first.questions[i]!.id)!;
    await page.locator(`input[value="${question.correctId}"]`).check();
    await page.getByRole('button', { name: 'Cevabımı onayla', exact: true }).click();
    await page.getByRole('button', { name: i === 9 ? 'Sonucumu gör' : 'Sonraki soru', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Yeniden dene', exact: true }).click();
  const second = await attempt(page); expect(second.id).not.toBe(first.id);
  const lastQuestion = raw.quiz.questions.find(q => q.id === first.questions[9]!.id)!;
  await page.goBack();
  await expect(page.locator('legend.question')).toHaveText(lastQuestion.text);
  await expect(page.locator('input[name=quiz-answer]').first()).toBeDisabled();
  await page.reload(); await expect(page.locator('legend.question')).toHaveText(lastQuestion.text);
  await page.goForward();
  const newQuestion = raw.quiz.questions.find(q => q.id === second.questions[0]!.id)!;
  await expect(page.locator('legend.question')).toHaveText(newQuestion.text);
  await expect(page.locator('input[name=quiz-answer]').first()).toBeEnabled();
  await page.reload(); await expect(page.locator('legend.question')).toHaveText(newQuestion.text);
});

test('a history entry whose quiz record is missing never displays a different round', async ({ page }) => {
  await page.goto('/#/quiz'); await page.getByRole('button', { name: 'Quiz’e başla', exact: true }).click();
  await page.evaluate(() => { history.replaceState({ attemptId: 'missing-round', questionIndex: 0 }, '', '#/quiz'); dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.getByTestId('message')).toContainText('Bu quiz denemesinin kaydı kullanılamıyor.');
  await expect(page.getByTestId('message')).toBeVisible();
  await expect(page.locator('legend.question')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Quiz’e başla', exact: true })).toBeVisible();
});

test('long international names keep full glyphs and safe bounds in the PNG', async ({ page, browserName }) => {
  const selected: typeof raw.roster.players = [];
  for (const role of ['setter', 'opposite', 'outside', 'outside', 'middle', 'middle', 'libero']) selected.push(raw.roster.players.filter(p => p.role === role && !selected.some(s => s.id === p.id)).sort((a,b) => b.name.length - a.name.length)[0]!);
  await page.addInitScript(() => {
    const ink: { text: string; left: number; right: number; top: number; bottom: number }[] = [];
    Object.assign(window, { __internationalInk: ink });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      const m = this.measureText(text); ink.push({ text, left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight, top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent });
      original.call(this, text, x, y, ...(maxWidth === undefined ? [] : [maxWidth]) as []);
    };
  });
  const hash = `#/takim?${new URLSearchParams({ v: '2', r: raw.roster.version, p: selected.map(p => p.id).join(','), c: 'coach-guimaraes', t: '12345678-1234-4234-8234-123456789abc' })}`;
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto(`/${hash}`);
  await expect(page.locator('.budget-remaining')).toHaveText('Kalan: 15 / 65 puan');
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click(); await expect(page.locator('#share-preview img')).toHaveJSProperty('naturalWidth', 1080);
  const exported = await page.getByLabel('Takım metni ve bağlantısı').inputValue(); for (const p of selected) expect(exported).toContain(p.name);
  const ink = await page.evaluate(() => (window as unknown as { __internationalInk: { text: string; left: number; right: number; top: number; bottom: number }[] }).__internationalInk);
  for (const item of ink) { expect(item.left, item.text).toBeGreaterThanOrEqual(64); expect(item.right, item.text).toBeLessThanOrEqual(1016); expect(item.top, item.text).toBeGreaterThanOrEqual(64); expect(item.bottom, item.text).toBeLessThanOrEqual(1286); }
  expect(ink.some(i => i.text === 'Ka’aha’aina-')).toBe(true); expect(ink.some(i => i.text === 'Torres')).toBe(true);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'PNG indir', exact: true }).click(); await mkdir(artifactDir, { recursive: true }); await (await download).saveAs(`${artifactDir}/${browserName}-international-long-names.png`);
});
