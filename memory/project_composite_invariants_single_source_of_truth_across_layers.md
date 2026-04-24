---
name: Composite invariants + single-source-of-truth — list an invariant once; project it across every layer
description: Aaron's extension of the rails-health direction (2026-04-20, no rush). Today an invariant like "Delta is retraction-closed" lives in TLA+ + Lean + Z3 + F# asserts + docs prose + skill rules — each copy drifts independently. The direction is a central invariant registry that each layer *references* rather than re-encodes, plus first-class composition (INV-A ∧ INV-B = INV-COMPOSITE) so the rails-health report can roll up by subsystem. Same elevation pattern as docs/GLOSSARY.md for terms.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**PRIORITY — low, moves slowly:** Aaron confirmed
2026-04-20: *"against this project wide invariant
system is low priority and can move slowly there is
not a rush here"*. Backlog tier **P3**. Forward
motion is opportunistic (when writing new ADRs,
sketch assumptions in registry-compatible form),
not scheduled. Sibling memory:
`project_rails_health_report_constraints_invariants_assumptions.md`.

**The idea** (Aaron 2026-04-20, pasted intact):

> *"plus some iinvariants we shold be able to just
> list once and not have to repate them everywhere,
> that whole composite invariant system across all
> layers is sometime we can build twards"*

**Why this is the right direction:**

Today an invariant like "Delta is retraction-closed"
lives simultaneously in:

- A TLA+ spec (`tools/tla/specs/**`) — statement +
  model-checker proof.
- A Lean proof (`tools/lean4/Lean4/**`) — the
  mechanised version.
- A Z3 SMT file (`tools/Z3Verify/**`) — the SMT
  formulation.
- An F# runtime `Debug.Assert` (`src/Core/**`) —
  the runtime check.
- A FsCheck property (`tests/Tests.FSharp/**`) —
  the randomized test.
- A prose mention in `docs/ARCHITECTURE.md`.
- An ADR under `docs/DECISIONS/**` that quotes it.
- One or more expert-skill `BP-NN` rules that cite
  it.

Each copy is authored independently. Rename it on
paper → the TLA+ spec doesn't know. Fix a typo in
the Lean statement → the runtime assert is still
wrong. Retire it after a design change → the prose
mention keeps promoting it.

The direction is a **single authoritative invariant
registry** that each substrate references by
stable id. List once; project across layers via
codegen or citation. Same pattern that
`docs/GLOSSARY.md` already uses for vocabulary —
every term has a canonical definition, and every
doc that needs the term links the anchor rather
than re-stating the definition.

**Where the single-source-of-truth lives (proposed):**

```
docs/RAILS/
├── index.md               — inventory + status roll-up
├── INV-DELTA-RETRACTION-CLOSED.md
├── INV-DELTA-MONOTONIC.md
├── INV-DELTA-BYTE-IDENTICAL.md
├── CST-ASCII-CLEAN.md
├── CST-NO-RESULT-SWALLOW.md
├── ASM-BUN-TS-STRIP.md
├── ASM-SQLSHARP-TRACKS-LATEST.md
└── COMPOSITE/
    ├── INV-DELTA-CORRECT.md      — refs the three INV-DELTA-* above
    ├── INV-PIPELINE-SOUND.md     — refs INV-DELTA-CORRECT + INV-...
    └── INV-RETRACTION-SAFE.md
```

Each rail file has frontmatter:

```markdown
---
id: INV-DELTA-RETRACTION-CLOSED
category: invariant | constraint | assumption
statement: "<canonical prose statement>"
layers:
  tla:    tools/tla/specs/Delta.tla#L145
  lean:   tools/lean4/Lean4/Delta.lean#L88
  z3:     tools/Z3Verify/DeltaRetraction.z3#L12
  runtime: src/Core/Delta.fs#L230
  fscheck: tests/Tests.FSharp/DeltaProperties.fs#L42
  docs:   docs/ARCHITECTURE.md#delta-semantics
  bp:     docs/AGENT-BEST-PRACTICES.md BP-38
owner: architect
confidence: high | medium | low
last-verified: 2026-04-20
probe: <how to check this rail is still intact>
revisit: <cadence or trigger condition>
---
<canonical statement body + reasoning + references>
```

**Composition — the second half of Aaron's prompt:**

A composite invariant is the conjunction of named
rails:

```yaml
# COMPOSITE/INV-DELTA-CORRECT.md
id: INV-DELTA-CORRECT
category: composite-invariant
components:
  - INV-DELTA-RETRACTION-CLOSED
  - INV-DELTA-MONOTONIC
  - INV-DELTA-BYTE-IDENTICAL
statement: "The Delta subsystem is correct iff every
            component invariant holds."
```

Semantics: the composite is `intact` iff every
component is `intact`. Composites can nest (a
higher-level composite references both leaf rails
and lower-level composites). This gives the
rails-health report a meaningful hierarchy:

