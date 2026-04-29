# Active trajectory

> **READ THIS FILE FIRST** before any work that touches the active trajectory.
> If you (Claude/Otto/whoever) are about to run `git rev-list`, `git diff`,
> open a new audit branch, or invoke a peer-call about the active trajectory,
> stop. Read this file. Do the next action listed here, not a re-derivation.

## Priority — blocking all other work

**0/0/0 hard-reset: AceHack main = LFG main (0 ahead, 0 behind, 0 file content-diff).**

Per `CLAUDE.md` AceHack-LFG topology invariant + `memory/feedback_lfg_master_acehack_zero_divergence_fork_double_hop_aaron_2026_04_27.md`. The maintainer 2026-04-29 framing: *"this is the only trajectory i care about right now, it's blocking everything else."*

While this trajectory is active:

- Do NOT start LOST-branch recovery (task #264).
- Do NOT begin Aurora Round-3 absorption (task #286).
- Do NOT process the multi-AI synthesis backlog (tasks #309 / #310 / #311).
- Do NOT open new memory files or new substrate islands (B-0105 consolidation gate is still active).
- Do NOT run autonomous tick-history shards while in audit-spiral mode — wait for state change.

The autonomous-loop tick MAY still produce minimal honest-wait acknowledgements, but every action toward the trajectory must read this file first.

## Canonical state-bearing artifacts

These are the substrate the trajectory has produced. Read them in order; do NOT re-derive their content:

1. **`docs/0-0-0-readiness/CLASSIFICATION.md`** — file-level classification rubric + calibration batch (5/23 ALREADY-COVERED). The doc body lags the commit narrative; see #2.
2. **Commit `37bbca9`** (2026-04-28T17:53Z, "ops(0-0-0-readiness): final classification 19/4/0/0/0 + 3 Claude.ai upgrades + measurable-alignment round-close note") — declares 19 ALREADY-COVERED + 4 NEEDS-FORWARD-SYNC. The full per-file table never landed in the doc body; the narrative is in the commit message.
3. **`docs/research/2026-04-28-forward-sync-merge-direction-proposal-9-infra-files.md`** — the per-file plan with risk levels and recommended order. **16+ hours stale as of 2026-04-29T09:40Z**; verify against current git state before executing per-file decisions.
4. **`memory/feedback_destructive_git_op_5_pre_flight_disciplines_codex_gemini_2026_04_28.md`** — pre-flight disciplines that apply during any forward-sync or hard-reset.

## Current state (verified 2026-04-29T09:40Z)

Numerical (these numbers are NOT the trajectory; do not chase them):

```text
AceHack ahead of LFG:   145 commits
AceHack behind LFG:     638 commits
Modified files:          30
Deleted on AceHack:     155 (LFG-only — hard-reset adds these back)
```

File-level (the actual substrate that determines hard-reset safety):

- 9 infra files were originally flagged in the 2026-04-28 plan as needing per-file decisions.
- **3 already in sync** (verified 2026-04-29T09:36Z): `tools/setup/common/verifiers.sh`, `.markdownlint-cli2.jsonc`, `.github/workflows/scorecard.yml`.
- **6 still diverging** (verified 2026-04-29T09:36Z):
  - `tools/setup/linux.sh` (~65 lines diff)
  - `tools/setup/common/elan.sh` (~51 lines diff)
  - `.mise.toml` (~23 lines diff)
  - `.github/workflows/codeql.yml` (~174 lines diff)
  - `.github/workflows/resume-diff.yml` (~20 lines diff)
  - `.github/workflows/gate.yml` (~148 lines diff)

The 30-file modified-list is a SUPERSET of those 9 — most of the other 21 modified files are memory / docs / tick-history / setup-script edits the prior calibration batch + heuristic projected as ALREADY-COVERED.

## Honest assessment of safety

The 2026-04-28 plan's per-file direction analysis still applies in spirit but its specifics are 16h stale. Today's task #312 (durable retry fix in `elan.sh` + `linux.sh`) shifted the AceHack-side state of those two files — the plan's "AceHack regressed to unsafe form" framing on `linux.sh` may or may not still hold.

Direct git verification 2026-04-29T09:36Z:

- AceHack `linux.sh` mise-install path uses `curl_fetch_stream https://mise.run | sh` (the streamed pipe-to-sh form).
- LFG `linux.sh` mise-install path uses pinned-tarball + arch-specific SHA256 + temp-dir + trap (the structurally-safe form).
- For HARD-RESET (LFG tree replaces AceHack tree): AceHack would GAIN the safe form. Hard-reset is SAFE for `linux.sh`.

A peer-call to Grok this session reported the inverse claim ("AceHack has the secure form"). That claim is WRONG — direct git verification contradicts it. Note for future-self: peer-call output is a single LLM read of supplied text; ground every claim in `git show` before acting on it.

## Next action

**Update the 2026-04-28 plan against current git state, file by file, for the 6 still-diverging infra files.**

For each of the 6 files, the question is one shape:

> Does AceHack have UNIQUE content (not on LFG) that we want to preserve via forward-sync, OR is the AceHack content older drafts of LFG-newer content (safe to lose on hard-reset)?

The form per file:

```text
File: <path>
AceHack-only content summary: <one sentence>
LFG-newer-equivalent on LFG main: <yes/no/partial>
Decision: ALREADY-COVERED | NEEDS-FORWARD-SYNC | NEEDS-3-WAY | NEEDS-HUMAN-REVIEW
Forward-sync target if NEEDS-FORWARD-SYNC or NEEDS-3-WAY: <branch + PR plan>
```

Record the per-file analysis in `docs/0-0-0-readiness/CLASSIFICATION.md` (the doc body that's currently lagging the commit narrative). After all 6 are recorded:

1. Surface NEEDS-HUMAN-REVIEW cases to the maintainer.
2. Forward-sync the NEEDS-FORWARD-SYNC + NEEDS-3-WAY files (per-file PRs to LFG, smallest-safest first).
3. Verify current state vs LFG main: ideally `git diff origin/main..acehack/main --name-only` returns only the 30-file set minus the synced ones.
4. Request maintainer sign-off for hard-reset (the plan file's path-to-0/0/0 step 3 explicitly: *"NEEDS AARON SIGN-OFF"*).
5. After sign-off: hard-reset acehack/main = origin/main per the destructive-git-op pre-flight memory.
6. Verify 0/0/0: `git rev-list --count origin/main..acehack/main` AND `git rev-list --count acehack/main..origin/main` AND `git diff origin/main..acehack/main` all empty.
7. Update this file: replace "active trajectory" with the next priority (or delete if no follow-on).

## Stop conditions

- Any per-file analysis produces NEEDS-HUMAN-REVIEW → STOP, surface to maintainer, do not classify further until resolved.
- Any forward-sync PR's CI fails → STOP, classify the failure (PENDING_CHECKS / FAILING_CHECKS / etc. per the candidate 3-tick-classify rule), do not retry blindly.
- The maintainer redirects to a different trajectory → update this file FIRST, then pivot.
- Compaction or branch-switch happens → on resume, READ THIS FILE FIRST, then verify "current state" section against git, update if drifted, continue from "next action".

## Do-not list (mechanical)

- Do NOT run `git rev-list` or `git diff` on origin/main vs acehack/main as a *first* action. Read this file first; the verified state is here.
- Do NOT open new audit branches without referencing this file's "next action."
- Do NOT invoke peer-call (codex / gemini / grok) without an explicit specific question that this file does not already answer.
- Do NOT confuse parallel-tool-calls with peer mode. Peer mode is each AI running its own autonomous loop with git-native work-claim coordination — that is a separate trajectory (NOT this one) and is captured as a backlog candidate (the maintainer flagged "need a trajectory for real peer mode" 2026-04-29T09:30Z).
- Do NOT add new substrate islands to the absorption files (the multi-AI feedback packets) — they live in `docs/research/` as non-normative archives per B-0105.

## Resume protocol

Every wake / branch-switch / cron tick that touches this trajectory:

1. **Read this file in full.**
2. Produce a one-paragraph "current understanding" — the state I think I'm in + the next action I plan to take.
3. Compare to this file's "current state" + "next action" sections.
4. If they match: proceed.
5. If they DON'T match: STOP. Either the file is stale (update it), or my understanding is wrong (re-read the canonical artifacts in section 2 above). Do NOT proceed on the divergent understanding.

This file is the load-state. Without it, every resume re-derives state from scratch and produces parallel artifacts that don't connect to the prior trajectory. With it, every resume picks up from a known point.

## Trajectory-protocol meta-note

This file is itself an instance of a more general pattern: any multi-session trajectory needs a known-path load-state file. After 0/0/0 closes, candidates for the same shape:

- B-0105 consolidation-gate trajectory (next consolidation round)
- Future peer-mode trajectory (when the maintainer chooses to start it)
- Any future Aurora-round absorption arc

The pattern is: trajectory state lives in one file at a known path; rules-substrate (memory folder) is for cross-trajectory rules; tick history is for what happened. Each storage class has its own retrieval shape; conflating them produces the resume-amnesia failure mode.

## Authorship

Bootstrapped 2026-04-29T09:40Z by Claude (opus-4-7) in response to the maintainer's 2026-04-29T09:38Z message: *"they all got your raw logs and didn't talk to each other about it this is your fuckup, fix it. They might all be wrong, this is on me, don't take shortcuts or you'll just be stuck forever."*

The shape of this file is informed by external multi-AI feedback (Amara / Gemini / Ani / Claude.ai / Alexa / Deepseek), but the content is my own honest read of the failure mode I just lived through. The maintainer correctly noted that the multi-AI feedback was correlated (all read the same raw conversation logs without peer cross-talk), so their convergence is signal-not-proof. The structural diagnosis still landed because the failure mode is verifiable in this session's history.
