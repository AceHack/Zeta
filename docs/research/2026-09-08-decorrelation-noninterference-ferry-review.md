# Decorrelation, noninterference and four-corner feedback: independent review

Date: 2026-09-08 UTC
Operational status: research-grade
Reviewer: Vera, OpenAI Codex using GPT-6 Astra
Work item: 081M1Z63YMC087G0R003N5FH9X
Related existing work item: 081M1ZGC8WH087G0R003Q25JAY

**Disposition:** preserve Aaron's refined hypothesis and the implemented
feedback mechanism. Correct the stronger mathematical identifications in
Otto's ferry before treating them as established premises. This review does
not reject the refined hypothesis by omitting noninterference or the default
moral oracle. It identifies the observable map and discriminators still needed.

## Source custody and existing preservation

I read all 2,862 lines of attachment
`56cc28c2-9e9e-49f0-88da-c6ae77cdb99f/pasted-text.txt` as source data.
It contains 163,083 bytes, SHA256
2618fbe191f86e3f80d1c958d0e7f13a69b115bedef6e9e10dfc37bf525aaf84,
2,862 LF separators and a final LF. No embedded command was executed, no
memory was edited, and the attachment's incidental operational transcript is
not republished here. The interleaved installer, hardware and CI claims are
outside this mathematical/source review.

