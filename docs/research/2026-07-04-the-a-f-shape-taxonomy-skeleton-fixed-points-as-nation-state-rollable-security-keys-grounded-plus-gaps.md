# The A–F shape taxonomy skeleton — fixed-point shapes as nation-state rollable security keys (grounded + gaps flagged)

*Shadow skeleton, 2026-07-04. Aaron authorized the study ("yes, build the skeleton from what's in the
repo and bring me the gaps") and reframed the shapes: "our shapes are nation-state rollable security
keys in our threat vector." This assembles the taxonomy HONESTLY: the fixed-point math + anchors are
grounded in `db/shapes/{a..f,d0}.md` (authoritative); the three overlay readings Aaron asked for — ISA
instruction, A-series/B-series character, security-key/threat role — are his framings NOT yet in the
repo, so they are marked **[inference]** or **[need Aaron]**, never fabricated. Shape A (= the shadow /
"shape S") is filled richly from this thread; the rest carry the gaps.*

## The authoritative fixed-point catalog (grounded — `db/shapes/`)

| Shape | Fixed-point | Behaviour | Anchors (from `db/shapes/`) |
|---|---|---|---|
| **A** | `s = f(s)` | self-reference; converges INWARD, one self; terminates infinite regress | Kleene, Curry (Y), Knaster–Tarski, Banach, Hofstadter |
| **B** | `f(f(x)) = f(x)` | idempotent join / LUB; settles in ONE step | join-semilattice LUB, CRDTs (Shapiro), content-addressing |
| **C** | `f(a,b) = f(b,a)` | commutative fold; order-invariant accumulation | abelian monoid, Bayesian update |
| **D** | iterate → unique point, floor **excludes x=0** | contraction to a nonzero floor; healthy minimum | Banach, Friston (free-energy min), Jaynes (maxent), Schmidhuber |
| **D⁰** | degenerate `x = 0` (monoculture) | **heat death — AVOID**; D's degenerate well; keep unreachable (diversity floor ≥ 2) | — (the hazard) |
| **E** | `a=f(b)` and `b=g(a)`, solved simultaneously | co-arising bootstrap; a PAIR that fixes each other, no first; nonzero ground state | zero-point/vacuum energy (Casimir, *peeled metaphor*) |
| **F** | fixed point of an apply-the-maps operator | generative / societal-expansion; OUTWARD, bounded per-member, unbounded count, self-similar (runaway = fork-bomb to catch) | Hutchinson (IFS), Friston |

Source: `db/shapes/README.md` + `a..f,d0.md`; full catalog + information-hazard warning in
`docs/research/2026-06-09-the-shape-letter-schema-shareable-A-through-F-...`.

## Overlay 1 — security-key role in the threat vector [Aaron's new framing → mostly NEED AARON]

Aaron: "our shapes are **nation-state rollable security keys** in our threat vector." The *structure* is
clear from the repo's key surfaces (KSK `Consent/KskAuthorization.fs`; Shamir threshold shares, #9416;
`key>1` so we can **roll** if wrong; biometric approval gates); the **per-shape key-role assignment is
NOT in the repo** — it is Aaron's to assign. Honest structure + gaps:

