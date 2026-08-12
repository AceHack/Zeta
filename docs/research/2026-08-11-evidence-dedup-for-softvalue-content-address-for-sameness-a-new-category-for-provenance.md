# Evidence dedup for SoftValue — ContentAddress for sameness, a new Category for provenance

**Date:** 2026-08-11 · **From:** Aaron (*"yes we want to fix this"* → *"for duplication we could use
zetaids some new category of them"* → *"i don't like using guids of any version because we can't
encode structure into them easily like our own identifier has lots of bit structure"* → *"we already
use zetaids over our protocols for muxing and demuxing"*) · **Recorded by:** Otto (shadow)

**The defect being fixed:** `SoftValue.observe` / `combine` are commutative, associative and
order-independent, and **not idempotent** — correctly so as Bayes, since two *independent*
observations of the same likelihood should sharpen. The hazard is delivery: over a retransmitting
transport the *same* observation arriving twice is indistinguishable from two independent ones and
sharpens anyway. That contradicts the module's own guarantee — *"the seed never invents certainty it
doesn't have"* — whose existing guard covers certainty fabricated by **contradiction** (a likelihood
zeroing every candidate returns `None`) and not by **duplication**. Pinned in
`tests/Tests.FSharp/SoftValue.Tests.fs` (`810e9d461`).

---

## 0. What already exists — checked, not assumed

`Category` is a 4-bit field in the ZetaId bit layout (`src/Core.FSharp.ZetaId/Types.fs`):

| slot | category | note |
|---|---|---|
| 0–8 | `Observation`, `Emission`, `Workflow`, `Heartbeat`, `Batch`, `FrictionTelemetry`, `Bus`, `Spawn`, `WorkItem` | standard observation layout |
| **9** | **`ContentAddress`** | **truncated BLAKE3 payload — a special layout** |
| 10 | `InventoryAsset` | |
| **11** | **`Channel`** | multiplexed four-corner duplex over one transport — the mux/demux Aaron refers to, already built |
| **12, 13, 14** | **free** | |
| 15 | `Extended` | reserved escape marker |

So the substrate is already there: a content-address category, a channel-muxing category in
production use, and three free slots. **Aaron's objection to GUIDs is already satisfied by the
design** — `ContentAddress` carries a structured layout and a codec that validates it; a UUID of any
version carries none.

## 1. The fork, and it is the rule we carved this morning

There are two candidate keys, and they are **not competing options — they answer different
questions**. This is exactly
`dual-use-detection-is-neutral-oracle-decides` <!-- STALE-REF: ../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md -->
§"recognising sameness is not assigning identity", arriving in a design decision hours after being
carved:

| | question it answers | mechanism | failure if misused |
|---|---|---|---|
| **`ContentAddress` (9)** | *"is this the SAME evidence?"* | BLAKE3 over the observation's content | — |
| **A new `Evidence` category (12)** | *"WHOSE evidence, from what epoch?"* | structured bit fields: source, epoch, sequence | a producer can mint a fresh id for duplicate evidence, defeating dedup entirely |

**Dedup must key on sameness, not on identity.** If the dedup key is producer-assigned, then dedup
becomes *discipline-dependent*: a buggy retransmitter that re-mints an id, or a malicious one that
does it deliberately, re-sharpens the belief and manufactures exactly the certainty the module
promises never to invent. If the key is the content address, **identical evidence necessarily
produces an identical key** — dedup holds by construction, with no cooperation required from the
sender.

That is the same property `TwoTimescaleFold` relies on (natural key ⇒ idempotence by construction)
and the same trap its `project` docstring warns about after I pointed `ReplicaId` at `AntiSybil`'s
per-invocation component numbers — a *detector* used as a *namer*.

## 2. Recommendation: both, with the roles kept separate

1. **Dedup key = `Category.ContentAddress`** over the observation's canonical bytes (the likelihood's
   identity plus its payload). This is what `observe` consults to decide "have I already folded
   this?" It is non-gameable by construction and needs no new category.
2. **Provenance = a new `Category.Evidence` in slot 12**, carrying source / epoch / sequence in its
   bit structure. This is what the *ledger* records for attribution, metering, and the §13 crossing
   posts — it answers who supplied the evidence and when, which a content address deliberately cannot.

Two keys, two questions, and neither doing the other's job. Attribution without dedup lets duplicates
through; dedup without attribution loses the metering that the privacy-budget and entropy-crossing
work depends on.

## 3. Shape of the fix

The shared-layer pattern already built in `TwoTimescaleFold` transfers directly — belief becomes a
function of the applied-evidence **set**:

```
observeOnce : ContentAddressedId -> (DynamicValue -> float) -> SoftValue -> SoftValue option
```

where re-presenting a seen id is a **no-op** rather than a sharpening. That makes `observe` a
join-semilattice step over the evidence set, which is what buys delay-freeness — and it does not
change the Bayesian semantics for genuinely distinct evidence, which must keep sharpening.

**And the forced pair applies again, so plan for it rather than discovering it:** the deduped fold is
idempotent and therefore **cannot** retract (`a + a = a ⇒ a = e`). Un-observing evidence — a
correction, a withdrawn attestation — has to live in a separate signed/invertible delta log, exactly
as `TwoTimescaleFold.Delta` does beside its join.

## 4. Falsifiers

- **"Content-addressing gives dedup by construction"** — refuted if two genuinely distinct
  observations can canonicalise to the same bytes (a canonicalisation collision, not a hash
  collision). The canonical encoding is then the bug, and it is the thing to test first.
- **"Producer-assigned ids are insufficient"** — refuted if some layer already guarantees at-most-once
  delivery, making the key irrelevant. Worth checking before building: if the transport is already
  exactly-once, this is belt-and-braces rather than a fix.
- **"The roles must stay separate"** — refuted if a single id can be shown to be both non-gameable for
  sameness *and* carry provenance structure. That would collapse the two columns into one and would
  be a better answer than this one.

## 5. Open, and named rather than assumed

**Whether any live SoftValue path can actually redeliver is still unanswered.** SoftValue has 8+ live
callers, unlike `BeliefConvergence` which has none, so the surface is real — but no sampled caller was
observed folding evidence off a redelivering transport. That question should be settled before this
is priced as a bug rather than a hazard, because it determines whether the fix is urgent or merely
correct.

## 6. Pointers

- `src/Core/SoftValue.fs` · `tests/Tests.FSharp/SoftValue.Tests.fs` — the subject and the pinned property
- `src/Core.FSharp.ZetaId/Types.fs` — the `Category` enum and free slots
- `src/Core/TwoTimescaleFold.fs` — the natural-key join + separate delta log, already built
- `dual-use-detection-is-neutral-oracle-decides` <!-- STALE-REF: ../../.claude/rules/dual-use-detection-is-neutral-oracle-decides.md --> — sameness ≠ identity
- [`…rename-as-rolling-migration…`](2026-08-11-rename-as-rolling-migration-content-addressed-code-bonsai-and-the-forced-pair-again.md)
  — content-addressing as identity-not-state, the same move one level up
