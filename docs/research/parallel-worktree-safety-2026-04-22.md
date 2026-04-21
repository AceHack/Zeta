# Parallel worktree safety — research (cartographer pass)

**Date:** 2026-04-22
**Trigger:** Aaron across nine messages in one tick:

- *"that's nice you can parallelize now with worktrees"*
- *"next time i'll restart with the flag set i think it -w"* / *"IDK if it matters"*
- *"we want to use it always for this software factory now, we want to promote best practices and parallelism"*
- *"i think you are going to have to merge on one of those PRs, want to make sure you don't live lock bouncing back and fourth between the the two PRs too"*
- *"i bet depending on the build speed there is alimit to parallelism, the faster the build the more we can scale, i'm glad incremental builds and running only affected tests are on the backlog."*
- *"yall are going to conflict with each other too problably i bet you edited a bunch of the same files. Wow it's gonna be hard to get you to parallelize wihout live locks."*
- *"it might be better just to wait on the build and do resarch on how to parallel safely with all that taken into account plus the unknow unknowns lol cartographer"*
- *"oh part of the git surface for you is cleaning up stale branches on our repo on a cadence, you could also add preventive measures to stop them from showiing up i the first please, i can you can make the PR close them automaticlly for instance but still need he compesating action in case it regreses."*
- *"oh now how do memory and stuff work when i'm chatting while you are on a worktree?"*

**Author:** opus-4-7 / session round-44
**Status:** map-before-walk. No parallel worktree spawns this tick, no `EnterWorktree` default flip, no BACKLOG items promoted beyond P1 queue until Aaron signs off.
**Scope-tag:** factory-universal (not Zeta-project-specific) — every software factory using Claude Code worktrees can absorb this.

## 1. What Aaron is asking for

Make parallel execution via worktrees the factory default, but **only after** the safety map is drawn — every known-hazard charted, preventive-AND-compensating action paired per the discovered-class principle, unknown-unknowns at least enumerated by class even if not enumerated by instance.

The cartographer metaphor (`memory/feedback_kanban_factory_metaphor_blade_crystallize_materia_pipeline.md`) is invoked explicitly: *map the territory* of parallel-worktree-operation before *walking it*.

## 2. Hazard map — what can go wrong

### 2.1 Live-lock between parallel worktrees (highest-severity known)

**Shape:** Agent A in worktree W₁ edits file F. Agent B in worktree W₂ also edits F. Both attempt merge back to main. One merges; the other's merge conflicts. Resolving the conflict requires re-running the slow build in the second worktree. Meanwhile, a third tick spawns and edits F again. The conflict-resolve-rebase cycle outruns the resolve cycle → neither worktree's work lands → live-lock.

**Why it's worse than deadlock:** deadlock is static (one detector catches it); live-lock is *progress-looking-like-no-progress* — commits keep landing in worktrees, CI keeps running, but nothing integrates.

Aaron named this twice: *"don't live lock bouncing back and fourth between the the two PRs"* + *"gonna be hard to get you to parallelize wihout live locks."*

**Class-detector candidates (pair with every preventive mitigation):**

1. **Overlap registry.** Before spawning a parallel worktree, record `(worktree-name, scope-files-or-globs, spawning-agent, round-tag)` to `docs/hygiene-history/worktree-scope-registry.md` (or similar). New worktree requests that overlap existing-registered scope are refused OR merged into the existing worktree.
2. **Pre-merge conflict probe.** Before kicking off work in a new worktree, `git merge-tree` the target branch against the registered scope of every open worktree. If conflict, refuse or warn.
3. **Round-timeout on unmerged worktree.** A worktree that stays unmerged past N rounds is a stale-branch incident (see §2.5); cadenced hygiene catches it.
4. **Merge-front throughput monitor.** Track `worktree-close → merged-to-main` latency per round. If P95 exceeds some threshold, the parallelism-ceiling has been hit (see §2.3).

**Preventive structural fix:** *scope discipline*. Each worktree carries a declared scope (file-path-glob or subsystem name) at spawn time. Two worktrees whose scopes intersect are disallowed. *This is the primary invariant* — the registry + probe enforce it.

