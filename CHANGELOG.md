# Changelog

All notable changes to yearn.css. This project follows [Semantic Versioning](https://semver.org/):
a theme or token rename is a breaking change.

## 0.1.0 — 2026-10-28

First release.

- Classless styles for typography, lists, quotes, code, tables, forms, media, `<details>`, `<dialog>`, `<menu>`, `<search>`, `<output>` and `<audio>`.
- Inset gradient hero (`body > header`), frosted pill nav, card grids (`section > article + article`), callouts (`<aside>`) and an inset footer.
- Film grain on gradients, tunable with `--y-grain`.
- Light and dark mode via `light-dark()`, following the OS or forced with `data-theme`.
- Presets: `data-gradient` (cotton-candy, creamsicle, grapefruit, sunshine, midnight, plain) and `data-accent` (blue, pink, red, orange, brown).
- Themes: Mint, Dusk, Ember, Tide, Mono, Candy, Arc and ShareBuilder, plus `themes/_template.css`.
- Themeable fonts, heading weight and color, buttons, radii, hero gradient and footer.
- WCAG AA contrast across all themes in both modes (`npm run contrast`).
- Print styles, right-to-left support, reduced-motion support, and a light-palette fallback for browsers without `light-dark()`.
- Minified builds in `dist/`, including `yearn.core.min.css` without the Google Fonts import.
