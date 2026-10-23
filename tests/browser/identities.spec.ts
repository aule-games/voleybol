import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import raw from '../../public/content.json' with { type: 'json' };
import { COACH_IDENTITIES, PLAYER_AFFILIATIONS, TEAM_IDENTITIES } from '../../src/data/affiliations.ts';

const artifacts = '.gstack/qa-reports/affiliations-complete-20261023';
test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date(Date.parse(raw.publishedAt) + 1000)); });

// Keep each exhaustive role check within its own unchanged 30-second test budget.
for (const [slot, role] of [[0, 'setter'], [1, 'opposite'], [2, 'outside'], [4, 'middle'], [6, 'libero']] as const) test(`reviewed ${role} clubs load locally at narrow widths`, async ({ page }) => {
  const external: string[] = []; const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (new URL(r.url()).origin !== 'http://127.0.0.1:4173') external.push(r.url()); });
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto('/#/takim');
  await page.locator(`#slot-${slot}`).click();
  for (const player of raw.roster.players.filter(p => p.role === role)) {
    const option = page.locator('.player-option').filter({ has: page.locator('strong', { hasText: new RegExp(`^${player.name}$`) }) });
    const affiliation = PLAYER_AFFILIATIONS[player.id];
    const club = affiliation ? (affiliation.teamId ? TEAM_IDENTITIES[affiliation.teamId] : undefined) : TEAM_IDENTITIES[player.clubId];
    if (club) {
      await expect(option.locator('.identity-badge.club')).toHaveText(club.name);
      if (club.mark) {
        await expect(option.locator('.identity-badge.club img')).toHaveJSProperty('complete', true);
        await expect.poll(() => option.locator('.identity-badge.club img').evaluate(i => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      } else await expect(option).toContainText('Arma doğrulanmadı');
    } else { await expect(option.locator('.club')).toHaveCount(0); await expect(option).toContainText(affiliation?.note ?? 'Kulüp bilgisi doğrulanmadı'); }
    if (affiliation?.note) await expect(option.locator('.identity-note')).toHaveText(affiliation.note);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('reviewed coach employers load locally at narrow widths', async ({ page, browserName }) => {
  const external: string[] = []; const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (new URL(r.url()).origin !== 'http://127.0.0.1:4173') external.push(r.url()); });
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto('/#/takim');
  await page.locator('#slot-7').click();
  for (const coach of raw.roster.coaches) {
    const option = page.locator('.coach-option').filter({ hasText: coach.name });
    const identity = COACH_IDENTITIES[coach.id]!;
    await expect(option.locator('.coach-origin')).toHaveText(`Köken:${identity.originLabel}`);
    for (const [field, a] of [['club', identity.club], ['national', identity.nationalTeam]] as const) {
      if (a.teamId) {
        await expect(option.locator(`.coach-${field} .club`)).toHaveText(TEAM_IDENTITIES[a.teamId]!.name);
        await expect(option.locator(`.coach-${field}`)).toContainText(a.role!);
      } else await expect(option.locator(`.coach-${field}`)).toContainText('Güncel kulüp görevi doğrulanmadı');
    }
    for (const img of await option.locator('img').all()) await expect.poll(() => img.evaluate(i => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  const akbas = page.locator('.coach-option').filter({ hasText: 'Ferhat Akbaş' });
  await expect(akbas.locator('.country')).toHaveText('Türk'); await expect(akbas.locator('.club')).toHaveText('Japonya Millî Takımı');
  await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: `${artifacts}/${browserName}-coach-mobile.png`, fullPage: true });
  await akbas.click(); await expect(page.locator('#slot-7 .coach-identity img')).toHaveCount(2); await expect(page.locator('.coach-bench .coach-identity img')).toHaveCount(2);
  await page.locator('#slot-2').click(); await page.getByLabel('Ülkeye göre filtrele').selectOption('BR');
  await page.screenshot({ path: `${artifacts}/${browserName}-players-mobile.png`, fullPage: true });
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('shared lineup preserves international identities on reload without touching the draft', async ({ page, browserName }) => {
  const ids = ['real-jp-seki', 'real-it-antropova', 'real-br-julia-bergmann', 'real-it-omoruyi', 'real-it-sartori', 'real-it-akrari', 'real-jp-fukudome'];
  const params = new URLSearchParams({ v: '2', r: raw.roster.version, p: ids.join(','), c: 'coach-akbas', t: '12345678-1234-4234-8234-123456789abc' });
  await page.goto(`/#/takim?${params}`);
  await expect(page.getByRole('heading', { name: 'Benim kurduğum takım bu, katılıyor musun?' })).toBeVisible();
  await expect(page.locator('.slot-list .club')).toHaveCount(8);
  await expect(page.locator('.court .club')).toHaveCount(7);
  await expect(page.locator('.coach-bench .club')).toHaveText('Japonya Millî Takımı');
  await page.reload(); await expect(page.locator('.slot-list .club')).toHaveCount(8);
  await mkdir(artifacts, { recursive: true }); await page.screenshot({ path: `${artifacts}/${browserName}-shared-desktop.png`, fullPage: true });
  expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('voleybol:v1:record:')))).toEqual([]);
});

test('blocked local crests keep the full club and country labels', async ({ page }) => {
  await page.route('**/marks/**', route => route.abort()); await page.goto('/#/takim');
  await page.locator('#slot-0').click();
  const seki = page.locator('.player-option').filter({ hasText: 'Nanami Seki' });
  await expect(seki).toContainText('Japonya'); await expect(seki).toContainText('UYBA Busto Arsizio');
  await expect(seki.locator('img').first()).toBeHidden();
  await page.locator('#slot-7').click();
  const velasco = page.locator('.coach-option').filter({ hasText: 'Julio Velasco' });
  await expect(velasco).toContainText('Arjantin'); await expect(velasco).toContainText('İtalya Millî Takımı');
});

test('dual appointments remain visible in selected, court and imported coach cards', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/#/takim'); await page.locator('#slot-7').click();
  await page.locator('.coach-option').filter({ hasText: 'Daniele Santarelli' }).click();
  for (const card of [page.locator('#slot-7'), page.locator('.coach-bench')]) {
    await expect(card.locator('.coach-origin')).toHaveText('Köken:İtalyan');
    await expect(card.locator('.coach-club')).toContainText('Imoco Conegliano');
    await expect(card.locator('.coach-national')).toContainText('Türkiye Millî Takımı');
    await expect(card.locator('.coach-national .identity-name')).toBeVisible();
  }
  expect((await page.locator('#slot-7 .coach-identity').boundingBox())!.width).toBeGreaterThan(190);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await mkdir(artifacts, { recursive: true }); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${artifacts}/${browserName}-santarelli-mobile.png`, fullPage: true });
  const ids = ['real-jp-seki', 'real-it-antropova', 'real-br-julia-bergmann', 'real-it-omoruyi', 'real-it-sartori', 'real-it-akrari', 'real-jp-fukudome'];
  const params = new URLSearchParams({ v: '2', r: raw.roster.version, p: ids.join(','), c: 'coach-barbolini', t: '12345678-1234-4234-8234-123456789abc' });
  await page.goto(`/#/takim?${params}`);
  await expect(page.locator('.coach-bench .coach-national')).toContainText('Yardımcı antrenör');
  await expect(page.locator('.coach-bench .coach-club')).toContainText('Igor Gorgonzola Novara');
  await page.reload(); await expect(page.locator('.coach-bench .coach-national')).toContainText('Yardımcı antrenör');
});