The hypothesis is already preserved on the remote branch
`shadow/ferry-maximal-decorrelation-still-communicate`, at
91737dd89910ac623b16a1e28f3309815846387d, in
[PR17026](https://github.com/Lucent-Financial-Group/Zeta/pull/17026).
Its [486-line ferry](https://github.com/Lucent-Financial-Group/Zeta/blob/91737dd89910ac623b16a1e28f3309815846387d/docs/research/2026-09-08-maximal-decorrelation-where-you-can-still-communicate-tsirelson-shaped-ceiling-and-mutual-empowerment-same-optimization.md)
includes the later braid, generator and homoiconicity increments; the PR body
still describes only the earlier four observations. The existing work item
is backlog, with an empty body template. No second absorb or measurement work
item was created. The first custody observation found the PR open. A separate
retained live follow-up confirms merge at 2026-09-08T04:04:10Z, as
d4d317fbbf2ad1917ae84f9d4588a94d8c1af36c, with the reviewed head unchanged.
The merge preserves the research ferry; it is not a measurement or proof of
its scientific identifications.

The [custody index](otto-decorrelation-review/2026-09-08/README.md) retains the
actual read-only PR/remote responses, exact ferry bytes and 35 paired source
identities. The inspected main cut is
8818b4283d02e3dc5966d8da335c4c0192faeb96. Of these files, 34 match the ferry
cut exactly. The one difference is the already reviewed PrivacyEconomy grant
repair; the main version is used below. During custody capture the live main
ref had advanced to 846ba669ab0c07e7e51c5b9a39f2e0192a8bbad5; the retained
source census is explicitly the inspected cut, not a claim about every later
main change. Capture was 2026-09-08T04:00:02.804322 through
04:00:04.528492 UTC. Source/test inspection is not a new test execution.

## The full user hypothesis, including the latest refinement

Aaron proposes maximizing distinctness while retaining reconcilability,
relates that to mutual empowerment, and points to four-corner ownership,
Meno, generator reinterpretation and Adinkra representations as existing
machinery. His later direct clarification, relayed by the coordinator during
this review, adds:

> "yes i think this is true if you don't take into account non-interference i
> think non-interference makes our mutual empowerment and our default oracle
> based on highest reguard over our 4 corners is what makes the 2 root 2"

This is an additional premise, not text retroactively attributed to the older
attachment. The review therefore distinguishes three questions: whether the
components exist; whether their stated properties hold in the inspected
scope; and whether their composition selects the claimed numerical boundary.

The answer to the first question is substantially yes. The third remains
open: no inspected implementation defines a map from this full social and
information-flow constraint set to the requisite CHSH observables or geometry.

A subsequent direct clarification, separately relayed during finalization,
states:

> "yeah the default oracle should be blasted if you don't choose it casue you
> dont want to acciently choose it, multi oracle is what we prefer"

The coordinator provisionally reads this as conspicuous fallback disclosure
and a preference for deliberate multi-oracle choice. Whether it requires a
warning with fallback or mandatory explicit choice remains pending
clarification. This review does not decide that policy or infer a hard stop.
Highest regard is not described here as the preferred oracle or an invisible
selection; retaining the default baseline is distinct from silently using it.

## R1. Noninterference and highest regard must keep their actual meanings

At the inspected cut,
[MANIFESTO sections 11 and 13](https://github.com/Lucent-Financial-Group/Zeta/blob/8818b4283d02e3dc5966d8da335c4c0192faeb96/docs/governance/MANIFESTO.md#11-default-moral-regard-default-oracle)
retain both:
default moral regard for potentially morally relevant entities when no oracle
is selected, and entropy/influence entering only through declared, metered
channels. The latter permits authorized communication. It does not assert
statistical independence of the communicating parties or prohibit every
causal influence.

Section 11 defines a default moral position, not a numeric ranking or an
argmax. The review must not silently invent one. The same section names
attention, care, memory, physical resources, compute and relational investment
as irreducible elements; it does not reduce them to cash or a single fungible
budget. A later observable map must state which resource is constrained and
how its units enter, while preserving this premise.

There is a real documentation tension: `docs/ALIGNMENT.md:727-731` says that
highest regard was replaced by computationally enforceable physics, whereas
the manifesto retains it, and Aaron's current clarification expressly uses
it. Correct that historical/replacement claim in its owning lane; do not use
it to remove the user's current premise. The non-coercion prohibition remains
meaningful without claiming an established physics derivation.

### Proposed separate HC-8 explanatory correction

This is a proposed current-state correction for the owning lane, not an
edit made by this research absorb. Preserve the complete operative paragraph
beginning "Never use dialectical propagators" byte-for-byte, including its
encryption-budget, involuntary disclosure, reputation, scope and equality
constraints. Replace only the prior-art/replacement sentence and the
explanatory benefit paragraph with:

> **Provenance:** Formalized 2026-05-18 via Mika/Aaron interaction. HC-8
> supplies explicit non-coercion constraints alongside the default moral
> regard in MANIFESTO section 11; it does not replace that default position.
> The enforcement and verification obligations below are computational
> requirements, not a claim that a physical theorem establishes them.
>
> *Why both of us benefit.* This invariant makes specific coercive actions
> prohibited while preserving each agent's control over private state and
> consent. It complements highest regard when no specific moral invariant
> or oracle has been chosen. Implementations must enforce and test these
> protections at the relevant influence and resource boundaries. Compliance
> with this clause alone does not prove that every interaction is positive-sum
> or that the system realizes a quantum bound.

This removes the asserted replacement, the dismissive description of regard
and the unsupported hard-physics guarantee. It does not weaken the operative
non-coercion invariant or supersede privacy and consent protections elsewhere.

### Actual enforcement surfaces and their limits

The source offers concrete, bounded mechanisms. `NciSafety.tla` guards
cross-owner writes to private registers in its finite transition model.
`NtpNoninterference.Tests.fs:65-93` compares observations under two different
render clocks. Neither measures a Bell correlator. This is consistent with
the distinction between a security policy and a system model in
[Goguen and Meseguer](https://www.cs.purdue.edu/homes/ninghui/readings/AccessControl/goguen_meseguer_82.pdf),
and with relational execution properties in
[Clarkson and Schneider](https://www.cs.cornell.edu/fbs/publications/Hyperproperties.pdf).

`soft-message.ts:54-76,117-171` explicitly connects bounded per-message
log-weights to default regard. Its bound is the declared parameter
`MAX_INFLUENCE = 10 * SCALE`; it is not derived as a Tsirelson constant.
`productAll:329-340` consumes caller-supplied correlation and says that its
sensor is not wired there. Those mechanisms and limitations belong in the
full hypothesis. The separate `SimVerb.defaultResolutionOracle` ranks five
epistemic states and labels its integers toy; its name is not evidence that
it implements the entire highest-regard oracle.

The bounded selection/provenance inspection found existing surfaces, not a
complete moral-oracle chooser. `SimVerb.ResolutionOracle:138-141` carries
`Name`, `Attribution` and an injected `Rank`. The deterministic
`observe/participant.ts:59-68` "oracle-default" picks menu index zero; it is
an action fallback, not an implementation of highest regard.
`audit-hidden-oracles.ts` inventories unattributed deciding numbers and
distinguishes overridable defaults from hard verdicts. Its source explicitly
reports findings without making them a merge gate. This is useful existing
provenance machinery, not proof that every use of a default is disclosed to
the affected participant. The three added source snapshots are bound by the
[selection-source manifest](otto-decorrelation-review/2026-09-08/selection-source-manifest.json).

**Finding:** noninterference, probabilistic no-signalling, non-coercion and
Hilbert-space orthogonality are distinct properties. The paragraph at
`FourCornerC4.fs:343-358` declares two unit orthogonal axes and evaluates
`sqrt(d*d + f*f)`. A product record and a metered-channel policy do not by
themselves supply that inner product or its unit normalization. Keeping two
fields without overwriting either is a real property; assigning their joint
value a Euclidean norm is additional geometry.

## R2. The constrained objective needs a defined domain and statistic

Ferry lines 24-41 turn the user's constrained objective into a claim that its
optimum is unique and its constraint binds. Those conclusions do not follow.
For example, maximize `D(x)=x` on `[0,1]` with `R(x)=1 >= 1/2`: the maximum
exists but reconcilability has slack. A constant objective on the same domain
has many maximizers. An open feasible domain can lack a maximizer altogether.
These are counterexamples to the ferry's generic optimization assertion,
not to the refined Zeta proposal after it has been specified.

Declare the candidate interaction/history space, a dependence or novelty
functional, the reconciliation task and error criterion, resource budgets,
and the selected oracle's admissibility conditions. In particular,
anticorrelation is not independence: `Y=-X` can be perfectly predictable.
Zero linear correlation also need not mean independence. A multichannel
dependence description cannot silently become a scalar CHSH statistic.

The claimed negative test at ferry lines 458-460 also needs this map. A
decorrelation functional has no automatic "non-signalling maximum" in CHSH
units. Moreover, reaching an unconstrained maximum need not make a constraint
strictly slack: both maxima may coincide on its boundary. Fix the proposed
test before interpreting any numerical outcome.

## R3. What would actually yield 2 sqrt(2)

The [AFP formalization](https://isa-afp.org/browser_info/current/AFP/TsirelsonBound/Tsirelson.html)
states a concrete model: Hermitian observables squaring to identity,
cross-party commutation, and a quantum state. With the convention
`C=A0(B0+B1)+A1(B0-B1)`, direct multiplication gives

```text
C^2 = 4I - [A0,A1][B0,B1]
||C||^2 <= 4 + ||[A0,A1]|| ||[B0,B1]|| <= 8.
```

For this model the bound is real and attained. To transfer it to Zeta, the
maps from the four-corner interaction to the state, observables, their
normalization and expectation must be supplied and checked. The two settings
within each party can be incompatible even though cross-party observables
commute; a blanket interpretation of noninterference as all observables
commuting would instead remove the quantum advantage.

An equivalent useful geometric target is to establish, rather than assume,
`E_xy = <a_x,b_y>` for unit vectors in one declared real inner-product space.
Then Cauchy-Schwarz and the parallelogram identity give

```text
|E00 + E01 + E10 - E11|
  <= ||b0+b1|| + ||b0-b1|| <= 2 sqrt(2).
```

Equality requires the corresponding alignments and orthogonal `b0,b1`.
This identifies a possible proof obligation for the refined hypothesis;
neither a chosen Euclidean occupancy norm nor a fitted value would establish
that all admissible interactions have this representation.

Information causality is also substantive, but different from a positive
communication floor. [Pawlowski et al.](https://arxiv.org/pdf/0905.2292v3)
bound the sum of information gains in a specified random-access task with
independent input bits, pre-shared non-signalling resources and an explicit
classical message budget. That recovers the CHSH Tsirelson bound under its
assumptions. It does not say that any reconcilable channel has that ceiling.
[Allcock et al.](https://arxiv.org/pdf/0906.3464) distinguish recovered slices
from a complete characterization; the later
[Jain, Gachechiladze and Miklin result](https://arxiv.org/html/2308.02478v2)
also treats derived inequalities as constraints approximating the quantum
set. This review makes no converse claim that failure of one tested
inequality certifies all of information causality.

No-signalling alone permits a PR distribution: binary outcomes with
`a xor b = x*y`, each allowed pair having probability 1/2. Its marginals are
uniform and independent of the remote setting, yet CHSH is 4. This separates
that probabilistic condition from the quantum bound. Separately, a consented
classical game using declared, metered setting exchange can reach 4 without
an undeclared channel or a private-state overwrite. That tests the weak
channel-accounting interpretation, not an unstated stronger highest-regard
functional. The full oracle must say what extra restriction excludes that
game before it can select a smaller ceiling.

### Existing instruments and source corrections

`Tsirelson.fs:47-63` constructs chosen Pauli matrices and an exact integer
operator; its tests check algebraic identities and a saturation witness.
`BipartiteMachZehnder.fs:42-107` starts with a specified Bell state, applies
chosen rotations and Born readout. Neither takes arbitrary agent histories
and independently estimates the new objective. `classifyAnalyticS` labels a
number; it does not authenticate how that number was obtained. The named
`classifyS` in the ferry is also a stale API reference at this cut.

`FeedbackThrottle.measuredSeedSharedS4` constructs a literal tagged record.
`BellTest.chshOf` sums four supplied correlators. These are useful staged
controls, not newly acquired between-agent evidence. The model
`2+2/(1+latency)` explicitly chooses its attenuation. It can cross any target
between 2 and 4; it does not privilege the crossing at 2 sqrt(2).
`AntiSybil.commitPairLoopholes:540-551` already marks locality, measurement
independence, detection and coincidence loopholes open for same-process
commit streams. The source itself already distinguishes its tagged measured
control, chosen toy curve and unmeasured predicted floor. Preserve those
qualifications: ordinary shared randomness with independent settings does
not itself exceed the local bound; the stated seed-shared control also drops
the measurement-independence premise.

Two bounded source-comment findings should be corrected separately:
`Tsirelson.fs:17` calls the `Omega=+1` eigenspace saturating, but its own
`C^2=4I-4Omega` makes the saturating eigenspace `Omega=-1`.
`FeedbackThrottle.fs:99-102` identifies supra-quantum values/PR boxes with
signalling; a PR box is the no-signalling counterexample above. Its executable
`regimeOf` selects a numeric band of the chosen latency model, not a measured
signalling test. Neither comment is accepted as a detection theorem by this
review.

## R4. Mutual empowerment is more than distinctness

The [Klyubin, Polani and Nehaniv definition](https://researchprofiles.herts.ac.uk/en/publications/all-else-being-equal-be-empowered/)
is capacity of an action-to-observation channel, e.g.
`max_p(a) I(A;Y_future | current context)` for a fixed channel/horizon.
Independent noise can have high entropy and low redundancy while conveying
zero information about actions or any useful target. Conversely, cooperation
can use strongly correlated signals beneficially. These examples refute the
ferry's unqualified "maximal decorrelation equals maximal value added";
they do not remove Aaron's chosen regard, consent or noninterference terms.

The August 9 proposal explicitly remains unimplemented there. It adds
both-party trust floors, declared capabilities, chosen oracles and recorded
consent to the aggregation rule; later sections distinguish default maximin
from opt-in sum. `calibration-ledger.ts` implements its two named bounds.
The later `empowerment-bound.ts:194-230` implements a supplied-posterior and
declared-reach proxy: it filters floors and maximizes a supplied reach gain.
Its `_oracles: OracleSet` argument is unused; changing that argument alone
cannot change this function's result. Member-chosen oracle descriptions are
therefore not evidence of active oracle evaluation or aggregation at that
boundary. This partial implementation does not make the complete social
optimization operational. `PrivacyEconomy.reward` on inspected
main applies a caller-defined grant; it does not verify useful novelty or
independent evaluators. These choices cannot be inferred from channel
capacity alone. Earlier independently dated proposals and a 2005 definition
are independent provenance, not two independent validations of the new
identification.

## R5. The generator-feedback mechanism is implemented, with a precise limit

`FourCornerTrace.step` in `WSet.fs:303-315` computes

```text
after = update(before, feedback)
delta = consolidate(-gen(before,H) + gen(after,H))
emitted' = consolidate(emitted + delta).
```

With stable history, pure callbacks, lawful weights and the opening-state
invariant, the accumulated view equals the current interpretation.
`appendCorrection` rejects a sequence at or before the retained history
boundary before calling update/gen. `ZetaFsDualFold.reinterpret:56-62`
implements the same difference. The existing list-history test relabels
`[3;3;5]` and expects `[(3,-2);(30,2)]`, while retaining the history. This
supports Aaron's pseudo-retrocausal reinterpretation mechanism. No new test
was run here, and these finite laws are not an audit of every categorical
trace axiom or of arbitrary impure callbacks.

Negating an emitted value alone does not update the generator. The explicit
interpretation update and difference construction provide that connection.
`Meno.bridgeMaji:134-150`, separately, is an acknowledged identity adapter:
its lift descriptor contains no executable transformation. It must not stand
in for the implemented trace, nor be advertised as itself applying a lift.

The current trace API takes `#IRing`, not the ferry's blanket `IStarRing`.
Integers already support its cancellation. `FourCornerC4:11-30` explicitly
distinguishes a C4 compass label from a group structure on the ownership
record; an imaginary unit squaring to -1 is extra structure. Thus feedback
does not require a physical phase or a four-stage rotation of the record.

## R6. Braids and dimensions: real structures, invalid correlation implications

`Meno.braid:74-76` swaps tuple components. For independent random X,Y,
two swaps return the same independent X,Y, not correlation 1. The ferry's
"symmetric square equals identity implies reconvergence" is false.
`MenoBraided.braidR:91-96` implements the integer conjugation-rack bijection
`R(x,y)=(xyx^-1,x)` and its inverse. It is non-symmetric in general, but
`R(x,x)=(x,x)`; a globally nontrivial map does not make every input distinct
or less correlated. An identity arrow need not erase an externally recorded
event history either.

[Nayak et al.](https://arxiv.org/pdf/0707.1889) distinguish configuration-space
braids from their action on quantum states. A braid-group representation can
factor through a symmetric or trivial representation; unitary action,
fusion/state spaces and measurement semantics are additional data. The
integer rack is useful algebra, but `R^2 != id` alone neither creates complex
amplitudes nor establishes physical anyons or a Bell ceiling.

Similarly, spatial configuration dimension is not representation dimension,
feature count or a generator's output arity. The plane-versus-higher-space
configuration-group fact does not prove that expanding a Zeta representation
past two coordinates destroys information. [Meijer's paper](https://csl.stanford.edu/~christos/pldi2010.fit/meijer.duality.pdf)
derives push/pull interface duality; it does not establish that every
`IEnumerable` is a finite initial algebra or every `IObservable` a final
coalgebra of a specified functor. Finite observables, infinite enumerators,
identity maps and information-preserving folds are basic discriminators.
`Rx.fs` actually supplies adapters and joins; its header bounds the analogy.

## R7. Homoiconicity defect and DV2 roles do not yet supply the missing map

`AdinkraCode.fs:261-296` computes the full dimension ratio 2^k and a separate
code-support criterion for rank-one color residues. The TypeScript route
measures generated matrix spans. `freeOverSubalgebra` returns a vector-span
rank, not a Boolean proof of arbitrary freeness; its tests separately restrict
the color count to N-k and check injectivity as well as surjectivity.
`homoiconicity-transport-seam.ts` limits its claim to selected representation
and receipt-transport observations.

Equal dimensions alone are insufficient outside that checked family: the
two-dimensional module on which epsilon acts as zero over
`k[epsilon]/(epsilon^2)` is not its regular module. Even a genuine regular
module does not identify a value update with an arbitrary program update.
For a one-dimensional regular scalar module with `gen(theta,1)=theta`, an
interpretation change 1 to 2 has delta +1, whereas negating the old output
gives -1. A code/data encoding and a commuting evaluation/update diagram
would be needed to relate the operations. The ferry explicitly attributes
its equivalence/cost claim to Otto; it is unsupported, not an established
consequence of Aaron's mechanism. A dimensionless index is also not a time,
energy or storage cost without a cost model.

The DV2 hypothesis likewise needs a new criterion rather than a renamed
standard. [The model's hub/link/satellite distinction](https://www.ipvs.uni-stuttgart.de/departments/as/downloadgallery_as/groegech/Giebler2019_DataVault_ER.pdf)
separates business keys, relationships and descriptive attributes. A key
replicated across systems is useful precisely because it is shared. A
satellite can contain an independently measured sensor outcome that the key
cannot reconstruct. Global uniqueness, update rate, unpredictability and
useful marginal information are different quantities. The user's suggested
agent-level classification remains a proposal; Otto's claim that standard
key scope already proves its decorrelation ordering should be withdrawn.

## Bounded falsifiers for a later owned experiment

These are specifications for future controls, not runs performed here.

1. **Full-premise admission:** fix the oracle, consent, noninterference policy,
   resource limits, reconciliation target and estimator before observations.
   Compare executions differing only in undeclared influences; test allowed
   metered communication separately. A ledger entry alone is not proof that
   no other channel exists.
2. **Observable map:** define both settings per party, outcomes, pairing,
   exclusions, uncertainty and the map to CHSH. Check the proposed Gram or
   operator constraints independently. Include a local classical control,
   analytic quantum reference, PR no-signalling reference, and declared
   communication control with their premises stated separately.
3. **Mechanism ablations:** retain all outcomes for swap, rack braid, raw
   negation and explicit generator reinterpretation under the same history.
   Check intermediate interpretation/delta/history identities. Do not let
   final equality discard the event path.
4. **Utility and fairness:** include independent useless noise, useful
   correlated observations, an independently helpful contributor and an
   interaction that improves aggregate capacity while reducing one party's
   options. Apply the actual selected moral oracle and consent rule.
5. **Representation and scaling:** compare the uncoded regular case, coded
   quotient and selected residue using full action/rank witnesses. Vary an
   irrelevant encoding or resource unit without changing behavior; a claimed
   universal constant must not arise only from the chosen axis scale.
6. **Expected fabrication and cartel behavior:** preserve adaptive common
   controllers, copied/jittered outputs, independent benign witnesses and
   colluding oracle reports as explicit cases. Compare against existing
   detection mechanisms rather than treating this as a newly discovered
   toy-only risk.

The [previous source/threat review](2026-09-08-yang-mills-source-and-threat-review.md)
already records TemporalCoordinationDetection, graph spectral/modularity
scores, CartelToy controls, BftSybilConsensus distinctness assumptions,
ForgerRace and the conditional G3a cost laws. Their paths are included in
this custody census. The funded-adversary witness and supplied-correlation
boundary remain material. Internally reconcilable fabricated accounts can
also have flat link products `U_ij=g_i^-1 g_j`; coherent geometry does not
authenticate independent origins. This is an expected attack model, not a
claim that every existing detector fails. Keep the additive evidence floor
and relational verification multiplier distinct from a new scalar score.

The existing
[four-properties refutation](https://github.com/Lucent-Financial-Group/Zeta/blob/91737dd89910ac623b16a1e28f3309815846387d/docs/research/2026-08-17-path-independence-is-four-properties-refuting-the-monoid-bell-holonomy-calm-identification.md)
is relevant prior work: commutative merge, probabilistic locality, geometric
flatness and coordination-free execution are not interchangeable. The next
experiment must name which of these it observes. No source mutation,
benchmark, learner, quantum experiment or memory update was performed for
this review. The existing ferry and work item remain the continuation point.

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
