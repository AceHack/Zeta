---
name: leet-code-complexity-interview
description: "Interview complexity communication — big-O, amortized analysis, master theorem, space-time tradeoffs, misstatements."
---

# Leet-Code Complexity Interview — the interview-grade

## big-O pedagogy hat

Capability skill ("hat"). Owns the *communication* of
complexity in an interview setting: how to say it, what
to say when the interviewer asks the follow-up, when to
invoke amortized reasoning, when to distinguish worst-
case from average-case from amortized. Distinct from
`complexity-theory-expert` (theoretical rigour) and from
`leet-code-dsa-toolbox` (which primitive has which
complexity).

The goal of this skill is not "know the complexity" —
that is cheap. The goal is "communicate the complexity
in a way that an interviewer can follow, can probe
productively, and comes away with an accurate model of
what you understand."

## When to wear this skill

- Coaching a candidate on complexity communication.
- Reviewing a submitted solution where the stated
  complexity is unclear, imprecise, or wrong.
- Writing interview-loop rubrics for algorithms rounds.
- Teaching amortized analysis at the level an
  interview expects — aggregate method, potential
  method summary, the dynamic-array doubling example.
- Helping classify a solution's complexity when the
  answer depends on input distribution or on
  adversarial construction.

## When to defer

- **`complexity-theory-expert`** — when the question is
  a genuine lower bound, a complexity-class membership
  argument, a reduction, or an unconditional
  impossibility. This skill is pedagogy, not theory.
- **`leet-code-patterns`** — when the question is "what
  pattern does this problem fit?"
- **`leet-code-dsa-toolbox`** — when the question is
  "what primitive has this bound?"
- **`leet-code-contest-patterns`** — when the bound
  depends on a contest-grade technique (persistent
  segment tree's O(log n) per query with O(n log n)
  preprocessing, etc.).

## The seven classes an interviewer expects you to know

| Class | Shape | Canonical operation |
|-------|-------|---------------------|
| O(1) | constant | hashmap lookup, heap peek |
| O(log n) | logarithmic | binary search, balanced-BST lookup |
| O(n) | linear | single-pass scan, hashmap iteration |
| O(n log n) | linearithmic | sort, heapify + n pops, many divide-and-conquer |
| O(n²) | quadratic | nested loop, naive all-pairs |
| O(2^n) | exponential | subset-enumerate, brute-force SAT |
| O(n!) | factorial | permutation-enumerate, naive TSP |

Mention of any class outside this seven should be
accompanied by a brief explanation — `O(n log log n)`
for deamortized union-find is not an interview-standard
phrase and will confuse an interviewer unless you
spell it.

## Amortized analysis — interview-grade

Three methods to know, in increasing rigour:

### Aggregate method

"Over n operations, total work is T; therefore
amortized cost per op is T/n."

Canonical example: **dynamic-array doubling.** n pushes
total to O(n) because copies at sizes 1, 2, 4, 8, ...
sum to 2n. Amortized O(1) per push.

Sufficient for >90% of interview questions.

### Accounting method

Charge operations a "price" above their actual cost;
bank the excess. When an expensive operation happens,
pay from the bank.

Canonical example: **dynamic-array doubling** again —
every push pays $3, the bank absorbs the future copy
cost. Useful when the interviewer probes "but the
one-time copy is expensive!" — aggregate answers the
question; accounting explains *why*.

### Potential method

Define a potential function Φ that maps state to
non-negative real. Amortized cost of op i is actual
cost + ΔΦ.

For interview-grade use, one sentence suffices: "By the
potential method, with Φ = (elements since last
resize), the potential absorbs the copy cost; each push
amortizes to O(1)."

Deeper potential-method analysis (splay tree, Fibonacci
heap) is `complexity-theory-expert` territory.

## Recurrences — the master theorem

For divide-and-conquer recurrences of the form
T(n) = a · T(n/b) + f(n):

- If f(n) = O(n^c) with c < log_b(a): T(n) = Θ(n^(log_b a))
- If f(n) = Θ(n^c) with c = log_b(a): T(n) = Θ(n^c log n)
- If f(n) = Ω(n^c) with c > log_b(a): T(n) = Θ(f(n))

Canonical examples:

- **Merge sort:** T(n) = 2T(n/2) + O(n) → Θ(n log n).
  Case 2.
- **Binary search:** T(n) = T(n/2) + O(1) → Θ(log n).
  Case 2 with c = 0.
- **Karatsuba multiplication:** T(n) = 3T(n/2) + O(n)
  → Θ(n^log_2(3)) ≈ Θ(n^1.585). Case 1.

Memorise the three cases and one canonical example per
case; that covers every interview recurrence you will
face.

## Space complexity — the forgotten dimension

