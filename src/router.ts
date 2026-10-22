import { ID } from './domain/types.ts';
import { fail, ok } from './platform/result.ts';
import type { Result } from './platform/result.ts';
export type Mode = 'home' | 'tahmin' | 'takim' | 'quiz';
export type Route = { mode: Mode; team?: { roster: string; ids: string[] } };
const paths: Record<string, Mode> = { '/': 'home', '/tahmin': 'tahmin', '/takim': 'takim', '/quiz': 'quiz' };
export function parseFragment(hash: string): Result<Route> {
  if (hash.length > 2048) return fail('LINK_INVALID', 'route');
  const raw = hash === '' ? '/' : hash.startsWith('#') ? hash.slice(1) : hash;
  try { decodeURIComponent(raw); } catch { return fail('LINK_INVALID', 'route'); }
  const parts = raw.split('?'); const path = parts[0]!;
  if (parts.length > 2 || !Object.hasOwn(paths, path)) return fail('LINK_INVALID', 'route');
  const mode = paths[path]!;
  if (parts.length === 1) return ok({ mode });
  if (mode !== 'takim' || !parts[1]) return fail('LINK_INVALID', 'route');
  const params = new URLSearchParams(parts[1]); const keys = [...params.keys()];
  if (keys.length !== 3 || new Set(keys).size !== 3 || keys.some(k => !['v', 'r', 'p'].includes(k)) || params.get('v') !== '1') return fail('LINK_INVALID', 'route');
  const roster = params.get('r')!; const ids = params.get('p')!.split(',');
  if (!ID.test(roster) || ids.length !== 7 || new Set(ids).size !== 7 || !ids.every(id => ID.test(id))) return fail('LINK_INVALID', 'route');
  return ok({ mode, team: { roster, ids } });
}
export function encodeTeam(roster: string, ids: readonly string[]): Result<string> {
  const hash = `#/takim?${new URLSearchParams({ v: '1', r: roster, p: ids.join(',') }).toString()}`;
  return parseFragment(hash).ok ? ok(hash) : fail('LINK_INVALID', 'route');
}
export function teamUrl(base: URL, roster: string, ids: readonly string[]): Result<string> {
  const hash = encodeTeam(roster, ids); if (!hash.ok) return hash;
  const url = new URL(base); url.search = ''; url.hash = hash.value;
  return ok(url.href);
}
