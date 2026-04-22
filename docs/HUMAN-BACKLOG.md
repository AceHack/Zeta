# Human backlog — things this project needs a human to do

This file is the **single place** a human contributor to this
project can look to find out what the agents (and the factory
itself) currently need a human to do. Agents file rows; humans
resolve them. The artifact matches the factory's three
load-bearing design invariants:

- **Git-native.** Markdown in the repo. Renders for free
  through any git host. No external service.
- **Free > cheap > expensive** (`feedback_free_beats_cheap_beats_expensive.md`).
  The backlog is a markdown table; no paid SaaS needed.
- **Pluggable.** The file is today's default surface; a
  future consumer who prefers Jira / Linear / a product
  manager's spreadsheet can plug in an alternative
  backlog backend behind the same contract. Git-native is
  the first/bootstrap plugin.

`★ Insight ─────────────────────────────────────`
Two companion backlogs, different audiences:

- `docs/BACKLOG.md` is **agent-facing**: work the factory
  itself can pick up and execute (P0/P1/P2/P3 rows,
  often with "Owner: Architect" style attribution).
- `docs/HUMAN-BACKLOG.md` (this file) is **human-facing**:
  work that *requires* a human decision, credential,
  permission, out-of-band communication, or physical-
  world action. Agents can surface, can even write the
  brief; they cannot resolve.
`─────────────────────────────────────────────────`

## Vibe-coding guardrail — what belongs in a row

