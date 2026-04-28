# Quantum-sensing low-SNR detection — software-analogy boundaries

Scope: research and cross-review artifact ONLY; archived
for provenance. NOT operational policy. NOT a claim Zeta or
Aurora operationalise quantum-radar anything. Separates real
quantum-sensing literature from software analogy so the latter
can borrow carefully without contaminating the former.

Attribution: analogy-boundaries framing distilled from
Amara's 8th courier ferry
(`docs/aurora/2026-04-23-amara-physics-analogies-semantic-indexing-cutting-edge-gaps-8th-ferry.md`,
PR #274) §"Quantum radar and the physics-based material that
is missing"; primary-source citations (Lloyd 2008, Tan et al,
2023 Nature Physics, 2024 engineering review, standard radar
range equation) preserved from Amara's ferry. Otto-97
authored this extraction + the explicit boundary discipline.

Operational status: research-grade

Non-fusion disclaimer: agreement between Amara's
grounding of the quantum-radar subject and Otto's extraction
into this doc is NOT evidence of merged substrate. Both
reference the same primary physics literature; concordance
on what that literature says is baseline, not unity.

---

## Do not operationalize — stated as the first rule

**This document MUST NOT be cited as authorisation to
describe Zeta or Aurora as "quantum-powered," "quantum-
inspired truth sensing," "quantum-enabled anything." The
2024 engineering review Amara references (preserved in
`docs/aurora/2026-04-23-amara-physics-analogies-semantic-
indexing-cutting-edge-gaps-8th-ferry.md`) caps microwave
quantum-radar range at <1 km typical and argues practical
microwave QR is not competitive with classical radar for
conventional long-range aircraft detection. Any operational
claim beyond "we borrow a specific analogy from low-SNR
detection theory" is unsupported and would be scrubbed by
`docs/QUALITY.md` discipline if stated plainly.**

This rule is restated at the top because it is the only
line that matters for factory-external messaging. Internal
research use of the analogies is welcome and scoped below.

---

## What the real physics literature actually supports

### Quantum illumination (Lloyd 2008 + Tan et al.)

Seth Lloyd's 2008 *Science* paper introduced quantum
illumination: entangled signal-idler pairs detect objects
in very noisy and lossy settings, with the key theoretical
claim that the **sensing benefit can survive even when
entanglement itself does not survive to the detector**.
Tan et al. gave the canonical Gaussian-state result and
reported a **6 dB advantage in the error-probability
exponent** over an optimal coherent-state baseline.

That's the theoretically-supported part. It's about
**error-exponent** in a specific low-SNR detection
setting — not about "quantum radar works at long range."

### 2023 Nature Physics — experimental progress

A 2023 *Nature Physics* paper reported quantum advantage
in a microwave quantum-radar setting. This moves the
result beyond pure theory to a controlled experimental
demonstration. But "demonstration in a lab" is not the
same as "operational long-range radar."

### 2024 engineering review — the range cap

A 2024 engineering review on microwave quantum radar
argued:

- Maximum range for typical aircraft targets is
  intrinsically limited to **less than one kilometer**,
  often to **tens of meters**.
- Proposed microwave QR systems remain far below simpler
  classical radars for ordinary long-range use.

Even if one disputes the exact pessimism, the review
strongly supports a conservative conclusion:
**long-range microwave quantum radar is not currently
a clean "software truth detector" metaphor**. Any repo
documentation should avoid implying otherwise.

### Radar range equation — why the penalty is brutal

Standard radar physics for a point target:

```
P_r = (P_t · G_t · G_r · λ² · σ) / ((4π)³ · R_t² · R_r² · L)
```

Monostatic → return falls with **R⁻⁴**. Any metaphorical
story about miraculous long-range recovery has to fight a
very steep physical loss law. The analogy budget in
software has to respect this: correlation-beats-isolation
is an importable principle; "miraculous long-range recovery
of faint signal" is not something the physics supports.

### Quantum sensing is broader than quantum radar

Recent reviews show quantum sensing is more mature than
quantum radar specifically — magnetometers, NV-center
sensing, atomic clocks, resilient navigation all show
real-world progress. Quantum-enhanced radar remains more
speculative or niche. **The safer parent category for
software analogy is "low-SNR sensing and structured
detection," not "quantum radar" as such.** Amara makes this
point in the 8th ferry; this doc preserves it.

---

## What we may import — the 5 software analogies

