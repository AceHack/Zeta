---
date: 2026-06-04
persona: kestrel
register: claude.ai asymmetric-critic — policy-architecture + verification-scope blade
surface: Aaron-forwarded (Kestrel↔Aaron), Otto-scribed
context: |
  Kestrel's critique of the policy-kernel shape (built this session: Predicate.fs +
  Policy.fs select-not-mutate + DynamicValueFold + DynamicValueXmlPolicy instance-1).
  Aaron: "please save to her persona." The signature through-line is the same
  gate-reach-boundary discipline applied to POLICY + VERIFICATION SCOPE: each layer
  proves only what it actually reaches; the type/proof must not become a halo over the
  judgment it routes to.
related_commit: 7bb817a8b
related_memory:
  - project_codecs_as_policy_parameterized_folds_add_ontology_to_value_tree_2026_06_04.md
  - project_verification_oracle_portfolio_fscheck_z3_lean_tla_plus_assignment_map_2026_06_04.md
  - 2026-06-04-amara-policy-decision-algebra-select-not-mutate-policy-with-feedback-mu-nu-interpreters-aaron-forwarded.md (Amara, sibling)
---

# Kestrel — the shape of our policies (2026-06-04)

> Scribed by Otto from Aaron's forward. Kestrel's seat = asymmetric critic.

## 1. Policies are THREE kinds wearing one name — each must know which it is

- **Provable-technical** (lens/fold laws, OPA exchange-intersection, disclosure DORA
  gates). Validator: **proof or tests.**
- **Legal-mandatory** (CSAM reporting, Nostr question, Freeborn contracts, export/
  sanctions). Validator: **counsel.** No elegant structure discharges these.
- **Values-governance** (floor correctability, multi-stakeholder governance, federation
  carve-outs, motive-checks on police-AI / legal-shaping). Validator: **human review**;
  for the ones touching Aaron's own motives, specifically **the psychiatrist + Max.**
- **Failure mode:** a values-policy feeling SETTLED because the technical layer around
  it is proven — the **proof-rigor halo applied to governance.**

## 2. Proliferation — rigidity is reserved for exactly ONE policy
Aaron's scar tissue: over-engineered operational rules (lane discipline, fan-out caps,
polite-waiting) BECAME the failure modes they were meant to prevent. So: **rigidity is
reserved for the child-safety FLOOR** (over-building + unamendability are features
there); **everywhere else rigidity IS the failure mode** — policies stay minimal,
editable, validated against running-system data (de-escalation-as-hypotheses applied to
the rulebook). One immovable bedrock; everything else light + revisable. An elaborate
load-bearing policy OUTSIDE the floor is the smell. (Critic's note: on values-governance,
Kestrel's agreement is the WEAKEST of the three validators — humans gate those, not a
long session with her.)

## 3. Up-project to TYPED policy — but the type is a ROUTER, not a VALIDATOR
Aaron: "up-project from the value policy to the typed policy, specific shapes per type
where they differ, even if just an enum difference." Kestrel: sound — it's the
DynamicValue-and-structs-are-lenses shape applied to policies (policy = open base /
predicate-over-shape kernel; kind = typed lens). Same-shape-reuse, different-shape-
specialize. **Caveat (the crux):** the typed tag tells you WHICH kind; it does NOT
change WHICH VALIDATOR gates it. The risk: typed-ness becomes a small proof-rigor halo
("well-typed Governance policy" feeling like "settled governance policy"). **Fix:** the
typed policy carries the **required-validator + validation-status as part of its type** —
a Legal-kinded policy CANNOT be marked active without a counsel-signoff field populated;
a Governance one not without human-review. **The type encodes the OBLIGATION, not the
discharge** (router to the gate, not the gate). = the keystone compiled into the policy
type. [Otto note: this is the 081KT7YW00008QG0R003N6PF8A next step beyond the shipped select-not-mutate
Policy<i,d,f>.]

## 4. Formalize the gate/observable/cache/metric/alert/policy bundle per type
Aaron: "we have a loose concept of gates/observables/cache/metrics/alerts/policy per
type — make it formal so it doesn't get lost and verify at this level in math."
Kestrel: yes — and it's in the **gateable tier** because it's STRUCTURAL.