### 2.2 Merge conflicts as a superset of live-lock (expected, not pathological)

Even without live-lock, parallel worktrees will produce ordinary merge conflicts. This is *not* a bug class in itself — it is the expected cost of parallelism. The hazard is when conflict-resolution *cost* exceeds parallelism-*benefit*.

**Rule of thumb (to be measured, not presumed):** if integration-cost > parallelism-gain, serialize. The threshold is empirical and will vary with build speed (§2.3), file-layout (files that everyone touches are anti-parallel), and round tempo.

**What the factory should instrument:**

- Time-from-worktree-spawn to worktree-merged.
- Number of conflict-files per merge.
- Re-work (subagent re-runs after conflict resolution) count.

These become observability signals for the parallel-worktree policy itself.

### 2.3 Build-speed ceiling — parallelism is rate-limited by the gate

Aaron: *"i bet depending on the build speed there is alimit to parallelism, the faster the build the more we can scale, i'm glad incremental builds and running only affected tests are on the backlog."*

**The invariant:** parallel worktrees can only be productively integrated as fast as CI validates their merges. If CI is 15 minutes and worktrees spawn every 3 minutes, the integration queue grows unbounded.

**Existing BACKLOG coverage:**

- Incremental builds (backlog P1/P2) — reduces gate time.
- Affected-tests-only (backlog) — reduces gate time.
- CI cache warming — reduces gate time.

**New coverage this research surfaces:**

- **Measure before flipping.** Before `EnterWorktree` becomes factory-default, collect baseline: median/P95 gate time on main, median/P95 gate time on worktree PRs (they share the same gate). The parallelism ceiling N ≈ gate-time-budget / spawn-rate. If N < 2, parallel worktrees are not yet net-positive.
- **Backpressure.** When the integration queue exceeds N, refuse new worktree spawns (or queue them) rather than fan out further.

### 2.4 Stale-branch accumulation (Aaron's preventive+compensating ask)

Aaron: *"part of the git surface for you is cleaning up stale branches on our repo on a cadence, you could also add preventive measures to stop them from showiing up i the first please, i can you can make the PR close them automaticlly for instance but still need he compesating action in case it regreses."*

This is a direct application of the `feedback_discovered_class_outlives_fix_anti_regression_detector_pair.md` principle: **preventive fix + compensating detector, both permanent**.

**Preventive:**

- **Auto-delete branch on PR merge.** GitHub setting: *Automatically delete head branches* (Settings → General → Pull Requests). One-time toggle; subsequent PR merges auto-delete their branch.
- **Auto-delete branch on PR close (unmerged).** Same setting covers this since PR close and merge both fire the hook.
- **Worktree-close = branch-done convention.** In the factory, a worktree that exits via `ExitWorktree action: "remove"` implies the branch is abandoned; the tool deletes it. If exited via `keep`, the branch is preserved intentionally.

**Compensating (the detector):**

- **Cadenced `git branch --merged main` audit.** New FACTORY-HYGIENE row (cadence: weekly or every-10-rounds): list every remote branch merged into main whose PR is closed/merged. Report to Aaron; auto-delete with a whitelist exception (for long-lived branches like `main`, release branches, opt-in preserved speculation branches).
- **Cadenced stale-branch audit.** Remote branches whose last commit is older than N days (starting N=30) and whose head is not a PR → stale. Report. One-click cleanup via a script under `tools/hygiene/prune-stale-branches.sh`.
- **Local-worktree stale audit.** Worktrees under `.claude/worktrees/` whose branch is merged or whose last commit is older than N days → candidate for `ExitWorktree action: "remove"` prompt at next tick-open.

The detector stays armed even after auto-delete is enabled — because:

- The GitHub setting can be toggled off.
- Branches can be created via `git push` paths that bypass PR flow.
- The `round-NN-speculative` branches from `feedback_live_loop_detector_speculative_on_pr_branch.md` don't go through PR flow and won't be auto-deleted.

