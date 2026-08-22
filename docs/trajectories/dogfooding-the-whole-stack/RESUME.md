# Dogfooding the whole stack — running Zeta on Zeta

Status: ACTIVE — declared the next big trajectory by the human maintainer 2026-08-09
Last refreshed: 2026-08-16
Current blocker: **the society's own tick lanes are down, and the remaining half needs the
operator.** Since PR #10850 merged (2026-08-15T23:01Z) every `agent-heartbeat` branch push has
failed with `403 … Permission to Lucent-Financial-Group/Zeta.git denied to AceHack` —
`ZETA_TELEMETRY_FLUSH_TOKEN` carries no `contents: write` — so `heartbeat/{alexa,otto,soraya}`
have been frozen at 2026-08-15T22:55Z and flush PRs #10709/#10710/#10711 have never had
`gate (required)` start. Workitem `081M05G8D36087G0R0034D3QPA`. The artifact half (a
credential fallback so the lane keeps recording) has shipped; granting the PAT
`contents: write` is operator-only.
(Prior blocker line, retained: none for first-boot provisioning — 081KZETP6AT, 081KZHJPJCF fixed 2026-08-09.)
Next concrete action: pick the highest-leverage NOT-YET row below (candidates: ACE meta-resolver, ZetaDB-as-types, or the cross-substrate fold guard 081KZM0FTJM which gates simultaneous runner+local dogfooding)
Evidence links: 081KZM0FTJM (fold race — gates runner+local at once) · 081KZKV16YF (from-installer hash pin) · `docs/research/2026-08-09-zetadb-as-compiler-of-compilers-…` (the audit this ledger extends) · `docs/ZETA-ARCHITECTURE-UNIFIED.md` (Replacement Roadmap) · `docs/ZETA-CORE-TECHNOLOGY-FOR-MAX.md` (layer map)

## Why this trajectory exists

The human maintainer 2026-08-09: *"dogfooding is our next big trajectory — we've been
building to the point we can dogfood, we are there now."*

And, on scope: *"this is what I want to dogfood on the github free workflow runners **and
also on our local hardware at the same time** — we are just consuming tick sources from
anywhere, even open browser tabs and PWA and locally running apps."*

**Before today this trajectory was blocked and nobody had said so out loud.** Cluster
nodes could not provision themselves (NixOS has no FHS loader ⇒ mise's prebuilt
toolchains could not `execve`), so two of the four intended tick-source substrates could
not run the stack at all. That is fixed and CI-validated, which is what makes "we are
there now" true rather than aspirational.

## The gap this document closes

The chain existed in **three partial places and no single one**:

| Surface | Carries | Missing |
|---|---|---|
| `ZETA-CORE-TECHNOLOGY-FOR-MAX.md` | what the technology **is** (11 layers) | what we actually **run** |
| `ZETA-ARCHITECTURE-UNIFIED.md` | "Replacement Roadmap" (4 targets), "Not Yet Wired" (7 gaps) | framed as architecture, not as self-hosting; no current-state column |
| `2026-08-09-zetadb-as-compiler-…` ferry | a verified 6-surface audit | point-in-time, buried in research |

No document in the repo contained the word **"dogfood"** before this one.

## THE LEDGER

Every row: what we depend on **today**, the Zeta thing meant to replace it, and honest
state. `✅ dogfooded` = we run our own thing in earnest. `◐ partial` = runs, but not as
the real dependency. `○ not started` = no surface in-tree.

### Tier 1 — the society runtime (this is where we actually are)

