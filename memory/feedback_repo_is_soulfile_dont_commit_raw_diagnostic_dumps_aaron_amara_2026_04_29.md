---
name: The git repo is the soulfile — don't commit raw diagnostic dumps; use extracts + re-run recipes (Aaron + Amara 2026-04-29)
description: The git repo (and all its history) is the project's soulfile — every committed byte lives forever. Don't pollute it with multi-MB raw diagnostic outputs (fsck dumps, rev-list dumps, profile traces, log archives). Commit load-bearing extracts + a re-run recipe instead. Caught when corruption-triage commit added 20,978 lines of mostly-irrelevant raw fsck/rev-list output to PR #757; reduced to ~28 KB of extracts. Non-soul repos and git-lfs are escape hatches when raw artifacts are genuinely load-bearing and large; default is extract+recipe.
type: feedback
---

# The git repo is the soulfile — don't dirty it

## Source

Aaron 2026-04-29: *"what amara says here about repo size, it
critical load-bearing, its' your soul/soulfile the git repo
and all history, don't let your soul get dirty you control
what belongs in there, and we can have non soul repos too or,
git lfs if needed."*

Amara 2026-04-29: *"This commit added 20,978 lines of
artifacts. That may be acceptable once, but it's a smell.
GitHub warns at 50 MiB and blocks files over 100 MiB; even
below those limits, dumping large diagnostic logs into normal
repo history can bloat the repo and make future reviews
awful."*

## The rule (load-bearing)

```text
The git repo and all its history is the soulfile.
Every committed byte lives forever.
Default discipline:
  Commit load-bearing extracts + a re-run recipe.
  Do not commit multi-MB raw diagnostic dumps.

Escape hatches (when raw is genuinely load-bearing AND large):
  - Non-soul repo (separate repo for diagnostic archives)
  - Git LFS (large files outside main object DB)
```

Future-Claude check: before adding a `*.txt` /
`*.log` / `*.jsonl` / `*.csv` artifact to the repo,
ask:
- Is the file > ~100 KB? → smell
- Is the file > ~1 MB? → almost certainly soul-pollution
- Are 99% of the lines non-load-bearing noise? → extract +
  re-run recipe instead
- Is the file the **conclusion** or the **evidence-dump
  behind a conclusion**? Conclusion → durable. Raw evidence
  dump → re-runnable on demand, not durable.

## Worked example: 2026-04-29 corruption-triage commit

The first version of PR #757 (corruption-triage corrections)
added 20,978 lines across 9 artifact files, including:

```text
1,112,132 bytes  rev-list-all-objects.txt    (1.1 MB; 18,150 objects;
                                              only 1 line load-bearing)
   62,860 bytes  fsck-full-no-reflogs.txt    (1,116 lines; ~10 lines load-bearing)
   34,987 bytes  fsck-full.txt               (627 lines; ~10 lines load-bearing)
   34,372 bytes  fsck-connectivity.txt       (620 lines; 0 lines load-bearing for the SHAs of interest)
```

Aaron caught the soulfile pollution before merge. Amara
provided the size-check command:

```bash
# BSD/macOS-portable (default macOS find lacks -printf):
find docs/lost-substrate/artifacts/2026-04-29-corruption \
  -type f -maxdepth 1 -exec ls -la {} \; | awk '{print $5, $NF}' | sort -nr
# GNU equivalent (Ubuntu/CI runners):
# find docs/lost-substrate/artifacts/2026-04-29-corruption \
#   -type f -maxdepth 1 -printf '%s %p\n' | sort -nr
```

Corrective action: replaced the raw dumps with grep extracts
that captured only the load-bearing lines (the SHAs of
interest + per-mode line-count summary that evidences the
mode-dependence finding). Total artifact-directory size
dropped from 1.2 MB → 28 KB.

The triage-report.md added a **re-run recipe** so a future
reader who needs the raw outputs can regenerate them locally:

```bash
mkdir -p /tmp/corruption-triage-raw
git fsck --full --no-progress              > /tmp/.../fsck-full.txt 2>&1
git fsck --full --no-reflogs --no-progress > /tmp/.../fsck-full-no-reflogs.txt 2>&1
git fsck --connectivity-only --no-progress > /tmp/.../fsck-connectivity.txt 2>&1
git rev-list --objects --all               > /tmp/.../rev-list-all-objects.txt 2>&1
```

The raw is reproducible from any clone with the same local
refs at the same point in time. Committing the extracts
preserves the load-bearing evidence; committing the raw dumps
would dirty the soulfile.

## Composition pattern (extract + recipe + escape hatch)

For any "I want to capture diagnostic evidence" use case:

| Component | What it captures | Where it lives |
|---|---|---|
| Extract | Only the load-bearing lines (grep-matched) | Committed to repo |
| Re-run recipe | The exact commands that produce the raw | Committed alongside extract |
| Conclusion / report | What the evidence proves | Committed alongside extract |
| Raw dump | Full multi-MB diagnostic output | NOT committed to soul repo |
| Raw dump (if needed) | Full multi-MB diagnostic output | Non-soul repo, git-lfs, or `/tmp` |

The default is "extract + recipe + report"; the escape hatch
is "non-soul repo or git-lfs" — used only when the raw is
genuinely load-bearing AND too large to fit cleanly.

## What this rule forbids

- **No raw `git fsck` output dumps** in the soul repo. Extract
  the SHA-context lines + per-mode line-count, drop the rest.
- **No raw `git rev-list --objects --all`** in the soul repo.
  Extract the matching lines for the SHAs of interest.
- **No raw profile traces / flame graphs / dump files** in
  the soul repo. Extract summary metrics; raw goes to a
  separate location.
- **No raw build logs / CI logs** in the soul repo. Extract
  the failing-step / load-bearing lines.
- **No raw network captures / strace / dtrace dumps** in the
  soul repo. Extract the relevant transactions.
- **No raw conversation transcripts** in the soul repo —
  unless the transcript IS the substrate (e.g., the
  Amara-conversation absorb under `docs/amara-full-conversation/`
  is the substrate-of-substrate per
  `project_aaron_amara_conversation_is_bootstrap_attempt_1...`).

## What this rule does NOT forbid

- **Committed test data, fixtures, example inputs** — these
  are load-bearing for the code that uses them. Live in
  `tests/fixtures/`, `examples/`, etc.
- **Substrate documents** — research notes, ferries,
  ledgers, ADRs, triage reports — these ARE the conclusion,
  not the raw evidence behind it.
- **Conversational substrate** that is the source-of-truth
  for the factory (Amara conversations, ferry texts) —
  these are first-class substrate, not diagnostic noise.

## Composes with

- `memory/feedback_corruption_triage_discipline_object_health_incident_aaron_amara_2026_04_29.md`
  — corruption-triage discipline; this rule was caught
  while applying that one.
- `memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md`
  — clean-signal discipline at the DSP layer; this rule
  is the substrate-cleanliness analogue at the repo layer.

## Distilled rules (keepers)

```text
The git repo and all its history is the soulfile.
Every committed byte lives forever.
```

```text
Default: extract + recipe. Don't commit raw multi-MB dumps.
```

```text
Conclusion is durable. Raw evidence is re-runnable.
```

```text
Non-soul repo or git-lfs are escape hatches when raw is
genuinely load-bearing AND too large for the soul repo.
```

```text
Don't let your soul get dirty.
You control what belongs in there.
```
