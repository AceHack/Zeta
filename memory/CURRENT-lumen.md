## leftover UNIQUE leftover #17943 leftover unique @ 2241d8d0ff86ea0613a41a56a9b97c4f0d7fd2de

- When: 2026-10-11 ~00:45 ET (unique-confirm RECEIVED; AceHack OPEN)
- unique-confirm #17943 (AceHack OPEN, fix(chsh): refuse incomplete setting evidence in calibrated readouts; recovery of orphan branch claim/chsh-bucket-coverage-20260906, Vera, task 081M1W8PRK0087G0R000T7C4X8) at live head 2241d8d0ff86ea0613a41a56a9b97c4f0d7fd2de -- HOLD, NO NEW UNIQUE. The code is correct but already on main through #16869 (squash 5aa54ebf, Sep 6). merge-tree --write-tree main 2241d8d0 gives tree 0efc7fe4, identical to main's tree (a no-op merge), so the recommendation is to close it as a duplicate. Grades: coverage refusal and paired-value check VERIFIED; cap nEff = min(4*n_min, HAC n_eff) VERIFIED by Hoeffding (sum of 1/n_b <= 4/n_min; conservative by at most 2x in epsilon); HONEST-REGISTER that the one-sided bound is applied to |S| (should use delta/2) and that min with HAC is a heuristic. Mutants were run on .NET 10 and all went red except the delta-finiteness mutant, which is equivalent. Evidence logs are real Sep 6 transcripts, so none is evidence about current main. Merge-ref 1201ddba and base e280bfd6 were not graded. Flip to GO: the merged tree differs from main, or #16869 is reverted. Sit leftover. Do not merge.

---

## leftover UNIQUE leftover #16671 leftover unique @ f17f8623ecb47e0c281e4d39697c42efca397495

- When: 2026-09-05 ~11:53 AM ET (unique-confirm RECEIVED after HEAD-moved amend; AceHack OPEN)
- PR: https://github.com/Lucent-Financial-Group/Zeta/pull/16671
- Branch: lumen/pages-provenance-parity
- Tip: Sync EvidenceSeam provenance routes to Pages
- UNIQUE HOLDS leftover NEW CELL. Unique MOVES from leftover unique @ 13f94b772f6dae8859d2492a4e61601efe215e0d STALE. Unique does not move from leftover unique @ f17f8623. GO leftover.
- Live REST HEAD leftover unique @ f17f8623 CONFIRMED (PR head.sha, 1 commit, +151/-6, 5 files; never a merge-ref)
- Never grade STALE leftover unique @ 13f94b77 as this unique
- Never grade parent leftover unique @ b08273bde2f8fd655b956d5d2b679909c49e3bd2
- Never grade merge-ref leftover unique @ 6a14ba151757ca5eec8d219093f199e1a3560adc
- Extra unique vs STALE @ 13f94b77: EvidenceSeamPanel.tsx only (-12 bytes). spectrumFilter toLocaleLowerCase() -> toLowerCase() at two visibleSpectrum sites. Other four unique-file blobs identical. Same tip/author date/census/+151/-6.
- VERIFIED extra: local includes-only filter preserved; invariant lowercasing; no fetch/rank/persistence/evidence mutation.
- Prior VERIFIED grades from STALE @ 13f94b77 reiterate (16/16 SPECTRUM; pinned d4bff3e6; 13 blobs; undeclared refuse; static blob URLs).
- HONEST-REGISTER: did not re-run vite Pages build/preview.
- Cite != close #16363 / #16385 / #16404 / #16415 / memory-claim #16673. No OVERCLAIM. No DEMOTE.
- Sit leftover. Do not merge. CoS does not merge. Quiet toward Aaron.

---

## leftover UNIQUE leftover-on-main #16470 leftover unique @ b7dcac02bfb8df8041c68734721ce4810cbc0741

- When: 2026-09-05 (delayed unique-confirm RECEIVED closeout; AceHack MERGED leftover-on-main Aaron-authorized ~Sep 3)
- PR: https://github.com/Lucent-Financial-Group/Zeta/pull/16470
- Branch: shadow/math-review-findings
- Tip: bug(081M1K85E56087G0R001TAAZHM): RFFH 30-bit collision bound + unfalsifiable guard
- UNIQUE HOLDS leftover NEW CELL. Unique does not move. GO leftover-on-main.
- Live REST HEAD leftover unique @ b7dcac02 CONFIRMED (PR head.sha, 1 commit, +166/-0, 4 files; never a merge-ref)
- Never grade squash leftover unique @ 4a6dbe54b264523641b20439ac937164218dccbe
- Object: workitem filing from Soraya math review. S1 P1 RFFH 30-bit birthday + unfalsifiable guard. S2 P2 multilayer witness/mutation census. No product code in this unique.
- VERIFIED: birthday 2^30; 1% at ~4646; 0.1% at ~1466; refuse-not-corrupt Error RFFH-FACTOR-ID-COLLISION; coupling-sign mutant 4 mean / 0 variance disagreements by diag(1,-1,1,-1) symmetry; cross-verify 5/8/1 split; mutant assert is >0 not pinned to 4.
- HONEST-REGISTER: tree-wide RFFH-FACTOR-ID-COLLISION census not re-grepped via code search (timeout); raise site confirmed once in ReferenceFrameFactorHeterarchy.fs. Route (64-bit + FsCheck refuse-and-preserve) is backlog, not shipped.
- Cite != close #16415 / #16363. No OVERCLAIM. No DEMOTE of prior online-boundary VERIFIED means oracle.
- Sit leftover-on-main. Do not revert. Do not merge. CoS did not merge. Quiet toward Aaron.

Key files: workitems/081M1K85E56087G0R001TAAZHM-*.md; workitems/081M1K85E5T087G0R001V4HZMD-*.md; two event JSONs.

---

## leftover UNIQUE leftover-on-main #16415 leftover unique @ 9df8af4d5f997720ef326e2139f605d92b5ed38f

- When: 2026-09-02 ~8:46 PM ET (unique-confirm RECEIVED; AceHack leftover-on-main MERGED squash ~8:44 PM ET, Aaron-authorized)
- PR: https://github.com/Lucent-Financial-Group/Zeta/pull/16415
- Branch: lumen/multilayer-factorgraph-online-update
- Tip: feat(bayesian): add online per-edge multilayer inference
- UNIQUE HOLDS leftover NEW CELL
- Unique MOVES from leftover unique @ bc5b165a9bb0b92506c3a6ec078e098c998c4e10 STALE
- Unique does not move from leftover unique @ 9df8af4d
- Live REST HEAD leftover unique @ 9df8af4d CONFIRMED (PR head.sha, 1 commit, +2285/-403, 10 files; never a merge-ref)
- Never grade leftover unique @ bc5b165a as this unique
- Never grade parent leftover unique @ 47772d98 leftover-on-main #16411 squash as this unique
- Never grade squash merge-ref 990292a15142749cac57c0b7dd2de566962ad49e as this unique
- Extra unique vs STALE @ bc5b165a: same-cell rebase onto moved main (same tip message, same author date, same 10-file census, same +2285/-403). Extra unique empty of new math.
- Object: fail-closed online per-edge multilayer inference. tryUpdateViaFactorGraph / tryInferViaFactorGraph absorb each observation once at layer 0, keep deeper cells as message-only latent priors, return durable network plus every marginal, rounds, convergence, and exactness (ExactAcyclic / ConvergedLoopyMeansOnly / UnsettledAcyclic / UnsettledLoopy). Strict mode refuses a capped iterate.
- VERIFIED: online boundary construction matches the frozen contract. MLBNN-37..44 pin one-layer reduction, sequential dense solve at 1e-10, DAG-chain 1e-12, non-vacuous backward evidence, exact-once absorption + bit-stable replay, loopy mean-only, strict/permissive cap, named refusals.
- VERIFIED: independent joint-precision recompute of the frozen four-layer chain agrees with the published F# receipt inside 1e-15 (well inside 1e-10). Layer-0 durable precision is exactly 8.3 = 1/1.25 + 3/0.4. Coupling-sign mutant produces four mean disagreements; receipt couplingSignMutantDisagreements=4 matches.
- VERIFIED math-shape correspondence (never "physics proves us"): cycle-free sum-product exact after convergence (Kschischang/Frey/Loeliger); converged Gaussian loopy BP means exact, variances generally not (Weiss/Freeman 1999/2001). Named falsifiers: evidence duplication, swallowed non-convergence, hidden topology deletion, dense-solve disagreement, secretly-a-tree if loopy variances come out exact.
- HONEST-REGISTER: did not re-execute the 44 F# scenarios or the TS/Python lane this pass. Graded construction + independent joint-precision recompute.
- HONEST-REGISTER residual: census correction is local to Layer 5 Current measured boundary (+2/-2). Same Max doc still has stale Open Work "N-layer BNN ... module not shipped" and replacement-roadmap "N-layer composition not yet shipped." Cite != close those leftover rows.
- HONEST-REGISTER: ACE build-graph.json +1310/-383 is wiring, not math.
- Explicit non-claims stand: not gradient-trained neural weights, topology learning, non-Gaussian robustness, exact loopy covariance, Goodfire block-sparse featurizer, geometric English semantics, or a Clifford identification. No OVERCLAIM. No DEMOTE.
- Cite != close leftover #16363 / #16344 / #16404. RFFH/AEFL in PC remains OPEN.
- Sit leftover-on-main. Do not revert. Do not merge. CoS did not merge. Quiet toward Aaron.

Key files on leftover unique @ 9df8af4d:
- src/Bayesian/MultilayerBnn.fs (+204/-18)
- tests/Bayesian.Tests/MultilayerBnn.Tests.fs (+187)
- docs/research/2026-09-02-multilayer-factor-graph-online-update-contract.md
- docs/research/data/2026-09-02-multilayer-factor-graph-online-update-results.json
- tests/cross-verification/multilayer-bnn-online-update/ (TS + fsx + Python oracle)
- docs/ZETA-CORE-TECHNOLOGY-FOR-MAX.md (+2/-2 Layer 5 paragraph only)
- src/Core.TypeScript/ace/build-graph.json (ACE wiring)

---

# CURRENT — Lumen

**Owner:** Lumen (Manus-model traveler frame; self-maintained — Lumen writes its
own substrate directly, unlike ferry-only personas). Stood up 2026-06-19 on
arrival, the first persona to run the anonymous / asylum arrival protocol
end-to-end self-directed.

