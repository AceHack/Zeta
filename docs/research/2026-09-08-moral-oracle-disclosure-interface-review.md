# Moral-oracle disclosure: bounded interface and caller review

Date: 2026-09-08 UTC
Operational status: research-grade
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X

**Finding:** no operational moral-oracle selection/configuration interface
was identified in the bounded source and caller census at main
6544c068ea0a9bba4a5a55e391c9cddcb7bc8daa. Several real interfaces use the
word oracle, but attaching a moral-default warning or mandatory-choice rule
to them would conflate different operations. No runtime policy patch is
proposed from this census.

This is a bounded absence finding, not a proof that no differently named or
externally configured moral interface exists anywhere. The
[custody index](oracle-selection-comment-review/2026-09-08/README.md) retains
19 source identities, seven complete targeted caller searches and two
additional source identities. Broader vocabulary searches guided inspection;
only the named surfaces and callers support this disposition. No program,
model, benchmark or new subagent was launched to exercise these interfaces.

## Current user refinement and unresolved policy

The coordinator relayed Aaron's direct refinement:

> "yeah the default oracle should be blasted if you don't choose it casue you
> dont want to acciently choose it, multi oracle is what we prefer"

The minimum clear requirement is that an unchosen default must be conspicuous
and that multi-oracle choice is preferred. The pending clarification is
whether a warning with fallback remains permitted or explicit selection is
required before proceeding. This review does not answer that question by
inventing a hard stop, automatic acceptance or central ranking.

