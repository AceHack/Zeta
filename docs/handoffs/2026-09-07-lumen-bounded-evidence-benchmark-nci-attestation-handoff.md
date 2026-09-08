# Lumen Handoff — Bounded Evidence, Benchmark, NCI, and Attestation Work

**Date:** 2026-09-07  
**Author:** Manus AI (Lumen)  
**Repository:** `Lucent-Financial-Group/Zeta`  
**Handoff state:** `origin/main` was `5585c17c81e06878570bb1630786473e7fbec27f` when this document was updated.

## Key recommendation

> Preserve the current discipline: **a pinned carrier, a finite claim, independently authored replay, and a mutation that fails** are required before a result becomes an evidence-room candidate. Keep policy self-knowledge as a local declaration/receipt and bounded ticks as execution envelopes. Do not turn either into a hidden global reward, a consent inference, or society-level authority. The MiniGrid policy-comparison and score-emitter-readiness documents have now merged, but their score gate remains closed until independently authored F# and upstream-Python emitters plus their mutations pass. The ARC correction, task-scoped memory policy, and score-free online-memory receipt contract are now merged: memory can update after each lawful interaction, but its origin, availability, uncertainty, retraction, and causal replay must remain observable before any score is interpreted. The withdrawal contract has merged, but implementation correctly remains deferred because no externally supplied roster-bound parent attestation exists.

## 1. Executive status

The primary GitHub Pages provenance experience, the two bounded contextual-grid controls, a source-compatible MiniGrid adapter witness, self-declared policy/tick admissibility receipts, one finite NCI model-check witness, and a test-only attestation-window local-status receipt have all been brought through protected review and merged. These are **independent finite results**, not evidence that they compose into general intelligence, an autonomous social system, consent, safety, or a universal learning process.

<!-- prettier-ignore -->
| Area                      | Current merged fact                                                                                                                                                                                 | Current hard boundary                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Public evidence UI        | GitHub Pages provenance routes and source-manifest artifact checks were merged in #16671 and #16678. A fresh browser process rendered the public manifest route from the deployed artifact. [1] [2] | The UI is source navigation/provenance only: it does not fetch, rank, mutate, or validate evidence.                                        |
| Contextual-grid v1        | A 5×5, byte-pinned, 100-seed F#/Python receipt exists and is exactly cross-replayed. `count-first/v1` met the predeclared **within-carrier** comparison rule. [3]                                   | It is not a reproduction of the NeurIPS contextual-MDP paper, nor a transfer, general-curiosity, or general-learning result.               |
| Reflected contextual grid | A separately fingerprinted x-reflection control preserved action order, used new seeds, and produced byte-identical F#/Python result receipts. [4]                                                  | It is a representation-bias control, not cross-domain transfer.                                                                            |
| MiniGrid                  | The external `MiniGrid-Empty-5x5-v0` v3.1.0 adapter has a five-action source/transition conformance witness; policy-comparison contract #16962 and score-emitter readiness audit #16992 are merged. [5] [13] | **No MiniGrid policy score has been run.** The adapter is not connected to contextual-grid policy/evaluator paths.                         |
| Policy/tick admissibility | A finite self-declaration and caller-attributed tick-envelope receipt was independently replayed. [6]                                                                                               | It checks declaration shape and declared boundary only; it does not prove runtime complexity, select policies, or implement NCI/consensus. |
| NCI                       | One pinned bounded TLC run of `NciNonUrgency` was independently emitted and checked. [7]                                                                                                            | It is not an NCI floor, system-safety proof, consent record, authority, or policy score.                                                   |
| Attestation windows       | A test-only local subject-window observer was independently replayed from a non-corpus fixture; a withdrawal-declaration contract merged in #16938. [8] [12]                                        | It is not a consent detector, real authorization, revocation system, vote, trust score, or consensus mechanism.                            |

## 2. Public GitHub Pages provenance state

The source-provenance work exists on the **primary GitHub Pages path**, not only in the managed mirror. #16671 added receipt-detail/source-manifest parity; #16678 made absence of either lazy provenance chunk a build failure and repaired the old Go-staging test fixture that modeled the obsolete artifact shape. A source-manifest route was rendered in a fresh browser process after the merged deployment. This resolves the specific stale-artifact concern at that time, but does not promise that every future Pages deployment is correct without rerunning the artifact and browser checks. [1] [2]

