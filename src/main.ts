import { playerIdentity, questionSource } from './ui/player.ts';
import './style.css';
import { ContentCoordinator } from './data/coordinator.ts';
import { currentPolicy } from './data/validate.ts';
import { SLOT_LABELS, SLOT_ROLES, SCORES } from './domain/types.ts';
import type { Attempt, Content, Fixture, Score } from './domain/types.ts';
import { eligibleFixtures, feedback, predictionBlock, PredictionSubmitter } from './domain/prediction.ts';
import { validateLineup } from './domain/lineup.ts';
import { attemptState, beginAttempt, confirmAnswer, scoreAttempt } from './domain/quiz.ts';
import { parseFragment, teamUrl } from './router.ts';
import { COPY } from './platform/result.ts';
import type { ErrorCode } from './platform/result.ts';
import { browserStorage, GameStore, heads, PREFIX } from './platform/storage.ts';
import { lineupText, preparedValid, renderTeamPng } from './platform/share.ts';
import type { PreparedTeam } from './platform/share.ts';
import { announce, button, dateTR, el, focus, heading, link, notice } from './ui/dom.ts';

const base = new URL(import.meta.env.BASE_URL, new URL('.', location.href));
const coordinator = new ContentCoordinator(new URL('content.json', base));
const submitter = new PredictionSubmitter(coordinator);
const store = new GameStore(browserStorage());
const main = document.querySelector<HTMLElement>('main')!;
let route = parseFragment(location.hash);
let generation = 0;
let loading = true;
let pending = false;
let contentError: ErrorCode | null = null;
let message = '';
let historyVisible = false;
type Selection = { score: Score; parents: string[]; savedId?: string };
const picks = new Map<string, Selection>();
let draft: string[] = Array(7).fill('');
let draftParents: string[] = [];
let draftSavedId: string | undefined;
let picker: number | null = null;
let overwrite = false;
let prepared: PreparedTeam | null = null;
let preparing = false;
let preparation: AbortController | null = null;
let sharing = false;
let attempt: Attempt | null = null;
let attemptParents: string[] = [];
let quizIndex = 0;
let tentative: string | null = null;
let quizConflict = false;
let stateLoaded = false;
let lastBlockSignature = '';

