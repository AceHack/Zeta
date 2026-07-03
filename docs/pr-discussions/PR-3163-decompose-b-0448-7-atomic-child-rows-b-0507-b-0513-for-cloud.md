---
pr_number: 3163
title: "decompose(081KRFA460008QG0R000CYBGKW): 7 atomic child rows 081KRHWGX0008QG0R000E8BHQ9..081KRHWGX0008QG0R003TCDFZ5 for Cloud Routines integration"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T18:27:07Z"
merged_at: "2026-05-14T18:29:38Z"
closed_at: "2026-05-14T18:29:38Z"
head_ref: "feat/b-0448-decompose-cloud-routines-slices-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T18:34:06Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3163: decompose(081KRFA460008QG0R000CYBGKW): 7 atomic child rows 081KRHWGX0008QG0R000E8BHQ9..081KRHWGX0008QG0R003TCDFZ5 for Cloud Routines integration

## PR description

## Summary

- Decomposes 081KRFA460008QG0R000CYBGKW (Cloud Routines integration — 4th catch-43 defence layer) into 7 dependency-ordered atomic child backlog rows (081KRHWGX0008QG0R000E8BHQ9..081KRHWGX0008QG0R003TCDFZ5)
- Updates 081KRFA460008QG0R000CYBGKW parent row to `status: decomposed` with `child_rows` frontmatter field
- No code changes — documentation-only decomposition PR

## Dependency graph

```
081KRHWGX0008QG0R000E8BHQ9 (research, unblocked)
  └── 081KRHWGX0008QG0R002S107P7 (schema)
        ├── 081KRHWGX0008QG0R0014D2T5E (installer)
        └── 081KRHWGX0008QG0R001VR9FNA (cloud-schedule.json)
              └── 081KRHWGX0008QG0R0013DSSZZ (register + empirical fire)
                    ├── 081KRHWGX0008QG0R003WEP6E9 (README 4-layer table)
                    └── 081KRHWGX0008QG0R003TCDFZ5 (memory file)
```

## Child rows

| Slice | Row | Title |
|-------|-----|-------|
| 1 | 081KRHWGX0008QG0R000E8BHQ9 | Research Cloud Routines auth + registration API surface (gate row) |
| 2 | 081KRHWGX0008QG0R002S107P7 | Define `cloud-schedule.json` schema for `tools/routines/<id>/` |
| 3 | 081KRHWGX0008QG0R0014D2T5E | Extend `tools/routines/install.ts` to detect + surface `cloud-schedule.json` |
| 4 | 081KRHWGX0008QG0R001VR9FNA | Author `autonomous-loop/cloud-schedule.json` (first Cloud Routine declaration) |
| 5 | 081KRHWGX0008QG0R0013DSSZZ | Register Cloud Routine + empirical first-fire observation |
| 6 | 081KRHWGX0008QG0R003WEP6E9 | Update `tools/routines/README.md` with 4-layer catch-43 table |
| 7 | 081KRHWGX0008QG0R003TCDFZ5 | Memory file capturing empirical Cloud Routine bootstrap learning |

## Focused checks

- [x] ID collision check: 081KRHWGX0008QG0R000E8BHQ9..081KRHWGX0008QG0R003TCDFZ5 verified clear on-disk (highest on-disk was 081KRHWGX0008QG0R002C038BJ) and in-flight (081KRHWGX0008QG0R002DPG02X open PR is the only in-flight row in this range)
- [x] Bus claim acquired: `otto-cli` claimed 081KRFA460008QG0R000CYBGKW before write work began
- [x] Format matches existing decomposed child rows (e.g. 081KRHWGX0008QG0R002VV6DTS..081KRHWGX0008QG0R0023FDYVE)
- [x] Decomposition hint from 081KRFA460008QG0R000CYBGKW itself used as starting point, then refined
- [x] Each child row has `parent: 081KRFA460008QG0R000CYBGKW`, correct `depends_on:`, pre-start checklist, acceptance criteria, and definition of done

## Next step

Pick up 081KRHWGX0008QG0R000E8BHQ9 (unblocked). After 081KRHWGX0008QG0R000E8BHQ9 closes, 081KRHWGX0008QG0R002S107P7, 081KRHWGX0008QG0R0014D2T5E, and 081KRHWGX0008QG0R001VR9FNA can proceed in parallel.