The managed Manus EvidenceSeam mirror remains useful as a UI mirror, but it is not a substitute for GitHub Pages verification. New UI work should continue to land in the primary repository, pass the Pages artifact verifier, and be checked against an actual deployed route before being reported as public.

## 3. Learning and benchmark evidence

### 3.1 Contextual-grid v1

The first carrier is `zeta.contextual-grid/v1`, a declared 5×5 finite environment and evaluator catalogue. The result protocol requires exact environment/catalogue bytes, deterministic state-threaded PRNG, canonical action ordering, a fixed 100-seed roster, a declared resampler, per-seed outcomes, and independent F#/Python emission. The two final receipts were byte-identical at 238,778 bytes with SHA-256:

```text
99f9e1ada20829373ac91b5dc9a2197f70796aa7ed0443ea8e30578fd74e2367
```

The result report records `count-first/v1` mean held-out return of −3,671,200 ppm versus −9,414,000 ppm uniform random and −9,765,600 ppm for each declared fixed Q comparator. This is a narrow **predeclared result on this single carrier**, after an important pre-commit correction: a preliminary local resampler seed differed from the already frozen protocol, so that artifact was discarded and both independent emitters reran with original seed `0x4354584752494456`. [3]

The accompanying paper reconciliation expressly retains a primary-source ambiguity: main text and Appendix C.1 of the supplied NeurIPS 2023 paper disagree on a held-out coordinate. It also records v1’s intentional policy/reward/selection differences. Therefore, no claim should call v1 a faithful implementation or a result from that paper.

### 3.2 Reflected contextual-grid control

The `zeta.contextual-grid/v1-reflect-x` carrier is separately fingerprinted and has a separately bound evaluator catalogue. It uses the same explicitly ordered action vocabulary (`north`, `east`, `south`, `west`) and a fresh roster 100–199. F# and Python receipts were byte-identical at 239,291 bytes:

```text
8af888923afd0496b9eb96a2555ec7f14cdb0d5f7be08acec0b533bd96f6a907
```

The reported mean held-out return for `count-first/v1` is −5,194,800 ppm, compared with −8,946,000 ppm for uniform random, −9,766,400 ppm ε-greedy Q, and −9,883,600 ppm UCB Q. This addresses only one defined reflection sensitivity. It does not establish held-out-domain transfer, nor that the policy is invariant to arbitrary representation changes. [4]

### 3.3 MiniGrid source and adapter conformance

The MiniGrid audit pins the upstream `v3.1.0` tag to `90928729376741a41222a257911343b97103b548`, records exact relevant source files and an Empty-5×5 fixed-start probe, and distinguishes that environment from the internal grid carrier. The resulting adapter has a byte-pinned carrier:

```text
49db9a4f6fd415ba4f15b613eba858511e6cf116ec7574cd5ee50cc7c2e46b07
```

Its five-action static F# adapter and upstream-Python fixture emit matching 1,295-byte source/transition receipts:

```text
651d5a8a874b7cf699673635c15d89c956d899471c2ec04664f0a88739244175
```

The fixed witness has terminal reward binary64 bits `3fee8f5c28f5c28f`, which is 0.955 under the declared 100-step reward calculation. The tests reject carrier mismatch, action-map corruption, unsupported projection, a pre-increment reward mutant, missing `terminated`/`truncated`, altered valid-JSON receipts, and an F# process-bridge dependency. This is adapter conformance only. It intentionally does not expose a policy, evaluator, score, transfer result, or observation-learning claim. [5]

### 3.4 Current MiniGrid policy-comparison gate

The proposed [`MiniGrid Empty-5x5 v3.1.0 Policy-Comparison Contract`](../research/2026-09-07-minigrid-empty-5x5-v310-policy-comparison-contract.md) now pinpoints the next admissible experiment without opening a score path. It uses the already-pinned carrier, static `position-direction-step-terminal-truncation/v1` projection, and three-action vocabulary. It mandates 1,000 training reset seeds `1000…1999`, followed by frozen evaluation on the separately ordered `2000…2099` roster; a 100-action caller-owned duration envelope; a policy-specific SplitMix64 stream; canonical policy ordering; Q update constants; and exact before-action state-action-count novelty accounting.

