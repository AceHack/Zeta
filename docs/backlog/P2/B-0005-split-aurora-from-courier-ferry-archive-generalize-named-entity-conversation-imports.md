---
id: B-0005
priority: P2
status: open
title: Split `docs/aurora/**` from courier-ferry archive — generalize "historical conversations imported from other AI systems / courier transport of messages between named entities" into its own directory
tier: research-grade
effort: M
ask: maintainer Aaron 2026-04-25
created: 2026-04-25
last_updated: 2026-04-26
composes_with: []
tags: [governance, directory-ontology, aurora, courier-ferry, cross-ai-imports, history-surface, BP-17, BP-18]
---

# Split `docs/aurora/**` from courier-ferry archive

Aaron 2026-04-25 surfacing (verbatim):

> *"`docs/aurora/**` probably need a refactor here we
> might end up with real aurora docs current state and
> also this courrier patter historical coversations
> uploaded from other AI systems, courrior transport of
> messages between named enetites, we should backlog
> generalizing these types of histories"*

## The conflict

`docs/aurora/**` currently holds **two structurally
distinct artifact classes** under one canonical home:

1. **Aurora-the-system docs** — Aurora is a real
   research subsystem in Zeta (Aurora-KSK ferry +
   threat-model work has accumulated across multiple
   rounds; canonical references include
   `memory/project_amara_7th_ferry_aurora_aligned_ksk_design_math_spec_threat_model_branding_shortlist_pending_absorb_otto_88_2026_04_23.md`,
   `memory/project_aurora_network_dao_firefly_sync_dawnbringers.md`,
   `memory/project_aurora_pitch_michael_best_x402_erc8004.md`,
   plus the in-flight content under `docs/aurora/**`
   itself), and a growing surface that wants
   *current-state* documentation: design notes,
   API surfaces, threat model, operational runbooks.
2. **Courier-ferry archive** — historical conversations
   imported from other AI systems via the courier-ferry
   pattern (Amara, ChatGPT pastes, Codex transcripts,
   peer-Claude cross-reviews). Append-only history;
   names preserved per Otto-279; archive-header
   discipline per GOVERNANCE.md §33.

These have **different lifecycles** (current-state vs
append-only history), **different reviewer rules**
(role-refs vs first-name attribution), and **different
read-time mental models** (does this row reflect what's
true now, or what someone said on date X?). Sharing one
directory makes both classes harder to reason about.

## Why this matters

