# design-sync notes — Zeta

- Zeta is not a design-system repo; the user chose `full-ai-cluster/portal/web` (zeta-portal-web) as the sync source — specifically the shadcn-style kit in `src/components/ui` (badge, button, card, dialog, input, sheet, tabs). App-level components (Terminal, MetricChart, Dashboards, …) are explicitly OUT of scope for the first import.
- No Storybook anywhere in the repo (no `.storybook/`, no `*.stories.*`) → shape = package. Confirmed with the user 2026-07-01.
- Styling: Tailwind 3 (tailwind.config.js in portal/web) + class-variance-authority + tailwind-merge; fonts via @fontsource-variable/inter; icons lucide-react. React 18, Vite app build (`vite build` outputs an SPA to ../dist — there is NO library dist; the converter must build the components itself).
- Package manager: bun (bun.lock). System bun 1.0.11 is too old for the lockfile — use the repo's mise pin: `/opt/homebrew/bin/mise exec bun -- bun …` (bun 1.3.14, repo `.mise.toml` trusted 2026-07-01). Install from `full-ai-cluster/portal/web` with `bun install --frozen-lockfile`.
- Target project: reusing the user's empty "Design System" project (f52fe130-fd0d-4310-93c2-19b6ce2a4ecc), confirmed 2026-07-01. Incremental upload path (project was empty at run start).
- **First sync COMPLETED 2026-07-01**: 10 components uploaded (66 files), all 23 preview cells authored + graded good, render check 10/10 clean, `_ds_sync.json` anchored. The earlier "authorization error" bullet below is resolved (user ran /design-login).
- The compiled stylesheet uses `.design-sync/tailwind.ds.config.mjs` (app config + safelist) so the design agent's utility vocabulary (semantic colors, layout, spacing) exists even where the app never used a class. Editing the safelist changes `styling` hashes → expect a styling re-upload.
- Preview cells for non-overlay components wrap in a local dark `Canvas` div (`bg-background p-6`) — the card page background is white and this is a dark-only DS; without the wrapper, foreground text is invisible (bit us on the first capture pass).
- Known render warns: none — the four `[GRID_OVERFLOW]` warns (Badge, Card, Textarea, Tabs) were resolved with `cardMode: column` overrides; Dialog/Sheet use `cardMode: single` at 920x620.
- **Self-link required** (fresh clone / fresh node_modules): the converter locates the package via `node_modules/<pkg>`, which doesn't exist for an app that is its own package and has no dist. Recreate with `ln -sfn .. full-ai-cluster/portal/web/node_modules/zeta-portal-web` after every `bun install`. Careful: the target is `..` (→ `web/`), NOT `../..`.
- Config paths that traverse the self-link (docsMap, extraFonts pointing at repo-root `.design-sync/`) need FIVE `../` (`node_modules/zeta-portal-web` → repo root, resolved lexically without following the symlink).
- CSS: `src/index.css` is raw `@tailwind` directives — must be compiled first. `cfg.buildCmd` runs tailwindcss CLI to `.ds-css/styles.css` (gitignored) with a content glob that INCLUDES `../../../.design-sync/previews/**/*.tsx` — preview-only utility classes won't exist in the CSS otherwise. Re-run buildCmd after authoring/editing any preview, before package-build.
- Fonts: fontsource ships family "Inter Variable"; the app CSS falls back to "Inter" which had no @font-face → `[FONT_MISSING]`. Fixed with `.design-sync/fonts/inter-alias.css` (aliases "Inter" to the same variable woff2), wired via `extraFonts`.
- Component pruning: 26 PascalCase exports collapse to 10 real components; compound children (CardHeader, DialogTitle, TabsTrigger, …) are `componentSrcMap: null` — they stay in the bundle/window global, and the parents' previews + prompt docs demonstrate them. Groups come from `.design-sync/docs/*.md` regroup stubs (Actions/Display/Forms/Navigation/Overlays).
- Theme: single dark theme — tokens are defined on `:root` directly (no `.dark` class variants despite `darkMode: "class"`). Everything renders dark by default.
- Dialog and Sheet render via `createPortal` fullscreen (`open` prop, no trigger) → need `cfg.overrides` `cardMode: single` + viewport so the open state renders inside the card.

## Re-sync risks

- The self-link and `.ds-css/styles.css` are machine state: both must be recreated on a fresh clone (`bun install` → `ln -sfn ..` → run `cfg.buildCmd`) before `package-build.mjs` works.
- `inter-alias.css` hardcodes the fontsource woff2 path under `node_modules` — breaks if `@fontsource-variable/inter` changes its file layout on upgrade.
- Preview compositions mirror app views (NeedsMe, Create, BlueprintBuilder) as of 2026-07-01; if the kit's variants change (e.g. new Button variant), previews won't show them until re-authored.
- Chromium for the render check was installed via `.ds-sync` playwright (`npx playwright install chromium`); `.ds-sync/` is gitignored, so a fresh clone repeats the install.