function content(): Content | null { return coordinator.snapshot; }
function visible(): boolean { return document.visibilityState !== 'hidden'; }
function usable(): Content | null { const c = content(); return c && currentPolicy(c, Date.now()) ? c : null; }
function say(text: string) { message = text; announce(text); }
function error(code: ErrorCode) { say(COPY[code]); }
function releasePreview() { if (prepared?.blobUrl) URL.revokeObjectURL(prepared.blobUrl); prepared = null; }
function changed() { generation++; preparation?.abort(); preparing = false; releasePreview(); }
function parentIds(entity: string): string[] { return heads(store.read().records, entity).map(r => r.id); }
function focusHeading() { main.querySelector<HTMLElement>('h1')?.focus(); }
function savedLabel(id: string | undefined): string {
  if (!id) return 'Kaydedilmedi';
  const view = store.read();
  return view.records.some(r => r.id === id) ? view.memoryOnly ? COPY.STORAGE_MEMORY : 'Bu cihazda kayıtlı' : 'Kaydedilmedi · kayıt başka bir sekmede silinmiş olabilir';
}
function loadSavedState() {
  if (stateLoaded || !content()) return; stateLoaded = true;
  const records = store.read().records;
  for (const match of content()!.fixtures) {
    const values = heads(records, `prediction:${match.id}`); const r = values[0];
    if (values.length === 1 && r?.value.kind === 'prediction') picks.set(match.id, { score: r.value.data.score, parents: [r.id], savedId: r.id });
  }
  const lineup = heads(records, 'lineup:own'); const last = lineup[0];
  draftParents = lineup.map(r => r.id);
  if (lineup.length === 1 && last?.value.kind === 'lineup' && content()!.roster?.version === last.value.data.roster) { draft = [...last.value.data.ids]; draftSavedId = last.id; }
  const attempts = records.filter(r => r.value.kind === 'quiz').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const record = attempts[0];
  if (record?.value.kind === 'quiz') {
    const versions = heads(records, record.entity);
    if (versions.length === 1 && versions[0]?.value.kind === 'quiz') { attempt = versions[0].value.data; attemptParents = [versions[0].id]; quizIndex = Math.min(attempt.answers.length, attempt.questions.length); }
  }
}
async function refresh() {
  loading = true; changed(); render();
  const result = await coordinator.refresh(); loading = false;
  contentError = result.ok ? null : result.error.code;
  loadSavedState(); render();
}
function modeFallback(text: string): HTMLElement {
  const block = el('section', undefined, 'empty-state'); block.append(notice(text, true), link('Takımını kur →', '#/takim', 'button'), link('Quiz’i dene →', '#/quiz', 'button secondary')); return block;
}
function render() {
  const snapshot = content();
  const banner = document.querySelector<HTMLElement>('.demo-banner')!;
  banner.replaceChildren(el('strong', snapshot?.schema === 2 ? 'Yerel test sürümü' : snapshot ? 'Kurgusal demo' : 'Özel prototip'),
    el('span', snapshot?.schema === 2 ? 'Gerçek oyuncular ve kaynaklı quiz. Tahmin maçları kurgusaldır. Resmî bir uygulama değildir.' : snapshot ? 'Gerçek sporcu, kulüp veya maç verisi içermez.' : 'İçerik doğrulanıyor.'));
  document.title = snapshot?.schema === 2 ? 'Filedeyiz · Yerel test' : 'Filedeyiz · Kurgusal demo';
  if (snapshot) lastBlockSignature = blockSignature(snapshot);
  main.replaceChildren();
  main.dataset.mode = route.ok ? route.value.mode : 'invalid';
  document.querySelectorAll<HTMLAnchorElement>('nav a').forEach(a => { if (route.ok && a.hash === `#/${route.value.mode}`) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  if (!route.ok) { main.append(heading('Bu bağlantı açılamadı', 'GÜVENLİ BAĞLANTI'), notice(COPY.LINK_INVALID, true), link('Kendi takımını kur', '#/takim', 'button')); return; }
  if (message) { const msg = notice(message); msg.setAttribute('data-testid', 'message'); main.append(msg); }
  const view = store.read();
  if (view.memoryOnly) main.append(notice(COPY.STORAGE_MEMORY, true));
  if (view.quarantined) main.append(notice(`${view.quarantined} bozuk veya uyumsuz kayıt uygulanmadı; diğer kayıtlar korundu.`, true));
  if (view.count > 500) main.append(notice('Kayıt sınırına ulaşıldı. Eski kayıtlar silinmedi; yeni kayıtlar yalnızca oturumda tutulur.', true));
  if (loading && !content()) { main.append(heading('Oyunlar hazırlanıyor', 'ÖZEL PROTOTİP'), el('p', 'Yerel içerik doğrulanıyor…')); return; }
  if (!content()) {
    main.append(heading('İçerik şu an açılamıyor', 'ÖZEL PROTOTİP'), notice(COPY[contentError ?? 'CONTENT_INVALID'], true), button('Yenile', () => void refresh())); return;
  }
  if (!usable()) main.append(notice(COPY.CONTENT_STALE, true));
  if (loading) main.append(el('p', 'İçerik doğrulanıyor…', 'muted'));
  if (route.value.mode === 'home') renderHome();
  else if (route.value.mode === 'tahmin') renderPredictions();
  else if (route.value.mode === 'takim') renderBuilder();
  else renderQuiz();
}
function renderHome() {
  const c = content()!; const next = eligibleFixtures(c, Date.now(), navigator.onLine)[0];
  const hero = el('section', undefined, 'hero');
  const copy = el('div', undefined, 'hero-copy');
  const title = heading('Filede söz sende.', 'KADIN VOLEYBOLU · ÜÇ KISA OYUN');
  title.querySelector('h1')!.replaceChildren(el('span', 'Filede '), el('em', 'söz sende.'));
  copy.append(title, el('p', 'Skoru tahmin et. Hayalindeki takımı kur. Bir quiz molası ver.', 'intro'));
  const artwork = el('img', undefined, 'hero-art'); artwork.src = new URL('court-play.svg', base).href;
  artwork.alt = ''; artwork.width = 420; artwork.height = 300;
  hero.append(copy, artwork);
  main.append(hero);
  if (next) {
    const match = el('section', undefined, 'featured-match');
    const matchCopy = el('div', undefined, 'featured-copy');
    const matchup = el('h2', undefined, 'match-title');
    matchup.append(el('span', next.home), el('span', ' — ', 'versus'), el('span', next.away));
    matchCopy.append(el('p', 'SIRADAKİ KURGUSAL MAÇ', 'eyebrow'), el('p', dateTR(next.startsAt!), 'muted'), matchup);
    const action = el('div', undefined, 'featured-action');
    action.append(el('p', 'Sence kaç kaç biter?', 'match-prompt'), link(picks.get(next.id)?.savedId ? 'Tahminini düzenle →' : 'Tahmin yap →', '#/tahmin', 'button'), link('Tüm maçlar', '#/tahmin', 'inline-link'));
    match.append(matchCopy, action, el('p', `Demo içerik · Doğrulama: ${dateTR(next.checkedAt)} · Canlı skor değildir`, 'source'));
    main.append(match);
  } else main.append(modeFallback('Şu an tahmine açık maç yok. Süresi dolmuş, ertelenmiş veya doğrulanamayan maçlara tahmin alınmaz.'));
  const paths = el('div', undefined, 'home-paths');
  const team = link('', '#/takim', 'path-link team-path'); team.append(el('span', 'TAKIMINI KUR', 'eyebrow'), el('h2', 'Senin yedilin kim?'), el('p', 'Altı saha yeri, bir libero. Bütçe yok, transfer yok. Sadece senin seçimin.'), el('span', 'Takımını kur →', 'action-text'));
  const quiz = link('', '#/quiz', 'path-link quiz-path'); quiz.append(el('span', `QUIZ · ${c.quiz?.questions.length ?? 0} SORU`, 'eyebrow'), el('h2', 'Biraz oyun, biraz mola.'), el('p', c.schema === 2 ? 'Son üç tamamlanmış Sultanlar Ligi sezonundan on soru. Cevabın ardından kaynağını keşfet.' : 'Acele etmeden, beş kısa soru. Bu demo paketinde oyunun kurallarını keşfet.'), el('span', 'Quiz’i aç →', 'action-text'));
  paths.append(team, quiz); main.append(paths);
}
async function savePick(match: Fixture) {
  if (pending || !picks.has(match.id)) return;
  const selected = picks.get(match.id)!; const token = generation; const revision = content()!.revision; const hash = location.hash;
  pending = true; say('Tahmin doğrulanıyor…'); render();
  const result = await submitter.submit({ fixtureId: match.id, score: selected.score, scheduleRevision: match.scheduleRevision, contentRevision: revision },
    () => generation === token && location.hash === hash && visible(), () => navigator.onLine,
    pick => store.save(`prediction:${match.id}`, { kind: 'prediction', data: pick }, selected.parents));
  pending = false; contentError = result.ok ? null : result.error.code;
  if (result.ok) { selected.savedId = result.value.record.id; selected.parents = [result.value.record.id]; say(result.value.persisted ? 'Tahminin bu cihazda kayıtlı.' : COPY.STORAGE_MEMORY); }
  else { selected.savedId = undefined; error(result.error.code); }
  render(); focus(`save-${match.id}`);
}
function renderPredictions() {
  const c = content()!; main.append(heading('Sence kaç kaç biter?', 'TAHMİN · KURGUSAL MAÇLAR'));
  const tabs = el('div', undefined, 'subnav');
  const upcoming = button('Yaklaşan maçlar', () => { historyVisible = false; render(); }, historyVisible ? 'text-button' : 'text-button active');
  const history = button('Tahminlerim', () => { historyVisible = true; render(); }, historyVisible ? 'text-button active' : 'text-button');
  upcoming.setAttribute('aria-pressed', String(!historyVisible)); history.setAttribute('aria-pressed', String(historyVisible));
  tabs.append(upcoming, history, button('Yenile', () => void refresh(), 'text-button')); main.append(tabs);
  main.append(el('p', 'Skorun ilk sayısı soldaki ev sahibi takımın set sayısıdır. Canlı skor değildir.', 'muted'));
  if (historyVisible) { renderHistory(); return; }
  if (!c.fixtures.length) { main.append(modeFallback('Bu sürümde doğrulanabilen maç yok.')); return; }
  for (const match of c.fixtures.filter(m => m.state !== 'final')) {
    const section = el('section', undefined, 'match-row'); section.append(el('p', match.startsAt ? dateTR(match.startsAt) : 'Yeni saat bekleniyor', 'eyebrow'), el('h2', `${match.home} — ${match.away}`));
    const stateLabels = { scheduled: 'Planlandı', postponed: 'Ertelendi', cancelled: 'İptal edildi', conflict: 'Bilgiler çelişiyor', final: 'Tamamlandı' };
    section.append(el('p', `${stateLabels[match.state]} · Takvim sürümü ${match.scheduleRevision}`, 'muted'));
    const selected = picks.get(match.id);
    const blocked = predictionBlock(c, match, Date.now(), navigator.onLine);
    if (blocked) section.append(notice(COPY[blocked], true));
    const fieldset = el('fieldset'); fieldset.append(el('legend', `${match.home} – ${match.away}: set skoru`));
    const grid = el('div', undefined, 'score-options');
    for (const score of SCORES) {
      const label = el('label', undefined, 'score-choice'); const input = el('input'); input.type = 'radio'; input.name = `score-${match.id}`; input.value = score;
      input.checked = selected?.score === score; input.disabled = !!blocked;
      input.addEventListener('change', () => {
        changed(); picks.set(match.id, { score, parents: selected?.parents ?? parentIds(`prediction:${match.id}`) });
        message = ''; render(); document.querySelector<HTMLInputElement>(`input[name="score-${match.id}"][value="${score}"]`)?.focus();
      });
      label.append(input, el('span', score.replace('-', ' – '))); grid.append(label);
    }
    fieldset.append(grid); section.append(fieldset);
    const leaves = heads(store.read().records, `prediction:${match.id}`);
    if (leaves.length > 1) {
      section.append(notice(COPY.STORAGE_CONFLICT, true));
      for (const record of leaves) if (record.value.kind === 'prediction') {
        const score = record.value.data.score;
        section.append(button(`${score} tahminini yeniden onayla`, () => { picks.set(match.id, { score, parents: leaves.map(r => r.id) }); void savePick(match); }, 'button secondary'));
      }
    }
    if (selected && selected.parents.slice().sort().join(',') !== leaves.map(r => r.id).sort().join(',')) {
      section.append(notice(COPY.STORAGE_CONFLICT, true), button('Seçimimi yeni kayıt olarak onayla', () => {
        selected.parents = leaves.map(r => r.id); void savePick(match);
      }, 'button secondary'));
    }
    const save = button(pending ? 'Doğrulanıyor…' : selected?.savedId ? 'Tahmini yeniden kaydet' : 'Tahminimi kaydet', () => void savePick(match));
    save.id = `save-${match.id}`; save.disabled = !!blocked || !selected || pending || loading; section.append(save);
    if (selected) section.append(el('p', savedLabel(selected.savedId), selected.savedId ? 'save-state' : 'save-state unsaved'));
    section.append(el('p', `Kaynak: kurgusal demo · Doğrulama: ${dateTR(match.checkedAt)}`, 'source')); main.append(section);
  }
  main.append(notice('Saat ve kayıtlar bu cihazda değiştirilebilir. Bu, kişisel bir oyundur; adil yarışma veya ödüllü sıralama değildir.'));
}
function renderHistory() {
  const records = store.read().records.filter(r => r.value.kind === 'prediction');
  if (!records.length) { main.append(notice('Henüz kayıtlı tahminin yok.'), button('Yaklaşan maçlara dön', () => { historyVisible = false; render(); })); return; }
  for (const entity of new Set(records.map(r => r.entity))) for (const record of heads(records, entity)) {
    if (record.value.kind !== 'prediction') continue;
    const pick = record.value.data; const match = usable()?.fixtures.find(m => m.id === pick.fixtureId);
    const row = el('section', undefined, 'match-row'); row.append(el('h2', match ? `${match.home} — ${match.away}` : 'Maç bilgisi şu an kullanılamıyor'), el('p', `Tahminin: ${pick.score} · Takvim sürümü ${pick.scheduleRevision}`, 'intro'));
    if (match && match.scheduleRevision !== pick.scheduleRevision) row.append(notice(`Bu tahmin önceki takvim sürümüne ait. Güncel takvim sürümü: ${match.scheduleRevision}. Tahminin değiştirilmedi.`));
    if (match?.state === 'final' && match.result) {
      row.append(el('p', `${feedback(pick.score, match.result)} · Sonuç: ${match.result}`, 'result'));
      if (match.resultRevision > 1) row.append(notice('Sonuç düzeltildi; değerlendirme yeniden hesaplandı.'));
    } else row.append(el('p', 'Doğrulanmış sonuç bekleniyor. Tahminin değiştirilmedi.', 'muted'));
    main.append(row);
  }
}
function renderBuilder() {
  main.append(heading('Senin yedilin kim?', 'TAKIMINI KUR · SEN SEÇ, SEN PAYLAŞ'));
  const c = usable(); if (!c?.roster) { main.append(modeFallback('Kadro şu an kullanılamıyor. Güncel içerik için Yenile’ye bas.'), button('Yenile', () => void refresh())); return; }
  const imported = route.ok ? route.value.team : undefined; const ids = imported?.ids ?? draft;
  const team = validateLineup(ids, imported?.roster ?? c.roster.version, c, Date.now());
  if (imported) {
    main.append(notice('Paylaşılan takım · Salt okunur. Kendi taslağın değişmedi.'));
    if (!team.ok) main.append(notice('Bazı oyuncular artık kullanılamıyor. Eksik rolleri kendi kopyanda tamamlayabilirsin.', true));
    if (overwrite) {
      main.append(notice('Bu işlem mevcut taslağının yerini alır. Kaydedilmiş geçmiş kayıtları silmez.', true), button('Bu takımla değiştir', () => {
        draft = ids.map((id, i) => c.roster!.players.some(p => p.id === id && p.role === SLOT_ROLES[i]) ? id : ''); draftParents = parentIds('lineup:own'); draftSavedId = undefined;
        overwrite = false; changed(); location.hash = '#/takim';
      }), button('Mevcut taslağıma dön', () => { overwrite = false; location.hash = '#/takim'; }, 'button secondary'));
    } else main.append(button('Kendi takımını kur', () => { overwrite = true; render(); }));
  }
  main.append(el('p', '1 pasör · 1 pasör çaprazı · 2 smaçör · 2 orta oyuncu · 1 libero', 'muted'));
  const known = ids.filter((id, i) => c.roster!.players.some(p => p.id === id && p.role === SLOT_ROLES[i]));
  const progress = el('div', undefined, 'team-progress');
  progress.append(el('p', `${known.length}/7 oyuncu seçildi`, 'progress-label'));
  const marks = el('span', undefined, 'progress-marks'); marks.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 7; i++) marks.append(el('i', undefined, i < known.length ? 'filled' : ''));
  progress.append(marks); main.append(progress);
  const workspace = el('div', undefined, 'builder-workspace'); const slots = el('ol', undefined, 'slot-list');
  SLOT_LABELS.forEach((label, i) => {
    const row = el('li'); const player = c.roster!.players.find(p => p.id === ids[i] && p.role === SLOT_ROLES[i]);
    if (imported) { row.append(el('span', label, 'eyebrow'), el('strong', player?.name ?? 'Oyuncu kullanılamıyor')); if (player?.clubId) row.append(playerIdentity(player, base)); }
    else {
      const slot = button('', () => { picker = i; render(); focus(`picker-${i}`); }, 'slot-button'); slot.id = `slot-${i}`; slot.setAttribute('aria-expanded', String(picker === i));
      slot.append(el('span', label, 'slot-label'), el('strong', player?.name ?? 'Oyuncu seç'), el('span', player ? 'Değiştir' : '+', 'slot-action')); if (player?.clubId) slot.append(playerIdentity(player, base)); row.append(slot);
      if (picker === i) {
        const panel = el('div', undefined, 'picker'); const title = el('h2', `${label} seç`); title.id = `picker-${i}`; title.tabIndex = -1; panel.append(title);
        const help = { setter: 'Oyunu yönlendiren rol.', opposite: 'Pasör çaprazındaki hücum rolü.', outside: 'Bu şablonda iki smaçör seçilir.', middle: 'Bu şablonda iki orta oyuncu seçilir.', libero: 'Ayrı alanda gösterilen savunma rolü.' };
        panel.append(el('p', help[SLOT_ROLES[i]!], 'muted'));
        for (const candidate of c.roster!.players.filter(p => p.role === SLOT_ROLES[i])) {
          const elsewhere = draft.some((id, n) => n !== i && id === candidate.id);
          const option = button(`${candidate.name}${elsewhere ? ' · başka yerde seçili' : candidate.id === ids[i] ? ' · seçili ✓' : ''}`, () => {
            draft[i] = candidate.id; draftSavedId = undefined; picker = null; changed(); message = ''; render(); focus(`slot-${i}`);
          }, 'player-option'); option.disabled = elsewhere; if (candidate.clubId) option.append(playerIdentity(candidate, base)); panel.append(option);
        }
        panel.append(button('Vazgeç', () => { picker = null; render(); focus(`slot-${i}`); }, 'text-button')); row.append(panel);
      }
    }
    slots.append(row);
  });
  const court = el('div', undefined, 'court-panel'); court.setAttribute('aria-hidden', 'true');
  court.append(el('p', 'SENİN SAHAN', 'eyebrow'), el('p', 'Sen seç. Takımın şekillensin.', 'court-caption')); const field = el('div', undefined, 'court');
  ids.forEach((id, i) => { const p = c.roster!.players.find(p => p.id === id && p.role === SLOT_ROLES[i]); const tile = el('div', undefined, i === 6 ? 'court-player libero' : 'court-player'); tile.append(el('span', i === 6 ? 'L' : String(i + 1).padStart(2, '0'), 'jersey-number'), el('strong', p?.name ?? 'Senin seçimin'), el('span', SLOT_LABELS[i], 'court-role')); if (p?.clubId) tile.append(playerIdentity(p, base, true)); field.append(tile); });
  court.append(field, el('p', 'Altı saha yeri + ayrı libero. Resmî rotasyon değildir.', 'source'));
  workspace.append(slots, court); main.append(workspace);
  const missing = SLOT_LABELS.filter((_, i) => !c.roster!.players.some(p => p.id === ids[i] && p.role === SLOT_ROLES[i]));
  if (missing.length) main.append(notice(`Eksik roller: ${missing.join(', ')}.`));
  if (!imported) {
    const confirm = button('Takımımı onayla', () => {
      const current = usable(); if (!current?.roster || !validateLineup(draft, current.roster.version, current, Date.now()).ok) { error('LINEUP_INVALID'); render(); return; }
      const result = store.save('lineup:own', { kind: 'lineup', data: { roster: current.roster.version, ids: draft } }, draftParents);
      if (result.ok) { draftSavedId = result.value.record.id; draftParents = [result.value.record.id]; say(result.value.persisted ? 'Yedilin tamam. Takımın bu cihazda kayıtlı.' : COPY.STORAGE_MEMORY); }
      else { error(result.error.code); draftParents = parentIds('lineup:own'); }
      render();
    }); confirm.disabled = !team.ok; main.append(confirm, el('p', savedLabel(draftSavedId), 'save-state'));
  }
  const prepare = button(preparing ? 'Önizleme hazırlanıyor…' : 'Paylaşım önizlemesini hazırla', () => void prepareShare([...ids], imported?.roster ?? c.roster!.version), 'button secondary');
  prepare.disabled = !team.ok || preparing || !navigator.onLine; main.append(prepare);
  main.append(el('p', c.schema === 2 ? `${c.roster.players.length} gerçek oyuncu · Kulüpler: 2026–27 sezonu · Kontrol: ${dateTR(c.roster.asOf)}. Bayraklar temsil edilen ülkeyi gösterir; bu bir resmî kadro değildir.` : `Seçili kurgusal oyuncular · ${dateTR(c.roster.asOf)} · Kaynak: özgün demo kadrosu`, 'source'));
  if (c.schema === 2) {
    const sources = el('details', undefined, 'guide'); sources.append(el('summary', 'Oyuncu kaynakları ve logo notu'));
    sources.append(el('p', 'Kulüp armaları yalnızca bu yerel testte gösterilir. Hakları sahiplerine aittir; resmî ilişki veya herkese açık kullanım izni iddia edilmez. Armalar PNG kartına eklenmez.'));
    const list = el('ul');
    for (const p of c.roster.players) { const item = el('li'); const source = link(`${p.name} · lig kaydı`, p.sourceUrl!); source.target = '_blank'; source.rel = 'noopener noreferrer'; item.append(source); list.append(item); }
    sources.append(list); main.append(sources);
  }
  if (prepared) renderPrepared();
}
async function prepareShare(ids: string[], roster: string) {
  if (preparing) return; releasePreview(); preparing = true; const token = generation; const hash = location.hash;
  const operation = new AbortController(); preparation = operation;
  render(); const fresh = await coordinator.refresh();
  if (preparation !== operation) return;
  if (location.hash !== hash) { preparation = null; preparing = false; render(); return; }
  if (!fresh.ok || token !== generation || !navigator.onLine || !visible()) { preparation = null; preparing = false; error(fresh.ok ? 'SHARE_EXPIRED' : fresh.error.code); render(); return; }
  const team = validateLineup(ids, roster, fresh.value, Date.now()); const url = teamUrl(base, roster, ids);
  if (!team.ok || !url.ok) { preparation = null; preparing = false; error('LINEUP_INVALID'); render(); return; }
  const policyAt = Date.now();
  const png = await renderTeamPng(team.value, fresh.value.roster!.asOf, operation.signal, fresh.value.schema === 2);
  // A cancelled native callback must never clear a newer request's busy state.
  if (preparation !== operation) return;
  preparation = null; preparing = false;
  // URL changes precede hashchange delivery; the generation alone cannot guard that gap.
  if (location.hash !== hash) { render(); return; }
  if (token !== generation || content() !== fresh.value || !currentPolicy(fresh.value, Date.now()) || Date.now() >= policyAt + 60_000 || !navigator.onLine || !visible()) { error('SHARE_EXPIRED'); render(); return; }
  const file = png.ok ? png.value : null;
  prepared = { url: url.value, text: lineupText(team.value, fresh.value.schema === 2), file, blobUrl: file ? URL.createObjectURL(file) : null,
    expiresAt: Math.min(policyAt + 60_000, Date.parse(fresh.value.validUntil), Date.parse(fresh.value.rights.expiresAt)), revision: fresh.value.revision, rightsRevision: fresh.value.rightsRevision, selection: ids.join(','), pngError: png.ok ? null : png.error.code };
  say('Önizleme hazır. Henüz hiçbir yere gönderilmedi. Doğrulama 60 saniye geçerlidir.'); render(); document.getElementById('share-preview')?.scrollIntoView({ block: 'nearest' });
}
function currentSelection() { return (route.ok && route.value.team ? route.value.team.ids : draft).join(','); }
function validPrepared(): boolean {
  if (!prepared || !preparedValid(prepared, content(), currentSelection(), Date.now(), navigator.onLine) || document.visibilityState === 'hidden') { releasePreview(); error('SHARE_EXPIRED'); render(); return false; } return true;
}
function renderPrepared() {
  const p = prepared!; const panel = el('section', undefined, 'share-preview'); panel.id = 'share-preview'; panel.append(el('h2', 'Takımın paylaşım önizlemesi'));
  if (p.blobUrl) { const img = el('img'); img.src = p.blobUrl; img.width = 1080; img.height = 1350; img.alt = content()?.schema === 2 ? 'Gerçek oyuncularla hayal takımı. Yerel test kartı; oyuncu adları aşağıdaki metinde de yer alır.' : 'Kurgusal takım kartı. Oyuncu adları aşağıdaki metinde de yer alır.'; panel.append(img); }
  else panel.append(notice(p.pngError === 'SHARE_OVERFLOW' ? COPY.SHARE_OVERFLOW : 'Görsel oluşturulamadı. Takımın korundu; metni veya bağlantıyı kullan.', true));
  const field = el('textarea'); field.readOnly = true; field.value = `${p.text}\n\n${p.url}`; field.rows = 12; field.setAttribute('aria-label', 'Takım metni ve bağlantısı'); panel.append(field);
  const actions = el('div', undefined, 'actions');
  if (p.file && p.blobUrl) {
    actions.append(button('PNG indir', () => { if (!validPrepared()) return; const download = link('', p.blobUrl!); download.download = p.file!.name; download.click(); say('PNG indirme isteği başlatıldı. Bu, yayın yapıldığı anlamına gelmez.'); render(); }, 'button secondary'));
    let canShare = false;
    try { canShare = typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [p.file] }); }
    catch { /* An unavailable capability must not remove download/text fallback. */ }
    if (canShare && content()?.schema !== 2) {
      const native = button(sharing ? 'Paylaşım açık…' : 'Paylaş…', () => {
        if (sharing || !validPrepared()) return;
        sharing = true;
        // The prepared File is passed directly during this click's user activation.
        let operation: Promise<void>;
        try { operation = navigator.share({ files: [p.file!], title: 'Kurgusal hayal takımım' }); }
        catch { sharing = false; error('SHARE_FAILED'); render(); return; }
        render();
        void operation.then(() => say('Paylaşım penceresi kapandı. Gerçek gönderimi hedef uygulamada kontrol et.')).catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') say('Paylaşım tamamlanmadı. Takımın korundu.'); else error('SHARE_FAILED');
        }).finally(() => { sharing = false; render(); });
      }); native.disabled = sharing; actions.append(native);
    }
  }
  actions.append(button('Bağlantıyı kopyala', () => {
    if (!validPrepared()) return;
    const fallback = () => {
      if (prepared !== p || !validPrepared()) return;
      say('Otomatik kopyalama kullanılamıyor. Bağlantıyı metinden seçip kopyala.'); render();
      const currentField = document.querySelector<HTMLTextAreaElement>('#share-preview textarea');
      currentField?.focus(); currentField?.select();
    };
    try {
      if (!navigator.clipboard?.writeText) { fallback(); return; }
      void navigator.clipboard.writeText(p.url).then(() => {
        if (prepared !== p || !validPrepared()) return;
        say('Bağlantı kopyalandı. Henüz gönderilmedi.'); render();
      }).catch(fallback);
    } catch { fallback(); }
  }, 'button secondary'));
  if (content()?.schema === 2) panel.append(el('p', 'Yerel test: dış uygulamalara doğrudan paylaşım kapalı. PNG yalnızca adları içerir; kulüp armaları dışa aktarılmaz.', 'source'));
  panel.append(actions, el('p', 'Bağlantı bu yerel prototipe aittir; başka cihazdan erişilebilir bir site yayımlanmadı.', 'source')); main.append(panel);
}
function startQuiz(practice: boolean) {
  const pack = usable()?.quiz; if (!pack) return;
  attempt = beginAttempt(pack, crypto.randomUUID(), practice); attemptParents = []; quizIndex = 0; tentative = null; quizConflict = false; message = ''; changed();
  history.replaceState({ questionIndex: 0 }, '', '#/quiz'); render(); focusHeading();
}
function renderQuiz() {
  main.append(heading('Bir quiz molası.', `QUIZ · ${content()?.quiz?.questions.length ?? 0} SORU · SÜRE SINIRI YOK`));
  const c = usable(); if (!c?.quiz) { main.append(modeFallback('Quiz paketi şu an kullanılamıyor.'), button('Yenile', () => void refresh())); return; }
  const pack = c.quiz; const count = pack.questions.length;
  main.append(el('p', c.schema === 2 ? 'Sultanlar Ligi: 2023–24, 2024–25 ve 2025–26. Üç tamamlanmış sezon; her cevabın açıklaması ve kaynağı var.' : 'İlk demo paketi: bu oyunun kuralları. Gerçek voleybol bilgi bankası değildir.', 'muted'));
  if (!attempt) {
    const welcome = el('section', undefined, 'quiz-welcome');
    const number = el('span', String(count).padStart(2, '0'), 'quiz-number'); number.setAttribute('aria-hidden', 'true');
    const copy = el('div'); copy.append(el('p', 'KÜÇÜK BİR MOLA', 'eyebrow'), el('h2', `${count === 10 ? 'On' : 'Beş'} soru. Sıfır acele.`), el('p', 'Bir şık seç, cevabını onayla. Her sorunun ardından açıklamasını gör.', 'intro'), button('Quiz’e başla', () => startQuiz(false)));
    welcome.append(number, copy); main.append(welcome);
    const guide = el('details', undefined, 'guide'); guide.append(el('summary', 'Mini oyun rehberi'));
    guide.append(el('p', 'Bir pasör, bir pasör çaprazı, iki smaçör, iki orta oyuncu ve bir libero seçilir. Her oyuncu tek yerde kullanılabilir. Libero görselde ayrı durur. Skorun ilk sayısı ev sahibine aittir. Kayıtlar bu tarayıcıdadır; depolama kapalıysa sadece oturumda kalır.'));
    main.append(guide); return;
  }
  const state = attemptState(attempt, pack);
  if (state === 'invalid' || state === 'frozen') { main.append(notice(COPY[state === 'frozen' ? 'QUIZ_UPDATED' : 'QUIZ_INVALID'], true), button('Güncel paketle yeniden başla', () => startQuiz(true))); return; }
  if (quizConflict) {
    main.append(notice(COPY.STORAGE_CONFLICT, true), button('Bu denemeyi yeni kayıt olarak onayla', () => {
      if (!attempt) return;
      const saved = store.save(`quiz:${attempt.id}`, { kind: 'quiz', data: attempt }, parentIds(`quiz:${attempt.id}`));
      if (saved.ok) { attemptParents = [saved.value.record.id]; quizConflict = false; say(saved.value.persisted ? 'Seçtiğin deneme bu cihazda kayıtlı.' : COPY.STORAGE_MEMORY); }
      else error(saved.error.code);
      render();
    }), button('Yeni alıştırma başlat', () => startQuiz(true), 'button secondary')); return;
  }
  if (attempt.practice) main.append(el('p', 'Alıştırma denemesi', 'eyebrow'));
  if (attempt.answers.length === count && quizIndex >= count) {
    main.append(el('p', `${scoreAttempt(attempt, pack)} / ${count}`, 'quiz-score'), el('h2', 'Molayı tamamladın.'));
    if (state === 'revised') main.append(notice(`Yanıt anahtarı düzeltildi. İlk sonuç: ${attempt.originalScore}/${count}; güncel sonuç: ${scoreAttempt(attempt, pack)}/${count}.`));
    for (const ref of attempt.questions) { const q = pack.questions.find(q => q.id === ref.id)!; const row = el('section', undefined, 'explanation'); row.append(el('h3', q.text), el('p', q.explanation), questionSource(q)); main.append(row); }
    main.append(button('Yeniden dene', () => startQuiz(true)), link('Takımını kur →', '#/takim', 'button secondary')); return;
  }
  const ref = attempt.questions[quizIndex]; const question = pack.questions.find(q => q.id === ref?.id);
  if (!question) { quizIndex = 0; render(); return; }
  const committed = attempt.answers.find(a => a.questionId === question.id);
  const panel = el('section', undefined, 'quiz-panel'); panel.append(el('p', `Soru ${quizIndex + 1}/${count}`, 'eyebrow'));
  const progress = el('div', undefined, 'quiz-progress'); progress.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) progress.append(el('i', undefined, i <= quizIndex ? 'filled' : ''));
  panel.append(progress);
  const fieldset = el('fieldset'); const legend = el('legend', question.text); legend.className = 'question'; fieldset.append(legend);
  for (const choice of question.choices) {
    const label = el('label', undefined, 'answer-choice'); const input = el('input'); input.type = 'radio'; input.name = 'quiz-answer'; input.value = choice.id;
    input.checked = (committed?.choiceId ?? tentative) === choice.id; input.disabled = !!committed;
    input.addEventListener('change', () => { tentative = choice.id; render(); document.querySelector<HTMLInputElement>(`input[value="${choice.id}"]`)?.focus(); }); label.append(input, el('span', choice.text)); fieldset.append(label);
  }
  panel.append(fieldset);
  if (committed) {
    panel.append(notice(committed.choiceId === question.correctId ? 'Doğru! ' + question.explanation : 'Bu kez olmadı. ' + question.explanation));
    panel.append(questionSource(question));
    panel.append(button(quizIndex === count - 1 ? 'Sonucumu gör' : 'Sonraki soru', () => { quizIndex++; tentative = null; history.pushState({ questionIndex: quizIndex }, '', '#/quiz'); render(); focusHeading(); }));
  } else {
    const confirm = button('Cevabımı onayla', () => {
      const latest = usable()?.quiz; if (!latest || !attempt || !tentative) return;
      const result = confirmAnswer(attempt, latest, question.id, tentative);
      if (!result.ok) { error(result.error.code); render(); return; }
      attempt = result.value;
      const saved = store.save(`quiz:${attempt.id}`, { kind: 'quiz', data: attempt }, attemptParents);
      if (saved.ok) { attemptParents = [saved.value.record.id]; if (!saved.value.persisted) say(COPY.STORAGE_MEMORY); }
      else { quizConflict = saved.error.code === 'STORAGE_CONFLICT'; error(saved.error.code); }
      tentative = null; render(); announce('Yanıtın onaylandı.');
    }); confirm.disabled = !tentative; panel.append(confirm);
  }
  if (quizIndex > 0) panel.append(button('Önceki soru', () => { quizIndex--; tentative = null; history.pushState({ questionIndex: quizIndex }, '', '#/quiz'); render(); focusHeading(); }, 'text-button'));
  main.append(panel, el('p', c.schema === 2 ? 'Onaylanan yanıt değiştirilemez. Kaynak bağlantısı cevabın ardından görünür.' : 'Kaynak: bu demonun özgün oyun rehberi. Onaylanan yanıt değiştirilemez.', 'source'));
}
function routeChanged() {
  changed(); route = parseFragment(location.hash); picker = null; message = '';
  if (route.ok && route.value.mode === 'quiz') { const index = history.state?.questionIndex; if (Number.isInteger(index) && index >= 0 && index <= (attempt?.answers.length ?? 0)) quizIndex = index; }
  if (route.ok && route.value.mode === 'tahmin') void refresh().then(() => { if (route.ok && route.value.mode === 'tahmin') focusHeading(); }); else { render(); focusHeading(); }
}
window.addEventListener('hashchange', routeChanged);
window.addEventListener('popstate', () => { if (route.ok && route.value.mode === 'quiz' && location.hash === '#/quiz') { const index = history.state?.questionIndex; if (Number.isInteger(index) && index >= 0 && index <= (attempt?.answers.length ?? 0)) { quizIndex = index; tentative = null; render(); focusHeading(); } } });
window.addEventListener('offline', () => { changed(); coordinator.invalidate(); error('OFFLINE'); render(); });
window.addEventListener('online', () => { say('Bağlantı geri geldi. Tahmin göndermek için Yenile’ye basıp açıkça kaydet.'); render(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { changed(); coordinator.invalidate(); } else void refresh(); });
window.addEventListener('pageshow', e => { if (e.persisted) void refresh(); });
window.addEventListener('pagehide', () => { changed(); coordinator.invalidate(); });
window.addEventListener('storage', e => {
  if (e.key === null || e.key.startsWith(PREFIX)) { changed(); say('Başka sekmede kayıtlar değişti. Açık taslağın korunuyor; otomatik kayıt yapılmadı.'); render(); }
});
document.getElementById('clear-data')!.addEventListener('click', () => {
  const panel = document.getElementById('clear-panel')!; panel.replaceChildren(notice('Bu tarayıcıdaki tahmin, takım ve quiz kayıtları silinsin mi? Açık taslağın kaydedilmemiş olarak kalır.', true), button('Evet, oyun kayıtlarını sil', () => {
    const result = store.clear(); draftSavedId = undefined; draftParents = []; attemptParents = [];
    for (const pick of picks.values()) { pick.savedId = undefined; pick.parents = []; }
    changed(); panel.replaceChildren(); say(result.ok ? `${result.value} cihaz kaydı silindi. Açık seçimler kaydedilmemiş durumda; test ayarı korunur.` : COPY.STORAGE_CLEAR_INCOMPLETE); render();
  }, 'button secondary'), button('Vazgeç', () => { panel.replaceChildren(); focus('clear-data'); }, 'text-button'));
});
document.querySelector<HTMLAnchorElement>('.skip-link')!.addEventListener('click', event => { event.preventDefault(); main.focus(); });
function blockSignature(c: Content): string {
  return `${currentPolicy(c, Date.now())}:${c.fixtures.map(m => predictionBlock(c, m, Date.now(), navigator.onLine)).join(',')}:${!!prepared && Date.now() >= prepared.expiresAt}`;
}
setInterval(() => {
  const c = content(); if (!c) return;
  const signature = blockSignature(c);
  if (signature !== lastBlockSignature) { lastBlockSignature = signature; if (prepared && !preparedValid(prepared, c, currentSelection(), Date.now(), navigator.onLine)) { releasePreview(); say(COPY.SHARE_EXPIRED); } render(); }
}, 1000);
void refresh();