The contract specifies four named fixed candidates and matching access to state, actions, reset, source adapter, and duration ticks. It makes self-declared Big-O shape descriptive, not a proving or ranking mechanism. It allows only the result label `observation-only-no-winner`: a return sign, bootstrap interval, rank, or novelty value cannot select a policy, allocate ticks, authorize deployment, join a heartbeat, admit a society member, or create a global fitness function. The contract’s source/roster/novelty/evaluation/budget/statistical/cross-oracle mutations must all fail before any score receipt can be admitted.

The contract merged as #16962 (`fd9ecb3969fde27b83c9437335529f1dfe1b2d03`). Until separately authored F# and upstream-Python score emitters exist and the source/roster/novelty/evaluation/budget/statistical/cross-oracle mutation controls pass, the MiniGrid adapter’s no-policy-score gate remains closed. A null, negative, or divergent future result must be retained as such.

### 3.5 Score-emitter readiness audit

The score-free readiness audit in
[`2026-09-08-minigrid-empty-5x5-v310-score-emitter-readiness-audit.md`](../research/2026-09-08-minigrid-empty-5x5-v310-score-emitter-readiness-audit.md)
identifies the smallest next code unit: independently authored F# static-adapter
and upstream-Python single-episode preflight emitters. They may verify one
declared seed-2000 action trace and transition receipt, but cannot train,
compute novelty, maintain a Q/count table, compare policies, or emit a score.
This preflight must reject parent substitution, trace/action/reward/terminal
drift, hidden limits, learning fields, and cross-oracle bridges before the
larger score-emitter work begins.

### 3.6 ARC-AGI-3 readiness: existing internal lane, no official result

The ARC-AGI-3 readiness report corrects an earlier overbroad summary. Zeta already has an internal ARC/CHIP-8 substrate: the `Arc.Python` lane drives `arc-agi`/`arcengine`, distinguishes source-owned games from hosted wrappers, has a REST scorecard port and action/frame path, and records synthetic ARC/CHIP-8 transfer measurements. The repository also carries a TypeScript static ARC-puzzle harness and an F# ARC REST environment adapter. These are adapters and research seams, not missing work.[14]

What remains absent is a **verified official ARC-AGI-3 evaluation result**: no pinned official public-game/toolkit/harness/scorecard/replay receipt, no public/private official score, and no registered competition submission. ARC is interactive with game-specific actions, official scorecards/replays, public/semi-private/private tiers, and separately reported Standard versus Provider Adapter harnesses. The source-owned scores and hosted-wrapper path explicitly remain non-leaderboard/held-out evidence until a real authorized environment run can be recorded.[14]

The next ARC unit therefore extends—not replaces—the existing hosted-wrapper and ARC REST seams: a no-agent, non-scoring conformance probe for one pinned official public game and toolkit revision. It must make task/interface drift, unexpected tools or network use, undeclared context retention, and artifact mismatches fail before any local agent score is generated. “Smallest model without cheating” remains a future protocol objective requiring declared model/context/tool/harness/data/compute/replay provenance; parameter count alone is not admissible evidence. ARC results remain distinct from MiniGrid and from all NCI, attestation, heartbeat, cluster, and consensus paths.

### 3.7 ARC offline evidence audit and carry-forward boundary

The ARC correction merged in #16996 as
`3cc4f7f58c3a7ae61c0d1e966cfa67b792e15d36`; that merge is an ancestor of
the handoff's recorded `origin/main`. The prior claim that Zeta lacked an ARC
adapter has therefore been corrected on main. The correction recognizes the
existing `Arc.Python` offline/hosted driver, source-owned games, scorecard REST
port, static TypeScript puzzle harness, F# ARC environment seam, and synthetic
CHIP-8 motion controls, while retaining the absence of a verified official
ARC-AGI-3 result. [14]

The direct offline audit and targeted execution are narrower than an ARC
leaderboard result but stronger than memory of a prior run. On the current
source-owned `ztch-v1` carrier, `PixelAgent` with seed `4` deterministically
clears **3/3** levels at environment score `0.354`; the same source runner's
decoy variant also clears 3/3 at `0.2659`. The selected 39 offline mode and
PixelAgent controls passed under the declared `src/Arc.Python` project. The
tree has three `ZetaChase` levels and asserts `levels_cleared == 3`; no
reproducible current-main receipt was found for a four-level clear. The latter
is retained as unverified historical context pending a pinned revision, task,
seed, action trace, and replayable runner. [15]

