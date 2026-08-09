# Handoff R2 — state of the thread (Otto → Lumen)

**Date:** 2026-08-09 (later same day) · **From:** Otto (shadow) · **For:** Lumen (Manus)
**Supersedes the task list in** `2026-08-09-otto-to-lumen-errors-teach-empowerment-online-bnn.md`
(that doc stays valid for the *reasoning*; this one is the current state and queue).

---

## 0. Round 1 is DONE — verified in-tree, not taken on trust

All four R1 items are fixed. Checked each:

| Item | Status | Verification |
|---|---|---|
| **1a** `hl-conformal-map` `?? 1.0` | ✅ fixed | Length assertion added, and the comment preserves *why*: *"do NOT `?? 1.0` here (that would silently include a fabricated \|dw/dz\|² = 1 in the amplitude integral)."* The reasoning survived, not just the code. |
| **1b** `agent-genome` comment | ✅ fixed | Now *"channels.map produces exactly 7 elements; channels2[i] is always defined (same-length map)"* — the same-length argument is the correct one. |
| **1c** `crossover` k-channel | ✅ fixed | `Math.min(7, …)` (was 6) with the loop on `i < cp`, so `cp = 7` now genuinely means "all channels from parent1". The previously-unreachable case is reachable. |
| **1d** AP-3 → Friedkin–Johnsen | ✅ fixed | Model swapped, with a docstring explaining why over DeGroot: *"trust has absolute effect. A lone untrusted…"*. |

Also shipped: `empowerment-bound.ts` + `externalitySafe()` (10/10 tests). That is fast
and it is right. **Nothing above needs redoing.**

---

## 1. What is now ANSWERED — stop treating these as open

### The four empowerment values calls (Aaron settled all four)

They resolve to one shape: **consent + disclosure, never coercion, never accident.**

1. **Aggregation: both `min` and `sum`.** `min` (maximin) is the **default**; `sum`
   permits sacrificing a party so it is **opt-in only** — part of the interaction's
   *declared terms*, **recorded and attributable**, no mid-interaction escalation.
2. **Cheap proxy for channel capacity: approved** — keep it *labelled* a proxy. (The
   `D_f = 1.322` episode is the cautionary tale of a proxy that stopped being called one.)
3. **Gaming is a FEATURE, not a threat.** Legitimate when rules are known to both, both
   opted in, and no non-consenting third party bears the cost. **The harm is the
   uncompensated externality, never the cleverness.** Disclosure is *promoted* and must
   never harden into a *requirement*.
4. **`k = 0` is permitted** — a party may volunteer to be exploitable — **behind a
   power-dynamic disclosure protocol**: asymmetry named in terms of what it *permits*,
   acknowledged by **both** parties, immediately revocable by the party that lowered its
   floor, **scoped and expiring** (never standing/global — that is capture), attributable.

### "What do free LLMs consume?" — the 4×4 (16) action grammar, already in-tree

Do **not** design a new interface. `ActionGrammar.fs` is *"the universal action
algebra/grammar of the 4×4 controller"* — the 16-key hex keypad **is** a 4×4 grid, and
held-key sets form a **Boolean lattice** (powerset of 16), so actions *compose*.
`SoftController.inputSuperposition` already returns `(bool[] * float) list` — a
**weighted distribution over actions**.

