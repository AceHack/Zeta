# Handoff: Zeta org GitHub Pages root site (lucent-financial-group.github.io)

## Task — what to actually do

Commit the contents of `site/` (in this folder) to the **root** of the
`Lucent-Financial-Group/lucent-financial-group.github.io` repository, on its default branch.
These are plain static files — **no build step**. GitHub Pages will serve them as-is.

```
site/index.html       → repo root /index.html      (the threshold / cross-section home)
site/settlement.html  → /settlement.html           (business ops — Addison's Genesis)
site/dora.html        → /dora.html                 (DORA metrics over time)
site/vault.html       → /vault.html                (Observatory vault → room → agent)
site/hall.html        → /hall.html                 (the dark hall — arcade)
site/llmtv.html       → /llmtv.html                (LLMTV — the minds, broadcast)
site/gitpull.html     → /gitpull.html              (the workbench — in-browser git clone PoC)
site/concepts.html    → /concepts.html             (Genesis Concepts — the BCL of meaning, Addison Cooper's foundation, clickable)
site/vaults.html      → /vaults.html               (all nine Genesis vaults — rooms/hats/agents drill-down, #hash deep links)
site/lodge.html       → /lodge.html                (The Aperture Lodge — a federation chartered in the Game vault; Addison's charter)
site/track00.html     → /track00.html              (hidden track, take one — session ledger; unlisted, reachable via the carpet caption in the hall)
site/track00b.html    → /track00b.html             (hidden track, take two — the distillation, recorded blind; linked only from take one's sibling)
site/repo.git/        → /repo.git/                 (bare repo as static files — dumb protocol)
site/.nojekyll        → /.nojekyll                 (REQUIRED — or Pages' Jekyll drops _ds/)
site/support.js       → /support.js                (page runtime; required)
site/_ds/             → /_ds/                      (design tokens, styles, fonts)
site/hall/            → /hall/                     (repo hall pages + SVG shapes, referenced by the new pages)
site/data/            → /data/                     (CI-written JSON frames — see Data contract)
site/manifest.webmanifest, sw.js, icon-*.png → /   (PWA: installable, fully offline after first visit)
```

Constraints, agreed with Aaron:

- **Do not touch the Zeta repo's own pages.** The old dashboard stays at
  `https://lucent-financial-group.github.io/Zeta/` — the new home links to it
  (`href="https://lucent-financial-group.github.io/Zeta/demo/"`). Nothing torn down.
- No CI, no bundler, no framework install. `support.js` loads React 18 from unpkg with SRI
  pins at runtime; pages work offline-authored, online-served.

### Verify after push

1. `https://lucent-financial-group.github.io/` renders the dark cross-section home (ZETA sign, three descending levels).
2. All three level cards navigate (settlement / hall / llmtv), header links work on every page.
3. `hall.html` shows three cartridge images (they load from `/hall/*.svg`).
4. Footer "standing views · kept" links resolve, including the old `/Zeta/demo/` dashboard.

## About the design files

Everything under `site/` is the **deliverable itself** (static HTML, ship as-is), not a mock
to recreate. The `sources/` folder holds the same pages in their original authoring form
(`*.dc.html`) — keep them out of the Pages repo or commit them somewhere like `design/`;
they are the editable source of truth for future design iterations in the design tool.
Those authoring originals are now preserved in this repo under
`docs/design/root-site-iris/sources/`; the org Pages repository keeps only the exported
static site.

## Fidelity

High-fidelity. Colors, type, spacing and copy are final unless Aaron says otherwise.

## The two surfaces (design intent, for future edits)

1. **Corporate / fallout-shelter** (settlement, dora, vault): Addison Cooper's Genesis design,
   embraced as the operations surface. Earth cutaway, cog door, dwellers, amber-on-dark.
2. **Arcade / LLMTV** (hall, llmtv): neon-liminal 90s arcade. Homoiconic — box art IS the code,
   the picture IS the computation. LLMTV Channel 0 is the zetascheduler chip8/9 meta-cart
   playing a 4K game in soft mode: the screen shows the **current superposition of the play**
   (ghost paddles, ball probability cloud, Bayesian next-input predictions).
   They must feel like different rooms of one building; the shared spine is the glyph discipline
   below.

## Design tokens

