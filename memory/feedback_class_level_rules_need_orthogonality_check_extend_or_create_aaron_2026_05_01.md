---
name: Class-level rules need orthogonality check before encoding — extend existing or create orthogonal; Rodney's Razor is the verification (Aaron 2026-05-01)
description: Aaron 2026-05-01 — when encoding a class-level rule from a found problem (Layer 3 of the 4-layer meta-learning pattern), FIRST check existing classes for similarity; if the finding fits an existing class, extend it; if it's genuinely separate, create a new orthogonal class; Rodney's Razor verifies the orthogonality and catches overlap. This is the meta-meta-meta layer above 081KQGDBJ0008QG0R001JC9HCJ's Layer 3 (encode the class). Without it, the class library accumulates redundant or overlapping rules and loses canonicalization discipline. Cross-project rule (Aaron mentioned applying it on "the other system" too); composes with orthogonal-axes-factory-hygiene + canonical-definition-machinery + uberbang.
type: feedback
---

# Class-level rules need orthogonality check — extend or create

Aaron 2026-05-01 (verbatim, between drain-push and tick-close):

> *"oh yeah a refinement i'll also make now on the other system,
> a meta-meta-meta rule, when class a problem you found, look if
> it's similar to existing classes and make sure you are
> creating a proper ontological orthoganl thing or extend the
> exsiting one, Rodney's razor will tell you if your wrong."*

## The rule

When applying Layer 3 of the 4-layer meta-learning pattern (081KQGDBJ0008QG0R001JC9HCJ
— encode the *class* of error, not the one-off instance), DO NOT
just write the class as a new memory file. First:

1. **Search the existing class library.** Grep memory/, look for
   adjacent rules in CURRENT-aaron, scan the canonical entries.
   Is there already a class that names this pattern, or names a
   parent pattern this finding is a sub-case of?

