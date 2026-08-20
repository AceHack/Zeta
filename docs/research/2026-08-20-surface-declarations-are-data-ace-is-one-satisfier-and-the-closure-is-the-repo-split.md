# Surface declarations are DATA — `ace` is one satisfier among many, and the closure is the repo split

**Status:** design note. No implementation, nothing measured. The architecture is argued; the
surface set itself is **deliberately not enumerated** (see §6).
**Date:** 2026-08-20 · **Driver:** Aaron · **Register:** Beacon where anchored, design elsewhere.

## 0. The carved invariant, in Aaron's words

> **"this list of deps is what's important — `ace` is just one thing that can satisfy it."**

Stated as the design rule it needs to be:

> **A surface declares WHAT it needs, as readable data in the repo. It never declares HOW to get
> it.** Any consumer — `ace`, a shell script, a human with `apt`, a Nix expression — reads the same
> declaration and satisfies it. The moment satisfying a declaration *requires running a particular
> tool*, that tool has become an appointed hub and
> [`clone-at-tag-stays-sufficient`](../../.claude/rules/clone-at-tag-stays-sufficient.md) is
> violated.

This is the discriminator that keeps `ace` an **oracle** (deference you chose, exit available) rather
than a **hub** (deference imposed, no exit) — the distinction from
[`itron-hub-patent-boundary-p2p-is-the-upgrade`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md),
where the test is **exit**, not degree of use. `ace` may become the *best* way to satisfy a surface
and accumulate any amount of use; it may never become the *only* way.

## 1. The evidence that the seam is missing

PR #12876 (Cursor Cloud Agent environment) adds a **new 150-line `.cursor/install.sh`** that
hand-copies **9 apt packages out of the canonical 34**, and re-declares the mise pin
(`MISE_PIN_VERSION="2026.6.12"`) already present at `tools/setup/linux.sh:426`, synchronised only by
a comment reading *"bump in lockstep."*

**Read charitably — and correctly — that is not drift, it is a missing abstraction surfacing as
duplication.** The cloud agent genuinely does not need the formal-verification proof stack; its
header says so and points at `tools/setup/install.sh` as canonical. It needed a way to declare a
*subset*, there was none, so it forked. **A fork is what a missing seam looks like from the
outside.**

Concretely today: four Yubico packages added to `manifests/apt` will never reach that environment,
and nothing will notice.

## 2. What already exists — one axis, never generalized

The split exists in miniature and has since workitem `081KTWQZY7F`: **`.mise.toml` +
`.mise.full.toml`**, merged when `MISE_ENV=full`, selected by the host-tier helper in
`tools/setup/common/mise.sh`. Its own rationale is exactly this problem —

> *"cluster nodes declare full at the zeta-install.sh call site regardless of hardware auto-detect;
> CI k8s lanes declare full explicitly; slim/standard hosts skip these."*

But it is **one axis (slim ⊂ standard ⊂ full), one manifest type (mise tools), one selector (host
tier)**. `manifests/apt` remains flat by design — *"Add a package by appending a line."*

## 3. Why "more tiers" is the wrong generalization

**A tier is a total order; surfaces are not.**

- a **cloud agent** needs .NET + bun, and *not* the proof stack
- a **proof lane** needs Lean + TLA+ + Alloy, and *not* the k8s tooling
- a **cluster node** needs the k8s tooling, and *not* necessarily either

