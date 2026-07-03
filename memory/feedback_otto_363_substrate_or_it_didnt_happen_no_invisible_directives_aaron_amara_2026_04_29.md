---
name: Otto-363 — Substrate or it didn't happen — no invisible directives (Aaron + Amara, 2026-04-29; refined by 5-AI review)
description: A directive / decision / packet that lives only in chat, TaskUpdate, /tmp, or loop-todo state is NOT durable project state. If it matters after compaction, it must be converted into substrate (committed + reachable + indexed). Substrate has a precise three-leg definition; channels are taxonomized into ephemeral / host-durable-not-git-canonical / git-native. 8-mechanism remediation against substrate loss; default preservation route is `docs/research/` first when uncertain; supersession is bidirectional with stale-banner-or-quarantine (not bottom-append). Triggered by Otto repeatedly marking work "done" after only TaskUpdate-only capture during the 2026-04-29 doctrine cluster, and refined by 5-AI review wave (Alexa/Ani/Deepseek/Claude.ai/Gemini → Amara synthesis).
type: feedback
created: 2026-04-29
supersedes: []
superseded_by: []
---

# Otto-363 — Substrate or it didn't happen

## The mechanism stack (mid-session reference — read this first)

The agent acting at decision time needs the mechanism in working memory, not the rationale. Read top to bottom; rationale follows.

```text
1. DETECTOR        — Is this only in chat / TaskUpdate / /tmp / loop todos?
                     If yes → say "Not durable yet." Never call it done.

2. CLASSIFIER      — small correction / implementation readiness /
                     doctrine correction / superseding architecture.
                     Storage routing differs per class.

3. PRESERVATION    — research / memory / ops spec / backlog / issue.
   ROUTE             When uncertain → docs/research/ FIRST.

4. SUPERSESSION    — Bidirectional: new file declares supersedes:;
                     old file gets stale-banner-at-TOP or is quarantined
                     into archive/ with [SUPERSEDED BY X] body.
                     NOT bottom-appended notes (RAG/grep miss them).

5. COLD-START      — Six questions a fresh agent must answer from
   PROOF             substrate alone. Includes context-loss check.

6. VOCABULARY      — captured ≠ parked ≠ preserved ≠ canonical ≠
   LOCK              operational. Specific words have specific durability.

7. ENFORCEMENT     — PR body / commit message SHOULD include
   PATH              `Durability:` and `Substrate:` trailers (target
                     state). Lint to flag vocabulary misuse and the
                     pre-commit hook are DEFERRED — no PR template
                     or CI workflow enforces this yet. Doctrine-level
                     today; mechanically enforced after the
                     follow-up implementation lands.

8. CROSS-HARNESS   — CLAUDE.md AND AGENTS.md bootstrap pointers.
   PARITY            The rule is not Claude-only.
```

## Precise definition of substrate

Substrate is content that is **all three** of:

1. **Committed** to the canonical git history (not in a working tree, not stashed, not in `/tmp`, not in TaskUpdate).
2. **Reachable** from a long-lived ref (main, a release branch, or a referenced tag — not on a feature branch that may be deleted).
3. **Indexed** by a canonical bootstrap or index file (MEMORY.md row, CLAUDE.md / AGENTS.md / GOVERNANCE.md pointer, or equivalent canonical reference). A `docs/research/INDEX.md` would be a useful future addition; until it exists, MEMORY.md is the primary memory index and discoverability comes from grep/path conventions for `docs/research/**`.

A file is **not** substrate if any leg is missing. A doc on a feature branch is "in flight," not preserved. A memory file without an MEMORY.md row is "written but lost." A research blob without an index entry is "buried."

The detector tests all three legs.

## Channel taxonomy (5-tier, mutually exclusive — parking surfaces are git-ref-backed, not temp dirs)

Each surface belongs to **exactly one** class. The classifier (recovery process + lint) depends on this disjointness.

