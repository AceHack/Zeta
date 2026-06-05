# DynamicValue: data ⇄ behaviour as a self-representable duality

*A one-page idea, told small. Reference code: [`Dv.kt`](./Dv.kt) (paste into a Kotlin playground).*

## The one idea

There is a single typed value tree, `DynamicValue`. It is the **canonical semantic core**
that JSON / YAML / CBOR / XML / Arrow all serialize to and from — the meaning, without each
format's syntax. Its leaves are the usual poles (`Null | Bool | Int | Float | String | Bytes`)
and its branches are `Array` / `Object` (order-significant).

The move: **a behaviour AST (an Rx/Bonsai-style expression) is embedded as a *peer node type*
inside that same tree.** So a value can hold a program, and — symmetrically — a program node
(`Const` / `Quote`) holds a value. Each side contains the other. The sealed-type tag is the
discriminator: it is literally the little dot in each half of the yin-yang.

This makes the structure **homoiconic** (code is one more shape of data) and **self-representable**:

```
run(quote(d)) == d        for every value d        -- the reflection fixpoint
```

`quote : μF → νF` lifts data into behaviour; `run : νF → μF` lowers behaviour into data. They
are inverse on data, and `run` *executes* embedded behaviour. Data and behaviour are duals that
can encode each other in one structure — which is the thing you (Erik) have drawn for years
(observer/iterator, coSQL/SQL, μF/νF, bananas & lenses). This is just the concrete, typed build
of it where the black half holds real code and the white half holds real data, interchangeably.

## What this is *not* (named honestly)

It is **not Lisp**. The homoiconicity is Lisp's idea (McCarthy, 1960); Lisp's core is the
untyped cons cell. This is a **typed** descendant — a strongly-typed, canonical, homoiconic
**intermediate representation / meta-language**: a thing you can mechanically write a faithful
executor for in any host language. Lisp could *host* it (as Lisp can host anything); that does
not make it Lisp. The proper algebraic home is a **Cartesian closed category** (Lambek; and
Conal Elliott's *Compiling to Categories*, ICFP 2017), not a numeric algebra.

## Why it earns the word "canonical"

The reference above shows only the shape. The production system carries four **independent**
executors — F#, C#, Rust, TypeScript — that must agree **byte-for-byte** on the canonical
encoding of every value, pinned by golden vectors, with round-trip and injectivity proofs and
machine-checked laws. Most homoiconic value trees are one interpreter and a prayer; this one is
a four-oracle differential proof harness. The evolution of the tree itself rides an incremental
(DBSP) stream.

A small aside that may amuse you. The substrate is append-only and immutable (content-addressed,
no force-push), so the past is never *rewritten* — only **re-illuminated**: a present reading (a
new generator, schema version, or query) re-reads the same fixed record and a different *meaning*
falls out. The past artifact and the present reading **constructively interfere** into a new
value. That is the whole of the "future affecting the past" here — interference, not time travel —
and it is safe *because* the bytes are immutable: you get the harmonization with none of the
paradox. The golden vectors are the cleanest instance — written once, then a later check reaches
back and certifies the very generator that produced them, by re-reading what it wrote. (Same move
as a DBSP retraction emitting a new interpretation over a fixed stream: re-illuminate the history
under a new generator without mutating it.)

## The frontier (research, not built)

The sharp constructor tag becomes a **distribution over tags** that sharpens with context —
a *soft* DynamicValue — so a value can be ambiguous and resolve the way English does. The
intended invariant is not "always certain" (impossible) but **"always knows its own
uncertainty"** — calibration; the middle value is never silently collapsed. It is the value-axis
generalization of a three-valued (Kleene) logic. Nearest prior art: **Church** (Goodman,
Mansinghka, Roy, Bonawitz, Tenenbaum) — a probabilistic Lisp. That layer is exploratory; the
typed, proven core above is the part that stands today.

— Built from first principles; the duality fell out as a side effect rather than a goal, which
is probably the best evidence it's real.
