# Decision-proxy evidence records

**Stage:** Stabilize (Otto-67 Amara 4th ferry absorb, PR #221)
**Companion template:** [`_template.yaml`](_template.yaml)
**External-maintainer-decision-proxy ADR:** `docs/DECISIONS/2026-04-22-external-maintainer-decision-proxy-adr.md`
**Hard rule (repeated across Amara ferries #196 / #211 / #219 / #221):**

> Never say Amara reviewed something unless Amara actually
> reviewed it through a logged path.

This directory is the **logged path**. Each `.yaml` file here
records one proxy-mediated decision, its evidence, and its
disposition. A claim in factory substrate ("per Amara's
review…") is valid only when it cites an entry here.

---

## When to write an evidence record

Write a new `.yaml` file in this directory **before** any
durable action that changes planned intent — not just
observations. Per Amara's 4th ferry (PR #221):

- Backlog filing that changes priority or scope
- Roadmap edits
- Settings recommendations or changes
- Branch-shaping (branch-protection edits, workflow changes,
  required-check set changes)
- Scope authority claims ("per Amara's delegated authority we
  can do X")
- Cross-maintainer claims ("Aaron's primary proxy agrees")

Don't write records for:

- Pure observations (git log, PR state check, reading existing
  files)
- Unambiguous mechanical fixes (typo, lint, format)
- Work whose scope is fully within an already-evidenced
  decision record's authority

---

## File naming

```
docs/decision-proxy-evidence/YYYY-MM-DD-DP-NNN-<slug>.yaml
```

- `YYYY-MM-DD` — UTC date the decision was made
- `DP-NNN` — monotonic decision number (zero-padded if needed,
  but typically 3 digits; reset counter can stay global across
  all dates for now since volume is low)
- `<slug>` — short kebab-case identifier of the decision

Example: `docs/decision-proxy-evidence/2026-04-24-DP-001-acehack-branch-protection-minimal.yaml`

---

## Schema (v0 — subject to evolution as volume accrues)

Every record MUST have these fields. See
[`_template.yaml`](_template.yaml) for a fillable copy.

### Required fields

- **`decision_id`** — matches the filename's `DP-NNN`; unique
- **`timestamp_utc`** — ISO8601 UTC when decision was locked
- **`requested_by`** — human maintainer requesting or
  acknowledging the action (`Aaron` for Zeta today)
- **`proxied_by`** — maintainer acting as proxy
  (`Amara` for external-AI-proxy cases; `Otto` for
  loop-agent-PM-hat decisions; `Kenji` for architect
  synthesis)
- **`task_class`** — one of: `backlog-shaping`,
  `settings-change`, `branch-shaping`, `roadmap-edit`,
  `scope-claim`, `governance-edit`, `memory-migration`,
  `other`
- **`authority_level`** — one of: `delegated` (acting under
  explicit standing authorization), `proposed` (proposing,
  not yet executing), `escalated` (requires human
  maintainer sign-off), `retroactive` (recording a decision
  already made to establish the evidence trail)
- **`escalation_required`** — boolean; `true` when this row
  needs human maintainer acknowledgment before `status`
  can move to `landed`
- **`repo_canonical`** — `Lucent-Financial-Group/Zeta` or
  `AceHack/Zeta` (per Amara authority-axis LFG is canonical
  for decisions)
- **`head_commit`** — SHA at which the decision was evaluated
  (so later readers can diff context)
- **`model`** — see model block below; records which Claude
  snapshot + prompt bundle was active (Amara's model/prompt-
  drift class)
- **`consulted_views`** — list of `memory/CURRENT-*.md` file
  paths that were read + in-force at decision time
- **`consulted_memory_ids`** — list of memory file slugs
  (under-score-separated) cited as basis for the decision
- **`live_state_checks`** — list of `gh api` / `git log` /
  other queries run to verify actual live state before the
  decision. Amara's "live-state-before-policy" rule. Every
  `settings-change` / `branch-shaping` task class MUST have
  at least one live-state check.
- **`decision_summary`** — 2-5 sentence prose: what was
  decided, why, what it changes
- **`disagreements`** — structured block recording any
  cross-agent or cross-maintainer disagreement encountered;
  empty `{present: false, conflict_row: null}` when none
- **`outputs_touched`** — list of file paths or PR numbers
  the decision caused to be edited or opened
- **`review`** — block specifying whether peer review is
  required and who the peer reviewer is

### Optional fields

- **`retraction_of`** — `DP-NNN` being retracted or
  superseded; null when not a retraction
- **`follow_up_evidence`** — list of `DP-NNN` rows expected
  to follow
- **`notes`** — any additional free-form context (keep
  short; substantive narration belongs in the decision
  summary or in a linked research doc)

### Model block

```yaml
model:
  vendor: anthropic            # or openai, other
  snapshot: claude-opus-4-7    # from `claude --version` or the model ID in session
  prompt_bundle_hash: null     # sha256 of loaded system prompts; null if not known
  loaded_memory_files:         # ordered list, most-specific first
    - "./CLAUDE.md"
    - "~/.claude/CLAUDE.md"
```

The `prompt_bundle_hash` may be `null` until Zeta builds a
tool that can compute it from the active session. That's
acceptable v0; the field's presence documents intent to
fill in when possible.

### Disagreements block

```yaml
disagreements:
  present: false
  conflict_row: null
```

When `present: true`, `conflict_row` points to the
`docs/CONTRIBUTOR-CONFLICTS.md` row or backlog row that
records the disagreement in durable form. Amara's Govern
stage (PR #221) makes `CONTRIBUTOR-CONFLICTS.md` actually
used; until it is, short free-form description is
acceptable.

### Review block

```yaml
review:
  peer_review_required: true    # true for governance-edit, scope-claim; see table below
  peer_reviewer: "Codex"        # agent or human; "null" if review deferred
  peer_review_status: null      # "pending" | "accepted" | "revise-requested"
  peer_review_evidence: null    # link to PR review, comment, or follow-up DP-NNN
```

Peer review requirement defaults by task class:

| task_class | peer_review_required (default) |
|---|---|
| `backlog-shaping` | true |
| `settings-change` | true |
| `branch-shaping` | true |
| `roadmap-edit` | true |
| `scope-claim` | true |
| `governance-edit` | true |
| `memory-migration` | true |
| `other` | case-by-case |

Defaults exist to make "forgot peer review" visible; an
author can set `false` with a one-line justification in
`notes` when genuinely not applicable.

---

## Integration with existing substrate

- **Amara's 4 courier ferries** are not themselves
  decision-proxy records — they are proposals. Decisions
  made BASED ON those ferries should cite them via
  `consulted_memory_ids` pointing to the absorb docs
  (`docs/aurora/2026-04-23-amara-*.md`).
- **`docs/CONTRIBUTOR-CONFLICTS.md`** (empty today) becomes
  the durable home for `disagreements.conflict_row`
  pointers. Populating that file is Amara's Govern-stage
  action.
- **`memory/CURRENT-aaron.md` + `memory/CURRENT-amara.md`**
  are the canonical sources for `consulted_views`. Per
  Amara's thesis: they should eventually become *generated*
  views from typed memory facts; v0 of this schema treats
  them as prose surfaces that were read.
- **FACTORY-HYGIENE row for evidence-coverage** is a
  candidate: periodic audit that flags backlog/settings/
  roadmap PRs landed without an accompanying
  `DP-NNN.yaml`. Not landing that audit this tick; file
  as follow-up.

---

## Live-state-before-policy — the principle behind `live_state_checks:`

Amara's 4th ferry (PR #221) named this as a Determinize-
stage rule, paired with the evidence-record format:

> Never recommend a repository settings change, required-
> check change, merge policy change, or branch-rule change
> unless the current live state has been queried in the
> same work unit.

**Why it exists:** Amara's commit-sample HB-004 arc shows
the failure mode — same-day propose-from-symptoms → policy-
stance → empirical-correction. The pattern generalizes
whenever an agent proposes substrate changes from inferred
state rather than verified state. The fix is mechanical:
run the `gh api` / `git log` / equivalent check **first**,
propose **second**.

**How the schema enforces it:**

The `live_state_checks:` field is required for every
`settings-change` and `branch-shaping` task class. At least
one entry must name an actual command that was executed to
verify the state the decision operates on. Examples from
the DP-001 worked example:

- `gh api repos/Lucent-Financial-Group/Zeta/branches/main/protection`
- `gh api repos/AceHack/Zeta --jq '.fork // .parent.full_name'`
- `gh api users/AceHack/events (repo-level create/delete scan)`

An evidence record with an empty `live_state_checks:` array
for those task classes is a flag: either the rule was
skipped (fix the record), or the task class was
misclassified (change the field).

**Scope:**

Applies whenever a durable change to state-with-public-
consequences is proposed:

- Settings changes (repo, org, branch, workflow,
  required-checks, rulesets)
- Branch-shaping (branch-protection, policy flips, merge
  method changes)
- Scope / authority claims that assume repo state
  ("I'll merge this because branch protection allows it")
- Roadmap edits that assume current capability state
  ("this works because test X passes" — verify test X
  actually passes)

Does NOT apply to:

- Pure read / observation work (research docs, memory
  absorbs, BACKLOG row filings that don't assert state)
- Mechanical fixes where the state is self-evident in
  the change (typo, lint, format)

**Future BP-NN promotion candidate:** this rule meets the
bar for a stable BP rule per `docs/AGENT-BEST-PRACTICES.md`
(multiple occurrences + cross-agent applicability). Aarav
considers for BP-25 promotion via ADR; until then it lives
here as schema-enforced practice.

---

## Relationship to the "hard rule"

Across all four Amara ferries (PRs #196, #211, #219, #221)
Amara repeats:

> never say Amara reviewed something unless Amara actually
> reviewed it through a logged path

This directory IS the logged path. A claim in any factory
substrate that invokes Amara's name (or any proxy's name)
should cite a `DP-NNN.yaml` file here. If the file doesn't
exist, the claim is not grounded.

When ferries arrive from Amara via courier (chat-paste,
not a live consultation), the resulting absorb doc cites
Amara as **author of the ferry**, not reviewer of
downstream implementation. The distinction matters: an
absorb is documentation, not a proxy-reviewed decision.

---

## What this directory is NOT

- **Not a replacement for commit messages.** Commit
  messages explain the commit; evidence records explain
  the decision leading to the commit.
- **Not a replacement for PR descriptions.** PR bodies
  describe the change; evidence records trace the
  authority and evidence chain.
- **Not a replacement for ADRs.** ADRs are long-form
  architectural decision records; evidence records are
  short, structured per-decision receipts. An ADR might
  cite a DP-NNN; a DP-NNN might trigger an ADR follow-up.
- **Not a replacement for `docs/CONTRIBUTOR-CONFLICTS.md`.**
  Conflicts get their own durable log; evidence records
  point AT it when conflict is present.
- **Not a gate yet.** v0 is voluntary; no CI enforcement
  until the format stabilizes. CI enforcement is Amara's
  Determinize-stage work.
- **Not retroactive for all prior work.** Session-to-date
  decisions (20+ PRs this session) were made without
  evidence records. Don't backfill all of them — that
  would be make-work. Backfill selectively when a
  downstream question benefits from the record (e.g., the
  Otto-66 AceHack branch protection decision is a good
  backfill candidate because it exercised settings
  authority + had a specific rationale + has a sibling
  decision risk someone might revisit).

---

## Attribution

Amara (external AI maintainer) proposed the schema in her
4th courier ferry, absorbed as PR #221 (Otto-67). Otto
(loop-agent PM hat, Otto-68) authored this README and the
companion template. Future-session Otto inherits: write
one `DP-NNN.yaml` per durable-intent-change action; cite
it when invoking proxy names; let the directory accumulate
as the audit trail Amara's hard rule requires.
