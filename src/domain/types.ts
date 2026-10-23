export const SLOT_ROLES = ['setter', 'opposite', 'outside', 'outside', 'middle', 'middle', 'libero'] as const;
export type Role = (typeof SLOT_ROLES)[number];
export const SLOT_LABELS = ['Pasör', 'Pasör çaprazı', 'Smaçör 1', 'Smaçör 2', 'Orta oyuncu 1', 'Orta oyuncu 2', 'Libero'] as const;
export const ROLE_LABELS: Record<Role, string> = { setter: 'Pasör', opposite: 'Pasör çaprazı', outside: 'Smaçör', middle: 'Orta oyuncu', libero: 'Libero' };
export const SCORES = ['3-0', '3-1', '3-2', '0-3', '1-3', '2-3'] as const;
export type Score = (typeof SCORES)[number];
export type MatchState = 'scheduled' | 'postponed' | 'cancelled' | 'conflict' | 'final';
export interface Fixture {
  id: string; home: string; away: string; startsAt: string | null; locksAt: string | null;
  checkedAt: string; state: MatchState; scheduleRevision: number; reopened: boolean;
  resultRevision: number; result: Score | null;
}
export interface Player { id: string; name: string; role: Role; clubId?: string; countryCode?: string; sourceUrl?: string; cost?: number; sourceLabel?: string }
export interface Coach { id: string; name: string; cost: number; reference: string; sourceUrl: string }
export const TEAM_BUDGET = 65 as const;
export interface Roster { version: string; asOf: string; players: Player[]; budget?: typeof TEAM_BUDGET; coaches?: Coach[] }
export interface BudgetTeam { roster: string; ids: string[]; coachId: string; teamId: string }
export const TEAM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const QUIZ_CATEGORIES = ['league', 'vnl', 'olympics', 'europe', 'world'] as const;
export type QuizCategory = typeof QUIZ_CATEGORIES[number];
export interface Choice { id: string; text: string }
export interface QuestionSource { title: string; url: string; checkedAt: string }
export interface Question { id: string; revision: number; text: string; choices: Choice[]; correctId: string; explanation: string; season?: string; source?: QuestionSource; category?: QuizCategory }
export interface QuizPack { id: string; revision: number; questions: Question[]; roundSize?: 10 }
export interface Content {
  schema: 1 | 2 | 3 | 4; demo: boolean; localOnly?: true; previewOnly?: true;
  modes?: { fixtures: 'fictional'; roster: 'real'; quiz: 'factual' };
  revision: number; rightsRevision: number; publishedAt: string; validUntil: string;
  rights: { expiresAt: string; withdrawnIds: string[] };
  fixtures: Fixture[]; roster: Roster | null; quiz: QuizPack | null;
  issues: ('fixtures' | 'roster' | 'quiz')[];
}
export interface Pick { fixtureId: string; score: Score; scheduleRevision: number; contentRevision: number; savedAt: string }
export interface Attempt {
  id: string; packId: string; packRevision: number; practice: boolean;
  questions: { id: string; revision: number }[];
  answers: { questionId: string; choiceId: string }[];
  originalScore: number | null;
}
export const ID = /^[a-z0-9_-]{1,40}$/;
export function isScore(value: unknown): value is Score { return SCORES.some(score => score === value); }
