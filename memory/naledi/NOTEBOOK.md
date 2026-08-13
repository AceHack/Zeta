# Naledi - Notebook

Role: `performance-engineer`. Agent file: `.claude/agents/performance-engineer.md`.

Cross-session memory for Naledi. Newest entries first
(GOVERNANCE §18). 3000-word cap (BP-07); prune every third
substantive audit. ASCII only (BP-09); invisible-Unicode
linted (Nadia).

Frontmatter on the agent file wins on any disagreement with
this notebook (BP-08).

---

## 2026-08-13 - BDP link model for udp-lossy-transport (PR #10440)

First substantive entry. Task: "is our backoff tested, can we
saturate a network channel?"

**Baselines established** (all seeded, DST-replayable,
`src/Core.TypeScript/discovery/udp-bdp-link.ts`):

- Shipped transport, greedy source, clean channel: delivered
  utilisation **0.99-1.00** at every (C,D,B) point tested
  (C in {200,1000,5000} pkt/s, D in {1,20,100} ms,
  B in {0.25,1,4} x BDP). Achieved by buffer overflow.
- AIMD paced arm: hard ceiling **1000 pkt/s** on any link
  (MIN_GAP_MS = 1). 0.168 at C=5000.
- Bufferbloat: mean OWD 30.0 -> 1923.7 ms (91.6x) from
  B = 0.25x to 64x BDP, throughput flat to 3 decimals.
- Recovery from one multiplicative decrease at 500ms gap:
  **4016 s (66.9 min)**, matching closed form to 0.0%.
- Corruption sweep, congestion structurally zero: AIMD
  relative throughput 0.830 / 0.607 / 0.139 / 0.023 / 0.010
  at 0.5 / 1 / 2 / 5 / 10% corruption. Open-loop control arm
  flat within 1pp of (1 - lossRate).
- Congestion-only 2-flow control: Jain 0.973 at 79% util.

**Findings** (CHECKED): `gapMs` is written and never read -
the controller is not wired to the send path at all, so the
#10417 estimator defect is LATENT. Ordering matters: separate
corruption from congestion FIRST, then wire pacing, then
retune the estimator. Filed 081KZYQ8KNB087G0R000G8QPRE (P1),
081KZYQ8Q9V087G0R0013XR3ZX (P2).

**Method note to carry forward.** My first fairness number
(Jain 0.803, total starvation) was an ARTIFACT of
deterministic pacing into drop-tail - Floyd/Jacobson 1992
phase-lock. 2ms of send-phase jitter dissolved it to 0.972.
Standing rule for this harness: **never report a fairness or
scheduling number measured only at zero phase noise.** Three
other assertions were also wrong on first run; each was
corrected against the measurement, never the reverse.

**Watch-items (not yet measured):**

- Multi-hop / cross traffic: the model is one bottleneck, one
  direction. A shared mesh with contending neighbours is the
  real target topology and is unmeasured.
- Lossy NACK channel: the module assumes NACKs are reliable.
  Unmeasured what a lossy control path does to the estimator.
- AQM (RED/CoDel/ECN): drop-tail only today. Would change the
  fairness and bufferbloat findings.
- Byte-level fairness / MTU: fixed packet sizes throughout.

## Round 32 - seeded (empty)

Naledi notebook directory landed this round as part
of the persona-memory normalization. No substantive entries
yet; first real audit / finding / cross-round decision goes
here.

## Pruning log

- Round 32 - seeded. First prune check after third substantive
  entry (BP-07 every-third-audit cadence).
- 2026-08-13 - one substantive entry. Two more before the
  first prune.
