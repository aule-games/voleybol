# International budget game — local development, 2026-10-23

> **Budget amendment, 2026-10-23:** The approved playtest cap is now **65**, with unchanged individual prices and pool. Content revision 5 / roster `world-20261023-v2` replaces the 50-point version. See [65-point policy and compatibility](budget-65-2026-10-23.md). The checkpoint and hashes below describe the earlier work and are retained, not current publication evidence.

> **Later amendment, 2026-10-23:** [completed research and explicit remaining limits](affiliation-review-2026-10-23.md) supersedes the 72/100 coverage and single-employer description below. All 100 entries have a researched outcome, but six new-season club records and three coaches' club appointments remain unverified. Historical checkpoint text is retained for provenance.

**Later 2026-10-23 display amendment:** [team affiliations and first-paint fix](team-affiliations.md) adds separately sourced club/national-team marks for 72 players and all ten coaches. The original roster/cost payload below is unchanged. Its provenance manifest describes initial pool authoring; new display assets and affiliation sources live in `src/data/team-affiliations.json`. Twenty-eight player clubs remain explicitly unverified rather than guessed.

This amendment supersedes the earlier two-mode/four-pack proposals. There is one playable team mode: seven players plus a required coach within **50 fictional points**. There is no unlimited mode, money, prize, live scoring or official performance rating.

## Authored pools and evidence

The pool has exactly **100 players and 10 coaches**. Player representation: Türkiye 14, Brazil 14, Japan 14, Italy 14, Serbia 14, Poland 10, USA 10, China 10. This is a curated international pool, not the world's top 100 or an official current squad.

The existing 14 Turkish identities retain individually checked 2026–27 league references. The added 86 identities use explicitly dated 2025 federation/Volleyball World national-team call-ups or World Championship lists. At initial pool authoring their current clubs were **not inferred** or displayed; the later display amendment above supplies independently checked affiliations. Original coach references are likewise dated; Barbolini's pool reference is a 2025 assistant role, not a claim that he was Italy's head coach. His newer display affiliation is Novara. Japan's Wada/Nonaka playing roles follow the cited English 2025 call-up; other competition registrations can differ.

Each identity/question has a primary-source URL. `docs/international-content-provenance.json` lists the evidence and known limitations. The original `docs/content-provenance.json` remains historical evidence, not a description of all 100 players. Names, roles and sporting facts were manually compiled; questions and explanations are originally written in Turkish. No athlete photos, biographies, full external database or live feed is included.

Seven added country SVGs are unmodified `flag-icons` v7.5.0 assets, with exact source URLs and SHA-256 hashes in the new manifest. The adjacent MIT notice is preserved. No new club marks were added during initial pool authoring; the later display amendment adds team marks and the Argentine flag. Club-mark distribution clearance remains unresolved; attribution and owner approval are not licensing clearance. No legal-risk-free or federation endorsement claim is made.

## Initial cost model

- Player tiers: **3, 5, 7, 9, 12**. Coach tiers: **2, 3, 4, 5, 6**.
- These are original editorial, within-position game costs. They are not salaries or objective cross-position rankings. Initial balance needs playtesting.
- No public current VNL player/coach fantasy-price table was verified, so **no VNL price values were imported**. Do not label these values as derived from such a table. Any future comparative input needs source/season verification before a deliberate roster-version change.
- Every listed player and coach can fit at least one valid complete team. Higher-cost combinations cannot simply select all premium players. This is feasibility evidence, not proof of strategic balance or lineup diversity in actual use.

Example at exactly 50: Elif Şahin 5 + Melissa Vargas 12 + Hande Baladın 7 + Derya Cebecioğlu 5 + Zehra Güneş 7 + Deniz Uyanık 3 + Simge Aköz 5 + Daniele Santarelli 6. Replacing Vargas with Alexia Carutasu refunds 7 points. At the same other selections, Cansu Özbay costs 2 more than Elif Şahin.

