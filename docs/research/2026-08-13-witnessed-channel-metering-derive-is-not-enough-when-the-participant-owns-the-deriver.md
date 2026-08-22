# Witnessed channel metering — "derive, don't declare" is not enough when the participant owns the deriver

**Ferried** 2026-08-13 from Aaron, sharpening the Arena capability-label design in
`2026-08-13-tit-for-lesser-tat-teach-play-and-the-arena-noise-is-not-defection.md`:

> yes in tournments the meter of observed channels shuld be cryptograpcally observed by witness or quorm
> via like riticulum or some transport layer even if it's in memory, it should not be self attested
> except for when doing local non tournment experiment and those wont be able to be signed by third
> party whitness sign off like the torunments

## The name for it: **ranked vs unranked** (Aaron, 2026-08-13)

> this is like ranked vs non ranked matches

That is the right name and it should be the one used, because it is already understood by everyone and
it carries the properties correctly without further explanation:

- **Ranked affects standing; unranked does not.** An unranked result cannot be submitted to the ladder —
  not because it is disbelieved, but because it is not that kind of result.
- **Nobody reads unranked as lesser play.** It is where you experiment, try a build, warm up. That is
  exactly the register wanted for local runs: completely free, not second-class.
- **Ranked costs more infrastructure** — matchmaking, server authority, anti-cheat. Which is precisely
  the witness/quorum requirement, and it explains *why* the extra machinery exists without anyone having
  to be told.

And the technical anchor is unusually good, because the games industry already learned this exact lesson
the hard way: **competitive play is server-authoritative because client-attested state is forgeable.**
Client-side anti-cheat is self-attestation, and it lost. Our conclusion — that a meter inside the
participant's trust boundary cannot certify a capability class — is the same conclusion arrived at
independently, which is some evidence it is right.

Adopt the vocabulary directly: **ranked** = witnessed, signed, ladder-eligible; **unranked** = local,
self-attested, freely experimental. It compresses the whole partition into two words that need no
glossary, which is the Mirror→Beacon test passing.

---

## What this fixes in the prior design

That doc argued the Arena should **derive** a participant's capability class (pixels-only / pixels+RAM /
save-state search / input-solving) from observed channel access rather than accept a self-declaration,
on the grounds that *"the emulator knows what was read."*

**That was necessary and not sufficient, and the gap is worth naming precisely: if the participant runs
the emulator, deriving the label is self-attestation with extra steps.** The derivation is only as
trustworthy as the deriver, and the deriver was inside the participant's trust boundary the whole time.
So the prior doc replaced a lie about *what I did* with a lie about *what my instrument saw* — a
strictly smaller attack surface, but the same class.

Aaron's correction moves the observation outside that boundary: **the meter is witnessed, not merely
derived.**

## The design constraint this creates — the meter is a producer on a transport, not a logger

*"via like riticulum or some transport layer even if it's in memory"* is the operative clause and it is
a real architectural requirement, not a deployment note.

If the meter writes to a local log that is signed and published afterwards, everything between the
access and the signature is inside the participant's control — the log can be edited before it is
sealed. **Emitting over a transport at the moment of observation is what moves the record across the
trust boundary while the run is still happening.** "Even if it's in memory" means the transport is the
witnessing channel *even for a local in-process run*: same code path, same discipline, the DoP=1 case of
[`async-all-the-way-truthful-signatures.md`](../../.claude/rules/async-all-the-way-truthful-signatures.md)
— beautiful on one, scales to N, no special case for the local run.

That is also §13 noninterference applied to the Arena: every channel crossing is metered **at the
membrane** and posted, rather than accumulated privately and reported.

## Two result classes, and they do not rank against each other

> *"it should not be self attested except for when doing local non tournment experiment and those wont
> be able to be signed by third party whitness sign off like the torunments"*

This creates a second partition of the result space, orthogonal to the capability classes:

| | attestation | comparable to |
|---|---|---|
| **tournament result** | third-party witness/quorum signatures over the channel record | other tournament results |
| **local experiment** | self-attested; no third-party signature is even *possible* | other local results |

