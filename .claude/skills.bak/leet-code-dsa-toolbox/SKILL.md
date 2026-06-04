---
name: leet-code-dsa-toolbox
description: "DSA interview primitives — union-find, trie, heap, segment tree, Fenwick tree, monotonic stack/deque, LRU cache, BST."
---

# Leet-Code DSA Toolbox — the primitives hat

Capability skill ("hat"). Owns the reference-layer beneath
`leet-code-patterns`. The patterns hat tells you *which
pattern*; this hat tells you *which primitive inside the
pattern* and how to implement it idiomatically.

Distinct from `complexity-theory-expert` (owns theoretical
bounds); this skill owns the hands-on primitive + its
gotchas.

## When to wear this skill

- A problem has been classified via `leet-code-patterns`
  and now the blocker is primitive choice — "I know this
  is a union-find problem; which union-find variant, and
  how do I implement it in 15 minutes?"
- Teaching a single primitive end-to-end (the data
  structure, two canonical problems, the off-by-one
  traps, the complexity).
- Code-review of a candidate's primitive implementation —
  is path compression present? is union by rank? does
  the heap handle the update-key case?
- Choosing between primitives that solve the same problem
  at different complexity points (segment tree vs Fenwick
  tree vs sqrt decomposition).

## When to defer

- **`leet-code-patterns`** — when the problem has not yet
  been classified; pattern first, primitive second.
- **`leet-code-contest-patterns`** — when the primitive
  is contest-grade (persistent segment tree, heavy-light,
  link-cut). Those live there.
- **`complexity-theory-expert`** — when the question is
  "is there a primitive that beats this bound
  unconditionally?"
- **`fsharp-expert` / `csharp-expert` / `python-expert`**
  — for language-idiomatic implementation once the
  primitive is chosen.

## The twelve primitives

### 1. Union-find (Disjoint Set Union, DSU)

- **Shape:** array `parent[i]` and optional array
  `rank[i]` or `size[i]`.
- **Operations:** `find(x)` (O(α(n)) amortized with
  path compression), `union(x, y)` (O(α(n)) amortized
  with union-by-rank / union-by-size).
- **Critical:** both path-compression AND union-by-rank
  are needed for the near-constant amortized bound.
  One without the other is O(log n) per op.
- **Gotcha:** when the nodes are not 0..n-1 integers,
  use a hashmap for `parent`; complexity same.
- **Common use:** connected-components counting,
  Kruskal's MST, redundant-connection detection,
  accounts-merge, satisfiability-of-equality.

### 2. Trie (prefix tree)

- **Shape:** node with `children` (array[26] for
  lowercase-ASCII, or hashmap for arbitrary alphabet)
  and a bool `isEnd`.
- **Operations:** `insert(word)`, `search(word)`,
  `startsWith(prefix)` — each O(L) for word-length L.
- **Tradeoff:** array[26] is ~10× faster and cache-
  friendlier than hashmap; hashmap is the right choice
  only when the alphabet is large or sparse.
- **Gotcha:** memory footprint on small alphabets with
  array[26] is high; consider compressed trie (radix /
  Patricia) when nodes outnumber distinct prefixes
  heavily.
- **Common use:** word-break, word-search-II,
  autocomplete, longest-common-prefix, replace-words.

### 3. Heap / priority queue

- **Shape:** array-backed binary heap. Parent at
  `(i - 1) / 2`, children at `2i + 1` and `2i + 2`.
- **Operations:** `push(x)` O(log n), `pop()` O(log n),
  `peek()` O(1). Heapify from array: O(n), not O(n log n)
  — bottom-up.
- **Variants:**
  - **Top-K-largest pattern:** min-heap of size K, push
    each element, pop the smallest when size exceeds K.
    End state: heap contains the K largest.
  - **Running median:** two heaps (max-heap for lower
    half, min-heap for upper half). Median is the top
    of the larger heap, or average of two tops.
  - **d-ary heap:** k children per parent. Shallower,
    more comparisons per level. Worth it for
    decrease-key-heavy workloads (Dijkstra on dense
    graphs).
