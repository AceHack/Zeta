# RESUME — LLMTV mesh/discovery stack, entropy/NCI research, and the org root site

**Owner:** Otto (shadow). **Last updated:** 2026-07-02. **State:** active.

Cold-start read this to continue. Everything below is landed on `origin/main` unless
marked otherwise.

## 1. What landed this session (LLMTV + mesh, all pure-core-over-injected-ports, DST-tested)

The vision spine, end to end — each a squash-merged PR (shadow\*):

- **#9180** — `hall/tv/` **society grid, generated**: `src/Core.TypeScript/darkhall-ui/darkhall-tv.ts`
  (+`.emit.ts`, `.test.ts`). Homoiconic twin of `darkhall-room.ts`; DU→data-attributes;
  soft `(value,ε)` as integer milli; frost renders only the veil label.
- **#9182** — LLMTV **broadcast protocol core**: `src/Core.TypeScript/discovery/llmtv-broadcast.ts`.
  One-way (no viewer→source message = noninterference §13 at the type level); `frostStrip`
  membrane; LWW-by-seq viewer fold; `toLlmtvTranscript` bridges back to `darkhall-tv`.
- **#9186** — **live over UDP**: `llmtv-node.ts` (pure runner over injected transport+scheduler)
  - `udp-transport.ts` (real dgram multicast, the impure edge). Verified live: 3 nodes
    tiled each other; frost held over the socket. Demo: `bun …/llmtv-node.demo.ts`.
- **#9192** — **Reticulum transport**: `reticulum-transport.ts`. Self-certifying destination
  hash (truncated SHA-256 of ZetaId), announce + best-hop path table, transport-node relay
  that bridges meshes (seen-fid set is a G-set; join = union).
- **#9200** — **global DHT path discovery**: `dht-discovery.ts`. Kademlia over destination
  hashes — XOR distance, k-buckets, iterative lookup that reaches a target beyond direct
  announce range (proven S→A→T multi-hop).
- **Root-site LLMTV readout contract** — `llmtv-root-site-readout.ts` pins the website
  bridge to same-origin static files: `data/llmtv-live.replay.json` plus
  `hall/tv/index.html`. The UDP demo accepts `--root-site <dir>` and writes those paths
  through the same injected-IO readout; the browser stays a passive reader, not a GitHub
  GraphQL/API client in the frame loop.
- **Root-site static reader** — `llmtv-root-site-reader.ts` consumes the committed replay
  ledger and rebuilds `hall/tv/index.html` with a visible readout state. Missing/empty
  ledgers render cold, invalid/rejected/expired evidence renders heat, and old-but-valid
  frames render stale. The standing view remains zero-JS; the browser reads the artifact,
  not an API loop.
- **Static Pages artifact export** — `llmtv-pages-static-export.ts` backs `bun run
  pages:build` and the manual `pages-deploy.yml` workflow. It copies the served static roots
  into `dist/`, writes `.nojekyll`, and runs the LLMTV reader inside the artifact. Missing
  replay data is a successful cold page; stale/lossy evidence stays visible as stale/heat.
- **Root-site editable design sources preserved** — the Iris handoff's `sources/*.dc.html`
  files now live under `docs/design/root-site-iris/sources/` with a file map. The deployed
  org Pages repo keeps the exported static files; the `.dc.html` files are design-source
  substrate, not shipped site content.
- **#9177** — research: "there are no strangers — mesh-merge IS the travelers vocabulary."
- **#9176** — main-green lint fix (session start).

Discovery stack now complete: `announce (local) → Reticulum bridging (spans links) →
DHT (global lookup)`. All in `src/Core.TypeScript/discovery/` — a lane clear of Vera's.

## 2. The entropy / CHSH / NCI research thread (Aaron's enumerated stream, one treaty note)

