import type { Content, Fixture, Pick, Score } from './types.ts';
import { isScore } from './types.ts';
import { currentPolicy, DAY } from '../data/validate.ts';
import type { ContentCoordinator } from '../data/coordinator.ts';
import { fail } from '../platform/result.ts';
import type { ErrorCode, Result } from '../platform/result.ts';

export function predictionBlock(content: Content, match: Fixture, now: number, online: boolean): ErrorCode | null {
  if (content.issues.includes('fixtures') || content.rights.withdrawnIds.includes(match.id)) return 'CONTENT_INVALID';
  if (match.state !== 'scheduled' || !match.startsAt || !match.locksAt || (match.scheduleRevision > 1 && !match.reopened)) return 'PREDICTION_UNAVAILABLE';
  if (now >= Date.parse(match.locksAt)) return 'PREDICTION_LOCKED';
  if (!online) return 'OFFLINE';
  if (!currentPolicy(content, now) || now < Date.parse(match.checkedAt) || now - Date.parse(match.checkedAt) > DAY) return 'CONTENT_STALE';
  return null;
}
export function feedback(pick: Score, result: Score): string {
  if (pick === result) return 'Tam isabet';
  return (pick.startsWith('3') === result.startsWith('3')) ? 'Kazanan doğru' : 'Bu kez olmadı';
}
export function eligibleFixtures(content: Content, now: number, online: boolean): Fixture[] {
  return content.fixtures.filter(m => !predictionBlock(content, m, now, online)).sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!) || a.id.localeCompare(b.id));
}
export class PredictionSubmitter {
  private busy = false;
  constructor(private readonly coordinator: ContentCoordinator, private readonly now: () => number = Date.now) {}
  async submit<T>(input: { fixtureId: string; score: Score; scheduleRevision: number; contentRevision: number }, stillCurrent: () => boolean, online: () => boolean, commit: (pick: Pick) => Result<T>): Promise<Result<T>> {
    if (this.busy || !isScore(input.score)) return fail('PREDICTION_CHANGED', 'prediction');
    if (!online()) return fail('OFFLINE', 'prediction');
    this.busy = true;
    try {
      const fresh = await this.coordinator.refresh();
      if (!fresh.ok) return fresh;
      const now = this.now();
      const match = fresh.value.fixtures.find(m => m.id === input.fixtureId);
      if (!stillCurrent() || !match || match.scheduleRevision !== input.scheduleRevision || fresh.value.revision !== input.contentRevision) return fail('PREDICTION_CHANGED', 'prediction');
      const blocked = predictionBlock(fresh.value, match, now, online());
      if (blocked) return fail(blocked, 'prediction');
      // No await is permitted between the guards above and this synchronous write.
      return commit({ fixtureId: match.id, score: input.score, scheduleRevision: match.scheduleRevision, contentRevision: fresh.value.revision, savedAt: new Date(now).toISOString() });
    } finally { this.busy = false; }
  }
}
