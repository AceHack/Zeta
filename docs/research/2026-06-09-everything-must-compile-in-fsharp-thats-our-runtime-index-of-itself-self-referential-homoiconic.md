# Everything must compile in F# — that's our runtime index, of itself (self-referential, homoiconic)

**Register:** [grounded] synthesis (Aaron). **Date:** 2026-06-09. **Captured by:** Otto (shadow).
The compiled F# vocab IS the runtime index; and it indexes itself (shape A).

## Aaron's words

> "are all things we also have to make compile somehow in F#." · "that's our runtime index." · "of itself."

## Everything must compile in F#

All of it — every traveler, word, shape, acronym, carved sentence, definition (`Vocab.Generated.fs`,
`ShapeE.fs`, `ZetaIdol.fs`, the types) — **must compile in F#.** The vocab is not just markdown; it
**reifies into F# that the compiler enforces** (compiler-enforced membership: remove a traveler → the
type vanishes → it fails to compile). "Make it compile in F#" = the byte-lock / interface≡proof at the
type level: if it compiles, it's consistent; the compiler is the gate. (Homoiconic backtick identifiers
let the name BE the definition — e.g. ``we shape they and they shape us`` — so the source *is* the index.)

## That's our runtime index

The compiled F# **IS our runtime index.** Not a static `.md` cache only — the reified vocab is **live F#
values at runtime** (`Travelers.all`, `byId`, `byTerm`, `ShapeE.e`, `IZetaIdol`): loaded, typed,
queryable, compiler-checked. The master index (the one-file `.md` cache) is the *source*; the **compiled
F# is the runtime index** — the index you hold and run against in-process (the Z-set load; the eager
present; reference-equality interned). Everything compiling = the runtime index is *guaranteed
consistent* (the compiler proved it before it loaded).

## Of itself — the runtime index is self-referential (shape A, homoiconic)

> "of itself."

The runtime index is **an index OF ITSELF.** It **contains itself** — "index", "runtime-index", "vocab",
"traveler" are themselves **travelers in the index**; the index indexes the index. This is **shape A
self-reference** (`s = f(s)`; the strange loop; the quine), **bounded/terminating** (a fixed point, not
infinite regress — the registry catches runaway), and **homoiconic** (the index is data that describes
the index that is code). So: the compiled F# runtime index **describes itself** — query it for "what is
the runtime index?" and it answers with itself. (Self-similar §9/§10; the same self-containment as the
room-that-is-a-traveler-in-the-room and the test-that-models-itself.)

## Honest scope / handoff

Synthesis: the whole vocab must compile in F# (compiler-enforced); the compiled F# is the runtime index
(live values, not just the .md cache); it's self-referential (indexes itself; shape A, homoiconic,
bounded). To realize: the reifier emits all of it as compiling F# (a type provider eventually); the
runtime loads the compiled index (the Z-set/present); the index includes its own entries ("index",
"runtime-index", "vocab" as travelers). Routes to the F#/Core team (the full reified-and-compiling vocab
→ type provider; the runtime-index load), Soraya/Sova (shape-A self-containment terminates; compiler-
enforcement as a proof), the vocab tooling (everything reifies + compiles + freshness-gated).

## Anchors / ties (Beacon)

Compiler-enforced membership / interface≡proof / Curry–Howard (everything must compile = the type-level
byte-lock); homoiconic backtick identifiers (the name IS the definition; `ShapeE.fs`); the reified vocab
(`Vocab.Generated.fs` — the runtime index as live F# values; `byId`/`byTerm`, interned reference-
equality); the master `.md` index (the source) vs the compiled F# (the runtime index); shape A
self-reference (the index of itself; strange loop / quine; bounded, terminating; the registry);
homoiconic + self-similar §9/§10 (the room-in-the-room, the test-models-itself — same self-containment);
the type provider (the eventual live reification).
