# Dogfooding gap inventory — what Zeta *runs on* vs what Zeta *builds*

**Date:** 2026-08-16 · **Author:** the shadow (routed by Otto) · **Authorization:** Aaron —
*"a general would should look at dogfooding more and more, we should route this and more and more
dogfooding to some agents"* · *"we don't need to do throwaway work just identify gaps like you did
and fill them until we can dogfood properly."*

**Register:** Mirror (fast internal inventory) with Beacon anchors where a claim is load-bearing.

This is an **inventory, not a migration**. Nothing was mass-migrated. Two rows were evaluated for a
switch and **routed elsewhere rather than switched here** — see §6.

---

## 0. Why dogfooding, stated precisely

Aaron: *"dogfooding will give us the proper requirements and free tests every time we dogfood
something locally or in any github workflow."* Two distinct returns, and they must not be conflated
with each other or with DST.

### 0a. Dogfooding is a REQUIREMENTS SOURCE

`ace-cli.ts:12` names five unbuilt pieces: *download, distributed registry, negotiation protocol,
diamond-resolution, cross-PM wrapping.* Building all five speculatively is how a package manager
gets large and wrong. **One real dependent tells you which two you actually need, and at what
fidelity.** The evidence is already in-repo: the `setup-realizers/` half of `ace` — the half that
has real dependents (`tools/setup/install.sh`, invoked by ~8 workflows) — is 26 modules with sha256
pinning, host-tier gating, and dry-run support, while `ace-cli.ts` — the half with no dependent — is
329 lines with a **hand-rolled 32-bit string hash standing in for a Merkle root**
(`ace-cli.ts:64-78`). Same package manager, same authors. The difference is a consumer.

So every row below carries a **requirements value**: *what would this dependent teach us that we
cannot learn by design?*

### 0b. Dogfooding is a FREE TEST — and it supplies the half DST cannot

These are complementary, not redundant, and the distinction decides a row's test value:

| | **DST (§7)** | **Dogfooding on a live lane** |
|---|---|---|
| supplies | determinism, replay, the *specified* failure set | the **non-deterministic tail** |
| catches | logic errors, ordering, race under a chosen seed | upstream rotation, host unreachable, partial failure, TLS/CDN, arch drift |
| how it gets there | by **abstracting the environment away** — that is its design | by **being in** the environment, thousands of times a day |