Per `project_zero_human_code_all_content_agent_authored.md`,
humans of this factory **are not required to** edit files,
write markdown, commit code, or interact with git. The
primary human-facing UX is **conversational** (and, when it
ships, the factory's **custom UI**). This file is
agent-authored and agent-maintained; humans read it, they
do not edit it.

Humans *may* opt into code contribution via the
**teaching-track** (see
`project_teaching_track_for_vibe_coder_contributors.md`) —
a structured, agent-mediated, mistake-tolerant process
where the factory teaches a vibe-coder how to contribute
one lesson at a time. Even on that track, humans do not
edit `docs/HUMAN-BACKLOG.md` itself; teaching-track
interactions happen on separate surfaces (branches,
PRs, chat).

That shapes what a row can legitimately contain:

- **Good rows** describe an action **only a human can
  perform** at the human level of abstraction:
  - A **decision** — the human chooses between options;
    agent implements the choice after the human says it
    conversationally.
  - An **external-world action** — signing a physical
    document, making a phone call, visiting a location,
    having an IRL conversation, providing voice
    identification.
  - A **credential / consent** — revealing a secret,
    provisioning access, granting permission; the act of
    consent itself is the human's contribution.
  - An **interpretation** — judgement calls the agent is
    not licensed to make (clinical, legal, regulatory,
    interpersonal).
- **Bad rows** ask the human to do file- or tool-level
  work:
  - "Aaron, please edit X.md" — no; the agent edits.
  - "Aaron, please commit Y" — no; the agent commits.
  - "Aaron, please add row to file Z" — no; the agent
    writes rows after Aaron says what to write.
  - "Aaron, please run this command" — no; the agent
    runs commands (or files a `credential` row if it
    needs access to run it).

Resolutions arrive **conversationally** from the human.
The agent records the resolution in the row; the human
never touches the file. If a future custom UI surfaces
this backlog, it continues to be read-only for humans —
edits happen via conversation, the UI reflects the
agent-maintained state.

## Why a dedicated human backlog

1. **Aaron's framing (2026-04-20):** *"i think this a
   specifc instance of the kind of item that belongs on a
   human backlog a list of items that this project needs a
   human to do, that way i don't ahve to come ask, need
   anyting from me, i can just look at the human backlog"*.
   Humans discover work by browsing, not by being
   interrupted.
2. **Agent-unblock.** When an agent is blocked waiting for a
   human action, filing a row here converts the block from
   "silent wait" into "visible ask". Other agents can route
   around the blocked row; the human can address them in
   batch.
3. **Multi-user-safe.** Each row names which human(s) it is
   waiting on. When multiple humans work on the same
   factory-enabled project (`feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`),
   the backlog is the coordination surface.
4. **Audit trail.** Resolved rows stay for history; the
   factory's "who decided what, when" record survives.

## Categories

Rows carry a **category** label. The category-set grows as
new kinds of human-action arise; today's starting set:

- **conflict** — a user-ask conflict per
  `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`:
  two human instructions disagree and the agent cannot
  proceed without a human resolution. Columns below include
  the conflict-specific schema (Ask A / Ask B / Why
  conflict / Default while unresolved).
- **approval** — a decision requiring human sign-off: ADR
  acceptance, public-API shape, a new external dependency,
  a new persona, a cost-tier escalation.
- **credential** — a secret / token / DNS record / IAM
  grant / HSM access that the agent cannot self-provision.
  Email-infrastructure prereqs (`feedback_agent_sent_email_identity_and_recipient_ux.md`),
  domain ownership, CI secrets.
- **external-comm** — out-of-band communication a human
  must initiate: an introduction, an external pitch, a
  regulator question, a legal consultation.
- **naming** — a public-use naming decision gated by the
  naming-expert protocol (e.g. Aurora Network public usage
  per `project_aurora_network_dao_firefly_sync_dawnbringers.md`).
- **physical** — something requiring a physical human
  action: hardware provisioning, notarisation, a phone
  call, a signature on paper.
- **observation** — a human-judgement observation the agent
  is not allowed to make (clinical, legal, regulatory,
  interpersonal).
- **other** — anything not covered above. If "other" grows
  past a handful of rows, a new category is warranted.

## Row lifecycle

Every row is in one of:

- **Open** — awaiting a human.
- **In-progress** — a human has picked it up; the row stays
  for visibility.
- **Resolved** — a human has acted; the resolution is
  recorded in-row. Row stays for audit trail.
- **Deferred** — explicitly parked with a reason and a
  re-check date.
- **Stale** — no longer applicable (environment changed);
  row kept for history.

## Default rules while a row is Open

- For **conflict** rows: follow the more-recent instruction
  unless the more-recent one is higher-risk than the older
  one (in which case follow the older/narrower/safer one
  and flag). Record the applied default in-row.
- For **approval** rows: do not proceed with the
  change-requiring-approval. Other work continues around it.
- For **credential** / **external-comm** / **naming** /
  **physical** rows: the agent cannot self-satisfy by
  definition; block the dependent work and annotate
  dependent items with a pointer to the row.
- For **observation** rows: the agent does not attempt the
  observation; it records signals factually and awaits
  human interpretation.

## Row schema

Each row is one entry in the table below. Columns:

- **ID** — stable id (HB-NNN).
- **When** — date the row was filed (YYYY-MM-DD).
- **Category** — from the set above.
- **For** — which human(s) the row is waiting on (first
  names or handles, per the maintainer-name-redaction
  rule).
- **Ask** — one sentence of what the agent needs from the
  human. For category `conflict`, this field expands to
  include Ask A / Ask B / Why conflict / Default applied.
- **Source** — transcript excerpt, artifact path, or ADR
  where the need originated.
- **State** — Open / In-progress / Resolved / Deferred /
  Stale.
- **Resolution** — when Resolved, what the human decided
  and why. Blank while Open.

## Name attribution — explicit carve-out

`docs/AGENT-BEST-PRACTICES.md` §"No name attribution in code,
docs, or skills" instructs docs to use role-refs ("the human
maintainer") instead of personal names. **This file is a
deliberate exception** by the maintainer's own directive
(2026-04-20: *"can you put my tasks at the top of the human
backlog i don't want to have to go digging through it to find
my tasks"*). The `For:` column and the per-addressee sub-table
headers intrinsically require personal names to do their job —
a human must be able to find their own asks at a glance.

The carve-out is narrow:

- **In scope for names:** the `For:` column and the sub-table
  headers (`### For: Aaron`, `### For: <other name>`, etc.),
  plus direct quotations in `Source` or `Ask` fields where
  redaction would lose evidential value.
- **Out of scope for names:** any prose *outside* the row
  schema in this file (e.g. the intro, filing rules, prior
  art). Those paragraphs continue to use role-refs. Other
  docs / skills / code still follow the BP unchanged.

This carve-out is also recorded in
`memory/feedback_maintainer_name_redaction.md` (exempt-surfaces
list) so the doc-set and the agent memory stay consistent.

## Rows

Rows are grouped by `For:` addressee so a given human can
find their own tasks without scrolling past everyone else's.
Aaron's tasks come first (2026-04-20 directive:
*"can you put my tasks at the top of the human backlog i
don't want to have to go digging through it to find my
tasks"*); other named humans follow in the order they were
first filed against; `any`-addressed rows come last (any
human can resolve). Within each addressee's sub-table, rows
are ordered by `State: Open` first, then `Stale`, then
`Resolved`; within State, most-recent first.

### For: Aaron

| ID | When | Category | Ask | Source | State | Resolution |
|---|---|---|---|---|---|---|
| HB-001 | 2026-04-21 | decision / org-migration | Plan + execute the migration of `AceHack/Zeta` → `Lucent-Financial-Group/Zeta` (the human maintainer's LFG umbrella org). Drivers: (a) GitHub gates merge queue and other org-level features to organization-owned repos — user-owned repos cannot enable merge queue on any plan tier, which is the real blocker behind the `422 Invalid rule 'merge_queue':` failure against `POST /repos/AceHack/Zeta/rulesets` (see §10.3 of `docs/research/parallel-worktree-safety-2026-04-22.md`); (b) aligns the repo with Aaron's stated destination for external contributors. **Constraints (Aaron 2026-04-21):** (1) **preserve all current settings** — rulesets, required checks (gate + CodeQL + semgrep), branch-protection behaviours, auto-delete-head-branch, auto-merge, Dependabot, CodeScanning, Copilot Code Review, concurrency groups, workflow triggers incl. `merge_group:`; (2) **public from the start** at the new location — no private-during-transition staging period. No deadline — "at some point". Until transferred, the factory accepts the rebase-tax on serial PRs and relies on `gh pr merge --auto --squash` alone (merge queue off). | `docs/research/parallel-worktree-safety-2026-04-22.md` §10.3; session transcript 2026-04-21 (Aaron: "we can move tih to https://github.com/Lucent-Financial-Group at some point it's my org for LFG" + "we need to move it to lucent for contributor at some point anyways, we want to keep all the settings we have now" + "i think we are going to have to go without merge queue parallelism for now" + "we can just make it public from the start") | Resolved | Executed 2026-04-21 via `POST /repos/AceHack/Zeta/transfer` with `new_owner=Lucent-Financial-Group`. Transfer completed instantly (Aaron admin on both sides). Verification diffed 13 settings groups against pre-transfer scorecard: all preserved **except** `secret_scanning` and `secret_scanning_push_protection` both silently flipped `enabled→disabled` by GitHub's org-transfer code path; re-enabled same session via `PATCH /repos/Lucent-Financial-Group/Zeta` with `security_and_analysis`. Ruleset id 15256879 "Default" preserved byte-identical (6 rules); classic branch protection on main preserved (6 required contexts); Actions variables preserved (2 COPILOT_AGENT_FIREWALL_*); environments + Pages config preserved (Pages URL redirected `acehack.github.io/Zeta` → `lucent-financial-group.github.io/Zeta`). Local `git remote` updated. Declarative settings file landed at `docs/GITHUB-SETTINGS.md` per Aaron's companion directive ("its nice having the expected settings declarative defined" + "i hate things in GitHub where I can't check in the declarative settgins"). Merge queue enable remains a separate opt-in step. |

| HB-002 | 2026-04-22 | decision / backlog-restructure | Answer the four open questions in the backlog-per-row-file-restructure ADR so the migration can be scheduled. **(1) ID scheme** — numeric (`0042`), slug (`hot-file-path-detector`), or UUID? Numeric is sort-friendly and stable; slug is human-readable but prone to rename churn; UUID is churn-proof but unreadable. **(2) Script home** — `tools/backlog/` (new dir) or inline in an existing tool? Matters for discoverability and for the declarative-deps boundary. **(3) Sort order** — by creation date, last-updated, or priority-then-date? Drives the index file's canonical ordering and agent workflow when scanning the backlog. **(4) Concurrent-migration trade** — one mechanical PR that moves all 300+ rows at once (massive diff but atomic), or staged migration by tier (smaller diffs but longer window where both formats coexist)? Answers unblock the migration PR which is P0 post-R45. | ADR drafted 2026-04-22 on the speculative fork branch as **Proposed** (fork PR #4, batch 5 of 6 speculative drain); slated to land on LFG main via Batch 6 of the speculative drain (Task #198 in the round tracker). On-LFG path after drain: `docs/DECISIONS/2026-04-22-backlog-per-row-file-restructure.md`. | Open |  |

| HB-003 | 2026-04-21 | decision / hygiene-baseline | Decide disposition on the `tools/hygiene/github-settings.expected.json` drift flagged by `check-github-settings-drift.sh` against `Lucent-Financial-Group/Zeta`. Single-line bounded diff: required-status-check `build-and-test (macos-14)` is present in the checked-in expected snapshot but absent from live LFG branch-protection. This matches the prior decision from task #191 (Round 44 completed) to split the build matrix — macOS on AceHack fork (cost-opt), Linux on LFG. Two clean resolutions: (a) **run `tools/hygiene/snapshot-github-settings.sh --repo Lucent-Financial-Group/Zeta > tools/hygiene/github-settings.expected.json`** and commit with a policy-change explanation (agent-authored commit declined on autonomous-tick per shared-infra-policy discipline — baseline updates want explicit human sign-off so unrelated drift isn't silently ratified); or (b) restore `build-and-test (macos-14)` as an LFG required check and revert the split decision. No deadline — drift-check CI runs weekly, will continue flagging until resolved. An agent ran the drift-check autonomously 2026-04-21 as a retractable-safe read-only hygiene pass; the finding itself is retractable-safe, the baseline-overwrite is not. | `tools/hygiene/github-settings.expected.json` L134 checked-in vs live LFG; `tools/hygiene/check-github-settings-drift.sh` output 2026-04-21; matrix-split decision recorded in commit `77c2450` (`gate.yml: split macOS leg to forks only; drop (macos-14) from LFG required checks`), which implemented the Round-44 task that produced this drift | Open |  |

### For: `any` (any human contributor)

| ID | When | Category | Ask | Source | State | Resolution |
|---|---|---|---|---|---|---|

*(No open rows. Agents file rows here when a decision /
credential / external action is needed from any human.)*

*(The backlog starts essentially empty. Agents file rows
as blocked-on-human work arises; honest scans of memory
and open PRs may seed additional rows opportunistically.
Do not backfill retroactively for its own sake.)*

## Filing rules (for agents)

- **Do not silently wait.** If an agent notices it is
  blocked on a human action, it files a row here rather
  than holding the block in context.
- **Do not bury in memory.** Agent memory is not the
  right home for pending-human-action items — this file
  is. See `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`
  for the precedent.
- **Name the human.** If a specific human is the right
  resolver, say so in the `For` column. If any human
  contributor can resolve, write `any`.
- **File under the right sub-table.** Per the Rows
  section, the file is split into per-addressee sub-tables
  so humans don't have to dig through everyone's asks to
  find their own. Aaron's sub-table comes first; other
  named humans follow; `any`-addressed rows are last. If
  a new named human shows up, add a new sub-table
  section between the last named human and the `any`
  section.
- **Be specific about the ask.** "Aaron needs to decide
  about X" is not enough; write what the decision is,
  what the options are, and what the agent would do under
  each option.
- **Cross-link.** If the row blocks a specific BACKLOG
  item, reference the row from that BACKLOG item. If a
  future ADR depends on the resolution, cite the HB-NNN
  id in the ADR's prerequisites.
- **Resolution is the human's decision; agent records it.**
  Resolutions arrive conversationally (or, in the future,
  through the custom UI). Agents never unilaterally
  mark a row Resolved, but agents **do** write the
  resolution text into the row once the human has told
  them what to record. Humans never edit this file
  themselves — vibe-coding constraint.
- **Scope rows to human-level actions only.** Per the
  vibe-coding guardrail above, rows describe decisions,
  external-world actions, credentials, consent, or
  judgement calls. If the "ask" is "edit a file" or
  "commit X", the row is wrong: the agent should do
  that after the human tells them what to do
  conversationally.

## Prior art

- `docs/BACKLOG.md` — agent-facing backlog; companion
  file.
- `docs/WONT-DO.md` — declined features with reasons;
  same shape (stable rows + explicit resolutions) but
  for a different question.
- `docs/CONFLICT-RESOLUTION.md` — expert-side (IFS) conflict
  protocol. This file is the human-side counterpart.
- GitHub Issues as a UX pattern: rows + labels + state.
  We use markdown instead of Issues so the backlog lives
  next to the code and doesn't depend on a specific
  host.

## Reference memory

- `feedback_user_ask_conflicts_artifact_and_multi_user_ux.md`
  — the specific pattern that motivated the general
  artifact; `conflict` rows follow its schema.
- `project_factory_is_pluggable_deployment_piggybacks.md`
  — git-native / local-first justification.
- `feedback_free_beats_cheap_beats_expensive.md` — cost
  ordering; this file is the free substrate.
- `feedback_durable_policy_beats_behavioural_inference.md`
  — artifact > inference.
- `feedback_maintainer_name_redaction.md` — identity
  handling in the `For` column (first names / handles
  only).
