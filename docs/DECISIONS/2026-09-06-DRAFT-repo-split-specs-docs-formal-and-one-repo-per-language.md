# DRAFT — the repo split: specs, docs, formal analysis, and one repo per language

**Status: DRAFT. Nothing has moved. This is written to be EXECUTED LATER, in few-shot
iterations, each one adversarially reviewed before the next.** Work item
`081M1W2K3DD087G0R000XZTFV7`.

Aaron, 2026-09-06:

> *"lets move our specs into it's own repo, our docs into it's own repo and keep our code
> here for now … oh and we can split out formal analysis, oh shit now that i think about it
> we can move out every computer language into it's own repo … We want to make the source of
> truth obvious by deleting from our old zeta … these splits i can remember to type as a
> human without a larger multi repo workflow, that helps me reduce the context or allow me to
> merge contexts at will."*

## The four constraints this plan is shaped by

1. **Nameable from memory.** Aaron must be able to type a repo name without a tool telling
   him what it is. That is a real constraint on the naming scheme, and it rules out
   content-hashed or numbered names.
2. **Deletion is what makes the source of truth obvious.** A copy leaves two answers to
   "where does this live". Every step below ends by *removing* the moved tree from Zeta.
3. **Few-shot executable, with adversarial review between shots.** So each step must have a
   verdict a reviewer can check without re-deriving the whole plan.
4. **Context is the product.** The split exists so a session can load *one* repo, or
   deliberately merge two. A split that forces three clones to do ordinary work has made
   context worse, not better.

## Correction first: "docs into its own repo" is NOT the easy one

This is the most useful thing measured for this plan, and it contradicts the ask.

**728 files under `src/`, `tests/`, `tools/`, `clis/`, `.github/`, `infra/` and
`full-ai-cluster/` reference a `docs/` path.** `docs/` is not a prose directory with some
tooling around it — a large part of it is **machine-read substrate that happens to live
under `docs/`**:

| subtree | files | files that READ it |
|---|---:|---:|
| `docs/research` | 2,092 | **432** |
| `docs/backlog` | 1,140 | **101** |
| `docs/DECISIONS` | 69 | 59 |
| `docs/hygiene-history` | 1,315 | 51 |
| `docs/observe-events` | 5,993 | 50 |
| `docs/history` (PR archive) | 14,032 | 43 |
| `docs/github` (PR index) | 14,029 | 40 |
| `docs/security` | 22 | 39 |

**So the cut is not `docs` — it is PROSE vs MACHINE-READ SUBSTRATE.** Of 77 subdirectories
under `docs/`, roughly 26 have **zero** machine readers, and they are all small (1–10 files):
`pitch`, `plans`, `papers`, `marketing`, `craft-school`, `outreach`, `legal`, `consent`,
`derivations`, `site`, `podcast`, `templates`, `drafts`, and so on.

Moving those is genuinely easy and genuinely low-value — a few hundred files. Moving
`docs/research` or `docs/backlog` is a **432-reader and 101-reader migration**, which is a
different project wearing the same word.

