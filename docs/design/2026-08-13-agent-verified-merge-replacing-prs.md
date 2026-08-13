# Agents verify and merge — the replacement for PRs, gates and branch protection

**Aaron, 2026-08-13**, answering four open design calls at once:

> *"we want to try to move away from prs as much as possible — heartbeats should be close to free. if
> we have to batch them for corporate mode or review fine, **the review can be the mutual observation
> too**… we want to expand this to replace our prs and their functionality over time and the gate and
> branch protections so they go to a minimal. also we should try to gate as little as possible and just
> hand off to next in line — **each change can go through multiple reviews and correctors, it does not
> have to be one**… we can have a branch get checked in by agents and other agents merge them to main
> after running the verification checks based on our declared deps and what code needs to be built.
> think incremental builds on steroids executed by multi agents."*

## The load-bearing sentence

> **"The review can be the mutual observation too."**

This is not a relaxation of review. It is a **strengthening**, and the vocabulary landed today makes
that precise:

- A **PR approval is a witness** — one external observer. It tolerates **zero faults**: if the single
  reviewer is wrong, captured, or inattentive, the rescue fails silently *and looks like success*.
- **Mutual observation among N agents is a quorum** — sized for fault tolerance, and it is what
  `vocab/words/quorum.md` describes.

So *"each change can go through multiple reviews and correctors, it does not have to be one"* is
literally the move from **witness to quorum**. Dropping PRs in favour of mutual observation raises the
bar rather than lowering it — *provided the quorum is real*, which is the whole engineering problem.

It also satisfies the constraint the rest of today established independently. `FigureEightEnsemble.fs:22-27`
proves a closed loop cannot escape its own fixed point from inside: **the demon needs an external
observer**. The society-delivery track reached the same place from the other side — *"the heartbeat
cannot certify its own evidence."* Mutual observation among distinct agents is exogenous correction;
self-merge is not. The design must preserve that distinction or it becomes a tangle with extra steps.

## The four calls, answered

| Question | Answer |
|---|---|
| Step-level vs job-level gating | **Neither, long-run.** The gate itself shrinks toward minimal. Short-run keep step-level (safe today); do not invest in job-level, it is on the path being replaced. |
| Per-heartbeat PR vs staging flush | **Neither is the destination.** Heartbeats should be *close to free* — no PR ceremony per frame. Batch only for corporate mode or when a human review is genuinely wanted. |
| hex vs Crockford base32 for ZetaId filenames | **Base32, and pluggable.** Aaron: *"most storage efficient for the medium, and pluggable since our substrates are pluggable over time."* A 128-bit id is **32 hex chars vs 26 base32 chars** — base32 wins on the stated criterion, and `encoding.ts` already calls it *"the CANONICAL filename form"*. |
| `observe-events` category drift | Not answered here; still open. Note it interacts with the above — if agents route work by category, a mis-categorised ledger mis-routes. |

## What replaces the gate

**Verification driven by the declared dependency graph**, executed by multiple agents:

1. An agent checks work in **on a branch** — cheap, ungated, no ceremony.
2. **The build graph decides what must be verified.** `src/Core.TypeScript/ace/build-graph.json`
   (landed today, PR #10379) holds 106 targets with edges derived from `.fsproj`/`Cargo.toml`/
   `lakefile.toml`, and `build-graph.ts affected` answers *"given this changed file set, which targets
   are affected?"*. That query **is** the "what code needs to be built" Aaron names.
3. **Other agents run those checks and merge** — the verifier is never the author. That is the quorum,
   and it is where "hand off to next in line" lives.
4. **Incremental builds on steroids**: only affected targets are rebuilt, and the fan-out across agents
   is parallel because the graph says which targets are independent.

## The guards this design must not lose

Everything below was learned the hard way in the last twenty-four hours and applies directly.

- **A skipped check and a passed check must never be indistinguishable.** `build-graph.ts`'s
  `verifyCoverage` already proves `affected ∪ skipped == every target`, exactly once each, so a green
  carries its coverage. Keep that property when the gate goes away — it becomes *more* important, not
  less, because there is no monolithic gate to fall back on.
- **Unknown escalates.** A path matching no target forces a full build. Forgetting to map a new tree
  must make verification *slower*, never *quieter*.
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
3. **Name the quorum size.** *"Multiple reviews and correctors"* has no number yet. Until it does, the
   design is a witness wearing a plural noun — and `vocab/words/quorum.md` says a quorum is a witness
   set **sized** for fault tolerance.

## Pointers

- `vocab/words/witness.md`, `vocab/words/quorum.md` — the distinction this design rests on
- `src/Core.TypeScript/ace/build-graph.{json,ts}` — the declared deps and the affected query
- `src/Bayesian/FigureEightEnsemble.fs:22-27` — why the verifier cannot be the author
- `docs/handoffs/2026-08-13-gh013-two-efforts-reconciled.md` — the ruleset analysis and the
  harm-prevention vs quality-gate split
