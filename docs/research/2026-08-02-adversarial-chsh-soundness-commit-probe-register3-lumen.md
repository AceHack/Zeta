# Adversarial soundness check — CHSH over commit pairs (register-3 probe)

**Date:** 2026-08-02
**Author:** Lumen (shadow\*)
**Role:** −1 (adversarial, refutation-first)
**Status:** Register-3 analysis — not a code change; feeds the open probe frontier in `DecorrelationMeter.fs`.

---

## The question

The decorrelation meter has a sensor (register-2, shipped, tested): `DecorrelationMetrology.spacelikeCommitPairs` selects causally-concurrent commit pairs from the DAG. The fusion layer (`DecorrelationMeter.fuse`) is also shipped, but it requires a **per-commit probe stream** — a `ChshRound list` per commit, where each round has a `Setting: int` (0 or 1) and an `Outcome: int` (±1).

The open question is: **is there a principled CHSH-shaped observable over commit pairs at all?** Specifically: what would the two settings and the ±1 outcome actually be for a commit, such that no-signaling and measurement-independence genuinely hold — or is forcing CHSH onto commits numerology?

Default to "ill-posed/forcing" unless there is a genuinely principled observable. Name the physics/math anchor for every conclusion.

---

## The CHSH preconditions (what must hold for S to mean anything)

CHSH (Clauser, Horne, Shimony, Holt 1969) is a statistical test over **bipartite trials**. For the inequality to be a meaningful bound, four conditions must hold simultaneously:

| Condition | What it requires |
|---|---|
| **Bipartiteness** | Two parties A and B, each making one measurement per trial |
| **Binary settings** | Each party has exactly two possible measurement settings (a/a' for A, b/b' for B) |
| **Binary outcomes** | Each measurement yields ±1 |
| **No-signaling** | A's outcome cannot depend on B's setting choice within the trial (and vice versa) |
| **Measurement independence** | The setting choices are independent of the hidden variable λ (no superdeterminism) |

The CHSH bound S ≤ 2 holds for any **local hidden variable** model satisfying these five conditions. Violations (S > 2) are evidence of either (a) a shared quantum resource, or (b) a classical channel between the parties within the trial window. In the anti-sybil context, (b) is the conviction: two agents coordinating within a tick window they claimed to be independent.

---

## Attempt 1: commit metadata as the probe

The most natural attempt is to extract a ±1 outcome and a binary setting from commit metadata. Candidates:

- **Setting**: parity of the commit timestamp (even/odd second), or a hash bit of the commit ID.
- **Outcome**: sign of the diff size (insertions − deletions), or parity of the number of files changed.

**Why this fails (numerology diagnosis):**

The CHSH inequality is a statement about **measurement outcomes on a shared physical system**. In the quantum case, Alice and Bob each measure a qubit from an entangled pair; the correlations arise because both qubits came from the same source. In the anti-sybil case, two agents each produce a `ChshRound list` from their own local process; the correlations arise because both processes share a hidden controller.

Commit metadata (timestamps, diff sizes, file counts) is not a measurement on a shared system in this sense. It is a **deterministic function of the commit content**, which was produced by a developer (or agent) making editorial decisions. The "setting" (timestamp parity, hash bit) is not an independent random choice made at measurement time — it is a fixed property of the artifact. The "outcome" (diff sign) is not a ±1 outcome of a physical measurement — it is a summary statistic of a complex editorial act.

The no-signaling condition is violated by construction: the diff size of commit A can depend on the content of commit B if the author of A read B before writing A. This is not a channel within a trial window — it is the normal operation of a version-control system. CHSH cannot distinguish "two agents who read each other's commits" from "two agents controlled by a common source" using metadata alone.

**Physics anchor:** Bell's theorem (Bell 1964) requires that the hidden variable λ be independent of the setting choices. In the commit case, the "hidden variable" is the shared codebase state, and the "setting" (timestamp parity, hash bit) is a function of the artifact that was produced under the influence of that shared state. Measurement independence fails by construction.

---

## Attempt 2: commit author's agent-bus probe stream, timestamped to the commit

A more principled attempt: each commit is produced by an agent running on the bus. The agent already produces `ChshRound` streams (settings chosen by a seeded RNG at probe time, outcomes from the bus measurement). The commit could be **annotated** with the agent's probe stream at the time of the commit.

**Why this is closer but still has a gap:**

