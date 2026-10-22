import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { NOW, sample, TEAM } from '../fixtures.ts';

const teamRoute = `/#/takim?v=1&r=demo-v1&p=${TEAM.join(',')}`;
const recordKeys = () => Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:'));
type RenderProbe = { waiting: (() => void)[]; created: string[]; revoked: string[]; names: string[] };

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
  await page.route('**/content.json', route => route.fulfill({ json: sample() }));
});

async function visibility(page: Page, hidden: boolean) {
  await page.evaluate(hidden => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: hidden ? 'hidden' : 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}
async function prepare(page: Page) {
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.getByLabel('Takım metni ve bağlantısı')).toBeVisible();
}

// Lifecycle events are injected at the DOM boundary, not proof of actual OS suspension/BFCache admission.
for (const event of ['hide', 'pagehide']) test(`T08 ${event} cancels a pending save before restoration`, async ({ page }) => {
  await page.goto('/#/tahmin');
  const match = page.locator('.match-row').first();
  await match.getByRole('radio', { name: '3 – 0', exact: true }).check();
  let arrived = false;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/content.json', async route => { arrived = true; await gate; await route.fulfill({ json: sample() }).catch(() => {}); });
  await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect.poll(() => arrived).toBe(true);
  if (event === 'hide') await visibility(page, true);
  else await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  release();
  await expect(page.getByTestId('message')).not.toContainText('doğrulanıyor');
  expect(await page.evaluate(recordKeys)).toEqual([]);
  await expect(match.getByRole('radio', { name: '3 – 0', exact: true })).toBeChecked();
  await expect(match.getByText('Kaydedilmedi', { exact: true })).toBeVisible();
});

for (const restoration of ['visibility', 'pageshow']) test(`T08 ${restoration} after lock refreshes without replay`, async ({ page }) => {
  let requests = 0;
  await page.route('**/content.json', route => { requests++; return route.fulfill({ json: sample() }); });
  await page.goto('/#/tahmin');
  const match = page.locator('.match-row').first();
  await match.getByRole('radio', { name: '3 – 1', exact: true }).check();
  const before = requests;
  await visibility(page, true);
  await page.clock.setFixedTime(new Date(sample().fixtures[0]!.locksAt!));
  if (restoration === 'visibility') await visibility(page, false);
  else await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect.poll(() => requests).toBe(before + 1);
  await expect(match.getByRole('button', { name: 'Tahminimi kaydet' })).toBeDisabled();
  await expect(match.getByRole('radio', { name: '3 – 1', exact: true })).toBeChecked();
  expect(await page.evaluate(recordKeys)).toEqual([]);
});

test('T08 restoration after 24 hours closes stale editorial data even before the match lock', async ({ page }) => {
  const data = sample(); data.validUntil = data.rights.expiresAt = new Date(NOW + 3 * 86_400_000).toISOString();
  data.fixtures[0]!.startsAt = data.fixtures[0]!.locksAt = new Date(NOW + 2 * 86_400_000).toISOString();
  await page.route('**/content.json', route => route.fulfill({ json: data }));
  await page.goto('/#/tahmin'); const match = page.locator('.match-row').first();
  await match.getByRole('radio', { name: '3 – 0', exact: true }).check();
  await visibility(page, true); await page.clock.setFixedTime(new Date(NOW + 86_400_001)); await visibility(page, false);
  await expect(match.getByText(/İçeriğin doğrulama süresi doldu/)).toBeVisible();
  await expect(match.getByRole('button', { name: 'Tahminimi kaydet' })).toBeDisabled();
  await expect(match.getByRole('radio', { name: '3 – 0', exact: true })).toBeChecked();
  expect(await page.evaluate(recordKeys)).toEqual([]);
});

test('T10 corrected results recompute feedback without rewriting the saved pick', async ({ page }) => {
  await page.goto('/#/tahmin');
  const match = page.locator('.match-row').first();
  await match.getByRole('radio', { name: '3 – 0', exact: true }).check();
  await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('bu cihazda kayıtlı');
  const records = () => Object.entries(localStorage).filter(([key]) => key.startsWith('voleybol:v1:record:'));
  const original = await page.evaluate(records);
  const data = sample(); data.fixtures[0]!.state = 'final';
  for (const [index, score] of (['3-0', '3-2', '1-3'] as const).entries()) {
    data.revision++; data.fixtures[0]!.resultRevision = index + 1; data.fixtures[0]!.result = score;
    await page.route('**/content.json', route => route.fulfill({ json: data }));
    await page.getByRole('button', { name: 'Yenile', exact: true }).click();
    await page.getByRole('button', { name: 'Tahminlerim', exact: true }).click();
    await expect(page.locator('.result')).toHaveText(`${['Tam isabet', 'Kazanan doğru', 'Bu kez olmadı'][index]} · Sonuç: ${score}`);
    if (index) await expect(page.getByText('Sonuç düzeltildi; değerlendirme yeniden hesaplandı.')).toBeVisible();
    expect(await page.evaluate(records)).toEqual(original);
  }
});

