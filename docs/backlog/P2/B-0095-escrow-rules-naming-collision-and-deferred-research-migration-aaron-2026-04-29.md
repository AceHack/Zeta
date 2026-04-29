---
id: B-0095
priority: P2
status: open
title: Escrow — define rules + resolve naming collision with software-vendoring sense + migrate other deferred research from backlog/research/
tier: factory-hygiene
effort: M
ask: Aaron 2026-04-29 — *"backlog add other stuff we need from backlog research to escrow, we also needs rules for what goes in here, shit that's not ready yet, we've also overloaded escrow for this use and the use in software engineering for having copies of all our dependies local native incase the remote dependence disappears kind of like vendoring from the old go days (not exactly, there are modern software escrow too)  backlog"*
created: 2026-04-29
last_updated: 2026-04-29
composes_with:
  - B-0094
  - PR-714
tags: [aaron-2026-04-29, escrow, naming-collision, factory-hygiene, deferred-research, vocabulary, vendoring]
---

# B-0095 — Escrow rules + naming-collision resolution + deferred-research migration

## Source

Aaron 2026-04-29 input after the B-0094 escrow PR landed:

> *"backlog add other stuff we need from backlog research to
> escrow, we also needs rules for what goes in here, shit
> that's not ready yet, we've also overloaded escrow for this
> use and the use in software engineering for having copies of
> all our dependies local native incase the remote dependence
> disappears kind of like vendoring from the old go days (not
> exactly, there are modern software escrow too)  backlog"*

Three distinct sub-asks wrapped in one input.

## Why P2

The escrow primitive landed in B-0094 / PR #714 (research-deferred
thesis preservation). It will be reused. Without (a) clear rules
for entry, (b) naming-collision resolution, and (c) population
from existing deferred research, the primitive risks becoming
either an inconsistent grab-bag OR confusing maintainers reading
the directory.

## Sub-ask 1: Naming collision

The word "escrow" is overloaded between two distinct senses:

1. **Research-grade preservation escrow** (the B-0094 sense
   landing today). Bounded preservation of a not-yet-ready
   thesis until it earns operational landing through a
   defined gate.
2. **Software-engineering escrow / vendoring** (Aaron's
   reference). Local copies of dependencies kept native to
   the project so the project survives the remote
   disappearing. Modern software escrow + Go's old `vendor/`
   directory are both in this family.

Aaron flagged the overload. Resolution required.

Options:

- **Option A: Rename the research preservation directory.**
  e.g. `docs/research/deferred/` or `docs/research/parking-lot/`
  or `docs/research/reservoir/` — pick a term less collision-
  prone with software-engineering vocabulary.
- **Option B: Disambiguate via prefix.** Keep `docs/research/
  escrowed/` but add a top-level rule that this directory is
  for research-grade preservation, distinct from the software-
  engineering-vendoring sense. The vendoring-adjacent surface
  in this repo is `references/upstreams/` (read-only clones
  from sibling repos per the operational rule in
  `docs/AGENT-BEST-PRACTICES.md` "Operational standing rules"
  section); GOVERNANCE.md §23 separately governs upstream
  open-source contributions via sibling `../` clones, which
  is a related-but-distinct workflow (sibling clones live at
  `../`, not under `references/upstreams/`).
- **Option C: Name both senses explicitly** in a glossary
  entry — research-escrow vs vendor-escrow vs dependency-
  escrow — and let the directory name stay if the glossary
  carries the disambiguation.

Recommend running through `naming-expert` to pick the best
option. Aaron's framing suggests at least surface the
disambiguation — even if directory name stays, the docs
need to acknowledge the overload.

## Sub-ask 2: Define rules for what goes in escrow

The B-0094 row defined escrow shape for the specific Aurora
flywheel thesis. The general rule is implicit. Make it
explicit.

Candidate rules (to be ratified through ADR or skill-creator):

1. **Eligibility**: substrate is escrow-eligible when (a) it
   is conceptually substantive enough to warrant preservation,
   (b) it has a defined gate that would unblock it, and (c)
   landing it as active substrate now would cause a known
   failure mode (synthesis-treadmill, premature canonization,
   carrier-laundering, etc.).
2. **Required schema**: every escrow file has
   - §33 archive header (Scope/Attribution/Operational status =
     research-grade/Lifecycle status = escrowed/Non-fusion
     disclaimer)
   - Status header block at top (Status / Gate / Reopen
     condition / Multi-AI loop policy / Expiration / Created /
     Last surfaced)
   - Falsifier gate explicitly defined
   - Expiration trigger (X substantive rounds) named
   - Non-activation rule (what the file does NOT authorize)