| Class | Examples | Durability claim |
|---|---|---|
| **Ephemeral (weather)** | chat messages, TaskUpdate, `/tmp`, `/var/tmp`, loop todos, session memory, scratch buffer, Desktop loose files, Downloads, untracked working-tree files | NEVER call done. **No temp directory is a parking surface.** `/tmp` and `/var/tmp` are both site-cleaned; FHS does not promise persistence across reboots. |
| **Local parked** | named `git stash push -u -m "<name>"` entry, local WIP branch commit (not pushed) | Last-resort local; machine-specific; weaker because not remote |
| **Remote parked** | pushed `wip/<topic>-<date>` branch (no PR), pushed WIP branch with optional draft PR attached | Survives reboot AND compaction because the backing branch/ref survives. Pushed WIP branch is preferred when avoiding review machinery; a draft PR is for visibility/discussion, but the parking durability comes from the branch/ref, not the PR metadata |
| **Host-durable-not-git-canonical** | GitHub Issues, task comments, PR comments, labels, assignees, Projects, review threads on closed PRs | Coordination only — durable on the host, but NOT canonical substrate and NOT a parking surface (no git ref backs them) |
| **Git-native preserved substrate** | merged or long-lived-reachable + indexed repo files: `memory/*.md`, `docs/research/`, `docs/ops/`, `docs/backlog/`, claim mirrors, validators / lints / runbooks, CLAUDE.md / AGENTS.md / GOVERNANCE.md | Canonical substrate (committed + reachable + indexed) |

