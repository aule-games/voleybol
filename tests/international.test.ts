import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import raw from '../public/content.json' with { type: 'json' };
import { validateContent } from '../src/data/validate.ts';
import { ContentCoordinator } from '../src/data/coordinator.ts';
import { officialSource } from '../src/data/identities.ts';
import { budgetState, validateBudgetTeam } from '../src/domain/budget.ts';
import { attemptState, beginAttempt, confirmAnswer } from '../src/domain/quiz.ts';
import { QUIZ_CATEGORIES, SLOT_ROLES } from '../src/domain/types.ts';
import type { BudgetTeam } from '../src/domain/types.ts';
import { parseFragment, teamUrl } from '../src/router.ts';
import { GameStore } from '../src/platform/storage.ts';
import { memoryStorage, response } from './fixtures.ts';
const now = Date.parse(raw.publishedAt) + 1000;
const parse = (data: unknown = structuredClone(raw)) => validateContent(data, now, { allowPublicPreview: true });
const result = parse(); if (!result.ok) throw Error('Invalid international content');
const content = result.value, roster = content.roster!, pack = content.quiz!;
const uuid = '12345678-1234-4234-8234-123456789abc';
const ids = [1, 2, 5, 6, 9, 11, 13].map(i => roster.players[i]!.id);
const team: BudgetTeam = { roster: roster.version, ids, coachId: roster.coaches![0]!.id, teamId: uuid };
function cheapest(fixed?: { index: number; id: string }) {
  const selected = Array<string>(7).fill(''); if (fixed) selected[fixed.index] = fixed.id;
  for (const [i, role] of SLOT_ROLES.entries()) if (!selected[i]) selected[i] = [...roster.players].filter(p => p.role === role && !selected.includes(p.id)).sort((a, b) => a.cost! - b.cost!)[0]!.id;
  return selected;
}

describe('international content contract', () => {
  it('versions the 65-point policy without changing any player or coach facts or prices', () => {
    expect(roster.version).toBe('world-20261023-v2'); expect(roster.budget).toBe(65);
    expect(raw.revision).toBe(5); expect(raw.validUntil).toBe('2026-10-29T19:34:18.198Z');
    expect(createHash('sha256').update(JSON.stringify(raw.roster.players)).digest('hex')).toBe('508146713b67deb263669cbf91754b98590c7873f8994402ecbd0e85b2b9a046');
    expect(createHash('sha256').update(JSON.stringify(raw.roster.coaches)).digest('hex')).toBe('355e9820b16374a475f68d49abb14e28f9cfb95e2ef411976890795b7bf6bbfa');
  });
  it.each([50, 64, 66, '65', null])('quarantines unsupported cap %s without killing quiz', budget => {
    const d = structuredClone(raw); Object.assign(d.roster, { budget }); const r = parse(d);
    expect(r.ok && r.value.roster).toBeNull(); expect(r.ok && r.value.quiz).toBeTruthy();
  });
  it('has exactly 100 players, ten coaches and 100 questions with primary evidence', () => {
    expect(content.issues).toEqual([]); expect(roster.players).toHaveLength(100); expect(roster.coaches).toHaveLength(10); expect(pack.questions).toHaveLength(100);
    expect(new Set(roster.players.map(p => p.countryCode)).size).toBe(8);
    expect(new Set(roster.players.map(p => p.id)).size).toBe(100);
    for (const p of roster.players) { expect(Number.isInteger(p.cost)).toBe(true); expect(officialSource(p.sourceUrl, 'international')).toBe(true); expect(p.sourceLabel).toBeTruthy(); }
    for (const c of roster.coaches!) expect(officialSource(c.sourceUrl, 'international')).toBe(true);
    for (const category of QUIZ_CATEGORIES) expect(pack.questions.filter(q => q.category === category)).toHaveLength(20);
    for (const q of pack.questions) { expect(officialSource(q.source!.url, 'international')).toBe(true); expect(new Set(q.choices.map(c => c.text)).size).toBe(4); }
    expect(new Set(pack.questions.map(q => q.text)).size).toBe(100);
  });
  it.each([0, -1, 13, 4.5, '5', null])('rejects invalid player price %s without killing quiz', cost => {
    const d = structuredClone(raw); Object.assign(d.roster.players[0]!, { cost }); const r = parse(d);
    expect(r.ok && r.value.roster).toBeNull(); expect(r.ok && r.value.quiz).toBeTruthy();
  });
  it('requires coach count, safe source and category coverage', () => {
    const d = structuredClone(raw); d.roster.coaches.pop(); const r = parse(d); expect(r.ok && r.value.roster).toBeNull();
    const e = structuredClone(raw); e.quiz.questions[0]!.source.url = 'https://untrusted.invalid/a'; const s = parse(e); expect(s.ok && s.value.quiz).toBeNull();
    const f = structuredClone(raw); f.quiz.questions.forEach(q => q.category = 'league'); const t = parse(f); expect(t.ok && t.value.quiz).toBeNull();
  });
  it('quarantines a changed cost under the same roster version', async () => {
    let d = structuredClone(raw); const c = new ContentCoordinator(new URL('http://localhost/content.json'), async () => response(d), () => now);
    expect((await c.refresh()).ok).toBe(true); d = structuredClone(raw); d.revision++; d.roster.players[0]!.cost++;
    const next = await c.refresh(); expect(next.ok && next.value.roster).toBeNull(); expect(next.ok && next.value.quiz).toBeTruthy();
    d.revision++; d.roster.version = 'world-next'; const bumped = await c.refresh(); expect(bumped.ok && bumped.value.roster).toBeTruthy();
  });
});