operative-authorization: aaron 2026-05-13: "Cooling period: TBD. The memory file IS the durable record"

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T18:30:50Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `03a2b51756`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T18:32:24Z)

## Pull request overview

Documentation-only backlog decomposition of 081KRFA460008QG0R000CYBGKW into seven dependency-ordered child backlog rows for Cloud Routines integration.

**Changes:**

- Marks 081KRFA460008QG0R000CYBGKW as decomposed and adds child row references.
- Adds 081KRHWGX0008QG0R000E8BHQ9..081KRHWGX0008QG0R003TCDFZ5 child rows covering research, schema, installer support, first declaration, registration, README updates, and memory capture.
- Defines dependency ordering and acceptance criteria for each slice.

### Reviewed changes

Copilot reviewed 8 out of 8 changed files in this pull request and generated 10 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| `docs/backlog/P1/081KRFA460008QG0R000CYBGKW-cloud-routines-integration-4th-catch-43-defence-layer-2026-05-13.md` | Updates parent row status and decomposition summary. |
| `docs/backlog/P1/081KRHWGX0008QG0R000E8BHQ9-b0448-slice1-cloud-routines-api-research-2026-05-14.md` | Adds research gate row for Cloud Routines unknowns. |
| `docs/backlog/P1/081KRHWGX0008QG0R002S107P7-b0448-slice2-cloud-schedule-json-schema-2026-05-14.md` | Adds schema-definition slice. |
| `docs/backlog/P1/081KRHWGX0008QG0R0014D2T5E-b0448-slice3-install-ts-cloud-schedule-extension-2026-05-14.md` | Adds installer-extension slice. |
| `docs/backlog/P1/081KRHWGX0008QG0R001VR9FNA-b0448-slice4-autonomous-loop-cloud-schedule-json-2026-05-14.md` | Adds first Cloud Routine declaration slice. |
| `docs/backlog/P1/081KRHWGX0008QG0R0013DSSZZ-b0448-slice5-register-cloud-routine-empirical-fire-2026-05-14.md` | Adds registration and empirical-fire slice. |
| `docs/backlog/P1/081KRHWGX0008QG0R003WEP6E9-b0448-slice6-readme-4-layer-table-2026-05-14.md` | Adds README update slice. |
| `docs/backlog/P1/081KRHWGX0008QG0R003TCDFZ5-b0448-slice7-memory-file-empirical-bootstrap-learning-2026-05-14.md` | Adds memory-capture slice. |
</details>

## Review threads

### Thread 1: docs/backlog/P1/081KRHWGX0008QG0R001VR9FNA-b0448-slice4-autonomous-loop-cloud-schedule-json-2026-05-14.md:45 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T18:30:50Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Keep cloud schedule trigger shape consistent**

This template uses a `triggers` array, but slice 2 defines the canonical schema with a singular `trigger` object (`docs/backlog/P1/081KRHWGX0008QG0R002S107P7-b0448-slice2-cloud-schedule-json-schema-2026-05-14.md`, schema examples). If 081KRHWGX0008QG0R002S107P7 lands as written, implementers following this row will produce `cloud-schedule.json` files that fail schema/type validation and installer expectations, blocking 081KRHWGX0008QG0R001VR9FNA/081KRHWGX0008QG0R0013DSSZZ until one side is rewritten; align both slices to one field shape.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P1/081KRHWGX0008QG0R0013DSSZZ-b0448-slice5-register-cloud-routine-empirical-fire-2026-05-14.md:107 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T18:30:50Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Avoid unsupported `blocked` status in fallback flow**

The fallback instructs closing the row as `status: blocked`, but backlog pickup only treats `status === "open"` as actionable (`tools/backlog/autonomous-pickup.ts`), so a blocked row drops out of automatic selection and can be stranded indefinitely unless someone remembers to manually reopen it. In the exact “Cloud Routines unavailable” scenario this creates workflow deadlock risk; use a supported status/lifecycle or add explicit tooling support for `blocked`.

Useful? React with 👍 / 👎.

### Thread 3: docs/backlog/P1/081KRFA460008QG0R000CYBGKW-cloud-routines-integration-4th-catch-43-defence-layer-2026-05-13.md:12 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:20Z):

