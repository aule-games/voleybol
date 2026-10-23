import catalogue from './team-affiliations.json' with { type: 'json' };
import { CLUBS, COUNTRIES } from './identities.ts';

export interface TeamIdentity { name: string; mark?: string; kind?: string; dark?: boolean }
export interface Affiliation {
  teamId?: string;
  sourceUrl: string;
  season: string;
  status?: string;
  note?: string;
  label?: string;
}
export interface CoachAppointment extends Affiliation { role?: string }
export interface CoachIdentity {
  countryCode: string;
  originLabel: string;
  originSourceUrl: string;
  club: CoachAppointment;
  nationalTeam: CoachAppointment;
}

/** Reviewed presentation data, separate from the immutable roster/cost version. */
export const AFFILIATIONS_CHECKED_AT = catalogue.checkedAt;
export const TEAM_IDENTITIES: Readonly<Record<string, TeamIdentity>> = { ...CLUBS, ...catalogue.teams };
export const PLAYER_AFFILIATIONS: Readonly<Record<string, Affiliation>> = catalogue.players;
export const COACH_IDENTITIES: Readonly<Record<string, CoachIdentity>> = catalogue.coaches;
// Origin is not the national team a coach works for. Keep Argentina out of player filters.
export const COACH_COUNTRIES: Readonly<Record<string, TeamIdentity>> = {
  ...COUNTRIES, AR: { name: 'Arjantin', mark: 'marks/countries/ar.svg' },
};