| # | Layer | Running on our own thing? | Evidence |
|---|---|---|---|
| 1 | **Agents on free models** | ⚠️ **dogfooded but DOWN since 2026-08-15T23:06Z** | `agent-heartbeat.yml`, matrix `[alexa, otto, soraya]`, free-tier Ollama (`qwen2.5:0.5b` / `7b`). The "green every ~45 min" claim was true on 2026-08-09 and false from 2026-08-15T23:06Z: 48 consecutive red runs on `main`, refs frozen. Re-check before citing — `gh run list --workflow agent-heartbeat.yml --branch main`, and `git log -1 origin/heartbeat/otto`. See Current blocker + `081M05G8D36087G0R0034D3QPA` |
| 2 | **Agent cells (local)** | ✅ **dogfooded** | 4 launchd cells (otto/vera/lior/alexa) provisioned by `install.sh` on the maintainer's laptop |
| 3 | **Society evolution loop** | ✅ **dogfooded** | `society-heartbeat.yml` (cron `*/30`); first tick 2026-08-09 committed `society-msmaqqb7` — 4 agents, mean fitness 0.1860, diversity 8.3508 |
| 4 | **Tick sources — GitHub Actions** | ✅ **dogfooded** | the reference implementation; staleness impossible by construction (branch reset from main) |
| 5 | **Tick sources — browser tabs / PWA** | ◐ **partial** | `src/Core.TypeScript/browser-node/` (36 files: service worker, tab coordinator, IndexedDB checkpoint, lifecycle host) |
| 6 | **Tick sources — bare Linux services** | ○ **not started** | intended 3–4 services, no k8s; may grow into a k8s replacement |
| 7 | **Tick sources — k8s pods** | ◐ **partial** | `zeta-ai-agent.nix` per-persona systemd units exist; the society does not yet run in-cluster |

### Tier 2 — the substrate we are replacing

| # | We depend on | Zeta replacement | State | Evidence |
|---|---|---|---|---|
| 8 | npm/bun deps, brew, apt, uv, dotnet… | **ACE realizers** | ✅ **dogfooded** | `install.sh` delegates to `ace/setup-realize.ts`; **17 classes**, incl. `from-bun-workspace` added 2026-08-09 |
| 9 | manual/ad-hoc distribution | **ACE meta-package-manager** | ○ **not started** | only `Core.FSharp.AceCanonical`; N-dimensional resolver + AI-rate negotiation are design-stage. **The single biggest gap.** |
| 10 | CockroachDB (k8s: temporal, hindsight, longhorn) | **ZetaDB** | ◐ **partial** | `zetadb-scheduled-node.yml` folds a journal + commits checkpoints; but Cockroach is still the real store |
| 11 | OS filesystem | **ZetaFS** (`DagFs`) | ◐ **partial** | `DagFs.fs` content-addressed multi-parent tree consumed by `Db.fs`/`File.fs`/`ZetaToolStore.fs`; not the OS FS |
| 12 | Linux (NixOS) | **Zeta unikernel** | ○ **not started** | no surface in-tree at all |
| 13 | TCP/IP + GitHub as transport | **Reticulum mesh** | ◐ **partial** | `ReticulumLink.fs`, `ReticulumChaos.fs` exist; not the live transport |

### Tier 3 — the compiler/self-model chain (the direction of travel)

| # | Step | State | Note |
|---|---|---|---|
| 14 | journal → fold → checkpoint | ✅ running | `data/zetadb/{journal,checkpoint}.json` |
| 15 | checkpoint → **reified types** | ○ not started | the arrow that makes ZetaDB a compiler stage; today the checkpoint is JSON, not types |
| 16 | types → consumed by BNN + free LLMs | ○ not started | via the harness + the 4×4 action grammar |
| 17 | Futamura 2nd/3rd in-domain | ✅ shipped | `Cogen.fs` (machine-checked fixpoint), `MixCogen.fs` |

## How to dogfood MORE — ranked by leverage

1. **Unblock simultaneous runner + local (`081KZM0FTJM`).** Aaron's stated target is both
   at once; the only fold guard is an Actions-scoped concurrency group that cannot see a
   local or browser cell. **This gates the headline goal**, and the fix is convergence
   (idempotency + commutativity + content-addressing), not a distributed lock.
2. **Rows 6 + 7 — put the society on bare Linux and in k8s.** Now unblocked by the
   first-boot fix; this is the largest jump in "how much of the stack runs on us."