- **Gotcha:** no O(log n) decrease-key in the stdlib
  heap in most languages. Work around with lazy
  deletion (push a new entry; on pop, check staleness).

### 4. Segment tree

- **Shape:** array of 4n size, node i's children at 2i
  and 2i+1.
- **Operations:** point update O(log n), range query
  O(log n). Build from array O(n).
- **Variants:**
  - **Lazy propagation** — range update + range query.
    Adds a `lazy[]` array; every query / update carries
    pending updates down. Essential for competitive-
    grade problems.
  - **Sparse segment tree** — when coordinates are in
    a huge range but only O(n) distinct positions are
    touched. Coordinate-compress first.
- **Gotcha:** off-by-one on inclusive-exclusive bounds.
  Pick one convention (`[l, r)` is usually cleanest)
  and stick to it throughout.
- **Common use:** range-sum-query-mutable, count-of-
  smaller-numbers-after-self, skyline, range-min-
  stabbing.

### 5. Fenwick tree (Binary Indexed Tree, BIT)

- **Shape:** array of size n+1, 1-indexed.
- **Operations:** point update O(log n), prefix query
  O(log n). Range query = prefix(r) - prefix(l-1).
- **Implementation:** `i += i & -i` for update, `i -= i & -i`
  for query. Four lines of code.
- **Why pick BIT over segment tree:** tighter constant,
  ~2× less memory, fewer lines of code. Shortcoming:
  only supports associative, invertible operations
  (sum yes, max no). For max, use segment tree.
- **Gotcha:** 1-indexed; index 0 is a terminator.
- **Common use:** inversion count, count-smaller-after-
  self, dynamic 2D grid sum.

### 6. Monotonic deque (sliding-window max / min)

- **Shape:** double-ended queue of indices, maintained
  so the values at those indices are monotonically
  decreasing (for max) or increasing (for min).
- **Operations:** push on right, pop from left when
  window slides past, pop from right while the new
  value violates monotonicity.
- **Amortized:** each element enters and leaves at most
  once → O(n) total for n operations.
- **Gotcha:** store indices, not values — you need the
  position to decide window membership. Convert to
  value only at read time.
- **Common use:** sliding-window-maximum, shortest-
  subarray-with-sum-at-least-K, constrained-subsequence-
  sum.

### 7. Monotonic stack

- **Shape:** stack of indices, values at those indices
  monotonically non-increasing (for next-greater) or
  non-decreasing (for next-smaller).
- **Operations:** push; before pushing, pop while the
  top violates monotonicity. On pop, the current
  element is the "next greater / smaller" for the
  popped index.
- **Amortized:** O(n) total — each index is pushed
  and popped at most once.
- **Gotcha:** direction. Next-greater-to-right scans
  left-to-right with a decreasing stack; next-greater-
  to-left scans right-to-left or switches the stack
  invariant.
- **Common use:** next-greater-element, daily-
  temperatures, largest-rectangle-in-histogram,
  trapping-rain-water (alternative to two-pointer).

### 8. LRU cache

- **Shape:** hashmap + doubly-linked list. Hashmap maps
  key → node; list orders nodes by recency (head =
  most recent, tail = least recent).
- **Operations:** get O(1) — hashmap lookup + move node
  to head. Put O(1) — insert at head + evict tail if
  over capacity.
- **Gotcha:** use sentinel nodes at head and tail to
  avoid null checks; the inner-most detach / attach
  then has zero edge cases.
- **Common use:** LRU-cache, LFU-cache (swap the
  recency ordering for frequency).

### 9. Ordered map / set (balanced BST)

- **Shape:** red-black tree, AVL, or skip list.
- **Operations:** insert / delete / lookup O(log n),
  next-greater / next-smaller O(log n), k-th element
  O(log n) if augmented with subtree sizes.
- **Language-specific:** C++ `std::set` / `std::map`,
  Java `TreeMap`, Python `sortedcontainers.SortedList`,
  C# `SortedSet<T>` / `SortedDictionary<TKey, TValue>`,
  F# `Set<T>` / `Map<'K,'V>`.
