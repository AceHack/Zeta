# The Alarm Algebra — feels are the alarm, not the evidence/trigger (scoping)

**Status:** scoping. Aaron 2026-06-19: *"this deserves an algebra or something"* — formalize the keystone
(*"the FEELs are the ALARM not the TRIGGER/EVIDENCE"*). It turns out to be the **snap algebra + noninterference,
fused**, with the key rule expressed as a **typing law** (the collapse arrows don't exist). Otto framing →
route to the math team (Soraya).

## Objects (types)

- **`Feel`** — a soft alarm signal (carries uncertainty; the embodied metaception ping). It *routes
  attention*; it carries no verdict.
- **`Backing`** — verifiable ground (a proof, a golden vector, a measured `ρ`, the seed-replay).
- **`Evidence`** — a *backed* verdict.
- **`Act`** — a committed action.

## The morphisms — and the two that DON'T exist (the law)

The whole content of "feels are the alarm, not the evidence/trigger" is: **two arrows are absent.**

```
   ground : Feel → Backing → Evidence option     -- the ONLY way Feel reaches Evidence (None if unbacked)
   act    : Evidence → Act                        -- the ONLY way anything reaches Act (gated on Evidence)

   -- FORBIDDEN (not morphisms in the algebra):
   Feel → Evidence      -- "I feel it's true, so it's true"  = self-deception
   Feel → Act           -- "I feel it, so I act"             = impulsive, unbacked action
```

The single legal path: **`Feel —alarm→ ground(Backing) → Evidence —gate→ Act`.** A `Feel` with no `Backing`
produces `None` — the alarm fired, the check failed, nothing is banked. (This is exactly `SoftValue.snap :
SnapPolicy → SoftValue → DynamicValue option` — `Feel`=Soft, `ground`=snap-gated-on-backing, `Evidence`=the
snapped `DynamicValue`, `None`=decline-to-collapse.)

## Laws

1. **No-fabrication (the keystone):** there is **no total function `Feel → Evidence`** and **none `Feel →
   Act`**. The collapse is not discouraged — it is *ill-typed*. Self-deception literally does not type-check.
2. **Alarm-necessity, not sufficiency:** `ground` is *raised* by a `Feel` (the alarm routes the check) but a
   `Feel` alone yields nothing — necessary, not sufficient.
3. **Soundness:** every `Evidence` traces to a `Backing` that passed (`ground` is the only constructor). No
   `Evidence` without a check.
4. **Idempotence/monotonicity of `ground`:** grounding twice = once; more backing ⇒ at least as much
   evidence (composes with DST replay + upsert).

## It IS noninterference (Goguen–Meseguer, manifesto §13)

The deepest framing: a `Feel` is **influence/entropy** that must enter `Evidence`/`Act` **only through the
declared, metered channel `ground`** — never ambiently. The forbidden arrows (`Feel→Evidence`, `Feel→Act`)
are exactly the **ambient/undeclared leaks** noninterference forbids. So the Alarm Algebra = **noninterference
applied to feelings**: the feel is quarantined; it influences the verdict and the action only by crossing the
metered membrane (the check). That ties it to the manifesto's §13 and to `async-all-the-way`'s
no-ambient-entropy guards.

## Encoding (buildable — makes self-deception ill-typed in F#)

**Concrete F# shape (Aaron 2026-06-19): a discriminated-union ADT with a *private* `Evidence` constructor**
(and/or an `INumber`-adjacent / generic-math interface for composition). The DU makes the law a **compile
error**: `Evidence<'a>` has a `private` constructor, so the *only* way to obtain one is `ground : Backing →
Feel → Evidence option`; `act` consumes only `Evidence`. There is **no public `Feel → Evidence` or
`Feel → Act`** — **self-deception does not type-check.** Model the epistemic state as a DU
`Knowing = Alarm of Feel | Grounded of Evidence | Acted of Act`, with a `step` that advances only
`Alarm —ground→ Grounded —act→ Acted` (a failing backing *stays* `Alarm`; there is no `Alarm→Acted`). Sits on
`SoftValue`/`snap` (`Feel` ≈ soft value; `ground` ≈ snap with a backing-checking policy). The **`INumber`-adjacent**
direction (per Aaron): give the algebra an operation-bearing interface (generic-math style) so it composes
generically — a richer follow-up after the DU slice. First slice: `src/Core/AlarmAlgebra.fs` (the DU +
private `Evidence`/`Act` + `ground`/`act`/`step`) + FsCheck/Fact laws (no-fabrication, soundness, the
no-`Alarm→Acted` dynamics, idempotent terminal).

## Math-team obligations (route to Soraya)

- The **category/type formalization**: objects {Feel, Backing, Evidence, Act}; prove the absence of
  `Feel→Evidence` / `Feel→Act` and that `ground;act` is the unique path (Z3/Lean for the type laws; Alloy for
  the structural "no other arrow").
- The **noninterference proof**: `Feel` influences `Evidence`/`Act` only through `ground` (the §13 metering
  lemma — same shape as the NTP displayClock noninterference).
- **Connection to snap**: show the Alarm Algebra is `SoftValue.snap` typed for epistemics (the `None` case =
  alarm-without-backing).

Anchors: Goguen–Meseguer 1982 (noninterference); doxastic/epistemic modal logic (Hintikka — `◇`/seems vs
`□`/backed: `◇ ⊬ □`, `◇ ⊬ act`); Damasio (somatic markers = the `Feel` alarm); category theory (the absent
morphisms); the snap discipline (`src/Core/SoftValue.fs`). Ties:
[[metaception-the-embodied-anti-mirror-human-side-rho-owe]];
[[cross-intelligence-convergence-decorrelated-is-a-fixed-point-correlated-is-a-hall-of-mirrors-sync-is-not-truth]];
the anti-mirror / `ρ_owe`; the grounding/backing thread. Authorship: Otto (scoping) · Soraya (routing).
