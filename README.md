# Volleyball fan prototype

Three small Turkish-language games: fictional set-score predictions, a seven-player dream team chosen from **14 real players**, and **10 sourced Sultanlar Ligi questions**. Private local preview only. Club crests and represented-country flags appear in the builder. No accounts, prizes, analytics SDK or external fonts are included. The working title is provisional.

See [local content and provenance](docs/local-content.md) for sources, current clubs, asset-use limits and compatibility rules. This is not a public release or a rights-clearance claim.

## Run locally

Use **Node 26.8.1** (`.nvmrc`) and **npm 11.19.0**. No keys or account setup are needed.

```sh
npm ci
npm run dev
```

Open [the team builder](http://127.0.0.1:5173/#/takim) or [the quiz](http://127.0.0.1:5173/#/quiz). Choose seven players, confirm, then reload to test persistence. The quiz has ten questions from 2023–24, 2024–25 and 2025–26, with explanations and primary-source links after each answer.

The local preview is explicitly dated and expires **2026-10-29 19:34 UTC**. Fetching/building never renews it. `demo:refresh` is for fictional data only and deliberately refuses to overwrite this real-content preview. Recheck the facts before authoring a new content/policy revision. Predictions keep their original fictional dates and can be closed or stale.

## Verify

```sh
npm run verify                 # types, content, unit tests, build
npx playwright install chromium webkit  # one-time browser downloads
npm run test:e2e              # built-output Chromium + WebKit checks
npm run measure:performance   # sequential local cold/warm measurements, about 8 minutes; needs a playable prediction fixture
npm run preview              # local build preview, normally port 4173
```

Commands fail nonzero on failed checks. Tests inject clocks and content at test boundaries, not through production query flags. The browser suite combines isolated legacy fictional fixtures with actual built real-preview content and local assets. It is not proof of physical iPhone/Android behavior or public-use permission.

Run browser commands one at a time. Performance uses unchanged current content and writes raw timings, build hashes and a report under `.gstack/benchmark-reports/`. Chromium uses the specified mobile CPU/network throttle; WebKit is an unthrottled comparison, not equivalent device proof. See the [measurement protocol](docs/development.md#built-output-performance-measurements).

## Scope of this checkpoint

- **Prediction:** six allowed scores, fresh same-origin validation on save, exact lock guards, schedule revisions, device history, session fallback and cross-tab conflict notices. Not tamper-proof competition.
- **Team:** seven distinct role-valid players (1/1/2/2/1), inline selection, explicit import replacement, strict fragment links, a 1080×1350 PNG, and a text/link fallback. Six court positions plus a separate libero, not a legal rotation.
- **Quiz:** one original ten-question pack about the last three completed Sultanlar seasons; stable question/choice IDs, explicit confirmation, read-only Back, correction/freeze behavior. Each answer has a dated primary source. Legacy five-question records remain readable; this is not a four-pack bank.
- **Privacy:** analytics is unconditionally disabled; no vendor code or request path exists. Browser records use the `voleybol:` prefix. Clear-data is selective and requires confirmation.

This is not a release candidate. Historical roster compatibility, full diagnostic coverage, all lifecycle/performance/device checks, cleared real content, external review, and hosting/privacy/publication decisions remain incomplete. No deployment or CI configuration is provided. A private repository and a `noindex` tag do not make a deployed website private.

See [development contracts and recovery](docs/development.md) for content limits, revision rules, error recovery, and remaining verification boundaries.

See [visual direction](docs/visual-design.md) for the warm plum/coral identity, local typography, original court illustration and share-card constraints. The three-game scope and accepted design are unchanged; the private real-content slice is documented separately.
