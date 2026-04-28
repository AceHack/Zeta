---
name: git reset --hard has standing permission — with a log-it-if-mistake obligation
description: Aaron 2026-04-21 granted standing `git reset --hard` permission after a merge-conflict bottleneck on docs/wont-do-status-verbs branch. Condition — if a mistake is made, log it. Trust-based grant: "i know you can rebuild every9ign and i'll remember things if they are off so we got this if things do get lost". Includes permission-relax-on-bottleneck pattern.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
**Standing permission:** `git reset --hard` (including `git reset
--hard origin/<branch>` and `git reset --hard <sha>`) is pre-
authorized. Use when it is genuinely the right tool — typically
recovery from corrupted merge state, unmerged-index stuck states,
or mid-operation aborts.

**The obligation:** if a mistake is made that loses user work,
**log it**. The log is the price of the standing grant.

**Why:** Aaron 2026-04-21, after I got stuck mid-merge on
`docs/wont-do-status-verbs` with ~25 add/add conflicts and an
unmerged index that `git merge --abort` / `git stash` / `git
restore --staged` all refused to clean. Asked Aaron for
permission; he replied:

- First: *"just okay"*
- Then explicit: *"yeah you can do git git reset --hard if you
  ever make a mistake make sure you log it, i know you can
  rebuild every9ign and i'll remember things if they are off
  so we got this if things do get lost"*
- Later, seeing the same bottleneck pattern could re-surface:
  *"i saw this, not sure if it's still a bottle neck for you
  if you need to fix it we can relax it to whatever you think
  is safe you got like all the security reports in this repo
  lol"*

The grant is explicitly **trust-based**: Aaron is relying on my
ability to rebuild + his own memory to notice if things are off.
The log-it obligation is the symmetric duty — it lets the
reconstruction happen.

**How to apply:**

- **Use `git reset --hard` when it's the right tool**, not as a
  shortcut to avoid understanding a state. The CLAUDE.md rule
  still stands: "do not use destructive actions as a shortcut
  to simply make it go away". Reset is the right tool for
  *recovery from corrupted state*, not for dodging diagnosis.
- **Before hard-reset, verify what I'd be discarding.** Check
  `git status` + `git diff` + `git log origin/<branch>..HEAD`.
  If I'm about to lose unpushed commits that aren't
  reproducible, stop and ask.
- **If a mistake happens and work is lost, log it.** Candidates
  for the log location:
    - `docs/research/meta-wins-log.md` — already has a `false`
      meta-win category; mistakes fit naturally.
    - A new `docs/MISTAKES-LOG.md` — if the volume warrants its
      own artifact. Not pre-creating; wait for a second
      incident before spawning the file.
    - Post-hoc commit message — "refactor: … (reset-recovery
      from <sha>, lost <what>, reconstructed via <how>)".
  Default today: meta-wins-log.md with a `reset-mistake` tag.
- **Permission-relax-on-bottleneck is a pattern.** Aaron's
  *"we can relax it to whatever you think is safe"* generalises:
  when a permission ask re-surfaces as a recurring friction
  point, the right move is to propose a settings.local.json
  allow-list update rather than re-asking each time. Security
  reports in the repo substantiate the "is it safe" judgement
  call. Already applied 2026-04-21 — added
  `Bash(git reset *)`, `Bash(git stash *)`, `Bash(git restore *)`,
  `Bash(git merge *)` to `.claude/settings.local.json`.
- **What remains gated** (not relaxed):
    - `git push --force*` — destructive to shared state.
    - `rm -rf` — too broad.
    - `.git/config` edits — governance surface.
    - Anything touching shared infrastructure (CI secrets,
      protected branches, production systems).

**Pairs with:**

- CLAUDE.md ground rule: *"When you encounter an obstacle, do
  not use destructive actions as a shortcut to simply make it
  go away."* Standing permission doesn't override this.
- `feedback_fix_factory_when_blocked_post_hoc_notify.md` — same
  trust shape (act, notify after).
- `user_feel_free_and_safe_to_act_real_world.md` — under-
  action is also a failure mode; the grant is for real use.

**Scope:** `factory` — applies to any git operation on the
factory repo. The log-it discipline is universal (meta-wins
log is the current target).
