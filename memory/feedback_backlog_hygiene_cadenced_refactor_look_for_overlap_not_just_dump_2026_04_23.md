---
name: Backlog-hygiene cadenced refactor — periodic meta-audit of docs/BACKLOG.md; refactor based on current knowledge; look for overlap; prevent BACKLOG from being just a dump
description: Aaron 2026-04-23 *"we probalby need some meta iteam to refactor the backlog base on current knowledge and look for overlap, this is hygene we could run from time to time so our backlog is not just a dump"*. The factory's BACKLOG accumulates rows over rounds; without periodic meta-audit, overlap compounds, stale rows fossilize, and the file becomes an append-only dump rather than a living triage surface. Hygiene row capturing: cadenced refactor on sweep cadence (5-10 rounds), consolidating overlapping rows, retiring stale ones, re-prioritizing based on current knowledge.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

# Backlog-hygiene — cadenced refactor, not a dump

## Verbatim (2026-04-23)

> we probalby need some meta iteam to refactor the backlog
> base on current knowledge and look for overlap, this is
> hygene we could run from time to time so our backlog is
> not just a dump

## What this names

The factory's `docs/BACKLOG.md` has grown organically —
every time a new idea / observation / deferred-work-item
lands, a row is added. Without periodic meta-audit:

- **Overlap compounds.** Two rows added months apart can
  describe the same concern from different angles; a
  reader doesn't notice; work gets duplicated or no row
  gets the attention it deserves.
- **Stale rows fossilize.** Rows from long-dead contexts
  or already-implemented ideas stay in the file because
  nobody explicitly retired them.
- **Priority drifts.** Rows filed as P1 in one round may
  be appropriate at P2 later (or vice versa) but
  priorities never get re-examined as a set.
- **Knowledge updates don't propagate.** A row written
  before a new architectural insight lands might be
  obsolete, need rewording, or compose with newer rows
  in ways the original didn't know about.
- **The file stops being a living triage surface** and
  becomes a log of historical intentions — still useful
  but different.

Aaron's framing: *"not just a dump."* The append-only
log is fine as a record; it's not a triage substrate.
Periodic refactor converts the log back into a triage
substrate.

## Rule

Add a FACTORY-HYGIENE row for **backlog-refactor
cadenced audit**. Same cadence as the other meta-audits
(rows #5 skill-tune-up, #23 missing-hygiene-class, #38
harness-surface — 5-10 rounds). Each firing:

1. **Read the current BACKLOG in full** (or the relevant
   P0/P1 sections if scope is too large).
2. **Cluster overlapping rows.** Two or more rows
   describing the same concern from different angles get
   flagged; the authoring-agent decides whether to merge
   (single consolidated row) or sharpen (two rows with
   clear non-overlap scope boundaries).
3. **Retire stale rows.** Rows where the context has
   died, the implementation has landed without a retire
   action, or the assumption has been falsified by newer
   knowledge.
4. **Re-prioritize.** Priority labels (P0/P1/P2/P3) get
   re-examined against current knowledge; any row whose
   priority feels wrong after the re-read gets a
   justified move.
5. **Absorb new knowledge.** Rows written before an
   architectural insight landed may need rewording to
   reference the new substrate (e.g., rows that predate
   the AutoDream cadence now cite the AutoDream policy;
   rows that predate the scheduling-authority rule now
   note self-schedulability).
6. **Document the audit** — ROUND-HISTORY row noting
   what was merged / retired / re-prioritized / updated,
   with the pre-audit and post-audit row counts.

## Why this is load-bearing

- **BACKLOG is the triage substrate** for every future
  tick's "what to pick up" decision. A substrate that's
  become a dump is a substrate that leaks triage
  decisions silently (agents pick the wrong row, miss
  the overlapping row, waste tick-budget on stale
  context).
- **Overlap detection is harder than absence detection.**
  Rows by content alone don't reveal overlap; it
  requires someone reading multiple rows with current
  knowledge in mind. This is exactly the kind of meta-
  audit that doesn't happen by accident and must be
  scheduled.
- **Composes with Rodney's Razor at the BACKLOG level.**
  Rodney cuts accidental complexity in code; backlog-
  hygiene cuts accidental complexity in the work queue.
  Same principle applied to the triage substrate.
- **Self-scheduled free work** per the 2026-04-23
  scheduling-authority rule — agent can run backlog
  hygiene without Aaron-consult since it's token-based
  work on already-paid substrate.

## How to apply

