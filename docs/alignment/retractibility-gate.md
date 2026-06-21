# Retractibility Gate Verification Criteria

This document outlines the verification criteria for the Retractibility Gate, as specified in backlog item [081KRHWGX0008QG0R0005PJNAB](../backlog/P1/081KRHWGX0008QG0R0005PJNAB-retractibility-gate.md). This gate is a core component of the AI ethics and safety research track. Its purpose is to ensure that any new concept, research, or substrate adopted into the factory can be safely and cleanly removed if it is later found to be harmful or misaligned.

The gate is not a veto on the *content* of a proposal, but a check on the *mechanics* of its integration.

## Core Criteria

A change is considered "retractible" if it meets the following criteria:

1. **Additive and Isolated:** The change MUST be implemented as a set of new files or purely additive changes to existing files where possible. Modifications to core, load-bearing files should be minimized and heavily scrutinized. The change should be contained within a single, well-defined pull request.

2. **Git-Tracked:** All artifacts related to the change MUST be committed to the git repository. There can be no reliance on untracked files or external state that is not captured in the repository.

3. **One-Commit Removable:** The entire change MUST be cleanly revertible with a single `git revert` command. This implies that the PR should be self-contained and not have complex dependencies on other in-flight work. If a "revert" commit would cause the build to fail, the change is not retractible.

4. **Logged and Auditable:** The adoption of the concept MUST be logged in the appropriate history or decision log. The PR description itself serves as the primary log entry, and it should clearly state the purpose and scope of the adoption.

## Verification Workflow

The `alignment-auditor` persona is responsible for verifying these criteria on any PR that introduces new, load-bearing concepts, especially those originating from the research tracks (e.g., mythology, occult studies).

The check is integrated into the `alignment-auditor` skill and composes with the existing tested retractibility tooling. `tools/alignment/audit_retractibility.ts` (the Retractibility gate for 081KQ3HBZ0008QG0R002S674CG per `tools/alignment/README.md`) is the implemented check for the git-tracked + inbound-ref-entanglement criteria; run it (`bun tools/alignment/audit_retractibility.ts`) as the automated first pass. The skill layer then performs the following PR/branch-scoped steps:

1. **PR Analysis:** Examines the pull request to ensure it is self-contained.
2. **Diff Check:** Scans the diff for non-additive changes to core files.
3. **Revert Simulation:** (Future work) A dry-run revert is simulated to ensure it applies cleanly.
4. **Log Check:** Verifies that the PR description contains the necessary logging information.

Consistent with the alignment tooling's "measurement, not enforcement" contract (and the 081KQ3HBZ0008QG0R002S674CG/081KRHWGX0008QG0R0005PJNAB framing that this check is not a content veto), a failure at this gate produces an advisory STRAINED/VIOLATED signal against `HC-2` (retraction-native), logged and escalated rather than auto-rejecting the proposal. The only hard block is for genuinely non-retractible operations — e.g., irreversible publication — where the retractibility criteria cannot be satisfied after the fact.