// Regression: old schedule picks must be identified, not silently presented as current.
test('T10 a reschedule labels an older pick and requires explicit reopened confirmation', async ({ page }) => {
  await page.goto('/#/tahmin'); const match = page.locator('.match-row').first();
  await match.getByRole('radio', { name: '3 – 1', exact: true }).check();
  await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('bu cihazda kayıtlı');
  const data = sample(); data.revision++; data.fixtures[0]!.scheduleRevision++;
  data.fixtures[0]!.startsAt = data.fixtures[0]!.locksAt = new Date(NOW + 7_200_000).toISOString();
  data.fixtures[0]!.reopened = false;
  await page.route('**/content.json', route => route.fulfill({ json: data }));
  await page.getByRole('button', { name: 'Yenile', exact: true }).click();
  await expect(match.getByRole('button', { name: 'Tahmini yeniden kaydet' })).toBeDisabled();
  await page.getByRole('button', { name: 'Tahminlerim', exact: true }).click();
  await expect(page.getByText(/önceki takvim sürümüne ait/)).toBeVisible();
  data.revision++; data.fixtures[0]!.reopened = true;
  await page.getByRole('button', { name: 'Yenile', exact: true }).click();
  await page.getByRole('button', { name: 'Yaklaşan maçlar', exact: true }).click();
  await expect(match.getByRole('button', { name: 'Tahmini yeniden kaydet' })).toBeEnabled();
  expect(await page.evaluate(recordKeys)).toHaveLength(1);
  await match.getByRole('button', { name: 'Tahmini yeniden kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('bu cihazda kayıtlı');
  await page.getByRole('button', { name: 'Tahminlerim', exact: true }).click();
  await expect(page.getByText(/önceki takvim sürümüne ait/)).toHaveCount(0);
  await expect(page.getByText('Tahminin: 3-1 · Takvim sürümü 2', { exact: true })).toBeVisible();
});

async function delayCanvas(page: Page) {
  await page.addInitScript(() => {
    const state: RenderProbe = { waiting: [], created: [], revoked: [], names: [] };
    Object.defineProperty(window, '__renderProbe', { value: state });
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
      toBlob.call(this, blob => { state.waiting.push(() => callback(blob)); }, ...args);
    };
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(...args) { state.names.push(args[0]); fillText.apply(this, args); };
    const create = URL.createObjectURL; URL.createObjectURL = blob => { const url = create(blob); state.created.push(url); return url; };
    const revoke = URL.revokeObjectURL; URL.revokeObjectURL = url => { state.revoked.push(url); revoke(url); };
  });
}
for (const change of ['lineup', 'navigation', 'hide', 'pagehide', 'content', 'expiry']) test(`T17 delayed canvas is discarded after ${change}`, async ({ page }) => {
  await delayCanvas(page); await page.goto(teamRoute);
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __renderProbe: RenderProbe }).__renderProbe.waiting.length)).toBe(1);
  if (change === 'lineup') await page.evaluate(hash => { location.hash = hash; }, `#/takim?v=1&r=demo-v1&p=${['p2', ...TEAM.slice(1)].join(',')}`);
  if (change === 'navigation') {
    // Fulfil the encoder between URL change and hashchange delivery.
    await page.evaluate(() => { location.hash = '#/quiz'; (window as unknown as { __renderProbe: RenderProbe }).__renderProbe.waiting.shift()!(); });
    await expect(page.locator('main[data-mode="quiz"]')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __renderProbe: RenderProbe }).__renderProbe.created)).toEqual([]);
    return;
  }
  if (change === 'hide') await visibility(page, true);
  if (change === 'pagehide') await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  if (change === 'content') {
    const next = sample(); next.revision++; next.rightsRevision++; next.rights.withdrawnIds = ['p1']; next.roster.players = next.roster.players.filter(p => p.id !== 'p1');
    await page.route('**/content.json', route => route.fulfill({ json: next }));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await expect(page.getByText(/Bazı oyuncular artık kullanılamıyor/)).toBeVisible();
  }
  if (change === 'expiry') await page.clock.setFixedTime(new Date(NOW + 60_000));
  await page.evaluate(() => (window as unknown as { __renderProbe: RenderProbe }).__renderProbe.waiting.shift()!());
  if (change === 'lineup') await expect(page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' })).toBeEnabled();
  else await expect(page.getByTestId('message')).toContainText('doğrulaması sona erdi');
  await expect(page.locator('#share-preview')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __renderProbe: RenderProbe }).__renderProbe.created)).toEqual([]);
});

