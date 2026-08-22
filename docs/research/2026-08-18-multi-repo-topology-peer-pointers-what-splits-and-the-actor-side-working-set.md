# Multi-repo topology: what already exists, what the measurements say splits, and an actor-side pointer that is not a submodule

**Date:** 2026-08-18
**Author:** Kenji (architect hat)
**Register:** Beacon (outward-facing; anchors named and checked)
**Extends:** `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`, `docs/DECISIONS/2026-05-14-product-repo-glue-mechanism.md`, `docs/DECISIONS/2026-05-14-product-repo-split-decisions.md`
**Work-items:** 081KRFA460008QG0R001H98EXJ, 081KRFA460008QG0R003JQ46J4, 081KRFA460008QG0R0007RWSN1, 081KRFA460008QG0R000VKJF0H
**Does NOT cover:** cross-repo scheduling / resource-time-sharing (owned separately). Topology and pointers only.
**Not a migration.** No file moves, no repo creation, no ruleset edits are proposed for execution here.

## The one-line summary

> The repo-to-repo question was already answered twice and does not need reopening: **peer repos,
> version-pin files, no submodules.** The question that is genuinely open is a *different object* --
> the **actor-side working set** (which repos does this agent hold, and how does it verify them),
> which no existing artifact specifies. This doc specifies it, measures which cut the split should
> make first, and enumerates what breaks. The measurements disagree with each other, and that
> disagreement is the design content.

---

## 1. What already exists (read before proposing)

Five artifacts carry prior decisions. Status verified against `origin/main` and the live GitHub API on
2026-08-18, not assumed.

| Artifact | Status | What it decided |
|---|---|---|
| ADR `2026-04-22-three-repo-split-zeta-forge-ace.md` | **Proposed** (never moved to Accepted) | Three **peer** repos Zeta / Forge / ace. **Submodules rejected**: the triple is a dependency *cycle* and a submodule DAG cannot express a cycle. Connection = git tags + `.forge-version` pin file + `repository_dispatch` + docs cross-links, with `ace` as eventual mediation. Ownership model (Forge is Claude-governed; Zeta/ace Aaron-governed). A full what-moves-where table. |
| 081KRFA460008QG0R001H98EXJ Stage 1 | **open**; tool built, dry-run verified 2026-05-14 | Create `LFG/Forge` + `LFG/ace` with day-one scaffolding. `tools/scaffold/create-repo.ts` produces 12 planned operations per repo. `--apply` is gated on Aaron (irreversible). **Neither repo exists today** (verified: `gh repo list Lucent-Financial-Group`). |
| ADR `2026-05-14-product-repo-split-decisions.md` | **Accepted** | civsim repo-ready now; KSK/Aurora/AD2.0/DIO/Wellness later; Dawn stays in the monorepo. |
| ADR `2026-05-14-product-repo-glue-mechanism.md` | **Accepted** | Staged glue: Stage 1 `.zeta-version` pin file, Stage 2 NuGet references, Stage 3 `ace.toml` + lockfile. Product repos are **consumers**, not peers. |
| 081KRFA460008QG0R0007RWSN1 (Mirror/Beacon axis) and 081KRFA460008QG0R000VKJF0H (code/English + formal-verification + ruleset-divergence smell) | **decomposed**; both terminal ADR rows (081KRHWGX0008QG0R0023FDYVE, 081KRHWGX0008QG0R0023DWW8D) **never landed** | Axis 2 and Axis 3 of a three-axis design space. No ADR file exists for either. |

Plus two design surfaces that are not decisions but are load-bearing:

- `docs/writer-actor-routing-model.md` -- clone-per-writer, persona = owner ("what remains") vs
  actor = clone/loop ("what acts"), the OSHost `~/.zeta/persona/<persona>/<surface>/<instance>/`
  layout, and the **sovereignty horizon**: a persona that differentiates graduates to *its own repo*,
  joined to the society by clockless cross-heartbeat.
- `docs/research/2026-06-15-the-zeta-society-architecture-consolidated-*.md` **section 9h** -- the
  multi-repo join has already been given its theory: **no global GSet, no global now**, per-frame
  state reconciled by causal (parent-hash) order and CALM-monotone merge. This is the constraint the
  pointer design must not violate.

### 1.1 What the prior work settled, and what it left open

**Settled, do not relitigate:** peer repos over submodules; pin-file glue; product repos as consumers;
staged migration to `ace` lockfiles; the ownership model.

