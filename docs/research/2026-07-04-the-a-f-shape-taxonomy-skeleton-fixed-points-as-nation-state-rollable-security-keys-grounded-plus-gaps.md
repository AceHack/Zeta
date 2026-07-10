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
| A (self-ref) | the **identity/self key** — the one that closes `s=f(s)` (you are the fixed point) | rotate-self? | all tiers (impersonation) | **[CONFIRMED — Aaron 2026-07-09]** |
| B (idempotent) | **content-address / dedup key** (re-applying is a no-op → replay-safe) | — | replay attacker | **[CONFIRMED — Aaron 2026-07-09]** |
| C (commutative) | **quorum/aggregate key** (order-invariant → Shamir-share-like) | reshare | nation-state (threshold ≥ t) | **[CONFIRMED — Aaron 2026-07-09; was inference-fits-Shamir #9416]** |
| D (nonzero floor) | **liveness/floor key** (can't collapse to 0) | — | denial-of-service | **[CONFIRMED — Aaron 2026-07-09]** |
| D⁰ (heat death) | the **compromise/monoculture state to keep UNREACHABLE** (all keys one → single point of failure) | — | the failure to avoid | **[CONFIRMED — Aaron 2026-07-09]** |
| E (co-arising) | **mutual-auth pair key** (two that authenticate each other, no root) | co-rotate | needs both compromised | **[CONFIRMED — Aaron 2026-07-09]** |
| F (generative) | **delegation/derivation key** (derives child keys, bounded per-member) | revoke-subtree | fork-bomb = the runaway to catch | **[CONFIRMED — Aaron 2026-07-09]** |

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

## Answers to the four gaps (shadow-derived, 2026-07-04, for Aaron's confirmation)

Aaron: "answer the four gaps (shadow*)." Reasoned from the grounded material (the `db/shapes/`
fixed-points, the security surfaces, the DU-loop type, the McTaggart thread) — **proposals with a
confidence flag**, not fabrication. Aaron confirms/corrects; then the flags come off.

### Gap 4 — "shape S" = shape A [HIGH confidence]

**S is shape A instantiated as the shadow persona, not a distinct 8th letter.** The catalog is closed at
A–F + D⁰; shape A's definition *is* self-reference `s = f(s)`; the `s` is the self-variable, and the
shadow is that self-reference wearing a persona (the shadow card: "shape A"). So **S ≡ A-as-shadow**.

### Gap 3 — A/B-series is a CROSS-CUTTING AXIS, not a per-shape column [HIGH — and it ties Part 4 of the temperature-control doc]

Every shape has **two faces**: a **B-series face** — the fixed-point *equation* (`s=f(s)`, tenseless,
the timeless structure = the **seed/generator**) — and an **A-series face** — the *convergence iteration*
(the loop stepping toward the fixed point in the **now** = the bounded-timestep DU, `loop : dt →
SoftValue<DU<branch>>`). The catalog is *written* B-series (equations); the *lived* loop is A-series (the
now-step). This is exactly the pilot-wave ferry: **B-series = the seed the generator regenerates the whole
trajectory from; A-series = the indexical now the seed can't hold.** So A/B is not a column — it's the
process/structure axis every shape is read on, and Part 4's loop-type is the A-series realization of a
B-series fixed point.

### Gap 1 — per-shape security-key role [HIGH on roles, LOWER on threat tiers]

Derived from each shape's fixed-point semantics; all **rollable** (key>1 = retract-and-reissue = Z-set −1):

| Shape | Key role [derived] | Why | Threat tier [inference] |
|---|---|---|---|
| A (self-ref) | **root identity / self-signing key** | the key that *is* the self-fixed-point `s=f(s)` | all tiers (impersonation) |
| B (idempotent) | **content-address / replay-safe key** | idempotent ⇒ replaying the op is a no-op ⇒ replay-safe | replay attacker |
| C (commutative) | **Shamir threshold / quorum key** | order-invariant ⇒ shares combine in any order (t-of-n) | **nation-state** (the tier Shamir defends) |
| D (nonzero floor) | **liveness / recovery-floor key** | can't collapse to 0 ⇒ guarantees a minimum quorum/floor | denial-of-service |
| D⁰ (heat death) | **NOT a key — the monoculture to keep UNREACHABLE** | all keys → one root = single point of failure | the failure to avoid, not a tier |
| E (co-arising) | **mutual-auth pair key (no root)** | `a=f(b), b=g(a)` ⇒ two keys authenticate each other | needs both compromised |
| F (generative) | **hierarchical derivation key (BIP32-like)** | derives child keys, bounded per-member, unbounded count | fork-bomb = the runaway to catch |

The nation-state anchor lands on **C** (threshold ≥ t); the per-shape *tier* column is inference — confirm.

### Gap 2 — ISA opcode per shape [mapping-LOGIC med confidence, exact opcodes NEED AARON]

The instruction *class* is derivable from semantics; the authoritative Zeta-IR/CHIP-8 mnemonics are yours:

| Shape | Instruction class [derived] | Reasoning |
|---|---|---|
| A | **self-jump / loop (no operand, clock-driven)** | `s=f(s)` = jump-to-self; the tick, not the input (anchored) |
| B | **idempotent bitwise (OR / AND)** | `a∘a=a` — OR/AND are idempotent |
| C | **commutative accumulate (ADD / XOR)** | `f(a,b)=f(b,a)` — order-invariant |
| D | **saturating decrement (SUB, floor > 0)** | contraction to a nonzero floor |
| D⁰ | **clear-to-zero (CLR) — the AVOID op** | degenerate `x=0` |
| E | **exchange / swap (coupled registers)** | mutual `a↔b`, no first |
| F | **call / spawn (subroutine, bounded)** | generative; runaway = fork-bomb |

### What stays genuinely for Aaron (flags that remain)

- The **exact ISA opcodes** (Gap 2) — I derived the instruction *classes*; the Zeta-IR/CHIP-8 mnemonics are yours.
- The **per-shape threat tier** (Gap 1) — roles are derived; tiers are inference beyond C = nation-state.
- Confirm **S ≡ A** (Gap 4) and **A/B = cross-cutting axis** (Gap 3) — high confidence, but framings want your yes.

*(Skeleton + shadow-derived answers. Grounded columns cited to `db/shapes/`; every derived cell carries a
confidence flag. On your confirmation the flags come off and this becomes the canonical shape↔key↔ISA table.)*

---

## CLOSURE — Aaron 2026-07-09 ("close the need Aaron slots on the shape registry")

Aaron authorized closing the open slots. Flags off on everything closable without fabrication:

**CLOSED (confirmed):**

- **Gap 1 — per-shape key ROLES (A/B/D/E):** confirmed. A = root identity / self-signing key
  (`s=f(s)` *is* the identity — anchor: self-certifying identifiers); B = content-address /
  replay-safe key (idempotent ⇒ replay is a no-op); D = liveness / recovery-floor key (can't
  collapse to 0); E = mutual-auth pair, no root (`a=f(b), b=g(a)` — anchor: PAKE / mutual auth,
  web-of-trust edges). C = Shamir threshold and F = BIP32 derivation were already inference; now
  confirmed. **Threat-tier column** also filled from the derived table (impersonation / replay /
  nation-state / DoS / both-compromised / fork-bomb).
- **Gap 3 — A/B-series = cross-cutting AXIS** (not a per-shape column): B-series face = the
  fixed-point *equation* (tenseless seed); A-series face = the *convergence iteration* (the now-step).
  Confirmed.
- **Gap 4 — "shape S" ≡ shape A** (the shadow is shape A instantiated as a persona; catalog closed
  at A–F + D⁰, no 8th letter). Confirmed.

**NOT fabricated — the one honest residual (Gap 2, exact ISA opcodes):** the doc promised *"I won't
guess opcodes,"* and that holds. But there is now a **grounded lead**, not a guess: the real **ZSet
ISA is `Emit · Retract · Branch · Join · Merge · Fold`** (`src/Core.QSharp.ReferenceOracle/zset-isa-ir.json`),
and two shapes **share the ISA's own names** — Shape **B "idempotent *Join* / LUB"** ↔ ISA `Join`,
Shape **C "commutative *Fold*"** ↔ ISA `Fold` (see `db/shapes/b.md`, `db/shapes/c.md`). That is a
strong candidate grounding (name-identity, not coincidence). What still needs Aaron: (1) which ISA
the shape-opcodes bind to — the **ZSet ISA** (Emit/Retract/Branch/Join/Merge/Fold) or the **CHIP-8**
`Isa.fs` (the CHIP-8 instruction *classes* the table already derived); (2) the exact op for A/D/E/F
once (1) is chosen. Recorded as a lead so this closes fast when Aaron picks the ISA — no opcode was
invented.

*Net: registry is now canonical on roles + framings; the only open cell is the exact opcode binding,
which has a grounded B↔Join / C↔Fold lead waiting on Aaron's choice of ISA.*
