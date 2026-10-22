import { describe, expect, it, vi } from 'vitest';
import { SCORES } from '../src/domain/types.ts';
import { validateLineup } from '../src/domain/lineup.ts';
import { eligibleFixtures, feedback, predictionBlock, PredictionSubmitter } from '../src/domain/prediction.ts';
import { attemptState, beginAttempt, confirmAnswer, scoreAttempt } from '../src/domain/quiz.ts';
import { ContentCoordinator } from '../src/data/coordinator.ts';
import { validateContent } from '../src/data/validate.ts';
import { ok } from '../src/platform/result.ts';
import { NOW, response, sample, TEAM, valid } from './fixtures.ts';

describe('T07/T08/T09/T10 prediction contracts', () => {
  it.each(SCORES)('saves valid score %s only after a fresh final guard', async score => {
    const c = new ContentCoordinator(new URL('http://localhost/content.json'), async () => response(), () => NOW);
    const submitter = new PredictionSubmitter(c, () => NOW); const commit = vi.fn().mockReturnValue(ok(true));
    const result = await submitter.submit({ fixtureId: 'demo-match-1', score, scheduleRevision: 1, contentRevision: sample().revision }, () => true, () => true, commit);
    expect(result.ok).toBe(true); expect(commit).toHaveBeenCalledOnce();
  });
  it.each([-1, 0, 1])('uses now < locksAt (%s ms)', offset => {
    const c = valid(); const m = c.fixtures[0]!; const now = Date.parse(m.locksAt!) + offset;
    expect(predictionBlock(c, m, now, true)).toBe(offset < 0 ? null : 'PREDICTION_LOCKED');
  });
  it('rechecks current time after awaited fetch', async () => {
    const lock = Date.parse(sample().fixtures[0]!.locksAt!); let now = NOW;
    const c = new ContentCoordinator(new URL('http://localhost/content.json'), async () => { now = lock; return response(); }, () => now);
    const s = new PredictionSubmitter(c, () => now); const commit = vi.fn();
    expect((await s.submit({ fixtureId: 'demo-match-1', score: '3-0', scheduleRevision: 1, contentRevision: sample().revision }, () => true, () => true, commit)).ok).toBe(false); expect(commit).not.toHaveBeenCalled();
  });
  it('does not commit a changed selection, content or schedule', async () => {
    for (const changed of ['selection', 'content', 'schedule']) {
      const data = sample(); if (changed === 'content') data.revision++; if (changed === 'schedule') { data.fixtures[0]!.scheduleRevision++; data.fixtures[0]!.reopened = true; }
      const c = new ContentCoordinator(new URL('http://localhost/content.json'), async () => response(data), () => NOW); const commit = vi.fn();
      const result = await new PredictionSubmitter(c, () => NOW).submit({ fixtureId: 'demo-match-1', score: '3-0', scheduleRevision: 1, contentRevision: sample().revision }, () => changed !== 'selection', () => true, commit);
      expect(result.ok).toBe(false); expect(commit).not.toHaveBeenCalled();
    }
  });
  it('offline causes no request, save or queue', async () => {
    const fetcher = vi.fn(); const c = new ContentCoordinator(new URL('http://localhost/content.json'), fetcher, () => NOW); const commit = vi.fn();
    expect((await new PredictionSubmitter(c, () => NOW).submit({ fixtureId: 'demo-match-1', score: '3-0', scheduleRevision: 1, contentRevision: 1 }, () => true, () => false, commit)).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled(); expect(commit).not.toHaveBeenCalled();
  });
  it('gives schedule state priority over offline and needs explicit reopen', () => {
    const c = valid(); const m = { ...c.fixtures[0]!, scheduleRevision: 2, reopened: false };
    expect(predictionBlock(c, m, NOW, false)).toBe('PREDICTION_UNAVAILABLE');
    expect(predictionBlock(c, { ...m, reopened: true }, NOW, true)).toBeNull();
  });
  it('closes editorial data older than 24h', () => {
    const c = valid(); expect(predictionBlock(c, { ...c.fixtures[0]!, checkedAt: new Date(NOW - 86_400_001).toISOString() }, NOW, true)).toBe('CONTENT_STALE');
  });
  it('derives feedback without changing a pick', () => { expect(feedback('3-0', '3-0')).toBe('Tam isabet'); expect(feedback('3-0', '3-1')).toBe('Kazanan doğru'); expect(feedback('3-0', '1-3')).toBe('Bu kez olmadı'); });
  it('selects the earliest eligible match', () => { expect(eligibleFixtures(valid(), NOW, true)[0]?.id).toBe('demo-match-1'); });
});
describe('T12 exact unique role slots', () => {
  it('allows the required duplicate roles, not duplicate players', () => { expect(validateLineup(TEAM, 'demo-v1', valid(), NOW).ok).toBe(true); });
  it.each([TEAM.slice(0, 6), [...TEAM, 'p14'], ['p1', 'p3', 'p5', 'p5', 'p9', 'p10', 'p13'], ['p3', 'p1', ...TEAM.slice(2)], ['missing', ...TEAM.slice(1)]].map(ids => ({ ids })))('rejects invalid lineup %#', ({ ids }) => { expect(validateLineup(ids, 'demo-v1', valid(), NOW).ok).toBe(false); });
  it('does not use an old or withdrawn roster', () => { expect(validateLineup(TEAM, 'old', valid(), NOW).ok).toBe(false); const data = sample(); data.rights.withdrawnIds = ['p1']; const r = validateContent(data, NOW); expect(r.ok && validateLineup(TEAM, 'demo-v1', r.value, NOW).ok).toBe(false); });
});
describe('T21/T22/T23 quiz stable identity and revisions', () => {
  const pack = valid().quiz!;
  it('confirms five distinct stable answers and produces the score', () => {
    let a = beginAttempt(pack, 'attempt', false);
    for (const q of pack.questions) { const result = confirmAnswer(a, pack, q.id, q.correctId); if (!result.ok) throw new Error(); a = result.value; }
    expect(a.answers).toHaveLength(5); expect(a.originalScore).toBe(5); expect(scoreAttempt(a, pack)).toBe(5); expect(attemptState(a, pack)).toBe('complete');
  });
  it('double-confirm and Back cannot change a committed answer', () => {
    const first = pack.questions[0]!; const result = confirmAnswer(beginAttempt(pack, 'a', false), pack, first.id, first.correctId); if (!result.ok) throw new Error();
    const second = confirmAnswer(result.value, pack, first.id, first.choices[2]!.id); expect(second).toEqual(result);
  });
  it('rejects skipping a question or an unknown choice', () => {
    const a = beginAttempt(pack, 'a', false); expect(confirmAnswer(a, pack, pack.questions[1]!.id, pack.questions[1]!.correctId).ok).toBe(false); expect(confirmAnswer(a, pack, pack.questions[0]!.id, 'unknown').ok).toBe(false);
  });
  it('freezes unfinished attempts on observed revisions', () => { const a = beginAttempt(pack, 'a', false); expect(attemptState(a, { ...pack, revision: pack.revision + 1 })).toBe('frozen'); });
  it('recomputes corrected finished scores by IDs, even when choices reorder', () => {
    let a = beginAttempt(pack, 'a', false);
    for (const q of pack.questions) { const r = confirmAnswer(a, pack, q.id, q.correctId); if (r.ok) a = r.value; }
    const next = structuredClone(pack); next.revision++; next.questions[0]!.revision++; next.questions[0]!.correctId = next.questions[0]!.choices[1]!.id; next.questions.forEach(q => q.choices.reverse());
    expect(attemptState(a, next)).toBe('revised'); expect(scoreAttempt(a, next)).toBe(4); expect(a.originalScore).toBe(5);
    next.questions[0]!.choices = next.questions[0]!.choices.filter(c => c.id !== a.answers[0]!.choiceId); expect(attemptState(a, next)).toBe('invalid');
  });
  it('missing/withdrawn questions make old results unscored', () => { const a = beginAttempt(pack, 'a', false); expect(attemptState(a, null)).toBe('invalid'); expect(attemptState(a, { ...pack, questions: pack.questions.slice(1) })).toBe('invalid'); });
});
