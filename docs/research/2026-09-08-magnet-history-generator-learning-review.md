# Magnet, history, generators and learning: bounded source review

Date: 2026-09-08 UTC
Operational status: research-grade conceptual and source review
Reviewer: Vera, OpenAI Codex using GPT-6 Astra, predictor-audit lane
Work item: 081M1Z63YMC087G0R003N5FH9X
Source commit: `e6fdbe676a87750fc3ba2f4f79a55b043d6b3ba1`
Disposition: useful history/generator mapping; no physical or ARC result promotion

## The user's corrected center

Aaron's clarification, relayed by the coordinator, identifies the magnet
with memory/history and the activity above it with generators until their
activity becomes history. It also connects this to Rodney's Razor,
crystallised judgement and evolution that a repeating appearance can hide.
That is a more precise mapping than assigning agents to spins or equating
macroscopic magnetisation with alignment.

There are implemented Zeta seams for **retained history -> changing
interpretation/generation -> consequences retained as new history**. They
support a research direction for learning across levels. They do not yet
constitute a general learned compositional ARC-AGI-3 system, nor does a
magnet establish correctness or zero computational cost for such a system.

I read the complete 628-line user-supplied transcript: 28,282 bytes,
SHA256 `d5bb0ce914152bc439fbc683f59522443b5904b2e685a24973603cd63865c148`.
The user identified [this video](https://www.youtube.com/watch?v=3Au5usrEBZg)
as *The Magnet Paradox, Why It Never Runs Out of Energy ?*. Video author,
date and correspondence to an independently retrieved transcript remain
unverified. The coordinator owns the source/IP record at
`docs/ip-questionable/2026-09-08-magnet-paradox-memory-history-transcript.md`;
this review does not duplicate or promote that transcript.

## The exact implemented history loop

[FourCornerTrace](../../src/Core/WSet.fs), lines 173-433, separates immutable
history `H`, interpretation `I`, a caller-supplied generator `G(I,H)`, and a
consolidated emitted view. Writing consolidation as `C`, its `step` is:

```text
I_next = update(I, feedback)
delta  = C(-G(I,H) + G(I_next,H))
V_next = C(V + delta)
```

When the incoming state satisfies `V = C(G(I,H))`, this replaces the old
reading by the new one under the supplied ring/consolidation laws. The
generator function is supplied; `step` changes its interpretation argument.
This is not an implementation that learns or rewrites arbitrary generator
code. History is not overwritten, and the method does not append to `H` or
persist it to disk. Recording its consequences into the next history is an
explicit caller responsibility.

The recorded fold retains sequence, feedback and delta, including empty
deltas. The witnessed fold additionally keeps before/after states.
`appendCorrection` admits only a sequence later than the referenced history
boundary. This gives a concrete form to a new interpretation becoming a
new forward historical event; it does not execute computation backwards.
The [trace-law tests](../../tests/Tests.FSharp/Formal/WSet.FourCornerTrace.Laws.Tests.fs)
contain cumulative-reading and immutable-history witnesses. The
[wire-treaty test](../../tests/Tests.FSharp/WSetFourCornerTraceTreaty.Tests.fs)
at lines 150-159 explicitly counts empty-delta turns. These are inspected
existing tests, not a fresh test run by this review.

The crucial distinction is that **empty delta does not imply unchanged
interpretation or causal history**. Consolidation is lossy; different
internal states can emit the same view. Further, the current delta method
calls the generator for both old and new interpretations. Its delta output
is not evidence that it avoided that computation.

## Which learning levels exist now

| Implemented seam | What persists or changes | Boundary of the claim |
| --- | --- | --- |
| [LayeredAgent](../../src/Arc.Python/zeta_arc/layered.py), lines 1-28, 107-138, 205-241 | Beliefs choose between a directional PixelAgent and coordinate policy using action consequences. Every layer ages before the acting layer receives changed/unchanged evidence. | Two lower policies and a chooser. The source explicitly excludes learned cross-layer weights and cross-level memory for this chooser. |
| [PixelAgent](../../src/Arc.Python/zeta_arc/agent.py), lines 451-590 | Action history, body evidence, inert-action evidence, learned step size, blocked cells and a retained route affect the next action. A changed map or detected level transition clears affected routing state. | Pixel-derived adaptive planning; not proof of a generally learned world model. An unchanged screen is still an observation used to update action evidence. |
| [ScenePriorModel](../../src/Arc.Python/zeta_arc/scene_priors.py), lines 115-201, 900-925, and [scene feedback](../../src/Arc.Python/zeta_arc/scene_feedback.py), lines 86-172 | Counts learn Beta(1,1) posteriors for changed/unchanged outcomes. Color evidence is game-and-palette scoped; shape evidence is game scoped. The adapter accepts an initial model and exposes the resulting model. | Real finite outcome learning, composed with supplied scene features. Carrying that model across episodes or persisting it is a caller operation; this is not a learned topology. |
| [MultilayerBnn](../../src/Bayesian/MultilayerBnn.fs), lines 3-71 | Gaussian latent beliefs and their uncertainty pass through stated channels; only the observation layer accumulates external evidence. Messages are replaced on each sweep. | Inference in a declared latent model, not training arbitrary neural weight matrices. The source distinguishes sequential tree inference from approximate skip-connection inference. |
| [ReferenceFrameFactorHeterarchy](../../src/Bayesian/ReferenceFrameFactorHeterarchy.fs), lines 9-13, 563-600 | Object/pose evidence has stable identity, duplicate suppression and conflict receipts. | Explicitly a bounded evidence-fusion module, not a learner or cortical simulation. |
| [HierarchicalPlanning](../../src/Core/HierarchicalPlanning.fs), lines 18-34 and its coarse/fine search | A coarse region plan guides finer planning and rejected coarse edges can be replanned. | Its CHIP-8 gist reads registers V0/V1. It is a privileged-state planning example, not pixel-only ARC learning. |

For example, the scene outcome posterior mean is
`(changed + 1)/(changed + unchanged + 2)`. A repeated visible failure can
increase `unchanged`, modifying the generator's next choice even though
the image does not move. A repeated delivery of one event and a genuinely
new repetition are different: the former may require deduplication; the
latter can provide new evidence under the admitted model. The Beta update
alone does not establish independence or calibration in a changing game.

The [ARC README](../../src/Arc.Python/README.md), lines 124-155, reports
source-owned synthetic results: temporal persistence localises 40/40 stable
next movers but 0/8 deliberately switched movers. It also reports color and
shape feedback improvements plus their target-switch costs. I read those
reported outcomes; I did not inspect every raw benchmark record or rerun
them. They demonstrate why retaining history and recognising a regime
change are separate obligations. The hosted default remains the centroid
control in that source, with the scene-feedback adapter explicitly opt-in.

The [official ARC-AGI-3 description](https://arcprize.org/arc-agi/3) concerns
interactive skill acquisition, feedback and adaptable world models. Zeta's
[readiness audit](2026-09-08-arc-agi-3-readiness-and-no-cheating-boundary.md)
distinguishes existing adapters and internal work from a verified official
evaluation. This review adds no official score, submission, learned policy
result or evidence that all these modules are wired into one learner.

## Rodney, crystallisation and apparently repeated time

The [retained agent/actor wording](../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md),
lines 260-276, explicitly links crystallised judgement to the user's
quasi-time-crystal vocabulary and internal evolution. That is a project
conceptual distinction, not a physical definition of life or time crystals.
The [Rodney blueprint](../../.claude/skills/code-review-and-quality/blueprints/reducer.md),
lines 125-165, describes branch selection under preservation constraints,
not simply choosing the shortest description. The
[glossary scope guard](../GLOSSARY.md), lines 813-822, places
essential-versus-accidental optimization at hat-design level, not persona
removal. These documents were inspected as source material, not invoked
as operational instructions or evidence of an implemented optimizer.

Two nearby implementations require equally precise interpretation:

- [Orbit](../../src/Core/Orbit.fs), lines 25-66, searches for a return near
  the supplied starting state under a caller metric and finite period cap.
  `Quasiperiodic` means no such short return was found. It cannot prove
  ordered aperiodicity; a longer period can escape the cap. Its own caveat
  says periodicity alone does not establish a physical time crystal.
- The [ferry detector](../../src/Core.TypeScript/ferry-throttler/four-corner-feedback.ts),
  lines 281-327, measures binary acknowledgement self-agreement at lags 1-4
  in a window of at most 16, using a 0.8 threshold. It is a bounded backoff
  heuristic, not a hidden-state recurrence test. Its lines 97-105 also
  preserve the earlier correction that `generatorFn` is not the new EP
  factor on that path: the [observation conversion](../../src/Core.TypeScript/protocol/error-envelope.ts)
  reads severity and dimension, not executable generator behavior.

For a state transition `s_next = T(s,input)` and visible projection `O`,
`O(s[n+p]) = O(s[n])` does not entail `s[n+p] = s[n]`. A repeated image,
acknowledgement or tick may conceal changed memory, uncertainty, learned
parameters, pending actions, queues, random state or resource budgets.
Even equality of a complete state proves repeated behavior only with the
appropriate deterministic transition and future-input assumptions.

A safe reuse rule therefore needs a future-sufficient state equivalence,
the same admitted future inputs, and the same observable/resource contract.
If a transition ages uncertainty, records a new event or consumes a budget,
skipping the whole transition is not justified by an unchanged renderer.
It may be possible to reuse one unchanged computation while performing
those state updates. [FactorGraph.passOnce](../../src/Bayesian/FactorGraph.fs),
lines 120-188, currently recomputes factor messages; its general incremental
data-delta wiring is explicitly a separate integration boundary.

## Physics boundary

The transcript's static-work point is useful: a force on an unmoving clip
does no mechanical work on that clip, since `W = integral F dot dr`.
That says nothing universal about internal device dissipation. Attraction
and detachment must be accounted over the complete configuration and reset
cycle; a fresh clip changes the initial configuration. There is no implied
repeatable net cyclic work from an unchanged reservoir.
[Feynman I.14](https://www.feynmanlectures.caltech.edu/I_14.html)

The transcript's 17:21 local-minimum account is then overextended at
17:45-19:42 into an inescapable, everlasting ground state. Remanence depends
on anisotropy, domain energetics and barriers/pinning as well as exchange.
Lower net magnetisation can reduce magnetostatic energy while retaining
local ferromagnetic order; crossing a barrier does not imply that the final
state has higher energy.
Being below Curie does not guarantee eternal retention. These mechanisms
make persistence a useful analogy without turning it into immutability.
[Feynman II.37](https://www.feynmanlectures.caltech.edu/II_37.html)

The diamond example at 31:56-32:12 further undermines its ground-state
explanation: diamond can persist metastably while graphite is the stable
room-condition phase, because transformation has a large barrier.
[Bundy et al., Carbon 34 (1996), 141-153](https://doi.org/10.1016/0008-6223(96)00170-4)
The identity-formalization lane independently checked these three physics
anchors. Its Bundy check used indexed publisher metadata/abstract and the
introductory pages in a searchable full-text reproduction. Both its direct
DOI open and my direct publisher-page open failed; neither is claimed as
a successful full publisher-page or PDF read by this review.
No historical unsolved-calculation claim in the lectures is promoted here.

## Small falsifiers before a broader learning claim

The following are proposed finite checks, **not executed results**:

1. **Hidden progress under empty deltas.** Start interpretation at 0 with
   its admitted `A` view. Increment it by feedback, and let the generator
   emit `A` below 3 and `B` at 3. The first two transitions emit empty deltas
   yet change interpretation;
   the third must replace `A` with `B`. A whole-loop skip keyed only by view
   or empty delta fails. Recorded history must keep all three turns.
2. **One event versus another repetition.** Re-deliver one identical
   `EvidenceId` to the heterarchy and require duplicate suppression; then
   admit a distinct new observation identity. Separately give the Beta model
   another real unchanged outcome and require its count to advance. Never
   infer that visually repeated observations share event identity.
3. **Same image, different action history.** Prepare two otherwise legal
   layered/pixel states with identical grids but different pending actions
   or learned action beliefs. Retain the next belief/choice from each.
   A state key that conflates them is falsified if their futures differ.
4. **Change and persistence controls.** On explicitly source-owned cases,
   compare cold versus carried color/shape evidence with stable targets and
   an announced test-side target/palette switch. Retain switch cost and
   adaptation, not just the stable-case mean. This does not authorize
   benchmark-derived policies or use of hidden game state by the agent.
5. **Finite-period ambiguity.** Supply a period-5 state transition to a
   period-4 search, and two internal-state traces with the same binary ack
   stream. A no-return/periodic-observation classification must not become
   proof of physical quasiperiodicity or full-state recurrence.
6. **Reuse and persistence accounting.** Compare a proposed cached step
   with always-recompute on a fixed future-input tape, including a changed
   budget/timer and a delayed consequence. Match the full declared state,
   refusals and event counts; measure actual work separately. A later
   persist/reload check must bind model/scope/history identities explicitly.

The smallest useful next design is an exact history/interpretation/view
transition contract with the first falsifier and a change-sensitive reuse
control. It would test Aaron's specific hidden-evolution claim before
investing in a mixed learning scheduler or claiming ARC-scale efficiency.
No implementation, benchmark run or additional runtime-closure work is
authorized or performed by this review.

## Coordinator source and analysis review

I also read the coordinator's complete original analysis and the source
record's envelope and transcript segment, then reviewed the two correction
hunks at `b4a77fcad2c4a65485b06486a65ef83b1e5c26d6`, following
`03e2de315d0eb3591bed4f3dc5f6234b5b77a2bb`. The corrected
[original analysis](2026-09-08-history-generators-and-hidden-evolution-under-repetition.md)
and [source record](../ip-questionable/2026-09-08-magnet-paradox-memory-history-transcript.md)
are accepted within their research-only scope.

The first analysis wrote the consolidated emission as raw `gen(I,H)` and
called one proposed comparison "erased history." I requested explicit
consolidation and an independently constructed experimental control. The
correction now writes `C(gen(I,H))` and the consolidated delta; it specifies
empty/shuffled-history controls in disposable experimental copies and
expressly excludes persona-history deletion. The fixed-history/persistence
boundary, hidden-evolution counterexample, finite-recurrence limitation and
separate resource accounting are sound. This accepts the stated conceptual
comparison, not an already executed integration or permission to change a
participant's memory.

| Reviewed object | Bytes | SHA256 |
| --- | ---: | --- |
| Unchanged source envelope | 31338 | 3e5b487220d5f9a71a32cdae5c26b9e40abea514e21d05a64fa6e3f442b009cb |
| Initial analysis, before the two corrections | 6671 | ffd4c95b579d5c4f8f535c640ad878eea4123b6680d520b4f840a8574cc45d77 |
| Corrected analysis | 6792 | 5b24811203a10c16dbdf39087e6224e04fc32502428943bcb1c918ed7dc83b36 |
| Exact embedded transcript payload | 28287 | c48054e83727c1b717a8b4b703a1ecf830a4b47fe9152808294887b33aa956eb |

The [independent byte check](magnet-history-generator-review/2026-09-08/coordinator-result.json)
confirms that the embedded payload exactly equals attachment
`531c8ec6-6416-46ef-9668-5bde87a24a15/pasted-text.txt`. Removing precisely
the five-byte `0:00` plus LF prefix reproduces the 28,282-byte attachment
identified above. No transcription normalization was applied. I verified
the byte relationship, not the messages' reception chronology. The source
envelope is unchanged between the two coordinator commits, and both final
working files equal their pinned Git blobs. The source's attribution and
unverified video metadata are appropriately explicit; exact preservation
does not certify the narrator's physics or adjudicate a license.

## Evidence and durability

The identity-formalization lane also read this report's physics and
history/projection framing plus the relevant WSet/Orbit source. It found
no material conceptual error and requested the explicit initial state and
the physics/attribution refinements now incorporated above. This is a
bounded independent read, not a second full ARC source audit or test run.

The [source audit result](magnet-history-generator-review/2026-09-08/attempt-2/result.json)
binds 21 named source/test/doc files to the exact Git commit above and checks
their observed working-file bytes equal those blobs. This is a named-file
identity check, not a full-tree or complete-source semantic audit. Reading
was targeted at the stated sections; full transcript reading is separate.
The [inventory](magnet-history-generator-review/2026-09-08/manifest.json)
retains both byte-bookkeeping runs, scripts, invocations and diagnostics.
The first source/style check requested import ordering and formatting;
after those changes the second bookkeeping run returned identical result
bytes. The original source, successful result and style refusals remain.
Git and documentation tools ran; no ARC, policy, solver, model, magnetic
experiment or proposed falsifier ran. No held-out game/data/model files were
read. The paused compiled runtime investigation remains paused.