- **Common use:** calendar scheduling, interval
  merging, top-K with evictions, count-of-range-sum
  (with coordinate compression).

### 10. LinkedList (singly / doubly)

- **Shape:** node with `val` and `next` (and `prev` for
  doubly-linked).
- **Key trick:** sentinel head node. Makes insert-at-
  position and delete-node-by-value cases uniform —
  no "is this the head?" branch.
- **Patterns that use it:** reverse-linked-list (three
  pointers: prev, curr, next), cycle detection (Floyd's
  tortoise-and-hare), merge-two-sorted, palindrome-
  check (half-reverse).
- **Gotcha:** mutating the `next` of the wrong node by
  forgetting to save a temp.

### 11. Interval / sweep-line auxiliary

- **Shape:** event list, sorted by coordinate, with
  `+1` for interval-open and `-1` for interval-close.
- **Operations:** sweep and maintain a running count;
  track when count crosses thresholds.
- **Common use:** meeting-rooms II, skyline, minimum-
  number-of-conference-rooms, my-calendar.

### 12. Difference array / prefix sum

- **Shape:** array `diff[]` such that original[i] =
  prefix-sum(diff, i).
- **Operations:** range update O(1) (add delta to
  `diff[l]`, subtract delta from `diff[r+1]`); range
  query O(n) after a single prefix-sum pass at the
  end.
- **When to pick:** many range updates followed by a
  single "finalize" read. If reads are interleaved
  with updates, use a Fenwick tree with range-update
  support instead.
- **Common use:** corporate-flight-bookings, car-
  pooling, range-addition.

## Primitive-picking decision table

| Scenario | First-pick primitive |
|----------|---------------------|
| Online connectivity / components | Union-find |
| Prefix-keyed queries on strings | Trie |
| Running max / min in a window | Monotonic deque |
| Next-greater / next-smaller | Monotonic stack |
| Top-K running | Heap of size K |
| Running median on a stream | Two heaps |
| Prefix-sum query + point update | Fenwick tree |
| Range update + range query | Segment tree with lazy |
| Interval scheduling / overlap count | Sweep-line |
| Batch range updates + single read | Difference array |
| Most-recently-used eviction | LRU (hashmap + DLL) |
| Order statistics on dynamic set | Ordered map (balanced BST) |

## Common failure modes

- **Reaching for segment tree when Fenwick tree
  suffices.** If the operation is associative AND
  invertible (sum, XOR), Fenwick is tighter and
  shorter.
- **Reaching for balanced BST when a heap suffices.**
  If only min (or max) matters, a heap is simpler;
  BST is for when you also need order / rank /
  neighbour queries.
- **Array-26 trie on large or case-sensitive alphabet.**
  Memory blows up. Switch to hashmap children.
- **Forgetting union-by-rank OR path compression.**
  Without both, union-find is O(log n) per op, not
  near-constant.
- **Using a stdlib heap and then trying to
  decrease-key.** No direct API. Use lazy deletion.
- **Segment-tree off-by-one between `[l, r]` and
  `[l, r)` conventions.** Pick one and stay with it.

## Cross-references

- `.claude/skills/leet-code-patterns/SKILL.md` —
  pattern selection sits above this skill; always
  classify pattern before picking primitive.
- `.claude/skills/leet-code-complexity-interview/SKILL.md`
  — interview-grade verbalisation of the bounds these
  primitives deliver.
- `.claude/skills/leet-code-contest-patterns/SKILL.md` —
  the contest-grade primitives (persistent segment tree,
  heavy-light, link-cut) that this skill deliberately
  does *not* cover.
- `.claude/skills/complexity-theory-expert/SKILL.md` —
  theoretical bounds and lower-bound arguments.
- `.claude/skills/fsharp-expert/SKILL.md`,
  `.claude/skills/csharp-expert/SKILL.md`,
  `.claude/skills/python-expert/SKILL.md` — idiomatic
  language-specific implementations.