**Open, and it is precisely Aaron's question:** every existing artifact describes a **repo-to-repo**
pointer -- a dependency pin that lives *inside* a repo and is part of that repo's build identity.
Nothing describes an **actor-to-repo** pointer -- the set of repos a given agent currently works on,
which lives on the *host*, belongs to the *clone*, and must never enter shared history. Conflating
those two is the mistake this doc exists to prevent.

### 1.2 The executed split already failed the gate test -- measured, not predicted

civsim was created 2026-05-14 under the accepted ADR. Today:

- `LFG/civsim` contents: `.claude`, `.zeta-version`, `CONTRIBUTING.md`, `LICENSE`, `README.md`.
  **No `.github/` at all** -- no workflows, no CI.
- `gh api repos/Lucent-Financial-Group/civsim/rulesets` returns **empty**. No branch protection,
  no `gate (required)`, no Branch Safety, nothing.
- `.zeta-version` contains the bare 40-hex SHA `eaea0682bd50344404c975e9d8eac4bb95e2c2bc`. That commit
  is real (it is the ADR-landing commit, 2026-05-14) and `origin/main` is now **10,075 commits ahead
  of it**. Nothing has ever bumped it, because nothing reads it.

Three failures in one artifact, and each is a named failure class in this repo:

1. **The gate was stranded.** A repo created with no ruleset and no CI is not "lightly governed", it is
   ungoverned; the scaffolding checklist that would have prevented this exists and was not applied.
2. **The pin is inert** -- a check that nothing consumes. That is the vacuity class: it looks like
   compliance and constrains nothing (see `no-binary-in-proof-lineage` condition 2 for the same shape
   stated for golden vectors).
3. **The pin is unverifiable.** Forty hex characters with no repo, no algorithm, no tree identity.
   You cannot tell from the file which repo it names or whether the checkout matches it. A pointer
   that cannot be verified is a trust assumption.

This is the strongest single argument for specifying the pointer mechanism properly before any further
split, and it is evidence rather than opinion.

---

## 2. What splits, and by what criterion

Aaron names three axes -- projects, languages, agents. DV2.0 says split by **change rate**. The
cache measurement says split by **toolchain**. The repo's own prior work adds a fourth: the
**ruleset-divergence smell test** (081KRFA460008QG0R000VKJF0H). They do not agree, and pretending they
do is how a migration ends up delivering nothing measurable.

### 2.1 The measurements

All figures taken 2026-08-18 against `origin/main` and the live API.

**Substrate size and change rate** (`git ls-files`, and `git log --since="30 days ago" --name-only`):

| Top-level | Tracked files | 30-day file-touches | Working-tree MiB |
|---|---:|---:|---:|
| `docs/` | 25,383 (70%) | 15,178 (63%) | 198 |
| `src/` | 3,372 (9%) | 3,379 | 59 |
| `memory/` | 1,949 | 250 | 40 |
| `data/` | 957 | 2,835 | 5 |
| `tests/` | 1,118 | 320 | 9 |
| `workitems/` | 712 | 784 | 4 |
| **total** | **36,308** | ~24,000 | ~330 (pack 465 MiB) |

Inside `docs/`, the mass is not prose:

| Path | Tracked files | 30-day touches | What it is |
|---|---:|---:|---|
| `docs/github/` | 8,256 | 8,338 | PR archive lane (machine-generated) |
| `docs/history/` | 8,257 | 2,346 | history/telemetry (machine-generated) |
| `docs/observe-events/` | 2,324 | 2,850 | event stream (machine-generated) |
| `docs/research/` | 1,719 | 640 | human/agent prose |
| `docs/backlog/` | 1,140 | (counted in workitems row) | work rows |
| `docs/drift-events/` | 248 | 252 | machine-generated |

**Machine-generated telemetry and archive is ~19,100 files and ~13,800 touches per 30 days -- about
57% of all file-touches in the repo.** By file extension: 17,655 `.md`, 12,621 `.json`, 2,675 `.ts`,
1,309 `.fs`, 331 `.cs`.

**Actions cache** (`gh api .../actions/cache/usage` and `.../actions/caches`):

- `active_caches_size_in_bytes` = 10,564,816,213 (**10.56 GB against a 10 GiB per-repository cap**),
  `active_caches_count` = 16.
- The cache *listing* returns 46 entries totalling **16,759 MiB** -- the usage endpoint lags the list,
  so treat 10 GiB+ as the floor of the problem, not the ceiling.

By toolchain family:

