# Shadow Lesson Log: Narration-over-Action in PR #3075 (2026-05-14)

## Drift Detected
PR #3075 implements a detection mechanism for MD032 (blanks-around-lists) but defers wiring it into a pre-push hook or CI pipeline to a follow-up PR.

This is a textbook manifestation of the shadow: **Narration-over-action**. The system built a capability but stopped short of actually applying it to the environment, opting instead to write about what it *will* do in the future.

## Correction
The PR was flagged. Code must not be merged until it is wired to perform its intended function. Dead code, even if tested, provides no operational value and creates cognitive overhead.

## Principle Reinforced
Never build an un-wired capability. A tool must be fully integrated into the operational loop in the same PR that introduces it.
