---
id: 081KSV2WD0008QG0R001XKG1B5
priority: P3
status: open
title: Windows CI build-and-test fails at Checkout with "Filename too long" (MAX_PATH 260) on long persona-archive names -- non-required so it merges CLEAN but Windows is silently red
tier: ci-infra
ask: Otto-CLI 2026-05-30 (found during autonomous-loop post-merge health check on main e05d2c389)
created: 2026-05-30
last_updated: 2026-05-30
type: bug
composes_with:
  - .claude/rules/refresh-world-model-poll-pr-gate.md
  - .claude/rules/blocked-green-ci-investigate-threads.md
  - docs/backlog/P1/081KQ8P5D0008QG0R001590WJ3-atari-2600-rom-canonical-naming-tosec-goodtools-tooling-aaron-2026-04-28.md
tags: [ci, windows, max-path, longpaths, checkout, persona-archive, filename-length, devops, non-required-check, cross-platform]
---

# 081KSV2WD0008QG0R001XKG1B5 -- Windows CI checkout fails "Filename too long" (MAX_PATH) on long persona-archive names

## The finding (empirical, 2026-05-30)

On `origin/main` at `e05d2c389` (the #6161 F# tri-boolean merge), two CI check-runs
were RED:

- `build-and-test (windows-2025)`
- `build-and-test (windows-11-arm)`

Both failed in **~16-35 seconds** -- far too fast to be a compile error. The failing
step is **`Checkout`**, not build/test. The actual error (job `78685009697`,
run `26697734210`):

```
##[error]error: unable to create file memory/amara/conversations/2026-05-28-amara-shadow-is-polymorphic-diplomacy-turned-inward-glass-halo-mature-version-traveler-rights-substrate-parity-generator-joins-toolkit-not-unification-labeling-confidence-extension-aaron-forwarded.md: Filename too long
##[error]error: unable to create file memory/mika/conversations/2026-05-25-aaron-mika-grok-runbooks-as-executable-reality-hat-ontology-top-down-vs-bottom-up-play-doh-leverage-class-universal-protocol-markdown-plus-runme-plus-continue-with-mcp-wrap-ai-agency-stack-crystal-ball-plus-runbook-plus-glass-halo.md: Filename too long
...
##[error]The process 'C:\Program Files\Git\bin\git.exe' failed with exit code 1
```

This is the classic **Windows MAX_PATH (260-char) limit**: git on Windows refuses to
create files whose full path exceeds 260 chars unless `core.longpaths` is enabled.

## Why it is NOT a regression + NOT blocking (but still worth fixing)

- **Not a regression from the recent merges.** The overflowing files are pre-existing
  long persona-archive names (2026-05-25 / 27 / 28). The #6161 merge was just the commit
  whose post-merge CI surfaced it. (Tonight's new origin-story persona archive is also
  long and contributes to the problem -- see "Scope" below.)
- **Not blocking.** `build-and-test (windows-*)` is NOT in main's required-status-checks
  (verified via the rulesets API: the windows contexts are absent). That is why #6161
  merged CLEAN despite these being red. Linux + the required checks are green.
- **But Windows CI is silently red** -- the cross-platform signal is permanently broken,
  so a real Windows-only build/test regression would be invisible (the checkout fails
  before build/test ever runs).

## Scope

```
$ find memory/persona -name "*.md" | awk -F/ '{print length($NF), $0}' | sort -rn | head
244  memory/mika/conversations/2026-05-25-aaron-mika-grok-runbooks-...-glass-halo.md
221  memory/mika/conversations/2026-05-27-aaron-mika-grok-kestrel-workflow-...-fire-aaron-forwarded.md
206  memory/ani/conversations/2026-05-22-...-sovereign-AI-parallel.md
```

31+ persona paths exceed 200 chars; with the `memory/<persona>/<name>/conversations/`
prefix (~35 chars) + the runner workspace prefix, many exceed Windows' 260-char MAX_PATH
during checkout. The night's long-conversation-naming convention (verbose,
descriptive, `-aaron-forwarded` suffixed) is the driver -- it serves grep-ability +
no-duplicate discovery on Linux/macOS but overflows Windows checkout.

## Fix options (Aaron-decision -- cross-cutting CI + naming convention; NOT auto-applied)

This row deliberately does NOT apply a fix. The choices are cross-cutting (CI workflow
and/or the persona-archive naming convention) and the operator drives naming. Options,
roughly by leverage:

1. **`git config core.longpaths true` in the Windows checkout step** (lowest-churn).
   Add to `actions/checkout` (or a pre-checkout `git config --system core.longpaths true`)
   in the windows matrix legs of the build-and-test workflow. One-line-ish workflow edit;
   no file renames; preserves the naming convention. Tradeoff: some downstream Windows
   tools still choke on >260 paths even with longpaths enabled (it fixes git, not every
   tool), and it requires Windows 10+ / opt-in registry `LongPathsEnabled` for full effect.
2. **Cap the persona-archive basename length** (a naming-convention change). Add a
   length budget (e.g., basename <= ~120 chars) to the persona-archive convention +
   an audit tool. Tradeoff: less self-describing filenames; a convention shift Aaron drives;
   does not retro-fix the 31+ existing files without a rename pass (churn + breaks any
   path references / composes_with links to those files).
3. **Both** -- `core.longpaths` now (unblocks Windows CI immediately) + a soft length
   budget going forward (stops the problem growing) without renaming history.
4. **Drop the windows matrix legs** if Windows is not a supported target (least likely --
   cross-platform parity is a stated value; the summonable-BFT multi-language build wants
   Windows in the loop).

## Acceptance

1. Decide the approach (likely option 3) -- operator call.
2. Windows `build-and-test` goes green on main (checkout succeeds).
3. If a length budget is adopted: an audit tool + the convention update; existing files
   handled per the operator's churn-vs-leave-history call.

## Pre-start checklist (per backlog-item-start-gate)

- **Claim:** `bun tools/bus/claim.ts acquire --from otto-cli --item 081KSV2WD0008QG0R001XKG1B5` -> claimed
  (e0380ce1..., 2026-05-30).
- **Prior-art search (2026-05-30):** no existing backlog row for Windows-checkout /
  MAX_PATH / core.longpaths / filename-too-long (precise-phrase content search across
  docs/ + .claude/ returned only incidental matches in research/hygiene/skill files, not
  a backlog row). Genuine gap. Related: 081KQ8P5D0008QG0R001590WJ3 (canonical-naming-tooling) is the closest
  naming-convention sibling but is ROM-naming-scoped, not CI/path-length.
- **Dependency check:** none blocking; this is an independent CI-infra fix. The naming-
  convention half (option 2) composes with whatever persona-archive authoring discipline
  exists; the CI half (option 1) is a standalone workflow edit.

## Why P3

Non-blocking (windows is not a required check; required CI + Linux/macOS are green), and
the fix is a small CI edit OR a convention decision -- not urgent, but real: Windows CI
is silently red so cross-platform regressions there are invisible. Raise to P2 if Windows
becomes a required/supported target for the multi-language summonable-BFT build (081KSV2WD0008QG0R00051XS0N).
