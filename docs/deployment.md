# GitHub Pages test deployment

This workflow prepares a public test site, not a production-readiness certification.
The intended address is `https://aule-games.github.io/voleybol/`.
The source repository and its Git history become visible when its visibility is public.
`noindex` is a crawler request, not access control.

## Build and publication

1. Enable GitHub Pages with **GitHub Actions** as the publishing source.
2. Open a pull request to `main`; the workflow runs type, content, unit, build and Chromium/WebKit checks.
3. Merge the reviewed change. Only a successful `main` build can deploy; pull requests never publish.
4. Check the `Verify and deploy test preview` run and the actual website. A successful push alone is not deployment evidence.

The workflow pins official actions to commit hashes, reads Node from `.nvmrc`, installs the lockfile with `npm ci`, and packages **only `dist`**. No user-managed token or third-party account is needed. The deploy job alone receives Pages/OIDC write permissions. Manual workflow dispatch also publishes only from `main`.

### CI runtime amendment — 2026-10-23

The first international PR check passed type/content/unit/build checks but hit the unchanged 20-minute job limit while downloading 119 MB of browser-system packages from the runner's regional Ubuntu mirror. Browser tests never started; this run is not counted as passing. It ran Ubuntu 24.04, so the separate `ubuntu-latest` migration notice was not its cause.

The verification job now uses the [official Playwright container workflow](https://playwright.dev/docs/ci#via-containers), pinned to version **1.64.1-noble** and its verified Microsoft registry digest, matching the locked test package. The image already contains browser binaries and system dependencies; a preflight checks the package version and required executable paths. This avoids the repeated apt-download bottleneck, not the tests: all type/content/unit/build and Chromium/WebKit tests, four workers, zero retries, the 20-minute job limit, and main-only deployment remain unchanged. The container runs as UID 1001; no privileged container or extra Linux capability is granted. The host runner is pinned to Ubuntu 24.04 to avoid an unrelated moving-label change. Image/version upgrades must be deliberate and paired.

The first container runs exposed two test-fixture assumptions: the old synthetic four-line name fit two words per line in the Linux font (281.328 px versus a 281.333 px allowance), and installing a running fake clock then pausing at its original instant could attempt to move backward. The overflow fixture now proves one word fits but two do not at the minimum supported font size. Clock setup starts before the target time, pauses before app navigation, and asserts the exact target; the 4,999 ms / 5,000 ms and expiry boundaries remain unchanged. An intermittent WebKit second-canvas pixel mismatch was not reproduced by the diagnostic run; its original assertion is retained, with additional exact dimension/RGBA checks on the actual downloaded PNG and diagnostic logging if the two disagree. No browser, failure assertion, timeout or zero-retry gate was removed.

The exhaustive 100-player / ten-coach identity test is split into five role cases and a coach case. A local trace showed its previous single 30-second budget expiring after hundreds of successful protocol assertions, before the next image check started. Every player, coach, image, note, width and local-request assertion remains covered with the same per-case timeout; this is not a larger timeout or a reduced sample. The full suite therefore has 204 browser cases rather than 194.

Vite's relative `base: './'` and hash routes preserve the `/voleybol/` project path, including assets, content fetches, refresh and shared-team URLs. Browser tests also exercise nested static hosting without root-asset or SPA fallbacks. A rehosted-byte test covers the exact approved HTTPS origin; live CDN/HTTPS verification is a separate post-deploy check.

## Current local amendment — 2026-10-23

Schema 4 adds a 100-player / 10-coach / 65-point builder and 100-question bank with 10-question rounds. It uses the same approved-host guard and unchanged expiry. These local source changes do not establish a new deployment. The earlier 14-player / ten-question checkpoint below is historical. Publication of the accumulated changes was authorized on 2026-10-23 with the 65-point policy. Use the PR/CI/main procedure above; authorization is not deployment evidence. See [the budget amendment](budget-65-2026-10-23.md).

## Earlier published test boundaries

- Schema 3 explicitly enables a mixed-content preview at the approved Pages content URL; old schema 2 stays loopback-only. Neither host guard protects asset access.
- Fourteen real players, represented-country flags and ten sourced questions coexist with **fictional** prediction fixtures. Original fixture dates are not silently renewed; expired/locked predictions can be unavailable.
- The preview expires **2026-10-29 at 19:34 UTC**. Builds, fetches and workflow reruns do not extend it. Recheck facts before a new authored content/policy revision.
- Browser records stay on each device. No accounts, analytics, cross-device sync, prizes or submissions exist. Native external image share remains disabled; name-only PNG download and link copy are available.
- Club marks are third-party assets, not an open-license or endorsement claim. Public-use clearance, external review, physical-device and assistive-technology checks are not established by passing automated tests.

## Later hosting changes

Cloudflare is a later move, not part of this setup. Add its exact chosen origin deliberately, repeat hosting/asset/link tests, and verify the live deployment before changing the shared URL. Do not widen the allowlist to arbitrary domains.

To pause a test site, disable Pages publishing in repository settings. To repair code, revert the faulty change through a new commit and let the verified `main` workflow redeploy; never rewrite published history. Disabling the website does not make a public source repository private or retract copies already made.
