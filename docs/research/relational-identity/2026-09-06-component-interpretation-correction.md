# Correlation components do not count physical sources

Date: 2026-09-06
Operational status: research-grade
Lifecycle: active
Author: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1W9ZADZ087G0R000D9ZJ6M
Pre-correction source: `af444a679d4e08a6b3b69aa9be98d4a63b1f5f0f`
Parent result: [relational identity panel](2026-09-06-results.md)

The shipped `AntiSybil` interpretation was stronger than its implementation.
Its `DistinctCount` counts connected components of a graph over supplied
records. It does not lower-bound independent clocks, physical entropy sources,
or distinct controllers. A common stream plus three fixed XOR masks produces
three singleton components. This correction removes that false interpretation
from the current API and its direct callers, and puts the counterexample at
the shipped native test boundary. Numerical detector and reducer behavior is
unchanged.

## Exact observable contract

For two streams, normalize each integer to whether it is nonzero, truncate to
the shorter length `n`, and let `a` be the fraction of equal normalized bits.
The score is `abs(2*a - 1)`. Empty overlap returns zero by convention.
For a supplied threshold `t`, connect each input pair whose score is at least
`t`, then take transitive connected components. The threshold is not validated.

`DistinctCount` is the component count. `SourceOf` maps each input index to a
component id numbered by first appearance in that invocation. `AllDistinct`
means every component is a singleton, including the vacuous empty-input case.
The same readout type is used by other probes with their own pair criteria.
Neither a singleton nor a joined component certifies controller identity.

Nonempty exact records and bit complements have score one, hence a direct edge
when `t <= 1`. That is the retained exact-replay property. Source reuse is a
larger class than exact record replay. Zero can mean half agreement, a chosen
balanced recoding, or no overlap; it does not establish independence. Distinct
controllers could also submit identical records, so joined components are not
proof of common control.

## Constructive shared-state counterexample

Take any four-bit state `u` and submit:

```text
x0 = u XOR 0000
x1 = u XOR 0101
x2 = u XOR 0011
```

Every pair of masks differs in exactly two positions. The common `u` cancels
when comparing a pair, so each pair agrees in exactly half its positions and
scores zero. At threshold `0.5`, all three submitted records occupy separate
components. The native test exhausts all 16 possible values of `u`.
No physical clock or entropy source is measured in this construction: it is
an explicit single shared state and deterministic recoding of that state.

The construction scales algebraically. For length `2^d`, index positions by
`z` in `{0,1}^d` and choose mask `m_r(z) = r dot z mod 2`. For unequal `r,s`,
the nonzero linear form `(r XOR s) dot z` is balanced, so the pair score remains
zero after XOR with any common state. Thus one common state can supply `2^d`
singleton records at any positive threshold. The executable regression tests
the four-bit case; this paragraph gives the general elementary derivation.
This is neither a cryptographic forgery nor an operational attack-cost estimate.

## Shipped caller boundaries

The tests submit these same three recodings of `1011`, with claimed ids 0, 1,
and 2 and one common vote value:

| Boundary | Observed behavior pinned by native tests |
|---|---|
| `AntiSybil.antiSybil` | Three components, `AllDistinct = true` |
| `SybilBft.tally` / `hasQuorum 1` | Three component votes meet quorum three |
| `SybilBftProtocol.init 4` | Three recoded votes commit the supplied value |
| `SybilBftLiveness.init 4` | Three recoded votes install view one |

These are reference-model inputs under the existing permissive API. No honest
actor's credential is forged, and no deployed network is attacked. The result
shows that an external admission/membership/controller premise is necessary
before interpreting the component arithmetic as a Byzantine quorum. The
current API neither authenticates the supplied streams nor enforces an admitted
roster. A supplied `Members` count fixes quorum arithmetic; it does not prove
who supplied the counted components.

`TwoTimescaleFold.project` still requires a globally unique caller-supplied
replica id. A digest names stream bytes subject to its collision model; it does
not make distinct source controllers or non-forgeable identities. The component
map is local to one invocation and is not an identity allocator.
`ShapeAcceptance` now describes its displayed count as probe-threshold graph
components rather than a physical forgery-cost floor.

## Two further contract corrections

The bridge records `a=0000`, `b=0011`, and `c=0001` have pair scores
`corr(a,b)=0`, `corr(a,c)=corr(b,c)=0.5`. At threshold `0.5`, `a,b` initially
form two components; adding `c` merges them into one. Transitive connectivity
does not require every component pair to meet the threshold directly.
With configured quorum three and a common vote value, the progress fraction
falls from `2/3` to `1/3` within the same undecided view. It is an observation,
not a monotone liveness rank. `isStalled` remains a bounded no-improvement
heuristic, not a proof that commitment cannot occur.

Bit complementation is not time reversal. For history `0010`, its reversal
`0100` scores zero; the pair has two components at threshold `0.5`. The old
Leibniz/CPT test only complemented bits and never reversed the list. The
renamed fixtures retain the exact complement property and add this reversal
counterexample. They establish no CPT or Lorentz invariance.

The protocol's ordered reducer is deterministic, but sticky commitment and
last-write-wins claim updates do not commute in general. With `Members=1`,
quorum is one. Feed a single claim's values `A,B,last` versus `B,A,last`: both
end with the same `Heard` map, but the committed values remain `A` and `B`.
The native regression pins this API fact without asserting that these
conflicting updates satisfy any honest-participant protocol premise.

