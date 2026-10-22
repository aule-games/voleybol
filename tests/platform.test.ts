import { describe, expect, it } from 'vitest';
import { encodeTeam, parseFragment, teamUrl } from '../src/router.ts';
import { GameStore, heads, PREFIX, TEST_KEY } from '../src/platform/storage.ts';
import type { SavedValue, SaveRecord } from '../src/platform/storage.ts';
import { lineupText, preparedValid, wrapName } from '../src/platform/share.ts';
import type { PreparedTeam } from '../src/platform/share.ts';
import { ANALYTICS_ENABLED, track } from '../src/platform/analytics.ts';
import { NOW, memoryStorage, TEAM, valid } from './fixtures.ts';

describe('T14 strict codec and query-free exports', () => {
  it.each(['', '#/', '#/tahmin', '#/takim', '#/quiz'])('accepts route %s', path => { expect(parseFragment(path).ok).toBe(true); });
  it('roundtrips canonical v/r/p and decodes once', () => {
    const encoded = encodeTeam('demo-v1', TEAM); if (!encoded.ok) throw new Error();
    expect(encoded.value).toBe('#/takim?v=1&r=demo-v1&p=p1%2Cp3%2Cp5%2Cp6%2Cp9%2Cp10%2Cp13');
    expect(parseFragment(encoded.value)).toEqual({ ok: true, value: { mode: 'takim', team: { roster: 'demo-v1', ids: TEAM } } });
  });
  const validHash = '#/takim?v=1&r=demo-v1&p=p1,p3,p5,p6,p9,p10,p13';
  it.each([
    '#/bad', '#/quiz?', '#/takim?', '#/takim?%', '#/takim?%A', '#/takim?%C0%AF', '#/takim?%ED%A0%80', '#/takim?%F0%80%80%AF', '#/%2e%2e', '#/takim?v=1&r=../x&p=one',
    `${validHash}&v=1`, `${validHash}&extra=1`, `${validHash}&__proto__=x`, validHash.replace('v=1', 'v=2'), validHash.replace('p1,', '%2570%2531,'), validHash.replace('p1,', '<img>,'), validHash.replace('p3', 'p1'), validHash.replace(',p13', ''), '#/takim?' + 'x'.repeat(2048),
  ])('rejects malformed or ambiguous fragment %#', hash => { expect(parseFragment(hash).ok).toBe(false); });
  it.each(['https://example.test/', 'https://example.test/games/'])('keeps approved base %s without query', base => {
    const url = teamUrl(new URL(base + '?email=private&utm_source=anything'), 'demo-v1', TEAM); if (!url.ok) throw new Error();
    expect(new URL(url.value).search).toBe(''); expect(url.value.startsWith(base + '#/takim?')).toBe(true);
  });
});
describe('T24/T25/T26/T27 append-only persistence', () => {
  const value: SavedValue = { kind: 'lineup', data: { roster: 'demo-v1', ids: TEAM } };
  function setup() { const storage = memoryStorage(); let n = 0; const store = new GameStore(storage, () => `r${++n}`, () => NOW); return { storage, store }; }
  it('saves append-only revisions without losing the earlier record', () => {
    const { store } = setup(); const first = store.save('lineup:own', value, []); if (!first.ok) throw new Error();
    const next = store.save('lineup:own', value, [first.value.record.id]); expect(next.ok).toBe(true);
    expect(store.read().records).toHaveLength(2); expect(heads(store.read().records, 'lineup:own')).toHaveLength(1);
  });
  it('preserves separate entities and refuses a stale parent', () => {
    const { store } = setup(); const first = store.save('lineup:own', value, []); expect(first.ok).toBe(true);
    expect(store.save('lineup:own', value, []).ok).toBe(false);
    const prediction: SavedValue = { kind: 'prediction', data: { fixtureId: 'm1', score: '3-0', scheduleRevision: 1, contentRevision: 1, savedAt: new Date(NOW).toISOString() } };
    expect(store.save('prediction:m1', prediction, []).ok).toBe(true); expect(store.read().records).toHaveLength(2);
  });
  it('retains concurrent siblings and explicitly merges all heads', () => {
    const { storage, store } = setup(); const first = store.save('lineup:own', value, []); if (!first.ok) throw new Error();
    const root = first.value.record; const a = { ...root, id: 'a', parents: [root.id] }; const b = { ...root, id: 'b', parents: [root.id] };
    storage.setItem(PREFIX + 'a', JSON.stringify(a)); storage.setItem(PREFIX + 'b', JSON.stringify(b));
    expect(heads(store.read().records, 'lineup:own').map(r => r.id)).toEqual(['a', 'b']);
    expect(store.save('lineup:own', value, ['a']).ok).toBe(false); expect(store.save('lineup:own', value, ['a', 'b']).ok).toBe(true); expect(store.read().records).toHaveLength(4);
  });
  it.each(['{', 'null', '{"schema":99}', 'x'.repeat(32_769)])('quarantines invalid records %# without deletion', raw => {
    const { storage, store } = setup(); storage.setItem(PREFIX + 'broken', raw); store.save('lineup:own', value, []);
    expect(store.read().quarantined).toBe(1); expect(store.read().records).toHaveLength(1); expect(storage.getItem(PREFIX + 'broken')).toBe(raw);
  });
  it('uses session-only memory when storage is denied or quota is full', () => {
    const denied = new GameStore(null, () => 'id', () => NOW); const r = denied.save('lineup:own', value, []);
    expect(r.ok && r.value.persisted).toBe(false); expect(denied.read().records).toHaveLength(1);
    const storage = memoryStorage(); storage.setItem = () => { throw new DOMException('Quota', 'QuotaExceededError'); };
    const quota = new GameStore(storage, () => 'id', () => NOW); expect(quota.save('lineup:own', value, []).ok).toBe(true); expect(quota.read().memoryOnly).toBe(true);
  });
  it('does not evict at the 500-record limit', () => {
    const { storage, store } = setup(); for (let i = 0; i < 500; i++) storage.setItem(PREFIX + `bad${i}`, '{}');
    const r = store.save('lineup:own', value, []); expect(r.ok && r.value.persisted).toBe(false); expect(storage.length).toBe(500);
  });
  it('clears only owned gameplay keys, preserving test flag and unrelated keys', () => {
    const { storage, store } = setup(); storage.setItem(TEST_KEY, '1'); storage.setItem('other:app', 'keep'); store.save('lineup:own', value, []);
    expect(store.clear()).toEqual({ ok: true, value: 1 }); expect(storage.getItem(TEST_KEY)).toBe('1'); expect(storage.getItem('other:app')).toBe('keep');
  });
  it('reports partial deletion, including newly concurrent records', () => {
    const { storage, store } = setup(); store.save('lineup:own', value, []); const remove = storage.removeItem;
    storage.removeItem = key => { remove(key); storage.setItem(PREFIX + 'concurrent', '{}'); };
    const result = store.clear(); expect(result.ok).toBe(false); if (!result.ok) expect(result.error.code).toBe('STORAGE_CLEAR_INCOMPLETE');
  });
  it('reports unverifiable removal rather than all-deleted', () => {
    const { storage, store } = setup(); store.save('lineup:own', value, []); storage.removeItem = () => { throw new Error(); };
    expect(store.clear().ok).toBe(false);
  });
  it('does not hide malformed cycles as an empty entity', () => {
    const root = { schema: 1, id: 'a', entity: 'lineup:own', parents: ['b'], createdAt: new Date(NOW).toISOString(), value } as SaveRecord;
    expect(heads([root, { ...root, id: 'b', parents: ['a'] }], root.entity)).toHaveLength(2);
  });
});
describe('T16/T17/T20 bounded sharing', () => {
  const c = valid(); const p: PreparedTeam = { url: '', text: '', file: null, blobUrl: null, expiresAt: NOW + 60_000, revision: c.revision, rightsRevision: c.rightsRevision, selection: TEAM.join(','), pngError: null };
  it('expires exactly at 60 seconds and after selection, rights, content, offline changes', () => {
    expect(preparedValid(p, c, p.selection, NOW + 59_999, true)).toBe(true);
    expect(preparedValid(p, c, p.selection, NOW + 60_000, true)).toBe(false);
    expect(preparedValid(p, c, 'different', NOW, true)).toBe(false);
    expect(preparedValid(p, { ...c, rightsRevision: c.rightsRevision + 1 }, p.selection, NOW, true)).toBe(false);
    expect(preparedValid(p, c, p.selection, NOW, false)).toBe(false);
  });
  it('preserves complete names at word boundaries or rejects overflow', () => {
    const ctx = { measureText: (text: string) => ({ width: text.length * 10 } as TextMetrics) };
    expect(wrapName(ctx, 'Çiğdem Örnek', 70)).toEqual(['Çiğdem', 'Örnek']);
    expect(wrapName(ctx, 'abcdefghijk', 50)).toBeNull(); expect(wrapName(ctx, 'aaa bbb ccc ddd', 30)).toBeNull();
  });
  it('text fallback contains all seven full names and roles', () => {
    const players = TEAM.map(id => c.roster!.players.find(p => p.id === id)!); const text = lineupText(players);
    for (const p of players) expect(text).toContain(p.name); expect(text).toContain('Libero');
  });
});
describe('T01 prototype privacy', () => {
  it('has no enabled SDK or transport path', () => { expect(ANALYTICS_ENABLED).toBe(false); expect(track('anything', { private: 'not sent' })).toBeUndefined(); });
});
