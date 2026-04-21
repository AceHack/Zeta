---
name: github-repo-transfer
description: Capability skill ("hat") — behaviour layer for transferring a GitHub repository between owners (user→org, org→org, user→user). Wear when executing a transfer, diagnosing post-transfer drift, capturing a pre-transfer scorecard, or teaching the routine to a contributor. This file is the **routine** only; the **data** (known silent drifts, what-survives inventory, adapter mapping, worked examples) lives at `docs/GITHUB-REPO-TRANSFER.md` per Aaron's data/behaviour split. The declarative scorecard lives at `docs/GITHUB-SETTINGS.md` + `tools/hygiene/github-settings.expected.json`. Fire-history at `docs/hygiene-history/repo-transfer-history.md`. The routine is graceful-degradation-aware (pre-transfer scorecard → diff after → heal silent drifts) and cartographer-backed (every firing adds a row that a future offline agent can read without re-querying `gh api`).
record_source: "architect, round 44"
load_datetime: "2026-04-22"
last_updated: "2026-04-22"
status: active
bp_rules_cited: [BP-11]
---

# GitHub Repository Transfer — Routine

Capability skill. No persona. Behaviour layer for
**moving a GitHub repository from one owner to another**
without losing settings, breaking cross-links, or
absorbing silent drifts.

Data layer (consulted by this routine):

- [`docs/GITHUB-REPO-TRANSFER.md`](../../../docs/GITHUB-REPO-TRANSFER.md)
  — known silent drifts (S1-S7), what-survives inventory,
  adapter-neutrality mapping, worked-example summaries.
- [`docs/GITHUB-SETTINGS.md`](../../../docs/GITHUB-SETTINGS.md)
  + [`tools/hygiene/github-settings.expected.json`](../../../tools/hygiene/github-settings.expected.json)
  — declarative scorecard this routine snapshots and diffs.
- [`docs/AGENT-GITHUB-SURFACES.md`](../../../docs/AGENT-GITHUB-SURFACES.md)
  — ten-surface playbook informing step 3 and step 8.

Event log (appended by this routine):

- [`docs/hygiene-history/repo-transfer-history.md`](../../../docs/hygiene-history/repo-transfer-history.md)
  — fire-history, one row per transfer.

If this routine and the data doc disagree on a gotcha, the
data doc wins and this routine gets corrected.

## When to wear

- **Executing a transfer.** The agent has been cleared to
  run `POST /repos/<owner>/<name>/transfer` (admin on
  both sides; decision recorded as `HB-NNN` row or ADR).
- **Diagnosing post-transfer drift.** A recent transfer
  completed and a setting looks different — wear this
  hat to run the drift detector and route findings.
- **Pre-transfer scorecard.** A transfer is proposed —
  wear this hat to capture the baseline the post-diff
  will verify against.
- **Teaching.** A contributor asks "how would we move
  this repo?" — point them here.

Do **not** wear this hat for:

- Creating a new empty repository (`gh repo create`).
- Renaming within the same owner (`PATCH /repos/...`
  with `name:`).
- Archiving (`PATCH` with `archived: true`).
- Forking (that's `fork-pr-workflow` +
  `github-surface-triage`).

## The nine-step routine

```
[1] Authorize                decision recorded; admin both sides
       |
[2] Pre-transfer scorecard   snapshot-github-settings.sh → JSON baseline
       |
[3] Adjacent-surface         wiki / pages / discussions / agents / security / pulse
    scorecard                (per AGENT-GITHUB-SURFACES.md)
       |
[4] Pre-flight               blast radius enumerated; in-flight work noted;
                             confirm with Aaron immediately before step 5
       |
[5] Execute                  POST /repos/<old>/<name>/transfer
                             -f new_owner=<new>
       |
[6] Post-transfer diff       re-snapshot against <new>/<name>;
                             diff against pre-transfer baseline
       |
[7] Heal silent drifts       for each entry in the diff, consult
                             docs/GITHUB-REPO-TRANSFER.md §S1-S7 and apply
                             the documented fix; re-snapshot to confirm
       |
[8] Cross-cutting heal       git remote, README badges, doc URLs, Pages URL
                             consumers, CI vars, webhook endpoints, deploy keys
       |
[9] Log                      append row to docs/hygiene-history/repo-transfer-history.md
                             (date / agent / old / new / drifts-caught /
                             drifts-fixed / follow-ups / PR / ADR-or-HB)
```