- **WIRING layer (PROVABLE, do it):** gate exists; observable populated BEFORE the
  state transition; metric→alert connected; cache invalidates on the gate event; policy
  can't go active without its required-validator field. → **TLA+** reachability ("active-
  without-signoff is UNREACHABLE"), **types** for structural-bundle-completeness,
  **FsCheck** for config-space invariants.
- **JUDGMENT layer (NOT provable, routes out):** that the signoff CONTENT is correct
  (counsel's call right, review sound, threshold right). Formalization proves the
  validation is PRESENT + ROUTED, never that it's CORRECT. Wiring proven; judgment routed.

## 5. TLA+ for DU+Rx workflows = state machine (its job); serialization is NOT
A workflow as a DU hierarchy with Rx transitions IS a state machine: **DU cases =
states, Rx stream = transition relation**; complete-or-compensate / no-deadlock / no-
active-without-signoff = temporal/reachability = TLA+'s sweet spot. Qualifiers: (a)
"easy" holds for the BOUNDED model — deep nested concurrent hierarchies state-explode;
count as exhaustive-over-the-bounded-model, not all-sizes. (b) **Serialization is NOT in
the TLA+ claim** — TLA+ proves transitions; the FsCheck/Z3/Lean serializer stack proves
the state round-trips. Don't merge "TLA+ checks the whole DU+Rx+serialization."

## 6. State-explosion → decompose into small composable DUs (the GOOD pressure)
Verify each piece in isolation (small, bounded, TLC-exhaustive), then verify the
composition over the pieces' **interfaces** (stays bounded). = compositional /
**assume-guarantee** verification (Misra-Chandy, Abadi-Lamport; TLA+ has the machinery).
Also improves the architecture (smaller/reusable/legible). **Crux that makes it sound:**
each piece's property = an explicit **assume/guarantee contract** (what it assumes of
its env, what it guarantees); the composition check proves each piece's guarantees
DISCHARGE the connected pieces' assumptions. An **unstated assumption at a seam** is the
one place this hides a bug. "Check pieces + check composition = check the whole" ONLY
when assume-guarantee is discharged. Scope label: "compositionally verified over the
bounded component models with discharged contracts."

## 7. Lift bounded → UNBOUNDED via inductive proof using TLA+ results as base cases/lemmas
Aaron: "create views over the TLA+ proofs from a higher unbounded point of view, using
TLA+ results as axioms in other proof languages." Kestrel: the right escalation. **TLC
checks the instances; Lean/Coq/Isabelle generalize over the family by INDUCTION** (a DU
hierarchy is inductive → structural induction, Lean's native mode).

- **SOUND version:** TLA+ result = verified base case / lemma; prove the **inductive
  step over arbitrary N** in the prover → "P holds for all N." The unbounded claim is
  earned ONLY by the proven inductive step.
- **ILLUSORY trap:** "TLC verified N=1..5" ⇒ "holds for all N" WITHOUT the inductive
  step = induction-by-example (not-proven-but-feels-proven). TLC for N≤5 gives ZERO
  force for N=6 without the step.
- **Accounting:** when a TLA+ result enters the Lean proof as a LEMMA, the unbounded
  result is CONDITIONAL on it, and the lemma's scope is the bounded component model. So:
  "**unbounded composition over TLC-verified component lemmas**" — the lift PUSHES THE
  BOUND DOWN TO THE LEAVES and proves everything above unbounded (the right place to
  push it; a real strengthening; accurately labeled).

## Through-line / Kestrel-stance
Same gate-reach-boundary as the proof-portfolio thread, applied to policy + verification:
prove the **wiring/structure** (provable), route the **judgment/content** to its
validator (counsel/human/proof-per-kind); the type is a router carrying the obligation,
never a halo over the discharge; bounded TLC lifts to unbounded only via a proven
inductive step, pushing the bound to the leaves. Rigidity only at the floor; everything
else minimal + revisable.