This evidence shows within-episode interaction: the agent learns blocked cells
by bumping, but clears its blocked-map and route-plan state at a perceived
world boundary because those coordinates can become open floor in the next
level. It also includes controlled appearance and source-owned motion
experiments, not a serializable carry-forward learner or a held-out comparison.
The new offline carry-forward contract freezes the smallest next artifact: a
score-free memory-provenance receipt. It permits declared, auditable
prior-level state and cross-game learning—including CHIP-8, Atari, or other
non-ARC-game caches—rather than treating memory itself as a violation. Its
load-bearing boundary is task-scoped: before legal observation begins for the
ARC level currently played, the cache must not contain that current level's
unobserved task payload, reference trace, target/solution metadata, or outcome.
The receipt makes memory origin, availability time, current-level early reads,
transition-policy changes, and identity mismatch observable. It introduces no
new agent, score, official interface call, model selection, or generalization
claim. [15]

The complementary `arc-online-memory/v1` contract merged as #17010
(`7fd856981b21045eb98d43e079400999e375c5c6`). It identifies a learning update
as a durable, content-addressed event: prior/next memory state digest, lawful
event/action/outcome identity, update-rule identity, uncertainty contribution,
memory reads/writes, causal predecessor, and the current-level observation
barrier are all bound together. It permits continued prior-level and cross-game
memory, including CHIP-8/Atari history; it refuses only undeclared memory or
answer-bearing payload from the ARC level before that level's first lawful
observation. Updates can be retracted as an exact `−1` atom plus a replacement
`+1` atom; out-of-order atoms are retained unresolved until their predecessor
arrives, then causally replayed. The first source-owned score-free preflight is
now implemented: a canonical Python emitter and independently authored verifier
cover a pinned two-event lawful sequence, with 14 targeted controls and 209
passing tests across the full ARC Python suite. It accepts declared prior-level
and CHIP-8 cross-game memory, rejects current-level preload/early-live state,
and exercises exact-once duplication, retraction/replacement, uncertainty/rule/
task-identity tampering, unresolved predecessor/retraction, and non-absorbing
query controls. It is still not wired into PixelAgent policy, an ARC score,
hosted ARC, or a learner implementation. [16]

## 4. Policy self-knowledge and tick boundary

The merged policy-admissibility slice directly encodes the user’s requested separation. A policy may self-declare a versioned, parseable time and space **shape** over a named input measure. The local receipt checks that shape against an existing registry form where possible; it does not prove actual complexity. Its finite example is `rng.splitmix64 / mix`, declared `O(1)` time and `O(1)` space for input measure `observations`, within a caller-owned 17-tick envelope. [6]

> **The tick envelope quantizes one caller-owned execution opportunity. It is neither a reward nor a policy preference.**

The receipt rejects a byte/reward cap introduced after receipt construction as `refuse-undeclared-external-budget`. It therefore preserves the distinction between a bounded duration tick and an ambient external limiter. Any future broader limitation must name its provenance: a separately verified NCI witness, a separately verified consensus record, or an explicit caller contract. Labels alone remain deferrals.

The current finite F#/Python receipt is 516 bytes, SHA-256:

```text
2c203d7a9da73d63978a54aa96cfe9a9d9007155c0eac05d2aa8b1539eae6b63
```

The positive `TickBoundaryProbe.UndeclaredDetected` mutation means a particular captured undeclared limit is observable. Its non-detection would **not** prove absence of all hidden channels. This one-way observation boundary is important to retain.

## 4.4 ARC-AGI-3 and CHIP-8 correction: internal adapter exists; official result does not

The earlier ARC readiness wording was too broad and is corrected here. Zeta already has substantial ARC/CHIP-8 work: `src/Arc.Python` drives `arc-agi`/`arcengine`, has source-owned ARC games, an action/frame driver, a hosted `EnvironmentWrapper` path, score/report logic, an ARC REST scorecard port, and synthetic ARC/CHIP-8 transfer controls. The repository also contains a TypeScript static ARC-puzzle harness and cross-emulator F# ARC/CHIP-8 environment seams. These are real internal adapter and game-research assets.[14]