2. **Decide: extend or create.**
   - **Extend** when the new finding is a sub-case, refinement,
     or sibling-application of an existing class. Add to the
     existing memory file (or compose explicitly via "Composes
     with") rather than starting a new file.
   - **Create orthogonal** when the new finding is genuinely
     independent — different mechanism, different domain,
     different invariant — from existing classes. New memory
     file, named to surface the orthogonality, with explicit
     composes-with notes naming the *adjacent-but-orthogonal*
     classes.

3. **Verify with Rodney's Razor.** The razor's test:
   *can the proposed class be dissolved into an existing one
   without loss?* If yes, extend instead of create. If no, the
   orthogonality is real and the new class earns its place.

**The default is extension.** Creating a new class without an
orthogonality justification is namespace-pollution; the class
library loses canonicalization discipline (canonical-definition
rule) and accumulates redundant rules that overlap silently.
Future-Otto reading the class library should see a *forest of
orthogonal trunks*, not a *thicket of overlapping vines*.

## Why this matters

The class library is itself a substrate — and substrate needs
canonicalization just like any other content. Aaron's framing
treats class-level rules as first-class objects subject to the
same razor that applies to their content. Without the razor,
each instance-bug → class-rule encoding adds a class without
checking whether the class already exists; the library balloons
with overlap; future reads discover N rules that cover the same
shape with slightly different framings; the operator gets stuck
trying to figure out which one applies.

With the razor:

- The class library stays *Confucius-compressing* (per the
  canonical-definition rule's Confucius-mode framing).
- New findings either deepen existing classes (more substrate
  on a single trunk) OR open new trunks (genuinely new
  territory).
- Razor-cuts dissolve mistaken creates back into their parent
  class.

## How to apply

When about to encode a Layer-3 class-level rule:

1. **Grep first.** Identify 2-3 candidate parent classes that
   the finding might fit under. Search by topic keywords + by
   structural shape (verb-before-X, scope-of-Y-check, etc.).
2. **Read candidates' "Composes with" sections.** Existing
   classes often already enumerate sibling cases; the new
   finding may already be implied.
3. **Pose the razor question.** *Can the new finding be stated
   as an extension of [candidate parent class] without losing
   information or precision?* If yes → extend. If no →
   continue.
4. **If creating orthogonal**: name the orthogonality axis
   explicitly in the new file's frontmatter description. ("This
   is orthogonal to X because [mechanism / domain / invariant]
   differs.") Future-Otto should be able to read the
   orthogonality claim and verify it.
5. **Cross-link.** Even when creating orthogonal, list the
   adjacent classes in "Composes with" so the relationship is
   navigable from either side.

## Worked example — applying this rule to a class-level lesson I just encoded

In tick 2026-05-01T04:40Z (shard
`docs/hygiene-history/ticks/2026/05/01/0440Z.md`, landing via
PR #1023 — pending merge at the time this memory was authored;
verify on main once #1023 lands) I encoded a class-level
lesson:

> *"when fixing a scope/vocabulary inconsistency, grep the
> WHOLE file for the inconsistent term, not just the section
> that triggered the finding."*

Per Aaron's meta-meta-meta rule, before promoting this to a
new class, I should have searched for parent classes:

- **`feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md`**
  and **`feedback_otto_364_search_first_authority_not_training_data_not_project_memory_aaron_2026_04_29.md`**
  — these are search-first rules. They cover *upstream-truth-vs-
  training-data*, not *whole-file-vs-just-the-section-that-
  triggered*. Different scope (upstream / external) vs
  (in-file / internal). Adjacent but not parent.
- **`feedback_verify_target_exists_before_deferring.md`** —
  verify-before-deferring. The grep-whole-file rule has the
  same shape: *verify-before-X-claim*. Specifically:
    - verify-before-deferring: claim = "I'll do X next round"; verify = target-exists.
    - verify-before-fix-complete: claim = "X is fixed"; verify = all-instances-fixed.
  Same `verify-before-claim` parent shape; different specific
  claims and verifications.
- **`feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`**
  — substrate-must-be-reachable. Adjacent (both about claim
  verification) but addresses different claim type
  (durability of work).

**Razor test**: can "grep WHOLE file before declaring fixed"
be dissolved into "verify-before-deferring"? Not directly —
the parent rule is about deferral specifically, this finding
is about fix-completion. But they share a parent shape:
*verify-before-state-claim*.

**Decision**: the right move is NOT to create
`feedback_grep_whole_file_before_declaring_fixed.md`. The
right move is to either (a) extend the verify-before-deferring
file with a sibling rule about fix-completion verification, or
(b) create a small parent file (proposed but not yet written;
working name `feedback_verify_before_state_claim_<date>.md`)
that covers both, with the deferring + fix-completion cases
as worked examples underneath. The file does not exist as of
this PR; the working-name pattern signals "to-be-written"
rather than "already-extant."

I'm leaving the choice between (a) and (b) for the next
class-level encoding moment when one more sub-case appears —
two examples (deferring + fix-completion) is on the boundary
between "extend the existing file" and "promote to parent." A
third example would tilt to (b); right now (a) is sufficient.

This worked example IS the meta-meta-meta rule applied to
itself: I caught my own Layer-3 slip from 0440Z.md and used
Aaron's refinement to fix it before it landed as a new
file.

## Composes with

- **`docs/backlog/P1/081KQGDBJ0008QG0R001JC9HCJ-port-meta-learning-4-layer-pattern-from-stcrm-aaron-2026-05-01.md`**
  — this rule is the meta-meta-meta layer above 081KQGDBJ0008QG0R001JC9HCJ's
  Layer 3 (encode the class). Layer 3 says encode the class;
  this rule says *check existing classes before encoding a
  new one*. Layer-stacking: Layer 1 (fix instance) → Layer 2
  (encode in same PR) → Layer 3 (encode the class) → **THIS
  RULE** (verify the class is orthogonal or extend existing).
- **`memory/feedback_orthogonal_axes_factory_hygiene.md`** —
  Aaron's prior framing about orthogonal axes for factory
  rules. The meta-meta-meta rule applies that orthogonality
  discipline to the class library itself, not just the rules
  *within* the library.
- **`memory/feedback_canon_not_doctrine_star_wars_not_religious_aaron_2026_04_30.md`**
  — canonical-definition machinery. Class-level rules ARE
  canonical entries; same razor applies.
- **`memory/user_aaron_anchor_free_zero_doctrine_pirate_in_life_2026_04_30.md`**
  — Aaron's anchor-free cognitive architecture. Razor
  dissolves mistaken creations; orthogonality earns the
  create.
- **The Aaron-is-Rodney rule** (`memory/feedback_aaron_is_rodney_razor_not_immune_to_canonicalization_aaron_2026_04_30.md`) — Rodney's Razor goes through
  canonicalization itself (no-self-exception). The
  meta-meta-meta rule is itself subject to its own discipline:
  if a future finding shows it's actually a sub-case of an
  existing class (e.g., the canonical-definition machinery
  already implies it), the razor will dissolve this file too.

## Cross-project applicability + maturity-tier split

Aaron noted: *"i'll also make now on the other system"* —
implying this rule applies across his projects, not just
Zeta. The class-level rules in any class library (LFG soulfile,
sibling repos, peer harness rule sets) need the same
orthogonality discipline. The rule itself is portable; the
specific class libraries are not (per the no-copy-only-learning
discipline for sibling repos).

Aaron 2026-05-01 follow-up:

> *"meta-meta-meta rules are the kind of thing [the
> exploit-side project] is not ready for yet, which is why we
> have the split"*

This refines the explore/exploit split (named in chunk-11 of
the CSAP-pushback import + tracked as 081KQGDBJ0008QG0R0022C4ZXA distill row).
The split's load-bearing reason: the explore-side (Zeta) is
where higher-order rule structures (rules-about-rules,
meta-meta-rules, this orthogonality-discipline) are safe to
experiment with; the exploit-side requires settled rules with
known properties. *Same operator, two governors, different
rule-maturity tiers* — the meta-meta-meta level is one of the
features that distinguishes the explore-side governor.

The portability constraint cuts both ways:

- The discipline (this rule's content) IS portable —
  exploit-side can adopt it when ready.
- The specific class library Zeta develops is NOT portable —
  exploit-side has its own surfaces, its own rules, its own
  razor-cuts. Per no-copy-only-learning, only the abstract
  discipline crosses; specific rules stay private to Zeta.

## Higher-kinded types + category theory pointer

Aaron 2026-05-01:

> *"that's like higher kinded types, and you have the book on
> category theory for programming to close that thought /
> archetrue loop to make it math precise for everyting your
> doing in teh PR process"*

The math-precise framing for "rules-about-rules":

- **First-order rules** = rules over instances (instance-level
  bug fixes, individual code patterns).
- **Second-order rules** = rules over first-order rules (Layer
  3 of 081KQGDBJ0008QG0R001JC9HCJ: encode the class). Class-level rules are
  rules-parameterized-by-pattern.
- **Third-order rules** = rules over class-level rules (THIS
  RULE: the orthogonality / extend-vs-create discipline). These
  are HKT-like — the class library is itself a parameterized
  structure, and this rule operates on the structure.

Bartosz Milewski's *Category Theory for Programmers* (the book
Aaron names) provides the math-precise vocabulary: functors,
natural transformations, monads, Kleisli categories,
free constructions. The PR-process discipline that produces
class-level rules from instance-level bugs has a categorical
shape; a category-theory-precise statement of the discipline
would close the loop between the prose-level rule library and
the math substrate.

This is research-grade work, not operational substrate. The
pointer is recorded so future-Otto knows where to look when
the PR process needs math-precise specification (e.g., for
formal verification of substrate canonicalization).

## PR-process as poor-man's immune system at the GitHub-host layer

Aaron 2026-05-01:

> *"i think you'll find it's a poor mans version of our immune
> system withing the github enviornment/host"*

The PR-thread-drain process this session has been
exercising — find suspicious threads (Codex/Copilot findings),
evaluate (real bug vs nit vs misframing), repair or
explain — has the same SHAPE as Aurora's immune-system math
standardization work (`docs/research/aurora-immune-math-standardization-2026-04-26.md`),
but at a different abstraction level:

- **Aurora layer** (substrate-level immune system): PoUW-CC
  grading with Verify · Useful · CultureFit · Provenance ·
  Retractability factors; multi-master BFT consensus;
  cooperative-mode resilience; eventually machine-graded.
- **GitHub-host layer** (this PR process): agent reviewers
  (Codex/Copilot) producing findings; the maintainer-with-AI
  pair evaluating + repairing; threads as the consensus surface;
  manual-graded right now.

Aaron's framing: the github-layer process is a *poor-man's
version* of what Aurora will eventually do machine-graded. The
shape is the same; the maturity-tier is different.

This connects to the cross-project maturity-tier split: the
GitHub-host immune system runs in Zeta's explore-side (where
higher-order discipline is safe to experiment with); the
exploit-side benefits from the *output* of the discipline
(settled class-level rules) without paying the
discovery-process cost.

**Implication for the meta-meta-meta-rule itself**: this rule
is part of the GitHub-host immune system's antibody library.
Each class-level rule is an antibody; this rule governs the
shape and orthogonality of new antibodies; Aurora's eventual
machine-graded version will encode this same discipline
formally.

Composes with `docs/research/aurora-immune-math-standardization-2026-04-26.md`

+ the chunk-11 explore/exploit framing + 081KQGDBJ0008QG0R0022C4ZXA distill row.

## What this rule does NOT do

- Does **not** apply to instance-level fixes. Fixing a single
  bug at instance level doesn't trigger the
  orthogonality-check; only the class-level encoding step
  does.
- Does **not** require an exhaustive search of the class
  library before every Layer-3 encoding. The search is for
  adjacent / parent classes the finding might fit; the bar is
  "did I check 2-3 plausible candidates with the razor
  question," not "did I read every memory file."
- Does **not** create a hierarchy where extension is always
  preferred. Genuine orthogonality is welcome; the rule is
  against *unjustified* creation, not against creation itself.
- Does **not** retroactively merge existing overlapping rules.
  That's a separate hygiene task (cadenced canon-audit per
  the orthogonal-axes rule). This rule is forward-going
  prevention; cleanup is its own work.

## Origin

Aaron 2026-05-01, between two ticks of the autonomous-loop —
the meta-meta-meta refinement was prompted by my own Layer-3
encoding in shard 0440Z (the grep-whole-file lesson). Aaron's
verbatim quote from the tick-close shard cited the encoding,
then immediately added the meta-meta-meta correction. The
substrate-or-it-didn't-happen discipline applies: the rule
lands as a memory file, with the worked-example showing the
rule applied to itself.
