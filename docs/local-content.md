# Local real-content preview

Dated 2026-10-22. This is a private, loopback-only test slice, not a public release or licensing clearance.

## What is included

- Fourteen manually selected real players, with 2026–27 club affiliation and represented-country flags. This is a builder pool, not an official national-team or club squad. All fourteen represent Türkiye; flags are not birth countries or a complete citizenship record.
- Five club marks and one Turkish flag, served locally without hotlinking or background third-party requests. Full club/country text accompanies the images and survives image failure. The compact court repeats the same marks decoratively.
- Ten original Turkish questions about the last three completed Sultanlar seasons: three for 2023–24, three for 2024–25, four for 2025–26. Four distinct choices, one correct answer, original explanation, season, primary-source URL and check timestamp per question.
- Predictions still use the unchanged fictional fixtures. Their original dates were not renewed. The current local review window ends at the explicit `validUntil` in `public/content.json`; that timestamp is an operational preview expiry, **not a licence grant or licence expiration**.

## Evidence and limits

The per-player league links are in `public/content.json`; immutable Wikidata references, exact downloaded asset URLs/hashes and national representation references are in `content-provenance.json`. Check date: 2026-10-22. In particular, Derya Cebecioğlu is at Türk Hava Yolları and Saliha Şahin at Fenerbahçe Medicana in 2026–27. Older Eczacıbaşı player pages can remain online after a transfer; their footer year does not prove current affiliation.

Eleven selected position fields matched the reviewed Wikidata structured records. Melissa Vargas had a conflicting position; Alexia Carutasu and Ebrar Karakurt lacked the inspected position statement. Their displayed roles are narrow manually checked official sporting facts, **not represented as CC0-derived**. Alexia's display spelling follows her club profile. No player photos, biographies, statistics, full-league database or automated feed is included. Facts are manually compiled; source prose is not copied into questions/explanations.

Club marks were obtained from the listed club websites, including the Fenerbahçe crest displayed by Eczacıbaşı on its match listing. The THY asset is the club's own 48 px icon. They remain third-party marks; no affirmative open-use grant or endorsement is claimed. Their inclusion is restricted to this requested private local preview. Before publication, resolve the intended use and distribution basis or remove the assets. The Turkish flag file is unmodified `flag-icons` artwork under MIT; its licence notice is adjacent to the file. This file licence does not remove any separate restrictions on use of a national flag.

Quiz sources are TVF's season-specific award reports and 2024–25 final-series report, plus VakıfBank's 2025–26 title review. Each question links directly to its evidence after the answer is confirmed and on the results screen. Historical sponsor names refer to the season asked, not current clubs. Scope is league/final awards, not national-team, European or cup titles.

Source conflict handling: the 2023–24 TVF article has a later migration/publication stamp. The 2025–26 TVF award page date and final preview chronology disagree; the club recap's series score also differs from TVF. No quiz question relies on those disputed dates or the 2025–26 series score. The 2024–25 **series** was 3–0; the clinching **match** was 3–1. These are intentionally distinguished.

## Runtime contract

Schema 1 remains the strictly fictional five-question format. Regression fixtures live in `tests/data/demo-content.json`, independent of the live preview. Schema 2 requires `demo: false`, `localOnly: true` and exact `modes: { fixtures: 'fictional', roster: 'real', quiz: 'factual' }`. It requires exactly ten sourced questions, reviewed club/country IDs and allowlisted HTTPS provenance URLs. The validator rejects schema 2 by default. The content coordinator opts in only for `localhost`, `127.0.0.1` or `[::1]` over HTTP(S). There is no query-string override.

This loopback guard is a misuse barrier, **not authentication or asset access control**. Do not deploy `dist` or `public`: a static host could still serve their files even while the app refuses to render them. `noindex` does not make a deployed site private.

Real athletes have new `real-wd-*` IDs and roster version `real-20261022-v1`. Old fictional IDs/links are not remapped, and local records are not deleted. Incompatible old quiz attempts offer explicit restart. Storage accepts exactly five or ten questions, scores only at completion, and checks ordered references/answers. The UI and result denominator use the actual pack size.

PNG/text exports identify the real-name local preview truthfully. Club marks are **not exported into PNGs**. Native external share is disabled for this preview; download/copy remain local user actions. No posting, hosting, outreach or analytics was enabled. Source, legal/editorial, device/AT, historical compatibility and external review gates remain separate from this local test.

## Test locally

1. Run `npm run dev` and open `http://127.0.0.1:5173/#/takim`.
2. Select seven players, confirm, and reload; names, crests and flags remain.
3. Open `#/quiz`, answer all ten questions, and inspect a source link after confirmation.

Use `npm run verify` and `npm run test:e2e` for automated checks. Run browser suites sequentially. `demo:refresh` deliberately refuses this real preview instead of overwriting it. After preview expiry, recheck facts, then explicitly author a new dated content/policy revision; never merely move the timestamps forward.
