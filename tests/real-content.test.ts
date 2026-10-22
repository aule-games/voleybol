import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import raw from '../public/content.json' with { type: 'json' };
import { validateContent } from '../src/data/validate.ts';
import { ContentCoordinator } from '../src/data/coordinator.ts';
import { CLUBS, COUNTRIES, isLoopback, officialSource } from '../src/data/identities.ts';
import { attemptState, beginAttempt, confirmAnswer } from '../src/domain/quiz.ts';
import { validateLineup } from '../src/domain/lineup.ts';
import { lineupText } from '../src/platform/share.ts';
import { GameStore } from '../src/platform/storage.ts';
import { memoryStorage, response, TEAM } from './fixtures.ts';
const now = Date.parse(raw.publishedAt) + 1000;
const parse = (data: unknown = structuredClone(raw)) => validateContent(data, now, { allowLocalPreview: true });
const current = () => { const r = parse(); if (!r.ok) throw Error('Invalid real preview'); return r.value; };

describe('explicit local mixed-content contract', () => {
  it('defaults closed; distinguishes real names/facts from fictional matches', () => {
    expect(validateContent(raw, now).ok).toBe(false);
    const c = current(); expect(c.issues).toEqual([]); expect(c.demo).toBe(false); expect(c.modes).toEqual({ fixtures: 'fictional', roster: 'real', quiz: 'factual' });
    expect(Object.isFrozen(c.quiz!.questions[0]!.source)).toBe(true);
  });
  it.each(['https://example.com', 'https://localhost.example.com', 'http://192.168.1.5', 'file:///tmp', 'http://127.0.0.2'])('rejects non-loopback origin %s', async origin => {
    const url = new URL('/content.json', origin); expect(isLoopback(url)).toBe(false);
    const c = new ContentCoordinator(url, async () => response(raw), () => now); expect((await c.refresh()).ok).toBe(false);
  });
  it.each(['http://localhost', 'http://127.0.0.1', 'http://[::1]'])('permits local preview %s', async origin => {
    const c = new ContentCoordinator(new URL('/content.json', origin), async () => response(raw), () => now); expect((await c.refresh()).ok).toBe(true);
  });
  it('does not reinterpret old player IDs or old roster links', () => {
    const c = current(); expect(c.roster!.players).toHaveLength(14);
    expect(c.roster!.players.every(p => p.id.startsWith('real-wd-'))).toBe(true);
    expect(validateLineup(TEAM, 'demo-v1', c, now).ok).toBe(false);
    expect(c.roster!.players.reduce<Record<string, number>>((a, p) => ({ ...a, [p.role]: (a[p.role] ?? 0) + 1 }), {})).toEqual({ setter: 2, opposite: 2, outside: 4, middle: 4, libero: 2 });
    expect(c.roster!.players.find(p => p.name === 'Derya Cebecioğlu')?.clubId).toBe('thy');
    expect(c.roster!.players.find(p => p.name === 'Saliha Şahin')?.clubId).toBe('fenerbahce');
  });
  it.each(['clubId', 'countryCode', 'sourceUrl'] as const)('quarantines unknown %s without closing quiz', field => {
    const d = structuredClone(raw); d.roster.players[0]![field] = 'https://untrusted.invalid/asset.svg';
    const r = parse(d); expect(r.ok && r.value.roster).toBeNull(); expect(r.ok && r.value.quiz).toBeTruthy();
  });
  it('rejects extra asset fields, future evidence and incorrect mode labels', () => {
    const d = structuredClone(raw); Object.assign(d.roster.players[0]!, { mark: 'https://bad.invalid' }); const extra = parse(d); expect(extra.ok && extra.value.roster).toBeNull();
    const future = structuredClone(raw); future.quiz.questions[0]!.source.checkedAt = new Date(now + 1000).toISOString(); const r = parse(future); expect(r.ok && r.value.quiz).toBeNull();
    expect(parse({ ...raw, modes: { ...raw.modes, fixtures: 'real' } }).ok).toBe(false);
  });
  it('has local safe marks and usable source metadata for every identity', () => {
    for (const item of [...Object.values(CLUBS), ...Object.values(COUNTRIES)]) {
      const bytes = readFileSync(`public/${item.mark}`); expect(bytes.byteLength).toBeGreaterThan(100);
      if (item.mark.endsWith('.svg')) expect(bytes.toString()).not.toMatch(/<script|<foreignObject|onload=|(?:href|src)=["'](?:https?:|data:)/i);
    }
    expect(raw.roster.players.every(p => p.countryCode === 'TR' && officialSource(p.sourceUrl, 'player'))).toBe(true);
  });
  it('keeps withdrawal and expiry gates on real content', () => {
    const d = structuredClone(raw); d.rights.withdrawnIds = [d.roster.players[0]!.id] as never[]; const r = parse(d); expect(r.ok && r.value.roster).toBeNull();
    expect(validateContent(raw, Date.parse(raw.validUntil), { allowLocalPreview: true }).ok).toBe(false);
  });
  it('does not label a real-name team fictional in text exports', () => {
    const c = current(); expect(lineupText(c.roster!.players.slice(0, 7), true)).toContain('Gerçek oyuncular'); expect(lineupText(c.roster!.players.slice(0, 7), true)).not.toContain('Kurgusal');
  });
});
describe('ten factual questions with durable progress', () => {
  it('has 3/3/4 season coverage, distinct answers and a checked source for each', () => {
    const qs = current().quiz!.questions; expect(qs).toHaveLength(10);
    expect(qs.reduce<Record<string, number>>((a, q) => ({ ...a, [q.season!]: (a[q.season!] ?? 0) + 1 }), {})).toEqual({ '2023-24': 3, '2024-25': 3, '2025-26': 4 });
    for (const q of qs) { expect(new Set(q.choices.map(c => c.text)).size).toBe(4); expect(q.choices.filter(c => c.id === q.correctId)).toHaveLength(1); expect(officialSource(q.source!.url, 'quiz')).toBe(true); }
  });
  it('scores only after ten confirmed answers and persists/reloads the complete record', () => {
    const pack = current().quiz!; let a = beginAttempt(pack, 'ten-attempt', false); const storage = memoryStorage(); let n = 0; const store = new GameStore(storage, () => `save-${++n}`, () => now); let parents: string[] = [];
    for (const q of pack.questions) {
      const r = confirmAnswer(a, pack, q.id, q.correctId); if (!r.ok) throw Error('Answer refused'); a = r.value;
      expect(a.originalScore).toBe(a.answers.length === 10 ? 10 : null);
      const saved = store.save('quiz:ten-attempt', { kind: 'quiz', data: a }, parents); if (!saved.ok) throw Error('Save refused'); parents = [saved.value.record.id];
      expect(new GameStore(storage).read().quarantined).toBe(0);
    }
    expect(attemptState(a, pack)).toBe('complete'); expect(store.read().records).toHaveLength(10);
    expect(confirmAnswer(a, pack, pack.questions[0]!.id, 'wrong').ok).toBe(false);
  });
  it('rejects reordered/duplicate question references and answer replay', () => {
    const pack = current().quiz!; const a = beginAttempt(pack, 'attempt', false);
    [a.questions[0], a.questions[1]] = [a.questions[1]!, a.questions[0]!]; expect(attemptState(a, pack)).toBe('invalid');
    const b = beginAttempt(pack, 'attempt', false); b.answers = [{ questionId: pack.questions[1]!.id, choiceId: pack.questions[1]!.correctId }]; expect(attemptState(b, pack)).toBe('invalid');
  });
  it.each(['javascript:alert(1)', 'https://tvf.org.tr.evil.invalid/icerik/one', 'https://user:pass@tvf.org.tr/icerik/a', 'https://tvf.org.tr/icerik/a?email=test'])('rejects unsafe quiz source %s', url => {
    const d = structuredClone(raw); d.quiz.questions[0]!.source.url = url; const r = parse(d); expect(r.ok && r.value.quiz).toBeNull();
  });
});