test('T17 replacing a preview revokes its URL and keeps image/text/link selection aligned', async ({ page }) => {
  await delayCanvas(page); await page.goto(teamRoute);
  for (const ids of [TEAM, ['p2', ...TEAM.slice(1)]]) {
    await page.evaluate(hash => { location.hash = hash; }, `#/takim?v=1&r=demo-v1&p=${ids.join(',')}`);
    await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __renderProbe: RenderProbe }).__renderProbe.waiting.length)).toBe(1);
    await page.evaluate(() => (window as unknown as { __renderProbe: RenderProbe }).__renderProbe.waiting.shift()!());
    const field = page.getByLabel('Takım metni ve bağlantısı'); await expect(field).toBeVisible();
    const value = await field.inputValue();
    for (const id of ids) expect(value).toContain(sample().roster.players.find(p => p.id === id)!.name);
    expect(new URLSearchParams(new URL(value.split('\n').at(-1)!).hash.split('?')[1]).get('p')).toBe(ids.join(','));
    await expect(page.locator('.share-preview img')).toHaveJSProperty('naturalWidth', 1080);
  }
  const state = await page.evaluate(() => (window as unknown as { __renderProbe: RenderProbe }).__renderProbe);
  expect(state.created).toHaveLength(2); expect(state.revoked).toEqual([state.created[0]]);
  expect(state.names).toContain(sample().roster.players.find(p => p.id === 'p2')!.name);
  await page.getByRole('navigation').getByRole('link', { name: 'Quiz', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __renderProbe: RenderProbe }).__renderProbe.revoked)).toEqual(state.created);
});

// Regressions: clipboard failures need visible recovery; encoder failures cannot strand preparation.
for (const behavior of ['missing', 'denied', 'throws']) test(`T19 clipboard ${behavior} leaves visible selectable recovery`, async ({ page }) => {
  await page.addInitScript(behavior => {
    Object.defineProperty(navigator, 'clipboard', { value: behavior === 'missing' ? undefined : { writeText() {
      if (behavior === 'throws') throw new DOMException('Denied', 'NotAllowedError');
      return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    } } });
  }, behavior);
  await page.goto(teamRoute); await prepare(page);
  await page.getByRole('button', { name: 'Bağlantıyı kopyala' }).click();
  await expect(page.getByTestId('message')).toContainText('metinden seçip kopyala');
  const field = page.getByLabel('Takım metni ve bağlantısı'); await expect(field).toBeFocused();
  expect(await field.evaluate((e: HTMLTextAreaElement) => e.selectionEnd - e.selectionStart)).toBeGreaterThan(20);
});

for (const behavior of ['throws', 'null']) test(`T19 canvas ${behavior} offers text/link fallback without a stuck spinner`, async ({ page }) => {
  await page.addInitScript(behavior => {
    HTMLCanvasElement.prototype.toBlob = function(callback) {
      if (behavior === 'throws') throw new DOMException('Encoding failed', 'SecurityError');
      callback(null);
    };
  }, behavior);
  await page.goto(teamRoute); await prepare(page);
  await expect(page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' })).toBeEnabled();
  await expect(page.locator('#share-preview')).toContainText('Görsel oluşturulamadı');
  await expect(page.getByRole('button', { name: 'PNG indir' })).toHaveCount(0);
});

for (const outcome of ['NotAllowedError', 'DataError', 'Error', 'sync', 'unsupported', 'capability-throws']) test(`T19 native ${outcome} never auto-retries and retains fallback`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(outcome => {
    Object.defineProperty(window, '__shareCalls', { value: { count: 0 } });
    Object.defineProperty(navigator, 'canShare', { value: () => {
      if (outcome === 'capability-throws') throw new Error('Capability unavailable');
      return outcome !== 'unsupported';
    } });
    Object.defineProperty(navigator, 'share', { value: () => {
      (window as unknown as { __shareCalls: { count: number } }).__shareCalls.count++;
      if (outcome === 'sync') throw new TypeError('Share unavailable');
      return Promise.reject(outcome === 'Error' ? new Error('Unknown') : new DOMException('Unavailable', outcome));
    } });
  }, outcome);
  await page.goto(teamRoute); await prepare(page);
  if (outcome === 'unsupported' || outcome === 'capability-throws') await expect(page.getByRole('button', { name: 'Paylaş…', exact: true })).toHaveCount(0);
  else {
    await page.getByRole('button', { name: 'Paylaş…', exact: true }).click();
    await expect(page.getByTestId('message')).toContainText('hedef uygulamayı kontrol et');
  }
  await expect(page.getByRole('button', { name: 'PNG indir' })).toBeVisible();
  await expect(page.getByLabel('Takım metni ve bağlantısı')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __shareCalls: { count: number } }).__shareCalls.count)).toBe(['unsupported', 'capability-throws'].includes(outcome) ? 0 : 1);
  expect(errors).toEqual([]);
});