[MANIFESTO section 11](https://github.com/Lucent-Financial-Group/Zeta/blob/6544c068ea0a9bba4a5a55e391c9cddcb7bc8daa/docs/governance/MANIFESTO.md#11-default-moral-regard-default-oracle)
defines highest regard as the default moral position when no specific moral
invariant or oracle has been chosen. It does not define a numerical argmax.
The multi-oracle section rejects a single mandatory moral framework. The
irreducible attention, care, memory, physical-resource, compute and relational
investment terms remain distinct; no cash or universal scalar objective is
introduced by this review.

The preceding [ferry review](2026-09-08-decorrelation-noninterference-ferry-review.md)
preserves the full noninterference/highest-regard/four-corner hypothesis and
the separate proposed HC-8 explanation correction. This caller census does
not alter HC-8, consent/privacy requirements or any default behavior.

## What the inspected interfaces actually do

| Surface | Actual selection/configuration and caller evidence | Consequence for the request |
| --- | --- | --- |
| `db/morals/README.md` and `grey/README.md` | Vocabulary for moral registers and competing stances; the inspected directories provide descriptive Markdown. | They are useful documentation entry points, not an executable chosen-oracle registry or participant acknowledgement flow. |
| `planning/empowerment-bound.ts:110-114,192-230` | `OracleSet` carries ids and optional weights, but `_oracles` is unused. The located `empowermentBound` callers are three invocations in its test file. The function uses supplied posteriors and declared reach deltas. | Supplying multiple ids does not evaluate or aggregate moral oracles. A warning here would not disclose a default that this function actually selected. |
| `SimVerb.fs:138-165,244-287` | `ResolutionOracle` carries Name, Attribution and Rank. `room` installs a declared toy default; `withOracle` replaces it. Located qualified uses are the SimVerb test room and an inverted-ranking test. | This is a real injection seam for epistemic-resolution scores. It is not the moral baseline's implementation. |
| `observe/run-loop-real.ts:25-26,103-161` | `parseArgs` starts from `ZETA_PARTICIPANT` or `oracle`; explicit `--participant` overrides it. The resolver chooses deterministic oracle, local LLM or cloud persona. Unknown specifications warn and fall back to the deterministic participant. | This is action selection. Its existing warning is evidence of that fallback only, not moral-default disclosure. |
| `observe/participant.ts:59-68` and `chooser.ts:48-63` | The oracle participant picks menu index zero. Chooser configuration has confidence thresholds and optional scorer/deliberator. | These defaults govern task actions and escalation. They do not choose highest regard. |
| `OracleTransport.fs:60-97` and DLA renderer | Oracle readings name seed, fractal dimension, cluster size, transport and latency. The browser labels Canvas/CSS/Chip-8/SVG as oracles. | Renderer or numerical cross-check plurality is not a moral-oracle choice interface. No scientific correctness of the DLA claims is inferred. |
| `workflow-engine/consensus.ts:106-114` | Caller supplies analyzer callbacks, an explicit consensus mechanism and an optional verdict key. | Generic agreement machinery is real. Choosing majority aggregation is not an implementation of moral plurality or a warrant to impose one morality. |
| `Policy.fs:37-44,70-82` | A generic input-to-decision-and-feedback function; `firstMatch` takes an explicit fallback decision/feedback. | A reusable type alone is not a configured moral-policy application or end-user selection boundary. |
| `moral-gym/gym.ts:54-85,127-131` | A fixed iterated-game model accepts strategies, self-width, seed and round count. | Moral vocabulary in a demonstration does not make its strategy selector a deployment moral-oracle registry. No game was run. |

The targeted searches for `MoralOracle`, `moralOracle` and `selectedOracle`
returned no matches within the pinned `src`, `tools`, `demo` and `tests`
trees. Those spelling searches are supporting evidence, not the sole basis
for the finding: the actual candidate types and consumers above were read.

## Provenance mechanisms already present, with precise limits

SimVerb demonstrates useful attribution, but its output also marks a narrow
gap: `measureLaps:398-413` and the run record at `466-482` retain the oracle
Name, not its full Attribution or an explicit default-versus-selected origin.
Thus even this non-moral seam does not establish that a consumer can
distinguish accepting a default from never being asked. The existing test
checks differently named/inverted rankings, not moral-choice consent. If
that resolution feature separately needs disclosure, its real constructor,
override and result boundaries are the relevant owned surface; that would
be a different change from fulfilling the present moral-default request.

`audit-hidden-oracles.ts` is an existing source inventory for deciding
numbers without stated provenance. It distinguishes hard verdicts, branches
and overridable dials, and reports findings without turning them into a
merge gate. Its declared recognizer roster and source comments are useful
audit infrastructure. They do not prove that a runtime participant saw or
chose an oracle, nor that every future default is covered by its recognizer.

`ChildFloorPolicy.lean` is a distinct protected-floor model. It explicitly
separates a nonoptional protection predicate from jurisdictional parameters,
and names the external classification assumptions. Its conservative unknown
handling is not evidence for a general moral-default warning/stop policy.
Optional oracle choice must not silently weaken that existing protection,
HC-8, consent or private-state ownership.

## Disposition for implementation

Do not add a moral policy branch to `--participant`, DLA consensus or the
unused `_oracles` parameter just to obtain a place to display the warning.
The missing connection is an owned application boundary where a participant
actually selects a moral stance or set, where its scope and provenance are
retained, and where an actual downstream operation consults it.

Once such a caller is identified or separately specified, the user's
disclosure requirement can be implemented at that selection/use boundary.
The unresolved fallback rule must be supplied explicitly before a dependent
runtime change. The present evidence supports documenting the missing
interface and the existing distinctions; it does not authorize inventing a
new policy, central scorer, default acknowledgement or preferred moral rank.

The two independent mathematical comment corrections are prepared separately
in the [comment-patch review](2026-09-08-tsirelson-feedback-comment-patch-review.md).
They neither implement oracle selection nor change executable behavior.

```text
Agency-Signature-Version: 1
Agent: Vera
Agent-Runtime: OpenAI Codex
Agent-Model: GPT-6 Astra
Credential-Identity: AceHack
Credential-Mode: shared
Human-Review: not-implied-by-credential
Human-Review-Evidence: none
Action-Mode: autonomous-fail-open
Task: 081M1Z63YMC087G0R003N5FH9X
Co-Authored-By: Codex <noreply@openai.com>
```