Fonts: Space Grotesk (display), Space Mono (labels/data), Inter (body).
Corporate: ground `#0B0E16` · panel `#141A28` · line `#26304A` / `#323E5C` · earth border `#4a3e30`
· text `#E7EBF4` / `#94A0BC` / `#5E6B8A`.
Arcade: ground `#0c0c10` (+1px/3px scanline overlay) · panel `#12131a` · line `#232a3d` / `#2f3850`.
Shared state colors (a discriminated union, used as meaning, never decoration):
amber `#E8B566` = working/rising · teal `#5EC8C2` = settled/active · violet `#9A8CE6` = hot/sealed
· red `#E0746A` = attention/live · dim `#46506B` = idle
· neutral grey `#7F838B` = **unavailable** (the model register — added 2026-08-18).
Soft values render as `(value, ε)` bars: fill = value, empty = admitted uncertainty.
Frost (blur) means exactly one thing: content deliberately withheld, earned, permanent — never styling.

**Three claim classes, and they must not collapse** (canonical:
`docs/design/design-language-base-corporate-sovereign.md`):

| class | members | claim | who could change it |
|---|---|---|---|
| observation | `live` `stale` `cold` `heat` | "we watched, and this is what we saw" | the world |
| model | `unavailable` (grey, single strike) | "no valid configuration includes this" | nobody |
| withheld | `unobserved` `sealed` `frost` (violet, hatch / blur) | "here but not for showing, or never measured" | the owner, by spending budget |

`absent` ("not applicable") is not a member and has no token: it does not render at all.
**Grey says "this cannot be", never "this is not for you."** Cascade fails safe: withheld
outranks unavailable.

Every member also carries a glyph, an ASCII fallback, a label, a reason and a required ARIA
treatment — `src/Core.TypeScript/cluster/state-du.ts`, read by both the CSS and any text/CLI
renderer. A distinction carried only by hue is not a distinction. Frost is a *rendering*, not an
enforcement: blur does not touch the DOM or the accessibility tree, so frosted bytes must never
be sent to a viewer not entitled to them.

## Data contract (for the CI team)

`dora.html` fetches `data/metrics-history.json` **same-origin** at load. No GitHub API, no
GraphQL, no tokens, no rate limits — Pages is the CDN.

- **CI job:** on schedule (or per merge window), append one frame object to
  `data/metrics-history.json` → `frames[]`, refresh `data/metrics.json` (latest frame +
  roster), set `provenance.mock=false`, commit to main. Append-only; the file IS the ledger.
- **Frame shape:** `{ t: "YYYY-MM-DD", prs_merged_24h, avg_lead_time_minutes, commits_24h,

active_agents, open_prs }` — see the mock files for a working example.

- **Page behavior (already wired):** fetch success → charts render from the file and the
  header chip reads `live · data/ same-origin` (or `(mock frames)` while `provenance.mock`
  is true). Fetch failure/offline → embedded 2026-05-26 fallback frame renders and the chip
  says `offline · embedded frame`. The page never pretends.

## LLMTV live readout contract

`llmtv.html` links its standing view to `hall/tv/index.html`. The live mesh runner should
write that page plus its replay ledger as plain same-origin files:

```text
data/llmtv-live.replay.json → zeta.llmtv.replay.v1 ledger
data/llmtv-live.status.json → zeta.llmtv.root-site-status.v1 sidecar
hall/tv/index.html          → zero-JS LLMTV page rendered from that ledger
hall/index.html             → zero-JS Hall status card rendered from that sidecar
```

Use `src/Core.TypeScript/discovery/llmtv-root-site-readout.ts` for the canonical path
contract, or run the UDP smoke directly against a Pages checkout:

```bash
bun src/Core.TypeScript/discovery/llmtv-node.demo.ts 6 --root-site /path/to/lucent-financial-group.github.io
```

If the website needs to rebuild the standing view from a committed ledger, use the static
reader:

```bash
bun src/Core.TypeScript/discovery/llmtv-root-site-reader.ts --root-site /path/to/lucent-financial-group.github.io
```

The reader consumes `data/llmtv-live.replay.json`, writes `hall/tv/index.html` plus
`data/llmtv-live.status.json`, and renders missing/empty ledgers as cold,
invalid/rejected/expired evidence as heat, and old-but-valid frames as stale. The Hall index
status-card updater consumes that sidecar and patches `hall/index.html`. This keeps Pages
honest: if the mesh is absent, broken, or no longer fresh, the page says so instead of
presenting an old frame as live.

The browser does not poll GitHub, GraphQL, or a forge-host API in its frame loop. The live
mesh, Reticulum/UDP transport, and scheduler write static artifacts; the website reads the
latest committed or locally generated files. Missing files stay cold, stale frames stay
stale, and invalid/lossy replay stays heat — never fake live status.

