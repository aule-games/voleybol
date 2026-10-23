import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import raw from '../public/content.json' with { type: 'json' };
import catalogue from '../src/data/team-affiliations.json' with { type: 'json' };
import { COACH_COUNTRIES, COACH_IDENTITIES, PLAYER_AFFILIATIONS, TEAM_IDENTITIES } from '../src/data/affiliations.ts';
import { COUNTRIES } from '../src/data/identities.ts';

describe('dated presentation-only team identities', () => {
  it('maps only known players and all ten coaches to reviewed local teams', () => {
    expect(catalogue.checkedAt).toBe('2026-10-23');
    for (const [id, affiliation] of Object.entries(PLAYER_AFFILIATIONS)) {
      expect(raw.roster.players.some(p => p.id === id)).toBe(true);
      if (affiliation.teamId) { expect(TEAM_IDENTITIES[affiliation.teamId]).toBeTruthy(); expect(TEAM_IDENTITIES[affiliation.teamId]?.mark).toBeTruthy(); }
      else expect(['retired', 'contract-ended']).toContain(affiliation.status);
      expect(new URL(affiliation.sourceUrl).protocol).toBe('https:');
      expect(affiliation.season).toBeTruthy();
    }
    expect(Object.keys(COACH_IDENTITIES).sort()).toEqual(raw.roster.coaches.map(c => c.id).sort());
    for (const identity of Object.values(COACH_IDENTITIES)) {
      expect(COACH_COUNTRIES[identity.countryCode]).toBeTruthy();
      expect(identity.originLabel).toBeTruthy();
      expect(new URL(identity.originSourceUrl).protocol).toBe('https:');
      for (const [kind, a] of [['club', identity.club], ['national', identity.nationalTeam]] as const) {
        expect(new URL(a.sourceUrl).protocol).toBe('https:');
        if (a.teamId) {
          expect(TEAM_IDENTITIES[a.teamId]).toBeTruthy();
          expect(TEAM_IDENTITIES[a.teamId]?.kind ?? 'club').toBe(kind);
          expect(a.role).toBeTruthy();
        } else { expect(a.status).toBe('not-verified'); expect(a.note).toContain('doğrulanmadı'); }
      }
    }
  });
  it('keeps origin, represented country, and employer separate', () => {
    expect(COACH_IDENTITIES['coach-santarelli']).toMatchObject({ countryCode: 'IT', club: { teamId: 'conegliano' }, nationalTeam: { teamId: 'national-tr' } });
    expect(COACH_IDENTITIES['coach-akbas']).toMatchObject({ countryCode: 'TR', nationalTeam: { teamId: 'national-jp' }, club: { status: 'not-verified' } });
    expect(COACH_IDENTITIES['coach-velasco']).toMatchObject({ countryCode: 'AR', originLabel: 'Arjantin doğumlu', nationalTeam: { teamId: 'national-it' } });
    expect(COACH_IDENTITIES['coach-lavarini']).toMatchObject({ countryCode: 'IT', club: { teamId: 'fenerbahce' }, nationalTeam: { teamId: 'national-pl' } });
    expect(Object.keys(COUNTRIES)).toHaveLength(8);
    expect(PLAYER_AFFILIATIONS['real-jp-ishikawa']?.teamId).toBe('eczacibasi');
    expect(PLAYER_AFFILIATIONS['real-br-julia-bergmann']?.teamId).toBe('scandicci');
    expect(COACH_IDENTITIES['coach-barbolini']).toMatchObject({ club: { teamId: 'novara' }, nationalTeam: { teamId: 'national-it', role: 'Yardımcı antrenör' } });
    expect(COACH_IDENTITIES['coach-guidetti']?.nationalTeam.teamId).toBe('national-ca');
    expect(COACH_IDENTITIES['coach-guimaraes']?.club.teamId).toBe('la-orbit');
    expect(COACH_IDENTITIES['coach-sullivan']?.club.teamId).toBe('lovb-austin');
  });
  it('does not fabricate missing affiliations; pins the approved budget revision', () => {
    expect(PLAYER_AFFILIATIONS['unknown-player']).toBeUndefined();
    expect(raw.roster.version).toBe('world-20261023-v2');
    expect(createHash('sha256').update(readFileSync('public/content.json')).digest('hex')).toBe('97bddf2ae9dc4272a7fd262e5fe039d2b2ec8654e2e7cbd7468c1b094ca847ef');
    expect(raw.roster.players.filter(p => p.clubId || PLAYER_AFFILIATIONS[p.id])).toHaveLength(100);
    expect(Object.values(PLAYER_AFFILIATIONS).filter(a => a.status === 'last-confirmed')).toHaveLength(6);
    expect(Object.values(catalogue.players).filter(a => 'checkedAt' in a)).toHaveLength(28);
    expect(PLAYER_AFFILIATIONS['real-pl-lukasik']).toMatchObject({ status: 'contract-ended' });
    expect(PLAYER_AFFILIATIONS['real-pl-lukasik']?.teamId).toBeUndefined();
    expect(PLAYER_AFFILIATIONS['real-pl-korneluk']).toMatchObject({ status: 'retired' });
    expect(PLAYER_AFFILIATIONS['real-pl-korneluk']?.teamId).toBeUndefined();
    expect(PLAYER_AFFILIATIONS['real-cn-gong-xiangyu']?.teamId).toBe('kurobe');
    expect(PLAYER_AFFILIATIONS['real-cn-wang-mengjie']?.teamId).toBe('sf-signal');
    expect(PLAYER_AFFILIATIONS['real-cn-yin-xiaolan']?.teamId).toBe('fujian');
    expect(PLAYER_AFFILIATIONS['real-jp-kurogo']?.teamId).toBe('aek');
    expect(PLAYER_AFFILIATIONS['real-jp-osanai']).toMatchObject({ teamId: 'ibk-altos', note: 'Kiralık' });
  });
  it('keeps exact source hashes, safe SVGs and local-only mark paths', () => {
    for (const identity of Object.values(TEAM_IDENTITIES).concat(Object.values(COACH_COUNTRIES))) {
      if (!identity.mark) continue;
      expect(identity.mark).toMatch(/^marks\/(teams|clubs|countries)\/[a-z0-9-]+\.(png|jpg|webp|svg)$/);
      const bytes = readFileSync(`public/${identity.mark}`); expect(bytes.length).toBeGreaterThan(100);
      if (identity.mark.endsWith('.svg')) expect(bytes.toString()).not.toMatch(/<script|<foreignObject|on\w+=|(?:href|src)=["'](?:https?:|data:)/i);
    }
    for (const team of Object.values(catalogue.teams)) {
      if (!('assetSource' in team)) continue;
      expect(createHash('sha256').update(readFileSync(`public/${team.mark}`)).digest('hex')).toBe(team.sha256);
      expect(new URL(team.assetSource).protocol).toBe('https:');
    }
    for (const flag of catalogue.countryMarks) expect(createHash('sha256').update(readFileSync(`public/${flag.path}`)).digest('hex')).toBe(flag.sha256);
  });
});
