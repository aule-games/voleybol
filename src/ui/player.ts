import { CLUBS, COUNTRIES } from '../data/identities.ts';
import type { Player, Question } from '../domain/types.ts';
import { el, link } from './dom.ts';

export function playerIdentity(player: Player, base: URL, compact = false): HTMLElement {
  const row = el('span', undefined, compact ? 'player-identity compact' : 'player-identity');
  const club = CLUBS[player.clubId as keyof typeof CLUBS];
  const country = COUNTRIES[player.countryCode as keyof typeof COUNTRIES];
  if (!club || !country) return row;
  for (const [identity, type] of [[club, 'club'], [country, 'country']] as const) {
    const badge = el('span', undefined, `identity-badge ${type}`);
    const img = el('img'); img.src = new URL(identity.mark, base).href; img.width = type === 'club' ? 28 : 22; img.height = type === 'club' ? 28 : 17;
    img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.decoding = 'async';
    // The readable label stays available even when a local asset fails.
    img.addEventListener('error', () => { img.hidden = true; });
    const label = el('span', identity.name, compact ? 'sr-only' : 'identity-name');
    badge.title = `${type === 'club' ? 'Kulüp' : 'Temsil ettiği ülke'}: ${identity.name}`;
    badge.append(img, label); row.append(badge);
  }
  return row;
}

export function questionSource(question: Question): HTMLElement {
  const row = el('p', undefined, 'source question-source');
  if (!question.source) { row.textContent = 'Kaynak: bu demonun özgün oyun rehberi'; return row; }
  const source = link(question.source.title, question.source.url); source.target = '_blank'; source.rel = 'noopener noreferrer';
  const checked = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' }).format(new Date(question.source.checkedAt));
  row.append(`${question.season} sezonu · Kaynak: `, source, ` · Kontrol: ${checked}`);
  return row;
}
