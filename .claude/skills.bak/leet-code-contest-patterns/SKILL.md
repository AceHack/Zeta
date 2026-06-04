---
name: leet-code-contest-patterns
description: Competitive programming — segment trees, HLD, suffix arrays, FFT/NTT, max-flow, 2-SAT, centroid decomp; Codeforces/ICPC.
---

# Leet-Code Contest Patterns — the Div-1 / ICPC hat

Capability skill ("hat"). Owns the problem lane that
exceeds interview-grade rigor — Codeforces Div-1,
ICPC regionals and world finals, IOI. When the
constraints demand a technique not covered by
`leet-code-patterns` or `leet-code-dsa-toolbox`, this
skill takes it.

Distinct from and above:

- `leet-code-patterns` — fifteen interview patterns
  that handle ~90% of LeetCode problems. This skill
  starts where that one ends.
- `leet-code-dsa-toolbox` — primitive data structures
  at interview rigor; this skill extends into
  persistent, square-root-decomposed, and tree-
  augmented variants.
- `complexity-theory-expert` — theoretical rigor;
  this skill is still pragmatic ("here is the
  algorithm and its cost") but at a higher
  sophistication floor.
- `algorithms-expert` — genuinely research-grade
  algorithmic work (novel algorithms, research
  publications); contest techniques are the
  engineering side of that lane.

## When to wear this skill

- A problem's constraints exceed n ≤ 10^5 time-wise
  (typically 10^6 or 10^7), or require online range
  queries with updates, or require multiple query
  types interleaved.
- Strings at 10^6 characters with multiple-pattern
  matching.
- Graph problems that want dynamic connectivity
  (link-cut) or path queries on a tree with updates
  (heavy-light).
- Number-theoretic problems that require modular
  exponentiation, Chinese remainder theorem,
  multiplicative inverses via Fermat, or FFT.
- Flow / matching problems (max-flow on graphs with
  10^4 vertices and 10^5 edges).
- Any problem where the candidate O(n√n) or
  O(n log² n) solution is the intended answer.

## When to defer

- **`leet-code-patterns`** — if the problem is actually
  an interview pattern in disguise. Try classification
  first; do not reach for Aho-Corasick when a trie
  would do.
- **`leet-code-dsa-toolbox`** — for the plain primitive
  without the contest-grade augmentation.
- **`algorithms-expert`** — for genuinely novel
  algorithmic work (research publications, not
  competitive programming).
- **`complexity-theory-expert`** — for lower-bound
  arguments or unconditional impossibility.
- **`performance-engineer`** (Naledi) — when the
  constraint is wall-clock on real hardware, not
  asymptotic; contest pragmatism and real-hardware
  pragmatism diverge at constant factors.

## The contest technique catalogue

### Strings

- **Rolling hash.** Polynomial hash with two
  moduli for collision safety. Enables O(1) per
  substring comparison after O(n) preprocessing.
  Canonical uses: substring search, repeated-
  substring detection, palindrome family problems.
- **KMP (Knuth-Morris-Pratt).** Linear single-pattern
  matching via failure function. Foundation for the
  "longest proper prefix = suffix" DP class.
- **Z-function.** Linear-time computation of longest-
  common-prefix of s and each suffix. Handy when
  KMP's failure function is less natural.
- **Aho-Corasick.** Multi-pattern matching via a
  trie with failure links. O(n + m + Σ|patterns|).
  Canonical: "given n patterns, find all occurrences
  in a text."
- **Suffix array.** Array of starting positions of
  suffixes, sorted lex. O(n log n) build; with
  Kasai's algorithm the LCP array adds O(n). Use
  when the problem reduces to suffix structure.
- **Suffix automaton.** Minimal DFA accepting all
  substrings. O(n) build. More powerful than suffix
  array for online queries.

### Trees and graphs

- **LCA via Euler tour + RMQ (sparse table).** O(n log n)
  preprocessing, O(1) LCA query. Beats the straightforward
  binary-lifting O(n log n + q log n) when query count
  dominates.
- **Binary lifting.** `up[v][k]` = 2^k-th ancestor of v.
  O(n log n) build, O(log n) per ancestor / LCA query.
  Simpler than Euler+RMQ for many problems.
- **Heavy-light decomposition.** Decomposes tree into
  O(log n) heavy paths; path queries reduce to O(log²n)
  segment-tree queries. Canonical: path-sum with updates
  on a tree.
- **Centroid decomposition.** Recursive centroid trees;
  O(log n) depth; each level touches O(n) work. Canonical:
  count-paths-with-property.
- **Link-cut tree.** Dynamic tree with path queries and
  link / cut operations in O(log n) amortized.
  Splay-tree-based. Use when tree structure itself
  changes online.
- **Tarjan SCC.** Strongly-connected components in
  O(V + E). Kosaraju is simpler but Tarjan is single-pass.
- **Biconnected components / bridges.** Tarjan's
  articulation-point algorithm; O(V + E).
- **2-SAT.** Reduce to SCC on implication graph. If x and
  ¬x in the same SCC, unsat; else topological order
  extracts a satisfying assignment.

### Range queries

- **Segment tree with lazy propagation.** Range update +
  range query in O(log n). The default heavy-weapon
  when updates and queries interleave.
- **Persistent segment tree.** Immutable version;
  each update creates O(log n) new nodes. Enables
  historical queries ("sum of version v") in
  O(log n). Canonical: k-th order statistic on
  arbitrary range.
- **Mo's algorithm.** Offline range-query sorting by
  block; O((n+q)√n) total. When queries are known in
  advance and updates are batched.
- **Sqrt decomposition.** Block-based approach; O(√n)
  per op; simpler than segment tree, sometimes
  faster in practice.
- **Sparse table.** O(n log n) preprocessing, O(1) RMQ
  (for idempotent operations like min, max, gcd).
  Cannot update.

### DP techniques

- **Bitmask DP.** State includes a bitmask over a
  small set (n ≤ 20 typically); O(2^n · n) style.
  Canonical: TSP on ≤ 20 nodes.
- **Digit DP.** DP over digits of a number; state
  tracks (position, tight-flag, leading-zeros,
  aux). Canonical: "count numbers in [L, R] with
  property X."
- **SOS DP (sum over subsets).** Compute for each
  mask the sum over all submasks in O(2^n · n) via
  SOS recurrence. Canonical: subset-convolution.
- **Convex hull trick / Li Chao tree.** For DP
  recurrences of the form dp[i] = min over j of
  (a_j · x_i + b_j); maintain lower envelope of
  lines in O(log n) per query.
- **Divide and conquer optimization.** For DPs
  where the argmin is monotone in the outer
  parameter; reduces O(n²) to O(n log n).
- **Knuth optimization.** For DPs satisfying the
  quadrangle inequality; reduces O(n³) to O(n²).

### Number theory and math

- **Modular arithmetic fundamentals.** Modular
  exponentiation, Fermat's little theorem for
  inverses (prime modulus), extended Euclidean for
  general modulus inverses, Chinese remainder
  theorem.
- **Matrix exponentiation.** Linear recurrences in
  O(k³ log n) where k is the recurrence order.
  Canonical: Fibonacci at index 10^18.
- **FFT / NTT.** Polynomial multiplication in
  O(n log n). NTT is FFT over a prime field, exact
  arithmetic. Canonical: convolution, big-integer
  multiplication, polynomial interpolation.
- **Sieve of Eratosthenes.** O(n log log n) primes
  up to n. Linear-sieve variant O(n) for smallest
  prime factor.
- **Möbius inversion.** Number-theoretic inclusion-
  exclusion via the Möbius function.

### Flow, matching, min-cut

- **Dinic's algorithm.** Max-flow in O(V² · E);
  much faster in practice on unit graphs.
- **ISAP.** Improved augmenting-path max-flow;
  often faster than Dinic in practice.
- **Min-cost max-flow via SPFA augmenting paths.**
  O(V · E · f) in worst case.
- **Bipartite matching via Hopcroft-Karp.**
  O(E √V).
- **Hungarian algorithm.** Min-cost bipartite
  matching in O(V³).

### Geometry

- **Convex hull (Graham scan / Andrew's monotone
  chain).** O(n log n).
- **Sweep-line for segment intersection.**
  O(n log n).
- **Rotating calipers.** O(n) after convex hull;
  canonical: diameter of a point set.
- **Segment-tree over angles.** For geometric range
  queries on angular intervals.

## The canonical problem-shape → technique mapping

| Shape | First-pick technique |
|-------|---------------------|
| Pattern-matching, ≤ 50 patterns, text 10^6 | Aho-Corasick |
| Single-pattern matching, text 10^6 | KMP or Z |
| Substring queries after preprocessing | Suffix array + Kasai |
| Path queries on tree with updates | Heavy-light decomposition |
| Range update + range query, 10^5 | Segment tree + lazy |
| Count points in range, offline, 10^5 queries | Mo's algorithm |
| K-th smallest in range, online | Persistent segment tree |
| LCA, 10^6 queries | Euler tour + sparse table |
| Max-flow, V=10^3, E=10^5 | Dinic |
| Bipartite matching, V=10^3, E=10^5 | Hopcroft-Karp |
| DP recurrence dp[i]=min(a_j·x_i+b_j) | CHT / Li Chao |
| Subset convolution, n ≤ 20 | SOS DP |
| Linear recurrence, n=10^18 | Matrix exponentiation |
| Polynomial multiplication, degree 10^5 | FFT / NTT |
| 2-SAT on 10^5 variables | Tarjan SCC on implication graph |

## Anti-patterns

- **Reaching for contest technique when interview
  pattern suffices.** Aho-Corasick on a single
  pattern is foot-shooting; KMP is there for a
  reason.
- **Memorising without understanding failure-link
  trees.** Aho-Corasick, suffix automaton, and KMP
  all rest on failure-link intuition. Memorise code
  after understanding; never the reverse.
- **Heavy-light without reason.** Heavy-light is
  O(log² n) per query with a large constant; if
  the tree is small or queries are few, simpler
  approaches win.
- **FFT when modular convolution suffices.** NTT is
  cleaner when the problem is modular; FFT has
  floating-point headaches.
- **Persistent data structure without the query
  model.** Persistence adds memory and constant
  factors; use only when historical queries are
  actually needed.

## Implementation discipline

Contest code has a specific register:

- **Short variable names.** `u`, `v`, `dp`, `adj` —
  reading competitive code requires tolerance for
  this.
- **Fast I/O.** `scanf` / `printf` in C++; custom
  buffered input in Java; `sys.stdin.readline` in
  Python. Default I/O is often 10× too slow.
- **No over-engineering.** Contest code is write-once.
  No classes, no error handling beyond bounds, no
  unit tests.
- **Stress testing.** Write a brute-force solution and
  a random-case generator; compare. Catches 90% of
  off-by-one and edge-case bugs before submission.

## Cross-references

- `.claude/skills/leet-code-patterns/SKILL.md` —
  try the fifteen patterns first; only reach for
  this skill when they genuinely do not fit.
- `.claude/skills/leet-code-dsa-toolbox/SKILL.md` —
  the primitive layer; this skill extends it with
  persistence, augmentation, and decomposition.
- `.claude/skills/leet-code-complexity-interview/SKILL.md`
  — complexity communication; this skill's techniques
  live at O(n log² n) / O(n √n) / O(n log n · α(n))
  and that vocabulary needs to be fluent.
- `.claude/skills/complexity-theory-expert/SKILL.md` —
  theoretical rigor for lower-bound arguments.
- `.claude/skills/algorithms-expert/SKILL.md` —
  genuinely research-grade algorithmic work.
- `.claude/skills/performance-engineer/SKILL.md` —
  when asymptotic analysis collides with real-
  hardware constants.
- `.claude/skills/python-expert/SKILL.md`,
  `.claude/skills/csharp-expert/SKILL.md`,
  `.claude/skills/fsharp-expert/SKILL.md` —
  language-idiomatic contest code.