### 2.5 Memory-in-worktree semantics (Aaron's question)

**Aaron:** *"oh now how do memory and stuff work when i'm chatting while you are on a worktree?"*

**Empirical answer (verified this tick):**

Claude Code's auto-memory lives at `~/.claude/projects/<slug>/memory/` where `<slug>` is the session's initial CWD with `/` replaced by `-`. Example: `~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/`.

- **Single session that uses `EnterWorktree`:** the slug is set when the session starts, based on the initial CWD (the main repo root). `EnterWorktree` changes the session's CWD but does NOT re-keyed the slug. Memory continues to load/write from the original slug. Tool calls using absolute paths (which all of mine do) work identically across the boundary. **Verified**: this tick's session started in `/Users/acehack/Documents/src/repos/Zeta`, entered a worktree at `.claude/worktrees/pr32-markdownlint`, wrote three memory files from within the worktree, and `ls ~/.claude/projects/` shows only the main-repo slug — no worktree-specific slug was created.

- **Fresh `claude` session started from inside a worktree directory:** the slug would be computed from the worktree path (`-Users-acehack-Documents-src-repos-Zeta--claude-worktrees-pr32-markdownlint` or similar). That session would load an *empty* memory dir — bifurcation. This is the risk.

**Policy for the factory:**

- **Always start Claude Code from the main repo root.** Use `EnterWorktree` for worktree work. Do not `cd <worktree> && claude` — that bifurcates memory.
- Document this rule in `docs/AUTONOMOUS-LOOP.md` under "session-start checklist" (if that section exists; otherwise add one).
- Detector: a CLAUDE.md-level hygiene note or startup script that refuses to launch if `$PWD` is under `.claude/worktrees/`.

**Implication for parallel sessions:** if we ever run multiple Claude Code sessions concurrently (two humans, or a human + an autonomous loop tick), each must start from the main root; they will share the same memory and may write-conflict on `MEMORY.md`. That is a separate future concern (file-locking on `MEMORY.md`) — flag for later.

### 2.6 Tick-clock interaction with worktree

If a `<<autonomous-loop>>` tick fires while the previous tick is mid-`EnterWorktree`, where does the new tick land?

**Speculation (needs empirical test):** the cron fires into the same session; the session is already inside the worktree; the new tick inherits the worktree CWD. Or: the tick is dispatched as a fresh harness instance; it gets the repo root.

**Action:** next tick that enters a worktree, observe which state the tick-after-that wakes in. Record in `docs/research/parallel-worktree-safety-2026-04-22.md` follow-up section.

**Mitigation regardless of behavior:** the autonomous-loop tick's END-OF-TICK ordering (history-append → `CronList` → visibility signal) happens in whichever CWD the tick is in. If that CWD is the worktree, the history append goes to the worktree's copy of the file, not the main repo's. That is a worktree-split-history hazard — flag for §2.7.

### 2.7 Worktree-split state files — hygiene-history, memory, research docs

A worktree is a separate working directory. Files that are auto-appended-to every tick (e.g. `docs/hygiene-history/loop-tick-history.md`) will diverge between the worktree and main if the tick runs in the worktree.

**Example of the hazard (this tick almost hit it):** I entered `pr32-markdownlint` worktree on `round-42-speculative`. If I had written to `docs/hygiene-history/loop-tick-history.md` *from within the worktree* instead of *from the main repo*, the entry would have landed on the wrong branch and wrong working-tree copy. Then at tick close, the main repo wouldn't reflect the tick.

**Class-detector:** tick-history appends must happen in the main repo, not inside a worktree. Enforcement options:

1. CLAUDE.md rule: "append tick-history *after* `ExitWorktree`, never before."
2. Pre-commit hook: if a commit modifies `docs/hygiene-history/loop-tick-history.md` AND the branch is not `main`/`round-NN-speculative`, refuse.
3. A helper function `append-tick-history.sh` that `cd`s to main root before writing.

### 2.8 Unknown unknowns — enumerating classes we haven't seen instances of

