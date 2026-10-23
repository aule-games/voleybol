import { SLOT_ROLES, TEAM_BUDGET, TEAM_ID } from './types.ts';
import type { BudgetTeam, Coach, Content, Player, Roster } from './types.ts';
import { validateLineup } from './lineup.ts';
import { fail, ok } from '../platform/result.ts';
import type { Result } from '../platform/result.ts';

/** Minimum-cost completion uses distinct players per role, not an average price. */
export function budgetState(ids: readonly string[], coachId: string, roster: Roster) {
  const chosen = ids.map((id, i) => roster.players.find(p => p.id === id && p.role === SLOT_ROLES[i]));
  const coach = roster.coaches?.find(c => c.id === coachId);
  const spent = chosen.reduce((sum, p) => sum + (p?.cost ?? 0), 0) + (coach?.cost ?? 0);
  const selectedIds = chosen.filter((p): p is Player => !!p).map(p => p.id);
  const valid = ids.length === 7 && new Set(selectedIds).size === selectedIds.length
    && ids.every((id, i) => !id || !!chosen[i]) && (!coachId || !!coach) && roster.budget === TEAM_BUDGET;
  let minimum = spent;
  for (const role of new Set(SLOT_ROLES)) {
    const missing = SLOT_ROLES.filter((r, i) => r === role && !chosen[i]).length;
    const costs = roster.players.filter(p => p.role === role && !selectedIds.includes(p.id))
      .map(p => p.cost ?? Infinity).sort((a, b) => a - b);
    minimum += costs.length < missing ? Infinity : costs.slice(0, missing).reduce((a, b) => a + b, 0);
  }
  if (!coach) minimum += Math.min(...(roster.coaches ?? []).map(c => c.cost));
  return { spent, remaining: (roster.budget ?? 0) - spent, minimum, feasible: valid && minimum <= (roster.budget ?? 0),
    selected: selectedIds.length, coach, complete: valid && selectedIds.length === 7 && !!coach && spent <= (roster.budget ?? 0) };
}

export function validateBudgetTeam(team: BudgetTeam, content: Content, now: number): Result<{ players: Player[]; coach: Coach; spent: number; cap: number }> {
  if (!TEAM_ID.test(team.teamId) || content.schema !== 4 || !content.roster?.budget) return fail('LINEUP_INVALID', 'lineup');
  const players = validateLineup(team.ids, team.roster, content, now);
  const state = budgetState(team.ids, team.coachId, content.roster);
  if (!players.ok || !state.complete || !state.coach || content.rights.withdrawnIds.includes(state.coach.id)) return fail('LINEUP_INVALID', 'lineup');
  return ok({ players: players.value, coach: state.coach, spent: state.spent, cap: content.roster.budget });
}