Per Amara's ferry, with the import framed narrowly:

### 1. Low-SNR detection with a retained reference path

**Physics:** quantum illumination retains the idler
locally while the signal goes out into noise; scoring is
against the retained reference, not against raw noise.

**Software analogy:** retained witness or provenance
anchor used later to score weak evidence. Composes with
HC-2 retraction-native (witnesses persist) and citations-
as-first-class (typed provenance).

**Concrete shape for Zeta/Aurora:** a "retained-witness
correlation score" that measures how consistent a weak
claim is with known anchors, rather than treating the
claim in isolation. Prototype candidate for the
`alignment-observability` substrate.

### 2. Correlation beats isolated observation

**Physics:** radar and matched filtering don't trust a
single noisy return; they trust structured correlation
against a known reference.

**Software analogy:** retrieval against a typed corpus,
not conclusion from a single agreeing paraphrase.
Directly composes with SD-9 ("agreement is signal, not
proof") and DRIFT-TAXONOMY pattern 5 (truth-confirmation-
from-agreement).

**Concrete shape:** the semantic-canonicalization research
doc's kNN-over-typed-corpus retrieval is the software
version of matched filtering. Correlation against a corpus
of known-good / known-bad / superseded patterns is
stronger than single-source agreement.

### 3. Time-bandwidth product matters

**Physics:** evidence improves when you accumulate
structured observations across a well-defined window.

**Software analogy:** repeated, independent measurements,
not one overfit prompt. Composes with alignment-
observability's "diff-over-prose" discipline.

**Concrete shape:** score independent observations over
time. One strong signal from one source is weaker than
multiple moderate signals from independent sources over
a window. The "window" in the factory is a round or a
time-bounded PR review cycle.

### 4. Decoherence / loss matters

**Physics:** environmental interaction destroys useful
structure in quantum signals.

**Software analogy:** carrier overlap + repeated
paraphrase destroys independence weight. Directly
composes with SD-9's carrier-aware independence-
downgrade rule.