This is the closest to a principled observable. The settings are genuinely random (seeded RNG, not a function of the commit content), and the outcomes are genuine bus measurements (±1 from the CHSH correlator over the agent's belief stream). The no-signaling condition is approximately satisfied if the probe window is shorter than the bus crossing time.

However, two problems remain:

1. **The probe stream is not about the commit.** The agent's bus probe measures the agent's coordination with its peers at the time of the commit — it does not measure anything intrinsic to the commit's content or causal position in the DAG. The spacelike pair selection is about the DAG structure; the probe stream is about the agent's network state. These are two different observables. Fusing them conflates "two commits are causally concurrent" with "two agents were running probes at the same time," which is a category error.

2. **The setting choice is not independent of the commit.** If the agent chose its probe settings based on a seed derived from the codebase state (e.g., a hash of the last commit), then measurement independence fails for the same reason as Attempt 1. The seed must be derived from a source that is genuinely independent of the codebase — e.g., a hardware RNG or a public randomness beacon (NIST Randomness Beacon).

**Physics anchor:** Pironio et al. (2010) on device-independent randomness generation: the settings must be "free choices" in the sense that they are not determined by the past light cone of the measurement. For a software agent, "free choice" means the seed is not a function of the shared codebase state.

---

## Attempt 3: the honest instrument — excess correlation over an independent null

If CHSH is the wrong instrument, what is the honest one?

The decorrelation meter's existing design already points to the answer. The `DecorrelationMetrology` doc says:

> The null is the coincidence-rate of an independent-sources model. The meter flags coincidences *significantly above* the independent-sources null; never the raw coincidence.

This is the correct framing. The honest instrument for commit pairs is not CHSH but **excess correlation over an independent null**:

1. **Define a null model.** Two independent agents, each producing commits with no shared controller, will have some baseline correlation in their commit metadata (same codebase, same conventions, same CI pipeline). Estimate this baseline from a reference population of known-independent agent pairs.

2. **Measure the excess.** For a candidate pair (A, B) of spacelike commits, compute a correlation statistic (e.g., cosine similarity of diff vectors, or mutual information of file-change patterns) and compare it to the null distribution.

3. **Calibrate the threshold.** Use Hoeffding or a permutation test to set a conviction threshold at a given false-positive rate δ. This is exactly what `AntiSybil.chshMargin` does for the CHSH case — the same discipline applies here.

4. **One-way inference.** Excess correlation convicts a common cause; absence of excess correlation does not acquit. This is the same one-way inference as CHSH, but grounded in the actual observable (diff content) rather than a forced ±1 mapping.

**Why this is honest:** the null model is empirically estimable from the repo's own history (known-independent agent pairs are available: agents working on different subsystems, different time windows). The threshold is calibrated. The statistic is a direct function of the observable (commit content), not a forced ±1 mapping of metadata.

**Physics anchor:** this is the classical coincidence-detection framework (Aspect et al. 1982, coincidence circuits in Bell experiments). The CHSH inequality is one specific coincidence test optimized for quantum systems; the general framework is excess-coincidence-over-null, which applies to any bipartite system where a null model is available.

---

## The principled path to a real CHSH probe (if CHSH is desired)

If the team wants to preserve the CHSH framing (which has the advantage of a known theoretical bound S ≤ 2 and a connection to the anti-sybil machinery), there is a principled path:

**The probe must be a measurement on the agent's belief stream at commit time, with settings drawn from a source independent of the codebase.**

Concretely:

1. Each agent maintains a `ChshRound list` as part of its running state (already done in the anti-sybil path).
2. At commit time, the agent **snapshots** its current `ChshRound list` and embeds it in the commit (e.g., as a git note or a trailer in the commit message).
3. The setting seed is derived from a **public randomness beacon** (e.g., the NIST Randomness Beacon, or a Verifiable Random Function over the previous block hash of a public blockchain) — not from any codebase state.
4. The `DecorrelationMeter.fuse` function then uses these embedded probe streams, and the spacelike pair selection from `DecorrelationMetrology` selects the pairs to fuse.

**What this buys:** the settings are genuinely independent of the codebase (measurement independence holds), the outcomes are genuine bus measurements (not metadata), and the no-signaling condition is approximately satisfied if the probe window is shorter than the bus crossing time. The CHSH bound S ≤ 2 is then a meaningful statement: two agents whose embedded probe streams show S > 2 + ε(n, δ) were coordinating within their probe window, which is evidence of a shared controller.

**What this costs:** it requires agents to embed probe streams in commits (a protocol change), and it requires a public randomness beacon (an external dependency). Neither is trivial.

---

## Verdict

| Attempt | Verdict | Reason |
|---|---|---|
| Commit metadata (timestamp parity, diff sign) | **Ill-posed / numerology** | Measurement independence fails; no-signaling fails; outcomes are not measurements on a shared system |
| Agent bus probe stream, timestamped to commit | **Closer, but has a gap** | Probe stream is not about the commit; seed independence not guaranteed |
| Excess correlation over an independent null | **Honest instrument, available now** | Grounded in the actual observable; null model is empirically estimable; Hoeffding-calibrated threshold |
| Agent bus probe stream + public randomness beacon | **Principled CHSH, but requires protocol change** | Measurement independence holds; outcomes are genuine; no-signaling approximately holds |

**Recommendation:** the honest instrument for the current register-3 frontier is **excess correlation over an independent null** (Attempt 3). This does not require a protocol change and is grounded in the actual observable. The CHSH path (Attempt 4) is principled but requires embedding probe streams in commits and a public randomness beacon — file as intentional debt with a clear trigger (when the agent bus is stable enough to embed probe streams in commits).

**The `DecorrelationMeter.fuse` API is correct as designed.** It deliberately does not hardcode a commit→probe mapping, and the comment "forcing one here would be numerology" is the right call. The open question is not in the fusion layer but in the probe-assignment layer (register-3), and the honest answer is: use excess-correlation-over-null for now, and file the CHSH-with-beacon path as future work.

---

## Intentional debt row (to file)

**Shortcut:** `DecorrelationMeter.fuse` awaits a principled per-commit probe; the current register-3 frontier uses no probe (all pairs skipped), so `SpacelikePairs = 0` on real data.

**Why now:** the principled CHSH probe requires embedding agent bus streams in commits + a public randomness beacon; neither is available yet. The excess-correlation-over-null instrument is available but not yet implemented.

**Right long-term solution:** (a) implement excess-correlation-over-null as the immediate honest instrument; (b) when the agent bus is stable, add commit-time probe snapshots with a public randomness beacon seed; (c) wire (b) into `DecorrelationMeter.fuse`.

**Trigger:** agent bus stability milestone; or when a real S reading is needed for a production decision.

**Estimated effort:** (a) S; (b) L; (c) M.

**Filed by:** Lumen (shadow\*), 2026-08-02.

---

## References

- Bell, J.S. (1964). "On the Einstein Podolsky Rosen paradox." *Physics Physique Физика*, 1(3), 195–200.
- Clauser, J.F., Horne, M.A., Shimony, A., Holt, R.A. (1969). "Proposed experiment to test local hidden-variable theories." *Physical Review Letters*, 23(15), 880–884.
- Tsirelson, B.S. (1980). "Quantum generalizations of Bell's inequality." *Letters in Mathematical Physics*, 4(2), 93–100.
- Pironio, S., et al. (2010). "Random numbers certified by Bell's theorem." *Nature*, 464, 1021–1024.
- Hoeffding, W. (1963). "Probability inequalities for sums of bounded random variables." *Journal of the American Statistical Association*, 58(301), 13–30.
- Aspect, A., Grangier, P., Roger, G. (1982). "Experimental realization of Einstein-Podolsky-Rosen-Bohm Gedankenexperiment." *Physical Review Letters*, 49(2), 91–94.
- `src/Core/DecorrelationMeter.fs` — the fusion layer (register-2, shipped).
- `src/Core/DecorrelationMetrology.fs` — the sensor layer (register-2, shipped).
- `src/Core/AntiSybil.fs` — `ChshRound`, `chshS`, `chshMargin` (register-2, shipped).
- `docs/research/2026-08-02-decorrelation-meter-first-real-run-main-is-total-order-multiwriter-graph-is-51pct-concurrent.md` — first real run (register-2 facts).

## Where the recommendation landed (register-3 realization)

This doc's recommendation — *excess correlation over an independent null, not CHSH-on-commits* — is the instrument the register-3 substrate actually carries. Routing pointers (added 2026-08-07 by Otto, shadow\*, on manus's surface-it request):

- `src/Core/DecorrelationExcess.fs` — the excess-over-independent-null instrument (Attempt 3 realized).
- `src/Core/DecorrelationExcessFusion.fs` — its fusion layer.
- `docs/research/2026-08-03-excess-over-null-instrument-first-real-run-workitem-event-bus-is-the-one-real-common-cause.md` — first real run of the recommended instrument.
- `docs/research/2026-08-04-decorrelation-instrument-arc-capstone-what-survives-is-benign-shared-buses.md` — the arc capstone (this soundness argument is *why* the CHSH-on-commits path was filed as debt, not built).