3. **Single canonical home**: `docs/research/escrowed/`
   (subject to sub-ask 1 outcome).
4. **No-multi-reviewer-loop default**: while escrowed,
   substrate may not be sent through multi-AI synthesis loops.
5. **Bilateral clarification carve-out**: Aaron + agent may
   discuss escrowed substrate.
6. **Implementation work allowed**: prototype / falsifier-
   gate work is allowed during escrow.
7. **Explicit decision required at expiration**: no auto-
   extend; surfaced escrow demands one of four decisions
   (extend / run prototype / revise / retire).

These rules already live implicitly in B-0094's body. Promote
to a `docs/research/escrowed/README.md` (or equivalent contract
doc) as a real rule-set future agents can cite.

## Sub-ask 3: Migrate deferred research

Aaron asks for "other stuff we need from backlog research to
escrow" — items currently filed elsewhere that match the
escrow shape.

Audit candidates (NOT yet exhaustive — survey work pending):

- `docs/backlog/P2/B-0089-veridicality-rainbow-table-canonicalization-research-and-graduation-aaron-ani-amara-2026-04-28.md`
  — graduation roadmap with a falsifier gate. Possibly
  escrow-eligible if its work is "not ready yet."
- `docs/backlog/P2/B-0090-cadenced-lost-substrate-recovery-audit-aaron-2026-04-28.md`
  — operational rather than research; probably stays in
  backlog/.
- `docs/research/aurora-immune-governance-bridge-minimal-2026-04-28.md`
  — already landed as active research; NOT escrow-eligible
  (it's the prototype gate for B-0094).
- Various Amara ferry-pending-absorb rows (if any are still
  open with un-absorbed research that has a clear gate).

Audit work: read every open backlog row in
`docs/backlog/P*/` + every research note in
`docs/research/` not under `escrowed/`, and classify:
ESCROWABLE / STAYS-IN-BACKLOG / STAYS-AS-ACTIVE-RESEARCH /
RETIRE.

## Acceptance

- [ ] Sub-ask 1: naming collision resolved (option A / B / C
      chosen + applied; `naming-expert` consulted).
- [ ] Sub-ask 2: `docs/research/escrowed/README.md` (or
      equivalent rule-set doc) lands with the 7 candidate
      rules above (refined via skill-creator or ADR).
- [ ] Sub-ask 3: audit of existing deferred-research items
      complete; eligible items migrated to escrow with full
      schema; ineligible items retain their current home with
      rationale documented.

## Why M effort

Each sub-ask is S-effort individually (a glossary entry / one
small README / per-item migrations). Together they're an M.
Could split into three rows; consolidating because Aaron's
input was one wrapper.

## Composes with

- **B-0094** — the worked example escrow. Schema this row
  formalizes is what B-0094 implicitly defined.
- **PR #714** — the in-flight PR landing the file at
  `docs/research/escrowed/aurora-autonomous-flywheel-thesis-2026-04-28.md`
  (path becomes canonical when PR #714 merges).
  Naming-collision resolution (sub-ask 1) may rename the
  directory; if so, the file moves with it.
- **GOVERNANCE.md §33** — archive-header schema the escrow
  contract must compose with.
- **GOVERNANCE.md §23** — upstream OSS contributions via
  sibling `../` clones; relevant context for sub-ask 1's
  vocabulary disambiguation but NOT the authority for
  `references/upstreams/` being a vendoring home (the
  operational rule for that surface lives in
  `docs/AGENT-BEST-PRACTICES.md` "Operational standing
  rules" section).

## What this row does NOT authorize

- Does NOT authorize moving the existing B-0094 escrow file
  before sub-ask 1 (naming-collision) is resolved. Until then,
  the file stays at `docs/research/escrowed/aurora-autonomous-
  flywheel-thesis-2026-04-28.md` per the in-flight PR #714.
- Does NOT authorize bulk-migrating backlog rows to escrow
  before sub-ask 2 (rules) lands. Without rules, migrations
  are arbitrary.
- Does NOT authorize creating new escrow content beyond the
  in-flight B-0094 work.

## Pickup for future Otto

If picking up this row:

1. Run `naming-expert` on sub-ask 1; surface options to Aaron
   for decision.
2. Draft `docs/research/escrowed/README.md` with the 7
   candidate rules; route through skill-creator workflow OR
   land as ADR + small README.
3. Audit deferred-research items per sub-ask 3 surface; file
   migration PRs one at a time.

Each step is bounded; do not stack.
