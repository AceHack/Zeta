# Stored-procs: native vs interpreted (differential-tested) + the forced-RX nature

**Aaron, 2026-06-08 (#7049/#7050).** Two linked things: a built pattern, and the delight that the
architecture *forces* reactivity.

## 1. Native vs interpreted stored-procs, differential-tested (#7049, built)

> "anywhere we have interfaces and nouns we should implement the verb-noun with plugins and DynamicValue /
> SoftValue / yin-yang stored procs; we just need to per-test the F#-native versions vs our interpreted."

Every noun-class op gets **two** implementations, and a test asserts they agree:

- **native** — the F# fold (`TableStream.applyDelta`, …) — fast, the oracle.
- **interpreted** — the op as a homoiconic **stored-proc** (`DynamicValue`, #7041) run by an *independent*
  interpreter (the yin/yang stored proc, #7046/#7048) — pluggable, serializable, ship-anywhere.
- **differential test** — `native ≡ interpreted` for the same input (a cross-check oracle, BP-16: two
  implementations that must agree, so a bug in either is caught).

Built (`src/Core/StoredProc.fs`, reference instance for `table`, 4/4 tests green, 0-warning):
`encodeDelta`/`decodeDelta` (homoiconic `DynamicValue.Object` ⇄ `Delta`, round-trips) + `interpretApply`
(a genuinely separate code path: reads the `DynamicValue` fields and mutates the `Table` directly, no
`Delta` round-trip). The **DIFFERENTIAL** test runs every op across several tables and asserts
`applyDelta t d == interpretApply t (encodeDelta d)`. Malformed procs / unknown ops → explicit `Error`
(no silent failure). Generalizes to `db`/`file`/`catalog` — the per-test discipline is the deliverable.

## 2. The forced-RX nature (#7050) — "I love this forced nature"

> "the yin/yang version is fun — you only get observable over streams basically, because of Bonsai, so
> everything HAS to be RX. I love this forced nature. It makes parallelism easy, and banana-split a
> survival imperative. Algebras should be easy too."

The yin/yang stored proc, executed through **Bonsai** (the in-repo incremental/reactive engine), means
**state is only observable over streams** — there's no non-reactive read escape hatch. So **everything is
forced to be RX** (`Rx.fs`): you don't *read* state, you *observe* the stream (#6997 everything-is-events,
now as the observation API). Aaron's joy is in the forcing function — the architecture won't *let* you be
non-reactive.

Consequences he names:

- **Parallelism is easy.** Observe-over-streams + idempotent/commutative folds (CRDT/symmetric #7048) means
  work parallelizes with no special cases (scale-free §1, DoP-knob ferry): a commutative fold over a
  stream runs at DoP=1 deterministically or DoP=N concurrently, same code path.
- **Banana-split is a survival imperative.** "Bananas" = **catamorphisms / folds** (Meijer et al.,
  *Bananas, Lenses, Envelopes & Barbed Wire*, 1991 — banana brackets `⦇ ⦈` = fold). When the only way to
  observe is to fold a stream, you *must* express computation as a fold (a banana) — it's not optional, it's
  how you survive in a stream-only world. (Ties Aaron's earlier 4-tree "banana split" universal
  representation: decompose-to-fold-over-a-tree.)
- **Algebras are easy.** A fold needs an **algebra** (the carrier + combine op — semiring/monoid/
  semilattice, the `Algebra.fs`/`Semiring.fs` floor). Because everything is a stream-fold, the algebra is
  the *natural* unit: you bring a (zero, combine) and the stream-fold does the rest. Idempotent/commutative
  algebras (the symmetric form #7048) are exactly the ones that parallelize — so "easy parallelism" and
  "easy algebras" are the same fact.

So the chain: **yin/yang + Bonsai ⇒ observe-only-over-streams ⇒ forced RX ⇒ fold-everything (bananas) ⇒
algebras are the natural unit ⇒ commutative algebras parallelize for free.** The constraint *is* the
feature.

## Honest scope (peel)

`StoredProc` (#7049) is built + differential-tested for `table` (db/file/catalog follow the same pattern).
The forced-RX section (#7050) is an **observation** about the existing substrate (Bonsai + Rx + yin/yang +
the algebra floor) — no code; it names why the architecture forces reactivity and how that makes
parallelism/algebras easy. No claim that the stored-procs run *through Bonsai* yet — wiring the interpreted
stored-proc into Bonsai's reactive loop (so it's observed-over-streams in practice) is the named next step.

## Anchors (Beacon)

- **Recursion schemes / catamorphisms ("bananas")** — Meijer, Fokkinga & Paterson 1991; folds as the
  universal stream consumer.
- **F-algebras / fold algebras** — `Algebra.fs`, `Semiring.fs`, monoid/semilattice (the carrier+combine).
- **Reactive / incremental computation** — Bonsai (`Bonsai.fs`, in-repo), Rx (`Rx.fs`); observe-over-streams.
- **Differential / cross-check testing** — BP-16; property-based + two-implementation agreement.
- Internal: #7041 (DynamicValue homoiconic), #7046/#7048 (yin/yang stored proc; symmetric/CRDT form),
  #6997 (everything-is-events), #7029 (table/stream fold), manifesto §1 scale-free (DoP-knob ferry),
  idempotency #6.