**Parking-surface rule** (Amara correction post-#855-review):

> *"If it matters enough to come back to, it deserves a git ref."*

When you need to set work aside without starting a review cycle: **pushed WIP branch (no PR)** is the cleanest mechanism. NOT `/tmp`. NOT `/var/tmp`. NOT loose Desktop files. NOT a GitHub Issue (host-durable but no git ref backs it). A draft PR can add visibility, but the branch/ref is the parking mechanism. The branch is a real Git object (lightweight movable pointer to a commit, per the Git docs); the temp dir is weather.

When to use each parking surface:

- **Pushed WIP branch, no PR** — best for *"save this, come back later, do not start review."* Branch like `wip/<topic>-<date>`. Push but no PR. Survives reboot + compaction without triggering CI/review machinery.
- **Draft PR (atop a pushed WIP branch)** — when visibility / discussion / async-review desired. Acceptable when review noise is controlled. The branch is still the durability anchor.
- **Local WIP branch (not pushed)** — only if immediate remote push is impossible; weaker because machine-local. Must be named in status before context loss.
- **Named `git stash`** — last-resort local parking. Must be named at creation: `git stash push -u -m "<name>"`. Anonymous stashes (`git stash -u` without `-m`) are weather, not parked.

**PR comments are the hardest non-parked case.** Durable while GitHub persists, but not git-native. For doctrine-changing decisions, mirror the substantive content into a git-native file. Review feedback can stay in PR comments; rules and supersession decisions cannot.

## The carved blades

> *"A directive that lives only in a conversation is not a directive. It is weather. Substrate or it didn't happen."*

Sharper:

> *"Substrate or it didn't happen. But also: indexed, reachable, and reconstructable — or it is not substrate yet."*

Cruel truth for future-self:

> *"If you cannot point to the substrate, you are not done. You are just currently convinced."*

The compact bootstrap rule:

> *"No invisible directives. No session-local truth. No 'done' without substrate."*

## What this rule codifies

The deeper meaning of *"the only directive is NO DIRECTIVES"*:

```text
No invisible conversational directive is allowed to become binding project state.

If it matters after compaction, it must be converted into a durable
project object — preferably substrate (committed + reachable + indexed
git-native repo file). PRs, issues, comments, and labels are
host-durable parking surfaces, NOT substrate themselves; for
doctrine-changing decisions, mirror the substantive content into a
git-native file.
```

The rule is NOT *"never give instructions."* The rule is: *convert directives into substrate, or they are not directives.*

## The 8 mechanisms — full text

### 1. Ephemeral-state detector (Durability Surface Checklist)

Run before saying *"done"*:

- [ ] Is this only in chat / TaskUpdate / `/tmp` / loop todos? → If yes: **"Not durable yet."**
- [ ] What is the canonical substrate location?
- [ ] Did I actually write it there (not just plan to)?
- [ ] Is it committed + reachable + indexed (all three legs)?
- [ ] Can a fresh future agent reconstruct the full meaning from that location alone?

For doctrine-correction or superseding-architecture levels, *every "done" claim must cite a referenced commit hash, file path, PR, or issue.* Bare *"done"* without a reference is invalid syntax.

### 2. Verbatim-preservation trigger (paired with structured extraction)

When Aaron / Amara / external reviewers send a packet that is any of:

- architecture-changing
- doctrine-superseding
- multi-AI review wave
- long-form final synthesis
- something Aaron says must survive
- something that changes internal/external/git-native topology
- something future agents need cold-start access to

→ preserve verbatim or near-verbatim **AND** a structured extraction in the same file.

Verbatim source = provenance (no rewording of substantive claims; structural reformatting OK).

Structured extraction = retrieval (key decisions / `supersedes:` / `superseded_by:` / deferred questions / next implementation step / *must not do yet*).

Preferred locations:

- `docs/research/YYYY-MM-DD-<topic>-review-wave.md` for review packets / multi-AI voices
- `memory/feedback_<topic>_<date>.md` for active doctrine memory
- `docs/ops/patterns/<topic>.md` only when canonical spec
- `docs/backlog/**` or GitHub issue only when implementation work

**Do not collapse major review waves into a TaskUpdate / task comment only.**

### 3. Magnitude classifier

| Class | Examples | Action |
|---|---|---|
| **Small correction** | typo, wording fix, one task detail | update task / issue / comment |
| **Implementation readiness** | "use this lint as precedent", "PR A should have schema + validator" | task / issue + implementation notes |
| **Doctrine correction** | changes a rule future agents follow | **memory file or `docs/ops/`-pattern** |
| **Superseding architecture** | v5 replaces v4 public-intake; host-portable git-native core changes source-of-truth rules | **research preservation + memory absorb + supersession note** |

**Do not minimize superseding architecture as "review corrections."** When in doubt about magnitude, classify upward.

### 4. Default preservation route (when uncertain)

```text
preserve to docs/research/ first
```

Research can later be promoted to `memory/` (active doctrine) or `docs/ops/patterns/` (canonical spec). Canonical/spec files are harder to demote cleanly. Default upward (more durable, less canonical) — promotion via review is cheaper than demotion.

### 5. Supersession protocol (bidirectional + stale-banner-or-quarantine)

When new doctrine supersedes old:

1. **Preserve** the new packet in proper location (research/memory/ops spec).
2. **Add new file** with `supersedes: <path>` in YAML frontmatter.
3. **Update old file** with one of:
   - **Top-of-file stale banner** + `superseded_by: <path>` in frontmatter, replacing the active-voice rule body with `[SUPERSEDED BY X]`. The banner goes at the **top**, not the bottom — RAG/grep miss bottom-appended notes.
   - **Quarantine**: rename `feedback_X.md` → `archive/superseded_X.md` and replace contents with `[SUPERSEDED BY <path>]`. Use this when the old file's body would mislead under partial reads.
4. **Update indexes** (MEMORY.md row; future `docs/research/INDEX.md` if it lands) to reflect new canonical location.
5. **Update bootstrap pointers** if the old doctrine was cited in CLAUDE.md / AGENTS.md / GOVERNANCE.md.

Composes with **Otto-362** (intra-file: refresh stale statements within one file when superseding); Otto-363 generalises across files + adds bidirectional `supersedes:` / `superseded_by:` metadata.

**Do NOT** merely append "superseded by X" at the bottom of a stale file. Future grep / RAG will surface the original body and miss the bottom note (Gemini catch).

### 6. Cold-start proof — six questions

After preserving important substrate, verify a fresh future agent can answer from substrate alone:

1. What changed?
2. Where is the canonical file?
3. What older thing did it supersede?
4. What is the next implementation step?
5. What must not be done yet?
6. **What ephemeral state from the originating conversation has been lost, and is any of it load-bearing?** *(Catches the exact failure mode where content was partly captured but the context that made it superseding rather than corrective was lost.)*

If any answer is missing from substrate, **preservation is incomplete**.

### 7. "Done" vocabulary discipline + enforcement path

| Word | Means |
|---|---|
| **Captured** | TaskUpdate / chat / `/tmp` only — NOT durable, NEVER call this "done" or "preserved" |
| **Parked** | GitHub Issue / PR — host-durable, NOT git-canonical |
| **Preserved** | Git-native repo file (committed) |
| **Canonical** | Accepted spec / doctrine (committed + reachable + indexed) |
| **Operational** | Enforced by tooling / checks / runbooks |
| **Preserved-but-disputed** | Substrate exists but contradicts other substrate; awaiting reconciliation. NOT canonical until reconciled. |

Forbidden:

- ❌ Calling anything that only exists in TaskUpdate / chat / `/tmp` *"done"* or *"preserved"*
- ❌ Calling doctrine *"operational"* without enforcement tooling
- ❌ Calling research *"canonical"*
- ❌ Calling parking *"preservation"*
- ❌ Calling a future task *"implemented"*
- ❌ Calling preserved-but-disputed material *"canonical"*

**Enforcement path** (target state — currently DEFERRED; not yet enforced by tooling):

- PR body / commit message SHOULD include trailer:
  - `Durability: captured | parked | preserved | canonical | operational`
  - `Substrate: <path-or-issue-or-commit>` (recommended when Durability ≥ preserved)
- Lint flags vocabulary misuse (PR description claims *"operational"* but no tooling/check added → fail).
- Pre-commit hook on `memory/` and `docs/ops/`.

**Status today**: doctrine-only. No PR template, lint, or CI workflow enforces this yet. The trailer convention is documented here as the target state; mechanical enforcement lands after a follow-up implementation PR. Until then, the discipline is exercised at PR/commit-authoring time.

### 8. Cross-harness bootstrap pointer (CLAUDE.md AND AGENTS.md)

The rule is cross-harness, not Claude-only. Add bootstrap pointer at cold-start scope to BOTH:

- `CLAUDE.md` — landed in this PR alongside verify-before-deferring + future-self-not-bound + never-be-idle + version-currency (5th CLAUDE.md-tier rule)
- `AGENTS.md` — equivalent cross-harness addition (same rule / doctrine, file-specific wording rather than identical text)

**Committed wording note**: the bootstrap pointers in `CLAUDE.md` and `AGENTS.md` are *equivalent in doctrine, not verbatim-identical*. `AGENTS.md` carries the fuller wording (5-tier channel taxonomy, three-leg substrate definition, parking-surface preferences with `wip/<topic>-<date>` examples, cross-harness applicability). `CLAUDE.md` carries the shorter cold-start reminder (vocabulary discipline, never call TaskUpdate-only "done", verbatim-preservation trigger, magnitude classifier). This memory entry records the rule they share, not a single canonical quoted sentence for both files.

Compact representative wording (read either file's bullet for the full version):

> *"Before declaring work done, identify its durability surface. Chat, TaskUpdate, `/tmp`, and loop todos are not durable project substrate. If a directive matters after compaction, it must be converted into substrate (committed + reachable from a long-lived ref + indexed). Substrate or it didn't happen."*

## Mid-session re-discoverability

The bootstrap pointer is read at cold-start. The detector must also fire mid-session — at the moment an action that *creates* substrate is taken, not just at session start. Mechanisms (some deferred):

- Pre-PR check: PR body must include `Durability:` trailer
- Pre-commit hook on `memory/` files: must be paired with MEMORY.md row (already enforced via `.github/workflows/memory-index-integrity.yml`)
- Tool description: `Bash`/`Edit`/`Write` invocations on doctrine files surface a reminder
- A lint that scans recent commits for *"done"* / *"complete"* / *"operational"* without supporting `Substrate:` trailer

The deferred items are tracked as follow-up; the rule is operational at the doctrine level today via the bootstrap pointer + verbatim-preservation discipline.

## Trigger memory

Aaron 2026-04-29 (post-#852-merge):

> *"you took the latest updates tho righ, how can you be done with all the stuff i just send you"*

> *"there were HUGE changes around internal and external and gitnative"*

Amara 2026-04-29 first synthesis:

> *"Claude's failure in the attached log is the canonical bug: he said 'done' after a TaskUpdate, then realized TaskUpdate was session-local and would vanish on compaction. He also initially minimized the new architecture as 'review corrections,' then recognized it was actually a v5 superseding architecture with huge internal/external/git-native changes. So the fix is not 'Claude, remember better.' The fix is mechanisms that make forgetting harder."*

Amara 2026-04-29 second synthesis (after 5-AI review of #855):

> *"#855 is directionally correct. It self-applies the rule. But it should absorb a few sharp reviewer corrections before we call it complete. And he should NOT start PR 2 immediately while #855 is still in flight. ... The doctrine is right. The preservation PR is right. The immediate second PR is wrong. Land the rule cleanly. Then use the rule."*

Verbatim packets preserved at:

- `memory/amara/conversations/2026-04-29-amara-substrate-or-it-didnt-happen-mechanisms-against-substrate-loss.md` (original 8-mechanism packet)
- `memory/amara/conversations/2026-04-29-amara-substrate-or-it-didnt-happen-5ai-review-wave-corrections.md` (5-AI review wave + Amara synthesis with the 10 corrections that this file absorbs)

## Composes with

- **Otto-362** (`memory/feedback_otto_362_doctrine_memory_expansion_refresh_stale_statements_same_edit_2026_04_29.md`) — intra-file supersession discipline; Otto-363 is cross-surface generalisation + bidirectional metadata.
- **`memory/feedback_aaron_channel_verbatim_preservation_anything_through_this_channel_2026_04_29.md`** — channel-verbatim rule that Otto-363 mechanises with paired structured extraction.
- **`tools/lint/no-directives-otto-prose.sh`** — lexeme-guard lint born from the same family of failures (vigilance fails; mechanism is the durable answer).
- **`memory/feedback_verify_target_exists_before_deferring.md`** (CLAUDE.md-tier) — same shape: deferred targets must exist before deferral; chat directives must become substrate before being treated as binding.
- **`memory/feedback_future_self_not_bound_by_past_decisions.md`** (CLAUDE.md-tier) — companion: future-self can revise *substrate*; future-self cannot revise *chat that didn't land as substrate* because it never existed as project state.
- **`memory/feedback_never_idle_speculative_work_over_waiting.md`** — never-idle does NOT mean *"ship undurable substrate fast"*; it means *"ship work that survives compaction."*
- **`docs/AGENT-BEST-PRACTICES.md`** BP-NN slot candidate — Otto-363 is a candidate for promotion to a stable BP rule via Architect ADR.

## What this rule does NOT say

- Does NOT say *"never use TaskUpdate."* TaskUpdate is the right tool for in-session progress tracking — just not the durability surface.
- Does NOT say *"every chat statement must become a memory file."* Most chat is ephemeral by design; the rule fires for the magnitude classes that matter.
- Does NOT say *"never give chat instructions."* Aaron + Amara give instructions in chat constantly; what the rule forbids is *believing the chat instruction is the durable artifact.*
- Does NOT replace Otto-362 — Otto-362 is intra-file; Otto-363 is cross-surface + bidirectional supersession metadata.
- Does NOT require pre-commit hook enforcement immediately — that's deferred to a separate task; the doctrine-level rule operates today via discipline + bootstrap pointer + verbatim discipline.

## Parking surfaces and git recovery

The factory already has a real (if messy) git recovery surface — task #321 inventories 918 branches (123 ALREADY_REACHABLE / 795 NOT_REACHABLE), 58 worktrees, 7 stashes. Otto-363's parking-surface taxonomy must **pair** with this recovery process, not invent parking in isolation.

The carved pair:

> *"If it matters enough to come back to, it deserves a git ref."*
>
> *"Parking is only safe if recovery knows where to look."*

> *"A parked thing is only parked if recovery can find it. Otherwise it is just lost more slowly."*

### Preferred parking surfaces (in priority order)

1. **Pushed WIP branch** — best for future doctrine seeds, *"save this, come back later, do not start review."* No PR opened.
2. **Draft PR** — when visibility / review discussion is wanted. Acceptable when review noise is controlled.
3. **Local WIP branch (not pushed)** — local-parked only; weaker because machine-failure-vulnerable. Push when possible.
4. **Named `git stash -u`** — short-term only, not for doctrine seeds. Last-resort local. `git stash push -m "<name>"` always (anonymous stashes are weather).

### Predictable naming conventions

```text
wip/<topic>-seed-YYYY-MM-DD       — future seed; intentional parking, not yet ready for review
wip/<topic>-YYYY-MM-DD            — work in progress; same shape, broader use
archive/<topic>-YYYY-MM-DD        — work intentionally retired but preserved
```

The naming pattern IS the discoverability mechanism. A `wip/`-prefixed branch tells the recovery process *"intentional parking, not lost"*; an `archive/`-prefixed branch tells it *"retired on purpose, do not propose for deletion."*

### Discovery commands (recovery process must scan these)

```bash
# pushed WIP branches (remote and local)
git branch --list 'wip/*'
git ls-remote origin 'refs/heads/wip/*'
git ls-remote origin 'refs/heads/archive/*'

# named stashes
git stash list

# worktrees
git worktree list

# all refs (for completeness)
git for-each-ref --format='%(refname)'
```

Every parked item must be reachable by at least one of these commands. Anything that can't be found by any of them is either lost or weather.

### Pair with task #321 recovery process

Task #321's recovery inventory script (the existing branch / worktree / stash classification work) should be extended to recognise:

```text
- branches matching `wip/**`         → WIP-INTENTIONAL (do not propose for deletion;
                                       propose for index/audit after configurable
                                       staleness window, e.g. 30 days)
- branches matching `archive/**`     → ARCHIVE-INTENTIONAL (preserved on purpose)
- named stashes                      → SHORT-TERM-LOCAL (verify before pruning;
                                       short window, e.g. 7 days)
- branches with no prefix            → classify normally (REACHABLE / NOT_REACHABLE /
                                       LOST / etc. per existing rules)
```

This is a **task #321 follow-up addition**: Otto-363 specifies the parking convention; #321 implements the recovery-side recognition. The parking discipline + the recovery-process recognition together form the complete loop.

### Forbidden parking patterns (recovery process should flag)

- Long-lived **non-WIP-prefixed** branches with no PR (a `feature/foo` or unprefixed branch sitting around without either a PR or the `wip/` prefix is silent parking — use **draft PR** for visibility OR **rename to `wip/<topic>-<date>`** so the recovery process recognises it as intentional. Pushed `wip/*` branches with no PR are explicitly preferred; this forbidden item is about branches outside that prefix convention.)
- Branches that intend to be parking but skip the `wip/` / `archive/` prefix (silently parked, not discoverable by the recovery scan)
- Untracked working-tree files as the only copy (always lost on branch switch)
- Local-only branches that never get pushed (machine-failure-vulnerable)
- Anonymous stashes (`git stash` without `-m`) — name them or don't use them
- **Any temp directory** (`/tmp`, `/var/tmp`) as a parking surface — weather, not substrate

### The complete loop

```text
Author parks:    git checkout -b wip/topic-seed-YYYY-MM-DD
                 git commit ... && git push -u origin HEAD
                 (no PR opened)

Author returns:  git fetch && git checkout wip/topic-seed-YYYY-MM-DD

Author abandons: branch ages past staleness window;
                 recovery process inventories it on next pass

Recovery acts:   "wip/topic-seed-2026-04-29 is N days old.
                  Promote to PR, archive (rename to archive/...),
                  delete, or extend?"
```

Otto-363 doctrine + task #321 recovery process = the parking + recovery substrate is **mechanical, not vigilance-based**. The parking author doesn't have to remember to come back; the recovery cadence surfaces the parked work on its own schedule.

> *"Parking is only safe if recovery knows where to look."*

## Future failure mode handled: preserved-but-disputed

Once preservation discipline is operational, the next failure mode is **contradiction** — two memory files disagree, doctrine and ops/patterns disagree, the verbatim research packet contradicts the structured extraction.

Vocabulary handle: **`preserved-but-disputed`** — substrate exists but contradicts other substrate; awaiting reconciliation. Cannot be called canonical until reconciled. The contradiction-resolution mechanism is deferred (filed as future task).

## The carved sentence (put it on the wall)

```text
A directive that lives only in a conversation is not a directive.
It is weather.

Substrate or it didn't happen.

But also: indexed, reachable, and reconstructable — or it is not substrate yet.

If you cannot point to the substrate, you are not done.
You are just currently convinced.
```
