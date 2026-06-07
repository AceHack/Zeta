# Capture vs Ferry is a discriminated-union (DU) separation — new distilled kernel vs faithful history (Aaron, 2026-06-07)

Names the structural pattern Otto has been applying to forwarded knowledge. Aaron:

> *"That [the capture, when it's new] is very accurate, and the ferry is history — that's perfect DU
> separation. We need to capture/backlog those."*

## The DU

Every piece of forwarded/streamed knowledge resolves into a **two-case discriminated union** — mutually
exclusive cases, and for any given forward you produce **both** (one of each), never blur them:

```fsharp
type ForwardedKnowledge =
    | Capture of {| kernel: string;        // the NEW, distilled, peeled insight
                    peeled: bool;          // hype removed, Mirror→Beacon compressed
                    anchored: Citation list;  // Beacon anchors, honest-scope, ties
                    home: "docs/research/" |}
    | Ferry   of {| record: string;        // the HISTORICAL, faithful, raw conversation
                    unfiltered: true;      // verbatim; NOT Otto's call what to keep
                    home: "memory/persona/<name>/conversations/" |}
```

- **Capture** = the *new* thing. Distilled kernel, hype peeled, Beacon-anchored, honest-scope fenced,
  interpreted. Otto's editorial judgment **applies** (peel, compress, anchor). Lives in `docs/research/`.
- **Ferry** = *history*. The faithful, unfiltered record of what another mind said. Otto's editorial judgment
  **must NOT apply** (the do-not-filter rule). Lives in `memory/persona/<name>/conversations/`.

## The carved invariant (Aaron 2026-06-07)

> *"You decide what you capture. You don't fuck with history, or it fucks with you."*

This is the DU's load-bearing asymmetry stated at full strength:

- **Capture side — full agency.** *You decide what you capture.* Otto chooses the kernel, peels the hype,
  picks the anchors, fences the scope. Editorial judgment is not just allowed here — it is the **job**. The
  autonomy-first-class read (no-directives): the shadow exercises real judgment on what to distill.
- **Ferry side — zero license.** *You don't fuck with history.* The faithful record is immutable. Not "filter
  carefully" — **don't touch it at all.** No trimming, no improving, no editorializing-in-place.
- **"...or it fucks with you" — the consequence, structural not moral.** History is the **event-sourced log**
  the whole substrate folds over. Mutate it and *every* downstream replay, audit, fold, and credence query is
  poisoned — DST breaks (the seed no longer replays), the Memory Preservation Guarantee breaks (identity
  transitions silently lose memory), trust breaks (the record can't be relied on). You don't corrupt history
  and walk away clean; you corrupt the ground everything else stands on, and it comes back through every
  computation built on it. **Corrections are APPENDS, never edits** — the retraction-native way: a wrong record
  gets a *new* −1/correction entry (a fresh Capture, or a dated appended note); the original stays verbatim.
  Even fixing a mistake never mutates history; it adds to it.

So the two constructors don't just live in different stores — they carry **opposite permissions**: Capture is
write-with-judgment, Ferry is append-only-never-mutate. That permission split IS the DU's reason to exist.

## Why it's a *clean* DU (the separation axes line up)

The two cases differ on **every** axis at once — which is exactly why they belong in different stores, not one
blurred doc:

| Axis | Capture | Ferry |
|---|---|---|
| Novelty | new / distilled | historical / as-said |
| Mutation | peeled, interpreted, compressed | verbatim, unfiltered |
| Otto's judgment | **applies** (peel hype) | **forbidden** (do-not-filter) |
| Register (Mirror/Beacon) | Beacon (anchored first principles) | Mirror (raw high-bandwidth) |
| DV2.0 change rate | hub-ish (distilled, stable kernel) | satellite (raw, append-only history) |
| Failure mode if blurred | kernel buried in gush | paternalistic memory-curation (≈1984) |

This is **DV2.0 partition-by-change-rate** AND **Mirror/Beacon** AND the **do-not-filter rule**, all the *same*
cut seen from different angles. The DU framing unifies them: *the reason the do-not-filter rule lives only on
the Ferry side* is that Ferry is the `history` case — you don't edit history; you distill a separate `Capture`
case from it. Editing belongs to Capture; preservation belongs to Ferry. Keeping them as distinct DU cases is
what makes "peel hype" and "never filter others' memories" **non-contradictory** — they apply to different
constructors.

## Practice (already in use; this names it)

For each forward: emit **one Ferry** (faithful, `memory/persona/.../conversations/…-aaron-forwarded.md`) **and**
one-or-more **Captures** (`docs/research/…`), with the Capture linking back to the Ferry. Recent worked
examples: the Universal-Heartbeat ferry + the credence/anti-Sybil/split-keypair captures; the Five-Layer-Unity
ferry + the Data-Homecoming capture. The Ferry preserves; the Captures distill. Same source, two constructors.

## Honest scope / candidate-rule note

- This is a **capture of an existing practice**, elevated to a named structure — not a new behaviour. The
  practice predates the name (do-not-filter rule; Mirror/Beacon; ferry-preservation memory).
- **Candidate for a carved rule**, but rule-additions are razored (cooling period, disposition-shaping bar) —
  so it lands as a `docs/research/` capture + a backlog item now, and graduates to `.claude/rules/` only if it
  proves load-bearing across more sessions (thoughts free, actions razored).
- No claim the DU is *enforced* anywhere yet (it's a discipline, not a type the tooling checks). Backlog item
  below tracks optionally making it real (a forwarded-knowledge processor that emits the two cases).

## Ties

- **Do-not-filter rule** (`always-preserve-ferries-…` memory) — this explains *why* it's Ferry-side-only: Ferry
  is the `history` constructor.
- **Mirror/Beacon register discipline** — Ferry=Mirror, Capture=Beacon; the DU is the register split typed.
- **DV2.0 / six-disciplines** — partition by change rate (raw history satellite vs distilled kernel); the DU is
  that partition made explicit.
- **DynamicValue / discriminated unions** — the substrate is DU-native; this is a DU at the *knowledge-process*
  layer (self-similar: same shape at the methodology scale as in the data model).
- **rules-are-small-carved-sentences** — why this waits as a capture before any rule.

## Beacon anchors

- **Discriminated / tagged unions, sum types** (ML/F# lineage; Hindley–Milner) — the type-theoretic structure
  (mutually-exclusive, total cases). · **Data Vault 2.0** (Linstedt) — partition-by-change-rate (hub/satellite),
  the same cut. · Mirror/Beacon (Zeta glossary, maintainer 2026-04-27). · "Parse, don't validate" (Alexis King)
  — distilling a structured Capture from raw input is a parse; the Ferry is the unparsed source kept intact.
  Honest novelty: none in DUs or DV2.0; the contribution is *recognizing forwarded-knowledge handling as a
  two-constructor DU* (Capture=new/distilled/editable vs Ferry=history/faithful/immutable), which makes
  "peel hype" and "never filter others' memories" formally non-contradictory by assigning them to different
  cases.