P1: This new parent field uses `child_rows`, but decomposed backlog parents consistently use `children:` (for example 081KRFA460008QG0R0007RWSN1 and many other parents). Keeping a unique field name makes the child list invisible to existing grep/tooling conventions and contradicts the line below that tells readers to use the `child_rows` field for PR tracking.

### Thread 4: docs/backlog/P1/081KRHWGX0008QG0R000E8BHQ9-b0448-slice1-cloud-routines-api-research-2026-05-14.md:2 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:21Z):

P1: These new backlog rows are not reflected in `docs/BACKLOG.md`; searching the generated index shows no 081KRHWGX0008QG0R000E8BHQ9 entry. `tools/backlog/README.md` says the generator regenerates `docs/BACKLOG.md`, so the index will be stale and readers/tools using it will miss the new decomposition.

### Thread 5: docs/backlog/P1/081KRHWGX0008QG0R001VR9FNA-b0448-slice4-autonomous-loop-cloud-schedule-json-2026-05-14.md:57 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:21Z):

P1: This template uses a plural `triggers` array, but the schema slice (081KRHWGX0008QG0R002S107P7) and installer contract (081KRHWGX0008QG0R0014D2T5E) both define a singular `trigger`/`CloudTrigger`. As written, the first `cloud-schedule.json` produced by this row would not validate against the schema it depends on.

### Thread 6: docs/backlog/P1/081KRHWGX0008QG0R0013DSSZZ-b0448-slice5-register-cloud-routine-empirical-fire-2026-05-14.md:107 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:22Z):

P1: `blocked` is not an allowed backlog status; the current schema allows `open`, `closed`, `superseded-by-B-NNNN`, `deferred`, and `decomposed`. Following this instruction would create a row status that the backlog tooling/documentation does not define, so use an allowed blocked-state representation instead.

### Thread 7: docs/backlog/P1/081KRHWGX0008QG0R003TCDFZ5-b0448-slice7-memory-file-empirical-bootstrap-learning-2026-05-14.md:38 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:22Z):

P1: The proposed memory filename uses a hyphenated date placeholder, but the memory format standard requires snake_case filenames and date suffixes in `_YYYY_MM_DD` form. If this template is followed literally, the new memory file will violate the memory filename rules.

### Thread 8: docs/backlog/P1/081KRHWGX0008QG0R003TCDFZ5-b0448-slice7-memory-file-empirical-bootstrap-learning-2026-05-14.md:48 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:22Z):

P1: This frontmatter template is not valid for `memory/` files: `type` must be a top-level field, no extra `metadata:` field is allowed, and the value must match the filename prefix. The proposed path starts with `feedback_` but this template marks it as `project`, so the implementing slice would create a memory file that fails the documented memory schema.

### Thread 9: docs/backlog/P1/081KRHWGX0008QG0R003TCDFZ5-b0448-slice7-memory-file-empirical-bootstrap-learning-2026-05-14.md:95 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:22Z):

P2: The proposed `MEMORY.md` index entry is longer than the memory index standard's under-150-character limit. Following this template would add an over-budget index line; shorten the label/filename reference or move detail into the memory body.

### Thread 10: docs/backlog/P1/081KRHWGX0008QG0R001VR9FNA-b0448-slice4-autonomous-loop-cloud-schedule-json-2026-05-14.md:60 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:23Z):

P2: This template would put a persona name into a current-state configuration file under `tools/routines/`. The repo convention keeps names on history surfaces like backlog rows, but reusable code/config should use role references instead, so the future `cloud-schedule.json` should avoid carrying this attribution into the routine description.

### Thread 11: docs/backlog/P1/081KRHWGX0008QG0R003WEP6E9-b0448-slice6-readme-4-layer-table-2026-05-14.md:27 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:23Z):

P2: This says the replacement is a "4-column table", but the template below is a 7-column table and appears to be a 4-layer table. The mismatch makes the work item ambiguous for the implementer.

### Thread 12: docs/backlog/P1/081KRHWGX0008QG0R003WEP6E9-b0448-slice6-readme-4-layer-table-2026-05-14.md:75 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:32:23Z):

P1: The section is supposed to explain why there are 4 layers, but it lists only layers 1, 2, and 4. Since the template table gives layer 3 its own drift/cross-machine failure mode, omitting it here would leave the README's rationale internally inconsistent.
