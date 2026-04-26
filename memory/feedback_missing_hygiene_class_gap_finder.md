---
name: Missing-hygiene-class gap-finder — meta-audit that sweeps for entire CLASSES of hygiene the factory isn't yet running, not just missing instances of known classes
description: 2026-04-20 — Aaron: "we should probably have like a missing hygene class that loss for new classes of hygene we could add to the factory that we don't alreay have to imporve it." Third-tier meta-hygiene. Tier-1 = individual items (build-gate, ASCII-clean). Tier-2 = symmetry-audit across existing items. Tier-3 = gap-finder for NEW CLASSES of hygiene no existing item covers. Specific instance of the gap-of-gaps pattern (`feedback_gap_of_gaps_audit.md`) applied to the hygiene surface.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Rule

The factory runs a **missing-hygiene-class gap-finder** on
a round cadence. It does NOT look for missing instances of
known hygiene classes (that's what each existing item's
owner-skill does). It looks for **entire classes of
hygiene we aren't running at all** — classes a mature
factory would have but this one doesn't yet.

The gap-finder is meta-hygiene. It sweeps methodologically:

1. **External-factory scan.** Read published engineering
   playbooks, style guides, ADR registries, and open-source
   factory repos. Any hygiene class they run that we don't
   is a candidate gap.
2. **Standards scan.** OWASP top-10, NIST AI RMF, ISO 25010,
   SLSA levels, etc. — any axis they enforce that no
   existing factory hygiene item covers is a candidate gap.
