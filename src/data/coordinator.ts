import { isLoopback, isPublicPreviewTarget } from './identities.ts';
import type { Content, Fixture } from '../domain/types.ts';
import { freeze, MAX_BYTES, validateContent } from './validate.ts';
import { fail } from '../platform/result.ts';
import type { Result, ErrorCode } from '../platform/result.ts';

export class ContentCoordinator {
  snapshot: Content | null = null;
  trusted = false;
  private generation = 0;
  private controller: AbortController | null = null;
  private contentRevision = 0;
  private rightsRevision = 0;
  private contentSignature = '';
  private rightsSignature = '';
  private quizVersion: { id: string; revision: number; signature: string } | null = null;
  private fixtureVersions = new Map<string, Pick<Fixture, 'startsAt' | 'locksAt' | 'state' | 'scheduleRevision' | 'resultRevision' | 'result'>>();
  constructor(private readonly url: URL, private readonly fetcher: typeof fetch = fetch, private readonly now: () => number = Date.now) {}
  invalidate() { this.generation++; this.controller?.abort(); this.trusted = false; }
  async refresh(): Promise<Result<Content>> {
    this.invalidate();
    const generation = this.generation;
    const controller = new AbortController(); this.controller = controller;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<Result<Content>>(resolve => { timeout = setTimeout(() => { controller.abort(); resolve(fail('CONTENT_UNAVAILABLE', 'content')); }, 5000); });
    const read = async (): Promise<Result<Content>> => {
      try {
        const fetcher = this.fetcher;
        const response = await fetcher(this.url, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal });
        if (response.status !== 200 || response.redirected || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') ?? '') || Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) return fail('CONTENT_UNAVAILABLE', 'content');
        const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > MAX_BYTES || controller.signal.aborted) { void reader.cancel().catch(() => {}); return fail('CONTENT_UNAVAILABLE', 'content'); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        if (controller.signal.aborted) return fail('CONTENT_SUPERSEDED', 'content');
        return validateContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), this.now(), {
          allowLocalPreview: isLoopback(this.url), allowPublicPreview: isPublicPreviewTarget(this.url),
        });
      } catch { return fail('CONTENT_UNAVAILABLE', 'content'); }
    };
    const result = await Promise.race([read(), deadline]); clearTimeout(timeout);
    if (generation !== this.generation || (controller.signal.aborted && result.ok)) return fail('CONTENT_SUPERSEDED', 'content');
    if (!result.ok) {
      if (result.error.code !== 'CONTENT_UNAVAILABLE') this.snapshot = null;
      return result;
    }
    const next = result.value;
    const rightsSignature = JSON.stringify(next.rights);
    const { rights: _rights, rightsRevision: _rightsRevision, ...body } = next;
    const contentSignature = JSON.stringify(body);
    let error: ErrorCode | null = null;
    if (next.revision < this.contentRevision || next.rightsRevision < this.rightsRevision) error = 'CONTENT_ROLLBACK';
    if ((next.revision === this.contentRevision && contentSignature !== this.contentSignature) || (next.rightsRevision === this.rightsRevision && rightsSignature !== this.rightsSignature)) error = 'CONTENT_INVALID';
    // A newer validated rights policy remains a high-water mark even when its
    // accompanying content rolls back. A later old response must not revive it.
    if (next.rightsRevision > this.rightsRevision) { this.rightsRevision = next.rightsRevision; this.rightsSignature = rightsSignature; }
    if (error) { this.snapshot = null; return fail(error, 'content'); }
    this.contentRevision = next.revision; this.rightsRevision = next.rightsRevision;
    this.contentSignature = contentSignature; this.rightsSignature = rightsSignature;
    this.snapshot = this.checkModeRevisions(next); this.trusted = true;
    return { ok: true, value: this.snapshot };
  }
  private checkModeRevisions(next: Content): Content {
    const issues = [...next.issues];
    let quiz = next.quiz; let fixtures = next.fixtures;
    if (quiz) {
      const previous = this.quizVersion; const signature = JSON.stringify(quiz);
      if (previous?.id === quiz.id && (quiz.revision < previous.revision || (quiz.revision === previous.revision && signature !== previous.signature))) { quiz = null; issues.push('quiz'); }
      else this.quizVersion = { id: quiz.id, revision: quiz.revision, signature };
    }
    const invalidFixtures = fixtures.some(match => {
      const previous = this.fixtureVersions.get(match.id); if (!previous) return false;
      const timeChanged = previous.startsAt !== match.startsAt || previous.locksAt !== match.locksAt;
      const reopened = match.state === 'scheduled' && match.locksAt !== null && Date.parse(match.locksAt) > this.now()
        && (previous.state !== 'scheduled' || (previous.locksAt !== null && Date.parse(previous.locksAt) <= this.now()));
      return match.scheduleRevision < previous.scheduleRevision
        || (timeChanged && match.scheduleRevision === previous.scheduleRevision)
        || (reopened && (match.scheduleRevision <= previous.scheduleRevision || !match.reopened))
        || match.resultRevision < previous.resultRevision
        || (previous.result !== null && previous.result !== match.result && match.resultRevision === previous.resultRevision);
    });
    if (invalidFixtures) { fixtures = []; if (!issues.includes('fixtures')) issues.push('fixtures'); }
    else for (const m of fixtures) this.fixtureVersions.set(m.id, { startsAt: m.startsAt, locksAt: m.locksAt, state: m.state, scheduleRevision: m.scheduleRevision, resultRevision: m.resultRevision, result: m.result });
    return freeze({ ...next, fixtures, quiz, issues });
  }
}
