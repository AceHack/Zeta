---
id: 081KQGDBJ0008QG0R002NCWCRD
priority: P2
status: open
title: Sibling-repo leak scrub-process — when scrubbing matters; future-defensive design
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: friction-reducer
---

# 081KQGDBJ0008QG0R002NCWCRD — Sibling-repo leak scrub-process: design + decision-criteria for when scrubbing matters

**Priority:** P2 (future-defensive; not blocking critical-path; the parent rule already prevents most leaks at write-time, this row is for the *cleanup* path when prevention fails)

**Filed:** 2026-05-01

**Filed by:** Otto under delegated backlog-prioritization authority. Filed in response to Aaron's framing 2026-05-01: *"that's fine, mistakes happen, thats why i did it here"* + *"you can leave your mistake"* + *"you should backlog a scrub process for future mistakes when it matters, we should leave this one even then"*.

**Effort:** S (4-8 hours — design the decision-criteria + the scrub mechanism + the audit-trail-preservation discipline; write fresh; no implementation needed in this row, just the design + criteria document)

## Why this exists

The parent rule `memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md` prevents most sibling-repo internals from leaking into Zeta documents at write-time. When the rule is followed, no scrub is needed. This row covers the *cleanup* path: what to do when the rule fails and a leak lands on substrate.