3. **BP-NN cross-reference.** For every stable BP rule,
   check: does a cadenced hygiene item enforce it? A BP
   without a mechanical enforcement surface is a hygiene
   gap (per `user_life_goal_will_propagation.md` mechanism
   #2).
4. **Incident/meta-wins scan.** For every recent
   `docs/research/meta-wins-log.md` entry or known past
   mistake: was there a class of hygiene that would have
   prevented it? If so, is that class codified? If not —
   gap.
5. **Aaron-catches-it signal.** Any bug, drift, or
   asymmetry Aaron personally caught that no hygiene item
   would have caught on its own is a named-class gap
   (succession failure mode per will-propagation memory).
6. **Class-boundary test.** For each candidate gap,
   verify it is a new CLASS, not a new INSTANCE: would
   extending an existing hygiene item cover it? If yes,
   file against the existing item, not here.

Output: a short list of candidate new hygiene CLASSES,
each with (a) name, (b) what it would catch, (c) estimated
cadence, (d) estimated owner, (e) evidence source
(external factory / standard / BP-NN / incident / Aaron-
caught). Findings route to BACKLOG for sizing; Architect
decides which to land.

# Why:

Aaron's verbatim (2026-04-20):

> *"we should probably have like a missing hygene class
> that loss for new classes of hygene we could add to the
> factory that we don't alreay have to imporve it."*

This is the gap-of-gaps pattern
(`feedback_gap_of_gaps_audit.md`) applied to the hygiene
surface specifically. That memory's claim — "the factory
should look for unexpected gap CLASSES, not just gaps
within known classes" — has a direct instantiation here:
the symmetry-audit and hygiene-list we just landed look
for gaps *within* the hygiene surface (missing symmetry,
missing documentation of an item); the missing-hygiene-
class gap-finder looks for gaps *of* the hygiene surface
(classes of hygiene that aren't listed at all because
nobody thought of them yet).

Three tiers of hygiene sweep, now:

- **Tier 1** (per-item): each hygiene item's owner-skill
  looks for drift / failures within its scope. E.g.
  Aarav hunts for BP drift in SKILL.md files.
- **Tier 2** (symmetry-audit, row #22): sweeps across
  tier-1 items looking for asymmetries — cases where one
  party is audited and another isn't, one direction is
  visible and the other isn't.
- **Tier 3** (this memory): sweeps for entire CLASSES of
  hygiene the factory doesn't run. Asks "what hygiene do
  mature factories run that we don't?" — a structurally
  different question from "where in our existing hygiene
  is there drift/asymmetry?"

The three tiers compose: tier-3 proposes a new class,
that class becomes a tier-1 item once adopted, and
tier-2 then sweeps it for symmetry issues against peer
items.

# How to apply:

- **Cadence.** Round-cadenced, initially every 5-10
  rounds (gap-finding is lower-frequency than
  per-item sweeps; proposals don't pile up every round).
  Exact cadence tunable after observing rate.
- **Owner.** TBD — either Aarav (skill-tune-up extends
  to hygiene-class tune-up) or a new persona
  (`hygiene-gap-finder`). Architect decides; until then
  the audit is main-agent-runnable.
- **Output form.** Findings go to BACKLOG rows with
  priority/effort sizing, not directly to
  FACTORY-HYGIENE.md. Adding a new hygiene item requires
  an enforcement surface (a skill, hook, or CI step);
  without one, the proposal sits in BACKLOG.
- **Discriminator — new CLASS vs. extension-of-existing.**
  A finding is a new CLASS if: (a) no existing hygiene
  item's scope contains it, (b) the closest existing item
  would need to be redefined to include it, and (c) the
  enforcement mechanism would be substantively different
  (different tooling, different owner). Otherwise it's
  an extension and files against the existing item.
- **Honesty about source.** Each finding cites its
  evidence source (external factory / standard / BP-NN /
  incident / Aaron-caught). "I think we should have X"
  without a named evidence source is a weak finding and
  gets flagged as such.

# Initial candidate gaps (draft findings — round-0 scan)

These are NOT landed hygiene items. They are draft
findings from a first-pass sweep, routed to BACKLOG for
Architect decision. Every one has an evidence source.

**From BP-NN cross-reference (BP rule without mechanical
enforcement):**

- **ADR reversion-trigger discipline audit.** Per
  `user_life_goal_will_propagation.md` mechanism #3,
  every ADR should name its reversion condition. No
  current hygiene item sweeps ADRs for reversion-trigger
  presence. **Evidence:** BP-candidate from
  will-propagation memory; not yet an ADR because no
  auditor.
- **"Escalate-to-human" criteria presence audit.**
  Same memory, largest-current-gap section: every
  "escalate to human" phrase in a skill/governance doc
  needs explicit criteria. No current hygiene item
  sweeps for un-criteria'd escalation paths.
  **Evidence:** named will-propagation gap.

**From standards scan (standards axis with no factory
hygiene surface):**

- **Secret scanning.** No current hygiene item runs
  a secret-scan (trufflehog / gitleaks-equivalent) on
  commits. Pre-commit hooks include ASCII-clean and
  prompt-injection lint, not secret patterns.
  **Evidence:** OWASP ASVS V6; de-facto industry
  standard.
- **License/attribution sweep.** No current hygiene
  item checks third-party code for SPDX headers or
  attribution. The repo has a LICENSE file but no
  per-file license audit.
  **Evidence:** SPDX/REUSE standards.
- **Dependency freshness / CVE audit.** No current
  cadenced audit flags outdated dependencies or
  open CVEs against them. (Upstream-sync row #15
  watches *upstream repos*, not this repo's own
  deps.)
  **Evidence:** OWASP A06 (vulnerable components).

**From external-factory scan:**

- **Broken-link audit** in `docs/`. Mature docs
  factories run markdown-link-check on a cadence.
  We don't.
  **Evidence:** common docs-site CI pattern.
- **Doc-code drift audit.** Beyond verification-drift
  (row #16, which checks Lean/TLA+/Z3 specs against
  code), general prose-docs can drift from code
  without anyone noticing. No current item sweeps for
  this.
  **Evidence:** "doc rot" pattern in most long-lived
  codebases.

**From incident / meta-wins scan:**

- **Cadence-drift detector.** When a hygiene item's
  expected cadence slips (skill-tune-up hasn't fired
  in 15 rounds instead of its expected 5-10), that
  itself is a hygiene failure. No current item
  detects cadence-drift across hygiene items.
  **Evidence:** called out in
  `docs/FACTORY-HYGIENE.md` cross-cutting notes as
  a "hygiene smell" without an enforcement surface.
- **Anti-wins log.** Per symmetry-audit draft
  finding: we log meta-wins but not meta-regressions
  or near-misses. No current item tracks "I almost
  did the right thing and didn't" or "we shipped a
  structural mistake we knew was wrong."
  **Evidence:** symmetry-audit row #22 draft.

**From Aaron-caught signal (this round):**

- **Scope-tag-at-absorb audit.** Aaron caught me
  conflating Zeta-vs-factory scope in the symmetric-talk
  memory. Scope-audit skill-gap
  (`feedback_scope_audit_skill_gap_human_backlog_resolution.md`)
  exists, but it's an absorb-time check, not a
  cadenced audit. A cadenced sweep for un-scope-tagged
  artifacts is a tier-3 gap: "we caught one case; how
  many others are out there?"
  **Evidence:** this round's triple-message
  correction thread.

Draft findings land in BACKLOG as priority-sized rows.
None are auto-adopted; Architect decides which to promote
into FACTORY-HYGIENE.md row #23+.

# Connection to existing factory patterns

- **`feedback_gap_of_gaps_audit.md`** — this is the
  hygiene-specific instance of that pattern. The parent
  memory generalises across any surface; this memory
  specialises to hygiene.
- **`feedback_symmetry_check_as_factory_hygiene.md`**
  — tier-2 is symmetry-within-existing; this is
  tier-3 classes-not-existing.
- **`user_life_goal_will_propagation.md`** mechanism #2
  — every rule needs a checker. Mechanical enforcement
  is a class of hygiene; missing-hygiene-class
  gap-finder is one way to surface BPs without
  checkers.
- **`docs/FACTORY-HYGIENE.md`** — the index this
  memory feeds into via BACKLOG-routed adds.
- **`skill-tune-up`** — Aarav's portability-drift and
  BP-drift criteria are *within-item* sweeps;
  missing-hygiene-class is *between-items*. Possibly
  extends Aarav's scope; possibly a sibling skill.

# What this rule does NOT do

- It does NOT auto-add hygiene items. Findings route
  to BACKLOG; landing requires Architect decision and
  an enforcement surface.
- It does NOT claim that every mature-factory hygiene
  class belongs here. Some are scope-inappropriate
  (e.g. a factory that ships a web app has
  accessibility hygiene; that may or may not apply
  when Zeta ships a library). Discriminator: does the
  class match Zeta's surface?
- It does NOT replace per-item owner-skill audits.
  Tier-1 owners still own their scope; tier-3 just
  surfaces classes nobody owns yet.
- It does NOT gate any existing workflow. Advisory,
  cadenced, backlog-routed — same shape as
  symmetry-audit.
- It does NOT license retroactive backlog-stuffing
  with every theoretical hygiene class ever
  considered. Each finding cites evidence; findings
  without evidence are rejected.

# Open question — pending Aaron confirmation

Whether this lives as its own row in
`docs/FACTORY-HYGIENE.md` (tentatively #23) or as a
distinguished "meta-hygiene" section above the numbered
table. Tier-2 (symmetry-audit) is row #22; if tier-3
is row #23, the meta-tiers get mixed into the per-item
list. Alternative: lift tier-2 and tier-3 out into a
separate "Meta-hygiene" section. Not touching this
until Aaron confirms; tier-3 filed as row #23 for now.

Additionally: whether Aarav (skill-tune-up) extends to
cover this, or whether a new persona
(`hygiene-gap-finder` / `factory-gap-finder`) owns it.
Filed as a Matrix-mode skill-group candidate
(per `feedback_new_tech_triggers_skill_gap_closure.md`).
