import type { BudgetTeam, Content } from '../domain/types.ts';
import { SLOT_LABELS, SLOT_ROLES } from '../domain/types.ts';
import { budgetState, validateBudgetTeam } from '../domain/budget.ts';
import { COUNTRIES } from '../data/identities.ts';
import { AFFILIATIONS_CHECKED_AT, COACH_IDENTITIES, PLAYER_AFFILIATIONS, TEAM_IDENTITIES } from '../data/affiliations.ts';
import { teamUrl } from '../router.ts';
import { button, el, heading, link, notice } from './dom.ts';
import { coachIdentity, playerIdentity } from './player.ts';

interface BuilderOptions {
  content: Content; base: URL; ids: string[]; coachId: string; picker: number | null;
  saved: BudgetTeam | null; imported: BudgetTeam | null; preparing: boolean; savedLabel: string;
  onPicker(index: number | null): void; onPick(ids: string[], coachId: string): void;
  onSave(): void; onPrepare(): void; onCopy(): void;
}

export function budgetBuilder(o: BuilderOptions): HTMLElement {
  const root = el('section', undefined, 'budget-builder'); const roster = o.content.roster!;
  const state = budgetState(o.ids, o.coachId, roster); const readOnly = !!o.imported;
  const importedValid = !o.imported || validateBudgetTeam(o.imported, o.content, Date.now()).ok;
  root.append(heading(readOnly ? 'Benim kurduğum takım bu, katılıyor musun?' : `${roster.budget} puan. Senin takımın.`, readOnly ? 'PAYLAŞILAN TAKIM · SENİN TERCİHİN NE?' : 'TAKIMINI KUR · 7 OYUNCU + 1 KOÇ'));
  if (readOnly) {
    root.append(notice('Paylaşılan takım · Salt okunur. Kendi taslağın değişmedi.'));
    if (!importedValid) root.append(notice('Bu takımın kadro veya puan sürümü artık kullanılamıyor. Eski maliyetler güncelmiş gibi gösterilmez.', true));
    const actions = el('div', undefined, 'actions');
    actions.append(link('Ben kendi takımımı kurarım →', '#/takim', 'button'));
    if (importedValid) actions.append(button('Bu kadrodan kendi takımını kur', o.onCopy, 'button secondary'));
    root.append(actions);
    if (!importedValid) return root;
  } else root.append(el('p', `Dünyanın dört bir yanından favorilerini seç. Bütçen ${roster.budget} puan; her seçim bir tercih.`, 'intro'));
  const budget = el('div', undefined, `budget-bar${state.remaining < 0 ? ' over-budget' : ''}`);
  budget.setAttribute('role', 'status'); budget.setAttribute('aria-live', 'polite');
  budget.append(el('strong', `Kalan: ${state.remaining} / ${roster.budget} puan`, 'budget-remaining'),
    el('span', `${state.spent} puan kullanıldı · ${state.selected}/7 oyuncu · ${state.coach ? '1' : '0'}/1 koç`, 'budget-count'));
  root.append(budget, el('p', '1 pasör · 1 pasör çaprazı · 2 smaçör · 2 orta oyuncu · 1 libero', 'muted'));
  const workspace = el('div', undefined, 'builder-workspace'); const slots = el('ol', undefined, 'slot-list');
  for (let i = 0; i < 8; i++) {
    const isCoach = i === 7; const label = isCoach ? 'Koç' : SLOT_LABELS[i]!;
    const selected = isCoach ? state.coach : roster.players.find(p => p.id === o.ids[i]);
    const row = el('li', undefined, isCoach ? 'coach-slot' : '');
    if (readOnly) {
      row.append(el('span', label, 'eyebrow'), el('strong', selected?.name ?? 'Seçim kullanılamıyor'), el('span', `${selected?.cost ?? 0} puan`, 'cost-pill'));
      if (selected && 'role' in selected) row.append(playerIdentity(selected, o.base));
      else if (selected && 'reference' in selected) row.append(coachIdentity(selected, o.base));
    } else {
      const slot = button('', () => o.onPicker(i), 'slot-button'); slot.id = `slot-${i}`; slot.setAttribute('aria-expanded', String(o.picker === i));
      slot.append(el('span', label, 'slot-label'), el('strong', selected?.name ?? `${isCoach ? 'Koç' : 'Oyuncu'} seç`),
        el('span', selected ? `${selected.cost} puan · Değiştir` : '+', 'slot-action'));
      if (selected && 'role' in selected) slot.append(playerIdentity(selected, o.base));
      if (selected && 'reference' in selected) slot.append(coachIdentity(selected, o.base));
      row.append(slot);
      if (o.picker === i) {
        const panel = el('section', undefined, 'picker'); const title = el('h2', `${label} seç`); title.id = `picker-${i}`; title.tabIndex = -1;
        panel.append(title, el('p', 'Diğer boş yerlere yetecek puan bırakmayan seçimler kapalıdır.', 'source'));
        const search = el('input'); search.type = 'search'; search.placeholder = isCoach ? 'Koç ara' : 'Oyuncu ara'; search.setAttribute('aria-label', search.placeholder);
        const country = el('select'); country.setAttribute('aria-label', 'Ülkeye göre filtrele'); country.append(new Option('Tüm ülkeler', ''));
        if (!isCoach) for (const [code, c] of Object.entries(COUNTRIES)) country.append(new Option(c.name, code));
        const filters = el('div', undefined, 'picker-filters'); filters.append(search); if (!isCoach) filters.append(country); panel.append(filters);
        const list = el('div', undefined, 'picker-options');
        const normalized = (value: string) => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
        const draw = () => {
          list.replaceChildren();
          const candidates = isCoach ? [...roster.coaches!] : roster.players.filter(p => p.role === SLOT_ROLES[i]);
          for (const candidate of candidates.sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0) || a.name.localeCompare(b.name, 'tr'))) {
            if (!normalized(candidate.name).includes(normalized(search.value)) || (!isCoach && country.value && 'countryCode' in candidate && candidate.countryCode !== country.value)) continue;
            const nextIds = [...o.ids]; if (!isCoach) nextIds[i] = candidate.id;
            const nextCoach = isCoach ? candidate.id : o.coachId;
            const elsewhere = !isCoach && o.ids.some((id, slot) => slot !== i && id === candidate.id);
            const next = budgetState(nextIds, nextCoach, roster); const blocked = elsewhere || !next.feasible;
            const option = button('', () => o.onPick(nextIds, nextCoach), isCoach ? 'player-option coach-option' : 'player-option');
            option.disabled = blocked;
            option.append(el('strong', candidate.name), el('span', `${candidate.cost} puan`, 'cost-pill'));
            if ('role' in candidate) option.append(playerIdentity(candidate, o.base));
            else option.append(coachIdentity(candidate, o.base));
            const suffix = elsewhere ? 'Başka yerde seçili' : blocked ? 'Takımı tamamlamak için puan yetmiyor' : candidate.id === selected?.id ? 'Seçili ✓' : '';
            if (suffix) option.append(el('small', suffix, 'option-state'));
            list.append(option);
          }
          if (!list.children.length) list.append(el('p', 'Bu aramayla eşleşen seçenek yok.'));
        };
        search.addEventListener('input', draw); country.addEventListener('change', draw); draw(); panel.append(list);
        const actions = el('div', undefined, 'actions');
        if (selected) actions.append(button('Seçimi kaldır', () => { const ids = [...o.ids]; if (!isCoach) ids[i] = ''; o.onPick(ids, isCoach ? '' : o.coachId); }, 'text-button'));
        actions.append(button('Vazgeç', () => o.onPicker(null), 'text-button')); panel.append(actions); row.append(panel);
      }
    }
    slots.append(row);
  }
  const court = el('div', undefined, 'court-panel'); court.setAttribute('aria-hidden', 'true');
  court.append(el('p', 'SENİN SAHAN', 'eyebrow'), el('p', 'Yedi oyuncu. Bir koç. Senin seçimin.', 'court-caption'));
  const field = el('div', undefined, 'court');
  o.ids.forEach((id, i) => {
    const p = roster.players.find(p => p.id === id); const tile = el('div', undefined, i === 6 ? 'court-player libero' : 'court-player');
    tile.append(el('span', i === 6 ? 'L' : String(i + 1).padStart(2, '0'), 'jersey-number'), el('strong', p?.name ?? 'Senin seçimin'), el('span', `${SLOT_LABELS[i]}${p ? ` · ${p.cost} puan` : ''}`, 'court-role'));
    if (p) tile.append(playerIdentity(p, o.base, true)); field.append(tile);
  });
  const bench = el('div', undefined, 'coach-bench'); bench.append(el('span', 'KOÇ', 'eyebrow'), el('strong', state.coach?.name ?? 'Senin seçimin'));
  if (state.coach) bench.append(el('span', `${state.coach.cost} puan`), coachIdentity(state.coach, o.base, true));
  court.append(field, bench, el('p', 'Altı saha yeri + ayrı libero. Resmî rotasyon değildir.', 'source')); workspace.append(slots, court); root.append(workspace);
  if (!state.feasible) root.append(notice(`Bu seçimlerle ${roster.budget} puan içinde takım tamamlanamıyor. Bir oyuncuyu veya koçu değiştir.`, true));
  if (!readOnly) {
    const save = button('Takımımı kaydet ve bağlantı oluştur', o.onSave); save.disabled = !state.complete;
    root.append(save, el('p', o.saved ? o.savedLabel : 'Takımı kaydetmek için 7 oyuncu ve 1 koç seç.', 'save-state'));
  }
  const shareable = o.imported ?? o.saved;
  if (shareable && importedValid) {
    const url = teamUrl(o.base, shareable.roster, shareable.ids, shareable);
    if (url.ok) {
      const share = el('section', undefined, 'saved-team-link'); share.append(el('h2', 'Takımın hazır. Söz şimdi onlarda.'), el('p', 'Benim kurduğum takım bu, katılıyor musun?'));
      const input = el('input'); input.readOnly = true; input.value = url.value; input.setAttribute('aria-label', 'Takımının benzersiz bağlantısı');
      const status = el('p', undefined, 'source'); status.setAttribute('role', 'status');
      const copy = button('Takım bağlantısını kopyala', () => {
        if (!validateBudgetTeam(shareable, o.content, Date.now()).ok) { status.textContent = 'İçerik güncelliğini yitirdi. Yenileyip tekrar dene.'; return; }
        const fallback = () => { input.focus(); input.select(); status.textContent = 'Otomatik kopyalama kullanılamıyor. Seçili bağlantıyı kopyala.'; };
        try { if (!navigator.clipboard?.writeText) fallback(); else void navigator.clipboard.writeText(url.value).then(() => { status.textContent = 'Bağlantı kopyalandı. Henüz gönderilmedi.'; }).catch(fallback); } catch { fallback(); }
      });
      share.append(input, copy, status, el('p', o.base.hostname === 'aule-games.github.io' ? 'Bağlantıyı açan kişi takımını görür. Oy veya yanıt kaydı tutulmaz.' : 'Yerel test bağlantısıdır. Canlı sürüm yayınlanmadan başka cihazlarda açılamaz.', 'source'));
      const prepare = button(o.preparing ? 'Önizleme hazırlanıyor…' : 'Paylaşım önizlemesini hazırla', o.onPrepare, 'button secondary'); prepare.disabled = o.preparing || !navigator.onLine;
      share.append(prepare); root.append(share);
    }
  }
  root.append(el('p', `${roster.players.length} oyuncu · ${roster.coaches?.length} koç · Puan sürümü: ${roster.version}. Puanlar özgün oyun maliyetidir; para veya resmî performans notu değildir.`, 'source'));
  const sources = el('details', undefined, 'guide'); sources.append(el('summary', 'Oyuncu, koç ve puan kaynakları'));
  sources.append(el('p', 'Uluslararası isimlerin oyun rolleri tarihli 2025 millî takım kaynaklarına dayanır; güncel resmî kadro iddiası değildir. Puanlar VNL fiyatlarından alınmamıştır; pozisyon içi editoryal denge içindir. Takım armaları PNG’ye eklenmez.'));
  const checked = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(AFFILIATIONS_CHECKED_AT));
  const reviewed = roster.players.filter(p => p.clubId || PLAYER_AFFILIATIONS[p.id]).length;
  const historical = Object.values(PLAYER_AFFILIATIONS).filter(a => a.status === 'last-confirmed').length;
  const current = roster.players.filter(p => {
    const a = PLAYER_AFFILIATIONS[p.id];
    return a ? !!a.teamId && (!a.status || a.status === 'confirmed') : !!p.clubId;
  }).length;
  sources.append(el('p', `Takım bilgisi kontrolü: ${checked}. ${reviewed}/${roster.players.length} oyuncunun kaydı incelendi: ${current} kulüp eşleşmesi, ${historical} eski sezon/tarihli kayıt; diğerlerinde emeklilik veya sözleşme sonu açıklaması gösterilir. Eski sezon etiketi güncel sözleşme kanıtı değildir. ${Object.keys(COACH_IDENTITIES).length} koç için köken, kulüp ve millî takım ayrı alanlardır. Doğrulanamayan görev “yok” anlamına gelmez. Takım bilgileri tarihli kaynaktır, canlı transfer takibi değildir.`));
  const list = el('ul');
  for (const p of roster.players) {
    const item = el('li'); const a = link(`${p.name} · ${p.sourceLabel}`, p.sourceUrl!); a.target = '_blank'; a.rel = 'noopener noreferrer'; item.append(a);
    const affiliation = PLAYER_AFFILIATIONS[p.id];
    if (affiliation) {
      const identity = affiliation.teamId ? TEAM_IDENTITIES[affiliation.teamId] : undefined;
      const team = link(`${identity?.name ?? affiliation.note} · ${affiliation.season}`, affiliation.sourceUrl);
      team.target = '_blank'; team.rel = 'noopener noreferrer'; item.append(' · Kulüp/durum: ', team);
      if (identity && affiliation.note) item.append(` · ${affiliation.note}`);
    }
    list.append(item);
  }
  for (const c of roster.coaches ?? []) {
    const item = el('li'); const identity = COACH_IDENTITIES[c.id];
    const a = link(identity ? `${c.name} · Köken: ${identity.originLabel}` : `${c.name} · ${c.reference}`, identity?.originSourceUrl ?? c.sourceUrl);
    a.target = '_blank'; a.rel = 'noopener noreferrer'; item.append(a);
    if (identity) for (const [label, appointment] of [['Kulüp', identity.club], ['Millî takım', identity.nationalTeam]] as const) {
      const team = appointment.teamId ? TEAM_IDENTITIES[appointment.teamId] : undefined;
      const source = link(`${label}: ${team ? `${team.name} · ${appointment.role}` : appointment.note} · ${appointment.season}`, appointment.sourceUrl);
      source.target = '_blank'; source.rel = 'noopener noreferrer'; item.append(' · ', source);
    }
    list.append(item);
  }
  sources.append(list); root.append(sources); return root;
}
