---------------------------- MODULE BpExactOnTree ----------------------------
(* B-1007 C5 — belief propagation `runToFixpoint` is EXACT ON TREES and
   TERMINATES under the bounded round cap. Models the synchronous
   sum-product schedule (`FactorGraph.passOnce` / `runToFixpoint`,
   src/Bayesian/FactorGraph.fs:124-191) on the 3-variable tree — the path
   0 — 1 — 2 (equality factors {0,1} and {1,2}, plus a prior on each
   variable). Spec: Kschischang-Frey-Loeliger 2001, sum-product exact on
   trees.

   ABSTRACTION (the `RecursiveCountingLFP` ghost-set idiom). Sum-product
   on a tree runs over a COMMUTATIVE message group (the C1/C2/C3 group
   laws — product is associative + commutative), so the only thing that
   determines a variable's marginal at the fixed point is WHICH pieces of
   evidence have folded into it; the order/grouping is irrelevant. We
   therefore track `marginal[v]` as the SET of prior-evidence ids folded
   into v's marginal, not the numeric message. One synchronous round
   floods each marginal with its tree-neighbours' current marginals — the
   information-flow content of `passOnce`. The numeric value is the group
   product of that set (proven order-independent by C1/C2/C3); the set is
   the faithful TLC-checkable abstraction, exactly as `paths` ghosts
   `closure` in RecursiveCountingLFP. The numeric float code is
   cross-checked separately by the FsCheck companion (Bp.Tests.fs, random
   trees) per BP-16 (TLA+ for the schedule/termination ∧ FsCheck for the
   real float marginal).

   Two claims, both model-checked by TLC:
     * EXACT-ON-TREE  — at the fixed point every marginal carries the
       WHOLE tree's evidence {0,1,2} = AllEvidence (the KFL exactness
       theorem on a tree).
     * TERMINATION    — the schedule converges within Diameter+1 rounds
       (Diameter = 2 for the 3-path), strictly before the cap, so the
       `rounds < maxRounds` guard never blocks a tree from converging. *)

EXTENDS Integers, FiniteSets

CONSTANTS MaxRounds
VARIABLES rounds, marginal, converged

vars == <<rounds, marginal, converged>>

Vars        == 0..2             \* the 3 tree variables
AllEvidence == {0, 1, 2}        \* one prior (one evidence id) per variable

(* The tree edges (the path 0 — 1 — 2): tree-adjacent variables of v. *)
Adj(v) == CASE v = 0 -> {1}
            [] v = 1 -> {0, 2}
            [] v = 2 -> {1}

(* Union of marginal[n] over the tree-neighbours n of v. *)
NbrEvidence(v, mrg) == UNION { mrg[n] : n \in Adj(v) }

TypeOK ==
    /\ rounds    \in 0..MaxRounds
    /\ marginal  \in [Vars -> SUBSET AllEvidence]
    /\ converged \in BOOLEAN

(* Init — `passOnce` not yet run: each variable's marginal holds only its
   own prior (the leaf evidence). *)
Init ==
    /\ rounds    = 0
    /\ marginal  = [v \in Vars |-> {v}]
    /\ converged = FALSE

(* The result of one synchronous `passOnce` round: flood each marginal
   with its neighbours' current evidence (monotone union — sum-product on
   a tree only ADDS evidence to a marginal). *)
NextMarginal(mrg) == [v \in Vars |-> mrg[v] \union NbrEvidence(v, mrg)]

(* One `runToFixpoint` iteration: `passOnce`, bump the round counter, and
   set `converged` when no marginal moved — the `not (moved current next)`
   residual test at FactorGraph.fs:189 (converged ⟺ next = current). *)
Pass ==
    /\ ~converged
    /\ rounds < MaxRounds
    /\ LET nm == NextMarginal(marginal)
       IN  /\ marginal'  = nm
           /\ rounds'    = rounds + 1
           /\ converged' = (nm = marginal)

(* Terminal — once converged or the cap is hit, stutter (keeps Next always
   enabled; the cfg sets CHECK_DEADLOCK FALSE for the saturated state). *)
Done ==
    /\ (converged \/ rounds = MaxRounds)
    /\ UNCHANGED vars

Next == Pass \/ Done

Spec == Init /\ [][Next]_vars

(* ── the two correctness claims (state invariants over every reachable
      state, model-checked exhaustively by TLC) ── *)

(* EXACT-ON-TREE: whenever the schedule reports convergence, every
   variable's marginal carries the WHOLE tree's evidence. *)
ExactOnTree == converged => \A v \in Vars: marginal[v] = AllEvidence

(* TERMINATION (safety form): by the time Diameter+1 = 3 rounds have run,
   the 3-path has converged — the cap never blocks a tree. (Diameter = 2
   hops; +1 round to detect no-move.) Holds for any MaxRounds >= 3. *)
ConvergesBeforeCap == rounds >= 3 => converged

(* Monotone information flow — a marginal never loses its own evidence
   (sum-product only adds). *)
Monotone == \A v \in Vars: v \in marginal[v]

Safety == TypeOK /\ ExactOnTree /\ ConvergesBeforeCap /\ Monotone
=============================================================================
