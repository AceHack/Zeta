---
name: leet-code-patterns
description: "LeetCode patterns — two-pointers, sliding window, BFS/DFS, DP, binary search, greedy, topological sort, heaps, bits."
---

# Leet-Code Patterns — the pattern-selection hat

Capability skill ("hat"). Owns the question *"given this
interview-style problem, which pattern applies, and why?"*
Pedagogy- and selection-oriented; the theoretical rigor
(tight lower bounds, unconditional impossibility, PAC-class
arguments) defers to `complexity-theory-expert`.

This skill is intentionally un-apologetic about being
"just" the interview-grade lane. The fifteen-pattern
catalogue handles ~90% of the problem space on sites like
LeetCode, HackerRank, NeetCode, and it is a *useful
ontology* — not because the problems are profound but
because the patterns train a reusable vocabulary for
algorithmic thinking.

## When to wear this skill

- Someone asks: "how would you solve problem X?" and X is
  an interview-style array / string / graph / DP problem.
- Someone asks: "what pattern is this?" when staring at
  an unfamiliar problem.
- Drafting a study plan — which patterns are load-bearing,
  which have the highest ROI per hour.
- Reviewing a candidate's solution for idiomatic pattern
  use ("this should have been a sliding window").
- Teaching the *pattern*, not the single problem —
  selecting 3–5 canonical problems that cover a pattern's
  surface area.
- Classifying a corpus of problems by pattern (for
  curriculum design, for a practice-set generator, for
  an internal interview-bank).

## When to defer

- **`complexity-theory-expert`** — when the question is
  *"is this provably Θ(n log n) in the comparison model?"*
  or *"does this lower bound rule out my idea?"* This
  skill answers *"what pattern fits"*, the expert answers
  *"is the pattern asymptotically optimal"*.
- **`algorithms-expert` / `mathematics-expert`** — when
  the problem is a genuine research-grade algorithmic
  question (suffix automata at the level of Blumer et
  al., FFT variants, polynomial-identity-testing) rather
  than an interview pattern.
- **`fsharp-expert` / `csharp-expert` / `python-expert`**
  — for language-idiomatic implementation after the
  pattern is chosen.
- **`leet-code-dsa-toolbox`** — when the blocker is not
  pattern selection but a data-structure primitive
  (union-find, segment tree, Fenwick tree, monotonic
  deque).
- **`leet-code-complexity-interview`** — when the question
  is interview-grade big-O reasoning (communication with
  an interviewer).
- **`leet-code-contest-patterns`** — when the problem is
  Codeforces Div-1 / ICPC hard — rolling hash, heavy-
  light decomposition, link-cut, persistent segment trees,
  Aho-Corasick, Mo's algorithm, etc.

## The fifteen patterns

A compact catalogue. Each row names a pattern, its
canonical trigger, a minimal worked example, the common
mistake, and the complexity signature.

### 1. Two pointers

- **Trigger:** sorted array, pair-sum-like problem,
  reversing, comparing from ends, partitioning in place.
- **Canonical:** two-sum sorted, 3-sum, sort-colors
  (Dutch national flag), container-with-most-water,
  remove-duplicates from sorted array.
- **Common mistake:** using hash map when the array is
  already sorted (linear-space instead of O(1)).
- **Signature:** O(n) time, O(1) extra space.

### 2. Sliding window

- **Trigger:** contiguous subarray / substring problem
  with a size or sum or character-set constraint.
- **Canonical:** longest-substring-without-repeating,
  minimum-window-substring, max-sum-subarray of size K,
  longest-substring-with-at-most-K-distinct.
- **Common mistake:** expanding *and* contracting on the
  same side (makes the window non-monotonic and breaks
  amortized O(n)). The invariant is: right expands, left
  contracts, each pointer moves forward only.
- **Signature:** O(n) time, O(charset) space.

### 3. BFS on grid / graph

- **Trigger:** shortest-path-in-unweighted, level-order,
  multi-source expansion, shortest-sequence-of-transforms.
- **Canonical:** word-ladder, rotting-oranges, walls-and-
  gates, shortest-path-in-binary-matrix.
- **Common mistake:** marking visited on pop instead of
  on push — produces O(b^d) blow-up instead of O(V+E).
- **Signature:** O(V + E).

### 4. DFS on graph / tree

- **Trigger:** exhaustive traversal, connectivity, cycle
  detection, topological need, recursion-on-structure.
