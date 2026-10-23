import { TEAM_BUDGET } from '../domain/types.ts';
import { CLUBS, COUNTRIES, officialSource } from './identities.ts';
import { ID, SLOT_ROLES, QUIZ_CATEGORIES, isScore } from '../domain/types.ts';
import type { Content, Fixture, Player, QuizPack, Roster } from '../domain/types.ts';
import { fail, ok } from '../platform/result.ts';
import type { Result } from '../platform/result.ts';

export const MAX_BYTES = 256 * 1024;
export const DAY = 86_400_000;
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
export const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 1;
export const id = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
const text = (v: unknown, max = 160): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
export const utc = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const unique = (values: string[]) => new Set(values).size === values.length;

function fixture(v: unknown): v is Fixture {
  if (!isObject(v) || !exact(v, ['id', 'home', 'away', 'startsAt', 'locksAt', 'checkedAt', 'state', 'scheduleRevision', 'reopened', 'resultRevision', 'result'])) return false;
  return id(v.id) && text(v.home, 80) && text(v.away, 80) && v.home !== v.away && utc(v.checkedAt)
    && (v.startsAt === null || utc(v.startsAt)) && (v.locksAt === null || utc(v.locksAt))
    && (v.startsAt === null ? v.locksAt === null : v.locksAt !== null && Date.parse(String(v.locksAt)) <= Date.parse(v.startsAt))
    && ['scheduled', 'postponed', 'cancelled', 'conflict', 'final'].includes(String(v.state))
    && integer(v.scheduleRevision) && typeof v.reopened === 'boolean' && integer(v.resultRevision)
    && (v.state === 'final' ? isScore(v.result) : v.result === null);
}
function player(v: unknown, real: boolean): v is Player {
  return isObject(v) && exact(v, real ? ['id', 'name', 'role', 'clubId', 'countryCode', 'sourceUrl'] : ['id', 'name', 'role']) && id(v.id) && text(v.name, 120) && SLOT_ROLES.some(role => role === v.role)
    && (!real || (String(v.id).startsWith('real-') && typeof v.clubId === 'string' && Object.hasOwn(CLUBS, v.clubId)
      && typeof v.countryCode === 'string' && Object.hasOwn(COUNTRIES, v.countryCode) && officialSource(v.sourceUrl, 'player')));
}
function roster(v: unknown, withdrawn: string[], real: boolean): v is Roster {
  return isObject(v) && exact(v, ['version', 'asOf', 'players']) && id(v.version) && utc(v.asOf)
    && Array.isArray(v.players) && v.players.length <= 35 && v.players.every(p => player(p, real))
    && unique(v.players.map(p => p.id)) && v.players.every(p => !withdrawn.includes(p.id));
}
function internationalRoster(v: unknown, withdrawn: string[]): v is Roster {
  if (!isObject(v) || !exact(v, ['version', 'asOf', 'players', 'coaches', 'budget']) || !id(v.version) || !utc(v.asOf) || v.budget !== TEAM_BUDGET
    || !Array.isArray(v.players) || v.players.length !== 100 || !Array.isArray(v.coaches) || v.coaches.length !== 10) return false;
  const players = v.players.every(p => isObject(p) && exact(p, ['id', 'name', 'role', 'clubId', 'countryCode', 'sourceUrl', 'sourceLabel', 'cost'])
    && id(p.id) && String(p.id).startsWith('real-') && text(p.name, 120) && SLOT_ROLES.some(r => r === p.role)
    && typeof p.clubId === 'string' && (p.clubId === '' || Object.hasOwn(CLUBS, p.clubId))
    && typeof p.countryCode === 'string' && Object.hasOwn(COUNTRIES, p.countryCode) && officialSource(p.sourceUrl, 'international')
    && text(p.sourceLabel) && integer(p.cost) && p.cost >= 3 && p.cost <= 12);
  const coaches = v.coaches.every(c => isObject(c) && exact(c, ['id', 'name', 'cost', 'reference', 'sourceUrl'])
    && id(c.id) && text(c.name, 120) && integer(c.cost) && c.cost >= 2 && c.cost <= 6 && text(c.reference) && officialSource(c.sourceUrl, 'international'));
  return players && coaches && unique([...v.players, ...v.coaches].map(p => p.id))
    && [...v.players, ...v.coaches].every(p => !withdrawn.includes(p.id))
    && [...new Set(SLOT_ROLES)].every(role => (v.players as Player[]).filter((p: Player) => p.role === role).length >= SLOT_ROLES.filter(r => r === role).length);
}
function internationalQuiz(v: unknown, withdrawn: string[], now: number): v is QuizPack {
  if (!isObject(v) || !exact(v, ['id', 'revision', 'questions', 'roundSize']) || !id(v.id) || !integer(v.revision) || withdrawn.includes(v.id)
    || v.roundSize !== 10 || !Array.isArray(v.questions) || v.questions.length !== 100) return false;
  return v.questions.every(q => isObject(q) && exact(q, ['id', 'revision', 'text', 'choices', 'correctId', 'explanation', 'season', 'source', 'category'])
    && id(q.id) && !withdrawn.includes(q.id) && integer(q.revision) && text(q.text, 400) && text(q.explanation, 600) && text(q.season, 80)
    && QUIZ_CATEGORIES.some(c => c === q.category) && isObject(q.source) && exact(q.source, ['title', 'url', 'checkedAt'])
    && text(q.source.title) && officialSource(q.source.url, 'international') && utc(q.source.checkedAt) && Date.parse(q.source.checkedAt) <= now
    && Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every((c: unknown) => isObject(c) && exact(c, ['id', 'text']) && id(c.id) && !withdrawn.includes(c.id) && text(c.text))
    && unique(q.choices.map((c: { id: string }) => c.id)) && unique(q.choices.map((c: { text: string }) => c.text)) && q.choices.some((c: { id: string }) => c.id === q.correctId))
    && unique(v.questions.map(q => q.id)) && unique(v.questions.map(q => q.text))
    && QUIZ_CATEGORIES.every(category => (v.questions as { category: string }[]).filter((q: { category: string }) => q.category === category).length >= 2);
}
function quiz(v: unknown, withdrawn: string[], real: boolean, now: number): v is QuizPack {
  if (!isObject(v) || !exact(v, ['id', 'revision', 'questions']) || !id(v.id) || !integer(v.revision) || withdrawn.includes(v.id) || !Array.isArray(v.questions) || v.questions.length !== (real ? 10 : 5)) return false;
  const valid = v.questions.every((q: unknown) => isObject(q) && exact(q, real ? ['id', 'revision', 'text', 'choices', 'correctId', 'explanation', 'season', 'source'] : ['id', 'revision', 'text', 'choices', 'correctId', 'explanation'])
    && (!real || (['2023-24', '2024-25', '2025-26'].includes(String(q.season)) && isObject(q.source)
      && exact(q.source, ['title', 'url', 'checkedAt']) && text(q.source.title) && officialSource(q.source.url, 'quiz')
      && utc(q.source.checkedAt) && Date.parse(q.source.checkedAt) <= now))
    && id(q.id) && !withdrawn.includes(q.id) && integer(q.revision) && text(q.text, 400) && text(q.explanation, 600)
    && Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every((c: unknown) => isObject(c) && exact(c, ['id', 'text']) && id(c.id) && !withdrawn.includes(c.id) && text(c.text))
    && unique(q.choices.map(c => c.id)) && q.choices.some(c => c.id === q.correctId));
  return valid && unique(v.questions.map(q => q.id));
}
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const v of Object.values(value)) freeze(v); }
  return value;
}
/** Real-content previews need explicit caller policy; schema 2 remains local-only. */
export function validateContent(raw: unknown, now: number, options: { allowLocalPreview?: boolean; allowPublicPreview?: boolean } = {}): Result<Content> {
  const local = isObject(raw) && raw.schema === 2;
  const international = isObject(raw) && raw.schema === 4;
  const publicPreview = isObject(raw) && (raw.schema === 3 || international);
  const real = local || publicPreview;
  const keys = ['schema', 'demo', 'revision', 'rightsRevision', 'publishedAt', 'validUntil', 'rights', 'fixtures', 'roster', 'quiz'];
  if (real) keys.push(local ? 'localOnly' : 'previewOnly', 'modes');
  if (local && (!options.allowLocalPreview || raw.localOnly !== true)) return fail('CONTENT_INVALID', 'content');
  if (publicPreview && (!options.allowPublicPreview || raw.previewOnly !== true)) return fail('CONTENT_INVALID', 'content');
  if (real && (raw.demo !== false || !isObject(raw.modes)
    || !exact(raw.modes, ['fixtures', 'roster', 'quiz']) || raw.modes.fixtures !== 'fictional' || raw.modes.roster !== 'real' || raw.modes.quiz !== 'factual')) return fail('CONTENT_INVALID', 'content');
  if (!Number.isFinite(now) || !isObject(raw) || !exact(raw, keys)
    || (!real && (raw.schema !== 1 || raw.demo !== true)) || !integer(raw.revision) || !integer(raw.rightsRevision)
    || !utc(raw.publishedAt) || !utc(raw.validUntil) || Date.parse(raw.publishedAt) > now
    || !isObject(raw.rights) || !exact(raw.rights, ['expiresAt', 'withdrawnIds']) || !utc(raw.rights.expiresAt)
    || !Array.isArray(raw.rights.withdrawnIds) || raw.rights.withdrawnIds.length > 200 || !raw.rights.withdrawnIds.every(id) || !unique(raw.rights.withdrawnIds)) return fail('CONTENT_INVALID', 'content');
  if (Date.parse(raw.validUntil) <= now || Date.parse(raw.rights.expiresAt) <= now) return fail('CONTENT_STALE', 'content');
  const withdrawn = raw.rights.withdrawnIds;
  const issues: Content['issues'] = [];
  const fixturesValid = Array.isArray(raw.fixtures) && raw.fixtures.length <= 63 && raw.fixtures.every(fixture)
    && raw.fixtures.every(f => Date.parse(f.checkedAt) <= now && !withdrawn.includes(f.id))
    && unique(raw.fixtures.map(f => f.id)) && raw.fixtures.filter(f => f.state !== 'final').length <= 21 && raw.fixtures.filter(f => f.state === 'final').length <= 42;
  if (!fixturesValid) issues.push('fixtures');
  const rosterValid = (international ? internationalRoster(raw.roster, withdrawn) : roster(raw.roster, withdrawn, real)) && Date.parse((raw.roster as Roster).asOf) <= now;
  if (!rosterValid) issues.push('roster');
  const quizValid = international ? internationalQuiz(raw.quiz, withdrawn, now) : quiz(raw.quiz, withdrawn, real, now);
  if (!quizValid) issues.push('quiz');
  return ok(freeze({ schema: international ? 4 : local ? 2 : publicPreview ? 3 : 1, demo: !real,
    ...(local ? { localOnly: true as const } : publicPreview ? { previewOnly: true as const } : {}),
    ...(real ? { modes: { fixtures: 'fictional' as const, roster: 'real' as const, quiz: 'factual' as const } } : {}),
    revision: raw.revision, rightsRevision: raw.rightsRevision, publishedAt: raw.publishedAt, validUntil: raw.validUntil,
    rights: { expiresAt: raw.rights.expiresAt, withdrawnIds: [...withdrawn] },
    fixtures: fixturesValid ? structuredClone(raw.fixtures as Fixture[]) : [],
    roster: rosterValid ? structuredClone(raw.roster as Roster) : null, quiz: quizValid ? structuredClone(raw.quiz as QuizPack) : null, issues }));
}
export function currentPolicy(content: Content, now: number): boolean {
  return Number.isFinite(now) && Date.parse(content.publishedAt) <= now && now < Date.parse(content.validUntil) && now < Date.parse(content.rights.expiresAt);
}
