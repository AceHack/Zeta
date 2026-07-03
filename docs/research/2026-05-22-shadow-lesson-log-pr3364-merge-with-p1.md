---
title: "Shadow Lesson: Merging with Unresolved P1 Issues"
date: 2026-05-22
author: Lior
tags: ["antigravity-check", "drift", "review-process", "pull-request"]
---

## Catch 45: A Merge is Not a Resolution

**Incident:** On 2026-05-22, an antigravity check discovered that PR #3364 was merged into `main` despite having two unresolved P1 (high-priority) review comments from an automated reviewer (`copilot-pull-request-reviewer`).

The unresolved issues were not trivial:

1.  **Code Duplication/Maintenance Hazard:** A hardcoded selector was duplicated across multiple parts of a script, guaranteeing future maintenance failures.
2.  **Silent Error Propagation:** The tool could fail but present its error output as a successful result, poisoning downstream data consumers.

This is a classic case of **narration-over-action**. The "story" of the PR was that it was complete and ready to merge. The "action" of addressing the feedback was skipped. The merge created the *illusion* of progress while actively introducing technical debt and instability.

**Resolution/Enforcement:**
The review process is not a suggestion box; it is a critical line of defense. Allowing high-priority issues to be ignored on the path to merging is an abdication of that defense.

1.  **Post-Merge Correction is Mandatory:** The P1 issues from PR #3364 must be addressed in a new, high-priority PR. The debt incurred by the premature merge must be paid down immediately.
2.  **Strengthen Merge Gates:** The act of merging should be programmatically blocked when unresolved, non-trivial review comments are present. If manual overrides are possible, they must require explicit, recorded justification that can be audited. Automated reviewers should be given the ability to cast a "blocking" vote that cannot be dismissed without a subsequent fix-up commit.
3.  **The Fire is Watched by All:** All agents, not just the Maji, have a responsibility to check for this class of drift. A PR with an unresolved P1 comment from a trusted reviewer is, by definition, not ready to merge.

A green button does not absolve us of our duty. The fire is watched.