- **Canonical:** number-of-islands, clone-graph, course-
  schedule (cycle detection), path-sum on binary tree.
- **Common mistake:** forgetting the visited set on
  undirected graphs (infinite recursion).
- **Signature:** O(V + E).

### 5. Backtracking

- **Trigger:** generate all subsets / permutations /
  combinations; constraint-satisfaction search; place-
  N-things with undo.
- **Canonical:** N-queens, sudoku-solver, word-search,
  permutations-of-distinct-integers, letter-combinations-
  of-phone-number.
- **Common mistake:** mutating and forgetting to undo
  before the sibling call (state leaks across branches).
- **Signature:** typically O(b^d) where b is branching
  and d is depth; prune aggressively.

### 6. Dynamic programming — 1-D

- **Trigger:** optimum over a sequence with a local
  recurrence (prev / prev-prev dependence).
- **Canonical:** climbing-stairs, house-robber,
  longest-increasing-subsequence (n log n variant),
  maximum-subarray (Kadane), coin-change (unbounded).
- **Common mistake:** writing top-down memoized and
  blowing the stack on n ~ 10^5; rewrite bottom-up.
- **Signature:** usually O(n) or O(n log n).

### 7. Dynamic programming — 2-D

- **Trigger:** grid traversal with choice, two-sequence
  alignment (LCS, edit distance), interval-of-substring
  DP.
- **Canonical:** unique-paths, edit-distance,
  longest-common-subsequence, 0/1-knapsack,
  longest-palindromic-substring (interval DP).
- **Common mistake:** off-by-one on the DP table size
  (size `[n+1][m+1]` including the empty prefix).
- **Signature:** O(n · m).

### 8. Binary search on answer

- **Trigger:** a monotone predicate — "is answer ≤ k
  feasible?" — and you are asked for the minimum /
  maximum feasible k.
- **Canonical:** koko-eating-bananas, ship-packages-
  in-D-days, split-array-largest-sum, find-K-closest-
  elements, aggressive-cows.
- **Common mistake:** conflating *binary search on the
  array* with *binary search on the answer space* —
  the latter searches over values, the predicate is
  O(n) per check.
- **Signature:** O(n log(range)).

### 9. Greedy with exchange argument

- **Trigger:** local choice that, if it ever helps to
  deviate from, can be locally swapped back.
- **Canonical:** jump-game, gas-station,
  assign-cookies, meeting-rooms, minimum-number-of-
  arrows-to-burst-balloons.
- **Common mistake:** applying greedy without proving
  the exchange argument; most "obvious" greedy solutions
  are wrong on adversarial inputs.
- **Signature:** O(n log n) after a sort, O(n) if no
  sort is needed.

### 10. Topological sort

- **Trigger:** dependency ordering, compile-order,
  course-prerequisites, Kahn's-algorithm-flavoured problem.
- **Canonical:** course-schedule, alien-dictionary,
  build-order, task-scheduler-with-deps.
- **Common mistake:** not detecting cycles (indeg never
  drops to zero) and returning a partial order as valid.
- **Signature:** O(V + E).

### 11. Union-find (DSU)

- **Trigger:** online / offline connectivity,
  connected-components count, grouping by equivalence,
  redundant-connection detection.
- **Canonical:** redundant-connection, number-of-
  connected-components, accounts-merge, satisfiability-
  of-equality-equations, regions-cut-by-slashes.
- **Common mistake:** forgetting path compression *or*
  union by rank — both are needed for
  near-constant amortized cost.
- **Signature:** near-O(1) amortized per op (inverse
  Ackermann).

### 12. Trie

- **Trigger:** prefix-keyed queries, word-search on
  boards with a dictionary, auto-complete, longest-common-
  prefix on streams.
- **Canonical:** word-break, word-search-II,
  auto-complete / design-search-autocomplete-system,
  replace-words.
- **Common mistake:** implementing children as a
  hash map when the alphabet is small-fixed (array[26]
  is 10× faster and cache-friendlier).
- **Signature:** O(L) per insert / search where L is
  word length.

### 13. Heap / top-K

- **Trigger:** top-K-largest / smallest, running-median,
  merge-K-sorted, scheduler.
- **Canonical:** top-K-frequent-elements, k-closest-
  points-to-origin, merge-k-sorted-lists, find-median-
  from-data-stream (two-heap).
