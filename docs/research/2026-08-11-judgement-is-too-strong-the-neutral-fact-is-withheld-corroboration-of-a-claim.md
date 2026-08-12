# "Judgement" is too strong — the neutral fact is *withheld corroboration of a claim*

**Date:** 2026-08-11 · **From:** Aaron (*"Is judgement too strong of a word? can it be dual use?
does a judgement indicate good or bad or just some sort of observation of self claim of other?"*) ·
**Recorded by:** Otto (shadow)

**Verdict: yes to all three.** The word is too strong, the mechanism is genuinely dual-use, and the
neutral fact is the one Aaron named — an observation about a **self-claim**, not a verdict on a
**party**. This is
`dual-use-detection-is-neutral-oracle-decides` <!-- STALE-REF: ../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md -->
applied to naming, which is where that rule bites most often and most quietly.

---

## 0. What is structurally sound already — stated first, so nothing is manufactured

`SymmetricEndurance.penaltyAgainst` counts only **explicit** `(observer, observed)` pairs:

```fsharp
let penaltyAgainst (frame: Frame) (q: int) : int =
    frame.Judges |> Set.filter (fun (o, p) -> p = q && o <> q) |> Set.count
```

So **silence costs nothing**. A party that no one can see, or that is partitioned away, accrues no
penalty — absence of corroboration is not treated as evidence against. That is the right behaviour
and it is already there. The concern that partition would punish honest separation (inverting *"we
diverge under partition and that is speciation"* into a punishment) **does not apply**; checked
before it was asserted.

The defect is in the vocabulary, not the arithmetic.

## 1. Why "judgement" fails the rule

The dual-use rule says: verdict types name the **fact**, never the **intent** — `SameSourceAsKnown`,
never `ForgerCaught`. Measured against that, the current vocabulary names intent throughout:

| current | what it smuggles |
|---|---|
| `Judges : Set<int * int>` | *judgement* — a moral finding about a party |
| `penaltyAgainst` | *penalty* — a sanction, i.e. the adversarial reading already chosen |
| *"judges `q` as forging"* | *forging* — the verdict, baked into the mechanism's own docs |
| *"society kills the forger"* | vivid, and it is one reading of the fact, not the fact |

Each of these decides, at the type level, that the adversarial reading is the true one. That is
precisely what the rule forbids the substrate from doing.

## 2. The neutral fact, and it is narrower than a judgement in two ways

> **Observer `O` withholds corroboration of `P`'s self-claim, from `O`'s frame.**

Two narrowings matter, and both are Aaron's:

1. **It is about a CLAIM, not a PARTY.** "O judges P" reads as a finding about a person. "O does not
   corroborate this claim of P's" is a finding about one assertion, from one vantage. The party is
   the claim's author, not the object of the verdict.
2. **It is FRAME-RELATIVE and says nothing about the world.** The pair records what `O` could
   establish from where `O` stands. It is not a claim that `P` is lying; it is a claim that `O`
   cannot vouch.

## 3. Both readings are real, which is what makes it dual-use rather than merely mis-named

- **Adversarial:** `O` observed `P` producing bad progress and declines to vouch → repeated across
  observers, the claim collapses. *"Society kills the forger."*
- **Benign:** `O` and `P` have incompatible frames — different histories, no overlapping observation
  window, an honest disagreement about what happened. **Two honest parties can decline to corroborate
  each other**, and nothing in the mechanism distinguishes that from forgery, nor should it.

This is the reunion/sybil pair again, one level up: the same primitive serves *"caught"* and *"we
were separated,"* and the substrate must not pick. Note the asymmetry that keeps this sound: the
collapse still requires **many** observers to withhold, so a single incompatible frame is cheap
while a broadly-unvouchable claim is expensive. The mechanism prices breadth of non-corroboration,
which is a fact, rather than adjudicating guilt, which is not.

## 4. Proposed renaming — NOT applied, because it is a live public surface

`SymmetricEndurance` has real callers (`PhasorEndurance`, plus tests, plus the new `EnduranceFold`),
so this is an API change and belongs to the operator's call rather than an autonomous tick.

| current | proposed | why |
|---|---|---|
| `Judges` | `Withheld` (or `Uncorroborated`) | names the fact: corroboration was withheld |
| `penaltyAgainst` | `withheldAgainst` / `nonCorroborators` | drops the pre-chosen sanction reading |
| *"judges q as forging"* | *"declines to corroborate q's claim"* | frame-relative, about the claim |
| `survives` / `collapses` | **keep** | these are about claim magnitude — a measured fact, not a verdict |

Keeping `survives`/`collapses` is deliberate: they describe what happens to a number, and a number
growing or going to zero is an observation, not a sentence.

## 5. The generalisation worth carrying

The naming layer is where the dual-use rule leaks most easily, because a type name feels like
description while functioning as policy. A mechanism whose *types* say `ForgerCaught` has decided the
question before any oracle is consulted, and no amount of neutral prose downstream un-decides it.

**Test to apply when naming a detector:** state the fact without any word that presumes a reading. If
you cannot, you have not yet isolated the fact.

## 6. Pointers

- `dual-use-detection-is-neutral-oracle-decides` <!-- STALE-REF: ../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md -->
  — the rule, including the functional half carved 2026-08-11 (recognising sameness ≠ assigning identity)
- `src/Core/SymmetricEndurance.fs` — the subject; §0 records what is already correct in it
- `src/Core/EnduranceFold.fs` — the two-timescale bridge, which inherits the vocabulary and would
  inherit the rename
- `src/Core/CoordinationSpectrum.fs` — the existing worked example of a neutral verdict type
