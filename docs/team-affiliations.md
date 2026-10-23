# Team identities and refresh fix — local checkpoint, 2026-10-23

> **Budget amendment, 2026-10-23:** The approved playtest cap is now **65**, with unchanged individual prices and pool. Content revision 5 / roster `world-20261023-v2` replaces the 50-point version. See [65-point policy and compatibility](budget-65-2026-10-23.md). The checkpoint and hashes below describe the earlier work and are retained, not current publication evidence.

> **Later amendment, 2026-10-23:** [completed research and explicit remaining limits](affiliation-review-2026-10-23.md) supersedes the 72/100 coverage and single-employer description below. All 100 entries have a researched outcome, but six new-season club records and three coaches' club appointments remain unverified. Historical checkpoint text is retained for provenance.

## What changed

The brand SVG had no intrinsic dimensions and the main stylesheet arrived through JavaScript. With scripts/styles blocked, its first paint measured 344 px wide in a 360 px viewport in both Chromium and WebKit. The SVG now has explicit 36 × 36 dimensions, and the stylesheet is linked from the HTML head. The same regression test now passes before any application script or stylesheet runs.

Player and coach cards, selected slots, the court and imported read-only teams now share local identity badges. A player flag describes national representation; the adjacent badge identifies the separately checked club. A coach flag describes origin, not the national team being coached and not an exhaustive citizenship record. Velasco's Argentine origin is corroborated by [Volleyball World's appointment report](https://en.volleyballworld.com/news/julio-velasco-to-head-coach-italy). The coach's adjacent badge describes a club or national-team employer, not every concurrent appointment. For example, Akbaş displays Türkiye plus Japan; Lavarini displays Italy plus Poland. Barbolini displays Novara, not Italy's head-coach role.

## Evidence and remaining content work

Coverage is **72/100 player clubs and 10/10 coach teams**. The original fourteen Turkish club assignments retain their separately checked league evidence. The added 58 player assignments use official league/club/federation sources, the Japanese league broadcaster's dated season guide, and a LOVB-issued roster distributed by Athletes Unlimited. Japanese federation entries are labelled as 2026 roster records; MLV entries explicitly identify 2027 contracts, not an already-started 2027 competition. There is no live transfer feed.

`src/data/team-affiliations.json` is the reviewed catalogue: exact source URL and season per assignment; exact downloaded URL, source page, bytes and SHA-256 per new mark. It is authored data, never filled by name matching at runtime. Some source sites returned access errors or historical squads; a search result's current header alone was not treated as proof of a transfer.

The remaining players show **“Kulüp bilgisi doğrulanmadı”**, not an invented crest, an old club presented as current, or a claim that the player has no club. The pending list below is editorial work still open; adding a renderer does not mean all 100 club assignments are finished.

- **BR:** Macris, Kisy, Tainara, Helena, Diana, Lorena, Laís, Marcelle.
- **JP:** Ai Kurogo, Miwako Osanai.
- **RS:** Rada Perović, Slađana Mirković, Vanja Bukilić, Katarina Dangubić, Branka Tica, Ljubica Milojević.
- **PL:** Magdalena Stysiak, Martyna Łukasik, Olivia Różański, Agnieszka Korneluk.
- **CN:** Zhang Zixuan, Yin Xiaolan, Gong Xiangyu, Yang Shuming, Li Yingying, Wu Mengjie, Wang Aoqian, Wang Mengjie.

## Storage and safety boundaries

Affiliations are display data outside the roster/cost payload. `public/content.json` remains byte-for-byte unchanged by this amendment (SHA-256 `0ca7a89cb21da710a090b1fbd34f380f85e382eb349b650e70409757fde57e0f`). The roster version, prices, roles, saved UUIDs and links do not change. Shared teams display the current reviewed affiliation snapshot, not a historical club snapshot captured when saved. A later cost/pool change still requires the existing version change.

All badge files are served locally. Text remains if images fail. Images have explicit dimensions and `object-fit: contain`; white marks have a dark backing. The builder does not request third-party image URLs. The imported share page uses the same badges without overwriting the receiver's draft. Logos remain excluded from PNG exports; no native image-sharing capability was enabled.

The 35 added club/federation marks remain third-party marks, **not openly licensed artwork**. Source attribution and local owner-requested testing do not establish redistribution rights or endorsement. Japanese and Chinese federation marks are sourced from the association's own social identity and league media archive respectively; these are not official uniform approvals. The Argentine flag is unmodified `flag-icons` v7.5.0 MIT artwork; its hash/source is in `countryMarks`, with the existing adjacent licence notice retained. No athlete photographs or biographies are included.

## Verification and publication

Run `npm run verify`, then `npm run test:e2e -- --workers=4`, sequentially. `tests/affiliations.test.ts` checks identities, source metadata, safe local paths, asset hashes and preservation of the roster payload. `tests/browser/identities.spec.ts` checks all displayed identities at 320 px, image-error labels, coach nationality/employer separation, imported teams, reload and zero external requests. `tests/browser/initial-paint.spec.ts` blocks both scripts and CSS to guard the refresh defect.

QA artifacts are local under `.gstack/qa-reports/identity-20261023/`. This is a local checkpoint, not a production deployment, physical-device certification, accessibility audit or licensing clearance. No commit, push or Pages deploy is included. The existing preview expiry remains **2026-10-29T19:34:18.198Z**.