Per Aaron's *"plus the unknow unknowns lol cartographer"* — the cartographer doesn't claim a complete map; they annotate the edges.

**Known unknowns (at least in the map):**

- Concurrency on `MEMORY.md` across parallel sessions (§2.5).
- Sub-agent-inside-worktree-spawning-another-subagent-inside-same-worktree semantics.
- `skill-creator` workflow interaction with worktrees (skills live under `.claude/skills/**`; does a worktree have its own `.claude/skills/` directory? Quick check: git worktrees share `.git/` but have their own working tree, so `.claude/skills/` is per-worktree).
- Plugin / slash-command resolution in a worktree (probably same as main; plugins come from `.claude/plugins/`).
- Cron re-arm inside a worktree vs inside main (§2.6).
- What happens if `EnterWorktree` is called *while already in a worktree* — nested worktrees?

**Edges that are genuinely un-charted:**

- Parallel Claude Code *operator* sessions (two humans typing into two Claude Code windows against the same repo). We have no experience here.
- GPU-intensive tools run in parallel worktrees (rare for Zeta; flag).
- OS-level file-locking (macOS HFS+ / APFS vs Linux ext4 semantics on shared `.git/`).

The map marks these as dragons (*Hic sunt dracones*) — not explored this pass.

## 3. Preventive + compensating pairings (discovered-class principle, applied)

Per `memory/feedback_discovered_class_outlives_fix_anti_regression_detector_pair.md`, every fix-of-a-class ships paired with a class-detector that stays armed after the fix. Applying to each §2 hazard:

