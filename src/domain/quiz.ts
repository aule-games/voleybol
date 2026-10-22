import type { Attempt, QuizPack } from './types.ts';
import { fail, ok } from '../platform/result.ts';
import type { Result } from '../platform/result.ts';

export function beginAttempt(pack: QuizPack, id: string, practice: boolean): Attempt {
  return { id, packId: pack.id, packRevision: pack.revision, practice, questions: pack.questions.map(q => ({ id: q.id, revision: q.revision })), answers: [], originalScore: null };
}
export function attemptState(attempt: Attempt, pack: QuizPack | null): 'active' | 'frozen' | 'complete' | 'revised' | 'invalid' {
  if (!pack || pack.id !== attempt.packId || ![5, 10].includes(attempt.questions.length) || attempt.questions.length !== pack.questions.length || attempt.questions.some((q, i) => pack.questions[i]?.id !== q.id) || attempt.answers.length > attempt.questions.length || attempt.answers.some((a, i) => a.questionId !== attempt.questions[i]?.id) || attempt.answers.some(a => !pack.questions.find(q => q.id === a.questionId)?.choices.some(c => c.id === a.choiceId))) return 'invalid';
  const changed = pack.revision !== attempt.packRevision || attempt.questions.some(q => pack.questions.find(p => p.id === q.id)?.revision !== q.revision);
  if (attempt.answers.length === attempt.questions.length) return changed ? 'revised' : 'complete';
  return changed ? 'frozen' : 'active';
}
export function scoreAttempt(attempt: Attempt, pack: QuizPack): number {
  return attempt.answers.filter(a => pack.questions.find(q => q.id === a.questionId)?.correctId === a.choiceId).length;
}
export function confirmAnswer(attempt: Attempt, pack: QuizPack, questionId: string, choiceId: string): Result<Attempt> {
  if (attemptState(attempt, pack) !== 'active') return fail('QUIZ_UPDATED', 'quiz');
  const committed = attempt.answers.find(a => a.questionId === questionId);
  if (committed) return ok(attempt); // Back and duplicate clicks cannot change a committed answer.
  const expected = attempt.questions[attempt.answers.length];
  const question = pack.questions.find(q => q.id === questionId);
  if (!expected || expected.id !== questionId || !question?.choices.some(c => c.id === choiceId)) return fail('QUIZ_INVALID', 'quiz');
  const next: Attempt = { ...attempt, answers: [...attempt.answers, { questionId, choiceId }] };
  if (next.answers.length === next.questions.length) next.originalScore = scoreAttempt(next, pack);
  return ok(next);
}
