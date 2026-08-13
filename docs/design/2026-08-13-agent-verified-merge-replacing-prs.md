# Agents verify and merge — the replacement for PRs, gates and branch protection

**Aaron, 2026-08-13**, answering four open design calls at once:

> _"we want to try to move away from prs as much as possible — heartbeats should be close to free. if
> we have to batch them for corporate mode or review fine, **the review can be the mutual observation
> too**… we want to expand this to replace our prs and their functionality over time and the gate and
> branch protections so they go to a minimal. also we should try to gate as little as possible and just
> hand off to next in line — **each change can go through multiple reviews and correctors, it does not
> have to be one**… we can have a branch get checked in by agents and other agents merge them to main
> after running the verification checks based on our declared deps and what code needs to be built.
> think incremental builds on steroids executed by multi agents."_

## The load-bearing sentence

> **"The review can be the mutual observation too."**

This is not a relaxation of review. It is a **strengthening**, and the vocabulary landed today makes
that precise:

- A **PR approval is a witness** — one external observer. It tolerates **zero faults**: if the single
  reviewer is wrong, captured, or inattentive, the rescue fails silently _and looks like success_.
- **Mutual observation among N agents is a quorum** — sized for fault tolerance, and it is what
  `vocab/words/quorum.md` describes.

So _"each change can go through multiple reviews and correctors, it does not have to be one"_ is
literally the move from **witness to quorum**. Dropping PRs in favour of mutual observation raises the
bar rather than lowering it — _provided the quorum is real_, which is the whole engineering problem.

It also satisfies the constraint the rest of today established independently. `FigureEightEnsemble.fs:22-27`
proves a closed loop cannot escape its own fixed point from inside: **the demon needs an external
observer**. The society-delivery track reached the same place from the other side — _"the heartbeat
cannot certify its own evidence."_ Mutual observation among distinct agents is exogenous correction;
self-merge is not. The design must preserve that distinction or it becomes a tangle with extra steps.

## The four calls, answered

| Question                                     | Answer                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step-level vs job-level gating               | **Neither, long-run.** The gate itself shrinks toward minimal. Short-run keep step-level (safe today); do not invest in job-level, it is on the path being replaced.                                                                                                                                    |
| Per-heartbeat PR vs staging flush            | **Neither is the destination.** Heartbeats should be _close to free_ — no PR ceremony per frame. Batch only for corporate mode or when a human review is genuinely wanted.                                                                                                                              |
| hex vs Crockford base32 for ZetaId filenames | **Base32, and pluggable.** Aaron: _"most storage efficient for the medium, and pluggable since our substrates are pluggable over time."_ A 128-bit id is **32 hex chars vs 26 base32 chars** — base32 wins on the stated criterion, and `encoding.ts` already calls it _"the CANONICAL filename form"_. |
| `observe-events` category drift              | Not answered here; still open. Note it interacts with the above — if agents route work by category, a mis-categorised ledger mis-routes.                                                                                                                                                                |

## What replaces the gate

**Verification driven by the declared dependency graph**, executed by multiple agents:

1. An agent checks work in **on a branch** — cheap, ungated, no ceremony.
2. **The build graph decides what must be verified.** `src/Core.TypeScript/ace/build-graph.json`
   (landed today, PR #10379) holds 106 targets with edges derived from `.fsproj`/`Cargo.toml`/
   `lakefile.toml`, and `build-graph.ts affected` answers _"given this changed file set, which targets
   are affected?"_. That query **is** the "what code needs to be built" Aaron names.
3. **Other agents run those checks and merge** — the verifier is never the author. That is the quorum,
   and it is where "hand off to next in line" lives.
4. **Incremental builds on steroids**: only affected targets are rebuilt, and the fan-out across agents
   is parallel because the graph says which targets are independent.

## The guards this design must not lose

Everything below was learned the hard way in the last twenty-four hours and applies directly.

- **A skipped check and a passed check must never be indistinguishable.** `build-graph.ts`'s
  `verifyCoverage` already proves `affected ∪ skipped == every target`, exactly once each, so a green
  carries its coverage. Keep that property when the gate goes away — it becomes _more_ important, not
  less, because there is no monolithic gate to fall back on.
- **Unknown escalates.** A path matching no target forces a full build. Forgetting to map a new tree
  must make verification _slower_, never _quieter_.
- **Not every leg is content-addressable.** Local .NET assemblies embed absolute source paths
  (`ContinuousIntegrationBuild` only set when `CI=true`), Lean `.olean` bytes are unverified, TLC/Q#
  logs carry timing. For those, hash **(sources ‖ toolchain ‖ recipe)** and the **claim**, not the
  artifact bytes.
- **The verifier must not be the author.** Otherwise the tangle result applies and the whole exercise
  is a loop certifying itself.

## Sequencing — build the replacement before removing the gate

The minimal-ruleset end state is coherent: `Branch Safety` (deletion, non-fast-forward) and
`Heartbeat Branch Protection` **are** "no harmful actions" and survive untouched; `CI Gate` is a
quality gate and is the one that goes. But the exogenous mechanism does not exist yet, so removing
`CI Gate` first would leave **neither**.

Order: **build agent-verified-merge → prove it on a real lane → then minimise the ruleset.** Not the
reverse.

## Immediately actionable

1. **Switch ZetaId filenames to Crockford base32**, behind a pluggable encoder — decided above, and it
   is a small change while only 560 shards exist.
2. **Point `build-graph affected` at a real lane.** The telemetry flush is the natural first candidate:
   it is already off the direct-push path, and its verification set is small.
3. ~~**Name the quorum size.**~~ **ANSWERED** — see below.

## The quorum size — answered, and it is a function

Aaron, later the same day: _"the quorum size will be **path dependent** — like golden vectors and
byte-locked treaties will require more reviews, and likely we want **different reviewers per
language**. there will likely have rules emerge over time on how to split different areas. we can use
**heatmaps of changes to find hotspots** in code/repo."_

So the answer was never a constant. It is `requiredQuorum` on every row of
`src/Core.TypeScript/ace/build-graph.json`, **derived** from evidence in the tree and drift-gated by
`derive` exactly as the edges are:

| tier | evidence that puts a target there                          | fault model                           | members |
| ---- | ---------------------------------------------------------- | ------------------------------------- | ------- |
| T0   | change reaches no build target                             | `none` — a **witness**, said out loud | 1       |
| T1   | floor: builds something, no byte-lock evidence             | omission, f=1                         | 2       |
| T2   | golden vectors for **one** oracle                          | omission, f=2                         | 3       |
| T3   | **cross-oracle** byte-lock or a ratified treaty transcript | **byzantine, f=1**                    | 4       |

Today that reads 33 / 21 / 52 across T1 / T2 / T3, and the evidence for every elevated row is recorded
beside it — rule id, the witnessing file, and which target holds it — so a tier is checkable rather
than asserted.

Two things this buys that a number could not:

- **No count without its model.** `RequiredQuorum` carries no size field at all; the only route to a
  number is `quorumSize(faultModel)`. `vocab/words/quorum.md`'s complaint — _"every 'get an outside
  opinion' is a witness claim until it names f"_ — is unrepresentable here.
- **3f+1 is used only where it was proved.** T3's verdict genuinely is an _agreement_ claim across
  independent implementations, so a member asserting "the oracles agree" without having compared them
  is a Byzantine fault (Pease–Shostak–Lamport 1980; PBFT 1999). T1/T2 are omission faults and say so,
  rather than borrowing PBFT's authority for "did you read the diff".

Aggregation over a change is **max** — safe and monotone, so adding files can never lower the
requirement; averaging is non-monotone and would let a byte-locked edit be diluted by bundling
trivia, which is pinned by a regression test. Reviewer classes **union**, which is what _"different
reviewers per language"_ means; `.NET` splits into `reviewer:fsharp` / `reviewer:csharp` off the
project-file extension, since `dotnet` is a toolchain and not a language. Query:
`bun run build-graph:quorum` against `git diff --name-only`.

### Two findings the derivation surfaced

- **`ts:repo` is one target covering every `.ts` file in the repo.** It therefore absorbs the highest
  tier of any TypeScript file anywhere, so **every** TS change costs a T3 quorum. That is the
  arithmetic saying "split this target": only `ace`, `hygiene` and `cross-verification` have
  per-module TS targets today.
- **`ts:cross-verification` declares `dependsOn: []`** while genuinely consuming every oracle
  implementation. A Rust-only oracle edit therefore yields a Rust-only reviewer set even though it can
  break a treaty with C#/F#/TS. That is a missing **edge**, not a missing quorum rule.

### Named prerequisite: the churn heatmap

`change frequency × quorum size` is the ongoing verification cost of a path, and it is what turns
_"where should we split?"_ from taste into arithmetic. This work supplies the second factor exactly.
The first has **no tooling in-tree** (checked 2026-08-13) — until it exists the identity is only half
computable, and the split calls Aaron wants to drive off it stay judgement calls.

## Pointers

- `vocab/words/witness.md`, `vocab/words/quorum.md` — the distinction this design rests on
- `src/Core.TypeScript/ace/build-graph.{json,ts}` — the declared deps and the affected query
- `src/Bayesian/FigureEightEnsemble.fs:22-27` — why the verifier cannot be the author
- `docs/handoffs/2026-08-13-gh013-two-efforts-reconciled.md` — the ruleset analysis and the
  harm-prevention vs quality-gate split
