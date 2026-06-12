---
id: B-0026.6
zetaid: 081KR50HA0008QG0R000MRSMAB
priority: P2
status: open
title: "B-0026.6 — Helen Keller minimum-channel hypothesis: dual-purpose grounding + assistive-tech research"
created: 2026-05-09
last_updated: 2026-05-09
parent: B-0026
depends_on: []
classification: research-now
type: research
effort: S

---

# B-0026.6 — Helen Keller minimum-channel hypothesis

**Slice of:** [B-0026](B-0026-embodiment-grounding-analysis-isaac-sim-and-other-robotics-sim-platforms-otto-340-counter.md)  
**Parallel to:** B-0026.1 (no dependency; both can run simultaneously)

## What

Produce `docs/research/B-0026.6-minimum-channel-grounding-hypothesis.md` that formalizes the
Helen Keller minimum-channel argument from B-0026 into a structured hypothesis with:

1. **The empirical baseline:** Helen Keller (1880–1968) — deaf-blind from ~19 months, grounded language
   fully through touch + taste + smell + proprioception alone. Full linguistic competence demonstrated
   (multiple books, lectures, political advocacy). This is the empirical existence proof.

2. **The minimum-channel hypothesis formalized:**
   - H1: For humans, a single non-linguistic channel (touch) is sufficient for full linguistic grounding.
   - H2: Therefore, the channels needed for AI grounding may be well below the full-human-sensory baseline.
   - H3: Even ONE causal sensorimotor channel (e.g., proprioception via MuJoCo) may provide meaningful
     non-linguistic grounding for an LLM-agent.
   - H4: The research question becomes empirical: "which channel carries the most load?" rather than
     "does full embodiment matter?"

3. **Platform implications:** MuJoCo provides proprioception + contact forces (H3-testable). Isaac Sim
   adds vision. ManiSkill adds manipulation. The minimum-channel hypothesis says: start with one channel
   (MuJoCo proprioception), not the richest possible suite.

4. **Dual-purpose assistive-tech framing (Aaron 2026-04-25):**
   - AI embodiment research and assistive-tech for sensory-impaired humans converge on the same question.
   - Cross-modal mapping, sensory substitution, tactile-only language grounding — all shared research.
   - Concrete dual-purpose opportunities: tactile-only grounding tests, single-modality stress-tests,
     cross-modal mapping for BrainPort-style substitution devices.

5. **Otto-340 sharpener:** Otto-340's claim may be "AI lacks even the minimum touch-channel Helen Keller
   had" — a narrower and more falsifiable version than "AI lacks the full human sensory suite." This
   sharpening lowers the bar for a meaningful counter-experiment.

## Why this is a separate child (parallel, not merged into B-0026.1)

B-0026.1 focuses on the tool-use-vs-trained-embodiment distinction for platform/architecture decisions.
B-0026.6 focuses on the minimum-channel hypothesis which informs experiment *scope* (one channel is
enough to test) and has independent value as dual-purpose assistive-tech research. The two parallel
tracks compound: B-0026.1 answers "how" to ground; B-0026.6 answers "how much grounding is needed."

## Acceptance criteria

1. Research doc committed to `docs/research/B-0026.6-minimum-channel-grounding-hypothesis.md`.
2. H1–H4 hypothesis stated formally with citations (search-first for Helen Keller neuroscience,
   tactile-only grounding, sensory substitution literature).
3. Implications for B-0026.3 spike design noted (which single channel to test first).
4. Assistive-tech dual-purpose opportunities enumerated with at least 3 concrete research directions.
5. `dotnet build -c Release`: 0 warnings, 0 errors (doc-only).
6. PR body: one-sentence H3 summary + build result.

## Out of scope

- Implementing sensory-substitution devices (separate long-horizon project).
- Clinical trial design (beyond scope of current research track).
- Full neuroscience review (cite key papers; don't reproduce them).
