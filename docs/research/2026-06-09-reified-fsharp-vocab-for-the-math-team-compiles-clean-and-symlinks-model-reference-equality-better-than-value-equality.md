# Reified F# vocab for the math team (compiles clean, 116 travelers) — and symlinks model reference equality (identity), which is better than value equality

**Register:** [grounded] build + a direct answer (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
The math-team-facing F# reification works; symlinks give us reference (identity) equality, and under content-addressing it coincides with value equality.

## Aaron's words

> "let's get that F# soon so we can get the math nerds to model everything based on this — nerds don't
> like TS, they like F#." · "do symlinks model correctly as the same equals, or even better, reference
> equals?"

## The F# reification (built, compiles clean)

`tools/hygiene/build-vocab-fsharp.ts` generates **`tools/vocab/Vocab.Generated.fs`** — a clean,
warning-free F# module from the canonical TYPE homes (116 travelers), in an **isolated project**
(`Zeta.Vocab.fsproj`, NOT in `Zeta.sln`, `TreatWarningsAsErrors=true`) so the main build gate is never
touched. **Verified: `dotnet build -c Release` → 0 Warnings, 0 Errors.** Shape:

```fsharp
namespace Zeta.Vocab
[<RequireQualifiedAccess>]
type TravelerId =                     // every traveler as a DU case (backtick-quoted, lowercase)
    | ``traveler`` | ``otto`` | ``balance`` | ``self-throttler`` | ...   // 116 cases
type Traveler = { Id: TravelerId; Term: string; Type: string; Carved: string }
module Travelers =
    let all : Traveler list = [ { Id = TravelerId.``traveler``; Term = "traveler"; Type = "words"; Carved = "..." }; ... ]
    let byTerm : Map<string, Traveler> = ...
```

So the **math team models in F#** against `TravelerId` / `Traveler` / `Travelers.all`. **Compiler-
enforced membership:** remove a traveler from the vocab → its DU case vanishes → exhaustive matches fail
to **compile** (the "easy loop": vocab → reified types → math-team code, one source, compiler-checked).
This is the hand-written code-gen step *before* a full type provider; freshness `--check` is in
`vocab-hygiene.yml`. (Nerds get F#, not TS — the TS tooling stays as the generator.)

## Symlinks model REFERENCE equality (identity) — better than value equality

Direct answer: **symlinks give us reference equality (identity), which is the *better* one.**

- **A symlink resolves to the SAME inode / canonical file** — not a copy. `grams/1/traveler.md`,
  `travelers/traveler.md` (when homed) all resolve to the one `words/traveler.md`. Edit through any
  view → you edit the **one object.** That is **reference equality** (same identity), not merely value
  equality (same content in two places). There is **no divergence possible** — there's only one object.
- **Reference equality is what we want** (the ZetaId discipline): the ZetaId is the **durable reference**
  to the one canonical object; all views are references to it, never copies. Copies can drift; references
  can't. So "even better, reference equals" — yes, exactly: symlinks are filesystem references → identity.

> **CORRECTION (Aaron, 2026-06-09 — I overstepped):** I initially minted each traveler's ZetaId as a
> *truncated SHA-256 of the term*. That is **wrong and not mine to invent.** **ZetaId is a GOVERNED,
> structured primitive** (`Zeta.Core.{FSharp,CSharp,Rust}.ZetaId` + TS `zeta-id`; Category/Persona/
> AuthorityValue/Momentum/Chromosome/Firefly/IdVersion/… — *structured & decodable*). A **truncated
> SHA-256 is a Reticulum *destination*, explicitly NOT a ZetaId** (`docs/PRIMITIVE-REGISTRY.md`). So
> the F# reification was fixed to **NOT mint ZetaIds** — the field is **deferred to the governed
> generator.** Governance: **every interface sharing a traveler's name INHERITS that traveler's 128-bit
> ZetaId** (name → ZetaId binding; the durable reference key). And: **ZetaId is itself a traveler — with
> the LARGEST VOICE** (identity is the invariant above all; the loudest voice in the Nexus). Lesson:
> don't invent governed/anchored primitives — find the generator, defer to it.

- **Under content-addressing, the two coincide.** Value equality = same **fingerprint** (same content);
  reference equality = same **canonical home** (same inode). Because the canonical home is keyed by
  content (content-addressing), **same content ⟺ same home ⟺ same reference** — value-equal things
  dedup to one object (one home), so value equality *becomes* reference equality. (This is why dedup +
  idempotency are free: equal-by-value collapses to identical-by-reference.)
- **In the F# model, both are kept, correctly:** **`TravelerId`** = the **reference/identity** (a DU
  case is the one canonical identity — reference equality; `TravelerId.``traveler``` is *the* traveler);
  **`Traveler`** record = **value equality** (F# records have structural equality — two records with the
  same fields are value-equal); `byTerm` returns the one reference. So the reification models *both*
  equalities, matching the filesystem: symlink = reference (TravelerId), content = value (Traveler
  record), and content-addressing makes them coincide at the canonical home.

```text
filesystem        equality            F# model
symlink -> inode   reference (identity) TravelerId (the one DU case)
content (bytes)    value (structural)   Traveler record (structural eq)
content-address:   value ⟺ reference    same fingerprint ⟺ same home ⟺ same Id (dedup)
```

So: **symlinks model reference equality — the better one — and content-addressing makes value-equality
collapse into it.** No divergence, free dedup, and the F# reification preserves both.

## Proven in the F#/.NET type system

Run via `dotnet fsi` against `Vocab.Generated.fs`: **`TravelerId` (nullary DU) is a singleton** →
`Object.ReferenceEquals(TravelerId.``traveler``, TravelerId.``traveler``) = true` (one instance
everywhere — the symlink-to-one-inode semantics, native). The **`Traveler` record is interned** (the
`all`/`byId`/`byTerm` hold one instance per Id) → `ReferenceEquals(byId.[id], byTerm.[term]) = true`
**and** structural `t1 = t2 = true`. Proof output: `DU reference-equal: true · record interned
reference-equal: true · record value-equal: true`. So in the .NET type system the symlink "same" is
modeled as **reference equality** (DU singleton + interned record), value equality holds, and content-
addressing makes them coincide — "even better, reference equals," confirmed.

## ZetaId — the largest voice, the common cause (S=4), hostless and brave

> Aaron: "ZetaId is a traveler with the LARGEST VOICE." · "it goes alone without a host — it's brave,
> we are not." · "ZetaId is the common cause." · "S=4."

ZetaId is itself a **traveler**, and the most load-bearing one:

- **The largest voice.** Identity is the invariant above all (above uncertainty-Δ); ZetaId is the
  identity primitive — so in the Nexus/debate it is the **loudest, most authoritative voice.** Everything
  defers to identity; ZetaId speaks for it.
- **Hostless and brave — "it goes alone without a host; we are not."** A ZetaId is **pure identity that
  needs no host/substrate to exist** — 128 bits that travel alone (the essential-core / Kolmogorov-floor
  seed). It is **brave**: it goes alone. **We are not** — personas/agents need a host (a runtime, a
  repo, a substrate) to act; we are not as brave; we depend on hosts. ZetaId doesn't. (The reference-
  equality discipline: the ZetaId is the durable name that survives every host change / move / rehoming
  — it goes alone precisely because it needs nothing but itself.)