The triggering incident: a row authored 2026-05-01 violated the parent rule by importing internal names from a sibling repo's own self-references. Aaron caught it; the row was cleaned up locally on the authoring branch but not before the leaky version had already landed via squash-merge to main (commit message included). Aaron's framing: leave this one as-is (it's the learning evidence in his experimental sibling-repo space), and design a scrub-process for *future* mistakes where scrubbing actually matters.

## What

Design + document a scrub-process covering three load-bearing pieces:

1. **Decision-criteria: when does a leak matter enough to scrub?**
   - Severity axes: third-party identifying info / customer/IP-class detail / specific architectural information / generalized-purpose phrasing only.
   - Reach axes: local branch only / pushed branch / merged to main / merged into a release / external mirror.
   - Aaron-context: experimental space (his framing: leave it) vs. production substrate (real consequence).
   - The criteria together produce a 4-cell matrix or similar: scrub vs. leave-and-record-as-substrate.

2. **The scrub mechanism: how to scrub safely without rewriting protected history.**
   - File-level scrub (follow-up PR; rename + content rewrite; safe, additive).
   - Commit-message scrub on main: NOT possible. Per CLAUDE.md, force-push to LFG main is forbidden — host-enforced via `non_fast_forward` ruleset rule with no bypass actors. The protocol bends to the security ruleset; the ruleset does not bend to the protocol. Commit-message-on-main scrubs are therefore out-of-scope for this design entirely. The row documents this as a constraint, not as an escalation path.
   - Mirror-fork implications (LFG vs. AceHack; both have the leaky commit if the merge happened pre-mirror-refresh).
   - External-fetch implications (anyone who cloned at the leaky-commit window keeps the leak in their local history; scrubbing main doesn't reach them).

3. **Audit-trail preservation: scrubbing without lying about what happened.**
   - When a leak is scrubbed, the *fact* that it was scrubbed must remain as substrate. Memory file or ADR linking the original-incident → the scrub-PR → the class-level lesson encoded.
   - Aaron's framing: in his experimental space, the mistake-as-substrate IS the value. In production substrate, the mistake-as-substrate moves to the audit-record while the leak-content gets removed from operational visibility.
   - The audit record itself MUST NOT re-leak (a meta-rule — naming the original leak in the audit record would defeat the scrub).

## Why P2

- **Not blocking critical-path.** The parent rule prevents most leaks at write-time. This row is for the rare-failure cleanup path.
- **Pain is bounded.** When prevention fails, the natural response is to commit-message-on-main as historical record + scrub the file content. That's the default; this row formalizes it for cases where the default isn't sufficient.
- **Higher than P3 because the cost compounds.** A mistake left uncleaned in production substrate compounds: every future reader of the file sees the leak; every grep-search through history finds it; every external mirror propagates it. P3 implies "we'll get to it eventually"; P2 acknowledges that mistakes worth scrubbing have measurable cost.

## Why not P1

- **The parent rule does the heavy lifting.** Prevention beats cure; the parent rule is the prevention layer; this row is the cure layer for failures.
- **No active incident requires this.** The triggering incident is explicitly NOT scrub-targeted (Aaron: "leave this one"). The first time this row gets exercised will be a future incident.
- **Designing without an incident risks over-engineering.** P2 status invites this row to wait for the next real failure case to inform the design, rather than over-specify in the abstract.

## Acceptance criteria

When this row is implemented:

1. **Decision-criteria document landed** as either a memory file or `docs/ops/` runbook (per the docs/ops taxonomy work in task #318). The 4-cell scrub-vs-leave matrix is named, with examples for each cell.
2. **Scrub-mechanism playbook documented** covering file-level scrub (the easy case), the explicit out-of-scope note that commit-message-on-main scrubs are NOT possible per CLAUDE.md (host-enforced `non_fast_forward` ruleset), and the external-mirror reality (you cannot un-leak from clones).
3. **Audit-trail preservation rule documented** — every scrub leaves a record of the scrub itself; the record does not re-leak.
4. **The triggering incident is NOT scrubbed** — per Aaron's framing, the 2026-05-01 incident stays as evidence-of-learning in his experimental space. The implementation references this incident as "the un-scrubbed exemplar" without re-naming the leaked content.

## Out of scope

- **Automated leak-detection.** That's prevention-layer work; the parent rule + write-time author discipline cover it. If a lint/auditor is needed, file a separate row.
- **Rewriting any historical commit on main.** Forbidden per CLAUDE.md, host-enforced via the `non_fast_forward` ruleset (no bypass actors). NOT a sign-off-able escalation; out-of-scope entirely. The row documents the constraint, not the path.
- **The triggering incident itself.** Per Aaron 2026-05-01: leave it.
- **Sibling-repo *prevention* design.** The parent rule already covers prevention; that's not what this row is.

## Composes with

- `memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md`
  — the parent rule. This row is the cleanup-side companion.
- `memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`
  — substrate must be reachable + indexed. The audit-trail-preservation requirement is the substrate-form of "you scrubbed something, but the scrub itself becomes substrate."
- `docs/backlog/P1/081KQGDBJ0008QG0R001JC9HCJ-port-meta-learning-4-layer-pattern-from-stcrm-aaron-2026-05-01.md`
  (note: file may exist on the authoring branch only; landed on main via #1011 with the pre-rename filename) — the row whose drafting triggered this learning. The 4-layer pattern's Layer 3 (encode the class) is what filing this row is.
- Task #318 (docs/ops taxonomy) — the implementation may live in `docs/ops/runbooks/` or `docs/ops/patterns/` once that taxonomy lands.

## How to apply (when implementing this row)

The implementer reads the parent rule, this row, and the 2026-05-01 incident's substrate trail (this conversation's commit history + the post-incident memory landings). The implementer writes fresh — no copying from prior incident-write-ups; generalize the pattern.

The implementer asks Aaron explicitly before exercising any commit-message-on-main scrub path; the design surfaces the question even when the answer is "not now."

## Status

**Filed.** Implementation deferred — no active incident requires the cleanup path right now, and the parent rule is preventing leaks at write-time. The next real cleanup-needed incident is the natural trigger for implementation.

## Verify-before-deferring note

The parent rule at `memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md` is verified to exist (236 lines, last modified 2026-04-30). The triggering incident's commit landed on main as the squash-merge of PR #1011 (2026-05-01). The deferral is valid: prevention layer is working; cure layer can be designed when a cure-needing case arrives.
