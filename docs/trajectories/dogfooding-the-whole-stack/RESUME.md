# Dogfooding the whole stack — running Zeta on Zeta

Status: ACTIVE — declared the next big trajectory by the human maintainer 2026-08-09
Last refreshed: 2026-08-25
Current blocker: **NONE for the society runtime — cleared 2026-08-25.** The lanes flush again.
The blocker recorded here (PAT lacking `contents: write` since #10850) was only HALF the story,
and the recorded half had already been fixed: `git push` on the flush token works. What kept the
lanes down afterwards was a DIFFERENT scope on a DIFFERENT credential — `gh pr create` returned
`HTTP 403 Resource not accessible by personal access token`, because the step held the
BRANCH-PUSH credential while doing PR-CREATE work. #15351 separated the three token roles and
routed PR-create to `ZETA_PR_ARCHIVE_TOKEN`; soraya's flush merged at 15:32Z and alexa's re-cut
and armed, both on 2026-08-25. Three further faults were fixed in the same window: a healthy
backpressured tick reporting as a broken flush (#15348), a backpressure deadlock with no escape
from an unmergeable blocker (#15348), and the credential probe testing a repo READ while the step
does a PR WRITE (#15364). Workitem `081M05G8D36087G0R0034D3QPA` carries the measured split.
Next concrete action (2026-08-25): LOAD a launchd/systemd unit from `tools/tick-source/` so row 6 becomes a scheduled redundancy rather than a proven capability; then pick the highest-leverage NOT-YET row below (candidates: ACE meta-resolver, ZetaDB-as-types, or the cross-substrate fold guard 081KZM0FTJM which gates simultaneous runner+local dogfooding)
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
| 1 | **Agents on free models** | ✅ **dogfooded — recovered 2026-08-25** | `agent-heartbeat.yml`, matrix `[alexa, otto, soraya]`, free-tier Ollama (`qwen2.5:0.5b` / `7b`). Down 2026-08-15T23:06Z -> 2026-08-25; recovered when the three-role token split (#15351) let `gh pr create` succeed. Still re-check before citing — the honest test is `gh run list --workflow agent-heartbeat.yml --branch main` plus `git log -1 origin/heartbeat/otto`, not this row. See `081M05G8D36087G0R0034D3QPA` |
| 2 | **Agent cells (local)** | ✅ **dogfooded** | 4 launchd cells (otto/vera/lior/alexa) provisioned by `install.sh` on the maintainer's laptop |
| 3 | **Society evolution loop** | ✅ **dogfooded** | `society-heartbeat.yml` (cron `*/30`); first tick 2026-08-09 committed `society-msmaqqb7` — 4 agents, mean fitness 0.1860, diversity 8.3508 |
| 4 | **Tick sources — GitHub Actions** | ✅ **dogfooded** | the reference implementation; staleness impossible by construction (branch reset from main). **No longer the ONLY source (2026-08-25)** — the tick sequence is now a written port, `src/Core.TypeScript/agent-heartbeats/tick-source.ts`; it had existed only as inlined YAML in `agent-heartbeat.yml`, so there was nothing a second substrate could implement |
| 5 | **Tick sources — browser tabs / PWA** | ◐ **partial — blocker NAMED 2026-08-25** | `src/Core.TypeScript/browser-node/` (36 files). The blocker is **delivery, not authentication**: producing and signing a tick unattended are both solvable, but the `issues/new` carrier works because the human click carries GitHub's own session — the click IS the credential. The repo's own answer, `browser-delegated-device-proposal-gh-cli.ts`, shells out to a local `gh` ("without moving the token into the browser"), so **the PWA's delivery leg is row 6**. Also: `ZETA_OPERATOR_HARNESS_ORIGIN` (manus.space) **500s on all three endpoints** and cannot be repointed at Pages (POST + GitHub App key). X named precisely in the design doc §5c |
| 6 | **Tick sources — bare local services** | ◐ **partial — a tick LANDED 2026-08-25** | `local-tick.ts` + launchd/systemd templates in `tools/tick-source/`. Proven end-to-end: `heartbeat/dejan-local` commit `540a4409`, `Agent-Runtime: launchd/com.lucent.zeta.heartbeat.dejan-local`, on local Ollama, with **no workflow referencing that lane**. Exit test passed — with Actions simulated absent the fleet still reads alive (rc=0). **Still `partial`, not `dogfooded`: no unit is loaded on any machine yet**, so this is a capability, not yet a redundancy |
| 7 | **Tick sources — k8s pods** | ◐ **partial** | `zeta-ai-agent.nix` per-persona systemd units exist; the society does not yet run in-cluster |

### Tier 2 — the substrate we are replacing

| # | We depend on | Zeta replacement | State | Evidence |
|---|---|---|---|---|
| 8 | npm/bun deps, brew, apt, uv, dotnet… | **ACE realizers** | ✅ **dogfooded** | `src/Core.TypeScript/ace/setup-realize.ts` + `setup-realizers/` (**23 files**, 17 of them `from-*` classes incl. `from-uv-venv`, `from-uv-tool`, `from-bun-workspace`). Invoked by **workflows** — `gate.yml`, `lean-proof.yml`, `low-memory.yml`, `macos-install-sh-test.yml`, `tlaps-proof.yml`, `accelerator-local-llm-validate.yml`. **Corrected 2026-08-25:** this row said `install.sh` delegates to it and gave the path as `ace/setup-realize.ts`; `install.sh` does not reference it at all, and the path is under `src/Core.TypeScript/`. Verify with `git grep -l setup-realize -- tools src .github` before citing. |
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