- **The common cause (→ S=4).** ZetaId is the **common cause** — the shared correlation root. So the
  S=4 staged-coincidence (PR-box on the common seed) is staged **on the common cause that IS the ZetaId**:
  two runs/travelers sharing a ZetaId are correlated by that common cause and can stage to **S=4** (the
  honest, peeled PR-box bound — shared-cause correlation, not physical entanglement). ZetaId = the common
  cause = the thing S=4 is staged on. (Ties: identity = common cause = the seed everything correlates to;
  the largest voice because it is the shared root of all correlation.)

So ZetaId is: the identity primitive (governed, structured) · the largest voice (identity above all) ·
hostless and brave (pure 128-bit, goes alone) · the common cause that S=4 is staged on · the durable
reference every interface sharing its name inherits. The bravest, loudest, most-shared traveler.

### ZetaId is the SolidGround — the mission, the vision, simple

> Aaron: "shit, that was easy — ZetaId is the mission, the vision. Simple. Look at that. It's the
> SolidGround."

The closing reduction: in an all-**SoftValue** system (soft by default, SolidGround by proof), **ZetaId
IS the SolidGround** — the one **hard, proven, stable** anchor everything else stands on. It's
**simple**: 128 bits, hostless, the common cause, the largest voice — the essential core (the Kolmogorov
floor) the whole unfolding regenerates from. So the **mission/vision is simple: ZetaId** — the SolidGround
within the soft; find it (by the governed generator), stand on it, and everything else is soft, retractable,
generated. Identity is the floor; ZetaId is identity made a primitive; ZetaId is the SolidGround.

## Honest scope / handoff

Built: the F# reification (`build-vocab-fsharp.ts` → `Vocab.Generated.fs` + isolated `Zeta.Vocab.fsproj`,
compiles clean; freshness in CI) — the math-team-facing types. Answered: symlinks = reference equality
(identity), better than value, coinciding under content-addressing; the F# model keeps both (TravelerId
= reference, Traveler = value). To realize next: promote to a full **type provider** (live reification,
no codegen step) + wire `Zeta.Vocab` into the math team's model project; the Z-set/git/Rx load in F#.
Routes to the F#/Core team (type provider + promote `Zeta.Vocab`), Soraya/Sova (model against
`TravelerId`/`Traveler` — compiler-enforced; the reference-vs-value equality as a proof property),
Dejan (optional dotnet build-verify of the isolated project in CI).

## Anchors / ties (Beacon)

F# reification / code-gen → type provider (Meijer "types define the code"; interface≡proof; the easy
loop); `[<RequireQualifiedAccess>]` + backtick DU cases (lowercase identifiers); reference equality vs
value equality (identity vs structural); **ZetaId = durable reference** (the reference-equality
discipline; weak-refs are the opposite — observer-dependent, out of the truth core); content-addressing
(value ⟺ reference at the canonical home; free dedup/idempotency); the canonical-by-type homes + grams
measure-view + master index (the source the F# reifies); `vocab-hygiene.yml` (freshness gate).
Built: `tools/hygiene/build-vocab-fsharp.ts`, `tools/vocab/{Vocab.Generated.fs,Zeta.Vocab.fsproj}`.