**Recommendation: do not split "docs". Split `docs/history` + `docs/github` (the PR archive,
already drafted separately in `2026-09-06-DECLINED-the-pr-review-archive-moves-to-its-own-repo.md`,
28k files and 64% of Zeta's growth), and leave the rest until the prose/substrate boundary is
drawn deliberately rather than by directory name.**

## The good news: the languages are already partitioned

The hardest-sounding item is the most nearly done. Every language already has its own
top-level directory, by an existing convention nobody has to invent:

| language | source | tests | files |
|---|---|---|---:|
| F# | `src/Core`, `src/Core.*` | `tests/Tests.FSharp` | 1,480 |
| TypeScript | `src/Core.TypeScript` | (colocated `.test.ts`) | 3,717 |
| C# | `src/Core.Abstractions`, `src/Core.CSharp` | `tests/Tests.CSharp` | 345 |
| Rust | `src/Core.Rust.*` (≥4 crates) | colocated | 124 |
| Python | `src/Core.Python`, `src/Arc.Python` | colocated | 124 |
| Lean 4 | `src/Core.Lean4`, `src/Core.Lean4.Cslib` | — | 63 |
| Go | `src/Core.Go` | `tests/cross-verification` | 31 |
| Q# | `src/Core.QSharp.ReferenceOracle` | — | 9 |

A `git subtree split` per language preserves history and needs no re-organisation first.

## The blocker, and it is the whole engineering content of this plan

**The four-oracle byte-lock is why several languages exist at all.** Independent
implementations agreeing over shared golden vectors is the repo's signature property, and
`.claude/rules/culture-invariant-by-default.md` records that the agreement is *achieved*, not
observed: **"the seed is the treaty."**

Measured: the golden vectors **live** overwhelmingly in `src/Core.TypeScript` (71 files) and
are **read** from at least ten different language directories —

```
110  src/Core.TypeScript      54  tests/Tests.FSharp       36  tests/Tests.CSharp
 22  src/Core                 19  src/Core.CSharp          10  src/Core.Rust.DynamicValue
  7  src/Core.Rust.Algebra     6  tests/cross-verification  4  src/Core.Rust.Merkle
  4  src/Core.Rust.Clock
```

### RETRACTED: "TypeScript becomes an appointed hub"

That is what this section said, and it is **wrong twice over.** Aaron, on reading it:

> *"no typescript avoids being a hub because it's just the scripting language and it's open
> source ish with ecmascript standards, and multiple vendor implementations — but any
> research you want to do here to make it less hub like is very valid."*

**Wrong once because it contradicts a standing decision from two days earlier.**
`docs/DECISIONS/2026-09-04-typescript-is-the-canonical-implementation-and-what-that-does-not-license.md`
records the maintainer's direction — *"typescript is what we want to turn into the
canonical"* — and it already applies the same discriminator I reached for, against the same
rule: *"Where either language may hold the better answer and the treaty can adjudicate,
deference is chosen. Where one language must be routed through, it holds you."* It even
names the exact error I made: *"Conflating them is how a good decision becomes an appointed
hub."* **Canonical-by-choice is not appointed.**

It also records that the arrangement I described as a future risk is **already the operating
reality** — `workflow-treaty-transcript.json` lives in the TS tree today, 283 vectors across
five families, TS generates and F# conforms.

**Wrong twice because the language-level exit is real, and measurable.** ECMAScript is a
published standard with multiple independent implementations, so a reader is not locked to a
vendor. In this tree specifically:

| | measured |
|---|---|
| TS files touching the `Bun.` global | **168 of 2,666 — 6.3%** |
| a second runtime already in CI | **yes** — `node` runs in `bytelock.yml` and two others |

So ~94% of the TypeScript surface is runtime-portable in principle, and the multi-vendor
claim is **exercised, not merely available**. The honest qualifier is the 6.3%: those files
are bun-locked, and that is the number to watch if portability is ever load-bearing.

### What survives the retraction, stated narrowly

One thing does, and it is **independent of which language holds the vectors** — it would be
identical if they lived in `zeta-fs`:

> **The split converts a file every oracle HAS into a repo every oracle must REACH.**

Today each language has the vectors in its own clone; exit is total, because you already have
the bytes. After a split, verification depends on a remote being reachable and on someone
merging there. That is a new coupling created by the *split*, not by TypeScript.

`clone-at-tag-stays-sufficient.md` is what makes it concrete rather than theoretical: a clone
at a tag must build and check with **no package manager present**, so "the vectors come from
a dependency" is not an available answer for any owner.

### The research Aaron invited: four things that reduce it, in order of value

1. **Vendor the vectors, do not fetch them.** Each language repo commits the pinned treaty
   (subtree or checked-in copy at a named ref). A clone at a tag then still has the bytes and
   builds offline — which satisfies the rule *and* dissolves the required-remote problem
   above. This is the one that matters; the rest are refinements.
2. **Keep the vectors text.** `no-binary-in-proof-lineage.md` already requires hex-in-JSON, and
   that is exactly the good-meter test from
   `dual-use-detection-is-neutral-oracle-decides.md`: *"anyone can inspect it and agree to the
   rules."* A treaty nobody can read is one you must trust, and a meter you must trust is an
   authority.
3. **More than one generator.** Today TS generates and F# conforms. The 2026-09-04 decision
   flags the hole itself — `MenuGenerator.fs` is *"the ONE part with no F# counterpart, and
   therefore outside the transcript"*. A second generator for even one family would make the
   treaty checkable from both sides, which is what makes agreement evidence rather than echo.
4. **Name the runtime dependence.** The 6.3% above is the measurable edge of the multi-vendor
   argument. An audit that keeps `Bun.`-global usage out of the *vector-generating* path would
   make the portability claim checked rather than asserted.

**Either way the conclusion for this plan is unchanged, and now for a better reason:**
`zeta-treaty` is worth doing — not because TypeScript would otherwise be a hub, but because a
declared common nexus is the honest home for an agreement that no participant should have to
host.

**Therefore the language split has a prerequisite, and it is one step, not eight:**

> **`zeta-treaty` — the golden vectors, the IR/schema files, and the cross-verification
> harness, in a repo no oracle owns.**

Every language repo then vendors it the way this repo already permits: a pinned checkout,
plain `git`, no resolver. The treaty repo is the one place where "who is authoritative" is
answered, and it is answered by *nobody* — which is the property the multi-oracle rule
requires.

**This is also the answer to the version-skew question a reviewer will ask:** the treaty is
pinned by tag in each language repo, so a vector change is a deliberate bump per oracle, and
a lagging oracle is *visible as a lagging pin* rather than as a mysterious byte-lock failure.

## The nexus architecture — Aaron's refinement, and it changes the shape

Aaron, mid-draft, 2026-09-06:

> *"in a perfect world our helm charts would only exist and be tested in the language they
> were created in, this is likely a new ace package manager dimension we need to track, all
> other deps would be stubbed out in that language. zeta is the nexus for now but it's an
> ACCIDENTAL nexus. we likely want a nexus repo per language/toolchain and a common one that
> is very intentional, similar to our multi oracle agreements in this repo."*

**"Accidental nexus" is the sharpest thing said about this repo all day**, and it renames the
problem. Zeta is not a monorepo that grew — it is a **junction** that nothing declared. Every
language meets here because here is where they happened to be, and no document says what that
junction is *for*. That is why `docs/` accumulated machine-read substrate, why the golden
vectors ended up inside one oracle, and why 728 files reach across the boundary: **an
undeclared junction has no rules, so everything crosses.**

The fix is not "fewer junctions". It is **junctions that were declared**:

| | accidental | intentional |
|---|---|---|
| what it is | wherever things happened to meet | a repo whose only job is the meeting |
| what crosses | whatever anyone reached for | exactly what the contract names |
| how you know | you read the whole tree | you read one file |
| failure | silent coupling, found years later | a refused crossing, found at the boundary |

### Two tiers, and the shape is one this repo already has

**Per language/toolchain: a nexus repo.** `zeta-ts` is where TypeScript's own world is
complete — its code, its tests, **its Helm charts**, and **stubs for everything it does not
own**. A TypeScript developer clones one repo and everything resolves. That is the context
win Aaron asked for, stated precisely: *one clone is a whole world*.

**Across languages: one common nexus, and it is `zeta-treaty`.** The refinement is that the
treaty is not merely a file store for golden vectors — it is **the intentional common
nexus**, and it is the only place a cross-language fact is allowed to live. *"Similar to our
multi-oracle agreements in this repo"* is exact: the vectors already ARE the agreement,
`culture-invariant-by-default.md` already calls the seed a **treaty**, and the four oracles
are already named oracles rather than instruments. The split does not invent this
architecture — it moves the agreement out of one participant's house.

### Helm charts belong to the language that created them

Today the charts are **not** owned that way and the numbers say the ask is nearly free:

- **37 charts in the cluster tree are third-party**, pinned upstream. They belong to whoever
  deploys them, i.e. the cluster tree — not to a language.
- **This repo owns exactly TWO charts**, and both are `examples/helm-dependency-graph/charts/`
  — a fixture for the dependency-graph work, not a deployment.

So "charts live with their language" is a rule with almost no migration attached **today**,
and the right moment to adopt it is *before* the first service chart is written, not after.
The rule worth carving now:

> **A chart that deploys code lives in that code's repo and is rendered by that repo's CI.
> A chart that deploys someone else's software lives with the cluster that deploys it.**

The second half matters as much as the first: it stops "charts live with their language"
from being read as a licence to scatter the 37 upstream pins across eight repos, which would
undo the pin-parity work landed today.

### "All other deps stubbed out in that language"

This is what makes a per-language nexus **complete rather than partial**, and it has a
falsifier this repo already understands: a language repo's tests must pass **with no other
language present**. If `zeta-fs` needs `zeta-ts` on disk to run its own suite, it is not a
nexus — it is a client of an accidental one, and the split moved the coupling without
removing it.

That test is also the honest limit on the stubbing idea: **a stub that drifts from the thing
it stands for is a lie with a green tick**, which is the failure this repo names first. So a
stub must be checked against the real implementation *somewhere* — and that somewhere is the
treaty, by golden vector, which is the mechanism that already exists. **Stubs are how a
language repo stands alone; the treaty is what stops them drifting.** Neither works without
the other.

### The ace dimension

Aaron: *"likely a new ace package manager dimension we need to track."* Stated so it does not
violate the rule it sits next to:

`ace` may learn to resolve *language nexus + toolchain + treaty pin* as a coordinate. What it
may not become is the **only** way to do so — `clone-at-tag-stays-sufficient.md` is explicit
that `ace` may be the good path and may accumulate any amount of use, and that the moment it
is the *only* path it is an appointed hub. So the treaty pin has to be a plain committed
ref that `git` alone can follow, with `ace` as the ergonomic layer on top.

**That is the same two-tier shape one level up**: the treaty is the intentional nexus for
*facts*, and `ace` would be the ergonomic nexus for *resolution* — and neither may become
mandatory without violating §1.

## Regenerated artifacts go to a repo whose history is NOT preserved

Aaron, 2026-09-07, deciding the `db/search-index` question and generalising it:

> *"we have a plan to save files in a way that costs space on every recalculation, so full
> history is not preserved — we were going to do this on a different repo. Just make sure this
> plan is part of the repo split too, and we can delete it for now."*

**The cost model is the point, and it is the triangle's worst case.** A derived artifact
committed to a full-history repo costs `size x recalculations`, **forever** — every rebuild
writes a new blob and every old blob stays reachable. The search index measured **59.7 MB across
40 files**, rebuilt **7 times in a single day** (2026-08-24) before its cadence was disabled. At
that rate the artifact is not 60 MB; it is 60 MB per rebuild, permanently, for a file whose
entire content is a pure function of the tree it indexes.

**So the fix is not to regenerate less.** It is to store regenerated things where history is
disposable:

> **If an artifact is regenerated, its history is not evidence. Only its GENERATOR's history is.**

That sentence is the whole rule, and it follows from the triangle directly: a derived artifact is
an observation that a generator can reproduce on demand, so retaining its past is retaining
points you can always recompute — the expensive corner, paying rent on a fact you already own.

**Consequence for the split:** a repo for derived artifacts — working name `zeta-index` — whose
history is periodically discarded rather than accumulated (orphan-refresh, or a truncating
force-replace on a schedule; the mechanism is an implementation detail, the *non-preservation*
is the requirement). It is deliberately NOT `zeta-archive`: the PR-review archive is append-only
history we want to keep, and conflating "big" with "disposable" would eventually discard
something irreplaceable.

| repo | contents | history |
|---|---|---|
| `zeta-archive` | PR reviews, past decisions | **preserved** — it IS the record |
| `zeta-index` | search index, generated dashboards, any pure function of the tree | **not preserved** — regenerate instead |

**The honest limit of the deletion that accompanies this.** Removing `db/search-index/` from the
working tree stops FUTURE growth; it does **not** reclaim what is already in the pack, because
every historical blob stays reachable from the commits that introduced it. Reclaiming that needs
a history rewrite, which is a gated class and is not proposed here. So the win is *"it stops
costing more"*, not *"the repo got 60 MB smaller"* — and a report claiming the latter would be
wrong.

**Falsifier already in place:** `query.ts` REFUSES with `no index at <dir> — an absent index must
not read as an empty corpus`, exit 3. So the missing artifact cannot degrade into silently empty
search results while it lives elsewhere.

## Naming — the memory constraint, satisfied

One prefix, one word, no punctuation to remember:

```
zeta            the code that stays (F# core is the last to move, maybe never)
zeta-treaty     golden vectors + IR + cross-verification harness
zeta-archive    the PR review archive + its index
zeta-specs      openspec/ + docs/specs/           (34 files)
zeta-formal     TLA+, Alloy, Lean, Z3             (197 files)
zeta-ts         zeta-fs      zeta-cs     zeta-rs
zeta-py         zeta-go      zeta-lean   zeta-qs
```

The language suffix is the **file extension**, which is the one name nobody has to look up.
`zeta-fs` is F#, `zeta-rs` is Rust, `zeta-py` is Python. Aaron can type any of these from
memory, which was the requirement.

## Execution order — easy first, and each shot has a verdict

Each step is one shot. **Adversarial review happens between shots, not at the end**, and the
reviewer's job is to try to find the thing the mover could not see.

| # | move | files | verdict a reviewer can check | risk |
|---|---|---:|---|---|
| 1 | **`zeta-specs`** — `openspec/` + `docs/specs/` | 34 | the OpenSpec lifecycle commands still run against the new repo; Zeta has no `openspec/` | low |
| 2 | **`zeta-formal`** — `src/Core.TLA`, `src/Core.Alloy`, `src/Core.Lean4*`, `tools/Z3Verify` | 197 | every formal check still runs; `formal-verification-expert` routing still resolves | low |
| 3 | **`zeta-archive`** — `docs/history` + `docs/github` | 28,015 | a merged PR's review lands in the new repo BEFORE the old trees are deleted | medium — see its own draft |
| 4 | **`zeta-treaty`** — golden vectors, IR, cross-verify harness | ~120 | the four-oracle byte-lock still passes **from a pinned checkout**, with no package manager | **HIGH — this is the load-bearing step** |
| 5 | one language repo, the **smallest first** (`zeta-qs`, 9 files) | 9 | its oracle still verifies against the pinned treaty | medium |
| 6 | the rest, one per shot, largest last | — | same verdict each time | medium |

**Step 4 is the gate.** If the byte-lock cannot pass from a pinned treaty checkout, steps 5–6
do not start, and the language split is not viable in this form. Better to learn that on 120
files than on 3,717.

## Deletion is the last action of each shot, and it is the point

Aaron: *"make the source of truth obvious by deleting from our old zeta."*

So each shot ends with the tree **removed from Zeta**, leaving a pointer file naming the repo,
the ref, and the commit at which the move happened — the same shape as the archive draft. Two
copies is the failure this whole exercise exists to prevent.

**But deletion is one-way, so the order inside a shot is fixed:**

1. create the repo, `git subtree split` with history, push
2. verify the new repo **independently** — file counts, a sampled artifact, the checks that
   read it
3. repoint Zeta's consumers at the pinned checkout
4. **watch one real CI run go green with the consumers repointed**
5. only then delete, and leave the pointer

Step 4 before step 5, always. There must never be a window where the thing is in neither
place.

## What does NOT move, and why saying so is part of the plan

- **`src/Core` (F#) stays**, per the ask — "keep our code here for now". It is also the
  largest single body and the one most entangled with the treaty.
- **`.claude/rules/`, `CLAUDE.md`, `AGENTS.md`, `GOVERNANCE.md` stay.** They are the
  wake-time substrate; splitting them would mean an agent needs two clones to know how to
  behave, which inverts the context goal.
- **`workitems/`, `db/`, `memory/` stay.** They are keyed to this repo's identity and read by
  tooling that stays.
- **`full-ai-cluster/` and `infra/` stay.** The cluster is deployed *from* this repo.

## What the reviewer should attack, each shot

Written now, while the plan is cheap to change:

1. **"Did anything still read the deleted path?"** `git grep` for the old prefix across *all*
   surfaces — including workflow `paths:` filters, which is where a stale reference is
   silent rather than loud (measured this session: a workflow path filter that missed a tree
   meant its tests never ran on changes to it).
2. **"Does the new repo build from a clone at a tag, with no package manager?"**
   `clone-at-tag-stays-sufficient.md` is not negotiable and is easiest to violate on a fresh
   repo where a resolver looks like the obvious answer.
3. **"Is the treaty still owned by nobody?"** If any language repo becomes the place the
   vectors are edited, the hub is back under a new name. **Emergence does not launder
   enforcement.**
4. **"Can a reader still find it?"** The pointer left behind must name repo + ref + commit,
   not just a repo.

## Open, and Aaron's to answer

1. **Owner org for the new repos** — same as Zeta, or somewhere the archive can outlive it.
2. **Max's "GitHub repos as data"** — this plan multiplies the repo count by ~12. That is
   either a gift to that work or a burden on it, and he should see this before step 1.
3. **Does the treaty repo get its own CI?** It has no code to build, but the vectors are the
   one artifact where a bad merge is worst. A repo whose only job is to be correct is the
   strongest argument for it having its own gate.
4. **Where does `agentic-organization/packages` (433 `.ts`) go?** It is a second TypeScript
   surface and does not obviously belong in `zeta-ts`.

## Pointers

- `docs/DECISIONS/2026-09-06-DECLINED-the-pr-review-archive-moves-to-its-own-repo.md` — step 3, **DECLINED 2026-09-11 by Aaron**: the PR-review archive stays in Zeta, because the records are *about* this repo's PRs and the sprawl that motivated the move was fixed instead by dated buckets (#17283/#17285). **This plan's step 3 is therefore closed, and the rest of this draft is untouched and still open** — the decline was scoped to the archive, not to the repo split as a whole. That document also records why its own measurement expired: it was taken before the 2026-08-29 cadence pause cut archive accretion from 1,974 to 120 files/day, so any step here reasoning from those figures needs re-measuring.
- `docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md` — the existing split decision; this is a different axis (change rate and language, not dependency closure).
- `.claude/rules/clone-at-tag-stays-sufficient.md` — the constraint every new repo must satisfy.
- `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` — why the treaty may not live inside an oracle.
- `.claude/rules/culture-invariant-by-default.md` — *"the seed is the treaty"*, and why agreement is achieved rather than observed.
- `081M1TRJ3X5087G0R0032TNP8H` — where Zeta's growth actually goes (64% is the archive).
