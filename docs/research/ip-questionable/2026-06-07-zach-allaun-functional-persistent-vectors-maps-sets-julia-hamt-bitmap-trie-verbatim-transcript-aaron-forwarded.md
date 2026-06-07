# Zach Allaun — "Functional Vectors, Maps, and Sets in Julia" (Strange Loop ~2014) — verbatim transcript (Aaron-forwarded)

**Source:** <https://www.youtube.com/watch?v=ZFiAPUkDb-o> (Zach Allaun; `functionalcollections.jl`).
**IP status:** auto-caption transcript of a third-party talk — DO NOT republish externally (see this
folder's README). Substrate value is the framework-composition analysis below.

> Aaron 2026-06-07: *"This is similar to us."*

## Framework-composition analysis (what this means for Zeta)

This talk is the **mechanism our COW store already relies on**, explained from first principles:
persistent (immutable, structurally-shared) collections via **bitmap tries**.

- **Persistent collections via bitmap vector tries / HAMT (Bagwell → Hickey/Clojure → Okasaki).** Update
  copies only the *path* to the changed element (O(log₃₂ n) ≈ constant), and old versions persist sharing
  the rest of the structure. **This IS our copy-on-write property.** `ContentStore`/`DagFs` use
  `ImmutableDictionary` — a **HAMT** — so each `put`/`link` shares structure with the prior version → the
  "cheap branches / old roots persist" we claim is exactly this. The talk explains the internals
  (`ImmutableDictionary` under the hood = the sparse bitmap trie + popcount trick described here).
- **Bitmap vector trie** — branching factor **32**, path-copy on update, **tail optimization** for fast
  append (touch the trie only 1-in-32 appends). If we ever build our *own* persistent vector for the store
  (instead of BCL `ImmutableArray`/`ImmutableDictionary`), this is the blueprint. Our `ZSet` already uses
  the "mutable array internally, immutable value externally" pattern the talk closes on.
- **HAMT popcount/bitcount trick** — a bitmap marks which child slots are populated; mask-high-bits +
  `popcount` gives the compact slot index, so the node stores no empty slots. The standard efficient
  persistent-map representation — what we get for free from `ImmutableDictionary`, and what we'd implement
  if porting the store to Rust/TS (where we'd want `im`/HAMT crates or a hand-rolled trie).
- **RRB-trees (Bagwell & Rompf, 2011 — "relaxed radix balanced")** — give **O(log n) concatenation** for
  persistent vectors (plain bitmap tries are O(n) concat). **A real design lead for us:** merging /
  concatenating Z-set runs and branch-merge in the COW store want efficient concat; RRB-trees are the
  technique. Filed as a watch item for the store's merge path.
- **"Functional abstractions in a mutable world"** — build immutable/persistent structures over mutable
  arrays internally (exactly `ZSet`'s `ImmutableArray` sorted-run + pooled workspaces).

Net: this is the prior-art **foundation under `ContentStore`/`DagFs`/`ZSet`** — the persistent-collection
lineage (Bagwell/Hickey/Okasaki) that makes our COW + structural-sharing claims real, plus RRB-trees as the
upgrade path for efficient branch/concat. Anchor it; we are squarely in this tradition.

## Beacon anchors

- **Phil Bagwell** — *Ideal Hash Trees* / Array Mapped Trie (2000–2001); **RRB-Trees** (Bagwell & Rompf,
  2011). · **Rich Hickey** — Clojure persistent vectors/maps/sets (bitmap vector trie, branching 32). ·
  **Chris Okasaki** — *Purely Functional Data Structures* (1998). · **Scala** `immutable` collections;
  **Clojure**. · **Zach Allaun** — `functionalcollections.jl` (the talk). Ties: `ContentStore`/`DagFs`
  (`ImmutableDictionary` = HAMT), `ZSet` (`ImmutableArray` sorted run), the COW store `081KTGTJC1Q`, and
  the Jumprope CAS note (`2026-06-07-jumprope-vokes-...`). Already partially in `PRIOR-ART-LIST` (Bagwell/
  Okasaki via ClojureScript persistent DS); this promotes persistent-collections to a named anchor.

---

## Verbatim transcript (lightly cleaned from auto-captions; Aaron-forwarded 2026-06-07)

Today I'll talk about functional data structures in Julia — I use Julia for the code samples and that's
where I did the work, but the ideas are more general and you could implement this in another language.

**Julia.** MATLAB-like syntax, poised for technical computing but more general. Dynamic but fast (nice JIT).
Julia has types — pedantically, *run-time type tags*, not compile-time types; used for performance and
expressiveness, not safety/correctness as in Haskell. The primary unit of abstraction is the **generic
function** — a first-class function that dispatches to an implementation based on the types of *all* its
arguments; used pervasively to extend your own types to built-in functionality.

Generic-function example: an abstract `BinaryTree` with concrete `Node` (immutable: `data`, `left`, `right`,
each a `BinaryTree`) and `Leaf` (just `data`). `3 in tree` parses to `Base.in(3, tree)`; implement `in` for
`Leaf` (compare data) and `Node` (check node's data, else recurse left/right). So generic functions extend
our types to the language's syntax.

**Functional programming / functional data structures.** Punting on a precise definition: FP encourages
programming with *immutable values*, not mutable objects. Changing a structure shouldn't mutate it — it
returns a *new* value and leaves the old one unmodified (**persistent**: old versions stay around, multiple
versions of the same thing). They should be fast, with the same (or roughly the same) complexity as their
mutable counterparts.

Julia's built-in non-functional structures: `Vector` (1-indexed!), `push!` mutates (length increases);
`Dict` (maps); `Set` (`push!` mutates; the `!` is the Julia idiom for a mutating op). What we want is
*persistent*: pushing returns a *new* vector while the original's length is unchanged; associating a new
key returns a new map while the old lacks the key; same for sets.

**Linked list — "embarrassingly persistent."** `x` points to a tail; `y = cons(e, x)`; `z = cons(e', rest
x)`. All three share structure — which we want in persistent structures both for **space** (no two full
copies) and **compute** efficiency (don't copy every element just because it's immutable).

**Bitmap vector trie (Bagwell 2000: Array Mapped Trie + Hash Array Mapped Trie; Rich Hickey adapted these
for Clojure's "bitmap vector trie"; also Scala's `immutable`).** A *trie* = a tree where data is in the
leaves and the path down encodes the index. We use *bitwise* tries: nodes peek at certain bits of the index
to lead to the element — a random-access array-like structure.

**Persistent vector.** An array of a fixed number of elements; each element is another same-size array, …,
down to real data at the leaves (dense). Data types: `ArrayNode` (internal `Vector` of `BitmapTrie`, a
`shift`, a `length` = number of elements in its leaves, a `maxLength`); `ArrayLeaf` (internal `Vector`).
*Access* index 106: view it in binary; each level peeks at a slice of bits (top 2, middle-left, middle-
right, bottom) — `shift right` then `bitwise-and 3` to mask (4 children per node = 2 bits). `getindex`:
leaf indexes its internal array at the masked view; node masks + recurses. *Associate* (update an existing
index): copy only the *path* down (share left/right siblings), replace the leaf — a 256-element structure
needs copying only ~16 things. *Push* (grow): cases — push into a non-full leaf (copy + add); full leaf →
new parent `ArrayNode` pointing at old leaf + new child; right-most child has room → copy path + add; node
full → new parent. Nodes know how to construct children/parents and look at themselves + children to decide
direct-insert vs promotion.

**The tail optimization.** The `PersistentVector` has `{ trie, tail: Vector, length }`. Instead of
appending data directly to the trie, append *full length-N vectors* in the leaves and keep a fast `tail` at
the top. Appending to the back (common) touches the trie only 1-in-N appends; otherwise add to the tail
(fast copy) — about **5× slower** than `push!` on a regular array, quite fast. Branching factor: Bagwell's
graph shows a trade-off (small nodes → faster update/less copy, slower index; large → faster index, slower
update); **32** is a good balance (16 maybe slightly better). Further reading: **RRB-trees (2011)** —
relaxed radix balanced — give **O(log n) concatenation** (vs O(n)); small index/update trade-off, and a
Clojure implementation delays promotion to the relaxed form until concat actually happens.

**Persistent hash map.** Hash tables are built on array-like things → reuse the trie. Mutable maps start at
a fixed size, insert by low bits, handle collisions, resize (~⅔ full, amortized). The persistent map avoids
resizing: it's a trie where each node can hold data *or* sub-tries; on collision, copy the root and push a
sub-trie indexed by the next bits. Updating a value copies the path; background pointers stay intact
(immutable). To avoid empty slots wasting memory: add a **bitmap** per node (bit i on ⇒ slot i populated);
to access, check the bit is on, then mask high bits + **bitcount/popcount** (fast on modern CPUs) to get
the *true* compact index. This collapses the structure — no empty spaces. Types: `HashMapEntry { hash,
key, value }`, `SparseArrayNode { internal Vector of (sub-tries | entries), shift, length, maxLength,
bitmap }`. Deletions are *simpler* than mutable (no probe-jumping to preserve, so just remove); true hash
collisions handled by a collision-node with slower key comparison.

**Persistent set** — "a bit of a lie": it's just a hash map with `nil` values + the set operations. You get
the third structure nearly for free.

**Performance.** Lookups O(log₃₂ n) — for n ≈ 4 billion that's 6 → effectively constant (large branching
factor; ~14 bit-ops + 7 derefs for 7 levels). Updates a bit slower (copy the path) — even a billion-element
vector copies only a couple hundred elements; small price for immutability.

**Conclusions.** Julia is good for these (expressive type tags + generic functions make extending types
easy). You get a lot from one fundamental structure (the bitmap vector trie → small modification → hash map
→ set). Worth building functional abstractions in a "mutable world" — using underlying mutable arrays to
make a nice functional abstraction. More complete implementation: `zachallaun/FunctionalCollections.jl`.
