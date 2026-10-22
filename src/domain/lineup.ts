import { SLOT_ROLES } from './types.ts';
import type { Content, Player } from './types.ts';
import { currentPolicy } from '../data/validate.ts';
import { fail, ok } from '../platform/result.ts';
import type { Result } from '../platform/result.ts';

export function validateLineup(ids: readonly string[], rosterVersion: string, content: Content, now: number): Result<Player[]> {
  if (!currentPolicy(content, now) || !content.roster || content.roster.version !== rosterVersion) return fail('LINEUP_INVALID', 'lineup');
  if (ids.length !== 7 || new Set(ids).size !== 7) return fail('LINEUP_INVALID', 'lineup');
  const players = ids.map(id => content.roster!.players.find(p => p.id === id));
  if (players.some((p, i) => !p || p.role !== SLOT_ROLES[i] || content.rights.withdrawnIds.includes(p.id))) return fail('LINEUP_INVALID', 'lineup');
  return ok(players as Player[]);
}
