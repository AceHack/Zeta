---
id: B-0008
priority: P3
status: open
title: Investigate CI macos-26 + ubuntu-slim move to nightly job IF they more-than-double PR wait time
tier: ops
effort: S
ask: Aaron 2026-04-25 (verbatim — Otto-312 typo-correction applied)
created: 2026-04-25
last_updated: 2026-04-26
composes_with: [project_frontier_burn_rate_ui_first_class_git_native_for_private_repo_adopters_servicetitan_84_percent_2026_04_23.md]
tags: [ci, runner-strategy, wasm, embedded, nightly, build-throughput]
---

# Investigate CI macos+slim nightly-move if more than 2x PR wait time

Aaron 2026-04-25 (verbatim, Otto-312 corrected):

> "macos and ubuntu-slim variants taking longer. if this increase wait time per pr more than double if we didn't have them and just the base linux for right now consider moving these to a nightly job, we just want to make sure we have first class support and know that we support small"

> "for the embedded wasm case it will be important that we can support slim like environments — we will end up in the browser for goodness sake — very resource constrained"

## What

When `build-and-test (macos-26)` + `build-and-test (ubuntu-slim)` more-than-double the PR wait time vs linux-only, evaluate:

1. **Move to nightly**: schedule on nightly cron, removed from required-checks-on-PR.
2. **Keep first-class visibility**: nightly job results visible somewhere (status badge, dashboard, Frontier UI) so the support-coverage isn't invisible.
3. **Don't remove**: ubuntu-slim is the proxy for embedded/WASM/browser-resource-constrained deployment targets (Otto-308 substrate-extension on Frontier UI gitnative); macos-26 is the proxy for Mac dev / CI confidence.

## Decision criteria

- IF linux variants finish in N min and macos+slim add another ≥ N min → move to nightly.
- IF macos+slim add ≤ 0.5 N min → keep on PR-gate.
- Borderline (0.5N – 1N): investigate parallel-acceleration first (faster runners, image caching, minimal dotnet-restore).

## Out of scope

- Removing macos-26 or ubuntu-slim from CI entirely (NOT requested; first-class support stays).
- Changing required-status-checks branch protection (only removing from required-on-PR; nightly checks STILL run, just async).

## Composes with

- WASM/browser deployment target (Otto substrate, see frontier UI substrate-files).
- Frontier-UI burn-rate first-class concern (`project_frontier_burn_rate_ui_first_class_git_native_for_private_repo_adopters_servicetitan_84_percent_2026_04_23.md`).
- Otto-300 rigor-proportional-to-blast-radius — CI gate strictness should match actual breakage probability.

## Done when

- (a) Decision made: nightly-move OR keep-on-PR-gate OR parallel-accelerate.
- (b) If nightly-move: workflow file landed; required-checks updated; nightly-result visibility configured.
- (c) Otto-313 teaching-reply available for future Copilot/Codex catches that flag macos/slim absence from PR gate.