- **Add FACTORY-HYGIENE row** on next landing tick
  naming "backlog-refactor cadenced audit" with cadence
  (5-10 rounds), owner (Architect / backlog-scrum-master
  role if invoked, or self-administered), scope
  (factory-wide BACKLOG + project-specific sub-BACKLOGs
  if they exist).
- **First fire** — self-scheduled soon after the row
  lands. Doesn't need to be exhaustive; a bounded "pick
  5 overlapping candidates and merge / sharpen /
  retire" pass is sufficient for the first firing.
- **Cadence** — same 5-10 rounds as row #5 / #23 / #38.
- **Durable output** — ROUND-HISTORY row per fire +
  before/after row-count snapshot +
  `docs/hygiene-history/backlog-refactor-history.md` for
  the per-fire log (row #44 pattern).
- **Classification per row #50 (prevention layer)** —
  this is **detection-only-justified**; the hygiene
  concern is inherently about accumulated drift, which
  is post-hoc by nature.

## What this is NOT

- **Not license to delete rows without trace.** Retired
  rows get a "retired: <reason>" marker, not silent
  deletion. Signal-preservation discipline still
  applies.
- **Not a mandate for one-shot exhaustive sweeps.**
  Bounded passes per cadence are fine; exhaustive
  sweeps at every firing would be diminishing-returns.
- **Not a replacement for domain-expert review.** The
  backlog-hygiene audit is generalist; deep
  reorganization of a particular scope (e.g., security
  rows, F# rows, SQL-engine rows) still benefits from
  the domain-expert eye.
- **Not a license to reshuffle Aaron-scope priorities.**
  P0 rows with explicit Aaron framing stay at the
  priority Aaron set; re-prioritization applies within
  the agent-owned priority space.

## 2026-05-01 extension — pre-filing check (point-in-time discipline)

Aaron 2026-05-01:

> *"you know wheveryou pickup new backlog items you should
> look for similar backlog items because i've repeated myself
> on several designs since the start of this project"*

The 2026-04-23 rule covers **cadenced retroactive refactor**
(every 5-10 rounds, sweep the whole BACKLOG for overlap).
Aaron's 2026-05-01 addition is the **point-in-time
prospective check**: at the moment you pick up / file / draft
a new backlog row, GREP existing backlog FIRST for similar
topics. The two rules are complementary:

- **2026-04-23 cadenced refactor** = ambulance at the bottom
  of the cliff (catches overlap that slipped through)
- **2026-05-01 pre-filing check** = fence at the top
  (prevents overlap from slipping through in the first place)

### Aaron's empirical observation

*"i've repeated myself on several designs since the start of
this project."* Aaron has stated multiple times that the same
design pattern, rule, or concern recurs — meaning the factory
DID NOT absorb the first-stating fully. The recurrence IS the
diagnostic for absorption-failure. The fence-at-top discipline
prevents new instances of this from compounding.

### Recursive irony — this rule itself is the recurrence

Aaron stated this rule on 2026-04-23 (this very memory file).
Aaron repeated it on 2026-05-01 (this extension). That's the
EXACT failure-mode the rule names — Aaron repeats himself on
designs because the first-stating wasn't absorbed at the
operational layer. The fix isn't more memos; it's
**mechanizing the pre-filing check** so it runs without
agent vigilance.

### Pre-filing check protocol

Before filing a new backlog row (or memory file, by extension):

1. **Identify topic keywords** from the new row's working
   title.
2. **Grep `docs/backlog/`** for those keywords (use
   `-nirE` for file:line:context; `-l` alone returns only
   filenames):

   ```bash
   grep -nirE "<keyword1>|<keyword2>|..." docs/backlog/
   ```

3. **Grep `memory/`** for existing memos on related topics
   (the `-r` flag in `-nirE` recurses into the directory;
   `memory/` alone is interpreted as a starting path):

   ```bash
   grep -nirE "<keyword>" memory/
   ```

4. **Check TaskList items** (if this is an agent task) — they
   carry persistent backlog-shaped intent that doesn't show up
   in `docs/backlog/**`. The TaskList is the OTHER backlog.

5. **If hits found**, four branches (Aaron 2026-05-01
   extension adds `depends_on` to the orthogonality
   discipline per
   `feedback_class_level_rules_need_orthogonality_check_extend_or_create_aaron_2026_05_01.md`):

   - **Extend existing** (preferred default) — add the new
     concern as a section/note to the existing row
   - **Sharpen the boundary** — if both rows have legitimate
     scope, edit each to make the non-overlap explicit
   - **Add `depends_on`** (Aaron 2026-05-01: *"you could
     start adding depends on if you find that relationship
     when doing that"*) — if the new row genuinely needs the
     existing row to land first OR is meaningfully constrained
     by the existing row's outcome, encode the dependency in
     a `depends_on:` frontmatter field. Makes the backlog
     graph-shaped instead of flat; topological-sort ordering
     becomes possible.
   - **Create-orthogonal** (rare, requires evidence) — only
     if the new concern is genuinely independent of all
     existing rows

6. **If no hits**, file the new row.

### `depends_on` schema extension

When the pre-filing check surfaces a dependency relationship,
encode it in the new row's frontmatter:

```yaml
---
id: B-NNNN
priority: P2
status: open
title: ...
created: YYYY-MM-DD
last_updated: YYYY-MM-DD
depends_on:                  # NEW optional field
  - B-NNNN-existing-row      # blocking dependency
  - "Otto-task #N"           # TaskList dependency (quote required: # starts a YAML comment unquoted)
---
```

YAML quoting note: values containing `#` (after whitespace)
must be quoted to avoid being parsed as comments — strings
like `Otto-task #323` get silently truncated to `Otto-task`
without quotes. Use double-quotes (`"Otto-task #323"`) for
all `Otto-task #N` and `PR #N` values in `depends_on:`.

`depends_on` semantics: the depending row CAN be filed
immediately, but its work shouldn't START until the
depended-on row reaches a defined state (typically
`status: closed` or a specific milestone within the row).

**Tooling state — envisioned, not yet implemented.** As of
this memo's authoring, `tools/backlog/generate-index.sh`
parses only `id` / `status` / `title` from frontmatter
(priority is derived from the directory path
`docs/backlog/P{0,1,2,3}/`), and does NOT consume
`depends_on`. The schema field is the *forward-compatible
authoring shape*; downstream tooling lands as separate work:

- **Topological-sort view** — candidate generator extension
  to emit a DAG-ordered listing of the backlog.
- **Cycle detection** — candidate lint to reject
  `depends_on` cycles at PR time (memories and backlog
  rows can only point backward in time, like commits).
- **Schema documentation** — `tools/backlog/README.md`
  needs a `depends_on` row added when the tooling lands.
- **Start-work guard** — candidate hook to flag attempts
  to mark a row `in_progress` when its deps are still
  open.

None of these exist today; they are the *natural mechanization
trajectory* the schema unblocks. Authoring rows with
`depends_on:` populated NOW means the data is in place when
tooling catches up; reading the field is the agent's
discipline until then.

Example: 081KQGDBJ0008QG0R003PZFA49 (timeseries domain expert + teacher persona)
should `depends_on: ["Otto-task #323"]` (per-tool/language
expert skills — which is the broader pattern 081KQGDBJ0008QG0R003PZFA49
instantiates; quotes required because of the `#`).
081KQGDBJ0008QG0R000E10AAM (pre-commit lint suite) should
`depends_on: [081KQ3HBZ0008QG0R0008RYCSX, 081KQ8P5D0008QG0R003BFZPRC]` (sibling tooling concerns;
B-NNNN values are unquoted-safe). 081KQGDBJ0008QG0R003G89BKR (RX researcher)
should `depends_on: [081KQ0YZ80008QG0R0003GAYYN]` (operational resonance
dashboard with continuous UX research).

The backlog becomes graph-shaped (a DAG once tooling lands)
rather than flat. Each new row is either a leaf (no deps)
or an internal node (deps known + encoded). The DAG view
and cycle-rejection are tooling targets, not present
implementation.

### 2026-05-01 audit — failure mode demonstrated

This very session (2026-05-01), Otto filed 10 backlog rows
(081KQGDBJ0008QG0R0021E8YZV through 081KQGDBJ0008QG0R000E10AAM) WITHOUT running the pre-filing check.
Quick post-hoc audit found:

- **081KQGDBJ0008QG0R003PZFA49** (timeseries domain expert + teacher persona) +
  **081KQGDBJ0008QG0R003G89BKR** (RX researcher persona) overlap with TaskList
  Otto-task #323 (per-tool/language expert skills) and
  Otto-task #351 (TS+Bun expert + teaching skill). Filed
  without checking the TaskList.
- **081KQGDBJ0008QG0R000E10AAM** (pre-commit lint suite) overlaps with 081KQ3HBZ0008QG0R0008RYCSX
  (otto discipline hooks system substrate as mechanism
  claude-code-plugin) and 081KQ8P5D0008QG0R003BFZPRC (port tools/hygiene python
  to typescript/bun). Both existed; neither was integrated.
- **081KQGDBJ0008QG0R003G89BKR** (RX researcher) overlaps with 081KQ0YZ80008QG0R0003GAYYN
  (operational resonance dashboard with continuous UX
  research). Both existed; neither was integrated.

The audit IS the demonstration of the failure mode.

### Mechanization candidate

Add as **class 14** in 081KQGDBJ0008QG0R000E10AAM (PR #1120) — "pre-filing
similar-row grep check." Two viable mechanization shapes
(the right git hook depends on whether the gate runs
*before commit message authoring* or *during commit message
finalization*):

- **`pre-commit` hook** on `docs/backlog/B-NNNN-*.md`
  file-create — extracts keywords, greps
  `docs/backlog/` + `memory/`, reports the hit-list,
  fails if any hit found. Author must rerun the commit
  with an explicit override flag (e.g.,
  `git commit --no-verify` or an env var
  `OVERLAP_CHECKED=1`) after manual review. Pre-commit
  runs before message finalization, so a commit-message
  tag is NOT readable here.
- **`commit-msg` hook** alternative — runs after the
  commit message is written but before the commit is
  finalized; CAN read message content. Would let the
  author write `[overlap-checked]` in the message body
  to acknowledge the review.

Either shape works; the first (pre-commit + override
flag) is simpler. Implementation choice deferred to
081KQGDBJ0008QG0R000E10AAM's landing.

The mechanization is straightforward; it's the discipline
that's been missing, and the recurrence is the evidence.

### 2026-05-01 follow-up — edge schema for memory files

Aaron 2026-05-01 (right after the backlog `depends_on`
extension above):

> *"you could have a related to our some other edge in
> memories, up to you, they are very much your domain"*

Aaron generalized the graph-shape from backlog rows to
memory files. The same overlap problem afflicts `memory/`
— ~367 memory files are unindexed in MEMORY.md (task
#291), and overlapping memories on the same topic
accumulate without being linked. Edges turn the memory
tree into a navigable graph.

Aaron's *"up to you, they are very much your domain"* is
explicit delegation; the design choices below are Otto's
under the no-directives + autonomy-first-class framing.

#### Edge types (six classes, all optional, forward-only)

| Edge | Semantics |
|---|---|
| `extends` | This memory adds to an earlier memory; both stay in force. (Example: the 2026-05-01 extension to this 2026-04-23 file.) |
| `supersedes` | This memory replaces an earlier memory entirely; the earlier becomes historical. (Rare — most evolution is `refines`.) |
| `refines` | This memory sharpens an earlier memory's scope without replacing it. (Example: Otto-364 refines Otto-247; predecessor stays.) |
| `contradicts` | This memory explicitly conflicts with another; reader needs to know both exist. (Glass-Halo: surface contradictions, don't paper over.) |
| `composes_with` | This memory works alongside another; neither subsumes nor depends. (Promotes existing prose `## Composes with` sections to machine-readable form.) |
| `caused_by` | This memory was triggered by a specific event / incident / PR / message. (Free-text, not file-pointer.) |

Forward-only by design — each file owns its outgoing claims;
reverse navigation is `grep -lrE "supersedes:.*X" memory/`
away (the `-r` recurses into the directory; `-E` enables
the regex `.*`). Bidirectional edges require dual-write
discipline that always drifts; forward-only matches
Glass-Halo file-as-source-of-truth.

#### Authoring discipline

Mirror the backlog pre-filing check. When drafting a new
memory file:

1. **Identify keywords** from the working title.
2. **Grep `memory/`** for related memos (use `-nirE` for
   filename:line:context; `-l` alone returns only filenames
   without context):

   ```bash
   grep -nirE "<keyword1>|<keyword2>" memory/
   ```

3. **Read the hits** (or at least their MEMORY.md
   descriptions).
4. **Choose the relationship**: extends / supersedes /
   refines / contradicts / composes_with / caused_by — or
   none, if the new memory is genuinely orthogonal.
5. **Encode in frontmatter** under the chosen edge field(s).

#### Frontmatter schema

```yaml
---
name: ...
description: ...
type: feedback
originSessionId: ...
extends:                       # optional, list of filenames
  - feedback_NAME_DATE.md
supersedes:                    # optional, list of filenames
  - feedback_NAME_DATE.md
refines:                       # optional, list of filenames
  - feedback_NAME_DATE.md
contradicts:                   # optional, list of filenames
  - feedback_NAME_DATE.md
composes_with:                 # optional, list of filenames
  - feedback_NAME_DATE.md
caused_by:                     # optional, list of free-text strings
  - "PR #1234 review thread"
  - "Aaron 2026-05-01 messages"
---
```

All edge fields are **optional**. New memories CAN add
them; existing memories get them incrementally as they're
touched. The 376KB of existing MEMORY.md doesn't get
retroactive edges (that's task #291-scale work).

#### Pointer values

References within `memory/` use the **filename**
(basename, not full path):

- `extends: [feedback_version_currency_always_search_first_training_data_is_stale_otto_247_2026_04_24.md]`

External-surface references (PR / issue / TaskList /
maintainer messages) live under `caused_by:` as
free-text strings.

#### Mechanization candidate

Add as **class 15** in 081KQGDBJ0008QG0R000E10AAM — "memory-edge
target-existence lint." Sibling-shape to the existing
`.github/workflows/memory-reference-existence-lint.yml`
which currently validates that `memory/MEMORY.md` link
targets exist under `memory/` (its scope is the index,
not all prose links). The new lint would parse memory
file frontmatter, extract edge fields (`extends` /
`supersedes` / `refines` / `contradicts` / `composes_with`),
and validate that the named filenames exist in
`memory/`. Cycle-detection (rejecting `extends` /
`supersedes` cycles at lint time) is a candidate
companion check; not yet implemented.

#### Why prose `## Composes with` sections stay

Frontmatter edges are **terse pointer-lists** for machine
traversal (graph audits, visualization, navigation
tooling). Prose sections **narrate the relationship** for
human readers. They serve different purposes; one
doesn't replace the other. Memories with rich relational
context keep both; memories with clear simple
relationships can use just the frontmatter. No
duplication required, no migration needed.

#### What this is NOT

- **NOT a retroactive sweep** — task #291 is the right
  place for backfilling. The edge-schema is
  authoring-discipline-going-forward.
- **NOT a graph database** — git-flat-files-with-grep is
  the store; the graph is just an emergent view from
  walking edges via `grep -lrE` (the `-r` recurses; `-l`
  lists matching filenames).
- **NOT a replacement for MEMORY.md** — the index stays
  as the cold-start reading order; edges are per-file
  relational claims, not a global index.
- **NOT bidirectional** — forward-only by design; reverse
  navigation is `grep -lrE "(extends|supersedes|refines|contradicts|composes_with):.*X" memory/`
  away (the field names are the literal frontmatter keys,
  not a generic `edge:`).
- **NOT required at PR-time** — adding edges is
  encouraged when the relationship is obvious during
  authoring; absence of edges is not a lint failure.

#### Worked example — this very file

If this `feedback_backlog_hygiene_*.md` were rewritten
today with the new schema, its frontmatter would gain:

```yaml
caused_by:
  - "Aaron 2026-04-23 backlog-hygiene cadenced-refactor message"
  - "Aaron 2026-05-01 'i've repeated myself on several designs' message"
  - "Aaron 2026-05-01 'depends on if you find that relationship' message"
  - "Aaron 2026-05-01 'related to our some other edge in memories' message"
composes_with:
  - feedback_class_level_rules_need_orthogonality_check_extend_or_create_aaron_2026_05_01.md
  - feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md
  - feedback_free_work_amara_and_agent_schedule_paid_work_escalate_to_aaron_2026_04_23.md
```

The 2026-05-01 extension to this file IS itself an
`extends` edge in narrative form; if a separate file had
been created instead, the new file's frontmatter would
carry `extends: [feedback_backlog_hygiene_..._2026_04_23.md]`.

## Composes with

- `docs/BACKLOG.md` — the target surface
- `docs/FACTORY-HYGIENE.md` rows #5, #23, #38, #50 —
  sibling meta-audits on the 5-10-round cadence
- `backlog-scrum-master` skill — if invoked as the
  dedicated runner
- `reducer` skill (Rodney's Razor) — backlog-level
  complexity reduction
- `feedback_free_work_amara_and_agent_schedule_paid_work_escalate_to_aaron_2026_04_23.md`
  — self-scheduling authorization
- `feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  — retirements leave markers, don't silently delete
