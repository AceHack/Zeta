# Scott Vokes — "Data Structures: The Code That Isn't There" (Strange Loop 2012) — slide capture + analysis (Aaron-forwarded)

**Ferried:** 2026-08-01 by Aaron — *"I found the holes data structure in this talk … this is the one
I was talking about and also content based addressing this guy is smart as hell."*
**Source:** `StrangeLoo2012-ScottVokes-DataStructuresTheCodeThatIsntThere.pdf` (52.6 MB, slide deck) ·
video: infoq.com/presentations/Data-Structures
**Capture basis:** slides read directly from the PDF (pages 1–20, 33–48, 49–60). Slide text is
transcribed verbatim; section ordering preserved. Not a talk transcript — the deck is sparse and
the spoken narration is not captured here.

---

## 0. Why this one matters — it names the thing

Two days of work in this repo converged on "data structures with holes." This talk **names them
and gives them a mechanism**, and it is the source Aaron was reaching for. It also carries the
content-addressing lineage he flagged. Both are directly load-bearing for `zetadb`/`zetafs`.

---

## 1. The thesis, in two borrowed quotes

> **"A data structure is just a stupid programming language."** — Ralph William Gosper Jr.

Vokes immediately amends it on the next slide (strikethrough in the original):

> "A data structure is just a ~~stupid programming language~~ **tiny virtual machine**."

And the title's source:

> **"The cheapest, fastest, and most reliable components are those that aren't there."**
> — Gordon Bell

Then the consequences, one per slide:

- data structures **"...set the path of least resistance."**
- **"implementation details bubble up to the surface"** — his examples: `git` vs `hg`, internal
  data formats, and Ruby's `require` circa 1.9.2 using a list where it wanted a set.

That last example is the whole argument in miniature: a wrong container is not a local
inefficiency, it is a *language* everyone downstream must speak.

---

## 2. Skiplists (the warm-up)

Ordered linked list → add an "express lane" → add another. The stacked-lane diagram is
isomorphic to a balanced binary tree, but **balanced probabilistically rather than by
rotation** — "but, how do we balance that?" is the slide that sets up coin-flip level
assignment. Included here for completeness; nothing in it is new to this repo.

---

## 3. **Difference lists — "data structures with 'holes' in them"** ← the one Aaron meant

Slide sequence, verbatim:

- `?- uses(prolog, Person).` → `no`
- **"retroactive immutability!"**
- Unification: `?- [X, Y, X] = [1, 2, Z].` → `X=1, Y=2, Z=1`, `yes`
- **"data structures with 'holes' in them"**
- **"logic variables: explicitly modeling partial information"**
- Unification with an unbound tail: `?- [X, Y, H] = [1, 2, Z].` → `Z = H ← ???`
- **"constant-time append to an immutable list"**
- The diagram: `1 → 2 → ⊚` **+** `3 → ⊚` collapses to `1 → 2 → 3 → ⊚`
  (the blue ⊚ is drawn as a *portal*, not a null)
- `?- A = [1,2|B], B = [3|C].` → `A = [1, 2, 3|C]`, `yes`
- **"still immutable … just unstuck in time"**
- **"more fundamental than lazy evaluation or lazy streams (a bit closer to futures/promises)"**
- **"...apply to more than just lists — difference trees? difference dictionaries?"**

### What this actually is

A difference list is a list whose tail is an **unbound logic variable** — a hole with a known
shape and a known position. Because the hole is a variable rather than a terminator, appending is
*binding the hole*, which is **O(1)** and requires no copying. The structure was already handed
out; binding updates it for every holder at once.

"Retroactive immutability" is his phrase and it is exact: nothing is ever mutated, yet the value a
holder sees becomes more defined over time. **Immutable, but not yet finished.**

### Why this is a better model of the template than the buffer was

Today's `hypothesis-in-template-form` research reached for **Bε-tree/hitchhiker buffers** as the
mechanical form of a slot. That analogy holds, but the difference list is closer:

| | buffer (Bε-tree) | **hole (difference list)** |
|---|---|---|
| what occupies the slot | pending *operations* awaiting flush | **nothing** — an unbound variable |
| cost of the slot | real storage, must be drained | **free**; it is an absence with a name |
| who may fill it | the owner, on flush | **anyone holding the reference**, by unification |
| effect on existing holders | none until flush reaches them | **immediate and shared** — one binding, all see it |
| Gordon Bell test | the buffer *is* there | **it isn't there** — which is the point |

The template is not a buffer holding placeholder content. It is an **unbound variable with a
declared shape**, and instantiation is *unification*, not a write. That reframing is what makes
"a template should be data, not machinery" precise rather than stylistic: a logic variable is the
minimal data form of a hole.

It also lands squarely on Demaine's retroactivity (anchored earlier today): binding a hole is
**not** replay-from-a-branch-point, it is a change whose effect appears at every existing
reference without recomputation. "Unstuck in time" is retroactivity from the *value's* side.

---

## 4. Rolling hash → content-based addressing

Slide sequence:

- "find matching/overlapping sequences in binary data"
- "hash everything against everything? **md5, sha1, etc. are too slow**"
- **"Fast, Cheap, and Able to Roll"**
- The sliding-window table: `The_quick_brow → 0xba5eba11`, `he_quick_brown → 0x0b5e55ed`,
  `e_quick_brown_ → 0xdeadbeef`, … (one shift per row)