describe('65-point team constraints', () => {
  it('accepts exactly 65 and refuses 66, including validation of shared links', () => {
    const names = ['Alessia Orro', 'Paola Egonu', 'Gabi Guimarães', 'Mayu Ishikawa', 'Anna Danesi', 'Zehra Güneş', 'Simge Aköz'];
    const exactIds = names.map(name => roster.players.find(p => p.name === name)!.id);
    const exact = { ...team, ids: exactIds, coachId: 'coach-zhao' };
    expect(budgetState(exactIds, exact.coachId, roster)).toMatchObject({ spent: 65, remaining: 0, complete: true, feasible: true });
    expect(validateBudgetTeam(exact, content, now).ok).toBe(true);
    const over = { ...exact, coachId: 'coach-akbas' };
    expect(budgetState(exactIds, over.coachId, roster)).toMatchObject({ spent: 66, remaining: -1, complete: false, feasible: false });
    expect(validateBudgetTeam(over, content, now).ok).toBe(false);
  });
  it('allows the audited 62/64-point Fenerbahçe lineups, but not the 66-point pairing', () => {
    const names = ['Alessia Orro', 'Melissa Vargas', 'Hande Baladın', 'Saliha Şahin', 'Eda Erdem Dündar', 'Chiaka Ogbogu', 'Gizem Örge'];
    const fb = names.map(name => roster.players.find(p => p.name === name)!.id);
    const ana = roster.players.find(p => p.name === 'Ana Cristina')!.id;
    for (const [selection, spent, complete] of [[fb, 62, true], [[...fb.slice(0, 2), ana, ...fb.slice(3)], 64, true], [[...fb.slice(0, 3), ana, ...fb.slice(4)], 66, false]] as const) {
      expect(budgetState(selection, 'coach-lavarini', roster)).toMatchObject({ spent, complete });
    }
  });
  it('accepts seven distinct position-valid players and a coach at exactly 50', () => {
    expect(budgetState(ids, team.coachId, roster)).toMatchObject({ spent: 50, remaining: 15, complete: true, feasible: true });
    expect(validateBudgetTeam(team, content, now).ok).toBe(true);
  });
  it('refunds the replaced player and reserves enough for all empty positions', () => {
    const less = [...ids]; less[1] = roster.players[3]!.id;
    expect(budgetState(less, team.coachId, roster).remaining).toBe(22);
    const partial = Array<string>(7).fill(''); partial[1] = ids[1]!;
    expect(budgetState(partial, '', roster)).toMatchObject({ selected: 1, complete: false, feasible: true });
    const premium: string[] = [];
    for (const role of SLOT_ROLES) premium.push([...roster.players].filter(p => p.role === role && !premium.includes(p.id)).sort((a,b) => b.cost! - a.cost!)[0]!.id);
    expect(new Set(premium).size).toBe(7); expect(budgetState(premium, team.coachId, roster).spent).toBeGreaterThan(65);
    expect(budgetState(premium, team.coachId, roster).feasible).toBe(false);
  });
  it('makes every player and coach usable in at least one legal complete team', () => {
    const cheapCoach = [...roster.coaches!].sort((a,b) => a.cost - b.cost)[0]!;
    for (const p of roster.players) expect(budgetState(cheapest({ index: SLOT_ROLES.indexOf(p.role), id: p.id }), cheapCoach.id, roster).complete, p.name).toBe(true);
    for (const c of roster.coaches!) expect(budgetState(cheapest(), c.id, roster).complete, c.name).toBe(true);
  });
  it.each([
    { coachId: '' }, { coachId: 'unknown' }, { teamId: 'invalid' }, { roster: 'old-costs' },
    { ids: [...ids.slice(0, 6)] }, { ids: [ids[0]!, ids[1]!, ids[2]!, ids[2]!, ...ids.slice(4)] },
    { ids: [ids[1]!, ids[0]!, ...ids.slice(2)] },
  ])('rejects invalid, incomplete, stale and over-budget teams %j', patch => {
    expect(validateBudgetTeam({ ...team, ...patch }, content, now).ok).toBe(false);
  });
  it('honors expiry and coach withdrawal', () => {
    expect(validateBudgetTeam(team, content, Date.parse(content.validUntil)).ok).toBe(false);
    expect(validateBudgetTeam(team, { ...content, rights: { ...content.rights, withdrawnIds: [team.coachId] } }, now).ok).toBe(false);
  });
  it('round-trips a self-contained versioned link without outer tracking queries', () => {
    const url = teamUrl(new URL('https://aule-games.github.io/voleybol/?email=private'), team.roster, ids, team);
    if (!url.ok) throw Error('URL failed'); const parsed = new URL(url.value);
    expect(parsed.pathname).toBe('/voleybol/'); expect(parsed.search).toBe('');
    expect(parseFragment(parsed.hash)).toEqual({ ok: true, value: { mode: 'takim', team } });
    expect(parseFragment(`${parsed.hash}&cost=1`).ok).toBe(false);
    expect(parseFragment(parsed.hash.replace('v=2', 'v=3')).ok).toBe(false);
    expect(parseFragment(parsed.hash.replace(uuid, 'invalid')).ok).toBe(false);
  });
  it('persists the same unique team ID and preserves independent legacy records', () => {
    const storage = memoryStorage(); let n = 0; const store = new GameStore(storage, () => `save-${++n}`, () => now);
    expect(store.save('lineup:own', { kind: 'lineup', data: { roster: 'old', ids } }, []).ok).toBe(true);
    expect(store.save('lineup:budget', { kind: 'budget-team', data: team }, []).ok).toBe(true);
    const read = new GameStore(storage).read(); expect(read.quarantined).toBe(0); expect(read.records).toHaveLength(2);
    expect(read.records.find(r => r.entity === 'lineup:budget')!.value.data).toEqual(team);
  });
});

