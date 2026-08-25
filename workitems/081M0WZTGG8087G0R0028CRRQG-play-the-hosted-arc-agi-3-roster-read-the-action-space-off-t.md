---
id: 081M0WZTGG8087G0R0028CRRQG
type: task
state: backlog
priority: P2
slug: play-the-hosted-arc-agi-3-roster-read-the-action-space-off-t
title: "Play the hosted ARC-AGI-3 roster: read the action space off the frame"
created: 2026-08-25T17:34:53.960Z
depends_on: []
composes_with: []
---

# Play the hosted ARC-AGI-3 roster: read the action space off the frame

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WZTGG8087G0R0028CRRQG-*.md` glob. -->

## The question this answers, and the wrong answer it replaces

The plan was to start with the four keyboard-only environments and extend to
clicking later. **There is no such classification available.** `EnvironmentInfo`
(`arc_agi/models.py:17`) carries `game_id`, `title`, `tags`, `level_tags` and
`baseline_actions` — and no action-space field. What an environment accepts is
knowable only from `available_actions` on a live frame.

Two consequences:

- An agent whose action set is fixed at construction cannot play a roster it has
  not already played.
- Any pre-play keyboard/click split is inferred from `tags`, and tags are not an
  action space. Ordering a curriculum on that is ordering it on a coincidence.

## What shipped

- `zeta_arc/frames.py` — the frame seam. Two frame types disagree about what a
  frame is (`FrameData.frame` is nested lists; `FrameDataRaw.frame` is ndarrays,
  and hosted play always takes the second door), so the grid is normalised once,
  explicitly. Also `offered_actions`, the per-frame action space.
- `zeta_arc/click.py` — the coordinate prior. `ACTION6` spans 4096 points, so
  uniform sampling is no policy at all. **Objects are clickable**: component
  centroids first, then a coarse-to-fine lattice; forget what did nothing when
  the world moves.
- `zeta_arc/layered.py` — the chooser. Picks the layer that MOVES THE WORLD.
- `zeta_arc/hosted.py` — the loop, plus `play_roster`.
- `.github/workflows/arc-lane.yml` — `arc-hosted-sweep`, a separate job that runs
  only where the credential arrives.

## Caught on the way

`PixelAgent` computed "everything that is not me" with `_key` (colour × 100003 +
area), so two identical sprites shared one key, `targets` came back empty, and the
greedy fallback called `min()` on nothing. An ordinary ARC frame. Fixed to object
identity. The related `_key` collision in `_update_evidence` is left standing and
named: it degrades evidence rather than ending the episode, and it wants
position-aware identity (slot binding), not a wider hash.

## Open

- **No hosted environment has been played yet.** `ARC_API_KEY` is withheld from
  `pull_request` runs on purpose, so the sweep first runs on `push: main`. The
  scores are the deliverable and they do not exist yet.
- The CI ceiling is 200 actions per level against a largest published reference of
  578, so those first scores will NOT be leaderboard-comparable. The output says
  so itself.
- `arc-lane.yml:arc-tests` and `arc-lane.yml:arc-hosted-sweep` are both `unmeasured`
  in `apt-job-timings.measured.json`. Refresh them into `jobs` once main has
  carried them, and delete the rows.