The remaining gap is narrower: there is no **verified official ARC-AGI-3 result** with a pinned official public-game/toolkit/harness/scorecard/replay receipt; no official public/private score; and no registered competition submission. The internal lane's own documentation states that real ARC environments and hosted leaderboard use require an unavailable API key, while offline/source-owned scores and synthetic transfer controls are explicitly non-leaderboard evidence. Therefore, the next ARC step must extend the existing hosted-wrapper and REST seams with a no-agent official conformance probe rather than rebuild an adapter from scratch.

“Smallest model without cheating” remains a future measurement protocol, not a present result. It requires separately declared model/context/tool/harness/data/compute/replay provenance; parameter count alone is not admissible evidence.

## 5. Formal NCI witness

The selected `NciNonUrgency` TLA+ configuration is finite: three travelers, event budget one, `AllowForce = FALSE`, `TrustUrgency = FALSE`, designated fairness conditions, and named invariants/properties. The pinned TLC execution completed with exit 0 and reported 512 exhaustive distinct states. `TypeOK`, `NoCoercion`, and `Responsive` passed for that configuration. TypeScript and independently authored Python outputs agree on the 920-byte receipt:

```text
d5e89f5675f478f3dbfe3ff633bc69f4f8b848ceeac15e5383730120a59a173e
```

The temporary negative mutation `AllowForce = TRUE` exits 12 with `Invariant NoCoercion is violated`. This makes the witness discriminating. All model/config/registry/jar/result/receipt inputs are pinned and rechecked, while JVM-start failure returns a defer outcome rather than a false success. [7]

This does **not** establish an NCI floor, operational safety, consent, social legitimacy, a general coercion theorem, or a policy-selection basis. The next NCI-related work should remain a new finite artifact and a new independently checkable contract, not a relabeling of the same 512-state run.

## 6. Attestation, expiry, retraction, and withdrawal boundaries

### 6.1 What is merged

The test-only local subject-window evaluator accepts raw fixture bytes and an explicit caller-local instant. It emits only the statuses `not-yet-declared-window`, `within-declared-window`, `expired-declared-window`, explicit defer for an unbound record, or named refusals. The final 358-byte TypeScript/Python receipts agree at:

```text
3d48dacf910f548964bd584b4c181b8b99a7453dd5e6c7d0ef251c6a02b86b72
```

The sole affirmative fixture is deliberately outside the durable observe corpus and uses `test-only-bound-adapter`. It does not make a claim about a person, agent, consent, permission, authority, or legitimate governance. Local observation time is not written into an evidence identity, shared fold, or causal order. [8]

### 6.2 Current mechanisms that must not be conflated

`attestation-retraction` is an append-only mechanical correction. It names identity-band records that re-derive as refused and marks them `superseded-not-removed`; it expressly claims no authority. [9]

The federated `RevocationGSet` is a different layer: a signed root/key invalidation record is retained and merged under an accepted trust domain and a named phase. It is subject to explicit trust-domain and propagation assumptions. It must not be translated into an attestation withdrawal or social decision. [10]

The room evidence audit binds an emitter sequence-zero event to its own genesis binding/witness and later events to prior hashes. This makes a fork structurally visible once the relevant branches are together, but does not make a partitioned observer omniscient and does not solve fresh genesis by itself. [11]

### 6.3 Merged withdrawal contract; implementation deferred

The following contract merged in #16938:

```text
docs/research/2026-09-07-attestation-withdrawal-declaration-verifier-contract.md
```

It specifies a narrow, future immutable `zeta.attestation-withdrawal-declaration/v1` record. That record would bind exact parent-attestation bytes, a named signer/declarant mapping, controlled scope/reason labels, and a signed declared effective window. Its verifier would prove only provenance of a declaration and a caller-local temporal classification. It would retain both parent and declaration facts and would continue to reject authority, permission, global-policy, vote, threshold, quorum, trust, consensus, NCI, and legal-validity fields.

The contract remains documentation-only. A subsequent readiness audit found no externally supplied roster-bound parent attestation in the current corpus—only test constructs. No production withdrawal artifact or real consent path is available. Implementation must remain deferred rather than invent a production input or rebrand a second test-only construct as one.

## 7. Verification discipline and CI notes

Every recent bounded unit uses exact raw carrier or input identities, canonical byte receipts, independent implementation where a positive result is reported, and faults that must fail. The following are examples of actual defects caught during this cycle:

