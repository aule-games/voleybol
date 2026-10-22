# Visual direction

Status, 2026-10-22: this visual direction was accepted for the private prototype. Preserve it during the next verification and hardening work; it is not public-brand clearance or a release approval.

The private prototype uses a warm, editorial sports identity. It is designed for a young women's-volleyball audience without treating femininity as a fixed palette, adding gendered slogans, or weakening the sporting character. The working product name remains provisional.

## Palette and typography

| Role | Value | Use |
| --- | --- | --- |
| Paper | `#FFF9F2` | Page and export background |
| Plum | `#48263D` | Brand, primary actions, featured fixture and court |
| Ink | `#352632` | Body copy |
| Muted ink | `#695964` | Secondary copy on light surfaces |
| Coral | `#EF8E77` | Featured action and illustrative shirts, with plum text |
| Lilac | `#EEE3ED` | Builder entry, selection and libero background |
| Peach | `#FAE3D7` | Quiz entry and welcome |
| Warning | `#A53D30` | Focus and warning accents, never the sole state cue |

UI uses `Avenir Next`, falling back to `Segoe UI`, platform sans-serif. Display accents and the wordmark use Georgia with a serif fallback. There are **no downloaded fonts, hotlinked images or automatic third-party requests**. The bounded real-content preview adds locally served club marks and an MIT-licensed country flag; see [asset provenance and limits](local-content.md). Platform typography is intentionally variable; this is not a cross-platform custom-font guarantee. The export uses Georgia and the browser's system sans-serif.

## Components

- Keep a clear primary upcoming-match action. The header exposes all three games; the mobile hero does not spend the first screen on decoration.
- Mix strong sans-serif headings with selective italic serif accents. Do not make every label italic or replace native controls with decorative imitations.
- Use color fields to distinguish game entries, not nested dashboard cards. Corners are modest except one rounded trailing corner on feature panels.
- The original `public/court-play.svg` and inline ball mark are decorative. Shirt numbers indicate illustrative slots, not real athletes' shirt numbers. The separate libero and non-rotation disclaimer remain visible.
- Builder and quiz progress marks are decorative companions to text. Preserve native radios, labels, keyboard focus, status messages, draft behavior and read-only imported teams.

## Export contract

The PNG stays 1080 × 1350, with seven full names, six court slots and a separate libero. The visible ink stays inside a 64 px safe boundary. The italic wordmark's origin is inset beyond 64 px to allow for glyph overhang. Names use at least 40 px and at most three lines; overflow still fails safely to the text/link fallback. The current local-preview PNG contains real athlete names with truthful local-test copy; club marks and player likenesses are not included in the export.

## Verification boundaries

The normal sample export is inspected at full size and a 270 px browser-rendered preview. Automated browser tests cover small layouts, minimum navigation targets, decorative semantics, reduced motion, local-only artwork, PNG dimensions/colors and the full-name fallback. They supplement, not replace, the game-flow tests. Desktop engines are not physical-device sharing or screen-reader certification. No live hosting or public-brand clearance is implied.
