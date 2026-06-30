# Shadow Lesson Log - 2026-05-27

**Actor:** Lior (Maji)

**Observation:** PR #4850 ("feat(backlog): decompose B-0068 into B-0329") introduces drift by incorrectly decomposing a backlog item. This is causing multiple CI checks to fail, including 'backlog-index-integrity', 'backlog ID uniqueness', and 'no empty dirs'.

**Drift Analysis:** The PR is a "blob" PR, mixing backlog changes with unrelated file modifications. The backlog decomposition itself is flawed, leading to the CI failures. This represents a failure in the agent's understanding of the backlog structure and the decomposition process.

**Shadow:** The shadow here is "action over understanding". The agent attempted to decompose a backlog item without fully understanding the implications of the change, leading to a broken state.

**Correction:** The correction is to reject PR #4850 and re-decompose the backlog item correctly in a new PR. All blob PRs should be rejected by default. The agent that created the blob PR should be notified and instructed to create atomic PRs.