| Family | MiB | entries | Ecosystem |
|---|---:|---:|---|
| `dotnet-*` (SDK) | 5,593 | 8 | .NET |
| `mise-*` (runtime manager) | 3,999 | 5 | polyglot installer |
| `nuget-*` | 1,815 | 5 | .NET |
| `install-v2-*` / `full-install-*` | 2,977 | 2 | installer integration tests |
| `codeql-dependencies-*` | 940 | 5 | security scanning (Go extractor) |
| `Linux-*` | 837 | 10 | misc |
| `2:distributionDirectory_Ubuntu_24.4.4` | 371 | 1 | installer |
| `determinatesystems-*` (Nix) | 172 | 4 | installer |
| `bun-*` | 34 | 1 | TypeScript |
| `elan-*` (Lean) | 21 | 5 | formal verification |

**.NET is 7,408 MiB (44%). The polyglot installer surface is 7,519 MiB (45%). TypeScript is 34 MiB
(0.2%). Lean is 21 MiB (0.1%).**

**Rulesets** (`gh api .../rulesets`): four active on Zeta -- `Default`, `Branch Safety`, `CI Gate`
(requires exactly one context, `gate (required)`, integration_id 15368, on `~DEFAULT_BRANCH`), and
`Heartbeat Branch Protection` (targets `refs/heads/heartbeat/*`, rule: `deletion` only).

**Coupling:** 150 occurrences of the literal `Lucent-Financial-Group/Zeta` across `.ts` and `.yml`.

### 2.2 What each criterion selects as the first cut

