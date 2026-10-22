import type { Attempt, Pick } from '../domain/types.ts';
import { isScore } from '../domain/types.ts';
import { exact, id, integer, isObject, utc } from '../data/validate.ts';
import { fail, ok } from './result.ts';
import type { Result } from './result.ts';

export const PREFIX = 'voleybol:v1:record:';
export const TEST_KEY = 'voleybol:test';
export type SavedValue = { kind: 'prediction'; data: Pick } | { kind: 'lineup'; data: { roster: string; ids: string[] } } | { kind: 'quiz'; data: Attempt };
export interface SaveRecord { schema: 1; id: string; entity: string; parents: string[]; createdAt: string; value: SavedValue }
export interface StoreView { records: SaveRecord[]; quarantined: number; count: number; memoryOnly: boolean }
const entityValid = (s: unknown): s is string => typeof s === 'string' && /^(prediction:[a-z0-9_-]{1,40}|lineup:own|quiz:[a-z0-9_-]{1,40})$/.test(s);
function validValue(v: unknown): v is SavedValue {
  if (!isObject(v) || !exact(v, ['kind', 'data']) || !isObject(v.data)) return false;
  const d = v.data;
  if (v.kind === 'prediction') return exact(d, ['fixtureId', 'score', 'scheduleRevision', 'contentRevision', 'savedAt']) && id(d.fixtureId) && isScore(d.score) && integer(d.scheduleRevision) && integer(d.contentRevision) && utc(d.savedAt);
  if (v.kind === 'lineup') return exact(d, ['roster', 'ids']) && id(d.roster) && Array.isArray(d.ids) && d.ids.length === 7 && d.ids.every(id) && new Set(d.ids).size === 7;
  if (v.kind !== 'quiz' || !exact(d, ['id', 'packId', 'packRevision', 'practice', 'questions', 'answers', 'originalScore']) || !id(d.id) || !id(d.packId) || !integer(d.packRevision) || typeof d.practice !== 'boolean'
    || !Array.isArray(d.questions) || ![5, 10].includes(d.questions.length) || !Array.isArray(d.answers) || d.answers.length > d.questions.length) return false;
  if (!d.questions.every(q => isObject(q) && exact(q, ['id', 'revision']) && id(q.id) && integer(q.revision)) || new Set(d.questions.map(q => q.id)).size !== d.questions.length) return false;
  return d.answers.every((a, i) => isObject(a) && exact(a, ['questionId', 'choiceId']) && id(a.questionId) && id(a.choiceId) && a.questionId === (d.questions as { id: string }[])[i]?.id)
    && (d.answers.length === d.questions.length ? Number.isInteger(d.originalScore) && Number(d.originalScore) >= 0 && Number(d.originalScore) <= d.questions.length : d.originalScore === null);
}
function validRecord(v: unknown): v is SaveRecord {
  if (!isObject(v) || !exact(v, ['schema', 'id', 'entity', 'parents', 'createdAt', 'value']) || v.schema !== 1 || !id(v.id) || !entityValid(v.entity) || !utc(v.createdAt) || !Array.isArray(v.parents)
    || v.parents.length > 500 || !v.parents.every(id) || new Set(v.parents).size !== v.parents.length || v.parents.includes(v.id) || !validValue(v.value)) return false;
  return v.entity === (v.value.kind === 'prediction' ? `prediction:${v.value.data.fixtureId}` : v.value.kind === 'lineup' ? 'lineup:own' : `quiz:${v.value.data.id}`);
}
export function heads(records: SaveRecord[], entity: string): SaveRecord[] {
  const group = records.filter(r => r.entity === entity); const parents = new Set(group.flatMap(r => r.parents));
  const leaves = group.filter(r => !parents.has(r.id));
  // A malformed cyclic graph is never silently treated as an empty history.
  return leaves.length || !group.length ? leaves : group;
}
export class GameStore {
  private memory: SaveRecord[] = [];
  private denied = false;
  constructor(private readonly storage: Storage | null, private readonly uuid: () => string = () => crypto.randomUUID(), private readonly now = Date.now) {}
  read(): StoreView {
    const records: SaveRecord[] = []; let quarantined = 0; let count = 0;
    try {
      if (!this.storage) throw new Error();
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i); if (!key?.startsWith(PREFIX)) continue;
        count++;
        if (count > 500) continue;
        try {
          const raw = this.storage.getItem(key); if (!raw || raw.length > 32_768) { quarantined++; continue; }
          const parsed: unknown = JSON.parse(raw);
          if (!validRecord(parsed) || key !== PREFIX + parsed.id) { quarantined++; continue; }
          records.push(parsed);
        } catch { quarantined++; }
      }
    } catch { this.denied = true; }
    return { records: [...records, ...this.memory.filter(r => !records.some(p => p.id === r.id))], quarantined, count, memoryOnly: this.denied || count >= 500 };
  }
  save(entity: string, value: SavedValue, parents: string[]): Result<{ record: SaveRecord; persisted: boolean }> {
    const view = this.read();
    const current = heads(view.records, entity).map(r => r.id).sort();
    if (current.join(',') !== [...parents].sort().join(',')) return fail('STORAGE_CONFLICT', 'storage');
    const record: SaveRecord = { schema: 1, id: this.uuid(), entity, parents: [...parents], createdAt: new Date(this.now()).toISOString(), value: structuredClone(value) };
    if (!validRecord(record)) return fail('CONTENT_INVALID', 'storage');
    if (!view.memoryOnly) {
      try {
        const encoded = JSON.stringify(record); const key = PREFIX + record.id;
        if (this.storage!.getItem(key) !== null) return fail('STORAGE_CONFLICT', 'storage');
        this.storage!.setItem(key, encoded);
        if (this.storage!.getItem(key) === encoded) return ok({ record, persisted: true });
      } catch { this.denied = true; }
    }
    if (this.memory.length < 500) this.memory.push(record);
    else return fail('STORAGE_MEMORY', 'storage');
    return ok({ record, persisted: false });
  }
  clear(): Result<number> {
    this.memory = []; let removed = 0;
    try {
      if (!this.storage) return fail('STORAGE_CLEAR_INCOMPLETE', 'storage', 'unknown');
      const keys: string[] = [];
      for (let i = 0; i < this.storage.length; i++) { const key = this.storage.key(i); if (key?.startsWith(PREFIX)) keys.push(key); }
      let failed = false;
      for (const key of keys) {
        try { this.storage.removeItem(key); if (this.storage.getItem(key) === null) removed++; else failed = true; } catch { failed = true; }
      }
      for (let i = 0; i < this.storage.length; i++) if (this.storage.key(i)?.startsWith(PREFIX)) failed = true;
      return failed ? fail('STORAGE_CLEAR_INCOMPLETE', 'storage', removed ? 'partial' : 'unknown') : ok(removed);
    } catch { return fail('STORAGE_CLEAR_INCOMPLETE', 'storage', removed ? 'partial' : 'unknown'); }
  }
}
export function browserStorage(): Storage | null { try { const s = localStorage; s.getItem(TEST_KEY); return s; } catch { return null; } }