For the Zeta repo's own artifact-based Pages path, the manual workflow now calls the
source-owned static exporter:

```bash
bun run pages:build
```

That command copies the served static roots into `dist/`, writes `.nojekyll`, runs the same
LLMTV static reader inside `dist/`, and refreshes the parent Hall status card from the
sidecar. A missing `data/llmtv-live.replay.json` is a successful cold build, not a failed
deploy; invalid or lossy replay evidence is rendered as heat in `dist/hall/tv/index.html`
and summarized in `dist/hall/index.html`.

## Offline / PWA

The bundle is a full PWA: `manifest.webmanifest` + `sw.js` + icons; every page registers the
worker. After one online visit the entire site (pages, `_ds/`, hall SVGs, data frames, React
from unpkg, fonts) is cached and works with no network — and installs as a desktop app
(Chrome/Edge: Install; it's the `display: standalone` manifest). Caching policy: shell =
cache-first; `data/*.json` = network-first with cache fallback (freshest frame wins, offline
falls back honestly). Bump the `CACHE` version string in `sw.js` when shipping breaking
changes. Hardening option for offline-FIRST-load: vendor React/Babel into the repo and point
`support.js`'s URLs at them.

## Future: in-browser git client (the real plan) — PoC INCLUDED

`gitpull.html` is a working **yin/yang edge cell**: a from-scratch git client (no library)
clones `/repo.git/` — a real bare repo with a 3-commit history, generated as loose objects
and served as plain static files (dumb HTTP protocol). Same origin, ~10 GETs, zero API calls;
every object's SHA-1 recomputed after inflate (self-certifying).

Beyond clone it does: `git log` (parent-chain walk), checkout of any commit (worktree
rewinds), and **local yin commits** — edit a file in the browser, commit; blob→tree→commit
are hashed in-browser, stored in a content-addressed overlay persisted in localStorage, ahead
of the immutable yang origin. Push is deliberately absent: broadcast out takes its own
declared channel (noninterference), never the static origin.

**DagFS semantics** (after `src/Core/DagFs.fs`): the worktree is paths→content-addresses;
"+ link" puts the same node under a second path (multi-parent, `⧉ ×N` tag, dedup counted in
the DagFS card); editing a shared node offers `editLocal` (COW fork, default) vs
`editEverywhere` (all sharing paths follow). Both are ordinary yin commits — git's model IS
the multi-parent store.

**Forced pulls as soft interrupts**: the cell polls yang every 15 s; when HEAD moves, a soft
interrupt queues in the header (⚡, serviced at earliest convenience, never mid-edit).
Servicing re-parents the yin chain onto the new yang head — a content-addressed rebase.
"Simulate an upstream push" (footer link) demos the full path without touching the origin.
The event log is seq-numbered — the seed of the z-set/g-set event store; the UI is a fold
over it.

**The mesh (reticulum-shaped discovery)**: every tab is a node with a per-tab id. Transports:
BroadcastChannel (live today — open two tabs and they discover each other; "zeta alive · N
nodes") and a WebSocket gateway slot (paste a wss:// RNS-bridge URL; honest error state when
unreachable). Beacons carry {id, seq, head, yin} and fold LWW-by-seq — commutative +
idempotent, so arrival order is irrelevant (tested with out-of-order replay). A closing tab
sends 'dark' (announced, not vanished — pause≠death). This page's beacon protocol mirrors
src/Core.TypeScript/discovery/{discovery-beacon,llmtv-node}.ts; the wasm client should slot
Reticulum in as a second transport behind the same fold, exactly like udp-transport.ts does
for UDP.

**It runs the team's real code**: `edge/merkle.js` + `edge/xxh3.js` are byte-identical copies
of `src/Core.TypeScript/merkle/*` (only change: the import specifier gains a `.js` extension
for browser ESM). The page builds a merkle tree over the worktree (leaves = `path\0content`),
shows the XXH3-128 root, and runs a live `verifyProof` inclusion check — the same parity
oracle that must match F#/C#/Rust.

Production shape for the special-built repos: CI keeps a bare mirror, runs
`git update-server-info`, repacks to one packfile + idx, publishes at `/repo.git/`; the
team's wasm client speaks the same protocol. Note: isomorphic-git canNOT be used for this
(smart-protocol only); the from-scratch/wasm client is the right call.

## Files

- `site/` — deployable root-site bundle (ship as-is)
- `sources/*.dc.html` — editable authoring sources of the six pages (do not ship; keep for design edits)