- **"fill the window buffer, then: drop 1, take 1, new hash. repeat"** — O(1) per byte
- **rsync**: "sync data across slow network", "minimize passes & bandwidth"
- "just send the hash for each block, eh?" → **"not so fast: inserts/deletes shift each block!"**
  (the S/D diagram showing block misalignment after an insert)
- **"Match with a rolling hash, then sha1"** — cheap filter first, cryptographic confirm second
- "request unmatched regions"
- Reference: **Andrew Tridgell's thesis, *Efficient Algorithms for Sorting and Synchronization*,
  p. 64**
- **"can also be used for chunking data"** ← content-defined chunking

### The load-bearing detail for us

The insert-shift problem is the reason **fixed-size blocks fail** for a content-addressed store: a
one-byte insertion at the front re-aligns every subsequent block and invalidates every hash.
Content-*defined* chunking cuts on a property **of the content** (rolling hash hits a boundary
pattern), so a local edit perturbs only local chunks. That is the difference between a store where
a small edit costs a small delta and one where it costs a full rewrite.

The two-stage discipline is also worth carrying: **cheap rolling filter, then cryptographic
confirm.** The rolling hash is not a security primitive and must never be treated as one — it is a
candidate generator whose false positives sha-confirm rejects. Conflating the two would be exactly
the "detection is not a verdict" failure in a different register.

---

## 5. Framework composition — what this means for Zeta

**Directly applicable, not analogy:**

1. **Content-defined chunking for `zetafs`/`zetadb`.** The COW store already anchors Hitchhiker
   trees (sorted index), HAMT (keyed), Jumprope (blobs) in `docs/PRIOR-ART-LIST.md`. Rolling-hash
   CDC is the *blob-boundary* half and the reason a git-overlay can diff large files cheaply.
   Tridgell's thesis is the citation to add.
2. **Difference lists as the shape for open slots.** Where a structure must be published before it
   is complete — a spec with an unresolved section, a claim awaiting a specialist's ruling, a
   round whose result is not yet known — the honest encoding is an unbound hole, not a placeholder
   value. A placeholder value is a claim; a hole is an absence with a name.
3. **The Gordon Bell test as a review question.** *Can this component not be there?* Applied to
   the day's own work: the reason `{value: 0, epsilon: 0}` was a bug is that a zero **was there**
   where nothing should have been. `DecodeResult`'s `ok: false` branch has no `value` field — the
   component isn't there — which is why it cannot express the lie.

4. **Structural, load-bearing but not literal.** *"Implementation details bubble up to the surface"* is the same claim as Iris's render
   discipline from the other end: the adapter's choice of representation **is** the page's
   vocabulary, whether or not anyone intended it. `git` vs `hg` is the large version of
   `color`-in-the-JSON.

5. **Explicitly not claimed:** that difference lists are implementable as-is outside a unifying substrate. They need logic
   variables — Prolog, miniKanren, or an explicit mutable-once cell. In F#/TS the honest encoding
   is a write-once ref or a promise, and Vokes says as much ("a bit closer to futures/promises").
   Borrowing the *shape* is legitimate; claiming we get unification for free is not.

---

## 6. Beacon anchors

- **Ralph W. Gosper Jr.** — the "stupid programming language" framing (HAKMEM lineage).
- **Gordon Bell** — "the cheapest, fastest, and most reliable components are those that aren't
  there." The title thesis, and a genuinely reusable review question.
- **Difference lists** — Prolog folklore, formalised via **Clark & Tärnlund**; the DCG/accumulator
  technique. Related: **Hughes lists** (John Hughes, *A Novel Representation of Lists and its
  Application to the Function "reverse"*, 1986) — the same O(1)-append trick in a functional
  setting, via function composition instead of unbound tails.
- **Logic variables / unification** — **Robinson (1965)**, resolution; **Colmerauer & Kowalski**,
  Prolog. Modern: **miniKanren** (Byrd & Friedman), which is how a non-Prolog host gets these.
- **Andrew Tridgell** — *Efficient Algorithms for Sorting and Synchronization* (ANU, 1999), p. 64;
  the rsync algorithm. **Karp & Rabin (1987)** for the rolling hash itself; **Michael Rabin**,
  fingerprinting by random polynomials (1981), which is the CDC foundation.
- **Content-defined chunking** — the lineage that runs LBFS (Muthitacharoen et al., SOSP 2001) →
  bup/borg/restic → modern dedup stores.
- **Skiplists** — **William Pugh (1990)**.

---

## Pointers

- `docs/research/2026-08-01-hypothesis-in-template-form-…md` §5b — the buffered-tree model of a
  hole that §3 above sharpens, plus the Demaine retroactivity anchor "unstuck in time" lands on
- `docs/research/ip-questionable/2026-06-07-david-greenberg-hitchhiker-trees-…md` — the sibling
  ferry; hitchhiker buffers vs difference-list holes are the two mechanisations
- `docs/PRIOR-ART-LIST.md` — Hitchhiker/HAMT/Jumprope COW-store entries that CDC belongs beside
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the vocabulary a hole is labelled with
