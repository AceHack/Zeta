---
id: 081KQGDBJ0008QG0R001AJ20MX
priority: P2
status: open
title: General git content scrubber — design + decision-criteria + mechanism for any-class leak cleanup
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: friction-reducer
---

# 081KQGDBJ0008QG0R001AJ20MX — General git content scrubber: design + decision-criteria + mechanism for any-class leak cleanup

**Priority:** P2 (future-defensive; the generalized parent of 081KQGDBJ0008QG0R002NCWCRD. Leak-type-agnostic. Designed when first non-sibling-repo case lands.)

**Filed:** 2026-05-01

**Filed by:** Otto under delegated backlog-prioritization authority. Aaron's framing 2026-05-01: *"sibling-repo leak scrub-process design you should generalize to in another backlog item into general git content scrubber"*. Generalize-everything discipline (`memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md` Aaron's verbatim *"we generalizing everything as a discipline"*).

**Effort:** M (1-3 days — leak-class taxonomy + decision-matrix + mechanism playbook + tooling-survey + audit-trail-discipline; design-only row, no implementation)

## Why this exists

081KQGDBJ0008QG0R002NCWCRD covers one specific leak-class (sibling-repo internals). The factory's generalize-everything discipline says: design the *general* pattern, then specific cases become applications of the general. This row is the parent generalization; 081KQGDBJ0008QG0R002NCWCRD becomes the seed worked-example.

Leak classes the general scrubber must cover:

1. **Secrets/credentials/tokens** — API keys, passwords, OAuth tokens, signing keys accidentally committed. Most common case in industry; mature tooling exists (TruffleHog, Gitleaks, GitGuardian, BFG Repo-Cleaner, `git filter-repo`).
2. **Sibling-repo internals** — the case 081KQGDBJ0008QG0R002NCWCRD covers. Names, identifiers, architectural details from related projects.
3. **PII / personal data** — names, addresses, email addresses, phone numbers committed against consent. GDPR/CCPA implications.
4. **Confidential / NDA-class content** — customer-specific information, contract terms, embargoed product details.
5. **Trademark / copyright issues** — third-party trademarks used without authorization, copyrighted content quoted past fair-use.
6. **Embarrassing or outdated wording** — strong language, outdated taxonomies, framings that no longer match current understanding.
7. **Operational identifiers** — internal hostnames, IP addresses, infra-topology details, runbook step orders.

Each class has different severity / different reach-tolerance / different scrub-urgency / different audit-trail requirements.

## What

Design + document a general scrubber covering five load-bearing pieces:

### 1. Leak-class taxonomy

A canonical enumeration (the seven above plus an "other" escape hatch) with per-class:

- **Detection signal** — what pattern identifies a leak of this class (regex, lint, manual review).
- **Severity floor** — minimum harm assumption (secrets are always severe; outdated wording usually isn't).
- **Reach-sensitivity** — how badly external propagation matters per class.
- **Audit-trail style** — what record must remain after scrubbing (secrets need rotation receipts; sibling-repo leaks need un-scrubbed-exemplar acknowledgment when Aaron's frame applies).

### 2. Decision-criteria — does this leak need scrubbing?

A matrix combining:

- **Class** (from taxonomy).
- **Reach** (local branch / pushed branch / merged main / external mirror / external clones).
- **Detection-time vs incident-time** (caught at write-time = prevention layer; caught later = cure layer; caught after external propagation = limited-cure).
- **Aaron-context** (experimental space = leave-as-evidence per "we should leave this one even then"; production = scrub).
- **External-actor implication** (does anyone OTHER than Aaron / the maintainer face material harm — third party, customer, regulator).

Output: scrub / leave-and-record / hybrid (scrub-content-keep-audit-trail) / escalate-to-human.

### 3. Scrub mechanism — how to safely remove content

- **File-level scrub** (additive PR; rename + content rewrite). Always safe. Preferred when the leak's reach is local branch only or when commit-message-level cleanup isn't required.
- **Branch / PR / commit-message scrub** — host-level edits (PR description rewrite, branch deletion, commit-message amend on un-pushed commits). Bounded safety.
- **History rewrite** (`git filter-repo`, `git filter-branch`, BFG Repo-Cleaner) — destructive. Force-push required. **Blocked uniformly by the host `non_fast_forward` ruleset on both forks (LFG and AceHack), no bypass actors** per CLAUDE.md. Reconciliation paths when history rewrite is genuinely needed: **PR-based reset** (open a PR that resets the branch to a clean point) or **delete-and-recreate** of the affected branch (or fork, in the AceHack mirror case). The mechanism design must NOT rely on force-push as a routine option AND must NOT propose lifting the `non_fast_forward` ruleset — per CLAUDE.md's canonical reviewer principle: *"the protocol bends to the security ruleset; the ruleset does not bend to the protocol."* Lifting the ruleset to enable a scrub mechanism inverts that principle.
- **External-mirror reality** — `git push --force-with-lease` updates the mirror, but anyone who *cloned* during the leak window keeps the leak in their local history. Communication + secret-rotation are the only real cures for already-propagated leaks.
- **Tooling survey** — BFG Repo-Cleaner (specialized), `git filter-repo` (current canonical, deprecates filter-branch), GitHub's "Removing sensitive data" guidance, GitLab equivalent. Live-search authority discipline applies (CLAUDE.md): documented knowledge expires; check current upstream when implementing.

### 4. Audit-trail preservation — scrubbing without lying

When a leak is scrubbed, the *fact* of the scrub must remain as substrate:

- **What** was scrubbed (class, surface, original commit / PR reference).
- **When** the scrub happened.
- **Who** authorized it.
- **Why** the scrub-vs-leave decision went the way it did.
- **What** mitigations downstream (secret rotation, external notifications, mirror-refresh).

The audit record itself MUST NOT re-leak — naming the scrubbed content in the audit defeats the scrub. The audit references the leak by *class* and *surface*, not by content.

Aaron's mistake-as-evidence framing applies here: in experimental spaces the leak-as-substrate IS the audit; the un-scrubbed exemplar IS the record. In production substrate the cleanup happens AND a separate audit record lands.

### 5. Tooling: Zeta's actual scrub-helper script(s)

Out of design scope for this row but seeded:

- A `tools/scrub/` directory with helper scripts per mechanism level.
- Pre-scrub linter that catches the leak and applies the decision-criteria automatically when possible.
- A "did you mean to scrub?" git pre-push hook that surfaces suspicious patterns and forces human ack.
- Mirror-refresh integration (`tools/mirror/` or whatever the AceHack-mirror tooling is called when this row is implemented) — scrubs on LFG must propagate consistently.

## Why P2

- **Not blocking critical-path.** Same as 081KQGDBJ0008QG0R002NCWCRD. Prevention layer is the parent rules; this is cure layer.
- **Generalization adds real future value.** A general scrubber covers all seven leak classes from one design pass; per-class-only scrubbers are duplicate work.
- **Higher than P3 because secret-leak-class is real industry risk.** The factory will eventually have a credentials-leak incident (every project does). When it happens, having the design ready turns hours of "what do we do" into minutes of "follow the playbook."

## Why not P1

- **No active general-class incident.** 081KQGDBJ0008QG0R002NCWCRD had a specific incident (sibling-repo leak landed on main); this row's class is broader, no instance has fired beyond the sibling-repo one.
- **Design without instances risks over-engineering.** P2 invites this row to wait for a second leak-class incident (likely a secret-leak when CI gets new tooling, or PII-leak when first user data flows through a demo) to inform the design with two real cases instead of one.

## Acceptance criteria

When this row is implemented:

1. **Leak-class taxonomy landed** as a memory file or `docs/ops/` runbook, covering the seven classes above (or an updated count if implementation finds different boundaries).
2. **Decision-matrix documented** — class × reach × detection-time × Aaron-context produces a scrub/leave/hybrid/escalate verdict.
3. **Mechanism playbook documented** — file-level / branch-level / history-rewrite / mirror-aware paths with explicit safety rails per CLAUDE.md "force-push to LFG main is forbidden."
4. **Tooling survey current** — live-search verified (per CLAUDE.md search-first authority) at implementation time; tools cited with dates.
5. **Audit-trail-preservation rule documented** — every scrub leaves a record; the record does not re-leak.
6. **081KQGDBJ0008QG0R002NCWCRD reframed as worked-example** — its content stays valid as the sibling-repo-class application; the general scrubber design references it as seed evidence.
7. **Generalize-everything discipline honored** — the general design stands without sibling-repo-specifics bleeding into the general layer; sibling-repo-specifics live in 081KQGDBJ0008QG0R002NCWCRD, not here.

## Out of scope

- **Implementation** — this is a design row. Implementation is a separate task triggered when a non-sibling-repo leak class fires for the first time.
- **Automated leak detection at write-time** — that's prevention layer; covered by the parent rules + write-time author discipline. If a CI lint is needed, file a separate row.
- **Secret-rotation procedures** — overlap with security-ops runbooks. The scrubber design surfaces *that* rotation is required for secret-class leaks; the rotation steps themselves live in security-ops substrate.
- **External-mirror retroactive consistency** — you cannot un-leak from clones; scrubber design surfaces this constraint, doesn't pretend to solve it.

## Composes with

- `memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md`
  — the parent prevention rule for the sibling-repo leak class. The general scrubber generalizes the cure side; the per-class prevention rules are independent.
- [081KQGDBJ0008QG0R002NCWCRD (sibling-repo leak scrub-process)](081KQGDBJ0008QG0R002NCWCRD-sibling-repo-leak-scrub-process-when-it-matters-aaron-2026-05-01.md) — the seed worked-example. 081KQGDBJ0008QG0R002NCWCRD's content is the sibling-repo class application of this general design.
- `memory/feedback_otto_363_substrate_or_it_didnt_happen_no_invisible_directives_aaron_amara_2026_04_29.md`
  — substrate must be reachable + indexed. Audit-trail-preservation requirement is the substrate-form of "you scrubbed something, but the scrub itself becomes substrate."
- Task #318 (`docs/ops` taxonomy) — implementation may live in `docs/ops/runbooks/` or `docs/ops/patterns/`.
- Task #350 (Otto-357 mechanized auditor) — same surface family as the proposed pre-scrub linter; coordinate so the auditors don't duplicate detection logic.
- The CLAUDE.md "LFG main is forbidden, host-enforced via non_fast_forward rule" — the canonical safety rail this design must respect.

## How to apply (when implementing this row)

The implementer reads the parent rules, 081KQGDBJ0008QG0R002NCWCRD (the seed example), this row, and live-searches the current state of `git filter-repo` / BFG / GitHub guidance / GitLab guidance. The implementer writes fresh — no copying from prior incident-write-ups; generalize the pattern; sibling-repo-specifics stay in 081KQGDBJ0008QG0R002NCWCRD.

The implementer asks Aaron explicitly before exercising any history-rewrite path on protected branches; the design surfaces the question even when the answer is "not now."

## Status

**Filed.** Implementation deferred. The next non-sibling-repo leak-class incident is the natural trigger for implementation.

## Verify-before-deferring note

081KQGDBJ0008QG0R002NCWCRD (the seed example) is verified to exist on the branch `backlog/081KQGDBJ0008QG0R002NCWCRD-sibling-repo-leak-scrub-process-aaron-2026-05-01` (PR #1012 open). The parent prevention rule at `memory/feedback_no_copy_only_learning_from_sibling_repos_aaron_2026_04_30.md` is verified (236 lines, 2026-04-30). The deferral is valid: prevention layer is working; general cure layer can be designed when a second leak class arrives.
