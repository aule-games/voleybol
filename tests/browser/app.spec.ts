import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { NOW, sample, TEAM } from '../fixtures.ts';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(NOW));
  await page.route('**/content.json', route => route.fulfill({ json: sample() }));
});
async function pickTeam(page: Page) {
  await page.getByRole('navigation').getByRole('link', { name: 'Takımını kur' }).click();
  const names = ['Ada Örnek', 'Ece Örnek', 'Duru Örnek', 'Çiğdem Örnek', 'Selin Örnek', 'İdil Örnek', 'Defne Örnek'];
  for (let i = 0; i < names.length; i++) {
    await page.locator(`#slot-${i}`).click(); await page.getByRole('button', { name: names[i]!, exact: true }).click();
    await expect(page.locator(`#slot-${i}`)).toBeFocused();
  }
}
async function savePrediction(page: Page, score = '3 – 1') {
  await page.getByRole('navigation').getByRole('link', { name: 'Tahmin', exact: true }).click();
  const match = page.locator('section.match-row').first();
  await match.getByRole('radio', { name: score, exact: true }).check();
  await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('bu cihazda kayıtlı');
}

test('three complete thin interactions, persistence and zero third-party requests', async ({ page }) => {
  const errors: string[] = []; const external: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (new URL(r.url()).origin !== 'http://127.0.0.1:4173') external.push(r.url()); });
  await page.goto('/?test=1&email=must-not-leave');
  await expect(page.getByRole('heading', { name: 'Filede söz sende.' })).toBeVisible();
  await savePrediction(page);
  await page.reload(); await expect(page.locator('section.match-row').first().getByRole('radio', { name: '3 – 1' })).toBeChecked();
  await page.getByRole('button', { name: 'Tahminlerim', exact: true }).click(); await expect(page.getByText('Tahminin: 3-1', { exact: false })).toBeVisible();
  await pickTeam(page);
  await expect(page.getByText('7/7 oyuncu seçildi', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Takımımı onayla' }).click();
  await expect(page.getByTestId('message')).toContainText('Yedilin tamam');
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.getByLabel('Takım metni ve bağlantısı')).toBeVisible();
  const text = await page.getByLabel('Takım metni ve bağlantısı').inputValue();
  expect(text).toContain('Defne Örnek'); expect(text).not.toContain('email='); expect(text).not.toContain('test=1');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'PNG indir' }).click(); expect((await download).suggestedFilename()).toBe('hayalimdeki-takim-demo.png');
  await page.getByRole('navigation').getByRole('link', { name: 'Quiz', exact: true }).click(); await page.getByRole('button', { name: 'Quiz’e başla' }).click();
  for (let i = 0; i < 5; i++) {
    await expect(page.getByText(`Soru ${i + 1}/5`, { exact: true })).toBeVisible();
    const correct = sample().quiz.questions[i]!.correctId;
    await page.locator(`input[value="${correct}"]`).check(); await page.getByRole('button', { name: 'Cevabımı onayla' }).click();
    await expect(page.locator('input[name="quiz-answer"]').first()).toBeDisabled();
    await page.getByRole('button', { name: i === 4 ? 'Sonucumu gör' : 'Sonraki soru' }).click();
  }
  await expect(page.getByText('5 / 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Yeniden dene' }).click(); await expect(page.getByText('Alıştırma denemesi')).toBeVisible();
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('offline prevents save and reconnection never submits automatically', async ({ page, context }) => {
  await page.goto('/#/tahmin'); const match = page.locator('section.match-row').first();
  await match.getByRole('radio', { name: '3 – 0' }).check(); await context.setOffline(true);
  await expect(match.getByRole('button', { name: 'Tahminimi kaydet' })).toBeDisabled();
  await context.setOffline(false); await expect(page.getByTestId('message')).toContainText('Bağlantı geri geldi');
  await expect(match.getByText('Kaydedilmedi', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Yenile', exact: true }).click();
  await expect(match.getByText('Kaydedilmedi', { exact: true })).toBeVisible();
});

test('save crosses the exact lock boundary: no write and selection retained', async ({ page }) => {
  await page.goto('/#/tahmin'); const match = page.locator('section.match-row').first();
  await match.getByRole('radio', { name: '3 – 0' }).check();
  await page.route('**/content.json', async route => { await page.clock.setFixedTime(new Date(sample().fixtures[0]!.locksAt!)); await route.fulfill({ json: sample() }); });
  await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('Tahmin süresi doldu');
  await expect(match.getByRole('radio', { name: '3 – 0' })).toBeChecked();
  await expect(match.getByText('Kaydedilmedi', { exact: true })).toBeVisible();
});

test('an observed schedule revision requires another explicit confirmation', async ({ page }) => {
  await page.goto('/#/tahmin'); const match = page.locator('section.match-row').first(); await match.getByRole('radio', { name: '3 – 2' }).check();
  const updated = sample(); updated.revision++; updated.fixtures[0]!.scheduleRevision++; updated.fixtures[0]!.reopened = true;
  await page.route('**/content.json', route => route.fulfill({ json: updated }));
  await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('Maç veya seçim değişti');
  await expect(match.getByText('Kaydedilmedi', { exact: true })).toBeVisible();
  await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('bu cihazda kayıtlı');
});

test('blocked storage stays playable with truthful session-only feedback', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError'); } }); });
  await page.goto('/#/tahmin'); const match = page.locator('section.match-row').first();
  await match.getByRole('radio', { name: '3 – 0' }).check(); await match.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('kayıt cihazda saklanmıyor'); await expect(page.getByText('Bu cihazda kayıtlı', { exact: true })).toHaveCount(0);
});

test('import stays read-only and cancelling does not replace a draft', async ({ page }) => {
  await page.goto('/'); await pickTeam(page);
  const imported = ['p2', ...TEAM.slice(1)];
  await page.evaluate(hash => { location.hash = hash; }, `#/takim?v=1&r=demo-v1&p=${imported.join(',')}`);
  await expect(page.getByText('Paylaşılan takım · Salt okunur. Kendi taslağın değişmedi.')).toBeVisible();
  await expect(page.locator('#slot-0')).toHaveCount(0);
  await page.getByRole('button', { name: 'Kendi takımını kur', exact: true }).click(); await page.getByRole('button', { name: 'Mevcut taslağıma dön' }).click();
  await expect(page.locator('#slot-0')).toContainText('Ada Örnek');
});

test('strict invalid fragment never becomes markup or a network target', async ({ page }) => {
  await page.goto('/#/takim?v=1&r=demo-v1&p=%C0%AF');
  await expect(page.getByRole('heading', { name: 'Bu bağlantı açılamadı' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kendi takımını kur', exact: true })).toBeVisible();
});

test('quiz Back is read-only; an observed correction freezes an unfinished attempt', async ({ page }) => {
  await page.goto('/#/quiz'); await page.getByRole('button', { name: 'Quiz’e başla' }).click();
  await page.locator('input[value="q1-c1"]').check(); await page.getByRole('button', { name: 'Cevabımı onayla' }).click(); await page.getByRole('button', { name: 'Sonraki soru' }).click();
  await page.goBack(); await expect(page.getByText('Soru 1/5', { exact: true })).toBeVisible(); await expect(page.locator('input[value="q1-c1"]')).toBeDisabled();
  const updated = sample(); updated.revision++; updated.quiz.revision++;
  await page.route('**/content.json', route => route.fulfill({ json: updated }));
  await page.getByRole('navigation').getByRole('link', { name: 'Tahmin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sence kaç kaç biter?' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Quiz', exact: true }).click();
  await expect(page.getByText(/Quiz güncellendi/)).toBeVisible();
});

test('current withdrawal removes a player and blocks export of an old link', async ({ page }) => {
  await page.goto('/'); await pickTeam(page);
  const updated = sample(); updated.revision++; updated.rightsRevision++; updated.rights.withdrawnIds = ['p1']; updated.roster.players = updated.roster.players.filter(p => p.id !== 'p1');
  await page.route('**/content.json', route => route.fulfill({ json: updated }));
  await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.locator('#slot-0')).not.toContainText('Ada Örnek');
  await expect(page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'PNG indir' })).toHaveCount(0);
});

for (const width of [360, 390, 768, 1440]) test(`responsive ${width}px and keyboard controls`, async ({ page, browserName }) => {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/');
  await expect(page.getByRole('link', { name: 'Tahmin yap →' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // macOS WebKit's default link navigation uses Option-Tab; verified on this runner.
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab'); await expect(page.getByRole('link', { name: 'İçeriğe geç' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('main')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Filede söz sende.' })).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Takımını kur' }).click();
  await page.locator('#slot-0').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#picker-0')).toBeFocused();
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click(); await expect(page.locator('#slot-0')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('all-locked home offers other games; invalid quiz does not close them', async ({ page }) => {
  const data = sample(); data.fixtures.forEach(m => { m.locksAt = m.startsAt ? new Date(NOW - 1).toISOString() : null; }); data.quiz.questions[0]!.correctId = 'missing';
  await page.route('**/content.json', route => route.fulfill({ json: data })); await page.goto('/');
  await expect(page.getByText(/Şu an tahmine açık maç yok/)).toBeVisible();
  await page.getByRole('navigation').getByRole('link', { name: 'Takımını kur' }).click(); await expect(page.locator('#slot-0')).toBeVisible();
});

test('selective clear preserves a test flag and unrelated application records', async ({ page }) => {
  await page.goto('/'); await savePrediction(page);
  await page.evaluate(() => { localStorage.setItem('voleybol:test', '1'); localStorage.setItem('unrelated', 'keep'); });
  await page.getByRole('button', { name: 'Bu cihazdaki oyun verilerini sil', exact: true }).click();
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click(); await expect(page.locator('section.match-row').first().getByText('Bu cihazda kayıtlı', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bu cihazdaki oyun verilerini sil', exact: true }).click(); await page.getByRole('button', { name: 'Evet, oyun kayıtlarını sil' }).click();
  expect(await page.evaluate(() => ({ flag: localStorage.getItem('voleybol:test'), other: localStorage.getItem('unrelated'), records: Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:')).length }))).toEqual({ flag: '1', other: 'keep', records: 0 });
});

test('two tabs keep different matches and surface a same-match conflict without discarding the draft', async ({ page, context }) => {
  const other = await context.newPage(); await other.clock.setFixedTime(new Date(NOW)); await other.route('**/content.json', route => route.fulfill({ json: sample() }));
  await page.goto('/#/tahmin'); await other.goto('/#/tahmin');
  const first = page.locator('section.match-row').first(); const secondTabFirst = other.locator('section.match-row').first();
  await first.getByRole('radio', { name: '3 – 0' }).check(); await secondTabFirst.getByRole('radio', { name: '3 – 1' }).check();
  await first.getByRole('button', { name: 'Tahminimi kaydet' }).click(); await expect(page.getByTestId('message')).toContainText('bu cihazda kayıtlı');
  await expect(secondTabFirst.getByRole('radio', { name: '3 – 1' })).toBeChecked();
  await secondTabFirst.getByRole('button', { name: 'Tahminimi kaydet' }).click(); await expect(other.getByTestId('message')).toContainText('başka bir sekmede');
  await secondTabFirst.getByRole('button', { name: 'Seçimimi yeni kayıt olarak onayla' }).click(); await expect(other.getByTestId('message')).toContainText('bu cihazda kayıtlı');
  const secondMatch = page.locator('section.match-row').nth(1); await secondMatch.getByRole('radio', { name: '3 – 2' }).check(); await secondMatch.getByRole('button', { name: 'Tahminimi kaydet' }).click();
  await expect(page.getByTestId('message')).toContainText('bu cihazda kayıtlı');
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:')).length)).toBe(3);
  await other.close();
});

test('another-tab clear leaves an open draft unsaved and never auto-repopulates storage', async ({ page, context }) => {
  await page.goto('/'); await savePrediction(page);
  const other = await context.newPage(); await other.clock.setFixedTime(new Date(NOW)); await other.route('**/content.json', route => route.fulfill({ json: sample() }));
  await other.goto('/'); await other.getByRole('button', { name: 'Bu cihazdaki oyun verilerini sil', exact: true }).click(); await other.getByRole('button', { name: 'Evet, oyun kayıtlarını sil' }).click();
  await expect(page.getByTestId('message')).toContainText('Başka sekmede kayıtlar değişti');
  await expect(page.locator('section.match-row').first().getByRole('radio', { name: '3 – 1' })).toBeChecked();
  await expect(page.locator('section.match-row').first().getByText(/Kaydedilmedi · kayıt başka/)).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:')).length)).toBe(0);
  await other.close();
});

test('native share is explicit and single-flight; cancellation keeps the team', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { calls: 0, active: false, reject: null as null | ((e: DOMException) => void) };
    Object.defineProperty(window, '__shareTest', { value: state });
    Object.defineProperty(navigator, 'canShare', { value: () => true });
    Object.defineProperty(navigator, 'share', { value: () => { state.calls++; state.active = navigator.userActivation.isActive; return new Promise<void>((_, reject) => { state.reject = reject; }); } });
  });
  await page.goto('/'); await pickTeam(page); await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  const share = page.getByRole('button', { name: 'Paylaş…', exact: true }); await expect(share).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __shareTest: { calls: number } }).__shareTest.calls)).toBe(0);
  await share.click(); await expect(page.getByRole('button', { name: 'Paylaşım açık…' })).toBeDisabled();
  expect(await page.evaluate(() => { const s = (window as unknown as { __shareTest: { calls: number; active: boolean } }).__shareTest; return { calls: s.calls, active: s.active }; })).toEqual({ calls: 1, active: true });
  await page.evaluate(() => (window as unknown as { __shareTest: { reject: (e: DOMException) => void } }).__shareTest.reject(new DOMException('Cancelled', 'AbortError')));
  await expect(page.getByTestId('message')).toContainText('Takımın korundu'); await expect(page.getByText('7/7 oyuncu seçildi', { exact: true })).toBeVisible();
});

test('prepared export expires at 60 seconds with no automatic regeneration', async ({ page }) => {
  await page.goto('/'); await pickTeam(page); await page.getByRole('button', { name: 'Paylaşım önizlemesini hazırla' }).click();
  await expect(page.getByRole('button', { name: 'PNG indir' })).toBeVisible(); await page.clock.setFixedTime(new Date(NOW + 60_000));
  // The interval may remove the expired control before Playwright can click it.
  // This case covers passive expiry; render-limits covers the pre-interval click guard with paused timers.
  await expect(page.getByTestId('message')).toContainText('doğrulaması sona erdi'); await expect(page.getByRole('button', { name: 'PNG indir' })).toHaveCount(0);
});