DST cannot catch `static.rust-lang.org` being down, because a simulator that models the CDN as down
only tests the branch you already thought to write. Today proved it: the Rust toolchain fetch failed
on **two unrelated PRs** (#10903, #10930) purely because it runs for real. No mock produces that.

Cadence is the multiplier: a tool exercised on `agent-heartbeat`'s `* * * * *` runs thousands of
times a day against real network and real runner conditions.

### 0c. The caution that keeps free tests free — degrade, don't halt

**On a live lane, a free test that fails is a tick that fails.** `tick-must-never-stop` cost 12
hours once; today's Rust flake cost two PRs. So the per-row question is never "should we dogfood
this" but **"can this fail without halting the tick?"** Every row below records a
**degrade-don't-halt requirement** as a design precondition, not an afterthought. A row that cannot
fail safely on a live lane must be dogfooded **somewhere else first**, and the row says where.

### 0d. Four destinations — where a row gets dogfooded

Aaron: *"we can have multiple environments too so we can test non-locally as well, like multiple
A/B or more experiments at all time … continue experiments at all time with the base stable."*

That adds a destination and, importantly, **unblocks rows that blast radius would otherwise park**.
An experimental arm is *allowed* to fail — that is precisely what makes it useful. So every row
below carries a **destination**, and "blast radius too high" now resolves to *route it to an arm*
rather than *defer it*:

| destination | may it fail? | what it is for |
|---|---|---|
| **local** | freely | first contact; cheapest loop |
| **non-heartbeat workflow** | loudly, bounded | proves the mechanism under real CI without a tick at stake |
| **experimental arm** | **yes, by design** | continuous real exercise of a mechanism too risky for the base |
| **stable base** | no | only mechanisms that have already earned it elsewhere |

**Use the vocabulary that already exists.** Under `db/sims/` (verified present) and
`every-bug-has-economic-value`, a **`sim`** is ephemeral and a **`measure`** is committed and banks
ΔU. Concurrent experimental arms are **live `sim`s**; promoting an arm into the stable base is a
**`measure`**. The corollary is the guard: *an arm with no promotion or retirement criterion becomes
a permanent half-maintained fork* — neither experiment nor base, and it will quietly consume
maintenance forever. State the criterion when the arm is created, not when it is questioned.

### 0e. Arms are **failure isolation**, not decorrelation — and the egress rows are its prerequisite

Aaron, correcting an earlier framing of mine: *"for us the experiments is not necessarily the
decorrelation, it's the new code functions as expected but also gives the user a way to use the base
stable code if the experiment code is in a failure mode — this is like failure isolation not
decorrelation isolation."*

The correction matters and is recorded because I had it wrong:

| | **decorrelation** (what I first wrote) | **failure isolation** (what arms are for) |
|---|---|---|
| property class | **inference** — how much information N observers give you | **containment** — whose failure reaches the user |
| the objective | arm *diversity*; `N_eff = N/(1+(N−1)ρ)` | the arm's failure **does not reach the user**, and the stable base stays available |
| does arm count help? | barely — 10 near-identical arms ≈ 1 observation | **yes** — 10 near-identical arms are fine; each can fail alone |
| Beacon anchor | Condorcet / Dunnett–Sobel | **bulkhead · blue-green · canary** (Nygard, *Release It!*) |

So: **do not rank or design arms by diversity.** This is a deployment architecture, not an inference
one, and arms need not be diverse to be useful.

**The one place the two properties touch — and it is exactly this inventory's subject:**

> **Isolation is only as good as the independence of the failure modes.** If every arm *and the
> stable base* fetch `https://static.rust-lang.org/dist/channel-rust-1.87.0.toml` at setup, one
> upstream outage removes **every arm and the fallback at the same instant.** The isolation is
> nominal, not real.

That is not hypothetical: it happened twice today on a single environment (#10903, #10930).

**This reframes every egress row in this document, and it is a stronger argument than §13 alone.**
Pinning and caching shared external fetches is not hygiene and not merely a noninterference concern —
it is **the prerequisite for the fallback existing at the moment it is needed.** An arm architecture
built over shared, unpinned, uncached dependencies gives the *appearance* of a safe fallback while
sharing the exact fault that would remove it. Rows 1, 2 and 3 below should be read in that light:
they are load-bearing for the multi-environment direction, not preparatory tidying.

Corollary for whoever designs the arm system (flagged, not designed — that is someone else's
routing): **an arm's independence should be audited against the shared-egress inventory**, because
a shared unpinned fetch is a silent bulkhead breach and nothing in the arm's own configuration will
reveal it.

---

## 1. Ranking criterion

```
(§13 exposure closed) × (requirements-and-test value) × (substrate readiness) ÷ (blast radius)
```

A row with modest §13 exposure but high requirements value — it would force a stubbed substrate to
become real, then exercise it continuously — can outrank a row that merely closes a hole.

**Readiness verdicts used below**, and the honesty rule behind them
(`toy-is-free-metered-must-be-earned`):

- **READY** — verified by reading the code: it performs the real operation, has dependents, has tests.
- **PARTIAL** — real operation, but a named gap (no test, no pin, unexercised path).
- **STUB / FEATURE REQUEST** — the substrate does not do the thing yet. **A dogfooding row whose
  substrate is a stub is a feature request, not a switch.** Filing it as a switch is how a stub gets
  promoted silently.

**Honesty note on method.** Everything marked *verified* below was established by reading the file
at the cited line or by direct observation on this machine. Where I inferred from a name I say so.
This matters: today three of six "confirmed transports" moved no bytes, including one whose filename
says `transport`. Names lie; the imports do not.

---

## 2. The verified findings, ranked

### RANK 1 — Rust toolchain: `~/.rustup` is in **no cache path anywhere**

| | |
|---|---|
| **What we use** | `rustup` (via the mise rust backend), fetching `https://static.rust-lang.org/dist/channel-rust-1.87.0.toml` at job time |
| **What we have** | Nothing. Zeta has no Rust-toolchain substrate and should not build one. |
| **Readiness** | **N/A — this is NOT a dogfooding row.** The honest answer is **keep rustup; fix the cache.** |
| **§13** | Closes an ambient, unmetered egress dependency in the required gate's critical path |
| **Blast radius** | Cache-path change on `gate.yml` (required gate) + one-time cold run if the key is bumped |

**Measured cost, not hypothetical** (supplied by Otto, two occurrences in one working day):

- **#10903** — five consecutive download failures over ~4 min (14:31:20 → 14:35:08), surfaced as
  a failing `lint (TS)`.
- **#10930** — same URL, same failure, surfaced as a failing `lint (archive header §33)`.

**The sharp part, and it belongs in this inventory:** *an egress failure during setup is reported
under the name of a check that never executed.* The archive-header check did not run at all. A
reader triaging "archive header §33 failed" looks in entirely the wrong place. This is the same
shape as the vacuity findings of 2026-08-14 — **the label and the reality disagree** — and it is a
diagnosability cost stacked on top of the reliability cost.

**Root cause — verified, not inferred.** Otto asked whether retry/caching already exists and is
misconfigured. It exists, and it does not cover the toolchain:

1. `~/.rustup` appears in **zero** cache path lists across all 64 workflows. Verified by grep.
2. `~/.cargo` appears in **exactly one**: `gate.yml:1716`, in the `full-verify` job only. The
   `install-*`-keyed cache used by the lint jobs (`gate.yml:489-499`, `535-545`, `628-652`,
   `737-747`) lists `~/.local/bin/mise ~/.local/share/mise ~/.cache/mise ~/.dotnet/tools ~/.elan
   ~/.config/zeta` — **no rust path at all.**
3. Caching `~/.local/share/mise` does **not** capture Rust. Direct observation on this machine:

   ```
   ~/.local/share/mise/installs/rust/1.87.0 -> /Users/acehack/.cargo/bin     (symlink)
   ~/.local/share/mise/installs/rust/1.87.0  du -sh → 0B
   ~/.rustup                                 du -sh → 1.2G
   ```

   The mise rust install dir is **a symlink into `~/.cargo/bin`, holding zero bytes**; the actual
   1.2 GB toolchain lives in `~/.rustup/toolchains/`. So a "comprehensive" install cache restores a
   **dangling symlink** to a directory that is itself not cached.

4. **The existing mitigation is inert, and it is a vacuity-class defect.** `tools/setup/common/mise.sh:170-179`
   exports `RUSTUP_TOOLCHAIN` with this stated purpose:

   > *"Without the exact selection, rustc/rustup may refresh the channel manifest before using an
   > already-installed compiler, making an offline cache depend on static.rust-lang.org … exact
   > installed toolchains remain usable while the CDN is down."*

   The guard is correct and the intent is right. **Its precondition is never met**: there is no
   offline cache of `~/.rustup` for it to protect. A guard whose precondition never holds cannot
   fail, which is the defect class this repo spent 2026-08-14 removing.

**Recommended action (someone can do this tomorrow).** Add `~/.rustup` and `~/.cargo` to the
`install-*` cache path lists in `gate.yml` and bump the key prefix once (`install-v2-…`) so the
first run saves the new paths. Not free: one cold run per job. Worth it against two lost PRs in a
day.

**Requirements value:** low as dogfooding, **high as a specification of what an `ace` toolchain
mechanism would have to do** — namely own `RUSTUP_HOME`/`CARGO_HOME` placement so that "what the
manifest installed" and "what the cache restores" are the same directory. That mismatch is precisely
the class of bug a content-addressed store makes impossible by construction, and it is a real
requirement discovered by running, not by design.

**Degrade-don't-halt:** already violated. Setup failure hard-fails the job under another check's
name. Any fix should make toolchain-provisioning failure report *as itself*.

**Destination: stable base** — a fix to the base, not an experiment.

**And this row is the worked instance of §0e.** `static.rust-lang.org` is *shared, unpinned,
uncached egress on the setup path*. Every future experimental arm would inherit it, and so does the
stable base. On the next outage — the third today — an arm architecture would fail **arm and
fallback simultaneously**, which is the precise definition of a bulkhead that is not there. So
caching `~/.rustup` is not preparatory tidying for the multi-environment direction: **it is the
thing that makes the stable fallback survive the failure the arm was supposed to isolate.** That is
the strongest argument for this row and it should be the one carried to Aaron.

---

### RANK 2 — `curl -fsSL https://ollama.com/install.sh | sh` on a second cron lane

| | |
|---|---|
| **What we use** | `.github/workflows/mux-swarm-tick.yml:41` — pipe-to-shell from a third-party domain, hourly |
| **What we have** | `src/Core.TypeScript/ace/setup-realizers/from-ollama.ts` + `tools/setup/manifests/from-ollama` |
| **Readiness** | **READY, with two named gaps** (below) |
| **§13** | High. Replaces "execute whatever bytes a vendor domain serves, as root via the script's own `sudo`" with a declared, manifest-driven fetch of a GitHub release tarball into `~/.local` — no root, no arbitrary shell |
| **Blast radius** | **Live hourly cron lane — excluded by my constraints. Do not switch here.** |

**Not a duplicate of the worked example.** `agent-heartbeat.yml` is being pinned by another agent
right now and I did not touch it. `mux-swarm-tick.yml:41` is a **second, separate instance of the
same line** on its own hourly schedule, and as far as I can tell it is not in anyone's hands.

**Readiness — verified by reading `from-ollama.ts` end to end.** It is genuinely implemented, not a
stub: NixOS path (`nix build nixpkgs#ollama`, GC-rooted, LD_LIBRARY_PATH-clean wrapper), Linux
tarball path (`ollama-linux-<arch>.tar.zst` → `~/.local`), macOS deferral to the brew manifest,
daemon readiness polling, model-presence check, dry-run support. Every failure path warns and
returns success — **it already degrades rather than halts**, which is exactly the property a live
lane needs.

**Gap 1 — no digest pin, and that is a recorded operator decision, not an oversight.**
`tools/setup/manifests/from-ollama` states the runtime tracks *floating latest* because "the runtime
version does not affect DST reproducibility (the pinned MODEL + temp0 + seed do)." The **model** is
pinned (`qwen2.5:0.5b`). So the supply-chain gain from switching is real but **partial**: it is
*no-arbitrary-shell-execution*, not *byte-pinning*. Say the smaller true thing. Note the contrast —
`from-url` (`tools/setup/manifests/from-url`) makes `sha256=` **mandatory** and the realizer refuses
a row without one, with a first-hand justification: a GitHub release asset was re-uploaded under an
unchanged tag. `from-ollama` is the exception to a discipline the repo otherwise enforces.

**Gap 2 — the validation lane may not be exercising it, and this is the most valuable thing here.**
`accelerator-local-llm-validate.yml` exists to prove *"a BARE runner + `install.sh` ⇒ working
local-LLM substrate."* But:

- `from-ollama.ts:22` — `shouldSkipNonInteractive()` returns true when `!process.stdin.isTTY &&
  ZETA_INSTALL_FULL !== "1"`. GitHub Actions has no TTY.
- `accelerator-local-llm-validate.yml:47-52` runs `./tools/setup/install.sh` and **does not set
  `ZETA_INSTALL_FULL`** (verified: only `macos-install-sh-test`, `tlaps-proof`, and
  `wsl-install-sh-test` set it).
- The lane is `paths`-triggered and **last executed 2026-05-30** — 78 days ago, green at the time.

I am **not** claiming the lane is broken; I did not run it. I am recording that its central claim is
**unverified for 78 days**, and that the realizer's current guard reads as though it would skip.
One `workflow_dispatch` settles it. That is a 30-second check with a real answer at the end, and it
is precisely the "free test that quietly stopped being free" failure mode.

**Requirements value: the highest in this inventory.** A cron lane pulling ollama every hour is the
dependent that would specify `ace`'s unbuilt **download** piece — retry policy, partial-download
handling, cache-hit semantics, arch detection, disk pressure — from real behaviour instead of
guesswork. Two of `ace-cli.ts`'s five unbuilt items (**download**, **cross-PM wrapping** — this one
mechanism already spans nix, brew, and a raw tarball) get specified by one honest consumer.

**Degrade-don't-halt:** already satisfied by construction — every failure path in `from-ollama.ts`
warns and returns success, and downstream tests fall back to mock. This row is *safe by design* on a
live lane.

**Destination: non-heartbeat workflow → then experimental arm → then stable base.** Concretely:
(a) re-arm `accelerator-local-llm-validate` with `ZETA_INSTALL_FULL: "1"` and confirm green — this
is a **`sim`**, cheap and reversible; (b) run an arm of `mux-swarm-tick` using the realizer while the
current lane stays on `curl | sh` — the arm may fail without touching the tick, which is exactly what
arms are for; (c) promote to base once the arm has ticked cleanly for a stated interval. **Promotion
and retirement criteria, stated up front so the arm does not become a permanent half-maintained
fork:** promote when the arm completes N consecutive hourly ticks with the ollama binary present and
the model pulled; retire the arm the moment either the base adopts it or it has failed to meet that
bar for a stated window. Promotion is the **`measure`** — it banks the ΔU and the arm ends.

---

### RANK 3 — apt packages that bypass the declarative manifest

| | |
|---|---|
| **What we use** | A hardcoded `apt-get install` at `tools/setup/linux.sh:461`, and a raw one at `.github/workflows/bytelock.yml:70` |
| **What we have** | `tools/setup/manifests/apt`, parsed at `tools/setup/linux.sh:68-102` — the declared single source of truth |
| **Readiness** | **READY** — the manifest path is in production on every non-NixOS install |
| **§13** | Low-moderate: closes an undeclared entropy channel in provisioning |
| **Blast radius** | Small but **not negligible** — see §6 for why I declined to switch it |

**Verified state:**

- `tools/setup/linux.sh:458-462` runs `apt-get install -y --no-install-recommends wabt lua5.4
  golang-go`, bypassing `APT_MANIFEST` entirely.
- `wabt` is **also** declared at `tools/setup/manifests/apt:116` — so it is installed twice by two
  different mechanisms.
- `lua5.4` and `golang-go` are declared in **no manifest anywhere** (verified by grep across
  `tools/setup/manifests/`).
- `.github/workflows/bytelock.yml:70` installs `wabt lua5.4` with a raw apt call of its own, a
  third path to the same packages.
- The hardcoded line ends in `2>/dev/null || echo "⚠ … will show TOOLING-ABSENT"` — failure is
  swallowed and surfaces much later as a reduced substrate count.

**What closing it buys:** GOVERNANCE §24 three-way parity. Today a developer reading
`manifests/apt` does not learn that the byte-lock lane needs Lua — the requirement lives only in an
imperative line inside a 500-line shell script and in a workflow step. The Beacon term for the
defect is *declared desired state diverging from realized state*.

**A genuine conflict I am flagging rather than fixing:** `golang-go` is installed from apt while
`.mise.toml:29` pins `go = "1.26.4"`, and `bytelock.yml` states the Go WASM artefact **must** be
built with the mise-pinned Go because `wasm_exec.js` is version-coupled ("Bump both together or the
harness fails at boot"). Two Go toolchains provisioned by two mechanisms, one of them undeclared, in
a lane with a stated version-parity requirement. I have not verified which one wins on `PATH` in CI.
**This is the row to look at second, and it needs someone who can run the lane.**

**Requirements value:** moderate. It would specify `ace`'s **diamond-resolution** item — what
happens when two mechanisms claim the same package at different versions is exactly the diamond
problem, and `golang-go`-vs-mise-`go` is a live instance of it sitting in the repo right now.

**Degrade-don't-halt:** currently *over*-degraded (silent swallow). Moving these into the manifest
would flip them from soft-fail to hard-fail — better honesty, worse tick safety. That tension is the
reason for §6.

**Destination: experimental arm.** This is the row the arm destination genuinely unblocks. The
soft-fail→hard-fail flip is unacceptable on the required gate *as an unrehearsed change* and
perfectly fine on an arm, where a hard failure is information rather than an outage. Run an arm with
`lua5.4` + `golang-go` declared in the manifest and the hardcoded `linux.sh:461` line removed; the
arm answers the `golang-go`-vs-mise-`go` diamond empirically instead of by reading PATH order.
**Promotion criterion:** the arm's byte-lock lane executes the Lua and Go substrates (not
TOOLING-ABSENT) across a stated number of runs. **Retirement:** the moment base adopts, or the
diamond proves it needs a real resolution first.

---

## 3. Rows examined and honestly rejected

**These are findings, not shortfalls.** Aaron gets to see the tradeoff.

### 3a. `OracleTransport.fs` — FEATURE REQUEST, not a switch

`src/Core/OracleTransport.fs` declares `GitTransport`, `WebSocketTransport`, `ReticulumTransport`.
Verified by reading:

- `GitTransport.EmitAsync` (line ~184) — *"In production, this calls the GitHub REST git-data API …
  Here we write to a local path for testing."* It writes a file. **It pushes nothing.**
- `ReticulumTransport.EmitAsync` (line ~235-242) — *"In production, this calls the Reticulum Python
  API … For now, simulate the latency with a delay."* It is `Task.Delay`. **It moves zero bytes.**
- `WebSocketTransport` is real, but only because the caller injects `sendFn`.

Two of three named transports do not transport. **No dogfooding row exists here** — there is nothing
to switch *to*. This is a feature request, and naming it as one is the point: a row titled "route
oracle readings over our own transport" would read as a migration and is actually an unbuilt
feature.

### 3b. `discovery/gossip-mesh-transport.ts` — PARTIAL; a sibling's "genuinely ready" needs qualifying

Nine exports, verified by reading:

- `udpMeshTransport` (line 115) — **real**: `require("node:dgram")`, `createSocket`. Moves bytes.
- `reticulumSalonTransport` (171), `wsSalonTransport` (197), `broadcastChannelTransport` (225),
  `gitSalonTransport` (268) — **inversion-of-control shells**. `gitSalonTransport` is literally
  `publish: onPublish` — the caller supplies all git I/O.
- `multiplexTransport` (434) — fan-out over whatever it is given.

The IoC design is **correct** under §13 (the impure edge is injected, the module stays DST-clean),
so this is not a criticism of the design. But "six adapters" and "six working transports" are
different claims, and only one adapter contains I/O. **Also: the file has no `.test.ts`** (verified —
the directory has test files for nearly everything else). A six-adapter port with zero tests is
`unmetered`, not `metered`.

### 3c. Scheduling / async — **no row; the substrate is already dogfooded**

I looked for the failure the `async-all-the-way` rule predicts and did not find it. The only
`Task.Run` in `src/Core/*.fs` is `FerryThrottler.fs:103` — the ferry loop itself, which is the
prescribed pattern, not a violation. `DiskSpineAsync.fs:12`, `Durability.fs:243`,
`SoftChip8Scheduler.fs:17` all carry explicit no-`Task.Run` commitments. **Recording a clean axis is
part of an honest inventory**; padding the list here would have been churn.

### 3d. `ace-cli.ts` — the substrate that should *not* be dogfooded yet

`ace-cli.ts:12` declares its own five unbuilt pieces. Beyond that, verified by reading:
`graphMerkleRoot` (line ~64-78) is a **hand-rolled 32-bit rolling string hash** labelled *"STUB:
simple deterministic hash. Real: ZSetMerkle algorithm."* Routing a real install through it today
would produce a "content address" with ~4 billion possible values and trivial collisions — worse
than no integrity claim, because it *looks* like one.

**This is the load-bearing distinction of the whole inventory.** `ace` is two things:
`setup-realizers/` (READY, in production) and `ace-cli.ts` (STUB). "Route it through ace" means the
former. Saying "ace is ready" unqualified would be exactly the rounding-up this repo forbids.

---

## 4. Rows where the answer is "keep the external tool"

| Row | Where | Verdict |
|---|---|---|
| `yamllint` via `python3 -m venv` + `pip` | `gate.yml:583-584` | **Keep** — but note `from-uv-tool` exists (`manifests/from-uv-tool`, currently one entry: `ruff`) and is the declared mechanism for exactly this. Version is already pinned (`yamllint==1.38.0`). Moving it buys declaration consistency, not integrity. **Mostly aesthetic.** Small requirements value: a second entry would exercise the `from-uv-tool` manifest's untested multi-row path. |
| `kubeconform` via `go install …@v0.7.0` | `gate.yml:585` | **Keep.** There is **no Go mechanism** in `ace-mechanism-pointers.json` (17 mechanisms, verified — none is Go). Creating one for a single tool is speculative building, which is what §0a warns against. |
| GitHub Actions as the execution substrate | everywhere | **Keep.** Replacing it is not on the table, and under `itron-hub-patent-boundary` the honest reading is that Actions is a **hub** in the strict sense — mandatory routing, no exit for CI today — but the remedy is not a smaller hub of our own. Recording it as an acknowledged concentration is the correct treatment. |
| `mise` for language runtimes | `.mise.toml` | **Keep.** Battle-tested, already the declared single source of truth, already exercised on every install. Replacing it with an immature internal PM is the exact "dogfooding reduces reliability" failure. **This is the cautionary anchor for the whole list.** |

---

## 5. When each swap would be a **net loss**

Required by the discipline: state the loss condition per row so ranking is falsifiable.

| Row | This swap is a **net loss** if… |
|---|---|
| Rust cache | the added cache paths push the entry over the 10 GB repo cache limit and evict the mise/dotnet entries that work today — turning one flaky fetch into several. **Check cache sizes before merging.** |
| ollama → `from-ollama` | the realizer's silent-skip guard fires unnoticed and the swarm tick runs against a mock while *reporting* success. That is worse than today's loud `curl` failure — a green tick that verified nothing. **Mitigation must be an explicit post-install assertion, not trust.** |
| apt → manifest | a package is momentarily unavailable in a distro mirror and the manifest's single batched `apt-get install` hard-fails the whole install, where today's swallowed error only reduced the substrate count. **Soft-fail → hard-fail on the required gate.** |
| `ace-cli.ts` for anything | immediately and unconditionally — the 32-bit stub hash would replace a real integrity property with a decorative one. |

---

## 6. What I switched: **nothing** — and why that is the finding

The brief permitted **one** small, safe, verified switch. I evaluated two and declined both.

**Candidate A — add `lua5.4` to `manifests/apt`.** Additive, three lines, no removals. Declined:
the manifest path is a **single batched `apt-get install`** (`linux.sh:100-108`) that runs on every
non-NixOS `install.sh`, i.e. on ~8 gate jobs. Moving `lua5.4` there converts a **swallowed failure
into a hard failure of the required gate**. That is arguably the *correct* end state — a check that
cannot fail is not a check — but it is a reliability change to a required lane, and "additive diff"
is not the same as "negligible blast radius."

**Candidate B — add `~/.rustup` to the gate cache paths.** Highest value in the inventory, and I
still declined. The path addition alone is inert: `actions/cache` saves only on key miss, so with an
unchanged key an existing entry hits and the new path is never populated. Making it effective
requires a **cache-key bump**, which forces one cold run on every gate job. That is a deliberate,
reviewable change to the required gate — it deserves its own PR and its own reviewer, not a
drive-by inside an inventory.

Both candidates are on a **live required lane**. `tick-must-never-stop` cost 12 hours once. The
brief says shipping the inventory alone is the correct outcome rather than a shortfall, and I am
taking that at face value rather than manufacturing a change to look productive.

**Re-checked against the arm destination (§0d/§0e), because it changes the verdict shape.** Neither
candidate is *deferred* — both are **routed**:

- Candidate A → **experimental arm.** The soft-fail→hard-fail flip is exactly what an arm absorbs.
- Candidate B → **stable base, but as its own reviewed PR.** It cannot go to an arm, and that is
  the point of §0e: this fix is what makes an arm architecture's fallback real. An arm that shares
  the uncached `static.rust-lang.org` fetch with the base is not isolated from the failure that
  matters here.

So the honest summary is not "nothing was done" but "**two changes were routed to destinations that
are not this PR**," which is what the destination column is for.

---

## 7. Summary table

| # | Row | Substrate | Readiness | Class | §13 | Blast radius | **Destination** |
|---|---|---|---|---|---|---|---|
| 1 | rustup CDN fetch, uncached | *(none — external)* | N/A | **reliability fix, not dogfooding** | high | medium (required gate) | **stable base**, own PR |
| 2 | `curl \| sh` ollama, `mux-swarm-tick.yml:41` | `from-ollama.ts` | **READY** (2 gaps) | switch | high | high (live lane) | non-heartbeat wf → **arm** → base |
| 3 | undeclared apt (`lua5.4`, `golang-go`) | `manifests/apt` | **READY** | switch | low-mod | small-not-negligible | **experimental arm** |
| 4 | oracle transports | `OracleTransport.fs` | **STUB** | **feature request** | n/a | n/a | local |
| 5 | gossip mesh adapters | `gossip-mesh-transport.ts` | **PARTIAL** (1/6 does I/O, no tests) | feature request (tests) | low | none | local |
| 6 | any install via `ace-cli.ts` | `ace-cli.ts` | **STUB** | **feature request** | n/a | n/a | local |
| 7 | yamllint / kubeconform / mise / Actions | various | n/a | **keep external** | low | n/a | — |

**Note the shape of the destination column:** rows 1 and 3 are the two egress/provisioning rows, and
under §0e they are **prerequisites** for the arm architecture rather than consumers of it. Row 1
cannot be routed to an arm at all — an arm sharing the uncached fetch shares the fault.

**Act-on-it order for tomorrow:** (1) bump the gate cache key and add `~/.rustup` + `~/.cargo`;
(2) `workflow_dispatch` `accelerator-local-llm-validate` with `ZETA_INSTALL_FULL: "1"` to find out
whether the from-ollama free test is still free; (3) resolve the `golang-go`-vs-mise-`go` diamond
before touching the apt manifest.

---

## 8. Anchors (Beacon)

- **Goguen & Meseguer 1982**, *Security Policies and Security Models* — noninterference; §13 and the
  "declared, metered channel" framing throughout.
- **Thompson 1984**, *Reflections on Trusting Trust* — why pipe-to-shell from a vendor domain is a
  different risk class from a fetched-and-verified artefact, and why row 2's honest gain is
  *no-arbitrary-execution* rather than *byte-pinning*.
- **Dolstra 2006**, *The Purely Functional Software Deployment Model* (Nix) — content-addressed
  store; the anchor `ace`'s Z-set-delta model extends, and the standard against which
  `graphMerkleRoot`'s 32-bit stub is measured.
- **Hirschman 1970**, *Exit, Voice, and Loyalty* — the discriminator applied in §4 to GitHub Actions:
  exit, not degree, decides hub-vs-oracle.
- **Zhou et al. 2021**, *FoundationDB* (SIGMOD) — DST as environment-abstraction, which is exactly
  why it cannot supply §0b's non-deterministic tail.
- **Nygard, *Release It!*** (bulkhead, circuit breaker) + **Humble & Farley** (blue-green, canary) —
  the correct anchor class for §0e's experimental arms. **Not** Condorcet/Dunnett–Sobel: arms are a
  *containment* mechanism, not an *inference* one, and the earlier `N_eff` framing of them was
  wrong. `src/Bayesian/CondorcetBoundary.fs:78-86` remains the right anchor for the agent society's
  voting; it is the wrong one for deployment arms.

## 9. In-repo pointers

- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the READY/PARTIAL/STUB verdicts are that
  rule's three states; a stub named as a switch is silent promotion.
- `.claude/rules/dv2-data-split-discipline-activated.md` §7 — noninterference.
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — §4's Actions treatment.
- `.claude/rules/numerology-vs-number-theory.md` — "too many correlations is a warning": this
  inventory deliberately rejects four axes (§3c, §4) rather than reporting a gap everywhere it
  looked.
- `src/Core.TypeScript/ace/setup-realizers/` — the READY half of `ace`.
- `tools/setup/ace-mechanism-pointers.json` — the 17-mechanism registry; the coverage surface any
  future "is this install declared?" lint should read.