The honest framing is the same as for capability classes: **a local result is not a weaker tournament
result, it is a different kind of result.** Ranking across the partition would be the same category
error as ranking a pixels-only score against an input-solved one. And the mechanism is pleasingly
self-enforcing — a local run *cannot* produce the signatures, so the distinction is not a policy anyone
has to remember; it is a property of what exists.

Worth stating plainly what this means and does not mean: local experimentation stays completely free and
unencumbered. Nothing about this gates research. It only means a local number cannot be *presented* as a
tournament number, which is exactly the honest-labelling commitment applied one level up.

## Witness vs quorum — the same question, for the fifth time today

Aaron says *"witness or quorm"*, and the distinction is the one already carved this session: **a witness
is one external observer tolerating zero faults; a quorum is a witness set sized for a fault model.**
Every "get an outside opinion" is a witness claim until it names `f`.

So the Arena must state, per tournament, how many independent witnesses sign a channel record and what
fault model that size assumes — using `quorumSize(faultModel)` from the build-graph quorum work
(#10395), which deliberately has no bare size field precisely so the number cannot be picked without
naming the model.

And note where this argument has now arrived from, five separate directions in one day:
`FigureEightEnsemble`'s homoclinic tangle (*"the demon cannot resist the tangle from inside the loop —
it needs an external observer"*), the orbital independent check, the empowerment/decorrelation coupling,
the adversarial-teaching regime, and now the Arena meter. **The same structural answer keeps falling
out: a loop cannot certify itself.** That recurrence is itself evidence the principle is load-bearing
rather than a preference.

## Engineering questions this raises, none of them blocking

- **What exactly is signed?** Signing every RAM read at frame rate is not viable. The standard shape is
  a **hash chain / Merkle root over the access log**, signed periodically, with the full log retained
  and challengeable — the transparency-log construction (Certificate Transparency, Laurie et al., RFC
  6962 is the canonical reference for the pattern). The witness signs commitments; the log is produced
  on challenge.
- **The witness must not be forgeable in either direction.** A witness that can *fabricate* an access is
  as damaging as a participant that can hide one — it can disqualify an honest competitor. The record
  should therefore be **mutually signed**: participant commits, witness counter-signs, and neither side
  alone produces a valid record. Otherwise the witness has unilateral power, which is a new
  weight/capture surface (§3).
- **Latency.** A witness observing over a transport adds latency to the loop. For TAS-class runs
  (not real-time by construction) this is free. For real-time classes it may not be, and the honest
  outcome could be that some capability classes are *only* offerable in a non-real-time form — which is
  a finding, not a failure.
- **Replay.** Because the transport record is signed and ordered, a witnessed run is replayable by a
  third party (§7 DST). That is a significant bonus: the same mechanism that proves the capability class
  also makes the run auditable — build = verify, the generator-as-ECC pattern again.

## Open

1. Name `f` per tournament class; use `quorumSize(faultModel)`, never a bare count.
2. Decide the commitment scheme (hash chain vs Merkle root) and the signing cadence, against a measured
   frame-rate access volume rather than a guess.
3. Mutual signature — confirm neither participant nor witness can unilaterally produce a valid record.
4. Measure witness latency per capability class; accept that some classes may be non-real-time only.
5. Confirm the transport story concretely: Reticulum is named, but the in-memory case has to be the
   *same* code path, or the local-run discipline decays into a special case.

## Pointers

- `docs/research/2026-08-13-tit-for-lesser-tat-teach-play-and-the-arena-noise-is-not-defection.md` — the Arena, capability classes, derive-don't-declare (this doc supersedes its attestation half)
- `src/Core.TypeScript/ace/build-graph.ts` — `quorumSize(faultModel)`, fault model not count (#10395)
- `src/Bayesian/FigureEightEnsemble.fs` — the external-observer conclusion, stated for belief convergence
- [`dv2-data-split-discipline-activated.md`](../../.claude/rules/dv2-data-split-discipline-activated.md) §13 noninterference, §7 DST
- [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) §3 weight-free — why the witness must not hold unilateral power

**Anchors cited from standing knowledge, not page-checked**: Laurie et al. Certificate Transparency
(RFC 6962) for the log-commitment shape; Pease/Shostak/Lamport 1980 and Castro & Liskov 1999 for the
quorum sizing already anchored in #10395.

---

## Unranked mislabeling is a training signal, not an offence (Aaron, 2026-08-13)

> we expect there to be real mislabel cheating in non ranked matches but we we don't scold for that we
> teach and get better at detection and tell pepole when they've been detected mislabeling and let them
> refut it and mutual leraning occurs, teach, play after tit for lessor tat. Ranked needs stronger
> guardrails

This applies **tit for lesser tat → teach → play** to the *governance* of the Arena rather than to play
inside it — the strategy is self-similar across the two levels, which is manifesto §9/§10 (recursive,
self-similar) showing up somewhere it was not planted.

### The inversion

The usual security posture treats a detected cheat as an offence to be punished. This treats it as
**free red-team labour**. An adversary mislabeling in unranked is doing detector development for us, at
their own cost, and punishing it would drive the behaviour somewhere unobservable — the same
black-market argument Aaron made for wagering: prohibited-but-valuable activity relocates out of
instrumentation range, and a ban you cannot enforce is worse than a venue you can watch.

So the two regimes are not merely different stakes. They are in a **pipeline** relationship:

| | role |
|---|---|
| **unranked** | where the detector is *trained* — adversaries supply the hard cases |
| **ranked** | where the detector is *deployed*, with guardrails sized to real stakes |

### Detection is announced and refutable, which is the dual-use rule again

*"tell people when they've been detected mislabeling and let them refute it."* That is exactly
[`dual-use-detection-is-neutral-oracle-decides.md`](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md):
the mechanism reports the **neutral fact** — *declared class X, observed channel access Y, mismatch at
Z* — and does not render a verdict. "Mislabeled" is a reading; "the record and the declaration disagree"
is the measurement. Refutation is what keeps those separate, and without it the detector would be
holding a morality the substrate is not allowed to hold.

It is also the honest-register discipline applied to accusation: the participant may have a reason the
detector cannot see, and a system that cannot hear it will convict correctly-behaving participants at
whatever rate its false-positive rate happens to be.

### The coincidence worth naming: due process and active learning select the same examples

This is the part that makes the design better than merely fair.

**Disputed detections are boundary cases.** A participant only bothers to refute when the call was
close — nobody argues with an obvious catch. And in active learning, the examples nearest the decision
boundary are precisely the **most informative** ones (uncertainty sampling): they move the classifier
more per label than any confidently-classified example.

So the refutation queue *is* the high-value training set. **The procedure that is fairest to the accused
is also the one that improves the detector fastest** — they are not in tension and no trade-off has to
be made. That is worth stating explicitly, because designs usually assume due process costs efficiency,
and here it buys it.

Mutual learning is then literal rather than a nicety: a **successful** refutation is a labelled false
positive (the detector was wrong, and now knows exactly where); a **failed** one teaches the participant
what the meter actually sees. Both directions carry information, which is what makes it *mutual* rather
than merely appealable.

### The risk this creates, and it must be modelled

If unranked is the training set and that is public, **the training set is poisonable.** Two concrete
attacks, both standard in adversarial ML and both cheap here:

- **Over-fire poisoning** — deliberately generate refutable near-misses to push the detector toward
  false positives, so that in ranked it flags honest competitors.
- **Blind-spot poisoning** — flood unranked with easy, obvious mislabels so the detector over-fits to
  the easy manifold, leaving the technique you intend to use in ranked unlearned.

This is the **adversarial-teaching regime** Aaron already asked for, arriving at a different layer: an
adversary inside the loop steering it toward a chosen fixed point. Same geometry, same defence — the
detector's training must be observed by something outside the loop it is training on, and the
`FigureEightEnsemble` conclusion applies verbatim.

**PROPOSED mitigations, none verified:** hold out a witnessed ranked-derived evaluation set the training
process cannot influence; weight training examples by the attester's own reliability
(`KeptClaimOracle.fs` is the existing scorer); and treat a sudden shift in the unranked case
distribution as itself a detectable event rather than as data.

### "Ranked needs stronger guardrails" — what that means concretely

Teaching loops are too slow when the stakes are live. The guardrail set that follows from the rest of
this document:

- **Witness/quorum sized by a named `f`**, never a bare count (`quorumSize(faultModel)`).
- **Mutual signature** — neither participant nor witness can unilaterally produce a valid record.
- **Pre-declared capability class**, so the declaration is committed before the run rather than chosen
  after seeing the score.
- **Refutation still available** — stronger guardrails must not mean unilateral verdicts. Ranked raises
  the evidentiary bar; it does not remove the right to answer.

That last point matters: the temptation in a high-stakes regime is to trade due process for
decisiveness, and the previous section is the argument against it — the disputed cases are also the
informative ones, in ranked as much as in unranked.

## Open (added)

6. Model both poisoning attacks against the unranked → ranked training pipeline; hold out a witnessed
   evaluation set the pipeline cannot influence.
7. Specify the refutation protocol: who adjudicates, on what evidence, and what a successful refutation
   does to the detector — a refutation that changes nothing is theatre.
8. Decide whether capability class must be **pre-declared** in ranked (committed before the run). My
   read is yes, and that it is cheap; the alternative lets a participant pick the class that flatters
   the score after seeing it.

---

## A survived refutation is often a new algorithm (Aaron, 2026-08-13)

On the note that a participant may have a reason the detector cannot see:

> yes usually a new aglo worth investigating

This inverts the value of a false positive one more time, and it is the strongest reason to build the
refutation channel properly rather than as an appeals formality.

The prior section argued refutations are the **most informative training examples** (boundary cases,
uncertainty sampling). Aaron's point is about their **content**: a refutation that survives usually means
*"I did something your model has no category for."* That is not detector noise to be corrected away —
it is **discovery**, and the detector was the instrument that surfaced it.

So the refutation queue is doing three jobs at once, and only the first was in the original design:

1. due process for the accused,
2. the highest-value training set for the detector,
3. **a discovery channel for novel technique.**

### The anchor is the thing we are already copying

This is exactly how speedrunning works, and it is worth naming because the Arena is borrowing that
community's category conventions anyway. New strategies and glitches are routinely **flagged as
suspicious first**, then verified, then named, and frequently spawn a new category. The verification
process *is* the discovery pipeline — the same submission that looked like cheating becomes the
canonical route once it is understood and reproduced. Nobody designed that; it fell out of taking
disputes seriously.

Which means: **the anti-cheat system and the technique-discovery system are the same mechanism.** That
is `dual-use-detection-is-neutral-oracle-decides.md` again, and unusually both readings are productive —
`AnomalousChannelPattern` reads as *cheat* under one policy and *unknown method* under another, and the
mechanism must not pre-judge which.

It is also `every-bug-has-economic-value.md` applied to detection: a false positive is **reducible
uncertainty**, investigating it exposes value, and the ΔU it banks is a technique nobody had.

### The discriminator, because not every false positive is a discovery

Most false positives are detector bugs, noise, or unmodelled-but-boring edge cases. The claim needs a
filter or it becomes flattery, so — **PROPOSED, and testable**:

> A survived refutation is a **new algorithm** if the behaviour is **reproducible** and **transfers**;
> it is a **detector bug** if it is neither.

Reproducibility and transfer are exactly what a witnessed, signed, ordered channel record already gives
for free (§7 DST — a witnessed run is third-party replayable). So the machinery built for attestation
supplies the discriminator at no extra cost, which is a good sign the design is factored correctly.

### The adversarial reading, which has to be priced

If surviving a refutation confers status — discovery credit, a named technique, a new category — then
there is an incentive to **manufacture** refutations: deliberately trip the detector in ways you can
explain, to farm novelty credit. Same shape as every other incentive in this system, and it should be
handled the same way rather than assumed away.

The reproducible-and-transfers discriminator is most of the defence, since a manufactured anomaly that
generalises **is** a real technique and deserves the credit — the attack collapses into the thing it was
imitating. What it does not defend against is *volume*: flooding the queue to exhaust adjudication. That
is a cost/rate-limit problem, and it is the same argument that makes wagering need an entry cost.

## Open (added)

9. Adopt the reproducible-and-transfers discriminator and test it against real refutations before
   trusting it; it is currently a plausible rule with no evidence behind it.
10. Decide what a confirmed discovery *earns* — a named technique, a category, standing — and price the
    manufactured-refutation incentive that creates.
11. Rate-limit or cost the refutation queue against volume exhaustion, without making legitimate
    refutation expensive. These pull in opposite directions and the balance is not obvious.