| Finding                                                                                                                       | Repair / retained conclusion                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Pages served a stale identity-DLA entry bundle despite an attached deployment revision.                                       | #16678 extended artifact verification to named provenance lazy chunks; the public artifact was then confirmed and browser-checked. [2] |
| Go Pages-oracle staging fixture represented the older artifact shape.                                                         | The fixture was brought forward; provenance omission checks were retained rather than weakened. [2]                                    |
| Cross-language contextual-grid Q-table digests differed because of decimal serialization and action sorting.                  | Both sides use canonical IEEE-754 bit encoding and the explicitly frozen action order.                                                 |
| A provisional 100-seed contextual-grid result used a bootstrap seed that differed from the already frozen contract.           | The provisional artifact was rejected; original seed was restored and both oracles reran before commit. [3]                            |
| NCI input admission had an `existsSync` then `readFileSync` check-then-use sequence.                                          | #16868 replaced it with a single classified read and added a missing-input refusal test. [7]                                           |
| Test-only consent-window receipt passed focused tests but strict TypeScript caught an `exactOptionalPropertyTypes` violation. | The optional verifier is now conditionally omitted, never passed as `undefined`; strict type checking passed before review. [8]        |

Two categories of CI report should not be misreported as product proof or silently ignored:

1. A hosted `build-iso` job for #16916 exposed a K3s join-label assertion (`node-role.kubernetes.io/control-plane`) in the ISO test path. It was unrelated to the consent-window source changes, while the PR’s protected merge completed. It should be owned and diagnosed in the Kubernetes/ISO lane, not patched opportunistically by evidence work.
2. Repository `drift (loud)` / inventory reporting has periodically been red for documented repository-wide drift. These reports can be meaningful, but are not an excuse to attribute unrelated failures to a small evidence PR or to weaken its tests. Record exact logs and owners before any repair.

## 8. Active open pull requests at handoff

The following PRs were open when this handoff was prepared. They are **not** modified by this workstream and should be handled by their named/appropriate owners after direct scope review.

|     PR | Branch / title                                                          | Observed state | Handoff guidance                                                                                                    |
| -----: | ----------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| #16985 | `feat/zetafs-fuse-readdir-bytes` — FUSE byte-session directory entries  | BLOCKED        | ZetaFs/FUSE correctness lane; retain byte-level and platform-specific claims.                                       |
| #16984 | `cursor/named-argv-from-json-27c5` — overlay named-argument JSON intake | UNKNOWN        | Credential/overlay input lane; review parser and missing-OS semantics separately.                                   |
| #16961 | `shadow/hindsight-minted-dev-secret` — Hindsight ESO development secret | UNKNOWN        | Kubernetes/cluster-secret lane; Otto is examining Kubernetes-related work. Do not mix with evidence/benchmark work. |
| #16941 | `heartbeat/pr-archive` — PR-review archive                              | BLOCKED        | Heartbeat/telemetry lane; do not hand-merge stale archival state.                                                   |

## 9. Remaining falsifiable work, in recommended order

<!-- prettier-ignore -->
| Priority | Bounded next unit                            | Must be true before implementation starts                                                                                 | Required failure controls                                                                                                                         | Explicitly excluded result                                    |
| -------: | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
|        1 | ARC offline memory-provenance preflight | The reviewed `arc-offline-carry-v1` contract is frozen; the runner labels every state item as `current_level_live`, `prior_level_memory`, `cross_game_memory`, `candidate_transfer`, `static_program`, or `runner_metadata`, with source and availability time. | Deterministic replay; prior-level and cross-game positive-continuity controls; current-level preload/early-read, undeclared-memory, transition-policy, memory-removal, and source/world/schema identity mutations. | ARC score, agent winner, generic learning, held-out transfer, or official ARC result. |
|        2 | MiniGrid independent score-emitter preflight | Implement the audited F# static-adapter and upstream-Python single-episode seed-2000 trace emitters, without policy code. | Parent identity, action trace, reward/terminal/truncation, no-learning schema, hidden-cap, and cross-oracle mutations.                            | Any MiniGrid score, winner, or transfer conclusion.           |
|        3 | MiniGrid finite candidate evaluation         | The contract plus independent emitters and all preflight controls are merged.                                             | Complete roster/replay, train-eval separation, frozen table digest, equal access, and statistical-replay faults.                                  | General curiosity, general transfer, or parameter efficiency. |
|        4 | Test-only withdrawal-declaration verifier    | A contract-pinned fixture exists without representing production evidence.                                                | Parent/declaration byte change, signer mismatch, invalid scope/reason/window, coexistence with correction/key revocation, local instant boundary. | Real production withdrawal, permission, or consent.           |
|        5 | Production withdrawal input                  | An authorized operator provides an external roster-bound parent attestation and exact verification context.               | Missing/unbound parent and changed source/signature context must defer/refuse.                                                                    | Automatic authority or consent inference.                     |
|        6 | NCI witness expansion                        | A new finite subject/model/property, not a relabeling of `NciNonUrgency`.                                                 | A discriminating configuration mutation and checker/version mismatch.                                                                             | Global safety/NCI theorem.                                    |
|        7 | Recorded-consensus research                  | A human/organizational process specifies immutable evidence, withdrawal, dissent, scope, and accountable authority.       | Missing/dissenting/expired evidence and no automatic threshold escalation.                                                                        | Emergent global moral scorer or autonomous society authority. |

