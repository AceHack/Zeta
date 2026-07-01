# design-sync notes — Zeta portal UI kit

- The design system is the portal web app's UI kit at `full-ai-cluster/portal/web/src/components/ui/` (shadcn-style: Tailwind + class-variance-authority + tailwind-merge), plus presentational `bits.tsx` (HealthDot, PersonaAvatar) and `MetricChart.tsx`. Everything else under `src/components/` and `src/views/` is API-wired app code — never sync it.
- The app has no library build (`vite build` emits an app bundle, not a dist). The converter entry is a hand-written barrel `src/ds-entry.ts` (cfg.entry) exporting exactly the DS surface; component discovery is fully pinned via `componentSrcMap`. Adding a component = add it to the barrel AND `componentSrcMap`.
- CSS: `src/index.css` is Tailwind source (`@tailwind` directives) — it must be compiled first. `cfg.buildCmd` runs the Tailwind CLI with `tailwind.ds-sync.config.js` (same theme as the app + a safelist so token colors and standard spacing/layout/type scales exist even when the app doesn't use them — the synced stylesheet is the only CSS rendered designs get) into `.ds-css/compiled.css` (gitignored). Content globs cover app source AND repo-root `.design-sync/previews/**`. Re-run buildCmd before every converter run.
- Theme is dark-only: tokens are HSL triplets on `:root` (no `.dark` class needed); `body` carries `bg-background text-foreground` + Inter font stack. Preview cells wrap in `bg-background … text-foreground` divs (body styles don't reach the card surface).
- Fonts: Inter Variable ships from `@fontsource-variable/inter` (cfg.extraFonts → its `index.css`). The app's font stack also names plain "Inter" — `.design-sync/fonts/inter-alias.css` ships the same variable faces under that name (url() paths point into portal/web's node_modules; if the fontsource package layout changes, fix the paths). Without it validate fires `[FONT_MISSING] "Inter"`.
- `bits.tsx` imports `type { Health } from "@/lib/api"` — type-only, erased at bundle time; safe.
- `@/*` path alias → `cfg.tsconfig` (`tsconfig.json`, baseUrl `.`, `@/* → ./src/*`).
- Overlays: Dialog and Sheet are `fixed inset-0` portals — `cfg.overrides` renders them `cardMode: single` with explicit viewports. Card/Input/MetricChart/Tabs/Textarea are `cardMode: column` (fixed `[GRID_OVERFLOW]`).
- Render-check environment: this remote env pre-installs chromium build 1194 at `/opt/pw-browsers` (`PLAYWRIGHT_BROWSERS_PATH` already set) — install `playwright@1.56.0` into `.ds-sync/` to match (1.57 pins 1200 and fails to launch).
- Known render warns: none — 29/29 render clean, 0 bad/thin/variantsIdentical after the fixes above.

## Re-sync risks

- `tailwind.ds-sync.config.js` spreads the app's `tailwind.config.js`; if the app theme adds tokens, the safelist's TOKEN_COLORS list must be extended by hand or new `bg-<token>` classes silently won't ship.
- `.design-sync/fonts/inter-alias.css` hard-codes relative node_modules paths — breaks silently if `@fontsource-variable/inter` changes its `files/` layout (validate will fire `[FONT_DANGLING]`/`[FONT_MISSING]` — re-check paths).
- Grades are campaign-local (gitignored `.cache/`): until a first upload writes `_ds_sync.json` to a project, every fresh clone re-verifies all 29 components.
- Preview content mentions concrete versions/numbers (zeta/api:2.4.1 etc.) — cosmetic only, nothing tracks the real app.
- 2026-07-01: session ran on claude.ai/code (headless) — DesignSync design-system authorization unavailable (`/design-login` needs an interactive terminal; alternative: Claude Design's "Send to Claude Code Web"). Run was local-only; **no project created, no `projectId` pinned yet**. The built, validated bundle is `ds-bundle/` (regenerate with buildCmd + the driver). First upload must go through base-skill §1 target-pick + routing when auth is available.