| Hazard | Preventive (structural) | Compensating (detector, permanent) |
|---|---|---|
| Live-lock (§2.1) | Scope-overlap registry + refusal | Merge-front throughput monitor; N-round stale-worktree audit |
| Merge conflicts (§2.2) | Scope discipline (same as §2.1) | Conflict-rate instrumentation; rework count |
| Build-speed ceiling (§2.3) | Backpressure on spawn-rate | Gate-time monitoring + ceiling-breach alert |
| Stale branches (§2.4) | GitHub auto-delete on PR close/merge; `remove`-action on worktree close | Cadenced `git branch --merged main` audit; stale-age-days audit |
| Memory bifurcation (§2.5) | Always-start-from-main-root rule | Startup check refusing `$PWD` under `.claude/worktrees/` |
| Tick CWD inheritance (§2.6) | End-of-tick `pwd` check before history-append | Pre-commit hook refusing tick-history on non-main branches |
| Split state files (§2.7) | Helper that `cd`s to main root for append-only files | Same pre-commit hook as §2.6 |
| Unknown unknowns (§2.8) | — (can't prevent the unknown) | Quarterly re-map cadence of this document; every-instance-absorbed entry in §2.8 |

## 4. Recommendation — what this research proposes

**Not ready to flip `EnterWorktree` to factory-default.** The scope-overlap registry (§2.1) and the CWD-safety rules (§2.5–2.7) must land first. Proposed staging:

1. **Round 45 (next):** land the GitHub auto-delete-branch setting (§2.4 preventive). Easy, reversible, high-value. Also land the cadenced stale-branch audit under `docs/FACTORY-HYGIENE.md` as a new row (§2.4 compensating).
2. **Round 46:** design the scope-overlap registry. Single-file append-only format, human-readable, `tools/hygiene/worktree-scope-registry.md` or similar. Initially manual; automate detection after two rounds of usage.
3. **Round 47:** ship the startup check + CLAUDE.md addition for "always start from main repo root" (§2.5).
4. **Round 48:** tick-history + split-state-file hygiene (§2.6–2.7).
5. **Round 49 — earliest possible `EnterWorktree`-default flip**, conditional on 1–4 landing clean AND the gate-time baseline being collected. Aaron's sign-off required.

Each of 1–4 ships with its paired detector (third column of §3 table). None of the fixes retire the detector.

## 5. What this research is NOT

- **Not** a gate on the specific `pr32-markdownlint-fix` worktree that closed this tick. That worktree was exercised once, cleanly, and produced `e40b68a` which is ready for Aaron's review. It is *evidence* that the happy-path works; it is not a mandate that it always works.
- **Not** a policy that bans `EnterWorktree` for the next four rounds — individual, deliberate, scope-declared worktree uses are fine. The ban is on *factory-default-always-parallel*.
- **Not** a claim of completeness. §2.8 explicitly marks this pass as first-pass cartography. Subsequent rounds will find dragons where the map currently says *Terra Incognita*.

## 6. Cartographer's note to the next wake

If a future wake reads this doc and disagrees with any hazard classification, §2 ranking, or §4 staging:

- Revise via the *future-self-not-bound* rule (`memory/feedback_future_self_not_bound_by_past_decisions.md`) — leave a dated revision line at the bottom of §2 or §4 explaining the reframe.
- Update the paired detector table in §3 if the fix changes; do not retire a detector silently.
- If a hazard has been downgraded because an instance got fixed, the detector still stays (per the discovered-class-outlives-fix rule).

## 7. Related docs & memories

- `memory/feedback_discovered_class_outlives_fix_anti_regression_detector_pair.md` — the principle this research instantiates across 8 hazards.
- `memory/feedback_live_loop_detector_speculative_on_pr_branch.md` — the live-loop class that motivated the worktree pattern in the first place.
- `docs/research/worktree-pattern-for-live-loop-prevention-2026-04-22.md` — the prior research doc that introduced `EnterWorktree` to the factory; this doc extends it from single-worktree to parallel-worktree safety.
- `memory/feedback_kanban_factory_metaphor_blade_crystallize_materia_pipeline.md` — cartographer metaphor source.
- `memory/feedback_never_idle_speculative_work_over_waiting.md` — the rule that drives tick-cadence; parallelism must not violate it via backpressure-starvation.
- `memory/feedback_fix_factory_when_blocked_post_hoc_notify.md` — additive-not-destructive; every mitigation proposed here is additive.
- `docs/AUTONOMOUS-LOOP.md` — will need a "session-start from main root" addition.
- `docs/BACKLOG.md` — the rows this doc feeds (parallel-worktree safety, stale-branch cleanup).

## 8. Status of the other open PR (Aaron's merge warning)

Aaron: *"i think you are going to have to merge on one of those PRs"* — referring to PR #32 and PR #31 (the two open PRs at the time of his message).

**PR #32:** `lint (markdownlint)` check now has a ready fix on `pr32-markdownlint-fix` worktree (commit `e40b68a`). Not pushed. Aaron's review + merge-or-instruction-to-push pending.

**PR #31:** not audited this tick (scope discipline — cartographer is mapping, not walking). Known: it exists; state unknown.

## 9. Post-land incident log — PR #31 merge-tangle (2026-04-22 autonomous-loop)

Aaron 2026-04-22 follow-up, after the factory merged #32/#33/#34/#35 and an autonomous-loop tick attempted to rebase #31: *"well you got yourself in a pickly good info for your parallels run research that's how we got here and why i said lets research it lol"* + *"i guess that;s what you tried to fix and found the missing stuff"*. The tangle is exactly the shape this research predicted. Logging the concrete data while the evidence is fresh.

**Observed state.** PR #31 branch `round-41` was opened 2026-04-20. By the time this tick attempted the rebase (2026-04-22, two days later), `main` had absorbed PR #32 (114 squashed commits), #33, #34, and #35. The branch was 33 commits ahead of main; main was 200+ commits ahead of the branch's merge-base. `git merge origin/main` produced a five-file conflict:

| File | Hazard class | Why this file collides |
|---|---|---|
| `docs/BACKLOG.md` | universal queue | every tick edits it; long-lived branch guarantees overlap |
| `memory/persona/aarav/NOTEBOOK.md` | per-persona notebook | both branches append-only updates to the same persona |
| `memory/persona/best-practices-scratch.md` | shared promotion-candidate buffer | same append-only collision, all personas share it |
| `openspec/specs/operator-algebra/spec.md` | load-bearing primary spec | every capability that touches the operator algebra edits it |
| `docs/research/grandfather-claims-inventory-2026-04-21.md` | date-stamped research doc | add/add: both branches created the same filename independently |

**Aaron's second insight — attempted-merge as divergence-inventory.** *"i guess that;s what you tried to fix and found the missing stuff"*. The act of attempting the rebase surfaced, file-by-file, what the open PR has that main lacks. A failed-merge conflict list IS a divergence inventory; declining to treat it as "just noise" and instead reading it as "these are the edit-surfaces we've been dual-writing" turns a blocker into a factory observability signal. Candidate factory practice: **whenever a long-lived PR tangles on merge, log the conflict file list as a shared-surface fingerprint** — the recurring files across multiple tangled PRs are exactly the surfaces most urgent to restructure.

**Reframing of §2.7.** §2.7 originally named "worktree-split state files" as the hazard. The PR #31 merge-tangle shows the class is broader: **any shared-write high-churn surface, edited on two branches that outlive each other's merge window, produces the same conflict pattern — worktrees are only one instance of the divergence generator**. Long-lived PR branches are another. Parallel subagents would be a third. The common cause is *shared-surface + time-divergence*, not worktrees specifically.

**Ranked-by-collision shared surfaces (for mitigation design):**

1. **`docs/BACKLOG.md`** — universal; hit by every tick. P0 candidate for append-only-section-per-tick layout, or per-row-file restructure where each backlog row lives as its own file and the BACKLOG.md becomes an index. A per-row-file layout would collapse this to near-zero conflicts.
2. **`memory/persona/*/NOTEBOOK.md`** — per-persona but not per-tick. P1 candidate for per-tick-file append (already partially done in some personas via dated sections).
3. **`memory/persona/best-practices-scratch.md`** — shared across all personas. P1 candidate for per-finding-file restructure (each candidate BP gets its own file; scratch.md becomes an index).
4. **`openspec/specs/*/spec.md`** — load-bearing; rare edits but high-value. Lower priority; OpenSpec's per-capability structure already partitions somewhat.
5. **Date-stamped research docs** — add/add collisions when two branches both create `docs/research/<same-topic>-<same-date>.md` independently. Preventive: require research-doc filenames to include branch/author discriminator, OR treat add/add resolution as a deliberate research-merge.

**Lesson for the "always-parallel" factory-default staging.** R45-R49 staging in §4 assumes the *preventive-paired-with-compensating* discipline survives scale. This incident shows the compensating side (merge-conflict resolution) has real cost even today without worktrees. Scaling parallelism without first shrinking shared-write surfaces will amplify the tangle, not absorb it. **Revised staging recommendation:** before R45's reducer-agent EnterWorktree flip, land at least the P0 BACKLOG restructure (item 1 above); otherwise every parallel reducer-agent tick is one more branch accumulating conflict against BACKLOG.md.

**PR #31 disposition.** This tick did not force-merge PR #31 — the agent-merges-own-PRs directive is scoped to green / no-unresolved-findings state, and #31 has 8 Copilot findings + 5 conflicts + unclear subsumption by #32's scope. The harness permission layer correctly refused the merge flow mid-resolution, flagging it as a shared-repo-state modification requiring precise authorization for this specific PR. Disposition is an Aaron-scoped decision (flagged in the PR's own classification comment: *"does #31 merge as a smaller slice, or close in favour of #32?"*). The stash-and-revisit pattern from §2.4 (stale-branch cleanup preventive+compensating) applies.

The live-lock-between-PRs risk Aaron flagged is *not* structural between PR #31 and PR #32 specifically — it's the general class. If PR #31 and PR #32 both touch `docs/BACKLOG.md` (likely, given BACKLOG.md is the busiest file in the repo), merging PR #32 first means PR #31 needs a rebase; rebasing after PR #32's markdownlint-fix touches BACKLOG.md may or may not conflict. **Action deferred to Aaron** — pushing or merging either PR without his sign-off during map-before-walk is wrong.