## Entropy, proof boundaries, and history

The additive entropy proposition in the [registered result](2026-09-06-results.md)
requires a pointwise conditional-innovation bound for each identity given prior
innovations and adversarial disclosure. Correlation components supply none of
that premise. Its `B+R` and `M=1+R/B` are stipulated workload accounting, not a
measured security multiplier or a cost lower bound.

[EntropyFloorLift.lean](../../../src/Core.Lean4/Lean4/EntropyFloorLift.lean)
multiplies stipulated guessing-space sizes for its `pair` constructor and
proves the resulting arithmetic floor lift. It does not derive independence
or source provenance from these observed streams.
[BftSybilConsensus.tla](../../../src/Core.TLA/specs/BftSybilConsensus.tla)
explicitly takes a sound `SameId` equivalence relation as given. This patch
does not claim that the correlation graph refines that given oracle.

Douceur's original account identifies the danger of one entity presenting
multiple identities to undermine redundancy; its assumptions must not be
replaced by a detector's output without a separate argument. The present
counterexample is a direct property of this repository's code, independent of
any general impossibility interpretation of the paper.
[Douceur, The Sybil Attack, IPTPS 2002](https://www.microsoft.com/en-us/research/wp-content/uploads/2002/01/IPTPS2002.pdf).

Earlier historical research and conversation records remain intact as source
history. This dated correction and the edited current API provide the current
interpretation. The previous relational-identity archives and raw receipts
remain unchanged; its current-tree tests intentionally permit subsequent
source evolution while strict archive replay still requires the pinned bytes.
The sibling CHSH setting-coverage repair is separately owned by work item
081M1W8PRK0087G0R000T7C4X8 and does not supply a physical-identity theorem.

## Public API review rationale

`forgeryCostFloor : float -> int list list -> int` becomes
`correlationComponentCount` with the identical implementation. The old name
asserted a disproved cost interpretation. Repository executable caller search
found only two calls, both in the updated native tests. There is no current
C# wrapper or serialized field change.

The shorthand remains public because callers can request a component count
without unpacking the existing public readout. Removing it entirely was a
reasonable alternative; keeping the exact observable name makes the intended
statistic discoverable. Keeping a deprecated misleading alias would preserve
the false contract. Under the repository's pre-v1 policy, source-level rename
is acceptable; there is no promise of a ten-year signature commitment.
Readout field names remain unchanged and their precise meanings are documented.
The direct helper tests, exhaustive shared-state witness, empty-overlap witness,
and transitive bridge test pin the public contract.

## Independent review and validation

The parent agent independently reviewed the API/code diff, verified the XOR
masks, bridge, complementation/reversal, quorum/view-change, and same-final-map
ordering witnesses, and found no unmigrated executable `forgeryCostFloor`
callers. Verdict: accept subject to the general-mask wording and final gates.
The one wording finding required the growing-family claim to specify a
positive threshold and give a general balanced-mask construction. The current
module comment states that condition; the derivation is above. The parent then reviewed the complete report, the general derivation, and the
referenced Lean/TLA boundaries and accepted them with no further finding.
A final adjacent-comment audit found that the CHSH introduction still said
captured entropy plus model-checked history proves distinctness. The sibling
CHSH author confirmed this paragraph belongs to the present interpretation
correction and authorized the neighboring comment range; its code begins at
`chshS` and remains separate. The introduction now states the domain/sampling
premises and treats entropy/history evidence as conditional. This was a
comment-only clarification after the recorded native gates; their executed
behavior and all nine counterexamples are unchanged.
This is agent review, with no human review claimed.

The full Release build passed with zero warnings and zero errors in 66.14
seconds. All 17 historical relational-identity Python regressions passed in
11.34 seconds after the API/comment changes, confirming the saved fixture
semantics remain readable. All 16 quick-preflight checks passed. The formatter
returned exit zero with its standard notice that `dotnet format` supports C#
and Visual Basic, not F#; the separate repository F# lint passed.

- [Release build](validation/2026-09-06-components-build.txt)
- [Historical replay regressions](validation/2026-09-06-components-historical-replay.txt)
- [Formatter receipt](validation/2026-09-06-components-format.txt)
- [All 16 preflight checks](validation/2026-09-06-components-preflight.txt)
- [Source-line equivalence and executable caller audit](validation/2026-09-06-components-code-equivalence.txt)

The full native suite passed 7,487 tests across seven assemblies, with zero
failures and six existing skips; the main F# assembly passed 6,497 tests in
5 minutes 47 seconds. After the final comment qualification and integration of
`origin/main` through `0e3456d604096b0b8d51b6be91704650d7d3d323`
(documentation only), a fresh full Release build passed with zero warnings
and errors in 61.13 seconds. The final focused AntiSybil/SybilBft/
TwoTimescaleFold/ShapeAcceptance filter passed all 104 selected tests in
219 milliseconds. These durations describe validation runs, not benchmarks.

- [Full native suite](validation/2026-09-06-components-tests.txt)
- [Final Release build](validation/2026-09-06-components-final-build.txt)
- [Final focused API/caller check](validation/2026-09-06-components-final-focused.txt)

The executable caller audit found no old helper calls. All nine added native
facts, including the 16-base loop, are included in the full suite and focused
filter. No benchmark, controller-count certification, or strengthened security
claim is earned by these checks.