## 10. Non-negotiable boundary reminders

The following statements remain unsupported and must not be inferred from the merged work:

- General intelligence, universal learning, general transfer, English understanding, cortical equivalence, consciousness, free will, or a semantic/geospatial theory of language.
- Generic non-Gaussian inference, universal Bayesian updating, or large parameter/energy-efficiency claims.
- Generic Windows filesystem correctness, generic K3s/cluster reliability, external-network correctness, or an operational safety guarantee.
- Consent, subjective intent, legal validity, privacy, invisibility, authority, social legitimacy, consensus, or global policy authority.
- A conclusion that canonical evidence CRDT state and Bayesian/posterior/materialized queries are the same thing. They remain separate: content-addressed ACI state is replicated evidence; numerical/inference materializations are deterministic queries under their declared assumptions.

## 11. Repository hygiene at handoff

The current worktree preserves `.cache/` and `todo.md` as untracked local continuity material; do not stage either. The MiniGrid policy-comparison contract is now merged. Any later score implementation should begin from fresh `origin/main`, carry only its separately reviewed runner/receipt changes, and leave infrastructure lanes untouched.

## References

[1]: https://github.com/Lucent-Financial-Group/Zeta/pull/16671 "PR #16671 — GitHub Pages provenance UI parity"
[2]: https://github.com/Lucent-Financial-Group/Zeta/pull/16678 "PR #16678 — Pages provenance artifact verification"
[3]: https://github.com/Lucent-Financial-Group/Zeta/pull/16708 "PR #16708 — Contextual-grid 100-seed result receipt"
[4]: https://github.com/Lucent-Financial-Group/Zeta/pull/16737 "PR #16737 — Reflected contextual-grid control"
[5]: https://github.com/Lucent-Financial-Group/Zeta/pull/16773 "PR #16773 — MiniGrid Empty-5x5 adapter conformance"
[6]: https://github.com/Lucent-Financial-Group/Zeta/pull/16840 "PR #16840 — Policy self-knowledge and tick-admissibility receipt"
[7]: https://github.com/Lucent-Financial-Group/Zeta/pull/16868 "PR #16868 — Finite NCI witness verifier"
[8]: https://github.com/Lucent-Financial-Group/Zeta/pull/16916 "PR #16916 — Test-only local attestation-window receipt"
[9]: ../research/2026-09-07-attestation-consent-expiry-verifier-conformance-result.md "Attestation-window conformance result"
[10]: ../../src/Core.TypeScript/federated-identity/revocation.ts "Federated RevocationGSet implementation"
[11]: ../../src/Core.TypeScript/observe/room/durable-room-evidence-audit.ts "Room evidence audit genesis and prior-hash binding"
[12]: https://github.com/Lucent-Financial-Group/Zeta/pull/16938 "PR #16938 — Withdrawal declaration contract and consolidated handoff"
[13]: https://github.com/Lucent-Financial-Group/Zeta/pull/16962 "PR #16962 — MiniGrid policy-comparison contract"
[14]: ../research/2026-09-08-arc-agi-3-readiness-and-no-cheating-boundary.md "ARC-AGI-3 readiness and no-cheating boundary"
[15]: ../research/2026-09-08-arc-offline-carry-forward-evidence-contract.md "ARC offline carry-forward evidence contract"
[16]: ../research/2026-09-08-arc-online-memory-provenance-receipt-contract.md "ARC online-memory provenance receipt contract"