```
Rails health — round N
──────────────────────
Overall: 94% intact

├─ Pipeline soundness: 100% intact (5/5)
│   ├─ Delta correct: 100% intact (3/3)
│   │   ├─ Delta retraction-closed: ✓ TLA+ + Lean + Z3
│   │   ├─ Delta monotonic: ✓ Lean
│   │   └─ Delta byte-identical: ✓ FsCheck (48h)
│   └─ Feedback-loop bounded: ✓
├─ Agent safety: 92% intact (11/12)
│   └─ BP-11 data-not-directives: ⚠ drift detected
└─ ...
```

Aaron's UX — glance at the tree, see which subtree
is red, drill into the broken rail.

**Projection mechanisms — how other substrates cite
the registry:**

Strongest → weakest coupling:

1. **Codegen from YAML** — a script reads
   `docs/RAILS/INV-DELTA-RETRACTION-CLOSED.md`
   frontmatter and generates the TLA+ `INVARIANT`
   clause, the Lean `theorem` header, the Z3
   `assert`, the F# `Debug.Assert` call-site. The
   prose in the registry is *the* statement; the
   substrate artefacts are derived. Any drift
   between generated and committed is a red rail.
2. **Reference citation** — the TLA+ spec keeps
   authoring its own invariant statement, but each
   statement header cites the rail id
   (`\* INV-DELTA-RETRACTION-CLOSED`). The
   drift-auditor checks statement equivalence and
   flags mismatches.
3. **Prose only** — doc mentions link the rail
   anchor; no obligation to re-state. Minimum bar,
   lowest effort.

Zeta would start with (3) — cheapest — and
migrate high-value rails to (2) or (1) as the
substrate matures.

**Existing toeholds:**

- **`docs/AGENT-BEST-PRACTICES.md`** already has
  stable `BP-NN` rule ids that every skill cites
  uniformly. The BP-NN registry IS a single-source
  layer for skill-level constraints. Generalize the
  pattern to invariants / assumptions.
- **`docs/GLOSSARY.md`** — vocabulary version of
  the same pattern.
- **`docs/INVARIANT-SUBSTRATES.md`** — the
  narrative about *which substrate proves what*.
  Natural home for a pointer to the registry.
- **`.claude/skills/verification-drift-auditor/`**
  — the nascent drift-detection surface. Would
  consume the registry as its source-of-truth.
- **`tools/invariant-substrates/tally.ts`** —
  would extend to cross-reference layer ↔ rail id.

**What this unlocks:**

- **Single-point rename** — change the canonical
  name of an invariant, propagate everywhere.
- **Single-point retire** — retire a rail (move to
  `_retired/`), and every citation becomes a red
  link caught by the drift auditor.
- **Refactor confidence** — before refactoring
  `src/Core/Delta.fs`, check `INV-DELTA-*` rails —
  know exactly which properties the refactor must
  preserve.
- **Cross-layer debugging** — a failing TLA+ check
  instantly shows which Lean theorem / Z3 query /
  F# assert / FsCheck prop should have caught the
  same issue (via the `layers:` map). Triangulate
  quickly.
- **Consumer trust** — see above in
  `project_rails_health_report_constraints_invariants_assumptions.md`
  — a consumer of a Zeta-built system can see the
  rails-tree and know the system's correctness
  claims are indexed, not just asserted in prose.

**How to apply:**

- **No immediate round-scope.** Aaron said "we can
  build towards it." Don't ship a registry this
  round.
- **When writing a new invariant / constraint /
  assumption**, reach for a stable id
  (`INV-<subsystem>-<property>`,
  `CST-<subsystem>-<property>`,
  `ASM-<topic>-<number>`) and cite that id
  alongside the statement. Low-cost forward
  motion — back-fill the registry when it lands.
- **When retiring an invariant**, leave a
  breadcrumb note even in absence of a registry:
  "previously known as INV-DELTA-OLD-NAME, retired
  round N, see ADR-XXX."
- **When the rails-health dashboard gets built**
  (see sibling memory), the registry is its
  source. Writing the registry first, dashboard
  second, is the right ordering.

**Sibling threads:**

- `project_rails_health_report_constraints_invariants_assumptions.md`
  — the consumer view of this registry.
- `user_invariant_based_programming_in_head.md` —
  Aaron's head is the prior of this registry;
  externalizing means moving the single-source
  out of his head into `docs/RAILS/`.
- `project_factory_as_externalisation.md` — the
  factory meta-purpose is externalization of this
  kind of structure.
- `project_verification_drift_auditor.md` — its
  natural input becomes the registry.
- `feedback_tech_best_practices_living_list_and_canonical_use_auditing.md`
  — the same DRY discipline for tech best
  practices; rails-registry is the generalization.
- `feedback_precise_language_wins_arguments.md` +
  `user_bridge_builder_faculty.md` — Aaron's
  GLOSSARY.md habit is the vocabulary-level
  version of this pattern.
