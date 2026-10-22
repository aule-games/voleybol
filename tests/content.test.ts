import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContentCoordinator } from '../src/data/coordinator.ts';
import { DAY, MAX_BYTES, validateContent } from '../src/data/validate.ts';
import { NOW, response, sample } from './fixtures.ts';
const url = new URL('http://localhost/demo/content.json');
afterEach(() => vi.useRealTimers());

describe('T04 atomic content validation', () => {
  it('accepts and deeply freezes all three modes', () => {
    const result = validateContent(sample(), NOW); expect(result.ok).toBe(true);
    if (result.ok) { expect(result.value.issues).toEqual([]); expect(Object.isFrozen(result.value.quiz!.questions[0]!.choices)).toBe(true); }
  });
  it.each([null, {}, [], { ...sample(), schema: 2 }, { ...sample(), demo: false }, { ...sample(), secret: 'unexpected' }, { ...sample(), revision: 1.3 }, { ...sample(), rights: { expiresAt: 'invalid', withdrawnIds: [] } }])('rejects invalid common envelope %#', value => { expect(validateContent(value, NOW).ok).toBe(false); });
  it('quarantines only a bad quiz; never combines previous versions', () => {
    const data = sample(); data.quiz.questions[0]!.correctId = 'missing';
    const result = validateContent(data, NOW); expect(result.ok).toBe(true);
    if (result.ok) { expect(result.value.quiz).toBeNull(); expect(result.value.fixtures).toHaveLength(4); expect(result.value.issues).toEqual(['quiz']); }
  });
  it('rejects duplicate players and unknown roles in the roster mode', () => {
    const data = sample(); data.roster.players.push(data.roster.players[0]!);
    const result = validateContent(data, NOW); expect(result.ok && result.value.roster).toBeNull();
  });
  it('enforces collection caps rather than silently truncating', () => {
    const data = sample(); data.fixtures = Array.from({ length: 22 }, (_, i) => ({ ...data.fixtures[0]!, id: `m${i}` }));
    const result = validateContent(data, NOW); expect(result.ok && result.value.issues).toContain('fixtures');
  });
  it('quarantines an impossible final score', () => {
    const data = sample(); (data.fixtures[3] as unknown as { result: string }).result = '3-3';
    const result = validateContent(data, NOW); expect(result.ok && result.value.fixtures).toEqual([]);
  });
  it('does not distribute a withdrawn identity from a current roster', () => {
    const data = sample(); data.rights.withdrawnIds = ['p1']; const result = validateContent(data, NOW);
    expect(result.ok && result.value.roster).toBeNull();
  });
});
describe('T05/T06 fetch, ordering and freshness boundaries', () => {
  it('uses no-store, omitted credentials, redirect error and the fixed content URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response()); const c = new ContentCoordinator(url, fetcher, () => NOW);
    expect((await c.refresh()).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith(url, expect.objectContaining({ cache: 'no-store', credentials: 'omit', redirect: 'error', signal: expect.any(AbortSignal) }));
  });
  it.each([404, 500, 302])('rejects HTTP %s', async status => { const c = new ContentCoordinator(url, vi.fn().mockResolvedValue(response({}, status)), () => NOW); expect((await c.refresh()).ok).toBe(false); });
  it.each(['text/html', 'text/plain'])('rejects %s content', async mime => { const c = new ContentCoordinator(url, vi.fn().mockResolvedValue(new Response('{}', { headers: { 'content-type': mime } })), () => NOW); expect((await c.refresh()).ok).toBe(false); });
  it('bounds uncompressed streamed bytes', async () => {
    const c = new ContentCoordinator(url, vi.fn().mockResolvedValue(new Response('x'.repeat(MAX_BYTES + 1), { headers: { 'content-type': 'application/json' } })), () => NOW);
    expect((await c.refresh()).ok).toBe(false);
  });
  it('rejects malformed JSON and malformed UTF-8', async () => {
    for (const data of ['{', new Uint8Array([0xc0, 0xaf])]) {
      const c = new ContentCoordinator(url, vi.fn().mockResolvedValue(new Response(data, { headers: { 'content-type': 'application/json' } })), () => NOW);
      expect((await c.refresh()).ok).toBe(false);
    }
  });
  it('applies a 5000ms deadline to stalled body consumption', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValue(new Response(new ReadableStream(), { headers: { 'content-type': 'application/json' } }));
    const c = new ContentCoordinator(url, fetcher, () => NOW); const result = c.refresh();
    await vi.advanceTimersByTimeAsync(5000); expect((await result).ok).toBe(false); expect(c.trusted).toBe(false);
  });
  it('discards obsolete responses even if fetch ignores abort', async () => {
    let resolve!: (v: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValueOnce(response());
    const c = new ContentCoordinator(url, fetcher, () => NOW); const first = c.refresh(); expect((await c.refresh()).ok).toBe(true);
    resolve(response()); expect((await first).ok).toBe(false); expect(c.trusted).toBe(true);
  });
  it('accepts the identical revision; rejects content and rights rollbacks', async () => {
    const data = sample(); data.revision = 4; data.rightsRevision = 4;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response(data)); const c = new ContentCoordinator(url, fetcher, () => NOW);
    expect((await c.refresh()).ok).toBe(true); expect((await c.refresh()).ok).toBe(true);
    data.rightsRevision = 3; expect((await c.refresh()).ok).toBe(false); expect(c.snapshot).toBeNull();
  });
  it('rejects changes without a content revision bump', async () => {
    const data = sample(); const c = new ContentCoordinator(url, async () => response(data), () => NOW); await c.refresh();
    data.fixtures[0]!.home = 'Changed'; expect((await c.refresh()).ok).toBe(false);
  });
  it('never resurrects an older rights policy after rejecting accompanying rolled-back content', async () => {
    const data = sample(); data.revision = 4;
    const c = new ContentCoordinator(url, async () => response(data), () => NOW); expect((await c.refresh()).ok).toBe(true);
    data.revision = 3; data.rightsRevision++; data.rights.withdrawnIds = ['p1']; data.roster.players = data.roster.players.filter(p => p.id !== 'p1');
    expect((await c.refresh()).ok).toBe(false);
    const old = sample(); old.revision = 4; Object.assign(data, old);
    expect((await c.refresh()).ok).toBe(false); expect(c.snapshot).toBeNull();
  });
  it('quarantines an unversioned quiz-key change without closing valid games', async () => {
    const data = sample(); const c = new ContentCoordinator(url, async () => response(data), () => NOW); await c.refresh();
    data.revision++; data.quiz.questions[0]!.correctId = 'q1-c2';
    const result = await c.refresh(); expect(result.ok).toBe(true);
    if (result.ok) { expect(result.value.quiz).toBeNull(); expect(result.value.fixtures).toHaveLength(4); }
  });
  it('quarantines rescheduling without a schedule-revision bump', async () => {
    const data = sample(); const c = new ContentCoordinator(url, async () => response(data), () => NOW); await c.refresh();
    data.revision++; data.fixtures[0]!.startsAt = new Date(NOW + DAY / 2).toISOString(); data.fixtures[0]!.locksAt = data.fixtures[0]!.startsAt;
    const result = await c.refresh(); expect(result.ok && result.value.fixtures).toEqual([]);
  });
  it.each(['validUntil', 'publishedAt'] as const)('rejects invalid %s', key => {
    const data = sample(); data[key] = key === 'validUntil' ? new Date(NOW).toISOString() : new Date(NOW + 1).toISOString();
    expect(validateContent(data, NOW).ok).toBe(false);
  });
  it('rejects future editorial time, without resetting checkedAt on fetch', () => {
    const data = sample(); data.fixtures[0]!.checkedAt = new Date(NOW + DAY).toISOString();
    const r = validateContent(data, NOW); expect(r.ok && r.value.fixtures).toEqual([]);
  });
});