**No two of those contain each other.** Tiers cannot express a partial order, so every non-nested
surface must either over-install (carry the union — the monorepo bottleneck, one level down) or
fork (what #12876 did). Both failures are already observed.

So the generalization is **named surfaces with declared sets**, and *tiers become one derived view*
— `full` is simply the union of the surfaces a cluster node plays.

## 4. The load-bearing connection: a surface set IS a dependency closure

This is why Aaron says the surface question and the repo split are the same question.

> **A surface's install set is a dependency closure. The repo split is driven by dependency
> closure. They are the same graph, queried twice.**

One query produces install manifests; the other produces repo boundaries. Which means:

- **The repo split becomes computable rather than argued.** You stop debating where the boundary
  goes and read it off the closure. That matters given
  `user_aaron_monorepo_union_of_everything_is_the_bottleneck` — the union is precisely what a
  surface declaration stops you from paying for.
- **And the split acquires a falsifier it currently lacks:** if two proposed repos have
  *overlapping* closures, the boundary is wrong — checkable, not a matter of taste. If a surface's
  closure spans two proposed repos, either the split or the surface is mis-drawn.

That second point is the reason to build declarations *before* finishing the split, not after.

## 5. The guard, stated so it can be enforced

Two mechanical consequences follow from §0, and both are small:

1. **`.cursor` must join `BOOTSTRAP_SURFACES`** in
   `src/Core.TypeScript/hygiene/lint-clone-at-tag-is-sufficient.ts`. That list is currently
   `["tools/setup", ".github/workflows", <build props>, "flake.nix"]` — it predates `.cursor`, so
   the omission is an accident rather than a decision. Without it, the newest bootstrap surface is
   the one place `ace` could quietly become mandatory.
2. **The declaration must be inert.** A surface file that is *executed* to learn what it needs has
   already failed the rule; it must be readable without running anything. The natural falsifier is
   the honest one the clone-at-tag rule already names: **clone at a tag on a machine with no `ace`
   on `PATH`, read the declaration, satisfy it by hand, and build.**

## 6. The enumeration heuristic — one surface per language CLI (Aaron)

Asked for the surface set, Aaron 2026-08-20:

> **"imagine each cli based on each computer language — this is roughly the most enumerated
> surfaces if we tried to enumerate."**

That is a *generating rule*, not a list, which is what makes it usable: the surfaces are **the
per-language toolchains**, and the upper bound on how finely you would ever split is one surface per
language CLI.

**And that enumeration already exists — in the CI job matrix.** These are current job names, not a
proposal:

`lint (TS)` · `lint (Rust)` · `lint (Go)` · `lint (Python)` · `lint (C#)` ·
`Analyze (java-kotlin)` · `Analyze (javascript-typescript)` · `Analyze (csharp)` ·
`Analyze (python)` · `Analyze (go)` · `full-verify (7-lang oracle + cost + proofs)` ·
`cross-verify (trust-core oracles + ace suite)`

plus the six byte-lock substrates named in
[`no-binary-in-proof-lineage`](../../.claude/rules/no-binary-in-proof-lineage.md) —
`dla-canonical-{wat,llvm,emcc,rust,asc,zig}` — and the "no oracle = fail" roster in
`src/Core.TypeScript/ci/cross-verify-all.ts`.

**So the surfaces are already declared. They are just declared as job names rather than as data, and
nothing reads them.**

### 6a. The over-install cost is not hypothetical — it was today's most expensive failure

Every one of those per-language jobs runs the **same shared install step**, so a job that needs only
Go still installs .NET, Lean/elan, the TLA and Alloy jars, and the rest of the union. That is the
monorepo bottleneck reproduced inside CI.

It is measurable because it *failed*, repeatedly, on 2026-08-20. Jobs observed failing at the step
**"Install toolchain via three-way-parity script"** with `exit 124` (timeout) across three separate
PRs included `build-and-test (ubuntu-24.04)`, `lint (tick-history order)`, `lint (no conflict
markers)`, and — on #12361 — a wall of thirteen spanning `lint (Rust)`, `lint (Go)`, `lint (Python)`,
`lint (markdownlint)`, `lint (semgrep)` and `cross-verify`. Each cleared on a plain retry.

> **A single-language lint timing out while installing the other six languages' toolchains is the
> union cost, priced, in wall-clock, on the critical path of every PR.**

**Honest limit, because this is the tempting over-claim:** the failures are consistent with a stalled
archive mirror, and `linux.sh` itself names that as the expected cause. What is *established* is that
the cost structure is union-shaped and paid per job; what is **not** measured is how much a
per-surface install would actually save, or whether it would have prevented these specific timeouts.
That measurement is the obvious first falsifier once one surface is declared.

### 6b. Not-deciding is the METHOD — and the repo split is the one place it breaks

An earlier draft said the surface list comprises "decisions Aaron has not made," which framed
deferral as an omission. Aaron 2026-08-20 corrects that, and the correction is the more useful half:

> **"the repo tried not to make decisions and only make separate towers instead that can be chosen
> at runtime. repo split is one of those that forces a decision or else you are monorepo like we
> are — we can test out different variations."**

So deferral is not a gap here, it is **the design method**, and it is the same move recorded
elsewhere in this repo under several names: the Multi-Oracle Principle (no single mandatory
morality), free-object-over-quotient (do not commit to a special case, generate it), interfaces-free
/ classes-earned, and *defer the commitment when structure is discovered*. Build towers; choose at
runtime; commit to nothing you can keep plural.

**The repo split is the exception, and it is worth naming exactly why.** Towers coexist — a surface
declaration for Go and one for Lean can both be true at once and be selected per job. **A repo
boundary cannot.** Either a file is in one repo or another; there is no runtime selection over
directory layout. The split is **exclusive, one-way, and expensive to reverse** — the only structure
here that refuses the method outright.

And crucially, **abstaining is not neutral in this one case**: not-deciding *is* deciding, and what
it decides is **monorepo** — which is precisely the union-of-everything bottleneck
(`user_aaron_monorepo_union_of_everything_is_the_bottleneck`), now visible in CI as §6a's per-job
union cost. Everywhere else deferral is free; here it has a running price.

**Which is what surface declarations are actually for.** If a surface's needs are data, then a
candidate split is a **query over the closure**, not a migration:

> **You evaluate split variations by computing them, and you only move files once.**

That restores the method's central property — *stay plural until you must commit* — to the one
structure that otherwise denies it. It is Aaron's "we can test out different variations" made
mechanical, and it is why declarations should come **before** the split rather than after: they turn
an irreversible decision into a reversible experiment right up until the moment files move.

Note the shape: the split is **declared** structure (someone must commit to it), while a closure is
**discovered** (computed from the graph). So the move is to *declare surfaces in order to discover
the split* — rather than declaring the split and discovering afterwards whether it was right.

### 6c. What this note still deliberately does NOT do

**It does not commit to the surface list.** A generating rule is not a roster: which languages get
their own surface, whether `markdownlint` and `semgrep` are surfaces or shared infrastructure, and
where the proof stack sits remain open — and per §6b they can *stay* open, because surfaces are
towers. A plausible-looking list invented here would be exactly the failure this repo keeps
catching: a confident artifact standing in for a decision nobody made.

Nothing here is measured. There is no implementation, no manifest format, and no claim that the
closure is currently computable — `user_aaron_incremental_dependency_tracking_is_the_mental_model_wall`
records that the increment graph is precisely what neither humans nor LLMs hold, which is the
argument for externalizing it and also the reason not to pretend it already is.

## Pointers

- [`clone-at-tag-stays-sufficient.md`](../../.claude/rules/clone-at-tag-stays-sufficient.md) — the rule this operationalizes; `ace` as resolver is refused in bootstrap surfaces
- [`itron-hub-patent-boundary-p2p-is-the-upgrade.md`](../../.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md) — oracle vs hub; **exit** is the discriminator
- `.mise.toml` / `.mise.full.toml` + `tools/setup/common/mise.sh` — the existing one-axis split (`081KTWQZY7F`)
- `tools/setup/manifests/` — the flat manifests a surface layer would sit over
- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — the split whose boundaries §4 would make computable
- `docs/research/2026-08-19-repo-split-round-*` — where the dependency-closure argument was measured out
- PR #12876 — the fork that is evidence for §1

---

## 7. MEASURED on one surface — and it adjudicates §4 against this note

§6 said the enumeration is "one surface per language CLI" and §4 claimed the closure makes the repo
split *"computable rather than argued."* One surface was then traced end to end. The result supports
the framing and **refutes the central claim as stated**.

*(Result: the surface-closure agent, 2026-08-20. Deriver + 11 passing tests at
`src/Core.TypeScript/ci/derive-job-closure.ts`; re-run before landing.)*

### 7.1 `lint (Go)` needs 6 units. It is provisioned ~442.

Chosen because it is measurably the narrowest: `lint (Go)` and `lint (Python)` are byte-identical
jobs in `gate.yml` differing only in the leaf script, and Python's leaf pulls a 22-package `uv.lock`
while Go's pulls 4 modules / 1.6 MB.

| provisioned | count | needed |
|---|---:|---:|
| apt packages | **34** | **3** (`curl`, `ca-certificates`, `git`) |
| mise tools | **18** (23 at tier=full) | **3** (`go`, `golangci-lint`, `bun`) |
| dotnet SDK + global tools | 1 + **7** | 0 |
| npm packages (`bun install`) | **377** | 0 |
| elan / Lean · uv-tool · agda cubical · **E prover built from source** | 4 | 0 |

Measured work: `golangci-lint run ./...` = **10.0 s, 0 issues, cold caches**. Job timeout: 15 min.

### 7.2 It is NOT a strict subset — the "surfaces ⊆ union" model is false at N=1

The Go module graph is a **needed** dependency that `install.sh` does not provide and **no manifest
declares**. Verified both directions: `GOPROXY=off` → *"module lookup disabled"*; `GOPROXY=on` →
1.6 MB fetched. Nothing in `tools/` or `gate.yml` prefetches it, and the cache path list contains no
`~/go/pkg/mod`.

> **Language-native registries (`go.mod`, `bun.lock`, `uv.lock`, NuGet) are a fifth dependency
> category the surface model as sketched does not cover.** A declaration that only names apt/mise
> units would be *incomplete for every language surface*, silently.

### 7.3 §1's fork is not the first — four gate jobs already forked, inside `gate.yml`

The note used PR #12876's `.cursor/install.sh` as evidence of a missing seam. There is an older,
in-repo instance, and it states its own reason:

> `lint (actionlint)`: *"This job installs only actionlint instead of running the full install.sh
> bootstrap; otherwise apt proof/QEMU/R substrate can consume the timeout before actionlint itself
> runs."*

It then `go install`s actionlint, duplicating `.mise.toml`'s pin. `lint (yaml/k8s)` hand-rolls a
venv + `pip install yamllint==1.38.0` + `go install kubeconform@v0.7.0`, duplicating pins in **both**
`.mise.toml` and `.mise.full.toml`. Two more "bump in lockstep" pairs. A **fifth** mechanism exists:
five jobs use `setup-bun@v2` with no `bun-version`, so they get latest rather than `.mise.toml`'s
`bun = "1.3"`.

**`gate.yml` already diagnoses the whole class in a comment** — *"It needs a JS runtime and nothing
else, yet installs an entire toolchain to get one."* The seam has been missing long enough that the
canonical CI file forked from itself, four times, with reasons written down.

### 7.4 Two costs nobody is choosing

- **Every gate job installs Claude Code and Codex.** `from-bun-global` runs
  `bun install --global @anthropic-ai/claude-code @openai/codex` with **no CI guard**, while its
  siblings (`from-installer`, `from-ollama`, `from-opam-git`, `from-uv-venv`) all skip on non-TTY or
  without `ZETA_INSTALL_FULL=1`.
- **Every gate job compiles E prover 3.2.0 from source.** `from-autotools-tarball` runs
  `./configure && make -j`. The gate caches the **tarball**, not the built binary. This already cost
  the fleet: **PR #11486 (2026-08-17)** — three unrelated PRs went red on
  `lint (tick-shard relative-paths)` because GitHub 429'd the eprover tarball. **A bun-only lint job,
  killed by a first-order-logic prover.**

### 7.5 Derivability is about INVOCATION SHAPE, not language — and §4 is not yet true

The deriver was run against all 29 gate jobs. **`lint (Go)` is the only one with an empty
`unresolved` set.**

| job | derived | actual | why it fails |
|---|---|---|---|
| `lint (Python)` | `bun, uv` | `+ python, ruff, mypy` | `ruff`/`mypy` are **arguments to `uv run`** |
| `lint (Rust)` | `bun` | `+ rust, cargo` | dynamic spawn |
| `lint (TS)` | `bun` | `+ node, tsc` | `tsc` lives in `node_modules/.bin` |

> **A closure is derivable exactly when the leaf spawns literal command *heads*.** The moment a tool
> is invoked *through* another (`uv run X`, `dotnet X`, `mise exec -- X`, `npx X`), head-scanning
> goes blind — **and silently**, which is the dangerous direction.

The deriver reports those as `unresolved` rather than under-claiming, and its tests pin the Python
shortfall **as an assertion** so it cannot quietly become a claim.

**So §4's *"the repo split becomes computable rather than argued"* is NOT yet true.** The honest
correction, and the useful part:

> It is **not blocked on effort or on a smarter parser — it is blocked on a missing declaration.**
> `build-graph.json` + `affected-legs.ts` already declare **files → jobs** as data, explicitly
> "derived from the graph at run time, never hand-maintained." The inverse edge, **jobs → tools**, is
> declared **nowhere** — and the four already-forked gate jobs are what a missing edge looks like
> from outside.

The move is therefore **one declared field per job**, checked against a deriver like this one so the
declaration cannot drift from what the job actually runs. That is the same
declaration-plus-falsifier shape the repo already uses everywhere else, and it is what §0's
"declaration is data" buys once it exists.

### 7.6 Where the closure stays undecidable

Named rather than guessed: **host tier is a runtime property** (`host-tier.sh` reads the runner's
RAM; the gate lint jobs declare no `ZETA_HOST_TIER`, so whether 7 dotnet tools install cannot be read
out of the tree); **best-effort realizers change the set by succeeding or failing** (a network hiccup
silently subtracts, exit 0); **conditional realizers key on what earlier steps installed**
(`from-agda-cubical` runs iff `agda` is on PATH, true only because it is in `manifests/apt`); and
second-hop spawns through imported modules are unreadable.
