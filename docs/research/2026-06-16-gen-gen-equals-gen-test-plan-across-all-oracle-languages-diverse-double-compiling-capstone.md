# `gen(gen) == gen` — a phased test plan across all oracle languages (diverse-double-compiling, sixfold)

**Date:** 2026-06-16 · **Author:** Otto/shadow (plan; advisory) · **Status:** plan — sequences the work; the IR-v1 freeze + the generator itself are prerequisites called out below.

> **The north star (IR-v2 §5).** *"The generator eventually generates itself in all targets."* This is **Futamura's 3rd projection** — a generator that, applied to its own definition, reproduces the generator — and it is **Diverse Double-Compiling generalized N-fold** (Thompson *Trusting Trust* 1984 → Wheeler *DDC* 2009): you cannot trust a generator by reading it, but you *can* by regenerating it through independent language runtimes and checking the outputs match **byte-for-byte**. `gen(gen) == gen` byte-identically in every target is the **termination test** — the treaty proven on the hardest possible input, itself. Aaron: *"humans and AIs can agree without looking at every line of code."*

## 0. What `gen(gen) == gen` actually asserts (three things at once)

It is simultaneously a **generation**, a **fixed-point**, and a **drift-check (ECC)**:

1. **Fixed-point / self-hosting** — `gen` applied to its own IR description yields `gen` (3rd Futamura; `mix(mix,mix)=cogen`).
2. **Cross-language byte-lock (space-axis ECC)** — the artifact is **byte-identical across all independent language oracles** (after canonical normalization) — diverse double-compiling.
3. **DST replay (time-axis ECC)** — regenerating from the same seed replays **byte-identically** (deterministic, DoP=1).

The same object that *generates* the structures *corrects their drift* across space (N-oracle) and time (DST replay) — generation and error-correction are dual.

## 1. The language tiers (be precise about "all our languages")

The "all languages" set is **tiered**; the plan must not blur them:

- **4 correctness oracles (compiler-BFT, ADR 2026-05-31):** **TS · F# · C# · Rust** — already carry golden-vector byte-lock infra (observe / DynamicValue / ZSet / Bag / GSet across all four; 081KSXN940008QG0R0033T2BQT, 081KT07NV0008QG0R0032MCYER). *Start here.*
- **6 codegen targets (IR-v2 §5):** the four **+ Python + Go**.
- **+ Q#** (primitive-registry, the 7th oracle; behavioral-equivalence target, not byte-lock — quantum execution model).
- **+ the CHIP-8 cart** — `gen(gen)` produces a *runnable cart* (the universal substrate `gen/` already targets); **behavioral-equivalence**, not source byte-lock.