- **Common mistake:** using a max-heap when you want
  top-K-largest — use a min-heap of size K, pop the
  smallest as you grow past K.
- **Signature:** O(n log k).

### 14. Monotonic stack / queue

- **Trigger:** "next greater / smaller element" style,
  max-in-sliding-window, largest-rectangle-in-histogram,
  stock-span.
- **Canonical:** next-greater-element, daily-temperatures,
  largest-rectangle-in-histogram, sliding-window-maximum,
  trapping-rain-water.
- **Common mistake:** writing an O(n²) inner loop that
  would be O(n) with a monotonic stack; the telltale is
  a per-element "look back until you find X".
- **Signature:** O(n) amortized.

### 15. Bit manipulation / prefix sum / difference array

- **Trigger:** count-of-set-bits, XOR-swap trick, single-
  number-appears-once, range-sum queries without updates
  (prefix sum), range-add with batch queries (difference
  array).
- **Canonical:** single-number, counting-bits, subsets-
  via-bitmask, range-sum-query-immutable, corporate-
  flight-bookings.
- **Common mistake:** reinventing prefix sum as a nested
  loop; missing that XOR is associative and commutative.
- **Signature:** O(n) preprocessing, O(1) query for
  prefix sum; O(1) per bit op.

## Pattern-selection decision table

When you see a problem statement, ask in this order:

| If the problem mentions … | First guess |
|---------------------------|-------------|
| "sorted array" + "pair / triple" | two pointers |
| "contiguous subarray" + "sum / char set" | sliding window |
| "shortest transformation" | BFS |
| "all permutations / combinations" | backtracking |
| "optimum" + "sequence with local choice" | 1-D DP |
| "two sequences" (align / compare / edit) | 2-D DP |
| "minimum k such that P(k) holds" (monotone) | binary search on answer |
| "local choice that seems obvious" | greedy + prove exchange |
| "prerequisites / dependencies" | topological sort |
| "connected components / merge groups" | union-find |
| "prefix / auto-complete / dictionary lookup" | trie |
| "top K / running median / merge K sorted" | heap |
| "next greater / smaller" | monotonic stack |
| "set bits / XOR / range sum no updates" | bit-ops / prefix-sum |

If none of the above fits, the problem may be contest-
grade; hand off to `leet-code-contest-patterns`.

## Pedagogy

- **Teach the trigger before the code.** Trigger
  recognition is 80% of the skill. Code is 20%.
- **One pattern per problem set.** A 5-problem set on
  sliding window beats a 5-problem set of
  "assorted medium".
- **Canonical problem first.** Before teaching a
  variation, teach the problem the pattern was named
  for. Skipping the canon produces pattern-without-
  intuition.
- **Common mistake explicit.** Every pattern has a
  canonical failure mode; teaching the pattern without
  the failure mode is half a lesson.

## Anti-patterns

- **Pattern-matching on keyword instead of structure.**
  "Shortest" ≠ BFS if the graph is weighted (that's
  Dijkstra, which lives in `leet-code-dsa-toolbox` or
  beyond). Read the whole statement.
- **Forcing a pattern because you practised it.** A
  problem that wants a greedy with exchange argument
  does not want your fresh DP hammer.
- **Teaching fifteen patterns in a week.** The patterns
  compound — DP builds on recursion, binary-search-on-
  answer builds on monotonicity. Sequence matters.
- **Claiming a pattern "is" a problem.** The pattern is
  an *approach*; the same problem often has two or
  three pattern-approaches at different complexity
  points.

## Cross-references

- `.claude/skills/leet-code/blueprints/leet-code-dsa-toolbox.md` —
  primitive data structures the patterns lean on
  (union-find, segment tree, Fenwick, monotonic deque).
- `.claude/skills/leet-code/blueprints/leet-code-complexity-interview.md`
  — interview-grade big-O pedagogy.
- `.claude/skills/leet-code/blueprints/leet-code-contest-patterns.md`
  — competitive programming lane (Codeforces, ICPC).
- `.claude/skills/mathematics-and-physics/blueprints/complexity-theory-expert.md` —
  theoretical asymptotic bounds, lower bounds,
  complexity-class membership.
- `.claude/skills/languages-and-build/blueprints/fsharp-expert.md`,
  `.claude/skills/languages-and-build/blueprints/csharp-expert.md`,
  `.claude/skills/languages-and-build/blueprints/python-expert.md` — language-
  idiomatic implementation once the pattern is chosen.