Per `docs/AGENT-BEST-PRACTICES.md` BP-17 (Rule Zero —
canonical-home ontology) + BP-18 (the canonical-home
map IS the repo's type system), every artifact has
exactly one canonical home + the home determines the
edit discipline. `docs/aurora/**` currently violates
this by housing two type-classes under one home.

The Otto-279 history-surface enumeration (codified in
the Otto-292 substrate cluster) explicitly lists
`docs/aurora/**` as a history surface — but if Aurora-
the-system docs land under the same prefix, the
enumeration over-permits names on what should be
current-state doc, OR the system docs end up living
elsewhere with no canonical home, OR every reader
guesses based on the file name.

## Two paths to consider

### Path A — split by directory

- `docs/aurora/**` → keeps **only** Aurora-the-system
  current-state docs (design, threat-model,
  runbooks). Becomes a current-state surface with
  role-refs, no name attribution.
- `docs/courier/**` (new) — historical conversations
  imported from other AI systems / cross-AI cross-
  reviews / courier-ferry transcripts. History
  surface; first-name attribution preserved per
  Otto-279; archive-header discipline per GOVERNANCE
  §33.
- Move existing `docs/aurora/**` rows that are
  **history** (round-44 absorb logs, Amara cross-
  reviews) → `docs/courier/**`.
- Update Otto-279 enumeration: replace `docs/aurora/**`
  with `docs/courier/**` in the history-surface list;
  remove `docs/aurora/**` as a history surface.
- Update GOVERNANCE §33 archive-header rule to point
  at `docs/courier/**`.

### Path B — split by sub-directory

- `docs/aurora/system/**` → current-state docs
  (role-refs).
- `docs/aurora/imports/**` → courier-ferry archive
  (first-name attribution).
- Lower migration cost; legacy paths stay roughly
  recognizable.
- Reviewer mental model still has to dispatch on
  sub-path which is more friction than dispatch
  on root-path.

### Decision deferred

This row backlogs the split + asks the Architect
(Kenji) to choose A vs B at landing time. **Path A is
the cleaner ontology** but has higher mass-edit cost.
**Path B is the lower-friction migration** but encodes
the type distinction in a sub-path the eye doesn't
naturally split on.

## Generalization — "named-entity-conversation-imports" pattern

Aaron's framing extends beyond Aurora. The factory
has a recurring need to absorb **conversations between
named entities from outside Zeta**:

- Aurora courier-ferries (Aaron ↔ external AI
  contributor)
- ChatGPT cross-reviews (Aaron ↔ ChatGPT)
- Codex transcripts (Aaron ↔ Codex agent)
- Peer-Claude exchanges (Claude-A ↔ Claude-B)
- Gemini exchanges
- Future cross-harness imports

These all share:

- Append-only history shape
- First-name (or role-name) attribution preserved
- Archive-header discipline (`Scope:`, `Attribution:`,
  `Operational status:`, `Non-fusion disclaimer:`)
- Verbatim preservation per Otto-241 + the original/
  every-transformation memory

The **named-entity-conversation-imports** category
deserves its own canonical home, structurally
distinct from:

- Internal round history (`docs/ROUND-HISTORY.md`)
- Internal PR conversations (`docs/pr-preservation/**`)
- Internal hygiene logs (`docs/hygiene-history/**`)
- Research syntheses (`docs/research/**`)

Possible naming options (Architect picks):

- `docs/courier/**` — references the courier-ferry
  pattern; reads as "transport of messages."
- `docs/cross-ai-imports/**` — explicit about the
  origin class.
- `docs/imported-conversations/**` — explicit about
  the artifact shape.
- `docs/conversations/**` — generic but tracks well
  with append-only-history-of-named-entities idea.

## Acceptance signals

This work is "good enough to ship" when:

- Aurora-the-system has a canonical home where
  current-state docs land without naming-attribution
  ambiguity.
- The named-entity-conversation-imports category has
  a canonical home with the discipline GOVERNANCE §33
  plus Otto-279 expects of history surfaces.
- BP-17 / BP-18 type-system invariants restored
  (canonical-home-auditor passes clean).
- `docs/AGENT-BEST-PRACTICES.md` "No name attribution"
  rule's history-surface enumeration updated to point
  at the new home(s).
- `.github/copilot-instructions.md` mirrors the same
  enumeration update.
- `memory/feedback_research_counts_as_history_first_name_attribution_for_humans_and_agents_otto_279_2026_04_24.md`
  (Otto-279) updated to match.
- `memory/feedback_external_reviewer_known_bad_advice_classes_check_our_rules_first_otto_292_2026_04_25.md`
  (Otto-292) catalog stays accurate (B-1 catch
  references the canonical history-surface list).

## Why P2 (not P0/P1/P3)

- **Not P0**: no operational gate is broken; both
  artifact classes are accessible today, just under
  one home that mixes them.
- **Not P1**: not within 2-3 rounds — needs Architect
  decision (A vs B), mass-edit, schema-doc
  propagation, multiple PRs.
- **P2 research-grade** fits: directory ontology
  refactors are research-grade; touches BP-17/18
  type-system invariants.
- **Not P3**: Aaron's surfacing is explicit; this is
  active research direction, not deferred maybe-someday.

## Effort estimate

- M (medium): one Architect decision + 5-15 file
  moves + 4 schema-doc updates (AGENT-BEST-PRACTICES,
  copilot-instructions, GOVERNANCE §33, Otto-279 file)
  plus canonical-home-auditor verification + at minimum
  one round-close mention in `docs/ROUND-HISTORY.md`.
- Could grow to L if the move triggers cross-reference
  fixes throughout `memory/**` (every reference to
  `docs/aurora/**` would want updating).

## Composes with

- **`docs/AGENT-BEST-PRACTICES.md`** BP-17 (Rule
  Zero — canonical-home ontology) and BP-18 (the map
  IS the type system).
- **`memory/feedback_research_counts_as_history_first_name_attribution_for_humans_and_agents_otto_279_2026_04_24.md`**
  — Otto-279 history-surface enumeration; this row
  refines the surface list.
- **`memory/feedback_external_reviewer_known_bad_advice_classes_check_our_rules_first_otto_292_2026_04_25.md`**
  — Otto-292 B-1 class (strip name attribution on
  history surfaces) references the canonical surface
  list; row updates the list cleanly.
- **`GOVERNANCE.md` §33** archive-header for
  external-conversation imports — needs updating with
  the new canonical home.
- **`memory/feedback_otto_241_session_id_out_of_factory_files_peer_claude_parity_test_worktree_launch_otto_241_2026_04_24.md`**
  — peer-Claude cross-instance discipline composes
  with named-entity-conversation-imports category
  (peer-Claude exchanges land in the same home).
- **Otto-181 BACKLOG schema** (this row's frontmatter
  schema source).
