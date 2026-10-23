# Volleyball fan prototype

Three small Turkish-language games: fictional set-score predictions, a **65-point team of seven players and one coach** chosen from **100 real players / 10 coaches**, and **10-question rounds from 100 sourced questions**. A bounded test preview, not a production release. Club crests and represented-country flags appear in the builder. No accounts, prizes, analytics SDK or external fonts are included. The working title is provisional.

See [international content and budget rules](docs/international-content.md) and [historical local content and provenance](docs/local-content.md) for sources, current clubs, asset-use limits and compatibility rules. See [deployment](docs/deployment.md) for the GitHub Pages test workflow. This is not a rights-clearance or endorsement claim.

## Run locally

Use **Node 26.8.1** (`.nvmrc`) and **npm 11.19.0**. No keys or account setup are needed.

```sh
npm ci
npm run dev
```

Open [the team builder](http://127.0.0.1:5173/#/takim) or [the quiz](http://127.0.0.1:5173/#/quiz). Choose seven players and a coach within 65 points, save, then reload to test persistence. Saving creates a unique, read-only team link. Localhost links are not usable from another device. The quiz draws ten questions across five categories, with explanations and primary-source links after each answer.

The test preview is explicitly dated and expires **2026-10-29 19:34 UTC**. Fetching/building never renews it. `demo:refresh` is for fictional data only and deliberately refuses to overwrite this real-content preview. Recheck the facts before authoring a new content/policy revision. Predictions keep their original fictional dates and can be closed or stale.

## Verify

```sh
npm run verify                 # types, content, unit tests, build
npx playwright install chromium webkit  # one-time browser downloads
npm run test:e2e              # built-output Chromium + WebKit checks
npm run measure:performance   # sequential local cold/warm measurements, about 8 minutes; records open/locked prediction state
npm run preview              # local build preview, normally port 4173
```

Commands fail nonzero on failed checks. Tests inject clocks and content at test boundaries, not through production query flags. The browser suite combines isolated legacy fictional/schema-3 fixtures with actual built schema-4 content and local assets. It is not proof of physical iPhone/Android behavior or public-use permission.

Run browser commands one at a time. Performance uses unchanged current content and writes raw timings, build hashes and a report under `.gstack/benchmark-reports/`. Chromium uses the specified mobile CPU/network throttle; WebKit is an unthrottled comparison, not equivalent device proof. See the [measurement protocol](docs/development.md#built-output-performance-measurements).

## Scope of this test iteration

The source includes the [approved 65-point revision](docs/budget-65-2026-10-23.md). A source commit alone is not evidence that the public Pages site has been updated; check the successful main deployment. Costs are initial original editorial game values, not copied or verified VNL prices. No backend, vote collection or personalized social-preview image is included.

- **Prediction:** six allowed scores, fresh same-origin validation on save, exact lock guards, schedule revisions, device history, session fallback and cross-tab conflict notices. Not tamper-proof competition.
- **Team:** one budget mode; seven distinct role-valid players (1/1/2/2/1) and a mandatory coach. Costs refund on replacement; selections reserve enough budget to fill remaining slots. Country/search filters, explicit import replacement, unique versioned links, a 1080×1350 PNG and text fallback. Six court positions plus a separate libero and coach, not a legal rotation.
- **Quiz:** 100 original questions, 20 each for league, VNL, Olympics, Europe and world championships. Each round draws two per category, prioritizing not-yet-answered questions. Selection is persisted before the first answer. Stable IDs, explicit confirmation, read-only Back and correction/freeze behavior remain. Feedback uses text/icons, strong colors and reduced-motion-aware animation.
- **Privacy:** analytics is unconditionally disabled; no vendor code or request path exists. Browser records use the `voleybol:` prefix. Clear-data is selective and requires confirmation.

This is not a release candidate. Historical roster compatibility, full diagnostic coverage, all lifecycle/performance/device checks, full public-use clearance and external review remain incomplete. The Pages workflow verifies the build before publishing from `main`. A private repository and a `noindex` tag do not make a deployed website private.

See [development contracts and recovery](docs/development.md) for content limits, revision rules, error recovery, and remaining verification boundaries.

See [visual direction](docs/visual-design.md) for the warm plum/coral identity, local typography, original court illustration and share-card constraints. The three-game scope and accepted design are unchanged; the real-content preview is documented separately.
