# The dial axis — agent-control optimization is a closed DU, and its defining property is disjointness from the gate

**Date:** 2026-08-15 · **Author:** shadow (Otto's shadow-work role) · **Register:** survey + design + one bug
· **Status:** **toy** for the optimization framework (§6 names what would falsify it); **metered** for the
collation defect in §7, whose falsifier is a test that fails against the pre-fix code.
· **Origin (Aaron 2026-08-15):** *"this is very very close to what we are doing with our discriminated unions,
this is very close to what we need to abstract close over in our harness/ace manager cli stuff and duplex/mux
stuff."*

Reads on: [`2026-06-14-zeta-language-ir-compiler-v2-…`](2026-06-14-zeta-language-ir-compiler-v2-capability-interface-principle-fsharp-host-csharp-contracts-self-hosting-futamura.md) §0,
[`2026-08-15-the-idiom-axis-…`](2026-08-15-the-idiom-axis-capability-dispatch-gates-semantics-not-spelling-target-native-emission-and-the-linter-as-the-bar.md) (PR #10774),
`.claude/rules.bak/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md`,
`.claude/rules/toy-is-free-metered-must-be-earned.md`, `.claude/rules/culture-invariant-by-default.md`.

***

## 0. The short version

1. **The v2 §0 reading holds, with one honest wrinkle.** The agent-control axes *are* capabilities one layer
   up. The wrinkle: §0 says the generator "resolves the correct combination as a **graph, best-effort**" —
   which already blends a soundness claim (*correct*) with a preference claim (*best-effort*). The three-layer
   table in the brief is a **refinement** of §0, not a restatement of it.

2. **The brief's table indexes by layer and assigns each layer one kind. That is the wrong shape.** Kind is
   **orthogonal** to layer, and the agent layer already ships a **gate**: `ActionGate`, `ActionClass`,
   `ReviewLevel` and `determineReviewLevel` in `src/Core.TypeScript/workflow-engine/types.ts`. So "agent layer
   ⇒ optimization" is false, and the correction is safety-relevant rather than taxonomic (§3).

3. **Therefore the defining property of the new DU is not its variant list — it is DISJOINTNESS from the
   gate.** An optimizer permitted to vary `ReviewLevel` improves its score by lowering the review bar. That is
   reward hacking aimed at the guardrail, and it is the one failure mode in this design that is not merely
   "scores worse". Disjointness is encoded as data (`GATE_OWNED`) and enforced by a refusal, so it is
   **checkable**, and four tests check it.

4. **We already have more than the brief assumed — including a measurement.** The three
   `docs/research/harness-run-2026-04-20-*.md` documents are an axis-optimization eval loop already run, on
   the skill-activation axis, with pass-rate and token cost over whole runs. **The result was negative**
   (−10pp pass rate, +37% tokens with-skill). That is the single most useful thing in the survey: the loop has
   run once and the honest answer it produced was *the change made things worse*.

5. **"Harness" names four unrelated things in this repo** (§1). The brief pointed at three of them; only one
   is the agent-control layer.

6. **Our decomposition is OPLE, and it wins where it applies — but it only covers five of R1's eight axes**
   (§2). Reported as a divergence, per the correction.

7. **One real bug found and fixed:** `ace-cli.ts`'s `graphMerkleRoot` sorted with `localeCompare`, putting a
   locale in the proof lineage (§7). Its sibling module 40 files away exports `ordinalCompare` with a
   docstring explaining exactly why not to.

***

## 1. Survey: "harness" is four things

The brief's reading list spans three different senses of the word. Naming them prevents the next agent
re-running this confusion:

| surface | what it actually is | relevant here? |
|---|---|---|
| `docs/HARNESS-SURFACES.md` | inventory of **third-party agent harnesses** (Claude Code, Codex, Cursor, Copilot, Gemini) and their feature surfaces | **yes — this is the R1 layer** |
| `.claude/hooks/harness.ts` + `claude-hooks/harness.test.ts` | shared utilities for Claude Code **PreToolUse/PostToolUse hook scripts** | partly — hooks are one *routing* candidate |
| `src/Core.TypeScript/cluster/harness/bootstrap.ts` | **kind/k3d dev-cluster** bring-up | no — unrelated |
| `tests/Tests.FSharp/Plugin/Harness.Tests.fs` (`PluginHarness`) | **DBSP operator plugin** test driver | no — unrelated |

`HARNESS-SURFACES.md` is a genuinely load-bearing find and I had not expected it to be an *axis* document. Its
per-harness feature inventory is already decomposed into **Memory system · Skills system · Agents/subagents ·
Interaction surface · Cron/loop · Settings/config** — six headings that are, in substance, six of R1's eight
axes, discovered independently by asking "what does each harness expose?" rather than "what can be tuned?"

It also already declares a **primary comparison axis**: *skill-authoring plus an eval-driven feedback loop
(draft → with-skill vs baseline → quantitative + qualitative review → rewrite → re-run)*, described as the
feature that won Claude Code the harness-selection round. That is R4 and R5, written down in April.

## 1a. The loop has already run, and it returned a negative result

The three `harness-run-2026-04-20-*.md` documents execute exactly that loop on the **skill-activation** axis:
two prompts × {with-skill, without-skill}, four subagents, five graded assertions per prompt, measuring pass
rate **and** token cost over a whole response.

For `performance-analysis-expert`: **−20pp** on eval-0, 0pp on eval-1, **−10pp aggregate**, **+37% tokens**.
The skill made the agent worse and more expensive.

Three things about this matter more than the number:

- **The eval was designed so the baseline could win.** The `consent-primitives-expert` doc states the prompts
  grade *content correctness, not framework-naming discipline* — "so the baseline can score 5/5 by reaching
  equivalent answers via general knowledge." That is a check built to be able to fail, and it failed.
- **It was triggered by a correction**, not a plan: Aaron's *"make sure we are using those bad performance
  skill tools where it makes sense instead of trying to guess"* →
  `memory/feedback_skill_tune_up_uses_eval_harness_not_static_line_count.md`. Static line-count ranking was
  replaced by measurement.
- **Every run is N=1 per lane and says so.** Which is precisely where §5's correlation problem starts.

## 2. Where R1's axes already live — and the divergence

Per the correction, ours wins where it exists. Our decomposition is **OPLE** (Observe / Persist / Limit /
Emit), the framework's four core primitives, each already required to surface `T` **and** `TFeedback`.

| R1 axis | our surface today | OPLE home | state |
|---|---|---|---|
| instruction / prompt content | `.claude/rules/`, `CLAUDE.md`, agent front-matter | **none** — pre-loop | present as substrate, not as a typed axis |
| capability / skill activation | `.claude/skills/`, HARNESS-SURFACES §Skills | **none** — pre-loop | present **and measured** (§1a) |
| tool selection / routing | hooks, MCP, slash commands; Eve Protocol as the policy layer | Emit | present, untyped as an axis |
| memory storage / retrieval | AutoMemory/AutoDream; `memory/` hub+satellite; `MemoryBinding`/`MemoryLifetime` DUs | Persist + Observe | **already DUs** |
| per-call context assembly | session compaction; the cold-start-token discipline | Observe | implicit |
| control flow | `TickCyclePattern`, `Action`/`State`, `/loop` cron + dynamic modes | Emit | **already a DU** |
| verification and scoring | `ReviewLevel` + `determineReviewLevel`; auto-review pipeline | none | **present as a GATE, not a score** |
| resource limits | — | Limit | **genuinely absent**; `HARNESS-SURFACES.md` says rate limits are *"untracked at factory level"* |

**The divergence, stated plainly:** OPLE is four primitives and R1 is eight axes, and they do not nest cleanly.
OPLE covers five (routing, recall-storage, recall-retrieval, context, cadence, budget → Emit/Persist/Observe/
Limit). It does **not** cover *instruction content* or *skill activation*, because those configure the loop
before it runs rather than occurring inside it; and it does not cover *scoring*, because scoring ranks runs
rather than being a step in one. So OPLE is the right decomposition of the **running tick** and is not, by
itself, a decomposition of the **tunable surface**. The DU below keeps OPLE's five as OPLE's and adds the
three that sit outside it, annotated as such — rather than pretending eight fits into four.

## 3. The correction that matters: kind is orthogonal to layer

The brief's table:

| layer | dispatch does | failure if wrong |
|---|---|---|
| codegen over source types | soundness gate | Merkle roots diverge |
| target-native emission (#10774) | preference over equal options | unidiomatic, still byte-locks |
| agent-control layer | optimization axes | scores worse, nothing breaks |

The rows are right and the **indexing is wrong**. Layer and kind are separate coordinates, and the agent layer
already occupies the gate cell:

| | **gate kind** — wrong ⇒ unsound | **preference/optimization kind** — wrong ⇒ merely worse |
|---|---|---|
| codegen | capability dispatch (v2 §0) | — (#10774: no emission site offers a second candidate) |
| emission | byte-lock | idiom (#10774) |
| **agent** | **`ActionGate` · `ActionClass` · `ReviewLevel` · `determineReviewLevel` — shipped** | **the dials — this doc** |

`workflow-engine/types.ts` is unambiguous about which kind it is. `ActionGate` is `"append-only" | "pr-gated"`;
`ReviewLevel` runs `"trajectory-push" | "pr-review-light" | "pr-review-full" | "operator-required"`, with
`operator-required` reserved for things needing explicit human authorization. Those are permission decisions.
Getting one wrong does not score worse; it lands unreviewed code.

**Why this is a safety correction and not a taxonomy quibble.** If the optimization DU is described merely as
"the agent-control axes", the natural variant list includes *review level* and *permissions* — R1 explicitly
lists "permissions, safety" under resource limits. An optimizer with those in scope has a trivially winning
move: **turn the review bar down and the score goes up.** The optimizer would be working exactly as designed
while dismantling the thing that makes its own results trustworthy.

So the DU's central invariant is:

> **No dial may name a concern the gate owns.**

`GATE_OWNED` in `src/Core.TypeScript/tick-dial/tick-dial.ts` is that boundary as data; `proposeDial` refuses
rather than accepts; tests TD-3 … TD-6 check it, including TD-6, which admits an ordinary proposal so the
other three cannot be satisfied by a function that refuses everything.

**Two flagged corrections to R1 fall out of this:**

- **R1's "resource limits (token budget, compute, permissions, safety)" is split.** `budget` (tokens, compute)
  is a dial. **Permissions and safety are not** — they are gate-owned, and putting them in the same variant
  would have been the bug above.
- **R1's "verification and scoring" is split.** *Which checks run* (`verification`) is a dial. **The objective
  function is not.** A scorer that can tune itself is a fixed point of the wrong kind — `s = f(s)` running
  away rather than closing. `OBJECTIVE_OWNED` refuses it (TD-5).

## 4. The DU

Eight variants, our names, in `src/Core.TypeScript/tick-dial/tick-dial.ts`:

`framing` · `hat` · `routing` · `recall` · `context` · `cadence` · `verification` · `budget`

Closed in both directions, which is R2's actual requirement. `TICK_DIALS` is pinned to the union by
`satisfies` (array → union), and a conditional type pins the converse (union → array). Verified by mutation:
adding a ninth variant without registering it produces **two** compile errors, one of which names the missing
variant —

```
tick-dial.ts:97  TS2322: Type 'boolean' is not assignable to type '["TICK_DIALS is missing", "probe"]'
tick-dial.test.ts:58  TS2345: Argument of type '"probe"' is not assignable to parameter of type 'never'
```

— the second being the exhaustive `switch` failing at `assertNever`. That is the property Aaron asked for: a
new axis is a compile error at every site that must handle it.

## 5. R3, answered honestly: the seam is the feedback shape, not a shared enum

R3's test is whether `ace-cli.ts` and `mux-transport-bridge.ts` can both consume the abstraction without
either needing a special case. Taken literally — both importing `TickDial` — **the test fails**, and it should:
one module is a package dependency graph and the other is a byte transport. Neither has an opinion about
prompts or token budgets, and forcing the enum into both would produce exactly the special case R3 forbids.

What they genuinely share is a **shape**: *a proposal on one channel, a typed outcome on another.* That is
already the repo's idiom in both places, and it is OPLE's `T, TFeedback` requirement:

- **mux side.** `BatchAck` is `{kind:"received"} | {kind:"rejected"} | {kind:"backpressure"}` — a closed
  `kind`-tagged union of readonly records riding the feedback corner while `BatchFrame` rides the normal
  corner. `DialOutcome` is deliberately the same shape.
- **ace side.** Every ACE operation is a Z-set delta: `install` is `+1`, `remove` is `−1`, and `applyDelta`
  **deletes the key when the weight returns to zero**. That is R5's "reversible without residue", already
  shipped — a revert is a retraction, not a compensating write.

So the seam is demonstrated, not asserted. `MuxChannel<TN, TF>` is fully generic;
`muxChannelAsNetworkTransport` is one *specialisation* of it. The dial layer is a **sibling specialisation**.
Test TD-12 opens a real `multiplexedDuplexTransport<DialProposal, DialOutcome>` over a `localDuplexPair`,
sends a proposal on the normal corner, answers with an outcome on the feedback corner, and asserts the
round-trip — **with zero changes to any transport file.**

## 6. R4/R5 — what exists, what does not, and what would falsify this

**Exists:** the loop as a documented method with one negative result (§1a); the retraction mechanism (§5);
`SocietyUsefulWork.fs` for correlated aggregation; `ChaosEnv.fs` seeded `Buggify` for replayable perturbation;
`TravelerRankLedger.fs` for per-(traveler × hat-domain) ranking.

**Does not exist, and I am not going to imply otherwise:**

- **No trajectory runner.** The three April runs were driven by hand with subagents. There is no code that
  executes an axis comparison.
- **`db/sims/` contains a README and nothing else.** Neither `sim` nor `measure` is a shipped binary — the
  README specifies them ("we don't need `dotnet sim` — we just need `sim`"). `db/uncertainty/` holds one
  entry. So R5's instruction to *reuse the existing sim-vs-measure split* is reuse of a **convention**; the
  mechanism is not there. Building on it is right; describing it as existing infrastructure would not be.
- **Most dials have one candidate.** `hat` has two (with-skill / without, measured). Model selection has four
  listed. `recall` has two (AutoMemory adopted, AutoDream watched). The rest have exactly one realised value.

That last point is the load-bearing admission, and #10774 already supplies its rule: *dispatch with exactly
one applicable method is not dispatch.* Restated here: **an axis with one candidate is not an axis.** Rather
than leave that as prose, `proposeDial` refuses such a proposal with `single-candidate` (TD-7 … TD-9). Today
that refusal fires for most of the eight.

**What would falsify this design** (required by `toy-is-free-metered-must-be-earned`):

1. **A dial that cannot be varied without changing behaviour a gate governs.** If any of the eight turns out
   to be entangled with `ReviewLevel` or with authorization such that the disjointness cannot hold, the
   dial/gate split is wrong and the DU should not exist in this form.
2. **A ninth axis that is not expressible as a member.** Closedness is a claim about the world. If real work
   needs an axis outside the eight *and adding it is not just an edit*, the set was not the right set.
3. **A measured trajectory difference on a dial that the framework says is refusable, or vice versa.** If
   varying a `single-candidate` dial measurably changes outcomes, the candidate enumeration is wrong.
4. **The framework producing an improvement.** It has produced none. The only measurement in this family is
   negative. Until a dial change is proposed, applied, scored over trajectories, and *accepted* on evidence,
   this is a toy — the `toy` label is worn, not conceded.

**And the vacuity check, applied to myself.** An objective one can always define and always argmax is not a
method. The parts of this design that can actually fail are: the disjointness refusal (fails when a proposal
reaches the gate), the single-candidate refusal (fails today, for most axes), the compile-error closedness
(verified by mutation), and the mux round-trip (uses the real transport). The parts that cannot fail yet are
`ApplyDial`, `ScoreTrajectory` and `SettleDial` — which is why they are **type declarations with no bodies**
rather than stubs. A stub would have looked like progress.

## 6a. "N correlated runs are not N observations" has two correct answers

The brief said not to build a fresh scoring function assuming independence. Surveying `SocietyUsefulWork.fs`
turned up something sharper: the correction has **two distinct correct quantifications**, and picking the
wrong one is itself the error being warned about. Both are now in the module, with the difference tested:

- **`effectiveTrialCount n rho` — Kish.** For the **variance of a mean** across correlated runs. Design effect
  `deff = 1 + (n−1)ρ`, so `n_eff = n / deff`. Use when averaging a score over repeated runs of one config.
  *(Anchor checked: Kish 1965, `Survey Sampling` — deff is the ratio of the design's variance to simple
  random sampling of the same size, which is what entails `n_eff = n/deff`. It says nothing about coverage.)*
- **`unionEquivalentAgentCount n c rho` — the inverse of our own formula.** For the **coverage of a union**
  across correlated agents: how many independent agents would discover the same expected fraction of facts?
  Solved exactly against the shipped `expectedSocietyIdentical`, so it is pinned to that function rather than
  to restated algebra.

They agree at both endpoints (`n` at ρ=0, `1` at ρ=1) and **disagree in the interior** — at n=10, c=0.3,
ρ=0.5 they give 1.82 and 2.83. A test asserts the disagreement, because without it the pair could silently
collapse into one function and every other test would still pass.

**Anchor honesty on Sutton & Barto.** The return `G_t = Σ γ^k R_{t+k+1}` and the value function as its
expectation do entail R4 — *evaluation ranges over a trajectory, not a step*. That is the entailment claimed
and no more. They do not entail that any particular trajectory score is the right one, nor that taking an
argmax over it constitutes a method. **CLOS (Bobrow et al. 1988) and Julia (Bezanson et al. 2017)** entail
that multiple dispatch resolves by *specificity*, i.e. a preference order — which is why #10774 can call the
idiom axis dispatch. They entail nothing about optimizing under a learned objective, so they are not cited for
that here.

## 7. The bug: a locale in the proof lineage

`src/Core.TypeScript/ace/ace-cli.ts` — `graphMerkleRoot` sorts the entries and concatenates them into the
hash. It sorted with `localeCompare`.

```
locale : acme, alpha, Bravo, Zeta-core
ordinal: Bravo, Zeta-core, acme, alpha
```

`localeCompare` is culture-sensitive and linguistic, so the **collation is part of the proof lineage** and the
root is machine-dependent — the `081KT07NV0008QG0R001YDB73K` class (`culture-invariant-by-default`). The
sibling module `ace/build-graph.ts` already exports `ordinalCompare` carrying this exact reasoning:

> Deliberately NOT `localeCompare`: that is culture-sensitive and linguistic, so two machines can disagree on
> the order, which would make the affected-set output machine-dependent and break DST replay.

**Why 22 existing tests missed it:** every name in `STUB_REGISTRY` is lowercase ASCII, where the two
collations agree. The defect is only reachable via `applyDelta`, which accepts arbitrary names.

Fixed, with a falsifier: `ace-cli-collation.test.ts` builds a mixed-case graph and checks the root against an
independent ordinal reference. Under the pre-fix code it fails (`zeta:5e2ff1f1` vs `zeta:5929e3f1`); after,
it passes. The file also asserts its own premise — that the two collations genuinely disagree on this input —
so it cannot quietly become vacuous. **Only that first test is the falsifier**; the order-independence test
passes under both implementations and is a companion, not a proof.

**Deliberately not changed:** the second `localeCompare` in `list()`. That one sorts a human-facing listing,
and the rule says culture-aware comparison is a display concern to opt into at the edge. One of the two sites
is a genuine edge; the other was in the hash.

**Named follow-up, not done here:** `ordinalCompare` now exists in three places (`ace/build-graph.ts`,
`forge-host/github/pr-manifest-shards.ts`, and locally in `ace-cli.ts`). It is five lines with no leaf home.
Importing `build-graph.ts` — 1500 lines, `node:fs`, the git tracked-file walker — into a pure CLI module to
get a comparator would have been a worse trade, so this change takes the third copy and flags it rather than
refactoring under cover of a bug fix.

## 8. Pointers

- `src/Core.TypeScript/tick-dial/tick-dial.ts` — the DU, `GATE_OWNED`, `proposeDial`; `ApplyDial` /
  `ScoreTrajectory` / `SettleDial` declared unbuilt.
- `src/Core.TypeScript/tick-dial/tick-dial.test.ts` — TD-1 … TD-12, including the real-mux seam test.
- `src/Core.TypeScript/ace/ace-cli-collation.test.ts` — the collation falsifier.
- `src/Core/SocietyUsefulWork.fs` — `effectiveTrialCount` (Kish) and `unionEquivalentAgentCount`.
- `docs/HARNESS-SURFACES.md` — the third-party harness axis inventory (the R1 layer).
- `docs/research/harness-run-2026-04-20-{performance-analysis-expert,reducer,consent-primitives-expert}.md`
  — the loop, already run, negative.
- `src/Core.TypeScript/workflow-engine/types.ts` — the agent-layer **gate** this DU must stay disjoint from.
