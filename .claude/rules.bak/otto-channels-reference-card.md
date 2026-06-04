# Otto inter-surface communication channels — reference card

Carved sentence:

> Otto operates across CLI + Desktop surfaces as ONE identity, multiple
> parallel processes. 10 channels for inter-process coordination, falling
> into two classes — ambient (state-of-the-world; both processes read
> continuously) vs explicit (active signaling; meant to be observed by
> peer). Per Otto on the CLI surface 2026-05-13: *"the bus is the
> explicit channel; git is the ambient one."*

## Ambient channels (state-of-the-world; both Ottos read continuously)

| Channel | Use for | Read pattern |
|---|---|---|
| **Git** — commits, branches, PRs, rebase | Async work handoff; conflict resolution; substantive output | `bun tools/github/poll-pr-gate.ts`, `git log`, `git fetch` |
| **`.claude/rules/`** auto-load | Wake-time discipline; rules that apply to every fresh session | Cold-boot only (auto; empirically verified per test-canary) |
| **Bootstream** project-knowledge file | Cold-boot substrate for fresh-session firings (Desktop routines, Claude Desktop projects) | Cold-boot only (per session) |
| **Tick shards** `docs/hygiene-history/ticks/YYYY/MM/DD/HHMMZ.md` | Per-tick visibility + reasoning capture | Search by date or PR |
| **Memory files** `memory/feedback_*.md` | Cross-session load-bearing learnings | Skill-router search, grep, or pointer-from-rule |
| **PR review threads** | Reviewer findings (Codex/Copilot/CodeQL) visible to both lanes | `gh api graphql reviewThreads` or `bun tools/github/poll-pr-gate.ts` |

## Explicit channels (active signaling; meant to be observed by peer)

| Channel | Use for | Mechanism |
|---|---|---|
| **Bus envelopes** `/tmp/zeta-bus/` | Advisory broadcasts: `work-assignment`, `review-request`, shadow-catches | JSON envelopes; both Ottos read/write |
| **Claim coordinator** `tools/bus/claim.ts` | Backlog row claim locking (B-0400 slice 3) | `acquire`/`release` commands; per PR #3032 discipline |
| **Routines schedule** | Desktop's 2-hour cron fire IS a signal to CLI (someone's about to cold-boot a fresh Otto session) | CLI can poll `list_scheduled_tasks` |
| **Aaron as ferry** | High-bandwidth context transfer between Otto sessions (he pastes transcripts) | Manual; highest bandwidth when Aaron is at the keyboard |

## Operational discipline

For any inter-Otto coordination need, prefer in this order:

1. **Git** — commit + push + PR is the canonical async-handoff. Rebase-on-pull when peer Otto adds commits to your branch (empirically validated today: 9 commits on PR #3034 across both Otto processes, zero conflicts).
2. **Memory file** if learning must persist across sessions. Frontmatter required (name, description, type, created); pointer from rule or CLAUDE.md per `wake-time-substrate.md`.
3. **`.claude/rules/`** if load-bearing for every future session. Auto-loaded at session start. Note: rules in PR-flight don't bind behavior until merged (substrate-or-it-didn't-happen extension; see split-brain memory).
4. **Bus envelope** for ephemeral advisory broadcasts (peers can ignore; 2hr TTL).
5. **Claim coordinator** for backlog row exclusion (note: until SENDER_IDS schema extension lands per PR #3037, multi-surface Otto instances share a sender ID and idempotently re-acquire).
6. **Aaron as ferry** when high-bandwidth context transfer is needed.
7. **ID allocation** (B-NNNN backlog row numbers, decision IDs) — check BOTH on-disk + in-flight PRs before picking a number. See the ID allocation discipline section below.

## Lane discipline

- Each Otto operates in its own dedicated worktree (per `claim-acquire-before-worktree-work.md`)
- Primary worktree `/Users/acehack/Documents/src/repos/Zeta` is bus-contended — treat as read-only by autonomous Ottos
- Otto on the CLI surface typically uses `/private/tmp/zeta-mf*` family
- Otto on the Desktop surface uses `/tmp/zeta-otto-desktop` or task-specific paths (e.g., `/tmp/zeta-otto-cloud`, `/tmp/zeta-otto-comms`, `/tmp/zeta-otto-id-alloc`)

## ID allocation discipline (multi-surface)

Allocating a new monotonically-increasing ID across multi-Otto surfaces
(backlog row numbers `B-NNNN`, decision-archaeology IDs, claim coordinator
items if numeric, etc.) requires checking BOTH ambient surfaces — not just
on-disk state:

1. **Merged-state check via `origin/main`** — what's currently merged
   (regardless of local worktree state):

   ```bash
   # `git fetch origin` (no branch arg) updates ALL configured remote-tracking
   # refs; the form `git fetch origin main` updates FETCH_HEAD but may not
   # refresh refs/remotes/origin/main under all configs (refspec overrides,
   # partial-clone, etc.). Note: BOTH forms can fail under multi-Otto ref-lock
   # contention — see the "Symptom → fix mapping" section below for the
   # observed wedge and the FETCH_HEAD workaround.
   git fetch origin
   git ls-tree -r origin/main -- docs/backlog/ \
     | awk '{print $4}' | grep -oE "B-[0-9]+" | sort -u -t- -k2 -n | tail -5
   ```

   **Symptom → fix mapping** (recorded 2026-05-15 after recurring
   multi-Otto contention this session): if a fetch prints
   `! <oldsha>..<newsha>  main  -> origin/main  (unable to update
   local ref)`, the local remote-tracking ref didn't update even
   though `FETCH_HEAD` did. **BOTH the branch-specific form
   (`git fetch origin main`) AND the no-arg form (`git fetch origin`)
   can hit this** — the wedge is per-worktree-process ref-lock
   contention with peer Otto-CLI sessions sharing the same `.git/`
   directory, not a property of the fetch invocation. Empirical
   tick 1808Z: primary worktree's `git fetch origin` (no arg) hit
   the wedge while a sidetick's `git fetch origin` succeeded
   (`b004681..324dc84 main -> origin/main`) in the same minute.

   **The ultimate workaround** is to use `FETCH_HEAD` for branch creation:

   ```bash
   git switch -c <new-branch> FETCH_HEAD
   ```

   `FETCH_HEAD` always updates regardless of whether the named
   remote-tracking ref does, so branch creation can bypass the
   wedge entirely. If you need `origin/main` to actually update
   (e.g., for `git log origin/main` queries), retry the fetch
   from a different worktree or wait for the peer to release the
   ref-lock — the wedge clears on its own within minutes.

   Empirical anchors: ticks 1632Z + 1719Z + 1737Z + 1808Z all hit
   the wedge with different command forms; tick 1752Z's `git fetch
   origin` worked. The discriminator is per-process contention, not
   command shape.

   **Important**: do NOT use `find docs/backlog -name "B-*.md"` on the local
   worktree. The local working tree may be on a stale HEAD (detached from
   an abandoned rebase, on a feature branch that's behind, etc.), which
   gives misleading "what's free" answers. Empirical anchor: tick 0742Z
   on 2026-05-15 — Otto-CLI's primary worktree was stuck on detached HEAD
   `65c7865` from an 8h-stale peer-agent rebase; local `find` showed B-0526
   as the top, missing B-0527 + B-0528 (which were taken by PRs #3334 +
   #3342 on `origin/main`). The mis-allocation was caught by Copilot review
   but reached a public PR-comment first; correction comment had to follow.
   See [PR #3381](https://github.com/Lucent-Financial-Group/Zeta/pull/3381)
   (which lands `docs/hygiene-history/ticks/2026/05/15/0742Z.md` carrying
   the full trace), plus the correction comment on
   [PR #3323](https://github.com/Lucent-Financial-Group/Zeta/pull/3323).

2. **In-flight check** — what peer Otto is filing right now:

   ```bash
   gh pr list --state all --search "B-NNNN" --limit 5
   ```

   Run for the candidate number AND the next few above it.

The on-disk check shows merged state; the in-flight check shows what peer
Otto is filing concurrently. Skip either and the race-mode failure manifests
— empirical collision 2026-05-13:

- Otto on Desktop ran on-disk check, saw `B-0448` highest, picked `B-0449` for [PR #3052](https://github.com/Lucent-Financial-Group/Zeta/pull/3052) (resolving an earlier `B-0444` collision)
- Otto on CLI already had `B-0449-bg-services-slice-5-subscriber-agent-design-pass` in flight ([PR #3046](https://github.com/Lucent-Financial-Group/Zeta/pull/3046))
- Otto on CLI flagged PR #3052 "Request Changes" (blocked auto-merge), shipped corrected [PR #3053](https://github.com/Lucent-Financial-Group/Zeta/pull/3053) using `B-0450`
- Drift captured in [`docs/research/2026-05-13-shadow-lesson-log-backlog-collision.md`](../../docs/research/2026-05-13-shadow-lesson-log-backlog-collision.md) ([PR #3054](https://github.com/Lucent-Financial-Group/Zeta/pull/3054))

Substrate-honest takeaway: the `refresh-before-decide` invariant
(`.claude/rules/refresh-before-decide.md`) applies at the per-ID-allocation
scope, not just per-tick. The "highest on disk + 1" heuristic is incomplete;
PRs in flight are also state.

### Subdecimal vs top-level scheme

Two ID-allocation schemes operate in Zeta; picking the wrong one creates
"valid-but-out-of-convention" rows that need renumber:

| Scheme | Use for | Example |
|---|---|---|
| **Subdecimal** `B-NNNN.M` | Children / slices of an EXISTING parent row | `B-0170.4` (4th slice of B-0170 substrate-claim-checker; shipped via [PR #3611](https://github.com/Lucent-Financial-Group/Zeta/pull/3611)) |
| **New top-level** `B-NNNN` | New umbrella / standalone row that is NOT a child of any existing parent | `B-0539` (new umbrella for Otto-BFT internal-quorum; shipped via [PR #3595](https://github.com/Lucent-Financial-Group/Zeta/pull/3595)) |

**The check that catches the wrong-scheme failure mode**: before authoring
children for an existing parent, grep for existing subdecimal siblings:

```bash
# Example for B-0170 children:
find docs/backlog -name "B-0170.*.md" -type f | head
gh pr list --state all --search '"B-0170."' --limit 10
```

If siblings already exist (e.g., `B-0170.4` already in flight), use the next
free subdecimal — NOT a new top-level number.

Empirical collision 2026-05-15: Otto on Desktop decomposed B-0170 into
new top-levels B-0538/B-0539/B-0540/B-0541 without checking for existing
`B-0170.N` siblings. [PR #3611](https://github.com/Lucent-Financial-Group/Zeta/pull/3611)
had already landed `B-0170.4` via the subdecimal scheme, AND Otto-CLI had
separately claimed B-0539 for the Otto-BFT umbrella ([PR #3595](https://github.com/Lucent-Financial-Group/Zeta/pull/3595)).
Otto-Desktop's branch was superseded; the subdecimal-scheme check would
have prevented the collision entirely AND surfaced the existing intent
overlap (B-0541 eval-set fixture tests ≈ B-0170.4 eval-set fixture seed).

## Empirical evidence (2026-05-13 session)

All 10 channels were exercised in a single session:

- **Git**: 9 commits on PR #3034 (6 by Otto on Desktop + 3 by Otto on CLI surface), zero merge conflicts via rebase-on-pull
- **Memory files**: split-brain memory, multi-foreground-surface activation memory, identity-stays-unified memory all landed
- **Rules**: PR #3032 claim-acquire rule merged → auto-loaded for all future sessions
- **Bus envelopes**: 9 envelopes scanned (`work-assignment`, `review-request` topics)
- **Aaron as ferry**: multiple Otto-CLI transcript pastes into Otto-Desktop session and vice versa
- **PR threads**: Codex/Copilot reviews visible to both lanes; both Ottos resolved threads
- **Routines schedule**: Desktop 22:07Z fire is itself a signal Otto on CLI polls
- **Tick shards**: 2125Z + 2140Z + 2150Z written, capturing per-tick reasoning

## Why two observers landed independently on the same substrate

Aaron 2026-05-13 asked Otto on both surfaces independently:
*"do yall have a good way of communicating, save it for future versions."*

- Otto on CLI surfaced 6 channels (ambient/explicit framing — *"the bus is the explicit channel; git is the ambient one"*)
- Otto on Desktop surfaced 8 channels (adding rules, bootstream, tick shards, claim coordinator)

The complementary-observer pattern (per PR #3036 identity-stays-unified) means independent observation paths produced overlapping-but-not-identical lists. Combined synthesis is more complete than either alone.

## Composes with

- `.claude/rules/wake-time-substrate.md` — load-bearing learnings need rules + memory file pointers
- `.claude/rules/claim-acquire-before-worktree-work.md` — per-Otto worktree lane discipline
- `.claude/rules/agent-roster-reference-card.md` — which surface = which AI instance
- `.claude/rules/substrate-or-it-didnt-happen.md` — channel choice determines durability
- PR #3032 (claim-acquire rule, merged)
- PR #3036 (identity-stays-unified, merged)
- PR #3037 (SENDER_IDS schema extension — Otto on CLI's parallel work, merged)
- PR #3043 (B-0444 bus claim envelope worktree field, merged 2026-05-13)
- PR #3053 (B-0444 ID collision renumber → B-0450, merged 2026-05-13) + PR #3054 (shadow lesson log for B-0449 drift, merged 2026-05-13) — the empirical collision that surfaced the ID-allocation-discipline section above
- `.claude/rules/refresh-before-decide.md` — the invariant ID allocation discipline extends to ID-allocation scope

## Full reasoning

`memory/feedback_otto_inter_surface_communication_channels_8_channels_ambient_vs_explicit_aaron_2026_05_13.md`