describe('ten-question rounds from a 100-question bank', () => {
  it('chooses ten unique questions, two per category, without modifying the bank', () => {
    const a = beginAttempt(pack, 'attempt', false, new Set(), () => .7);
    expect(a.questions).toHaveLength(10); expect(new Set(a.questions.map(q => q.id)).size).toBe(10);
    for (const c of QUIZ_CATEGORIES) expect(a.questions.filter(q => pack.questions.find(p => p.id === q.id)!.category === c)).toHaveLength(2);
    expect(attemptState(a, pack)).toBe('active'); expect(pack.questions).toHaveLength(100);
    const b = beginAttempt(pack, 'next', true, new Set(a.questions.map(q => q.id)), () => .7);
    expect(b.questions.some(q => a.questions.some(p => p.id === q.id))).toBe(false);
  });
  it('persists the random selection even with zero answers', () => {
    const a = beginAttempt(pack, 'attempt', false); const storage = memoryStorage();
    expect(new GameStore(storage, () => 'save-1', () => now).save('quiz:attempt', { kind: 'quiz', data: a }, []).ok).toBe(true);
    expect(new GameStore(storage).read().records[0]!.value.data).toEqual(a);
  });
  it('scores the selected subset, protects committed answers and freezes corrections', () => {
    let a = beginAttempt(pack, 'attempt', false, new Set(), () => .3);
    for (const ref of a.questions) {
      const q = pack.questions.find(p => p.id === ref.id)!;
      const r = confirmAnswer(a, pack, q.id, q.correctId); if (!r.ok) throw Error('Answer failed'); a = r.value;
      if (a.answers.length < 10) expect(confirmAnswer(a, pack, q.id, q.choices.find(c => c.id !== q.correctId)!.id)).toEqual({ ok: true, value: a });
    }
    expect(a.originalScore).toBe(10); expect(attemptState(a, pack)).toBe('complete');
    expect(attemptState(a, { ...pack, revision: 2 })).toBe('revised');
    expect(attemptState({ ...a, answers: [], originalScore: null }, { ...pack, revision: 2 })).toBe('frozen');
    const bad = structuredClone(a); bad.questions[1] = bad.questions[0]!; expect(attemptState(bad, pack)).toBe('invalid');
  });
});