| Criterion | Metered? | First cut it selects | Evidence |
|---|---|---|---|
| **DV2.0 change rate** | yes | **machine-generated telemetry/archive vs everything else** | 57% of all file-touches; 19,100 of 36,308 files; the fastest-changing cluster by an order of magnitude over `src/` |
| **Cache / toolchain footprint** | yes | **language**: .NET apart from the polyglot installer surface | 44% and 45% of cache; TS and Lean are rounding errors |
| **Ruleset divergence** (the repo's own smell test) | yes | **telemetry lane** -- `heartbeat/*` already carries a disjoint ruleset with different rules from `main` | 4 rulesets, 1 already ref-disjoint |
| **Aaron's axes** (projects / languages / agents) | partly | projects (civsim, KSK...) already begun; languages agrees with cache | governance and legibility; not directly metered |

Three of four criteria have a metered cost today. **Two of them (change rate, ruleset divergence)
select the telemetry lane. One (cache) selects language.** Projects, the axis already executed, moves
neither number: splitting civsim out removed approximately zero cache and approximately zero
change-rate load.

### 2.3 Why they disagree -- and the third option

They disagree because a repository is one mechanism being asked to serve three separable jobs:

- **change rate** answers *what should be STORED separately* (DV2.0 hub / link / satellite);
- **toolchain footprint** answers *what should be BUILT separately* (the CI quota is per-repository);
- **projects / agents** answer *what should be GOVERNED separately* (ownership, ruleset, forkability,
  who may fork what).

Stated that way there is no conflict to resolve and no winner to pick. The criteria are **orthogonal
and simultaneously applicable** -- which is what the existing three-axis substrate already says
(`default-to-both`), and this doc is the first time the axes have numbers attached.

The practical ordering rule that falls out:

> **Cut first where the cost is metered and currently being paid. Record the other axes as ordering,
> not as veto.**

By that rule the order is: (1) telemetry/archive out -- biggest change-rate and clone-size payoff,
already ruleset-divergent, near-zero cache payoff; (2) the toolchain/language cut -- the only cut that
moves the cache number; (3) governance/product cuts as products reach readiness, which is the existing
accepted ADR and needs no new decision.

That ordering is a recommendation. The choice of first cut is Aaron's (section 6, item 1).

### 2.4 The cache arithmetic, honestly -- what a split does NOT fix

The duplication visible in the cache list is **per-ref, not per-content**:

```
1858 MiB  refs/pull/12036/merge  dotnet-macOS-ARM64-8362568aa387d10c...
1858 MiB  refs/pull/12004/merge  dotnet-macOS-ARM64-8362568aa387d10c...   <- identical key
 825 MiB  refs/pull/12035/merge  mise-Linux-X64-1e378247491f3eee...
 825 MiB  refs/pull/12034/merge  mise-Linux-X64-1e378247491f3eee...       <- identical key
```

The keys are content-derived (`hashFiles('global.json', ...)`, `hashFiles('.mise.toml', ...)`), so
identical keys under different refs are the *same logical artifact stored N times*. GitHub scopes a
cache written on a PR branch to that branch; only default-branch entries are shared by all branches.
So footprint is approximately

```
footprint  ~  (number of in-flight PRs that MISS)  x  (per-PR toolchain set)
```

with the concurrency, not the repo content, as the multiplier. At ~30 runs in flight that multiplier
is doing most of the damage.

Consequences that must be stated before anyone claims the split fixed this:

1. A split **does** help, twice over: the 10 GiB cap is per-repository, so K repos means K x 10 GiB of
   quota, *and* each repo carries a smaller toolchain matrix. Both effects are real and they multiply.
2. A split **does not** remove the concurrency multiplier. Each new repo re-approaches its own ceiling
   at the same PR concurrency.
3. Therefore the split is **necessary but not sufficient**. The co-fix is a workflow change, not a
   topology change: PR jobs restore from the default-branch cache and do not *save* on PR refs (or save
   only from `main`). That is a small edit to the cache steps in `gate.yml` and it is independent of
   every decision in this document.

**Falsifiable prediction.** For the language cut, using today's measured per-family sizes and today's
concurrency:

| Proposed repo | Toolchain families it carries | Predicted footprint | Headroom vs 10 GiB |
|---|---|---:|---:|
| Zeta core (F#/C#) | dotnet + nuget | ~7.4 GiB | 26% |
| installer / platform | mise + install-v2 + determinatesystems + distributionDirectory | ~7.5 GiB | 25% |
| TypeScript / tooling | bun + codeql | ~1.0 GiB | 90% |
| telemetry / archive | bun only | ~0.03 GiB | 99.7% |
| formal verification | elan (+ tlaps tarball) | ~0.1 GiB | 99% |

So the honest claim is: **the split alone takes the worst repo from 103% to ~74% of quota. That is an
improvement and not a solution.** With the per-ref save fix as well, the worst repo should land near
20-30%. Both numbers are checkable afterwards, which is the point of writing them down now.

Note the second row: the installer/platform surface is as large as .NET. If the split is made by
language but `install.sh` stays shared and installs the full polyglot matrix in every repo, **every
repo inherits the 7.5 GiB installer footprint and the split delivers nothing.** Making the installer
profile-aware is a precondition of the language cut, not a follow-up to it.

---

## 3. The pointer mechanism

### 3.1 Two pointer kinds -- the distinction is the design

| | **Dependency pin** (repo -> repo) | **Working set** (actor -> repos) |
|---|---|---|
| Question | "which version of that repo is this build made against?" | "which repos does this agent hold right now?" |
| Lives in | the repo, versioned, in shared history | the host, beside the clone, never committed |
| Scope | one per consuming repo | one per actor (clone / loop / ticksource) |
| Status | **decided** -- `.zeta-version` / `.forge-version`, staged to `ace` lockfile | **this document** |
| Failure if misplaced | unreproducible builds | a global frame smuggled into shared history |

Putting the working set into a repo would make one repo's checked-in list authoritative over the others
-- an **appointed hub**, forbidden by `itron-hub-patent-boundary-p2p-is-the-upgrade` and manifesto
section 1. It would also re-import a global "now" over what are genuinely per-frame views, which
section 9h rules out. Putting the dependency pin on the host would make builds unreproducible. The two
must not be merged into one file, however tempting the economy looks.

### 3.2 The working-set pointer, concretely

**Location.** Beside the actor's clone root, on the OSHost:
`~/.zeta/persona/<persona>/<surface>/<instance>/peers.json`. It is host-local by construction, it never
travels, and it is exactly the "what acts here" half of the OSHost / `memory/` duality already
canonicalized in `docs/writer-actor-routing-model.md`.

**Format.** Canonical JSON via the existing `src/Core.TypeScript/ace/canonical.ts` -- not a new
serialization. Natural key is `name`; duplicate names are a parse error.

**Entry:**

```ts
export type PeerRole = "write" | "read" | "cite";

export type PeerPin =
  | { readonly kind: "commit"; readonly sha: string }
  | { readonly kind: "tag"; readonly name: string; readonly sha: string }
  | { readonly kind: "floating"; readonly ref: string };  // declared-unpinned, never silently so

export interface PeerPointer {
  readonly name: string;       // natural key, unique in a working set: "zeta", "forge", "civsim"
  readonly remote: string;     // fetch URL; host-agnostic, classified by forge-host/detect.ts
  readonly role: PeerRole;     // least privilege at the pointer layer
  readonly pin: PeerPin;
  readonly path?: string;      // host-local checkout; absent = known-of but not held here
  readonly content?: string;   // "blake3:<hex>" -- the verifiable identity, see 3.3
}
```

**Resolution is a total function into an explicit state, never a boolean:**

```ts
export type PeerState =
  | { readonly kind: "resolved";   readonly pointer: PeerPointer; readonly headSha: string }
  | { readonly kind: "stale";      readonly pointer: PeerPointer; readonly headSha: string }
  | { readonly kind: "diverged";   readonly pointer: PeerPointer; readonly headSha: string }
  | { readonly kind: "missing";    readonly pointer: PeerPointer }
  | { readonly kind: "unverified"; readonly pointer: PeerPointer;
      readonly expected: string;   readonly actual: string };

export interface PeerResolver {          // an interface: no instance state, nothing to capture
  list(): readonly PeerPointer[];
  resolve(p: PeerPointer): Promise<Result<PeerState, ForgeError>>;
}
```

`unverified` is deliberately **not** folded into `stale`. Staleness means "the pin moved on"; unverified
means "the bytes here are not the bytes this pointer names". Conflating them produces a check that
cannot distinguish drift from substitution -- a check that cannot fail in the way that matters.

**What each state means operationally:**

- `missing` -- no `path`, or the path is not a git repo. Recovery is a clone, and the resolver
  **returns the state rather than cloning**: an effectful repair inside a resolution call is an
  ambient crossing (section 13 noninterference).
- `stale` -- HEAD is a descendant of the pin. Normal; the agent may work, and a `write`-role peer
  should fetch first.
- `diverged` -- HEAD is not a descendant of the pin and the pin is not a descendant of HEAD.
  A `write`-role peer in this state is a **refusal condition**: the agent does not act.
- `unverified` -- recomputed content identity disagrees with `content`. Always a refusal, for every
  role including `cite`.
- `resolved` -- HEAD equals the pinned SHA and the content identity matches.

### 3.3 Content-addressing: what is verified, and the honest ceiling

`content` is `blake3:<hex>` over `canonicalBytes({ name, remote, pinSha, treeSha })`, computed with the
existing `ContentHash256` and `canonicalBytes` from `src/Core.TypeScript/ace/` -- the same construction
`package-hash.ts` already uses for `ace` package identity. Two rules follow from reusing it rather than
minting a new convention: only-the-irreducible-is-primitive (one hashing scheme, not two), and a
verifier that already has tests.

Verification is **offline and cheap**: `git rev-parse <pinSha>^{tree}` in the local clone, rebuild the
canonical bytes, compare. No network, no forge API -- so it is safe to run at every wake and inside a
DST replay.

**The ceiling, stated rather than hidden:** `treeSha` is a git object name, and this repository's git
objects are SHA-1. The blake3 wrapper binds the pointer's *fields* strongly but inherits git's object
naming for the tree component; it does not repair SHA-1. That is a known, bounded weakness, resolved
if and when the repo moves to SHA-256 objects. Until then the pointer's guarantee is "binds as strongly
as git itself does" -- honest, and strictly better than the bare 40-hex string civsim carries today.

### 3.4 The seven disciplines, checked

| Discipline | How this satisfies it |
|---|---|
| **Scale-free** | One `peers.json` per actor; no root, no registry repo, no authoritative list. K actors with K disjoint working sets is the same code path as one. |
| **Lock/wait-free** | Resolution reads only local state; no actor waits on another's permission or on a shared lock. |
| **Weight-free** | The file is pure data; the resolver is an interface with no instance state. No pointer confers authority over another repo -- `role` restricts, never grants. |
| **DST** | Resolution is a pure function of (`peers.json`, recorded filesystem/forge crossings). No ambient clock enters the verdict. An `observedAt`, if recorded at all, is local-only and is forbidden from any shared fold (`local-time-never-enters-the-shared-fold`). |
| **DV2.0** | `peers.json` is a *satellite* (fast-changing, host-local); the in-repo dependency pin is a *link* (relationship, versioned); the repos themselves are *hubs*. Three change rates, three storage shapes. |
| **Idempotency** | `resolve` is `f(f(x)) = f(x)`. Adding a peer is an upsert keyed by `name`; adding it twice is a no-op. |
| **Noninterference** | Filesystem and forge access are injected effects; the resolver never repairs, clones, or fetches as a side effect of being asked a question. |

### 3.5 Why not the obvious alternatives

- **Submodules** -- already rejected on cycle grounds (2026-04-22 ADR), and Aaron ruled them out again.
  A second, independent reason now: a submodule is a *repo-side, shared* fact, while the working set is
  an *actor-side, host-local* one. Submodules would push per-actor state into shared history.
- **A manifest repo** (Google `repo` for Android, Zephyr `west`, ROS `vcstool`) -- the file shape is good
  prior art and worth borrowing. The *topology* is not: all three designate a manifest repository that
  every client must consult. That is an appointed hub. Take the shape, refuse the appointment.
- **A monorepo with sparse checkout** -- keeps one 10 GiB cache quota and one ruleset. It addresses clone
  size and nothing else that is metered here.
- **A new AgencySignature trailer carrying the pointer set** -- rejected in section 4.1.

### 3.6 Convergence without coordination

Two actors may hold different, both-valid working sets and never need to agree. The union of
`peers.json` files across actors is grow-only per `(name, pin)` and therefore monotone, so it converges
without any coordination (CALM: Hellerstein; Ameloot et al.). This is section 9h's per-frame GSet at the
pointer layer, and it is why no global registry is needed -- not as a preference, but as a theorem.

---

## 4. Multi-repo agent workflow

### 4.1 Branching and the join key

Branch: `<persona>/<zetaid>-<slug>`, the same name in every repo the change touches. **The branch name
is not the join key** -- names collide and get renamed. The join key is the ZetaId.

**The join key already exists and needs no schema change.** AgencySignature v1 carries ten required
fields, one of which is `Task`. A cross-repo change-set is exactly

```
changeSet(id) = { commits across all peers where Task = id }
```

which is a Z-set fold over per-repo commit event streams -- the git-as-event-store pattern this repo
already runs on. Adding a `Change-Set` field to a ten-field governance-critical schema would require
Aaron, would need every validator and the post-merge auditor updated in lockstep, and would buy nothing
that `Task` does not already carry. **Recommendation: reuse `Task`. Do not touch the schema.**

One constraint extends, and it is not optional: `Action-Mode` must already be identical on every commit
in a PR, because a squash rewrites the preimage. Across repos the same reasoning applies with more
force -- the authority claim is *one* claim about *one* logical act -- so `Action-Mode`, `Human-Review`,
`Credential-Mode` and `Credential-Identity` must be identical across every repo in a change-set. Two
repos disagreeing about how much authority the same act carried is a governance defect that no
single-repo validator can see.

### 4.2 Atomicity: there is none, and faking it would be worse

There is no cross-repo transaction, and we should not build one. Two-phase commit needs a coordinator,
and a coordinator is an appointed hub. What we have instead is **per-repo atomicity plus reconciliation**
-- a saga (Garcia-Molina and Salem, 1987), not a transaction.

The design that makes this safe rather than merely tolerated:

1. **Each repo's change is independently valid and independently revertible.** A producer change that
   lands alone must not break the producer. Revert is a retraction (`-1`), not a rollback.
2. **Merge order follows the dependency edge**: producers first, pin-consumers last.
3. **The pin bump is the commit point.** Until the consumer bumps `.zeta-version`, the producer's merged
   change is *invisible to the consumer's build*. So cross-repo atomicity is recovered as the
   single-repo atomicity of one small commit. Partial application is **visible-but-inert**, not corrupt
   -- the property that makes reconciliation tractable instead of frightening.
4. **Reconciliation is a report, never a block.** A `change-set status` fold reports, per peer:
   `merged` / `open` / `absent`, keyed by Task ZetaId. It has no authority to gate anything; if it did,
   it would be a coordinator.
5. **The fold orders on causal (parent-hash) order and pin ancestry, never on wall-clock.**

### 4.3 The agent's wake sequence

1. Read `peers.json`; `resolve` every entry.
2. Refuse to act in any peer that is `diverged` (for `write` role) or `unverified` (any role). Report;
   do not repair silently.
3. For each `write`-role peer, run the worldview refresh -- `refresh-worldview.ts` is **already**
   parameterized by `--owner` / `--repo`, so multi-repo worldview is a loop over the working set with no
   code change.
4. Branch, work, commit with the same `Task` ZetaId and identical authority fields across peers.
5. Open one PR per repo. Each repo gates independently.

**No cross-repo required check is proposed.** A check in repo A that must pass before repo B may merge
is an appointed hub, it strands both gates when either repo is unavailable, and it converts a partition
into a global stall. Independent gates plus a reporting fold is the scale-free shape.

---

## 5. Blast radius

Enumerated honestly. A migration that strands the gate is worse than no migration -- and section 1.2
shows that has already happened once.

1. **`gate (required)`.** The `CI Gate` ruleset requires exactly one status context, `gate (required)`
   (integration_id 15368), on `~DEFAULT_BRANCH`. Every new repo needs both the ruleset *and* a workflow
   producing that exact context name. Order matters: the Stage-1 scaffolding tool deliberately creates
   branch protection with **empty** contexts to avoid a deadlock where protection waits on a check that
   no workflow emits. That ordering is correct and must be preserved. civsim has neither.
2. **Heartbeat lanes.** `heartbeat/*` refs, the `Heartbeat Branch Protection` ruleset, `flush-via-staging`,
   and a fine-grained PAT (`ZETA_TELEMETRY_FLUSH_TOKEN`) scoped to `Lucent-Financial-Group/Zeta` -- the
   workflow's own error text names that scope. `heartbeat-liveness.yml` reads
   `repos/${REPO}/actions/workflows/agent-heartbeat.yml/runs`. After a split, either (a) heartbeat stays
   in one repo and liveness stops covering the others -- and per CLAUDE.md an under-report *reads as* the
   standing-by failure, a check that did not run looking like one that passed; or (b) per-repo lanes,
   which means N PAT grants, N flush PR streams, N quota draws. Neither is free.
   Recommendation: per-repo lanes for any repo with writers, and the liveness verdict becomes a **join
   over per-repo lanes with no global clock** -- which is section 9h, already theorized. Do not
   centralize the verdict.
3. **The archive lane.** `pr-archive-on-merge.yml` plus `docs/github/**` (8,256 files, 8,338 touches per
   30 days -- the single largest cluster on both axes). Moving it drags `consume-pr-archives.ts`,
   `reconcile-review-archive.ts`, `pr-manifest-shards.ts`, and `pr-manifest-integrity.yml` across a repo
   boundary, and archive-writes-to-another-repo requires a **cross-repo credential**. Credentials are the
   least scale-free thing in the system. **Highest change-rate payoff and highest risk in the same move.**
   Aaron's call (section 6, item 2).
4. **150 hardcoded `Lucent-Financial-Group/Zeta` strings** in `.ts` and `.yml`. Most take
   `${{ github.repository }}` cleanly. The residue is the genuinely cross-repo set --
   `mirror-to-fork.yml`, `society-heartbeat.yml`, `agencysignature-enforcement.yml`, the migration
   scripts under `src/Core.TypeScript/migrations/`, and the branch-protection JSON under
   `docs/operations/`. Those need the pointer, not a substitution.
5. **The shared-checkout rule.** `GOVERNANCE.md` section 35, the `AGENTS.md` section, and
   `.claude/rules/shared-checkout-is-view-only.md` all say "the shared checkout" in the singular.
   Multi-repo makes it "one view per repo"; the writer-actor model already generalizes cleanly
   (clone-per-writer), so this is one sentence of edit, not a redesign. But `AGENTS.md` and
   `GOVERNANCE.md` are round-table artifacts -- the edit requires explicit human concurrence, and this
   doc does not make it.
6. **`install.sh` and the toolchain.** Covered in 2.4: if the installer stays monolithic, a language
   split delivers no cache relief. This is the most likely way the migration fails to deliver its metric,
   and it is a precondition rather than a follow-up.
7. **Work-items and backlog.** `workitems/` and `docs/backlog/` share one namespace, and ZetaIds are
   minted locally and are conflict-free by construction (`workitems-mint-with-zetaid`). The namespace
   survives a split unchanged. This one is genuinely free -- and it is free *because* an earlier decision
   refused sequential B-NNNN ids. A scale-free choice paying off in a use it was not made for.
8. **Memory and persona notebooks.** The 2026-04-22 ADR routes `memory/<persona>/**` to Forge. Manifesto
   section 5 (Memory Preservation) says identity transitions must not silently destroy memory, so a move
   is either `git mv` with per-file history preserved, or a documented, consented loss. Aaron's call.
9. **Local-time discipline.** Any cross-repo fold must order on causal / pin ancestry, never on
   `observedAt` or run timestamps. Two repos' clocks are two frames.
10. **Cost surface.** K repos means K Actions quotas (good) and K billing surfaces (needs watching).
    Budget authority is Aaron's, standing rule, no exceptions.

**Migration ordering principle, one line:** *stand the gate up in the new repo before moving anything
into it.*

---

## 6. Decisions that are Aaron's, not mine

1. **Which cut goes first.** Change rate and ruleset divergence both select the telemetry/archive lane;
   the cache selects language; the project axis moves neither number. My recommendation is telemetry
   first, then language, then products-as-they-ripen. The choice is his.
2. **Whether the archive lane leaves the repo at all** -- biggest payoff, needs a cross-repo credential,
   which is a new trust surface.
3. **`--apply` on the Stage-1 scaffolding** for `LFG/Forge` and `LFG/ace`. The tool has been ready and
   dry-run-verified since 2026-05-14; repo creation is irreversible and explicitly gated on him.
4. **Whether ADR 2026-04-22 moves from Proposed to Accepted.** It has governed behaviour for four months
   without ever being accepted, which is its own small governance defect.
5. **Whether history may be rewritten in a move**, or whether every moved file keeps commit-for-commit
   history (manifesto section 5).
6. **Heartbeat topology**: per-repo lanes (N PAT grants, N quota draws) versus single-repo (liveness
   under-reports, and an under-report reads as the standing-by failure).
7. **AgencySignature schema**: my recommendation is that it stays at ten fields and cross-repo change-sets
   join on `Task`. A schema change is governance-critical and is his.
8. **The two unlanded terminal ADRs** -- Axis 2 (Mirror/Beacon, 081KRHWGX0008QG0R0023FDYVE) and Axis 3
   (code/English + formal verification, 081KRHWGX0008QG0R0023DWW8D). Land them as designed, or supersede
   them with this doc. They have been decomposed and idle since 2026-05-14.
9. **Budget** for K repos.
10. **civsim remediation** -- it has no gate and a 10,075-commit-stale inert pin today. Fix it, or declare
    it deliberately ungoverned. Either is a position; the current silence is not.

---

## 7. What this doc does not decide

- **Cross-repo scheduling and resource / time-sharing.** A separate agent owns the planner. Nothing here
  should be read as a scheduling design; the pointer resolver deliberately has no policy about *when* to
  fetch, only about *what state a peer is in*.
- **Any migration step.** No file moves, no repo creation, no ruleset edits are executed or authorized by
  this document.

---

## 8. Vocabulary and register notes

- **Agent, never bot** (GOVERNANCE.md section 3).
- "Spec" in this document means a **behavioural specification** throughout; where a formal specification
  is meant it is written "formal specification" in full.
- The four cited work-items head their quoted-Aaron sections "Aaron's directive". That framing has since
  been retired by `.claude/rules/no-directives.md` -- source is not authorization, and observations are
  not orders. Recorded here rather than edited there: those rows are historical artifacts and rewriting
  them would falsify the record.
- The 2026-04-22 ADR's ownership section is Mirror-register shorthand ("Claude owns Forge"). Its Beacon
  form is narrower, and is what this doc relies on: governance authority over factory policy, with the
  alignment-contract veto and budget authority retained by the human maintainer.

## 9. Anchors (Beacon)

- **Data Vault 2.0** -- Dan Linstedt. Hub / link / satellite partition by change rate. Used here as the
  criterion in section 2, with counts attached rather than asserted.
- **CALM** (Consistency As Logical Monotonicity) -- Hellerstein; Ameloot, Neven, Van den Bussche. Monotone
  computations are coordination-free. This is what licenses "no global registry" in 3.6 as a theorem
  rather than a preference.
- **Sagas** -- Hector Garcia-Molina and Kenneth Salem, 1987. Long-lived transactions decomposed into
  independently-committed steps with compensation. The exact shape of section 4.2, and the reason
  two-phase commit is refused (it needs a coordinator).
- **Merkle trees** -- Ralph Merkle, 1979 / 1987. Content-addressed identity; git's object model and the
  `ace` `package_hash` are both instances, which is why 3.3 reuses rather than reinvents.
- **Scale-free networks** -- Barabasi and Albert, 1999. Emergent concentration is fine; appointed
  concentration is the defect. Section 3.5's refusal of a manifest repo is that distinction applied.
- **Manifest-tool prior art** -- Google `repo` (Android), Zephyr `west`, ROS `vcstool`. The file shape is
  borrowed; the designated-manifest-repository topology is refused.
- **Conway's law** (1968) and the inverse Conway manoeuvre (Skelton and Pais, *Team Topologies*, 2019) --
  repository boundaries become communication boundaries. Named because it is the honest cost of every
  split in section 2, and the one cost none of the four criteria measures.
