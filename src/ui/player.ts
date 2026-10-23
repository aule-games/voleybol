import { CLUBS, COUNTRIES } from '../data/identities.ts';
import { COACH_COUNTRIES, COACH_IDENTITIES, PLAYER_AFFILIATIONS, TEAM_IDENTITIES } from '../data/affiliations.ts';
import type { CoachAppointment, TeamIdentity } from '../data/affiliations.ts';
import type { Coach, Player, Question } from '../domain/types.ts';
import { el, link } from './dom.ts';

function identityBadge(identity: TeamIdentity, type: 'club' | 'country', title: string, base: URL, compact: boolean): HTMLElement {
  const badge = el('span', undefined, `identity-badge ${type}${identity.dark ? ' dark-mark' : ''}`);
  if (identity.mark) {
    const img = el('img'); img.src = new URL(identity.mark, base).href; img.width = type === 'club' ? 28 : 22; img.height = type === 'club' ? 28 : 17;
    img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.decoding = 'async';
    // Local assets only. Keep the readable identity when a mark fails to load.
    img.addEventListener('error', () => { img.hidden = true; });
    badge.append(img);
  }
  badge.title = title;
  badge.append(el('span', identity.name, compact && identity.mark ? 'sr-only' : 'identity-name'));
  return badge;
}

export function playerIdentity(player: Player, base: URL, compact = false): HTMLElement {
  const row = el('span', undefined, compact ? 'player-identity compact' : 'player-identity');
  const affiliation = PLAYER_AFFILIATIONS[player.id];
  // A reviewed retirement/termination must not fall back to an obsolete roster club.
  const club = affiliation ? (affiliation.teamId ? TEAM_IDENTITIES[affiliation.teamId] : undefined) : CLUBS[player.clubId as keyof typeof CLUBS];
  const country = COUNTRIES[player.countryCode as keyof typeof COUNTRIES];
  if (!country) return row;
  row.append(identityBadge(country, 'country', `Temsil ettiği ülke: ${country.name}`, base, compact));
  if (club) {
    row.append(identityBadge(club, 'club', `Kulüp: ${club.name} · ${affiliation?.season ?? '2026–27'}`, base, compact));
    if (!club.mark) row.append(el('span', 'Arma doğrulanmadı', 'identity-pending'));
  }
  if (affiliation?.note) {
    const short = affiliation.status === 'last-confirmed' ? `Son kayıt: ${affiliation.season}`
      : affiliation.status === 'retired' ? 'Kariyerini sonlandırdı'
      : affiliation.status === 'contract-ended' ? 'Yeni kulüp doğrulanmadı' : affiliation.note;
    const note = el('span', compact ? short : affiliation.note, 'identity-note');
    note.title = affiliation.note; row.append(note);
  }
  else if (!club) row.append(el('span', 'Kulüp bilgisi doğrulanmadı', 'identity-pending'));
  return row;
}

function coachAppointment(appointment: CoachAppointment, label: string, field: string, base: URL): HTMLElement {
  const row = el('span', undefined, `coach-fact coach-${field}`);
  row.append(el('span', `${label}:`, 'identity-label'));
  const team = appointment.teamId ? TEAM_IDENTITIES[appointment.teamId] : undefined;
  if (team) {
    row.append(identityBadge(team, 'club', `${label}: ${team.name} · ${appointment.role} · ${appointment.season}`, base, false));
    row.append(el('span', appointment.role, 'identity-role'));
  } else row.append(el('span', appointment.note ?? 'Doğrulanmadı', 'identity-pending'));
  return row;
}

export function coachIdentity(coach: Coach, base: URL, compact = false): HTMLElement {
  const row = el('span', undefined, `player-identity coach-identity${compact ? ' compact' : ''}`);
  const identity = COACH_IDENTITIES[coach.id];
  if (!identity) { row.append(el('span', coach.reference, compact ? 'sr-only' : 'identity-name')); return row; }
  const country = COACH_COUNTRIES[identity.countryCode];
  const origin = el('span', undefined, 'coach-fact coach-origin');
  origin.append(el('span', 'Köken:', 'identity-label'));
  if (country) origin.append(identityBadge({ ...country, name: identity.originLabel }, 'country', `Köken: ${identity.originLabel}`, base, false));
  row.append(origin, coachAppointment(identity.club, 'Kulüp', 'club', base), coachAppointment(identity.nationalTeam, 'Millî takım', 'national', base));
  return row;
}

export function questionSource(question: Question): HTMLElement {
  const row = el('p', undefined, 'source question-source');
  if (!question.source) { row.textContent = 'Kaynak: bu demonun özgün oyun rehberi'; return row; }
  const source = link(question.source.title, question.source.url); source.target = '_blank'; source.rel = 'noopener noreferrer';
  const checked = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeZone: 'Europe/Istanbul' }).format(new Date(question.source.checkedAt));
  row.append(`${question.season}${question.category ? '' : ' sezonu'} · Kaynak: `, source, ` · Kontrol: ${checked}`);
  return row;
}
