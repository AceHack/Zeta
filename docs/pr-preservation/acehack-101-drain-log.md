# PR-preservation drain-log — AceHack #101

**PR:** AceHack/Zeta#101
**Title:** ops(0-0-0): post-reset cleanup — stale-prose fixes + protection-config memory
**Opened:** 2026-04-29T14:18Z
**Merged:** 2026-04-29T14:19:41Z (squash; merge commit `5485772e87d74f3b96cdac4f39063cb0e82d7839`)
**Branch:** post-0-0-0-cleanup-2026-04-29 → main
**Status checks:** 17 ran (most short-running), no required-status-checks rule on AceHack so auto-merge fired ~2 min after open

## Threads (0 review threads, 0 issue-level comments)

AceHack/Zeta does NOT have Codex or Copilot installed as PR reviewers (or they didn't have time to file before auto-merge fired). Result: zero review-agent feedback was collected on this AceHack PR. The same content went through the LFG side as #844 first, where Codex + Copilot DID review and produce 5 substantive threads (preserved in `lfg-844-drain-log.md`).

This is the **double-hop training-data observation in practice**: AceHack and LFG produce different review-agent feedback per identical content. AceHack has weaker/no review coverage; LFG has the full Codex + Copilot pass. The double-hop value here is the LFG side, not the AceHack side. Per Aaron's framing, BOTH are valuable training signal — silence on AceHack is also signal (telling us AceHack's review surface is sparser).

## Outcome class summary

- 0 threads filed
- 0 issue-level comments
- Outcome class: AUTO-MERGED-NO-REVIEW

## Lessons for future PRs

1. **Review-agent coverage asymmetry between forks** is real and worth tracking. AceHack's review surface (Codex/Copilot bot configuration) is weaker than LFG's. The double-hop pattern compensates by routing every PR through LFG's review surface either before (AceHack-first → LFG forward-sync) or after (LFG-first → AceHack mirror).

2. **AceHack rulesets has no required-status-checks rule.** PRs auto-merge without lint/test gates passing. This is acceptable for the dev-mirror role (rapid iteration) but means AceHack-side PR quality depends on the human author + the eventual LFG forward-sync gate catching anything.

3. **Documenting the asymmetry**: AceHack's role is "where work lands first for fast iteration"; LFG's role is "where review rigor lands and becomes durable substrate." The training-data corpus collects from BOTH, with the understanding that they capture different things.

## Relationship to LFG #844

This PR is the canonical-direction reopening of LFG #844 (which was opened LFG-first by mistake and closed per Aaron's correction: *"without the double-hop in a few hours we'll be right back to where we started — that's load-bearing to get right"*). The 5 review threads from #844 are preserved at `lfg-844-drain-log.md`; the corresponding fixes are committed to the same branch (`post-0-0-0-cleanup-2026-04-29`) and carried into both this AceHack PR and the upcoming LFG forward-sync PR.