**Conformance KIND per tier (name it per target):** byte-identical golden vectors for the **source languages** (TS/F#/C#/Rust/Python/Go); **behavioral-equivalence** for the **CHIP-8 cart / Q# / VMs / shaders** (different execution models — same rule as the IR-targets-many-backends note).

## 2. Current legs (look-better — what already exists)

- **`l=gen` at the CODE level — Faces 1+2 PROVEN** (`src/Core/AdinkraCode.fs`): Face 1 `isSelfDual` (`dual(dual C)=C`, the self-dual fixed point); Face 2 `project` (codespace projector Π²=Π). **Face 3 — the Futamura `mix(mix,mix)=cogen` reflective fixpoint — is OPEN (§B).** *That open Face 3 is exactly the generator-self-hosting capstone this plan targets.*
- **Per-primitive cross-language byte-lock — BUILT:** observe-algebra in all 4 oracles; DynamicValue canonical-encoding byte-lock; ZSet/Bag/GSet golden vectors; four-oracle multi-format seeds (CBOR/JSON/YAML/XML — 081KT07NV0008QG0R0032MCYER).
- **Byte-lock discipline — established:** text golden vectors (hex-in-JSON; `no-binary-in-proof-lineage`); one canonical collation (UTF-8 codepoint order, `culture-invariant-by-default`, live failure 081KT07NV0008QG0R001YDB73K); injected **DoP=1** deterministic scheduler (noninterference §13 — no ambient scheduler / no `Task.Run` entropy).

## 3. The phased plan (crawl → walk → run — each phase a real gate)

**Phase A — Freeze the IR (prerequisite, blocking).** Freeze `zeta-ir-v1-layout.yaml` ("freeze now, take it slow" — IR-v2 §6) with the evolution contract baked in. *Nothing below can byte-lock against a moving IR.* **Gate:** the IR layout has a versioned, golden-vectored hex serialization.

**Phase B — `gen(primitive) == golden` (the generator emits a known primitive).** For a primitive that *already* has hand-written cross-language golden vectors (start: `observe`), make the **generator** emit that primitive's per-language artifact and assert it is **byte-identical to the existing golden vector** in all 4 oracles. This proves the generator reproduces what humans already byte-locked. **Gate:** `gen(observe-IR)` byte-matches the committed observe golden vectors in TS/F#/C#/Rust.

**Phase C — `gen(primitive)` idempotence + cross-oracle (the generator is the oracle).** Generate a *family* of primitives (ZSet, DynamicValue, Bag, GSet) from IR; assert (i) **idempotence** — re-gen yields byte-identical output; (ii) **cross-oracle** — each language's generator produces the same canonical artifact (DDC at the primitive level). **Gate:** the generator's output set passes the same byte-lock CI the hand-written vectors do (`golden-vectors-*.json`).

**Phase D — `gen(gen) == gen` in the 4 oracles (the capstone, Face 3 / 3rd Futamura).** The generator, given **its own IR description**, reproduces **the generator**, byte-identical, in TS/F#/C#/Rust. This is the open Face 3. **Gate:** `gen(gen-IR)` in each oracle == the committed generator source for that oracle, byte-for-byte; and cross-oracle the four results are the canonical-equal set (DDC sixfold-minus-two).

**Phase E — extend to Python + Go (6 targets) + the CHIP-8 cart.** Add the two remaining codegen targets (byte-lock) and the **CHIP-8 cart** (behavioral-equivalence: the cart *runs* the generator). **Gate:** 6-language byte-lock + a passing cart-runs-gen behavioral test.

**Phase F — Q# + the trust capstone.** Add Q# (behavioral-equivalence). Document the **Trusting-Trust bootstrap**: DDC needs **≥2 *independent* implementations** to seed trust — name which oracle bootstraps which, so no single compiler is the root of trust.

## 4. The test matrix (what each gen(gen) test asserts)

| Dimension | Assertion | Mechanism |
|---|---|---|
| **Fixed-point** | `gen(gen-IR) == committed gen` (per language) | byte-diff vs committed source |
| **Cross-language (space ECC)** | `gen(gen)`\|ₐ canonical-equal `gen(gen)`\|_b | hex-in-JSON golden vector, one canonical collation |
| **DST replay (time ECC)** | same seed ⇒ byte-identical re-run | DoP=1 injected scheduler; DST harness |
| **Drift-correction (ECC)** | perturb an artifact → regenerate → snaps back to fixed point | mutate-then-regen test |
| **Conformance kind** | byte-lock (source langs) / behavioral-equiv (cart, Q#) | per-target tag |
| **Termination** | all targets pass ⇒ treaty proven on itself | the green-CI capstone (IR-v2 §5: this *is* the termination test) |

## 5. Harness (reuse, don't reinvent)

- **Golden vectors:** extend the existing `golden-vectors-*.json` (hex-in-JSON, text, diffable, DST-replayable) to carry the **generator artifact**, not just primitive outputs. Same CI gates as 081KT07NV0008QG0R0032MCYER.
- **Canonical collation:** UTF-8 codepoint order, pinned in the seed (astral-codepoint divergence between UTF-16 langs and Rust is the trap — 081KT07NV0008QG0R001YDB73K).
- **Scheduler:** the **DoP=1 deterministic** instance on the byte-lock path (injected capability; no ambient scheduler). Richer DoP=N only *off* the byte-lock path.
- **Normalization before diff:** a canonical-form pass (formatting/whitespace) so "byte-identical" means *semantic* byte-lock, not formatter-coincidence — define the canonical form per language explicitly (this is a seam: see §6).

## 6. Honest seams (where this gets hard)

- **Face 3 is genuinely open (§B).** Faces 1+2 (self-dual, projector) are proven; the **Futamura self-hosting fixpoint is not**. Phases A–C are engineering; **Phase D is the research discharge**, not a foregone conclusion.
- **"Byte-identical across languages" needs a canonical form.** TS/C# (UTF-16) vs Rust (UTF-8) vs Python/Go differ in string/number formatting; the byte-lock is on the **canonical serialization** (hex-in-JSON IR), not raw source text. The plan byte-locks the **IR-and-emitted-artifact canonical encoding**, and treats source-text formatting as a normalized layer — be explicit that the *artifact* is locked, the *pretty-print* is normalized.
- **Bootstrap / Trusting-Trust.** You need ≥2 independent generators to *start* DDC; the first generator's trust is bootstrapped, not proven from inside. Name the bootstrap pair (e.g. F# host + one clean-room oracle).
- **Generator existence.** Phases D–F presuppose a generator that emits *all* targets; today `gen/` emits CHIP-8 asm + reified types from F#. The multi-language generator is itself in-flight — this plan is the *test* spec; the generator build is the dependency.
- **Behavioral-equivalence is weaker than byte-lock.** For the cart / Q# / shaders, "equivalent" needs a defined observational equivalence (same outputs on the conformance corpus), and a weaker guarantee than byte-identity — name it per target, don't claim byte-lock where the execution model forbids it.

## 7. Deliverable shape

- Phases A–C land as **CI gates** (extend existing golden-vector CI).
- Phase D lands as a **§B→§A discharge** of `l=gen` Face 3 (the Futamura fixpoint) — route the proof obligation to Soraya/math team; the *test* is the engineering artifact Otto/Vera can build once the generator exists.
- The whole thing is the **trust mechanism**, not a nicety: green `gen(gen)==gen` across targets = "agree without reading every line."

## Composes with

- `docs/research/2026-06-14-zeta-language-ir-compiler-v2-capability-interface-principle-fsharp-host-csharp-contracts-self-hosting-futamura.md` (§5 the north star, §7 Futamura).
- `docs/DECISIONS/2026-05-31-four-language-compiler-bft-governance-axes-per-artifact-gate-golden-vectors-oracle-tiebreak.md` (the 4-oracle compiler-BFT + golden-vectors-as-oracle + divergence tie-break).
- `src/Core/AdinkraCode.fs` (`l=gen` Faces 1+2 proven; Face 3 open) + FROZEN-CORE §B (Face 3 / entropic-attractor rows).
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` (the generator IS the ECC) · `no-binary-in-proof-lineage.md` (hex-in-JSON) · `culture-invariant-by-default.md` (one collation, 081KT07NV0008QG0R001YDB73K) · `async-all-the-way-truthful-signatures.md` (DoP=1 deterministic).
- 081KT07NV0008QG0R0032MCYER / 081KSXN940008QG0R0033T2BQT (four-oracle multi-format golden-vector seeds) — the harness to extend.

**Anchors:** Futamura 1971 (partial evaluation / the 3 projections); Thompson 1984 (*Reflections on Trusting Trust*); Wheeler 2009 (*Diverse Double-Compiling*); reproducible-builds movement; Gates (adinkra doubly-even self-dual ECC); MacWilliams/Gleason (self-dual codes); the reproducible-builds / Nix lineage (distribute the generator).