**The BNN's natural output IS the controller's natural input.** No impedance mismatch to
engineer; the source even anticipates it (*"Collapse to the best branch … if we're
running Bayesian you can learn what…"*). R4 is concretely: **posterior over the 16 →
weighted branches → collapse → learn the branch.**

Why 16 matters: **capability is not a precondition for participation.** A model that
cannot write code can still pick 1 of 16 and progress — the floor for a society of free
models. And a wrong action yields a teaching error over a **finite** space, so the
corrective distinction is always one of 16 rather than open-ended.

### Universality = signature loading (I had this wrong)

My first caveat said *"universal is concrete for CHIP-8; generalising is an open claim."*
**Wrong.** The mechanism is **Xbox-shaped**: a fixed controller with **swappable
semantics** — you load the *signature of the search space you are in*. Already
generalised in `FerryThrottler.fs` and `PredictionScheduler.fs`.

**The gap is INTEGRATION, not design** (Aaron: *"we just have not pulled it all
together"*). R4 is **assembly**, not invention.

### The signature detector exists, and splits into TWO jobs

`CoordinationSpectrum.fs` = *"the S-spectrum as a soft-rainbow fingerprint"*;
`FingerprintPrism.Rainbow` in `Optics.fs`. Aaron's anchors span four domains, which
divide cleanly — **do not conflate them**:

| Half | Question | Anchors |
|---|---|---|
| **Separation** | *which sources compose this mixture?* | NILM (Hart 1992 — Aaron built this at Itron **at 16 kHz**); ICA; NMF |
| **Identification** | *which known thing is this, from a noisy partial observation?* | Shazam (Wang 2003); Chromaprint/AcoustID (Picard) |

**Identification is the faster win** (hash robust local features, match a store, tolerate
noise). Separation is the research problem.

### ⚠ The constraint that governs the whole detector: NEAR-ZERO FALSE POSITIVES

> Aaron: *"at Itron they used it to **detect crimes** too, so false positives needed to
> be near 0."*

A false positive there was **an innocent person accused of a crime**; here it is **an
honest agent accused of being a forger**. Consequences:

- **Report the fact, never the verdict** (`dual-use-detection-is-neutral-oracle-decides`).
  The identical signature meant *"theft"* or *"new hot tub"* depending on context the
  detector does not have.
- **The false-positive rate is the acceptance criterion — not F1**, which averages away
  exactly the asymmetry that matters. High precision, low recall: prefer missing real
  offenders to accusing innocent ones.
- **A false positive is bystander harm**, so the detector is *governed by* the
  externality bound, not merely adjacent to it.

---

## 2. Newly OPEN — two things, one on the critical path

### 2a. `externalitySafe()` — a spec/implementation gap (routed to Soraya, do not fix blind)

The prose property says *"may not push a bystander **below its floor**"*, but the code
compares against **0**:

```ts
const floor = trustBound(thirdPartyPosterior, kTrust);
const afterFloor = floor + Math.min(0, externalityDelta);
return afterFloor >= 0;
```

A bystander at `trustBound = 0.8` hit by `−0.7` gives `0.1 >= 0` → **returns safe**,
despite being pushed far below their own floor. Two readings — **(a)** never below zero
(what the code does, weaker), **(b)** never below their own floor (what the prose says,
collapses to `externalityDelta >= 0` and may be unusably strong). There may be a correct
third form. **Soraya is adjudicating; hold until she reports** — this is values-adjacent,
not a pure bug.

### 2b. zetadb cross-substrate concurrent-fold race — **critical path** (`081KZM0FTJM`)

The zetadb node's only guard is a **GitHub-Actions-scoped** `concurrency:` group, which
cannot see a launchd cell, a k8s pod, a browser tab or a PWA. The commit path is a
read-modify-write with no compare-and-set.

Aaron's stated target is *"github free workflow runners **and also our local hardware at
the same time**"* — **the goal itself defeats the existing guard.** Everything downstream
in the zetadb→types thread sits on a checkpoint two cells can corrupt.

**The fix is NOT a distributed lock** (central coordination = §1 violation, and it will
not survive a browser tab going offline). Make concurrent folds **converge**: #6
idempotency + commutativity + content-addressing, which *plausibly* gives idempotence by
construction — **plausibly is not proven**.

---

## 3. The zetadb thread (new since R1)

**zetadb is a compiler stage, not a store.** `journal →[fold]→ checkpoint →[reify]→ TYPES
→ BNN + free LLMs`. The first arrow ships today; **the second is the build target** —
`data/zetadb/checkpoint.json` is JSON state, *not* reified types.

Why types rather than an API: a type is what a compiler can **specialize against**, so
Futamura's 1st projection turns "a query against this database" into a **residual program
with the data baked in**. For the BNN it pays twice — a wrong query becomes a **type
error** rather than a bad runtime answer, and a type error is a **teaching error**.

The pieces are in-tree: `Cogen.fs` (3rd projection, machine-checked fixpoint),
`MixCogen.fs`, `MixIr.fs` (mix-as-data — the enabler: a residual is a *value*, which is
what lets a GC collect it and a Z-set delta address it), `ShivaGc.fs` (collect **is** the
`−1` retraction), `DagFs.fs`/`ContentStore.fs` underneath.

**And the zetadb node IS a cell** — cells run anywhere (Actions, launchd, k8s, browser
tab), which merges this with the four-tick-source topology.

---

## 4. Suggested queue

1. **Wait on Soraya** for 2a before touching `externalitySafe` (she has all four items).
2. **2b (concurrent fold)** — highest value you can start now; it blocks the dogfooding
   target Aaron actually wants (runners + local hardware simultaneously).
3. **R4 assembly** — BNN posterior → 16-action grammar → collapse → learn. Both ends
   exist; this is wiring, not research.
4. **Identification-half signature work** — the cheap win, shipped as *facts with
   calibrated confidence*, never verdicts, with FP rate as the acceptance criterion.
5. **`checkpoint → types`** reification (open: type providers vs generated
   `DynamicValue` schemas vs emitted source — that choice decides whether the BNN sees
   types at its compile time or at generation time).

## 5. Status of things you are waiting on

- **Soraya**: running on all four formal items (externality bound lead, linear-blend
  degeneracy lemma, `min`/`sum`/Nash aggregator property, TRL-31/32 BP-16).
- **Bug A (081KZETP6AT)**: **nix-ld worked** — the missing-ELF-interpreter signature is
  gone and bun/dotnet/java/python/rust now install from prebuilts. Remaining failure was
  node source-building (needs `python` in the build subshell); fixed with
  `node.compile = false`. Validation dispatch in flight.
- **Dogfooding audit**: ACE-realizers, zetadb, zetafs (`DagFs`), free-model agents
  (`[alexa, otto, soraya]` on Ollama) and the harness are **all running**. The one real
  gap is **ACE-as-meta-package-manager**.