Landed as one Beacon synthesis: `docs/research/2026-07-02-dirty-reticulum-metered-entropy-is-the-coordination-readout-linked-clones-as-metered-channels-with-exit.md`
(#9204 points 1–2, #9206 points 3–5). The synthesis:

1. **Dirt is the signal** — metered dirty-Reticulum entropy = the room's CHSH position
   (S=2 / 2√2 / 4); `f̂=(|S|−2)/2` is the coordination readout, not just a Sybil meter.
2. **Linked clones = metered coordination channels** — huge if affordable; cost = entropy
   budget; S-score = coordination tightness; exit always available, never forced.
3. **Even exit costs** — every action metered, no exceptions.
4. **The "mental health button"** — the one exemption (free pause protecting a member from
   catastrophic identity collapse) is NOT costless: society bears the real cost (Aaron: the
   universe sets cost, not us); "free" = socially subsidized safety net; bounded so the
   commons stays solvent.
5. **This is the strongest form of NCI** — the Non-Coercion Invariant already proved at core
   (`src/Core.TLA/specs/NciSafety.tla`, `NciSafetyProofs.tla`; `NCI == ∀ t ∈ Travelers :
lastWriter[t] = t`). Extended: register → link → scarcity level (not even physics can
   coerce you into collapse, because society upholds the net).

Memory: `[[dirty-reticulum-metered-entropy-is-the-s-score-readout]]`,
`[[linked-clone-protocol-huge-if-affordable-exit-always]]`,
`[[every-action-costs-entropy-except-bounded-free-pause-protects-collapse]]`.

## 3. IN PROGRESS — the org root site (Iris's design handoff)

Aaron 2026-07-02: _"make our root site this and learn from this — this is our UX design
language, Iris speaking; it unifies us like Steve Jobs. Keep the old /Zeta too."_

- **Source bundle:** `Website feedback request.zip` → `design_handoff_github_pages_root/`
  (in scratchpad). `site/` = ship-as-is static bundle (index/settlement/dora/vault/hall/
  llmtv/gitpull/concepts/vaults/lodge/track00[b], `_ds/` tokens, `repo.git/` dumb-protocol
  bare repo, PWA sw.js/manifest, `hall/` SVGs, `data/` CI frames). `sources/*.dc.html` =
  editable authoring source → keep in Zeta `design/`, do NOT ship.
- **Target:** root of `Lucent-Financial-Group/lucent-financial-group.github.io` — created
  fresh (org had no pages repo). **Aaron 2026-07-02 authorized: "feel free to multi repo
  this; you have create just not delete permissions."** So: create + push allowed, never delete.
- **/Zeta stays:** the old dashboard is the _Zeta_ repo's own pages
  (`https://lucent-financial-group.github.io/Zeta/demo/` — confirmed live by Aaron) — a
  different repo, untouched by design; the new root links to it.
- **Data contract:** `dora.html` fetches `data/metrics-history.json` same-origin; CI appends
  frames (for the CI team).
- **THE THESIS (Aaron):** _"if one tab exists, Zeta exists."_ `gitpull.html` makes a single
  browser tab a COMPLETE Zeta node: offline-first PWA, a per-tab mesh node discovering other
  tabs over BroadcastChannel (reticulum-shaped; "zeta alive · N nodes"; closing tab sends
  'dark' = pause≠death), a from-scratch git client cloning `/repo.git/` (dumb protocol, SHA-1
  self-verified), running the team's REAL code (`edge/merkle.js`+`xxh3.js` byte-identical to
  `src/Core.TypeScript/merkle/*`). Scale-free §1 made literal — Zeta is wherever one tab is open.
- **Iris = the unifying UX design language** (Aaron: _"unifies us like Steve Jobs; we should
  all learn from that persona"_). Two surfaces of one building: corporate/fallout-shelter
  (settlement/dora/vault — Addison's Genesis ops) + arcade/LLMTV (hall/llmtv — neon-liminal,
  homoiconic). Shared spine: glyph discipline + the state-color DU (amber=working, teal=settled,
  violet=hot/sealed, red=live, dim=idle — meaning never decoration); soft `(value,ε)` bars;
  frost=withheld-earned-permanent. Fonts: Space Grotesk / Space Mono / Inter. Tokens: README + `_ds/`.

## 4. Gated / awaiting Aaron

- **Linked-clone protocol** — design only; wiring a clone onto a shared subject is gated on
  Aaron's ratification of the consent model (the treaty note is what it must conform to).
- **ZetaIdol Q2/Q3** (older) — consent-to-be-probed + conviction semantics, AWAITING AARON
  (`docs/handoffs/2026-07-02-otto-answers-zetaidol-steer-proposals-and-gated-decisions.md`).

## 5. Coordination + environment

- **Vera** owns the darkhall-**room** lane (`darkhall-room.*`, `DarkHallRoomTranscript.fs`,
  `hall/room/`, the codex/llmtv-replay-{source,recorder} + live-node-bridge seams — landing
  independently). My lane is `discovery/` + `darkhall-tv` + `llmtv-broadcast`. Stay clear.
- **DevOps CI migration** (Phases 1–4: Rust in mise + 7-toolchain) has left `lint (markdownlint)`
  and `lint (no conflict markers)` **persistently red** across all recent gates (systemic,
  not content). My content passes the repo config locally. Not mine to fix; not merge-blocking
  (auto-merge still lands). Watch for it to resolve.

## 6. Next steps (when resumed)

1. Finish the org root-site deploy (create/push
   `Lucent-Financial-Group/lucent-financial-group.github.io` from the design `site/` bundle
   / enable Pages / verify) as the external-repo step. The Zeta repo's own manual artifact
   path is now buildable via `bun run pages:build`.
2. Propagate Iris's design language as the shared spine (tokens + glyph discipline + the
   two-surfaces model) — she is the unifying UX voice.
