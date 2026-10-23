# Development contracts

## Tooling

Pinned versions: Node 26.8.1, npm 11.19.0, TypeScript 7.0.2, Vite 8.3.4, Vitest 5.0.5, Playwright 1.64.1. `package-lock.json` is authoritative for transitive versions. Vite 8.3.4 was selected to respect the local seven-day package release-age policy; do not bypass that policy with force or legacy-peer-dependency flags.

Setup references: [Vite](https://vite.dev/guide/), [Vitest](https://vitest.dev/guide/), [Playwright](https://playwright.dev/docs/intro). Browser downloads are separate from `npm ci`. There are no install-time application generators, secrets, accounts, or deployment scripts.

## Module boundaries

- `src/domain/`: pure prediction, lineup and quiz rules; stable IDs rather than answer indexes.
- `src/data/`: strict fictional, local-preview and approved-host preview schemas and the single atomic content coordinator.
- `src/platform/`: append-only storage, bounded export renderer and disabled analytics wrapper.
- `src/router.ts`: the only fragment codec; `src/main.ts` and `src/ui/` render native DOM with `textContent`.
- `tests/`: unit boundaries plus built-output browser flows. No tests import the private planning material.

The UI is intentionally a first slice, not a general game engine. It has no framework, backend, service worker or offline submission queue.

## International amendment — 2026-10-23

The current local build uses schema 4: exactly 100 players, 10 coaches, budget 65, and 100 sourced questions with `roundSize: 10`. Schema 4 keeps the schema-3 host/policy guards. It supersedes the earlier 35-player / four-pack programme described in historical notes. See [the complete contract](international-content.md) and [the versioned 65-point amendment](budget-65-2026-10-23.md).

## Content envelope

`public/content.json` is the only fetched content asset. Schema 1 remains fictional-only. Schema 2 is the explicitly classified real-roster/factual-quiz/fictional-fixtures local preview; it is rejected unless the coordinator is on an exact loopback host. Schema 3 is the separate approved-host test preview; it requires `previewOnly: true` and an explicit caller opt-in, limited to loopback or the exact GitHub Pages content URL. See [the current contract](local-content.md) and [deployment workflow](deployment.md). Unknown common fields and schema versions fail closed. Public-ready files must never include private reviewer identities, correspondence, permission documents or private paths.

The envelope has `schema`, `demo`, `revision`, `rightsRevision`, `publishedAt`, `validUntil`, `rights`, `fixtures`, `roster`, and `quiz`; schema 2 also requires `localOnly` and `modes`, while schemas 3 and 4 require `previewOnly` and `modes`. UTC timestamps use full ISO form, such as `2026-10-22T12:00:00.000Z`. Visible dates are formatted in `Europe/Istanbul`, explicitly labelled TSİ.

One request reads at most **256 KiB** with a **5000 ms** total deadline, `cache: no-store`, `credentials: omit`, and `redirect: error`. No retries occur automatically. Both the header and body are checked. Stale or obsolete generations cannot become current. A common validation failure closes the envelope; malformed mode data closes only that mode in the same snapshot. No old/new modes are combined.

Legacy schema 1–3 bounds: 21 non-final fixtures, 42 finals, 35 players, one five-question fictional pack or ten-question sourced preview pack (four choices per question). The accepted later programme permits four packs / 20 questions and at most two explicitly cleared historical roster versions; neither is implemented yet. Limits are engineering bounds, not rights clearance.

### Revision rules

1. Content revision and independent rights revision must never decrease within a running app. Equal revisions must have identical content/policy. A newly observed higher rights revision remains a high-water mark even if its companion content is rejected as a rollback.
2. Change fixture time only with a higher `scheduleRevision`. Reopening a previously closed fixture requires the higher revision and explicit `reopened: true`. Changes during a save remain unsaved until another user confirmation.
3. Correct an already-final result with a higher `resultRevision`. Saved choices are immutable; feedback is derived again.
4. Change quiz content/key/order with a higher pack revision; bump affected question revisions too. An active attempt freezes on observed updates. Completed mappable answers are rescored by stable choice IDs; unavailable questions/choices become unscored.
5. Remove withdrawn identities from newly distributed content; put their IDs into `rights.withdrawnIds` and increase policy/content revisions. The validator refuses active rows with withdrawn IDs. Never package an unsafe historical snapshot in JavaScript.

The current running-app checks are not a full editorial diff validator across deployments/reloads. Cross-deployment editorial tooling remains required before public real-data release. Static files and previously downloaded/shared PNGs cannot be recalled. Production release requires proven hosting/cache withdrawal controls and a source-specific distribution basis. The owner-authorized bounded public test is an exception to those release prerequisites, not proof of editorial/withdrawal coverage, a licence grant, or production certification.

### Author a fresh local example

`npm run demo:refresh` is an explicit local authoring tool, not a browser bypass. It creates two upcoming fictional matches, one postponed match, one final, fourteen placeholder players and five original questions about the demo's rules. It never runs during `dev`, `verify`, `build` or a fetch. New authoring changes freshness stamps; refreshing a browser request never does. Fixtures become stale after 24 hours; the first two lock earlier at their own start times.

The real-content previews use separate explicit schemas and authoring operation. `demo:refresh` refuses to overwrite it. Source-specific public distribution clearance remains open; manual entry and attribution are not blanket permission.

## Prediction transaction

Entry, explicit save, explicit refresh, visibility restoration and BFCache restoration validate the same-origin snapshot. Submit is single-flight. Immediately before synchronous storage, the app rechecks selection generation, fixture existence, content/schedule revision, state, rights, freshness, connectivity and `now < locksAt`. There is no await between those final guards and the write. A failed save retains the chosen score with an unsaved label.

The client clock and browser storage are editable. There is no account, secure timestamp, ranking, prize or anti-cheat claim. Reconnecting does not submit. Hidden-page and `pagehide` transactions are invalidated. Final guards also compare the current fragment, because a URL change can precede delivery of `hashchange`. History explicitly labels picks from an older schedule; result corrections recompute feedback without rewriting stored picks.

## Local records and deletion

Keys use `voleybol:v1:record:<unique-id>`. Each immutable record includes schema, ID, entity, parent IDs, timestamp and validated value. Different entities use different keys. Concurrent siblings remain visible; explicit confirmation merges the selected branch's parents rather than overwriting records. Unsaved in-tab drafts never get replaced by storage events.

Corrupt/unknown records are quarantined **in place** and counted, not deleted or applied. At 500 owned records, new writes switch to memory and show cleanup guidance; there is no eviction. Loading beyond the bound is limited to the first 500 records and is not a complete-history claim. Memory fallback is itself bounded at 500 records.

Clear-data requires confirmation, enumerates only owned v1 gameplay keys, removes and verifies each, then checks for leftovers/concurrent entries. Partial/unverifiable deletion never claims all-deleted. The separate `voleybol:test` flag and unrelated origin keys survive. No code calls `localStorage.clear()`. There is no v2 migration.

## Fragment contract

Routes: `#/`, `#/tahmin`, `#/takim`, `#/quiz`.

```text
#/takim?v=1&r=demo-v1&p=p1%2Cp3%2Cp5%2Cp6%2Cp9%2Cp10%2Cp13
```

The canonical order is `v`, `r`, `p`; slots are setter, opposite, outside 1, outside 2, middle 1, middle 2, libero. Encoded fragments are limited to 2048 characters. Raw percent escapes/UTF-8 are validated before a single parse. Unknown/duplicate keys, unsupported versions and malformed IDs are rejected. The domain validator then enforces the current roster, seven distinct players, role order and rights. Raw fragments never become HTML, log data, file paths or fetch targets.

Shared links are read-only. Copying one into the current draft requires explicit replacement confirmation. Exports use the application origin/base and canonical fragment without inherited query parameters. `base: './'` supports static subdirectory placement. Browser tests serve the built output at `/games/demo/` on a separate loopback-only static host, with no root assets or SPA fallback; all three games, imported-link reload and query-free export are checked there. This is local nested-host evidence, not approval or verification of a production host. The localhost share link is not a published remote site.

## Sharing

Preparation fetches a fresh policy and captures selection/content/rights as one immutable generation. The file expires after 60 seconds or sooner on policy expiry, selection/content/rights changes, navigation, hide or offline. Old object URLs are revoked. For schema 1, the final share button directly calls native share with the prepared File during user activation, without awaited work first. Cancellation is neutral; neither promise resolution nor download/copy means a post was published. No automatic retries or outbound posts occur.

Schemas 2, 3 and 4 disable native external sharing and omit club marks from PNGs; text and image copy identify real names and test-preview status. Name-only PNG download and link copy remain available.

PNG dimensions: 1080×1350, 64 px safe boundary, name font at least 40 px, word wrapping at most three lines. Overflow disables PNG rather than truncating a name; text/link remain available. Canvas is released after rendering and one active Blob URL is retained. Real iOS/Android native share behavior is not certified by browser mocks.

Renderer exceptions and null encoder output leave a text/link fallback with an accurate image-failure notice, distinct from name overflow. Capability-check exceptions also retain download/text controls. Clipboard absence, denial or synchronous failure displays a visible recovery message and focuses/selects the current text field. Late clipboard callbacks cannot replace a newer preview's status. Browser error injection tests these boundaries without adding production test switches.

Encoding waits at most **5000 ms** after drawing. If the encoder never calls back, the canvas is cleared and the current full text/link remains available; retry is explicit. Selection, navigation, hide, pagehide and offline invalidation abort the application's render wait immediately. Late native callbacks cannot allocate a File/object URL, or change a newer preparation's busy state. The browser's internal encoder is not physically cancelled; buffer release and callback disposal are application-level guarantees, not a measured GPU-memory claim. Background timer scheduling is browser-controlled.

Compound Turkish/accented names are checked in the full-size PNG, text and canonical imported link. A single overwide token, more than three lines, or an overwide one-line libero label intentionally disables PNG instead of reducing names below the font floor or clipping them. Mobile read-only lists, editable slots and picker choices wrap long unbroken names.

## Built-output performance measurements

Run `npm run measure:performance -- .gstack/benchmark-reports/local-run` with no other browser tests running. The script builds first, owns a loopback-only Vite preview on port 4176 and closes it on completion. It measures the unchanged current content, not mocked network data or renewed dates. Expired content still fails the run rather than recording an error screen as a fast playable game.

**Measurement correction, 2026-10-23:** the previous script required an open prediction on both home and prediction routes. Once the original fictional fixtures locked, that assumption caused a timeout despite correctly rendered controls. Home now measures the team link and verifies navigation. Predictions measure rendered score fields plus the history control: an open fixture must accept a score; an all-locked state must contain disabled score fields and explicit warnings, then successfully open history. Each sample records the actual interaction. Locked-state timing does not establish playable-prediction latency and is not directly comparable to the former open-fixture marker. No fixture or policy dates are renewed.

The first corrected run also exposed the script's obsolete assumption that every quiz reload shows the welcome screen. Schema 4 correctly resumes its automatically saved attempt. The measurement now accepts either the start control or an enabled answer in the restored quiz and checks the corresponding real interaction. Warm samples preserve browser storage, so their summary can combine initial-start and resumed-attempt states; raw samples and summary interaction labels distinguish them. No storage or clock reset is used to hide the persistence behavior.

Each of home, predictions, builder and quiz gets five fresh-context cold loads and five warm-context reloads. Chromium uses a 360×800 viewport, 4× CPU slowdown, 1.6 Mbps download/upload and 150 ms latency. Record usable-control median/worst, FCP/LCP/navigation/resource timing, five-second pre-interaction CLS, one initial content request, local-only requests and a successful real interaction. Initial JS gzip must stay at or below 100 KiB, every Chromium usable sample at or below 2500 ms, and CLS at or below 0.1. Reports preserve raw samples, engine/machine and build/script/content hashes. Never infer p95 from five samples.

Warm means a primed context and normal reload with unchanged server headers: revalidated responses are not claimed as memory-cache hits. WebKit repeats the loads unthrottled for comparison; unavailable metrics remain null, not zero. It does not prove the equivalent throttled WebKit/device gate. Loopback preview does not establish production latency, compression or CDN/cache behavior. Keep performance runs sequential and isolated from CPU-heavy tests.

## Analytics and privacy

`track()` is currently a no-op. There is no SDK, dynamic import, queue, transport or enable flag. Zero vendor requests are required in every local build, with or without `?test=1`, stored flags or storage denial. Future analytics integration must independently meet the fixed provider configuration, exclusion race checks, approved attribution key/value registry, outbound defaults/transport sanitization and privacy approval before any code is enabled. This checkpoint does not implement or verify that future SDK integration.

## Recovery codes

Diagnostics are local stable codes with operation, docs anchor, side-effect status and retry category. Raw exceptions, arbitrary values and URLs are not printed or sent. Full nested-cause/sanitized-stack diagnostics are still incomplete.

### content-unavailable
One bounded fetch failed, returned the wrong content type/status, or did not finish. Check the local server and explicitly refresh. A save is not queued.
### content-stale
Content/policy expired or the editorial check is older than 24 hours. For fictional local content, run `npm run demo:refresh` and reload. Real content would require a new authorized editorial check, never a timestamp-only bypass.
### content-invalid
Unknown schema, changed same revision, malformed data or mode contract failure. Run `npm run content:check`, inspect the exact local JSON, correct it and increment the appropriate revision.
### content-superseded
The page, selection or request generation changed. Inspect the current state and explicitly try again.
### content-rollback
An older content/policy revision was returned. Do not force it through. Serve a current-policy-safe snapshot.
### prediction-locked
The lock time has arrived. Existing picks are read-only.
### prediction-changed
Selection/content/schedule changed during validation. Inspect the new schedule and confirm again.
### prediction-unavailable
Missing time, postponement, cancellation, conflict or non-reopened schedule. Choose another game.
### offline
No new/edited picks or fresh exports. Reconnect, validate and explicitly submit; never replay automatically.
### lineup-invalid
Restore the current roster and seven unique role-valid IDs. No automatic substitution occurs.
### link-invalid
The fragment is malformed, unknown or no longer valid. Use the recovery link rather than editing a raw network path.
### quiz-updated
An active pack changed. Preserve the old attempt and explicitly start a new one.
### quiz-invalid
The old result cannot safely map to the current pack. It is unscored, not a retained result with an incorrect denominator.
### storage-conflict
Another version exists. Keep both histories and explicitly reconfirm the desired in-tab choice.
### storage-memory
Storage is denied, full or bounded. Play is session-only; reload can lose it.
### storage-clear-incomplete
Deletion was partial or could not be verified. Do not claim all-deleted or automatically retry.
### share-expired
Prepare the preview again before a new explicit share click.
### share-overflow
Use full text/link instead of a clipped PNG. Fix renderer/content fit before trying PNG again.
### share-failed
An unknown outcome is not success. Inspect the destination before retrying. Clipboard denial keeps selectable text available.

## Verification boundaries

Unit and browser cases cover a bounded subset of the full programme, not all planned contract families. Added hardening checks cover injected hide/pagehide/pageshow events, exact lock and 24-hour editorial freshness guards, Lisbon DST with TSİ display, corrected results, delayed renders, Blob URL cleanup, sharing errors and nested static placement. DOM lifecycle events are not proof of real OS suspension or actual BFCache admission. Automated 200% CSS magnification checks control reachability and overflow; native browser zoom and screen-reader use still require manual verification.

Remaining proof includes actual device sharing, screen-reader/native-zoom audit, broader real-roster combinations beyond the checked current pool, supported historical roster compatibility, all lifecycle/concurrency/error permutations, fresh-clone onboarding, comparable throttled WebKit and real-device performance, actual host/cache withdrawal, content rights/editorial rehearsal, and external review. Current synthetic name/encoder tests and local performance measurements are bounded evidence, not completion of those gates. Browser test servers bind only to loopback ports 4173 and 4175 and stop when the suite ends. Run only one Playwright invocation at a time: a second invocation can remove the first run's trace artifacts even when it subsequently refuses an occupied port. The GitHub Pages CI/deployment configuration is included; see [deployment](deployment.md) for publication rules and live-verification requirements.