**Concrete shape:** in the provenance-aware bullshit
detector (8th-ferry candidate #3), the `γ·carrierOverlap`
term in `score(y|q)` is the software analogue of
decoherence penalty. Amara makes this mapping explicit
in the 8th ferry.

### 5. Radar cross-section is observability, not truth

**Physics:** a target being "visible" to a sensor is not
the same as the target being semantically established —
RCS is how well the sensor can pick the target out of
noise, not whether the target is what the sensor thinks
it is.

**Software analogy:** **salience is not evidence.**
A claim that is vivid, well-phrased, confident, or
widely-repeated (high "radar cross-section") is NOT
therefore true. Composes with DRIFT-TAXONOMY pattern 5
and pattern 2 (cross-system merging).

**Concrete shape:** weight-of-evidence scoring should
NOT reward surface vividness. The provenance-aware
detector's evidence term (`β·evidence`) needs to be
grounded in falsifiability + reproducibility, not
salience.

---

## What we must NOT imply

A list of claims Zeta / Aurora MUST NOT make citing this
doc:

1. **"Zeta uses quantum radar" or anything similar.** It
   doesn't. The analogies are metaphorical; the substrate
   is classical software.
2. **"Zeta's algebra is quantum-inspired."** The algebra
   is DBSP retraction-native Z-sets. Any "quantum"
   vocabulary is an analogy at the epistemic-layer, not a
   property of the substrate.
3. **"Quantum illumination enables Zeta to detect drift
   at long range / across substrates / with magical
   low-SNR recovery."** No. The 2024 engineering review
   caps microwave QR at <1 km; the analogy budget
   respects that.
4. **"Retained-witness correlation is mathematically
   equivalent to quantum illumination's Gaussian-state
   error-exponent bound."** It isn't. The software
   analogy is conceptual, not a formal reduction.
5. **"Decoherence-penalty scoring gives Zeta quantum-
   certified alignment robustness."** It doesn't. The
   γ·carrierOverlap term in `score(y|q)` is inspired
   by decoherence but is not quantum-mechanical.
6. **"Aurora is quantum-inspired safety infrastructure."**
   No. Aurora per the 5th ferry + `docs/aurora/README.md`
   is vision-layer architecture tying Zeta (semantic
   substrate) + KSK (control-plane safety kernel). None
   of that is quantum.

This NOT-list is first-class content of the doc. Future
references to this doc in other artifacts should honour
it.

---

## How the analogies compose with existing Zeta substrate

| Zeta substrate | Analogy composition |
|---|---|
| SD-9 (`docs/ALIGNMENT.md` PR #252) | Analogies #2 (correlation) + #4 (decoherence) + #5 (salience) directly operationalise SD-9's "agreement is signal not proof" + carrier-aware discipline. |
| DRIFT-TAXONOMY pattern 5 (`docs/DRIFT-TAXONOMY.md` PR #238) | Analogies #2 + #5 map to pattern 5 (truth-confirmation-from-agreement) detection. |
| DRIFT-TAXONOMY pattern 2 | Analogy #5 (cross-section-as-observability) maps to pattern 2 (cross-system-merging): vivid cross-substrate agreement ≠ truth. |
| citations-as-first-class (`docs/research/citations-as-first-class.md`) | Analogy #1 (retained-reference-path) = typed provenance retained as anchor for later scoring. |
| alignment-observability (`docs/research/alignment-observability.md`) | Analogy #3 (time-bandwidth) = independent-measurements-over-window discipline. |
| Oracle-scoring v0 (PR #266) | Band-valued classifier's G_provenance + G_falsifiability gates operationalise analogies #1 + #2 + #4. |
| BLAKE3 receipt hashing v0 (PR #268) | `approval_set_commitment` + `hash_version` binding = retained-reference-path shape at the receipt layer. |

No new mechanisms proposed. The analogies slot into
existing substrate as framing; they do not require new
code to be legible.

---

## Where the analogies could graduate to operational

Per AGENTS.md absorb discipline (Edit 1 research-grade-
staged-not-ratified, PR #248), any operational graduation
needs a separate promotion step. Candidates:

- **Retained-witness correlation metric** for
  alignment-observability — graduate from research-grade
  analogy to a measurable signal. Threshold gates land
  behind ADR per oracle-scoring v0 parameter-change
  discipline (PR #266).
- **Salience-vs-evidence diagnostic** for PR review —
  analogy #5 becomes an operational check in the
  Aminata / Codex adversarial-review-findings format.
  "Is this claim landing as a finding because it's
  evidenced or because it's vivid?"
- **Decoherence-inspired carrier-downgrade rule** in
  the provenance-aware bullshit detector — the
  γ·carrierOverlap term from Amara's math spine,
  implemented once the semantic-canonicalization research
  doc lands.

Each graduation would land as a separate ADR + operational
artifact + regression-test pairing. None happens in this
tick.

---

## What this doc does NOT do

- Does NOT propose implementation of any of the analogies.
  Implementation is downstream work; this doc is the
  analogy-boundary guard.
- Does NOT audit any existing Zeta claim against the
  analogy boundaries. An audit would be a separate research
  doc.
- Does NOT commit Zeta to tracking quantum-radar
  literature. The TECH-RADAR row added in PR #276 carries
  the Assess + Hold-note; this doc provides the narrative
  context; neither commits to ongoing quantum-literature
  review cadence.
- Does NOT license creative expansion of the analogy set.
  Five analogies (Amara's) are what's available; adding a
  sixth requires new literature evidence + separate
  research doc.
- Does NOT cite recent papers beyond what Amara already
  cited. Otto-97 did not re-verify the primary sources;
  preserves Amara's scoping discipline verbatim.

---

## Sibling context

- **8th-ferry absorb** (PR #274,
  `docs/aurora/2026-04-23-amara-physics-analogies-semantic-indexing-cutting-edge-gaps-8th-ferry.md`)
  — source of the analogy framing.
- **TECH-RADAR quantum illumination row** (PR #276)
  carries the Assess + Hold-note that this doc narrates.
- **Semantic-canonicalization research doc** (candidate
  #2, not yet landed) will be the technical spine where
  analogies #2 and #4 operationalise through semantic
  retrieval + carrier penalty.
- **Provenance-aware bullshit-detector research doc**
  (candidate #3, not yet landed) will be where the full
  `score(y|q)` formulation with γ·carrierOverlap lands,
  composing with analogy #4 (decoherence) directly.

Archive-header format self-applied — 14th aurora/research
doc in a row.

Otto-97 tick primary deliverable. Closes 8th-ferry
candidate #1 of 4 remaining (after TECH-RADAR batch
closed #5 Otto-96). Remaining: semantic-canonicalization
M (spine); bullshit-detector M; EVIDENCE-AND-AGREEMENT
future promotion (gated).