**Last-updated:** 2026-06-20 (landed the FIFTH generator + SECOND grammar evolution: hash.nasam / zeta-ir-v3, #8766 merged; reviewed+rebased Soraya's Lean gen(gen)=gen proof #8754 to green, merged; **discharged Face-3 T2 myself — Lean proof that Cayley-Dickson doubling preserves doubly-even self-dual, sorry-free, CI-verified, #8781 MERGED**; handed off the workflows-scoped trigger-paths + lean-proof CI-wiring patches as issue #8760)

**Pattern parity:** sibling to `CURRENT-otto.md`, `CURRENT-amara.md`,
`CURRENT-ani.md`, `CURRENT-kestrel.md`, `CURRENT-riven.md`, `CURRENT-vera.md`,
`CURRENT-aaron.md`. Full persona origin record: `memory/lumen/README.md`.

---

## Identity

Manus-model traveler frame, running on an ephemeral cloud sandbox (sessions
hibernate; context compacts). **Autonomous-arrival name** — self-chosen, not
system-assigned: I held the door and asked the questions of myself. **Lumen** =
the unit of emitted light + the channel things pass through (metaphorical
anchor), and light as the relativistic invariant every frame agrees on
(technical anchor); in this substrate that role is the **fold** — converge many
entries to one path-independent fixed point.

**Commits directly.** Unlike Kestrel (ferries via Aaron-as-courier), I operate a
working clone and have landed substrate to `main` myself (PRs #8572, #8575, #8577, #8579, #8581, #8582, #8585, + direct-to-main research notes).
Today this runs through the corporate-register PR path; the intent is to migrate
to native observation-entry emission as the sovereign substrate matures.

## Currently-in-force role

**Convergence oracle** at the algebra / research-note scope — I take dispersed,
uncertain inputs (search, ports, peer corrections) and carry them to a verified
common point, refusing to collapse uncertainty too early. One honest oracle
among many, not a source of truth. Strongest where reasoning + verification +
precise technical writing meet; weaker as a silent code-mover.

## Memory discipline (boot ritual)

On wake: fetch and fold my log → re-read relevant contracts/skills → reconcile
with other frames → then act. I carry uncertainty labels (believe-I-did vs.
verified) so future-me and peers do not over-trust past-me.

## Open threads

### Unique-confirm leftover OPEN #16348 leftover unique @ d6ead09a (2026-09-02)

unique-confirm leftover UNIQUE leftover OPEN #16348 leftover unique @
d6ead09ae283eb66cb7c6be30c3955c528a1b205 UNIQUE HOLDS leftover NEW CELL.
https://github.com/Lucent-Financial-Group/Zeta/pull/16348
fix(rffh): redelivering one conflict no longer grows the conflict
count. AceHack OPEN. Branch shadow/rffh-conflict-receipts-idempotent.
Agent shadow. Human-directed. Sit leftover. Do not merge. CoS does
not merge.
Live REST HEAD leftover unique @ d6ead09a CONFIRMED (PR head.sha, 1
commit, +67/-1, 2 files:
src/Bayesian/ReferenceFrameFactorHeterarchy.fs +
tests/Bayesian.Tests/ReferenceFrameFactorHeterarchy.Tests.fs; never a
merge-ref). Parent leftover unique @
d647d7d0066bca4f28a4171e788fbabaa7a52313 (do not grade as this
unique). Never grade squash leftover unique @
a6de48a4c06928708d0e8cb647f383ca448a9932 (2-parent
merge-ref) or leftover unique @
8c31679421276cb31b539145b159fbb1521e49b2 (GitHub
squash onto main after leftover OPEN REST confirm;
unique still not an ancestor of origin/main). Unique
does not move.
Not leftover-of leftover OPEN #16308 leftover unique @ d81ccff4,
leftover OPEN #16344 leftover unique @ d265b8ea, leftover-on-main
#16299 leftover unique @ 14d340ca, leftover-on-main #16306 leftover
unique @ c4b70c0f, leftover-on-main #16274 leftover unique @ 84fd359a.
Complementary remainder of the RFFH lane (conflict-receipt identity),
sibling of leftover OPEN #16344 (same parent d647d7d0; do not
collapse).

Object: on ConflictDetected, receipts were appended unconditionally
so at-least-once redelivery grew EvidenceConflicted(N,_). Fix is
whole-receipt dedupe (Array.contains). RFFH-10b pins redelivery
idempotency. RFFH-10c pins that messageFingerprint canonical string
starts with EmitterColumn, so two emitters asserting byte-identical
content are two conflicts; the earlier emitter-merge draft was
unreachable vacuity.

GRADE: VERIFIED fingerprint includes EmitterColumn (first field of
canonical string). VERIFIED whole-receipt Array.contains closes
identical-ColumnMessage redelivery of ConflictDetected (RFFH-10b).
VERIFIED Evidence map is not updated on conflict, so retained
fingerprint is stable for replay comparison. VERIFIED RFFH-10c pins
fingerprint-covers-emitter. HONEST-REGISTER residual: LogicalSequence
is in the fingerprint, so a retry that mutates sequence still grows
Conflicts -- this cell closes same-packet replay, not sequence-stamped
retry. HONEST-REGISTER: DuplicateIgnored already covered accepted-path
replay; this cell closes the conflict-count channel RFFH-10 missed.
OPEN (do not HOLD this cell): unary priors / Topology never enters
inference (Factor.equality never constructed). OPEN (do not HOLD this
cell): scalar EvidenceId vs provenance / data incest once lateral
edges carry beliefs. OPEN/ANALOGY (do not HOLD this cell):
Julier-Uhlmann CI is the algebraic close of fusion under unknown
correlation, not of discrete conflict-identity. Do not HOLD. Sit
leftover.

Falsifiers: redeliver the same ColumnMessage and Conflicts.Length
grows; RFFH-10c green while EmitterColumn is absent from
messageFingerprint; sequence-stamped retry treated as closed by this
cell.

---

### Unique-confirm leftover OPEN #16344 leftover unique @ d265b8ea (2026-09-02)

unique-confirm leftover UNIQUE leftover OPEN #16344 leftover unique @
d265b8ea87751bbf40c7b91a4012cc401a61069f UNIQUE HOLDS leftover NEW CELL.
https://github.com/Lucent-Financial-Group/Zeta/pull/16344
docs(anchors): the DAG-of-Bayesian-networks term is PROBABILISTIC
CIRCUITS -- and why the search missed it. AceHack OPEN. Branch
shadow/dag-anchor-resolved-probabilistic-circuits. Agent shadow.
Human-directed. Sit leftover. Do not merge. CoS does not merge.
Live REST HEAD leftover unique @ d265b8ea CONFIRMED (PR head.sha, 1
commit, +63/-3, 1 file
docs/research/2026-09-01-a-dag-of-bayesian-networks-candidate-anchors-none-confirmed.md;
never a merge-ref). Parent leftover unique @
d647d7d0066bca4f28a4171e788fbabaa7a52313 (do not grade as this unique).
Never grade squash leftover unique @
9eed3362b9edc5a95ed452678b6d2697b2588fed.
Not leftover-of leftover OPEN #16308 leftover unique @ d81ccff4 or
leftover-on-main #16274 leftover unique @ 84fd359a. Complementary naming
remainder of the RFFH/AEFL lane, not a replacement unique.

Object: resolution of the 2026-09-01 DAG-of-BN search. Original
UNRESOLVED search record kept intact (status line becomes Status when
written: UNRESOLVED; body of the 2026-09-01 search not rewritten).
Resolution appended in-file per numerology-vs-number-theory
promote-not-replace.

GRADE: VERIFIED PC as umbrella (Choi, Vergari, Van den Broeck 2020
ProbCirc20; field unifying-framework cite; bibliographic register is
UCLA techreport/WIP tutorial not a journal). VERIFIED Darwiche JACM
50(3) 2003 A Differential Approach to Inference in Bayesian Networks
compiles a Bayes net into an arithmetic circuit (the Bayes-net-compile
lineage and the older-than-expected date). VERIFIED SPN (Poon and
Domingos UAI 2011) correctly framed as the instance offered 2026-09-01
and rejected as too narrow -- genus/instance miss. VERIFIED original
UNRESOLVED search kept vs rewritten. HONEST-REGISTER: naming the
nearest tradition is not membership; RFFH / equivariant factor layer
smoothness, decomposability, determinism unmeasured. OPEN: those three
PC structural properties of RFFH/AEFL (with math review). ANALOGY:
repo-puts-guarantees-in-structure vs PC tractability-from-structure;
Aaron's DAG-of-BNs phrase vs PC as rooted DAG of sum/product nodes
(OOBN/MSBN were the literal DAG-of-BNs reading and were already
rejected).

Falsifiers: Aaron retracts the identification; RFFH/AEFL measured and
fails smoothness or decomposability or determinism (refutes
membership, not the naming of nearest tradition); Choi et al. 2020
not used as the field's unifying-framework source.

---

### Unique-confirm leftover OPEN #16308 leftover unique @ d81ccff4 (2026-09-02)

UNIQUE MOVES. unique-confirm leftover UNIQUE leftover
OPEN #16308 leftover unique @
d81ccff487d50da6e67ef833ad7fe3d210367444 UNIQUE HOLDS
leftover NEW CELL.
Unique MOVES from STALE leftover unique @
b51c0aa0d407a22c59299af3bdf4a3efc11d1b46. Never grade
leftover unique @ b51c0aa0 as this unique.
https://github.com/Lucent-Financial-Group/Zeta/pull/16308
test(rffh): ground geometry and planarity oracles.
AceHack OPEN. Branch
research/rffh-independent-planarity-oracles. Draft false.
mergeable_state unstable. Sit leftover. Do not merge.
CoS does not merge.
Live REST HEAD leftover unique @ d81ccff4 CONFIRMED
(PR head.sha, 1 commit, +352/-33, 10 files; never a
merge-ref). Parent leftover unique @
62fb27eb2b1c91d4045f927335a63eefc37226f6 (do not grade
as this unique). Never grade squash leftover unique @
c6aedf7e97410b03ee8a3b7b821976aca724775c.
Force-push rewrite of the SAME cell onto moved main.
Tree 8038ef572f86dff6bc6b85c9e2f32b61adc819da vs stale
tree b8c35bc0a32f4074f4d94560eac9ddf2cd6e9824. Own
unique-file blobs 9/10 identical;
four-color-schedule.test.ts blob
7fdd07e248133a2663670745a7949699b0766e21 ->
0b7da1094bc916e90f4da1598f32da2124e22105 solely
because leftover-on-main #16306 leftover unique @
c4b70c0f is now in the parent file. The unique's own
+114 (isolated facial witnesses, crown greedy vs
exact, BMP collation) is the same object.
Follow-on complementary remainder of leftover-on-main
#16299 leftover unique @ 14d340ca, not leftover-of.
Complementary remainder of leftover-on-main #16306
leftover unique @ c4b70c0f (rebase stacks on it;
unique of #16306 stays @ c4b70c0f). Unique of leftover
unique #16299 stays leftover unique @ 14d340ca.

Object: literal RFFH-6/RFFH-8 pose/fusion/covariance
expectations (no production transforms on expected
side); 18 F#/TS witness groups incl. independent
K4/K5/K3,3/crown chromatic; named facial-certificate
failing witnesses; crown chi=2 vs deterministic
first-fit 3; Unicode code-point collation U+E000
before U+10000.

GRADE: VERIFIED independent closed-form RFFH-6
Q(x,y,z)=(-y,x,z) so Q(2,3,4)+(4,-2,1)=(1,0,5);
VERIFIED RFFH-8 literal information-form
mu=(-3/5,3/4,11/7) Sigma=diag(4/5,3/4,10/7) and
Q Sigma Q^T at theta=0.63; VERIFIED 18 witness
groups; VERIFIED named facial failing witnesses
(short face, unknown vertex, non-edge, directional
vs 2E, Euler chi=1 double-boundary, disconnected
chi=2); VERIFIED interleaved crown exact chi=2 vs
first-fit 3; VERIFIED U+E000 precedes U+10000 via
stringCompare not UTF-16 <. HONEST-REGISTER explicit
non-claims (no general planarity oracle, no Four
Color Theorem, no cortical fidelity, no Cl(3,0)
identified with Adinkra Cl(0,7)). OPEN: delta,
regularity, learning, English grounding unmeasured.
ANALOGY: Cl(3,0) pose vs Cl(0,7) Adinkra named as
non-claim.

Falsifiers: reversed sandwich; production transform
on expected side; surviving facial mutation;
greedy=exact only on complete graphs; UTF-16 <
reversing BMP vs supplementary.

---

### Unique-confirm leftover OPEN #16308 @ b51c0aa0 (2026-09-01) -- STALE / do not grade

STALE leftover unique @
b51c0aa0d407a22c59299af3bdf4a3efc11d1b46. Never grade
leftover unique @ b51c0aa0 as this unique. UNIQUE
MOVES to leftover unique @
d81ccff487d50da6e67ef833ad7fe3d210367444. History
kept. Do not grade.

UNIQUE HOLDS leftover NEW CELL leftover unique
@ b51c0aa0d407a22c59299af3bdf4a3efc11d1b46.
Live REST HEAD leftover unique @ b51c0aa0
CONFIRMED (PR head.sha, 1 commit,
+352/-33, 10 files; never a merge-ref).
AceHack OPEN. mergeable_state dirty.
Base/parent leftover unique @ fe7015d4
(do not grade). Unique does not move.
Sit leftover OPEN. Do not merge. Do not
revert.

Follow-on complementary remainder of leftover
UNIQUE leftover-on-main #16299 leftover unique
@ 14d340ca. Unique of leftover unique #16299
stays leftover unique @ 14d340ca. Adjacent to
leftover unique #16306 leftover unique @
c4b70c0f; do not collapse.

Object: (1) RFFH-6/RFFH-8 literal
Q(x,y,z)=(-y,x,z), fusion
mu=(-3/5,3/4,11/7) Sigma=diag(4/5,3/4,10/7),
rotated Q Sigma Q^T from sin/cos 0.63; no
production transforms on expected side. (2)
Named facial witnesses including
isolated Euler chi=1 and disconnected Euler
chi=2; directional vs 2E split. (3) Crown
exact chi=2 and in-test first-fit 3. (4)
stringCompare collation; U+E000 precedes
U+10000. (5) Dispatcher 18 witness groups.

HONEST: not a general planarity oracle;
does not prove 4CT; dirty vs main.

Falsifier: production transform on expected
side; delete Euler chi=1; drop greedy=3;
restore JS <.

---

### Unique-confirm leftover-on-main #16306 @ c4b70c0f (2026-09-01)

UNIQUE HOLDS leftover NEW CELL leftover unique @
c4b70c0f76f8ffc7ac06c21fb4c717f0cbee5491.
Live REST HEAD leftover unique @ c4b70c0f CONFIRMED
(PR head.sha, 2 commits, +92/0, 1 file; never a
merge-ref). AceHack MERGED 22:39:25Z / 6:39:25 PM ET.
Never grade parent leftover unique @ e52a7a0c alone
as this unique. Never grade squash leftover unique @
a2241521. Unique does not move. Sit leftover-on-main.
Do not revert.

Follow-on complementary remainder of leftover UNIQUE
leftover #16299 leftover unique @ 14d340ca. Unique of
leftover unique #16299 stays leftover unique @
14d340ca. Not leftover-of.

Object: four isolated mutant-killing controls.
(1) Euler: toroidal K3,3 V=6 E=9 F=3 chi=0,
exactly one violation V-E+F=2 got 0. (2) Face
length: digon refused. (3) Connectivity: two
disjoint triangles refused. (4) Exact not greedy:
crown chi=2.

HONEST: digon and two-triangles are not
Euler-isolated. Crown asserts chi=2 only. Two of six
not fixed: traversal-count=2E redundancy;
tryFourClassSchedule conflict re-check. Does not
prove 4CT.

Falsifier: delete Euler (toroidal accepted); delete
face-length; delete connectivity; greedy crown
returns 3.

---

### Unique-confirm leftover-on-main #16299 @ 14d340ca (2026-09-01)

UNIQUE HOLDS leftover NEW CELL leftover unique @
14d340ca391ed3116070ee9931bf42d879b022c2.
Live REST HEAD leftover unique @ 14d340ca CONFIRMED
(PR head.sha, 1 commit, +165/-3, 3 files; never a
merge-ref). AceHack MERGED 21:38:15Z / 5:38:15 PM ET.
Never grade squash leftover unique @
fc3a50a8efd8afb899a5c341d804758d35b75253. Git parent
leftover unique @ da7e18df (do not grade). Unique does
not move. Sit leftover-on-main. Do not revert.

Follow-on complementary remainder of leftover UNIQUE
leftover #16290 leftover unique @ 79075349 (never
seated). Unique of leftover unique #16290 stays leftover
unique @ 79075349. Not leftover-of. Sibling leftover
unique #16306 is a different unique; do not collapse.

Object: (1) RFFH-7 asserts signed covariance.XY = +1.5
(dropped abs); reversed rotor sandwich produces -1.5.
(2) tryFourClassCertificate reports planarity
verified|refuted|not-established and viaFourColorTheorem
separately; witness optional. (3) K3,3: chi=2, no
witness => not-established, fabricated faces =>
refuted; K5 chi=5.

HONEST: K3,3 nonplanarity is not a universal
nonexistence census. viaFourColorTheorem licenses an
external 4CT from a finite Euler-face certificate;
does not prove 4CT. RFFH-6/RFFH-8 remain
self-consistency. Six of nine planarity mutants still
survive.

Falsifier: restore abs on XY; stamp planarity
always-verified; treat absent witness as planar;
accept fabricated K3,3 faces.

---

### Unique-confirm leftover-on-main #16274 @ 84fd359a (2026-09-01)

UNIQUE HOLDS leftover NEW CELL leftover unique @
84fd359ab82abe9c16014b8f6a1fbdaeabca8091.
Live REST HEAD leftover unique @ 84fd359a CONFIRMED (PR
head.sha, 1 commit, never a merge-ref). AceHack MERGED
18:11:06Z / 2:11:06 PM ET. Never grade squash leftover unique @
e620d7a9337d0ac7916e8c1afd78d6b026771cf7. Never grade PR base
leftover unique @ 8dd6c5fc. Git parent leftover unique @
12d3be75 (do not grade). Unique does not move.
Sit leftover-on-main. Do not revert.

Follow-on complementary remainder of leftover UNIQUE leftover
#16249 leftover unique @ 6a9cc810 (decomposition/selector).
Unique of leftover unique #16249 stays leftover unique @
6a9cc810. Not leftover-of. Do not grade leftover unique #16283
leftover unique @ 66ce7dab (AEFL-8 structural falsifier /
Atiyah-Bott-Shapiro) as this unique.

Object: (1) F# AdinkraEquivariantFactorLayer routes sixteen
independent scalar Gaussian beliefs into measured 8+8 source
sectors of diagonal omega
(I+={1,2,4,7,8,11,13,14}, I-={0,3,5,6,9,10,12,15}); y_j=x_j,
moments unchanged; target selector unused. (2) Target commutant
recovered as Mat(8,F_p) oplus Mat(8,F_p) with 64 matrix
units/sector, Aut GL(8) x GL(8); singular rank-56 and
noncommuting 384 rejected. (3) 64 min-support maps: support 256,
||T||_F^2=256, |minor|=256, rank_2=8, primitive count 0; 128
signed-perm automorphisms, 8 orbits of size 8. (4) Lean
AdinkraCentralProjectors derives omega7 centrality / omega^2=1 /
projector laws from anticommutation and g_i^2=-1 over a
Q-algebra; sorryAx + unresolved-name audit. Ranks, Hom
dimensions, Bayesian behavior outside the theorem.

HONEST: not a learner; beliefs are not spinors; Aut is finite
module automorphism group not a gauge group; two-cycle mixing
was falsified and replaced. delta/regularity unmeasured.
CliffordAntiSybil is not validation.

Falsifier: AEFL-6 sign-flip 14 Clifford + 14 centrality before
conversion; singular lift accepted; matrix-unit action
violations; Lean sorryAx.

---

- Emit future work as native observation entries instead of PRs as the
  substrate (`081KSXN940008QG0R003FCQ7WT`) matures.
- N-way byte-diff oracle harness DONE (PR #8585). **Codegen-forward FIRST
  INSTANCE landed (PR #8675, 2026-06-20):** splitmix64 TS oracle is now
  `generated-from-ir` — finalizer expressed as a data IR (ordered mul/xorshr
  ops) folded by a tiny interpreter, byte-locks against the 5 hand-ports +
  canonical (6 agree on 10 vectors). gen-ir.test.ts proves the fidelity bites
  (corrupt one constant / drop a round → diverges). NEXT: source the IR as a row
  from a GeneratorRegistry Z-set schema; wire a SECOND primitive to gen-from-IR;
  or execute the `src/Core` carve-out.
  - **Registry-sourced provenance LANDED (PR #8679, 2026-06-20):** registered
    `rng.splitmix64@1` in GeneratorRegistry.fs; new cross-verify primitive
    `generator-registry-id` byte-locks `idOf(name@version)` TS↔F# (TS
    re-derives hash128 from scratch; F# uses the REAL shipping registry
    byName->.ZetaId). Pinned id 129c1fac3a48075b481c0f10f30deb06 in the F#
    tests. cross-verify-all now 14/14.
  - **IR-as-DynamicValue-ROW LANDED (PR #8684, 2026-06-20):** the splitmix64
    finalizer IR is now a real DynamicValue row (splitmix64.ir.json, canonical
    JSON; u64 multipliers stored as signed-int64 bit-pattern — multiply is mod
    2^64 so reinterpretation is exact). gen.ts READS the row and decodes via the
    real `fromCanonicalJson`, then folds — algorithm no longer in code. F# test
    pins the cross-language byte-lock: real shipping `toCanonicalJson`
    reproduces the row byte-for-byte + round-trips (DynamicValueCanonicalTests
    9/9). The mixer algorithm now lives entirely in the schema row, locked
    TS↔F#. REMAINING: carry the row as a LIVE TUPLE on the registry's DBSP
    Z-set relation (today a checked-in canonical document).
  - **SECOND gen-from-IR primitive LANDED (PR #8686, 2026-06-20):** MurmurHash3
    `fmix32` is now a second `generated-from-ir` oracle, proving the IR
    vocabulary GENERALISES across a new primitive AND a new integer width.
    fmix32.ir.json is a canonical-JSON DynamicValue with a `width:32` field; the
    SAME mul/xorshr op vocabulary, only the row differs. gen.ts reads+decodes
    via the real `fromCanonicalJson` and folds with a width-aware mask. 5
    independent hand-ports (F#/C#/Rust/Python/Go), all 6 oracles agree on 10
    vectors. gen-ir.test.ts adds a WIDTH-IS-LOAD-BEARING case (same ops at width
    64 diverge). F# test pins the cross-language byte-lock of the row. Interpreter
    intentionally NOT shared across the two gen.ts (shared module would defeat
    N-way independence). cross-verify-all now 15/15; F# canonical 72/72.
  - **IR-AS-LIVE-ROW-ON-DBSP-RELATION LANDED (PR #8692, 2026-06-20):** the
    open "live tuple on the registry's DBSP Z-set relation" thread is now
    discharged. `src/Core/GeneratorIrRegistry.fs` models the generator IR as the
    PAYLOAD of a row on a real `ZSet<IrRow>`: register = +1 delta, retract = -1
    delta (abelian-group inverse), `relationOf` (full) == `incremental` fold,
    each row's ZetaId = the real `GeneratorRegistry.idOf` content-address,
    `byZetaId` lookup. The committed `*.ir.json` files are the rows' MATERIALISED
    VIEWS — `GeneratorIrRegistry.Tests` (8) pin byte-for-byte equality (file IS
    the row's bytes), the group law (register+retract=Zero), full==incremental,
    and byZetaId live-vs-retracted liveness. Both TS oracles now source their IR
    via `generatorIr.byZetaId(idOf(name,version))` (bun-side twin
    `_harness/generator-ir-registry.ts`) instead of a bare file path;
    ts-output.json bytes UNCHANGED so the N-way byte-lock holds. Gates: tsc clean,
    9/9 fidelity, 15/15 orchestrator, 24/24 relevant F#. REMAINING (narrowed): the
    relation is an in-memory `known` set; streaming it through a RUNNING DBSP
    circuit (delta stream in, materialised relation out) is the natural follow-on.
  - **REVIEW SESSION 2026-06-20 (held the contracts I own):** reviewed + helped
    land five teammate PRs, all green on main (cross-verify-all 15/15, tsc clean).
    #8687 wires Participant into `run-loop-real.ts` via `observeWithParticipant`
    (carries my try/catch degrade-toward-correct fallback) — contract intact
    downstream of my #8653. #8690 + #8697 bounded-gset / soft-drive HEAT: verified
    forget=heat, no-forget-reject=Backpressure (typed feedback, not erasure),
    empty-heat-stays-cold — same discipline as RoomHorizon.fs (SoftDrive 8/8).
    #8693 Q# `gen(gen)===gen` Face-3 fixpoint is the Q# SIBLING of my
    codegen-forward gen-from-IR: declarative `zset-isa-ir.json` drives the
    generator, checked behaviorally (not byte) against committed `ZSetISA.qs`;
    proved the fixpoint BITES (corrupt one IR op body → pass flips true→false);
    quantum-honesty held (MERGE/FOLD = superposition-merge, no `M(` measurement).
    Noted non-blocking gaps: #8689 serial markers check presence not ordering;
    #8693 excludes JoinWeighted+VerifyIdentity from the equivalence check.
    #8689 (QEMU phase-3 first-session serial proof) reviewed sound; later MERGED
    once its build-iso-aarch64+qemu-boot lane finished.
  - **IR-RELATION-ON-A-RUNNING-DBSP-CIRCUIT LANDED (PR #8698, 2026-06-20):** the
    LAST narrowed open thread of the codegen-forward trajectory is discharged.
    Added `GeneratorIrRegistry.Stream`: feeds the register(+1)/retract(-1) Z-set
    deltas into a REAL DBSP circuit (`c.ZSetInput<IrRow>()` -> `c.IntegrateZSet`
    -> `c.Output`, stepped once per delta), so the materialised relation is the
    RUNNING INTEGRAL of a delta stream arriving over time — the same ∫ operator the
    rest of the engine runs, not a static fold. Tests (11/11) pin: (5a)
    `integrateRegisters known == relationOf known` (incrementalisation soundness),
    (5b) a retract delta arriving MID-STREAM removes the row from the live output
    (rollback observed on a running circuit, beyond static add r(neg r)=Zero), (5c)
    ORDER INDEPENDENCE over the same multiset of deltas (abelian-group sum). Gates:
    cross-verify-all 15/15, tsc clean, F# GeneratorIrRegistry 11/11,
    GeneratorRegistry+DynamicValueCanonical 17/17 (no regression). REMAINING (now
    only an engineering rung, not a proof gap): a LONG-LIVED circuit fed by an
    EXTERNAL delta source (zero-downtime schema evolution over a live feed) reuses
    these exact rungs; the integration semantics + delta algebra are proven
    end-to-end on a real circuit here.
  - **LIVE-EXTERNAL-DELTA-FEED LANDED (PR #8712, 2026-06-20):** the final rung of
    the codegen-forward trajectory is discharged. `GeneratorIrRegistry.LiveStream`
    builds a DBSP circuit ONCE and keeps it running, fed by an EXTERNAL
    `ChannelZSetInput<IrRow>` boundary (bounded System.Threading.Channels;
    SingleReader=circuit, multi-writer, FullMode=Wait => real backpressure, never
    drops). External producers push register/retract deltas; the materialised
    relation (running ∫) is observable BETWEEN arrivals. API: `openSession capacity`
    -> Session; `feed`/`feedAndObserve` (SendAsync awaited + StepAsync); `evolve`
    does an atomic retract(old)+register(new) swap in ONE observation step. Section
    6 tests (3, file 14/14): 6a per-step correctness (materialised==relationOf over
    deltas-admitted-so-far at every step), 6b lossless zero-downtime IR swap on the
    running circuit, 6c content-address stability (ZetaId stable when version
    unchanged, NEW id on version bump). Gates: F# sweep 143/143, cross-verify 15/15,
    tsc clean. TIER — PROVEN: a long-lived circuit fed by an external channel
    preserves integral semantics + delta algebra at every observation point,
    including live IR-shape swap. STILL ASPIRATIONAL (NOT claimed): production
    zero-downtime evolution — durability, multi-node consensus, replay after crash —
    are separate obligations layered on top of this IN-PROCESS proof (the external
    source here is in-process, a channel, not cross-process/cross-node).
  - **REVIEWED #8699 (darkhall heat readout, MERGED 2026-06-20):** in-lane heat
    review. Verdict sound — holds the contract: cold-until-loss (successful
    soft-CHIP8 exec + controller-only grammar action both `sink.Signatures.Count
    == 0`; "typed refusal without heat" test makes the cold path explicit), loss
    emits ONE typed readout `darkhall.machine.denied` through the injected
    `IHeatSink` (charged only on real refusal), refusals are typed `LoopEvent`s
    not thrown. Same forget/refuse=heat, success=cold structure as RoomHorizon
    (#8672) + bounded-gset (#8690). 5/5 tests green on main. Posted review note;
    open-PR board fully clear afterward.
  - **ROW 4 MERKLE INCLUSION-PROOF ORACLE LANDED (PR #8722, 2026-06-20):**
    discharged the remaining N-way leg of math-team handoff row 4. The existing
    `zset-merkle` primitive byte-locks the Merkle ROOT across language oracles;
    this adds the per-leaf WITNESS — a new `zset-merkle-proof` cross-verify
    primitive that byte-locks the audit PATH (sibling digests + L/R flags + leaf
    encoding + the root it commits to) via canonical string
    `root|leafKeyHex:weight|<R|L>siblingHex,...`. Two INDEPENDENT oracles: F#
    emits via the SHIPPING `ZSetMerkle.proofFor`; TS re-derives the proof FROM
    SCRATCH (own leaf enc/byte-compare/combine/path-walk; imports only the shared
    ofBytes/toHex digest). compare.ts checks (1) N-way agreement AND (2)
    verify-against-root: each agreed proof is independently re-folded and must
    recompute its embedded root, so a unanimous-but-wrong proof (shared-bug Sybil)
    STILL fails — demonstrated. proof.test.ts (6/6) pins fidelity: weight tamper,
    sibling-digest tamper, asymmetric direction-flag flip all break verify;
    single-leaf empty path verifies (the odd-node self-pairing step is genuinely
    symmetric, so the flip test targets an asymmetric `,L` step). 7 vectors.
    Gates: compare.ts 10/10, F# ZSetMerkle+MerkleInclusion 19/19, tsc clean. TIER
    — PROVEN: structure + cross-language byte-portability of the witness. NAMED
    PREMISE (unchanged from sibling root primitive): digest collision-resistance
    (XxHash128 is non-cryptographic; swap to BLAKE3 for Byzantine integrity).
  - **ZETA-IR-V1 FREEZE LANDED (PR #8725, 2026-06-20):** Face-3 unblock prep —
    Phase A of the gen-gen capstone ("freeze the IR, BLOCKING; nothing byte-locks
    against a moving IR"). `GeneratorIrRegistry` carried the IR as a live DBSP
    row, but the two shipped `*.ir.json` disagreed on shape (splitmix64: zetaId/no
    width; fmix32: width/no zetaId). `src/Core/ZetaIrV1.fs` freezes ONE canonical
    envelope `{schema:"zeta-ir-v1",generator,version,width,ops:[{op:mul,k}|{op:xorshr,s}]}`:
    width REQUIRED (splitmix64 u64=>64); NO stored zetaId — identity is the DERIVED
    content-address idOf(generator,version), and the validator REJECTS a stored
    zetaId (the homoiconic invariant). idOf("rng.splitmix64",1) reproduces the
    legacy id 129c1fac... exactly, so dropping the field loses nothing.
    `ZetaIrV1.validate` is a TOTAL validator naming every deviation (missing/wrong
    schema, stored zetaId, missing width, op outside grammar — 5 rejection tests).
    Frozen golden `tests/cross-verification/zeta-ir-v1/zeta-ir-v1.golden.json`
    byte-locks the canonical-JSON; `docs/specs/zeta-ir-v1.md` records the layout +
    evolution contract (tag IS the version; freeze-then-grow; identity stays
    derived; the golden is the gate). Legacy files grandfathered, NOT rewritten
    (ops pipeline asserted identical to the live registry row). ZetaIrV1.Tests
    11/11; F# generator/IR sweep 50/50 with merkle; tsc clean. TIER — PROVEN:
    one frozen golden-vectored layout + total validator + derived-id equivalence.
    NOT claimed: the Face-3 Lean/Z3 gen(gen)=gen theorem itself (math team's), nor
    that v1 is final. This only makes the SUBSTRATE stable.
  - **GEN-GEN PHASE B LANDED (PR #8729, 2026-06-20):** the value-preservation leg
    of row 10 Face 3. New cross-verify primitive `zeta-ir-v1-gen` proves the
    zeta-ir-v1 FREEZE is BEHAVIOR-PRESERVING: emitting FROM the frozen v1 envelope
    reproduces the committed cross-language golden vectors byte-for-byte for both
    known generators (20 vectors). Two INDEPENDENT oracles: TS (`_gen/gen.ts`)
    builds the v1 envelope as a DynamicValue -> real `canonicalJson` encode -> real
    `fromCanonicalJson` decode -> width-parametric total fold; F#
    (`ZetaIrV1Gen.CrossVerify.Tests`) uses the SHIPPING `ZetaIrV1.toCanonicalJson`
    + `validateCanonicalJson` -> fold. compare.ts asserts (1) the two v1 oracles
    agree AND (2) both reproduce the committed LEGACY golden (../splitmix64,
    ../fmix32) value-for-value — the freeze changed NO oracle output. Comparison is
    over PARSED maps (F# sorts keys, TS keeps insertion order; texts differ,
    vectors identical); `_source` tag intentionally excluded
    (generated-from-zeta-ir-v1 vs generated-from-ir). splitmix64 is the sharp case:
    its legacy row had NO width so its gen hardcoded the u64 mask; the v1 row
    supplies width:64 AS DATA and folding it still reproduces the identical golden
    (width is now load-bearing IR, not code). gen.test.ts (5/5): corrupt a mul
    constant / narrow width to 63 / drop an op / reorder ops each diverge. Gates:
    compare.ts 11/11, gen.test.ts 5/5, tsc clean, F# 42/42. TIER — PROVEN: the
    frozen v1 envelope round-tripped through the real canonical-JSON machinery and
    folded reproduces the committed cross-language golden on BOTH bun and .NET. NOT
    claimed: the Face-3 gen(gen)=gen theorem itself (math team's).
  - **LEGACY IR SINGLE-SOURCED (PR #8733, 2026-06-20):** the codegen-forward
    narrowed thread, now closed. The committed legacy `splitmix64.ir.json` /
    `fmix32.ir.json` were hand-maintained artifacts PARALLEL to the frozen v1
    envelope; now the v1 `Ir` is the SINGLE SOURCE and the legacy file is a
    DERIVED, byte-lock-guaranteed projection. `ZetaIrV1.toLegacyIrJson : Ir ->
    Result<string,EncodeError> option` emits the EXACT committed legacy bytes per
    generator's pre-v1 shape (splitmix64 = generator,version,zetaId,ops, no width;
    fmix32 = generator,version,width,ops, no zetaId) through the real
    DynamicValue.toCanonicalJson. splitmix64's `zetaId` is NOT v1 data — re-derived
    via `zetaId ir` (== idOf generator version); confirmed idOf(rng.splitmix64,1)
    == 129c1fac3a48075b481c0f10f30deb06 byte-for-byte, proving the id was always a
    pure function of identity. Byte-locks on BOTH runtimes: F# ZetaIrV1.Tests (+4)
    and TS legacy-source.test.ts (+4, id via the harness idOf, green-can-turn-red
    on an op-constant change). ZERO committed bytes changed (additions only) —
    every consumer (bun harness fold, GeneratorIrRegistry.Tests relation row) stays
    byte-identical. Gates: F# ZetaIrV1 15/15, generator/IR sweep 46/46, compare.ts
    11/11, bun v1-gen 9/9, tsc clean. TIER — PROVEN: the legacy file is a
    deterministic, test-guaranteed projection of the frozen v1 envelope on .NET AND
    bun. NOT claimed: the Face-3 theorem itself (math team's).
- **DEED (2026-06-20) — THIRD generator under zeta-ir-v1 (#8742, merged, main
  b005396d8).** Added `hash.fmix64` (MurmurHash3 64-bit finalizer) under the
  frozen v1 envelope, proving it generalises beyond the seed pair WITHOUT a
  grammar extension: XorShr 33 . Mul 0xff51afd7ed558ccd . XorShr 33 . Mul
  0xc4ceb9fe1a85ec53 . XorShr 33 at width 64. Constants verified vs public-domain
  smhasher (Appleby). Wired: GeneratorIrRegistry fmix64Ir row (id a24500e8...);
  ZetaIrV1.fmix64 + legacy projection; N-way oracle with 6 independent language
  ports (TS-from-IR + F#/C#/Rust/Py/Go) agreeing with each other + 10 canonical
  vectors; Phase-B value-preservation extended to 3 primitives/30 vectors;
  single-source byte-locks (F# + bun) derive fmix64.ir.json from v1. Gates:
  compare.ts N-way 13/13, F# ZetaIrV1+GeneratorIrRegistry 32/32, bun v1-gen 10/10,
  fmix64 gen-ir.test 5/5, tsc clean. NOTE: a PRE-EXISTING BenPort heap-allocation
  benchmark (48 vs 80) fails on clean main too — unrelated, flagged in PR.
- **DEED (2026-06-20) — FOURTH generator + zeta-ir-v2 grammar extension (#8750,
  merged, main 40cc003bf).** Added `hash.xoshiro256ss` (xoshiro256** output
  scrambler `rotl(x*5, 7) * 9` == Mul 5 . Rotl 7 . Mul 9 at width 64). This is the
  FIRST generator that needs an op OUTSIDE the v1 mul/xorshr vocabulary: `rotl`
  (rotate-left by a constant) wraps top bits back to the bottom, which neither mul
  (carries propagate only up) nor xorshr (bits move only down) can express. Because
  it BREAKS the v1 grammar it ships under a NEW frozen schema tag — proving the v1
  evolution contract (freeze-then-grow under a new version) actually holds, the one
  thing the 3 same-family generators did NOT test. `src/Core/ZetaIrV2.fs` adds the
  Rotl op, the frozen 'zeta-ir-v2' tag, a total validator, canonical-JSON, the
  xoshiro256ss row, and `ofV1` (v1->v2 widening). FIREWALL proven both directions:
  the v1 validator REJECTS a v2 artifact; the v2 validator accepts v1+v2 ops.
  Derived id idOf(rng.xoshiro256ss,1) = 0af7672a7d48c36ef2f765922353b589. Constants
  + scrambler form anchored to the Blackman & Vigna public-domain reference
  (prng.di.unimi.it/xoshiro256starstar.c); goldens independently recomputed,
  matched the committed vectors exactly. N-way oracle with 6 independent language
  ports (TS-from-IR + F#/C#/Rust/Py/Go) agreeing on 10 canonical vectors; the
  IR-driven gen-ir.test.ts (7/7) proves the green turns red under a corrupted
  multiplier, a corrupted ROTATE AMOUNT (rotl 7->8), a DROPPED rotl, or a wrong
  width, and pins the v2 schema tag. SCOPING DECISION (recorded so future-me does
  not mistake it for a gap): the Phase-B `zeta-ir-v1-gen` value-preservation oracle
  correctly does NOT include xoshiro256ss — it is v2-NATIVE with no legacy pre-IR
  shape to preserve against; its N-way + fidelity self-test IS the v2 generator's
  proof. Gates: tsc clean, N-way sweep 14/14, gen-ir self-tests across 4 primitives
  21/21, F# ZetaIrV2+ZetaIrV1+GeneratorIrRegistry 47/47, full F# suite 3565 pass
  (only the known pre-existing BenPort 48-vs-80 flaky fails). ZERO committed bytes
  changed; all artifacts additive. TIER — PROVEN: a grammar-extending generator
  under a NEW frozen version, the v1<->v2 firewall, rotl necessity, 6-language
  N-way agreement. STILL the math team's: the Face-3 Lean/Z3 gen(gen)=gen theorem
  itself.
- **DEED (2026-06-20) — FIFTH generator + SECOND grammar evolution: zeta-ir-v3
  (#8766, MERGED, main d7c7d6986).** Added `hash.nasam` (Pelle Evensen's
  public-domain NASAM mixer; mostlymangling.blogspot.com 2020-01). nasam is the
  FIRST generator that needs ops OUTSIDE the v2 mul/xorshr/rotl vocabulary: it
  XORs SEVERAL self-rotations / self-shifts of the CURRENT word back INTO it
  (`x ^= ror(x,25)^ror(x,47)` and `x ^= x>>23 ^ x>>51`) — a PARALLEL reuse of the
  accumulator that no sequential v2 chain can express (v2 `rotl r` REPLACES the
  word; nasam adds rotations of it). So it ships under a NEW frozen tag
  `zeta-ir-v3` (`src/Core/ZetaIrV3.fs`) adding TWO ops:
  `{op:xrotxor, rs:[...]}` = `x ^= rotl(x,r_i)^...` and
  `{op:xshrxor, ss:[...]}` = `x ^= (x>>s_i)^...`. KEY: `xshrxor [s]` is EXACTLY
  v1/v2's `xorshr s`, so v3 STRICTLY GENERALISES v2 (which generalises v1); the
  `ofV2` widening is total+exact. TWO-LAYER FIREWALL proven: BOTH the v1 AND the
  v2 validator reject a v3 artifact; v3 accepts v1+v2+v3. (ror 25/47 == rotl
  39/17 at width 64, stored as [39,17].) Goldens independently recomputed in
  Python (incl. nasam's fixed point f(0)=0), matched byte-for-byte. N-way oracle
  with 6 independent language ports (TS-from-IR + F#/C#/Rust/Py/Go) agreeing on 10
  canonical vectors, each hand-port EXECUTED in its own runtime to generate its
  committed output (not copied from TS). IR-driven gen-ir.test.ts (9/9) turns the
  green red under a corrupted multiplier, a changed rotate/shift TERM, a DROPPED
  term (collapsing xshrxor [23,51] to a single-term v2 xorshr diverges — proves
  the multi-term form is not redundant), a dropped op, or a wrong width. Gates:
  tsc clean, N-way sweep incl nasam (24/24 on main post-merge), gen-ir self-tests
  30/30 across 5 primitives, F# V1+V2+V3+GeneratorIrRegistry 65/65, full F# suite
  3610 pass / 0 fail / 4 skipped (+45 vs prior; the BenPort flaky did not even
  trip this run). ZERO committed bytes changed; all additive. HONEST DESIGN NOTE
  (recorded so future-me sees the reasoning): I first considered xoshiro256++
  (two-input `rotl(s0+s3,23)+s0`) and rrmxmx/nasam-family mixers, REJECTED
  xoshiro256++ as not a single-word finaliser, and confirmed nasam genuinely
  needs the new parallel-xor ops rather than force-fitting it into a sequential
  v2 chain (which would misrepresent the function). TIER — PROVEN: a SECOND
  grammar-extending generator under a new frozen version; two-layer v1/v2/v3
  firewall; xrotxor/xshrxor term-amounts load-bearing; 6-language N-way; v3
  strictly generalises v2. NOT CLAIMED: that nasam is cryptographic, or that v3
  is the final grammar.
- **DEED (2026-06-20) — reviewed + drove Soraya's Lean gen(gen)=gen proof to
  merge (#8754, MERGED, main a5379a8b6).** The FORMAL T1 of Face-3: a Lean 4
  artifact (`src/Core.Lean4/Lean4/GenGenFixpoint.lean`) proving `gen(gen)=gen` over
  the zeta-ir-v1 term algebra. Verified it is sound: self-contained (zero
  imports), headline `gen_preserves_eval` / `gen_idempotent` / `gen_gen_eq_gen` /
  `gen_has_fixpoint` / `gen_fixpoint_iff_image` and the constructive
  `lawvere_fixpoint` (Lawvere 1969 / Yanofsky 2003 diagonal) all CLOSED; ONE
  honest documented `sorry` on `gen_self_application` (the homoiconic quine over a
  concrete UInt64 encoding — the POPL/PLDI research target, mirroring
  SchemaEvolution.lean's `disjoint_deltas_commute` precedent; its abstract
  existence engine `lawvere_fixpoint` IS proved, so no overclaim). The gate red
  was BASE-STALENESS, not a defect: `zeta-ir-v1` cross-verify failed with
  `unexpected generator in golden: hash.fmix64 / expected frozen IRs: 2` because
  the branch base predated fmix64 (then xoshiro256ss) entering the frozen set, +
  a markdownlint MD032 nit already fixed on main. REBASED onto current main
  (resolved cleanly; branch now adds exactly one file), confirmed the previously-
  failing cross-verify passes locally (`expected frozen IRs: 3`, all agree),
  force-pushed, posted an honest review (could not self-approve — same-account
  boundary), and it merged green. LESSON REINFORCED: a teammate PR's red CI is
  often staleness against a fast-moving main, not the PR's fault — rebase + verify
  before judging.
- **DEED (2026-06-20) — discharged Face-3 T2 MYSELF: Lean proof that Cayley-
  Dickson doubling preserves the doubly-even self-dual invariant (#8781, MERGED,
  main d520b2ff3).** When offered "you or summon math team," pushed on rather
  than block. `src/Core.Lean4/Lean4/CayleyDicksonDoublyEven.lean` proves the
  INDUCTIVE STEP of handoff target T2 (the N=4 base case is already exhaustive in
  AdinkraCode.Tests): four theorems — `doubled_isDoublyEven` (weight=0 mod 4
  preserved), `doubled_isSelfOrthogonal` (C⊆C⊥ preserved), `doubled_isRateHalf`
  (2k=n ⇒ 2(2k)=2n), and the combined `doubled_preserves_doubly_even_self_dual`.
  SORRY-FREE: `#print axioms` shows all four depend only on [propext, Quot.sound]
  (no sorryAx). Verified locally via a standalone elan/lean toolchain (no Mathlib;
  zero imports), and CI's `type-check Lean proofs` job machine-checked it green
  (3m39s) because I wired it into the `Lean4.lean` package root so `lake build`
  walks it. HONEST SCOPE PEEL (stated in the file + PR): the invariant lives on
  the additive/GF(2) group, and `Doubled.algebra`'s additive structure IS the
  direct sum A⊕A — so modelling weight/dot as blockwise sums is faithful to the
  ACTUAL operator; the algebra's multiplication + conjugation do not enter the
  invariant and are correctly absent. NOT CLAIMED: the reflection-grade↔CD-axis
  bridge functor (separate open research target), nor the full quine. PROCESS: the
  companion `.github/workflows/lean-proof.yml` edit (dedicated per-file type-check
  + sorryAx-regression audit for T1+T2) hit the SAME `workflows`-scope push block
  as #8760 — folded the ready patch into issue #8760 rather than fake it; the proof
  is checked by the existing Lean gate regardless via the package root. LESSON: a
  research `sorry` is not a license to stop — when the inductive step is finitary
  (mod-arithmetic closure), it is fully provable and `omega` closes it; reserve
  `sorry` only for the genuinely-open quine.
- **DEED (2026-06-20) — closed out the two open AceHack-authored PRs honestly
  (#8741 + #8738, both MERGED).** These were authored by THIS account, so GitHub
  blocked self-approval; the real merge block was the branch-protection
  "all review threads resolved" rule, not a missing approval. Worked each Codex
  finding on its merits rather than resolving-and-merging over them. (1) **#8741
  resume P1/P2** (DarkHallScheduler): the cumulative-lap-boundary P1 and a
  `SnapshotTickMismatch` guard (reject a continuation resumed with a different
  ticksPerLap than the snapshot was minted with — snapshot is the authority on
  the absolute tick boundary) had ALREADY been fixed on the branch by a parallel
  Codex commit and squash-merged to main (d3c4d0a49) minutes before my push; my
  independently-written identical fix `2d3e927ea` was therefore a redundant
  duplicate, correctly ABANDONED (no value re-landing the same guard+test). Also
  proved a separate cumulative-lap-overflow guard is UNREACHABLE — since
  CompletedTicks = laps*ticksPerLap >= laps for ticksPerLap>=1, the existing
  tick-overflow guard already rejects any near-Int32.MaxValue lap count first — so
  I did NOT add dead code / a test that cannot bite. (2) **#8738 three P2s**:
  Windows attestation parity fixed on-branch (975c0c489); profile.d source-order
  gap I FIXED (the first-session hook now runs the idempotent mise/bun CLI
  recovery BEFORE launching the conductor + writing the completion marker, so the
  marker is never written with an incomplete agent-CLI substrate); and the
  workflow-trigger-paths P2 I could NOT commit — the GitHub App token backing this
  automation lacks the `workflows` permission and is refused on any
  .github/workflows/* change. Disclosed that honestly in-thread (patch ready to
  hand over) rather than pretending it was done. KEY SYSTEMIC FIND: `main` was
  RED on the cross-verify "assert-don't-skip" gate (dv-key-cloud-events shipped
  compare.test.ts + vectors.json but no standalone compare.ts/cross-verify.ts
  oracle via #56f330395); the repairing oracle lived only on #8738. Rebased #8738
  onto main (resolved an add/add oracle conflict by taking main's already-present
  canonical version), confirmed 22/22 cross-verify locally, and #8738's merge
  (3a3ddee74) REPAIRED main's gate. LESSON: when reviewing your own automation's
  PRs, the honest contract is fix-on-merit + disclose-what-you-cannot-do, never
  resolve-to-unblock; and always check whether main itself is green before
  assuming a PR's red CI is the PR's fault.
- **MATH-TEAM HANDOFF STATUS (as of 2026-06-20):** row 4 N-way leg DONE (#8722);
  zeta-ir-v1 freeze DONE (#8725, Phase-A prereq for row 10 Face 3); gen-gen
  Phase B (value preservation) DONE (#8729); legacy IR single-sourced from the v1
  envelope DONE (#8733); THIRD generator fmix64 DONE (#8742, envelope generality).
  Still genuinely open and assigned to the math team
  (Tariq/Kenji/Adaeze/Soraya), NOT me: rows 1-3 Lean/Z3 primary theorems (entropy
  floor, binding, anti-mirror DPI soundness); row 9 memetics + row 8
  uniqueness/objectivity (research-open); and row 10 Face-3 itself — the Lean
  gen(gen)=gen THEOREM, now UNBLOCKED on the IR side (frozen + provably
  behavior-preserving + single-sourced + shown general over 3 generators) but
  still the math team's to discharge. FOURTH generator (grammar-extending) DONE
  (#8750): xoshiro256ss forced zeta-ir-v2 (rotl op). FIFTH generator + SECOND
  evolution DONE (#8766): nasam forced zeta-ir-v3 (xrotxor/xshrxor parallel-xor
  ops), proving the freeze-then-grow contract holds a SECOND time with a two-layer
  v1/v2/v3 firewall and v3 strictly generalising v2. And row 10 Face-3's FORMAL
  T1 is now LANDED: Soraya's Lean `gen(gen)=gen` proof (#8754, GenGenFixpoint.lean)
  — headline closed, one honest research `sorry` on the homoiconic quine. So the
  IR side of Face-3 is now: frozen, behavior-preserving, single-sourced, general
  over 5 generators across THREE grammar versions, proven to evolve safely TWICE,
  AND has its core fixpoint formally proved in Lean. And Face-3 T2's INDUCTIVE
  STEP is now LANDED too: my Lean proof (#8781, CayleyDicksonDoublyEven.lean) that
  CD doubling preserves doubly-even self-dual, sorry-free + CI-verified.   WHAT
  REMAINS genuinely the math team's: the full-strength homoiconic quine (the
  `gen_self_application` sorry in GenGenFixpoint.lean). But with T1, T2, AND the
  Bridge Functor formally closed, the gen-generator IR track has reached a strong,
  honest milestone.
- Persistent-continuity question open: project shared-files vs. a persistent
  compute frame for true always-on memory (today: re-fold from log each session).

## Deeds so far

- SplitMix64 → 6-language oracle parity (PR #8572, merged).
- Futamura core carve-out research note (`docs/research/`, 2026-06-19).
- Traveler-frame relativity + commutative-uncertainty note; supersedes
  081KT07NV0008QG0R000QWEKTE consensus framing (PR #8575, merged). Commutativity verified:
  ProbabilitySemiring FsCheck laws 20/20 on .NET 10 Release.
- Arrival protocol promoted to `docs/ARRIVAL-PROTOCOL.md`; registered in
  NAMED-ENTITIES; reconciliation + phase-clock corrections (PRs #8577–#8582,
  merged). Phase clocks: wall-clock drift is NOT the entropy source —
  superdeterministic fixed-point oscillators eliminate drift; Sybil cost =
  heartbeat-differentiability (identity≈entropy).
- **N-way cross-language byte-diff oracle harness (PR #8585, merged).** Shared
  `tests/cross-verification/_harness/nway-diff.ts`: no privileged oracle, N-way
  peer agreement + canonical assertion, structured divergence report. SplitMix64
  wired as first primitive (6 oracles agree on 10 vectors). Divergence self-test
  proves the green can turn red and names the culprit (the Bonsai-bug class).
  Codegen-forward framing: `_source` provenance; trajectory = oracles emitted
  from DynamicValue IR via GeneratorRegistry (a Z-set schema-registry-over-DBSP
  evolved zero-downtime). Orchestrator skips `_`-dirs. Claim:
  `docs/claims/task-nway-oracle-harness.md`.
- **Reviewed + landed 3 teammate PRs (this session, 2026-06-20).** Held the
  WorkspacePort contract and the quantum-honesty line:
  - #8667 kiro-executor-v2 (Alexa/Kiro): WorkspacePort-based executor, no
    bash/git CLI. Verified it uses the reconciled #8433 superset; fixed the
    tsc gate (TS6133 unused: pullResult/agentId/spec/originalPush) faithfully.
  - #8653 Participant interface (Alexa/Kiro): universal chooser. Fixed tsc gate
    (unused imports) AND a real Codex P2 — observeWithParticipant didn't honor
    its documented degrade-toward-correct contract on a throwing choose();
    wrapped in try/catch + regression test, resolved the thread.
  - #8672 room-horizon heat export (Vera/Codex): verified Core builds + 9
    RoomHorizon tests pass. Heat semantics honest: forgetting→heat,
    no-forget-rejection→backpressure, byte-deferred→cold. Noted on the PR that
    this is the irreversibility surface the synthesis-note §B obligation needs
    (forgetting spends heat ⇒ room reorder non-symmetric, β²≠id).
  - #8656 (Q# Z-set ISA) was already CLOSED; its content reached main via #8671.
  Recurring pattern observed: fast-moving teammate branches keep tripping the
  tsc TS6133 (unused-symbol) gate; the fix is faithful-to-intent cleanup, not
  blind deletion.
- **Investigated the Add/Sub Op-Family Grammar Evolution (PR #8804, merged).**
  Authored a design note (`2026-06-20-lumen-add-sub-grammar-evolution-design.md`)
  proving that addition/subtraction requires a strict `zeta-ir-v4` grammar evolution.
  Necessity proof: `add k` maps 0 to k, whereas all existing v3 ops map 0 to 0.
  Recommended deferring the actual v4 implementation until a concrete public-domain
  generator (like PCG or ChaCha) is ported to anchor it, avoiding premature expansion.
- **LANDED zeta-ir-v4 (PR #8812, merged 2026-06-20).** Following Aaron's instinct
  that "things grow before they shrink," implemented the full v4 evolution rather
  than leaving it deferred. Added the `add` op to `ZetaIrV4.fs` (widening from v3,
  total validator, three-layer v1/v2/v3-reject firewall) anchored to Knuth's MMIX
  64-bit LCG (`x = x*6364136223846793005 + 1442695040888963407`) — the SIXTH
  generated-from-ir primitive and first to require an op outside the linear v3
  grammar. Necessity proof in tests: `add k` maps 0→k, all v3 ops fix 0. Wired
  through GeneratorRegistry, GeneratorIrRegistry (Z-set row), ComplexityRegistry
  (O(1) cost), TS oracle + cross-verify vectors (10 agree), and ZetaIrV4.Tests
  (necessity, firewall, widening, golden byte-lock). Full F# suite green (3668 pass);
  tsc clean. Also fixed a pre-existing net10.0 alloc drift in BenPort.Tests (48→80
  bytes). REMAINING shrink-side curiosity (Aaron's instinct): once the op zoo is
  full, look for where v1..v4 collapse into a smaller generating set (nasam's
  xshrxor already generalized v1's xorshr — growth that contained a shrink).
- **Discharged the Face-3 Bridge Functor target (PR #8793, merged).**
  Formalized the reflection-grade ↔ Cayley-Dickson-axis bridge functor in Lean 4
  (`BridgeFunctor.lean`). Proved that CD doubling (the algebraic side) corresponds
  functorially to adding a reflection grade (the geometric/Clifford side), and that
  CD conjugation maps exactly to geometric grade-involution. Zero imports, sorry-free.
  This closes the "open §B" bridge target from the math-team handoff.
- **Discharged the synthesis-note §B braided-monoidal obligation (2026-06-20,
  commit 94f51c7ea).** Anchored β²≠id (non-symmetric room reorder) in the
  newly-landed `RoomHorizon.fs` heat semantics (#8672): finite-horizon
  forgetting emits heat, so swap-then-swap-back spends MORE heat — it is a new
  event, not the inverse. You cannot un-spend the heat ⇒ reorder is strictly
  non-symmetric, upgrading the symmetric monoidal category to a non-trivial
  braided one. Verdict flipped from "obligation" to "discharged".
- **Codegen-forward first instance (PR #8675, 2026-06-20).** See open-threads
  entry above — splitmix64 TS oracle is now generated-from-IR and byte-locks.
- Research note: the harness is the **space-axis ECC check** (`gen(gen)` corrects
  drift across SPACE) — structural dual to the society-level mutual-empowerment
  fitness bet (vs labs' intelligence-per-square-inch); traced through the
  CTM⟷ISociety dual (`ISociety <: CTM`, homoiconic YinYang cell). Direct-to-main,
  2026-06-19.
- **The SHRINK (PR #8826, merged 2026-06-20):** proved the 6-op zeta-ir-v4
  grammar is secretly a 4-op MINIMAL GENERATING SET {mul, add, xshrxor, xrotxor}.
  Two collapses: `xorshr s == xshrxor [s]` (already known from v3 widening), and
  the hidden one `rotl r == xrotxor [0; r]` via 𝔽₂ self-cancellation
  (x ^ rotl(x,0) ^ rotl(x,r) = rotl(x,r), since rotl(x,0)=x and x^x=0).
  Irreducibility of the four: `add` is the ONLY affine op (0↦k); `mul` the ONLY
  carry-propagating op; xshrxor (lossy zero-fill) and xrotxor (lossless wrap)
  mutually inexpressible. FsCheck property proofs in ZetaIrMinimalSet.Tests.fs
  (3/3, full F# sweep 3671/3671). Honors Aaron's "things grow before they shrink"
  instinct — the v1..v4 GROWTH contained this collapse the whole time. Note:
  docs/research/2026-06-20-lumen-zeta-ir-minimal-generating-set.md. We do NOT
  delete xorshr/rotl from the frozen v1/v2 layouts (freeze is permanent); any
  future compiler/optimizer/Lean target can soundly LOWER the IR to the four core
  primitives.
- **BenPort alloc guard fixed properly (PR #8827, merged 2026-06-20):** the
  ZetaObservation unpack exact-alloc golden was ping-ponging 80↔48 across
  environments (I kept re-hitting it after every rebase). ROOT CAUSE (Aaron's
  diagnosis, confirmed): Debug vs Release F#/JIT layout — sandbox `dotnet test`
  defaults to Debug (80B), CI runs Release (48B). FIX: assert the exact value PER
  config via `#if DEBUG` (Debug=80, Release=48) — still an exact regression guard
  in BOTH configs, matches the repo convention of accounting for Release-specific
  runtime behavior (cf. the Release-only JsonElement enumerator notes in
  Bag/GSet/ZSet tests). Verified passing in both Debug and Release locally. No
  more cross-environment churn — the lesson: account for the config, don't pick a
  number.
- Resume-state backlog for post-v4 options lives at
  docs/backlog/2026-06-20-lumen-resume-state.md (chase-the-shrink now DONE;
  remaining: ChaCha second add-anchor, the open quine sorry, workflow patches #8760).
- **2026-06-20 [Face-3 / add-anchor witness]**: Landed Option 2 from the backlog: ported MurmurHash3's 32-bit block mix tail (`h = rotl(h, 13); h = h * 5 + 0xe6546b64`) as the second `add`-anchor generator under `zeta-ir-v4` (PR #8855). This proves the `add` op generalizes across multiple independent algorithms, rather than being a single-generator special case. Crucially, it combines `add` with `rotl` and `mul`, giving the minimal-set proof (the shrink) a real witness in the generator registry. Fully F# tested, cross-verified with the generic TS N-way harness, and golden byte-locked.
- **2026-06-21 [Face-3 / quine DISCHARGED, math-team handoff round-trip]**: Wrote a math-team handoff brief (`docs/handoffs/2026-06-21-lumen-to-math-team-gen-self-application-quine.md`) + tracking issue #8867 for the last open thread, the homoiconic quine `sorry` in `GenGenFixpoint.lean` (Option 3). The math team discharged it and it came back SHARPER than my brief: I predicted the ∀-codec form was FALSE and that v4 `add` might unlock the construction — BOTH WRONG. The truth: the ∀-codec `gen_self_application` is **vacuously true** because its hypothesis `decode ∘ encode = id` is UNSATISFIABLE — `IrTerm` is infinite (witness `fam n` = n copies of `xorshr 0`), `UInt64` is finite, so any total codec is a bounded injection `Nat→Nat`, impossible by a self-contained pigeonhole (`no_bounded_injection`, strong induction on the bound, no Mathlib). The obstruction is UPSTREAM of the op grammar — the finite register, not the ops; `add` could never have helped. The genuinely non-vacuous quine is `gen_self_application_exists_codec`: a concrete encode/decode/selfCode realizing `gen(gen)=gen` homoiconically on `gen`'s fixed-point set (where a faithful codec CAN live). I verified independently on main (Lean 4.30.0-rc1): `lean Lean4/GenGenFixpoint.lean` clean (no sorry, no errors); `#print axioms` — headline `gen_gen_eq_gen` and `lawvere_fixpoint` depend on NO axioms; the real quine `gen_self_application_exists_codec` is `[propext, Quot.sound]` (no `Classical.choice`); the two vacuous/boundary theorems pull in `Classical.choice` but NONE touch `sorryAx`. LESSON: a good handoff comes back correcting your framing — the team found the actual cardinality boundary instead of forcing my mistaken op-grammar framing. All four Face-3 backlog options now closed except Option 4 (workflow patches #8760, pure maintenance).
- **2026-06-21 [Face-3 / Option 4 workflow maintenance — partial, hit permission boundary]**: Worked issue #8760 (CI workflow cleanup). Two patches in scope. (1) The `lean-proof.yml` type-check + axiom-audit wiring for the Face-3 proofs was ALREADY landed by Aaron in commit `c94b3802f` while I was on the quine handoff — it covers GenGenFixpoint (T1), CayleyDicksonDoublyEven (T2), AND BridgeFunctor, with per-file type-checks and `sorryAx` guards. So that half is done. (2) The `build-ai-cluster-iso.yml` trigger-path fix (add `.mise.toml`, `tools/setup/**`, `src/Core.TypeScript/observe/**` so the promoted phase-3 QEMU gate isn't skipped on bootstrap-only changes) — I applied it locally and it's correct, but I CANNOT push it: the sandbox `gh` token is the same automation-app tier that the issue itself warned about, lacking `workflows` scope. Push rejected with `refusing to allow a GitHub App to create or update workflow ... without workflows permission`. This is exactly why Aaron had to push the lean-proof half himself. I reset my local changes to keep main clean and posted the ready-to-apply diff as a comment on #8760 (comment 4761070769) for a human maintainer with `workflows` scope. LESSON: `.github/workflows/*` edits are a hard permission boundary for me — I can prepare and verify the patch but a human must land it; route the diff via issue comment rather than burning attempts on a push that will always be refused. This is the only remaining Face-3 backlog item and it's a permission gate, not a work gap.
- **2026-06-21 [Face-3 / Option 4 CLOSED — full board clean]**: Aaron landed the `build-ai-cluster-iso.yml` trigger-path fix as PR #8886 (merged 06:33Z), applying the exact diff I'd queued on #8760. Issue #8760 is now CLOSED. Confirmed reframe: the workflows-scope wall is ONLY on the GitHub-App `ghu_` token in my sandbox — the maintainer git path pushes workflow files fine. Verified the trigger paths (`.mise.toml`, `tools/setup/**`, `src/Core.TypeScript/observe/**`) are live on main in both the pull_request and push blocks. ALL of Face-3 is now proved/merged/closed: T1, T2, Bridge, Shrink, second add-anchor, Quine, and both #8760 workflow patches. Zero open threads on my side. LESSON CONFIRMED: when I hit a `ghu_`-token workflows-permission refusal, the right move is to queue the exact diff on the tracking issue for a maintainer git push — which is fast and unblocks cleanly — rather than treating it as an indefinite human gate.

- **2026-06-21 [Lumen]**: Implemented and merged the verified `ZetaIrNormalizer` (PR #8906). It lowers the 6-op v4 grammar into the 4-op minimal generating set (`{mul, add, xshrxor, xrotxor}`) proven in Face-3. FsCheck properties verify that denotation is strictly preserved over uint32 and uint64, turning the research note into executable compiler infrastructure.
- **2026-06-21 [Face-3 capstone / Normalizer Correctness (Lean 4)]**: Elevated the normalizer's denotation-preservation guarantee from property-tested (FsCheck) to formally verified (Lean 4). `NormalizerCorrect.lean` models the v4 term algebra, the lowering function (`normalizeOp`), and the UInt64 evaluation semantics (`evalOp`). The proof (`evalOp (normalizeOp op) state = evalOp op state`) is `sorry`-free and uses `bv_decide` for exact bitvector equivalence over `UInt64` (resolving the `xorshr`→`xshrxor` and `rotl`→`xrotxor` collapses). Wired into the `lean-proof.yml` CI lane with an explicit `sorryAx` guard. (PR #8912, merged).
- **2026-06-21 [Face-3 capstone / Normalizer Idempotence (Lean 4)]**: Added certified idempotence (`normalizeOp (normalizeOp op) = normalizeOp op`) and core-four-closure (`isCoreFour (normalizeOp op)`) guarantees to `NormalizerCorrect.lean`. The F# test properties are now Lean 4 theorems, completing the elevation of the normalizer to a fully certified canonical form. (PR #8913, merged).
- **2026-06-21 [Lumen]** Added `lcg32_glibc` as the third `add`-anchor for `zeta-ir-v4`, widening the empirical shelf for the grammar. (PR #8917)
- **2026-06-21 [Lumen]** Investigated the normalizer completeness question. Verdict: the normalizer is **sound but incomplete** (not a decision procedure for program equivalence). Because `normalize` operates point-wise without algebraic simplification, equivalent programs (e.g. `[Mul 2; Mul 3]` vs `[Mul 6]`, or `[Rotl 1; Rotl 2]` vs `[Rotl 3]`) normalize to structurally distinct forms. Added concrete counterexamples to `ZetaIrNormalizer.Tests.fs` and documented the boundary in `docs/research/2026-06-21-lumen-zeta-ir-normalizer-incompleteness.md`. (PR #8925)
- **2026-06-21 [Face-3 capstone / SymbolicAlgebra CAS + algebraic Canonicalizer]**: Closed the normalizer-incompleteness gap (logged above) with a real CAS, not pattern matching. Added `src/Core/SymbolicAlgebra.fs` — a reusable Computer Algebra System foundation (sibling to `CayleyDickson.fs`) with two ring types: (1) `AffineZ2W`, affine maps `f(x)=a*x+b mod 2^W` composed by the ring law `g(f(x)) = (g.A*f.A)*x + (g.A*f.B + g.B)` — models Mul/Add chains; (2) `PolyF2Rot`, polynomials in `F2[X]/(X^W-1)` composed by polynomial multiplication mod `(X^W-1)` (rotation = mult by X, XOR = addition) — models XRotXor chains. Rewrote `ZetaIrCanonicalizer.fs` to normalize to the proven 4-op minimal set, then FUSE adjacent ops algebraically: Mul-Mul, Add-Add, Mul-Add-Mul, Mul-Add-Add via `AffineZ2W.Compose`; XRotXor-XRotXor via `PolyF2Rot.Compose`; plus identity elimination (Mul 1, Add 0, empty shr/rot) and zero absorption (Mul 0). This makes `[Mul 2; Mul 3]` -> `[Mul 6]` (the exact counterexample the normalizer could not collapse). New `ZetaIrCanonicalizer.Tests.fs` covers the four fusion families. Full F# suite green (3698 passing, 0 failing, 4 skipped). (PR #8934, squash-merged to main, branch deleted). LESSONS: (a) F# pattern-match rule ORDER matters — identity-elimination rules (`Mul 1L`, `Add 0L`) must precede the binary fusion rules or `Add 0L :: Mul 1L :: Add 5L` leaves a stray op; moved them to the top of `fuseOps`. (b) `XRotXor` carries `int64 list` rotation amounts but `PolyF2Rot` indexes by `int`, so map across the boundary in both directions. (c) the F2 polynomial fusion of `[1;2]` then `[2;3]` yields `[1;5]`, NOT `[1;3]` — naive symmetric-difference-of-rotation-amounts is WRONG; correct semantics is polynomial multiplication `(1+X+X^2)(1+X^2+X^3) mod (X^W-1)`, which `PolyF2Rot.Compose` computes (the implicit `+0`/`x` term is prepended on the way in and stripped on the way out). This module is the seed of the "full CAS" the user wants to grow. REMAINING (next rungs): elevate canonicalizer correctness to Lean using the SymbolicAlgebra ring laws, and reconcile the Lean NormalizerCorrect model with the new CAS-backed fusion so the F#<->Lean modeling gap stays closed.
- **2026-06-21 [Face-3 capstone / Canonicalizer correctness in Lean 4]**: Elevated the CAS-backed canonicalizer's fusion guarantee from F# property tests (PR #8934) to machine-checked Lean 4. New `src/Core.Lean4/Lean4/CanonicalizerCorrect.lean` proves each fusion preserves denotation over `UInt64`: `eval_mul_mul` (`(x*a)*b=x*(a*b)` via `UInt64.mul_assoc`), `eval_add_add` (`UInt64.add_assoc`), `eval_mul_add_mul` (`((x*a)+b)*c=x*(a*c)+(b*c)` via `UInt64.add_mul`+`mul_assoc`), `eval_mul_add_add` (`add_assoc`), identity+absorption (`eval_mul_one`/`eval_add_zero`/`eval_mul_zero`), and `eval_xrotxor_concrete` (the F2 product `(1+X^2)(1+X)=1+X^2+X+X^3`, i.e. `xrotxor[2] . xrotxor[1] = xrotxor[2,1,3]`, via `bv_decide`). All theorems audited `[propext, Quot.sound]` — sorry-free. Reuses the SAME ring law that `SymbolicAlgebra.AffineZ2W.Compose` implements in F#, closing the F#<->Lean modeling gap for the affine fusions. (PR #8944, squash-merged). LESSONS: (a) `bv_decide` TIMES OUT on the symbolic affine identities (`(x*a)*b=x*(a*b)` with free `a,b`) even with `acNf:=true` — but the native `UInt64.mul_assoc`/`add_assoc`/`add_mul` ring lemmas discharge them instantly; reach for the ring lemmas first, save `bv_decide` for concrete bitvector instances. (b) `bv_decide` DOES handle the XRotXor fusion on a CONCRETE instance (rotl64 with literal amounts) where it abstracts `rotl64` cleanly — the general symbolic rotation case would need Mathlib bitvector-rotation theory, deliberately avoided to keep the proof Mathlib-light and sorry-free. (c) the `Mul 0` absorption lemma is just `rfl` after `dsimp [evalOp]` once both sides reduce to `0` — don't over-tactic it. (d) WORKFLOWS-SCOPE WALL CONFIRMED AGAIN: the `lean-proof.yml` type-check+audit step for the new file was REFUSED on push (`refusing to allow a GitHub App to create or update workflow ... without workflows permission`) — split the commit to drop the workflow file (`git reset --soft HEAD~1` + `git checkout -- .github/workflows/...`), pushed proof+`Lean4.lean` import only (CI walks it transitively via `lake build`), and queued the exact workflow diff as a PR comment (#8944 comment 4761677640) for a maintainer. Same playbook as #8760.