Each step is a gate — do **not** skip. Steps 1-4 are
pre-flight (reversible); step 5 is the one-way event;
steps 6-9 are the graceful-degradation discipline that
turns "we moved it" into "we moved it *well*".

### Step 1 — Authorize

Verify, in order:

1. **Decision recorded.** `HB-NNN` row or ADR captures:
   old owner, new owner, reason, deadline (or "at some
   point"), constraints.
2. **Admin both sides.**
   ```bash
   gh api /repos/<old>/<name> --jq .permissions.admin
   gh api /orgs/<target-org>/memberships/<you> --jq .role
   ```
3. **Target shape.** If moving to an org, the org exists,
   matches the source repo's visibility, and the
   executing account has `create-repository` rights.

Any failure → stop and file an `HB-NNN` row.

### Step 2 — Pre-transfer scorecard

```bash
tools/hygiene/snapshot-github-settings.sh \
  --repo <old-owner>/<name> \
  > /tmp/pre-transfer-scorecard.json

diff -u tools/hygiene/github-settings.expected.json \
        /tmp/pre-transfer-scorecard.json
```

If the live repo differs from the in-tree expected JSON,
**fix the in-tree expected first** — either re-snapshot
and commit, or revert the live repo. The post-transfer
diff needs a clean baseline.

### Step 3 — Adjacent-surface scorecard

The declarative JSON covers repo-level settings. These
surfaces need manual capture (see
`docs/AGENT-GITHUB-SURFACES.md` for each surface's shape):

- **Wiki** — clone `.wiki.git` if pages exist.
- **Pages** — `gh api /repos/<old>/<name>/pages --jq .html_url`.
  This URL **will change** (§S3).
- **Discussions** — note `totalCount` via GraphQL.
- **Agents tab** — manual; cancel or drain in-flight
  sessions before transfer.
- **Security alerts** — note counts for
  code-scanning / Dependabot / secret-scanning.
- **Pulse stats** — optional; commit/contributor counts
  for post-transfer verification.

Write these into the fire-history row template for step 9.

### Step 4 — Pre-flight

- **Blast radius.** Per
  `memory/feedback_blast_radius_pricing_standing_rule_alignment_signal.md`,
  enumerate what a transfer changes: URL redirects, CI
  variable references, README badges, external services
  keyed on the owner. A transfer is reversible via GitHub
  support within 24 hours, but treat it as one-way once
  propagated.
- **In-flight work.** `gh pr list --state open` — any
  PRs mid-review that might break on re-run?
- **Timing.** Prefer a quiet window.
- **Confirm with Aaron** immediately before step 5,
  even with standing `HB-NNN` authorization (CLAUDE.md
  §Executing actions with care: transfer is
  hard-to-reverse and affects shared systems beyond
  local environment).

### Step 5 — Execute

```bash
gh api --method POST /repos/<old>/<name>/transfer \
  -f new_owner=<new>
```

Outcomes:

- **202 Accepted.** Admin both sides → instant propagation.
- **422 Validation Failed.** Target rejects, name
  conflict, or `allow_incoming_transfers` disallows.
- **403 Forbidden.** Admin missing on one side.

Verify propagation:
```bash
gh api /repos/<new>/<name> --jq '.full_name'
# Expect: "<new>/<name>"
```

### Step 6 — Post-transfer diff

```bash
tools/hygiene/snapshot-github-settings.sh \
  --repo <new>/<name> \
  > /tmp/post-transfer-scorecard.json

diff -u /tmp/pre-transfer-scorecard.json \
        /tmp/post-transfer-scorecard.json \
  | tee /tmp/transfer-drift.diff
```

Every line in `transfer-drift.diff` is either:

1. **Expected drift** (URL fields, `owner`, `full_name`,
   `node_id`, `homepage` if it referenced old owner) —
   update in-tree expected JSON to match.
2. **Silent drift** — consult
   `docs/GITHUB-REPO-TRANSFER.md` §S1-S7 for the known
   pattern and its fix. A silent drift not in the
   catalogue is a **new** discovery — heal it, then
   append an S-entry to the data doc so the next
   transfer inherits the knowledge.

### Step 7 — Heal silent drifts

For each silent-drift entry in the diff:

1. Look it up in `docs/GITHUB-REPO-TRANSFER.md` §S1-S7.
2. Apply the documented fix.
3. Re-snapshot and re-diff; only expected-drift entries
   should remain.

If a silent drift is **not** in the catalogue, the
transfer has surfaced a new gotcha — heal it, then add
an S-entry to the data doc with the observation, cause
(if known), detection pattern, and fix.

### Step 8 — Cross-cutting heal

The data doc's §S-entries list the cross-cutting
consumers per silent drift. In addition, always update:

- **Local git remote.** `git remote set-url origin https://github.com/<new>/<name>.git`.
- **README badges** — `rg '<old>/<name>' --type md`.
- **Doc cross-links** hardcoding `https://github.com/<old>/<name>/...`.
- **CI variables** using the literal old owner.
- **GitHub Pages consumers** — `homepage` field + any
  external references to `https://<old>.github.io/<name>/`.
- **Webhook endpoints** — `gh api /repos/<new>/<name>/hooks`.
- **Deploy keys** — `gh api /repos/<new>/<name>/keys`.
- **Secrets counts** — should match step-3 scorecard;
  mismatch → re-create from source-of-truth.

### Step 9 — Log to fire-history

Append one row to
`docs/hygiene-history/repo-transfer-history.md` with the
schema that file declares. This is the **cartographer
output** — the durable, offline-readable artefact per
`memory/project_local_agent_offline_capable_factory_cartographer_maps_as_skills.md`.

## Data/behaviour split — what this skill is and is not

**This skill is** the procedural routine: when to wear,
which steps in what order, what gates are hard stops.

**This skill is not** the knowledge catalogue. Silent
drifts, what-survives inventory, adapter mappings, and
worked-example summaries live at
`docs/GITHUB-REPO-TRANSFER.md`. Those change as new
transfers surface new patterns; the routine changes as
the *procedure* evolves. Split by change-rate, per Aaron
2026-04-22:
*"seperating thing by data and behiaver is a tried and true
way and you mentied it for the skills earler, works in code too lol"*.

## What this skill does NOT do

- **Does not decide whether to transfer.** Human decision
  (`HB-NNN` or ADR).
- **Does not cover cross-platform moves** (GitHub →
  GitLab, etc.). Data doc §Adapter neutrality maps the
  primitive; gotcha catalogues per platform live in
  separate data docs when a first transfer happens there.
- **Does not handle org-level settings** (teams,
  org-level rulesets). Those live at `/orgs/<org>/...`
  and are a separate surface.
- **Does not run automatically.** Step 4 requires
  human confirmation immediately before step 5 per
  CLAUDE.md §Executing actions with care.

## Reference patterns

- [`docs/GITHUB-REPO-TRANSFER.md`](../../../docs/GITHUB-REPO-TRANSFER.md)
  — data layer (gotchas, inventory, adapter, worked
  examples).
- [`docs/GITHUB-SETTINGS.md`](../../../docs/GITHUB-SETTINGS.md)
  — declarative scorecard (steps 2, 6, 7).
- [`docs/AGENT-GITHUB-SURFACES.md`](../../../docs/AGENT-GITHUB-SURFACES.md)
  — ten-surface playbook (steps 3, 8).
- [`docs/hygiene-history/repo-transfer-history.md`](../../../docs/hygiene-history/repo-transfer-history.md)
  — fire-history (step 9).
- [`tools/hygiene/snapshot-github-settings.sh`](../../../tools/hygiene/snapshot-github-settings.sh),
  [`tools/hygiene/check-github-settings-drift.sh`](../../../tools/hygiene/check-github-settings-drift.sh)
  — scorecard tooling (steps 2, 6).
- `memory/project_zeta_org_migration_to_lucent_financial_group.md`
  — the worked-example memory.
- `memory/feedback_blast_radius_pricing_standing_rule_alignment_signal.md`
  — step 4 discipline.
- `memory/feedback_text_indexing_for_factory_qol_research_gated.md`
  — Aaron's data/behaviour-split principle, verbatim.
- `memory/project_local_agent_offline_capable_factory_cartographer_maps_as_skills.md`
  — why step 9 is non-optional.