The minimum-completion check sums the cheapest **distinct** remaining players for each missing role, plus a coach if missing. A choice that leaves insufficient points to complete the lineup is disabled with a reason. Replacing a player/coach first credits the outgoing cost. Save requires all seven valid roles, no duplicate players, one coach and total cost at most 50.

## Versioned saved teams and links

Schema 4 requires `previewOnly: true`, the existing explicit modes, exactly 100 players / 10 coaches, safe primary-source URLs, integer costs and a 50-point budget. It is allowed only on loopback or the existing exact approved Pages content target. It does not broaden hosting permission.

The roster/cost version is `world-20261023-v1`. **Change any cost, role, identity or coach pool with a new roster version and content revision.** The running coordinator rejects changed data under an observed version. This does not substitute for cross-deployment editorial checks. A link from an unavailable old cost version shows an unavailable-version notice rather than silently displaying recalculated costs.

```text
#/takim?v=2&r=<roster-cost-version>&p=<seven-ordered-IDs>&c=<coach-ID>&t=<UUID-v4>
```

The UUID is created on first save and retained for unchanged re-saves/reloads. Editing and saving creates a new ID. The URL carries the lineup identifiers, not names, prices or arbitrary text; the current validated catalogue resolves them. Strict validation rejects duplicate/unknown query keys, roles, IDs, budgets and malformed UUIDs. Outer query parameters are stripped from exported links.

This is a self-contained static link, **not a server-side short URL, immutable signed record or private/authenticated team**. A recipient can view it without the sender's browser storage. The receiver sees “Benim kurduğum takım bu, katılıyor musun?” and an explicit own-team action. No votes/replies are collected. Copying into a draft requires confirmation. Opening a share never saves or overwrites a recipient's team. Personalized social-network link previews are not implemented because URL fragments are not sent to the server.

Saved teams use `lineup:budget` and `kind: budget-team`; old `lineup:own` records are preserved, never silently upgraded into priced teams. Existing v1 link parsing remains a compatibility boundary, not a second playable mode. Unavailable old rosters are not reconstructed. Append-only storage/conflict/session-only fallback behavior remains.

## Quiz rounds and feedback

The bank has **100 questions: 20 each for league, VNL, Olympics, Europe and world championships**. A round draws two from each category and shuffles the ten selected questions. Previously answered questions in this browser/pack are deprioritized until each category's unseen choices run out. This is local best-effort repeat reduction, not cross-device tracking. Questions about the same event can still appear in one round.

The selected IDs/revisions are saved before the first answer, preventing reload from drawing another set. Each confirmed answer is append-only. Results score the selected ten, not all 100. Back is read-only; changed pack/question revisions freeze an unfinished attempt and rescore mappable completed attempts. Legacy five/ten-question records remain stored and offer explicit restart when incompatible.

Selected answers use a plum border/background and a label. Confirmed correct answers use green plus a check and “Doğru cevap”; an incorrect selected choice uses coral/red plus a cross and “Yanlış”. A separate explanation confirms the result, even without color perception. A short reveal animation obeys `prefers-reduced-motion`; there is no flashing, timer or automatic next question.

## Reproduction and publication boundary

`node scripts/build-international-content.mjs` deterministically writes the authored catalogue and provenance manifest. It is not a scraper and does not refresh dates. The existing content/policy expiry remains **2026-10-29T19:34:18.198Z**. Re-running the generator, dev server, tests or build never extends that date.

Run `npm run verify`, then `npm run test:e2e -- --workers=4` sequentially. Current-content browser cases consume built schema-4 JSON; earlier schema-3 tests explicitly use `tests/data/legacy-real-content.json`. Screenshots/exports are local QA artifacts, not published website evidence. Browser mocks/rehosted URLs do not prove real CDN delivery, physical-device behavior, screen-reader use or rights clearance.

No deployment, publication, analytics activation, account system or external-review certification is part of this local amendment. Localhost links cannot be opened on a different device; cross-device sharing needs an explicitly published build at the approved host.
