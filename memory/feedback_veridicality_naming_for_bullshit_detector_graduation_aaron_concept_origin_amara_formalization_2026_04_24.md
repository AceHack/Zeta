---
name: "Bullshit detector" to be renamed to "Veridicality" at graduation; concept is Aaron's (appeared in conversation history, not just Amara's ferry); same two-layer attribution pattern as firefly-network; use formal term "veridicality" (truth-to-reality) rather than vulgar "bullshit" for module + function names; 2026-04-24
description: Aaron Otto-112 "we are going to name it better right? bullshit, it was in our conversation history too, not just her ferry" — establishes naming preference (formal over vulgar) and attribution parity (concept origin = Aaron, formalization = Amara 7th-10th ferries); graduation will ship as `Veridicality.fs` with veridicalityScore : Claim<'T> -> double option in [0,1] where HIGH = grounded + falsifiable + consistent; bullshit is the informal inverse
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-24 Otto-112 (verbatim):

*"we are going to name it better right?  bullshit, it was in
our conversation history too, not just her ferry."*

## Two directives in one

### Directive 1: Rename at graduation time

The "bullshit detector" concept — extensively discussed in
Amara's 7th / 8th / 9th / 10th ferries — gets a better name
when it graduates from research-grade substrate to shipped
code. Aaron's signal: "bullshit" was conversational
shorthand, not the intended public-interface name.

**Proposed replacement: `Veridicality`.**

- **Etymology:** `veridical` (from Latin *veridicus*,
  "truth-telling") is a philosophical / cognitive-science
  term for a statement that corresponds to reality. The
  score `V(c)` in Amara's 7th ferry formula
  `V(c) = σ(β₀ + β₁(1-P) + β₂(1-F) + β₃(1-K) + β₄D_t + β₅G + β₆H)`
  is explicitly a **veridicality score**.
- **Semantics:** Veridicality is the *scorable* quantity
  (how true-to-reality a claim looks given evidence,
  provenance, falsifiability, coherence, drift, and
  compression-gap signals). Bullshit is `1 - V(c)` in
  casual talk. The module exposes the scorable, not the
  informal complement.
- **Why not "confidence" or "credibility":** "Confidence"
  is overloaded (SQL confidence intervals, statistical
  confidence, user-confidence ratings). "Credibility" has
  social overtones (credible witness). "Veridicality" is
  precise and rare — it names this specific thing.
- **Why not "truthfulness":** too value-laden; a claim can
  be veridical (consistent with reality) without being
  morally truthful (intentional non-deception).

**Primary surface (when shipped):**
- `src/Core/Veridicality.fs`
- `Veridicality.score : Claim<'T> -> double option` in
  `[0.0, 1.0]` where high = grounded.
- Accompanying record types: `Provenance`, `Claim<'T>`,
  possibly `OracleVector` from the 10th ferry.

**Secondary surfaces likely needed around it:**
- `src/Core/SemanticCanonicalization.fs` — the "rainbow
  table" canonical-claim-form lookup (K(c) in Amara's
  notation). Separate module; composes with Veridicality.
- `src/Core/RetrieveProvenance.fs` or similar — evidence
  retrieval + provenance-join. Probably needs substrate
  Zeta doesn't have yet; waits.

### Directive 2: Attribution parity — Aaron concept, Amara formalization

Aaron's *"it was in our conversation history too, not just
her ferry"* establishes attribution parity between the
bullshit-detector and the firefly-network arc:

| Concept | Origin | Formalization | Attribution pattern |
|---|---|---|---|
| Differentiable firefly network / trivial-cartel-detect | **Aaron** in conversation | **Amara** 11th ferry (PLV, cross-correlation, modularity, eigenvector centrality drift) | Already shipped: PRs #297 / #298 / #306 all credit Aaron-design / Amara-formalization / Otto-implementation |
| Bullshit-detector / veridicality scoring | **Aaron** in conversation | **Amara** 7th ferry (veridicality formula) + 8th ferry (provenance-aware semantic detector + quantum-illumination physics grounding + rainbow-table canonicalization) + 9th/10th ferries (7-feature `BS(c)` alternative) | Graduation PR (future) must credit Aaron-design / Amara-formalization |