Candidates routinely state time complexity and forget
space. An interviewer asking "and space?" expects a
coherent answer in the same vocabulary:

- **Auxiliary space** — space allocated by the
  algorithm, excluding the input. This is what
  interviewers mean by "space complexity" unless
  they say otherwise.
- **Recursion stack** — O(depth) even when no heap
  allocation happens. Depth of a balanced recursion
  tree is O(log n); depth of a worst-case BST
  recursion is O(n).
- **Output space** — when the output size can exceed
  the input (subsets are 2^n, permutations are n!),
  space is bounded by output size.

## Common misstatements to avoid

- **"O(log n) hash lookup."** Hashmaps are O(1)
  amortized, O(n) worst-case on adversarial input.
  The confused version mixes O(log n) for balanced-BST
  with O(1) for hashmap.
- **"O(n) binary search."** Binary search on an n-
  element sorted array is O(log n); if the array is
  unsorted the first step is the sort (O(n log n)),
  not the search.
- **"O(n²) because two nested loops"** without
  reading the loops. `for i in range(n): for j in
  range(i+1, n)` is still O(n²) total but each
  inner iteration is bounded; `for i in range(n):
  for j in range(n): inner()` depends on what
  `inner()` does.
- **"O(n!) because backtracking."** Not every
  backtracking is factorial; depends on branching
  and pruning. Palindrome-partitioning is O(n · 2^n);
  N-queens with good pruning is much less than n!.
- **"O(1) space because no explicit allocation."**
  The recursion stack is space. A recursive solution
  with depth O(n) has O(n) space even if every
  function body looks local-only.
- **"Big-O is an upper bound, so O(n²) for
  merge sort is technically correct."** An
  interviewer asks for the *tight* bound; saying
  O(n²) when O(n log n) is tight is a signal you
  do not know which is tight.
- **"Average case" without defining the
  distribution.** Quicksort's "average O(n log n)"
  assumes uniform-random input; if the interviewer
  probes the distribution, a well-prepared candidate
  answers.

## Communication framing — the three-sentence rule

State complexity in three sentences:

1. **Time.** "This runs in O(f(n)) because [brief
   reason]."
2. **Space.** "Auxiliary space is O(g(n)) [including
   / excluding] the recursion stack."
3. **Worst case / amortized / average.** "This is
   [worst-case | amortized | average-case assuming
   X distribution]."

If you cannot answer all three, the interviewer will
probe for the missing one. Better to volunteer than
to be extracted from.

## When the interviewer pushes back

Common probes and the right response shape:

| Probe | Response shape |
|-------|---------------|
| "Can you do better than O(n²)?" | Consider sort (n log n), or hashmap (n average). If no, argue lower bound. |
| "What about space?" | Auxiliary + recursion stack. |
| "Is this the tight bound?" | Big-Θ or big-Ω argument. If only upper known, say so. |
| "Average vs worst?" | Name the distribution. |
| "Amortized?" | Aggregate / accounting method, one sentence. |
| "Can you prove the lower bound?" | Information-theoretic (sort: n log n comparisons) or reduction. Hand-off territory to complexity-theory-expert. |

## Interview anti-patterns

- **Memorised complexity, no reasoning.** Candidate
  says "O(n log n)" without being able to justify.
  First follow-up exposes the gap.
- **Hand-waved amortized.** "It's amortized O(1)
  trust me" without naming the method or the
  potential. Interviewer cannot grade reasoning.
- **Avoiding the word "amortized" entirely.**
  Candidate says "O(1)" for dynamic-array push.
  Interviewer asks about the copy; candidate panics.
  Saying "amortized O(1) per push, O(n) worst-case
  on the occasional resize" is the clean answer.
- **Avoiding worst-case vs average-case
  distinction.** Hashmap lookup "O(1)" without
  qualification reads as either not-knowing or
  over-confident. Add "average-case O(1), worst-
  case O(n) on adversarial input."
- **Big-O when tight bound is known.** O(n²) for
  merge sort. Say Θ(n log n).

## Cross-references

- `.claude/skills/leet-code/blueprints/leet-code-patterns.md` —
  pattern-selection, prerequisite to this skill.
- `.claude/skills/leet-code/blueprints/leet-code-dsa-toolbox.md` —
  primitive-level complexity reference.
- `.claude/skills/leet-code/blueprints/leet-code-contest-patterns.md`
  — contest-grade complexity (persistence, square-
  root decomposition, FFT).
- `.claude/skills/mathematics-and-physics/blueprints/complexity-theory-expert.md` —
  theoretical rigour; lower bounds, class membership,
  reductions.
- `.claude/skills/leet-code/SKILL.md` — when
  the analysis is a genuine research-grade question
  rather than interview rigor.
