import raw from './data/demo-content.json' with { type: 'json' };
import type { Content, QuizPack, Roster } from '../src/domain/types.ts';
import { validateContent } from '../src/data/validate.ts';
export const NOW = Date.parse('2026-10-22T12:00:00.000Z');
export const TEAM = ['p1', 'p3', 'p5', 'p6', 'p9', 'p10', 'p13'];
export type RawContent = Omit<Content, 'issues' | 'roster' | 'quiz'> & { roster: Roster; quiz: QuizPack };
export function sample(now = NOW): RawContent {
  const data = structuredClone(raw) as RawContent;
  data.publishedAt = new Date(now - 1000).toISOString(); data.validUntil = new Date(now + 86_400_000).toISOString();
  data.rights.expiresAt = data.validUntil; data.roster.asOf = data.publishedAt;
  data.fixtures.forEach((m, i) => { m.checkedAt = data.publishedAt; if (m.startsAt) m.startsAt = new Date(now + (i + 1) * 3_600_000).toISOString(); m.locksAt = m.startsAt; });
  return data;
}
export function valid(now = NOW): Content { const result = validateContent(sample(now), now); if (!result.ok) throw new Error('Bad test fixture'); return result.value; }
export function response(data: unknown = sample(), status = 200): Response { return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } }); }
export function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, key: i => [...values.keys()][i] ?? null, getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: k => { values.delete(k); }, clear: () => values.clear() };
}