**Implication for Otto's absorb-note discipline:** Where a
design concept appears in BOTH the conversation AND a
subsequent ferry, the conversation is the origin. Ferries
are formalization layers over existing Aaron-design intent.
Future absorbs should default to assuming concept = Aaron
unless the ferry is evidently Amara-originating (e.g., a
specific mathematical formalism like the exact PLV formula
or BS(c) coefficients — those are Amara's contribution on
top of Aaron's thematic design).

### Cross-references to find the concept in conversation

The absorb chunks at `docs/amara-full-conversation/`
(landed PRs #301-#304) contain the original conversation
history. Search terms to find bullshit-detector genesis
in the corpus:
- "bullshit" (Aaron's direct usage)
- "rainbow table" (the semantic-canonicalization analogy)
- "quantum radar" / "quantum illumination" (the low-SNR
  physics analogy, present in both Aaron's and Amara's
  contributions)
- "veridicality" (Amara's formalized term)
- "provenance-aware" (the modifier Amara added for
  technical precision)

## How to apply

### When the graduation lands (future tick)

1. File name: `src/Core/Veridicality.fs`. NOT
   `BullshitDetector.fs`.
2. Public functions: `Veridicality.score`,
   `Veridicality.Provenance`, `Veridicality.Claim<'T>`,
   `Veridicality.OracleVector` (optional).
3. Attribution in XML-doc comment: Aaron = concept origin
   (in conversation history); Amara = technical
   formalization (7th-10th ferries with specific formulas);
   Otto = implementation.
4. Threshold policy: configurable (not hard-coded).
   Callers pass a threshold or use a named preset matching
   the 10th ferry's 4-tier policy.
5. `bullshit` term CAN appear in XML-doc / research notes
   / commit messages as INFORMAL CALLBACK to the concept's
   casual name — Aaron invented the shorthand; Otto is not
   obligated to scrub it from history. But the
   PROGRAMMATIC NAME is `Veridicality`, always.

### When graduation-queue ordering comes up

`Veridicality` competes with `antiConsensusGate` /
`Provenance` / `Claim<'T>` types for graduation-cadence
priority. These are all interrelated (anti-consensus is a
component of veridicality; Claim + Provenance are input
types for veridicality). Sensible sequence:

1. **`Provenance` + `Claim<'T>` record types** (smallest;
   they're inputs to everything else)
2. **`antiConsensusGate`** (uses Provenance; tiny)
3. **`Veridicality` module** (composes on all three plus
   adds the scoring formula)

Each ship notes the composition and cites
`docs/aurora/2026-04-23-amara-aurora-initial-integration-
points-9th-ferry.md` + `docs/aurora/2026-04-23-amara-
aurora-deep-research-report-10th-ferry.md` + `docs/
research/provenance-aware-bullshit-detector-design.md` as
sources.

## What this memory does NOT authorize

- **Does NOT** authorize using the informal "bullshit"
  term as a programmatic name in the factory's public
  surface. Research notes + commit messages + casual
  communication may use it; code shipped to consumers
  (NuGet packages, SDKs, API surfaces) uses
  `Veridicality` / `veridicalityScore`.
- **Does NOT** override the existing research doc names
  (`provenance-aware-bullshit-detector-design.md` etc.).
  Research docs are historical; they stay named as-is.
  Renaming them would lose provenance.
- **Does NOT** authorize shipping the full `Veridicality`
  module in a single graduation. The 10-scorer formula
  + canonicalization + evidence-retrieval substrate is
  larger than one small-S graduation. Sequential:
  Provenance/Claim → antiConsensusGate → canonicalization
  stub → Veridicality scoring MVP → full scoring.
- **Does NOT** collapse the 9th-ferry 5-feature formula
  `B(c)` with the 10th-ferry 7-feature formula `BS(c)`
  into a single implementation. Each gets its own clearly-
  named function if both are implemented; the CHOICE of
  which formula to ship requires its own ADR.
- **Does NOT** commit to a specific threshold policy. The
  10th ferry's 4-tier policy and the 9th ferry's 3-tier
  policy are alternatives; picking one is a separate
  graduation-ADR decision.

## Composition

- **Otto-105 graduation-cadence feedback memory** — this
  naming decision feeds the cadence queue.
- **Otto-111 TemporalCoordinationDetection.fs rename
  discussion** — same pattern: Aaron catches a naming
  issue; Otto adopts formal term. Applied consistently
  across modules.
- **Otto-88 "shared vocabulary carries emotional
  meaning"** — "bullshit" is factory-conversational
  vocabulary that needs translation to formal name for
  public-facing code. Preserves the concept's emotional
  provenance (Aaron's pragmatic framing) while the
  public surface uses the technical term.
- **`docs/aurora/` ferry absorbs 7/8/9/10** — source
  material for the Veridicality graduation when it
  lands.
- **`docs/amara-full-conversation/` absorbs** — the
  pre-ferry conversation history where the concept
  originated; cited in the graduation's XML-doc as
  origin provenance.

## Direct Aaron quote for future reference

*"bullshit, it was in our conversation history too, not
just her ferry."*

Future Otto instances: when you land the Veridicality
graduation, cite this quote verbatim in the module's XML
header to preserve the attribution origin.