3. **Row 15 — `checkpoint → types`.** Converts ZetaDB from a store into a compiler stage
   and feeds the BNN. Highest conceptual leverage.
4. **Row 9 — ACE meta-resolver.** The biggest single gap, and the only Tier-2 row with no
   partial credit.
5. **Row 10 — displace Cockroach for one real workload.** Dogfooding means being the real
   dependency; a checkpoint file is not yet that.

## External-dependency baseline (measured 2026-08-09)

Aaron: *"reducing external dependencies to the minimal."* That needs a number to move,
so here is the starting surface — counted, not estimated:

| Ecosystem | Entries | Managed by | Reducible? |
|---|---|---|---|
| apt (Linux system) | 29 | ACE `from-deb`/apt manifest | mostly OS-level; low |
| brew (macOS system) | 21 | ACE brew manifest | mostly OS-level; low |
| npm/bun (`package.json`) | 32 (19 dev + 13 runtime) | ACE `from-bun-workspace` (new) | **medium** — runtime deps are the real target |
| dotnet global tools | 7 | ACE `from-dotnet-global` | low |
| **vendor `curl \| sh` installers** | **6** | ACE `from-installer` | **HIGHEST PRIORITY** — see below |
| bun-global CLIs | 2 | ACE `from-bun-global` | low |
| from-url / from-shim | 3 | ACE | low |
| mise toolchains | ~16 | `.mise.toml` | low — these ARE the compilers |

**≈ 115 external dependencies total.** Every one of them is at least *declared* through
ACE, which is why row 8 of the ledger counts as dogfooded — but declared is not the same
as reduced.

### The 6 that matter most

`tools/setup/manifests/from-installer` — grok, cursor-agent, hermes, forge, agy — are
fetched-and-executed with **no hash pin** (`081KZKV16YF`), on the **unattended first-boot
path**, as a user who is `wheel` ⇒ a Nix trusted user ⇒ root-equivalent, on a box where
credentials have already been decrypted. They are simultaneously:

- the **highest-risk** external dependency (Mateo's review), and
- the **most legitimately reducible** — they are agent CLIs, i.e. exactly the thing the
  society is meant to replace with its own agents on free models (ledger row 1, already
  dogfooded).

So "reduce external dependencies to the minimal" and "close the supply-chain gap" point at
the *same six entries*. That is the cheapest place to start, and it is the only row where
reduction and security agree.

**Honest caveat:** pinning them is not free — vendor installers move on their own cadence,
so a pin turns an upstream release into an install failure until someone bumps it. That
trade (breakage vs. unpinned root-equivalent execution) is an operator call, which is why
`081KZKV16YF` is filed rather than fixed.

## Discipline for this trajectory (learned the hard way, 2026-08-09)

- **Verify the artifact, not the ceremony.** A green run, a MERGED badge and a passing test
  can all coexist with nothing having happened. Check the marker, the file on `main`, the
  actual conclusion.
- **A test that cannot fail is worse than no test.** Two separate self-certifying suites
  were found today (`EB-8`, `linearBlendIsVacuous`) plus a scenario that reported PASS with
  a broken toolchain install.
- **Grace in the artifact, strict in the test.** Auto-heal absorbs transients; the
  assertion must shout on genuine exhaustion.
- **Errors must teach.** Six distinct causes in one bug chain printed the same misleading
  line until the swallowed stderr was surfaced; after that, each failure named its own fix.

## Cross-refs

- `docs/research/2026-08-09-the-society-is-one-thread-four-tick-sources-auto-heal-by-redundancy-aaron.md`
- `docs/research/2026-08-09-zetadb-as-compiler-of-compilers-db-as-types-cells-anywhere-dogfood-audit-aaron.md`
- `docs/ZETA-ARCHITECTURE-UNIFIED.md` — Replacement Roadmap + What Is Not Yet Wired
- Workitems: `081KZM0FTJM` (fold race, gates the headline goal) · `081KZKV16YF` (from-installer hash pin) · `081KZETP6AT` / `081KZHJPJCF` (the first-boot unblock, CI-validated 2026-08-09)