test('ended contracts, retirement and historical seasons cannot masquerade as current clubs', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 900 }); await page.goto('/#/takim');
  await page.locator('#slot-2').click(); await page.getByLabel('Oyuncu ara').fill('Łukasik');
  const lukasik = page.locator('.player-option');
  await expect(lukasik).toContainText('SAGA sözleşmesi sona erdi'); await expect(lukasik.locator('.club')).toHaveCount(0);
  await lukasik.click(); await expect(page.locator('#slot-2')).toContainText('Yeni kulüp doğrulanmadı');
  await page.locator('#slot-4').click(); await page.getByLabel('Oyuncu ara').fill('Korneluk');
  await expect(page.locator('.player-option')).toContainText('Aktif kariyerini sonlandırdı');
  await expect(page.locator('.player-option .club')).toHaveCount(0);
  await page.locator('.player-option').click();
  await page.locator('#slot-0').click(); await page.getByLabel('Oyuncu ara').fill('Zhang Zixuan');
  await expect(page.locator('.player-option')).toContainText('Son doğrulanan sezon: 2025–26');
  await page.locator('.player-option').click();
  await expect(page.locator('#slot-0 .identity-note')).toContainText('Yeni sezon doğrulanmadı');
  await expect(page.locator('.court .identity-note').filter({ hasText: 'Son kayıt: 2025–26' })).toBeVisible();
  await expect(page.locator('.court .identity-note').first()).toHaveCSS('color', 'rgb(243, 232, 237)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await mkdir(artifacts, { recursive: true }); await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${artifacts}/${browserName}-status-mobile.png`, fullPage: true });
  await page.getByText('Oyuncu, koç ve puan kaynakları',{exact:true}).click();
  await expect(page.locator('.guide')).toContainText('100/100 oyuncunun kaydı incelendi');
  await expect(page.locator('.guide')).toContainText('6 eski sezon/tarihli kayıt');
});