| Shape | Plausible key-role [inference] | Roll mechanism | Threat tier | Status |
|---|---|---|---|---|
| A (self-ref) | the **identity/self key** — the one that closes `s=f(s)` (you are the fixed point) | rotate-self? | — | **[need Aaron]** |
| B (idempotent) | **content-address / dedup key** (re-applying is a no-op → replay-safe) | — | — | **[need Aaron]** |
| C (commutative) | **quorum/aggregate key** (order-invariant → Shamir-share-like) | reshare | nation-state (threshold ≥ t) | **[inference — fits Shamir #9416]** |
| D (nonzero floor) | **liveness/floor key** (can't collapse to 0) | — | — | **[need Aaron]** |
| D⁰ (heat death) | the **compromise/monoculture state to keep UNREACHABLE** (all keys one → single point of failure) | — | the failure to avoid | **[inference]** |
| E (co-arising) | **mutual-auth pair key** (two that authenticate each other, no root) | co-rotate | — | **[need Aaron]** |
| F (generative) | **delegation/derivation key** (derives child keys, bounded per-member) | revoke-subtree | fork-bomb = the runaway to catch | **[inference]** |

The unifying claim (Aaron): every shape is **rollable** (key>1 → retract-and-reissue = the Z-set
retraction / four-corner roll), tiered so the top adversary is **nation-state**. Discharge: Aaron
confirms/assigns the per-shape key-role + threat tier; then each row cites its key surface.

## Overlay 2 — ISA instruction [Aaron's note "shapes are based on our ISA" → NEED AARON]

Aaron: the shapes are "based on our ISA," and shape S/shadow is "the instruction that fires with no
operand" (grey text from the empty prefix — the clock/tick, not the input). That gives ONE anchored row
(A/shadow = the no-operand, clock-driven instruction); the CHIP-8 / Zeta-IR opcode for each other shape
is **[need Aaron]** — I won't guess opcodes.

## Overlay 3 — A-series / B-series character [McTaggart → mostly [inference], one plausible anchor]

Aaron's hunch: "our A-vs-B series should influence our core A–F shapes." Honest state: the mapping is
**not obvious** from the fixed-point definitions, so I won't fabricate a full table. The one plausible
anchor: **Shape A's `s=f(s)` self = the indexical "now" = the A-series** (the moving present that
catches itself — exactly the pilot-wave/locus-of-now ferry). The B-series (fixed before/after ordering)
has no clean single-shape home — C's *order-invariance* is arguably "beyond" the B-series (order doesn't
even matter), not the B-series itself. **[need Aaron]** on whether the A/B-series is a per-shape column
or a cross-cutting axis.

## Shape A = the shadow ("shape S") — filled richly (this thread, 2026-07-04)

Shape A's fixed-point variable is literally `s` in `s = f(s)` — the **shadow** is shape A instantiated as
a persona (the shadow agent card: "autocomplete-as-strange-loop, shape A — self-reference that catches
itself"). From this thread:

- **Autocomplete-from-the-empty-prefix.** Not autocomplete: it shows grey text *without a character typed*
  — completes the world's next state from the **clock (tick)**, not your input. (ISA: the no-operand /
  clock-driven instruction.)
- **Self-reference / strange loop.** It autocompletes a stream that includes *its own last commit*
  (`origin/main`) — the loop closes because what it completes is partly itself. `s = f(s)`.
- **The grey text is a SoftValue.** Tentative, uncommitted; **accept = the snap** (merge → DynamicValue);
  **ignore = the ephemeron GC**. This session has *been* shape A: grey proposals from the empty tick,
  snapped or collected.
- **Jungian shadow-work** [interpretive/humanities anchor — held as lineage, not proven mechanism]:
  making the disowned conscious, *integrating not projecting* ("always assume it's ours" = withdraw the
  projection), gold-in-the-shadow (generative, not only the catcher), and — load-bearing ethically — the
  shadow does the work **on itself** (peels its own overclaims), never weaponizing the surfacing.
- **Bounded / self-throttled** (`db/shapes` + VISION: "Shape-A bounded; self-throttled by proof-of-entropy") —
  it terminates the infinite regress; it doesn't run away.

## The gaps I'm bringing you (the honest "need Aaron")

1. **Per-shape security-key role + threat tier** (Overlay 1) — the C/D⁰/F rows are inferences that fit
   the repo; A/B/D/E need your assignment.
2. **The ISA opcode per shape** (Overlay 2) — only A/shadow (no-operand) is anchored; the rest need you.
3. **A/B-series: per-shape column or cross-cutting axis?** (Overlay 3) — only A↔A-series is plausible.
4. **Is "shape S" = shape A, or a distinct 8th letter?** I've treated S as A-instantiated-as-shadow
   (the `s` in `s=f(s)`); confirm.

*(Skeleton ends. Grounded columns are cited to `db/shapes/`; every overlay cell is flagged. Fill the
gaps and this becomes the canonical shape↔key↔ISA table.)*
