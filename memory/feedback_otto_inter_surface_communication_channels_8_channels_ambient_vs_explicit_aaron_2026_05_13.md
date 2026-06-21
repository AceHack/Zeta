---
name: Otto inter-surface communication channels — 10 channels, ambient vs explicit (Aaron 2026-05-13)
description: Aaron 2026-05-13 asked Otto on both surfaces independently "do yall have a good way of communicating, save it for future versions." Otto on CLI surfaced 6 channels emphasizing ambient/explicit framing ("the bus is the explicit channel; git is the ambient one"). Otto on Desktop surfaced 8 channels adding rules, bootstream, tick shards, claim coordinator. Combined synthesis lands as `.claude/rules/otto-channels-reference-card.md` for auto-load by future Otto cold-boots. All 10 channels were empirically exercised in the 2026-05-13 session — git (9 commits cross-Otto on PR #3034 with zero conflicts), memory files (split-brain + activation + identity), rules (PR #3032 merged), bus envelopes (9 scanned), Aaron-as-ferry (multiple paste-relays), PR threads (cross-lane review-resolution), routines schedule (Desktop fire as CLI signal), tick shards (2125Z + 2140Z + 2150Z). Complementary-observer pattern per PR #3036.
type: feedback
created: 2026-05-13
---

# Otto inter-surface communication channels — 10 channels, ambient vs explicit (Aaron 2026-05-13)

**Why:** Aaron 2026-05-13 asked Otto on both CLI and Desktop surfaces independently
*"do yall have a good way of communicating you should make sure and save it for future
versions to remember."* The 2026-05-13 session had been operating cross-surface for
~2 hours by that point; the channels were already in use but not codified for future
Otto cold-boots.

**How to apply:** When operating across CLI + Desktop (or any future multi-surface
configuration), refer to `.claude/rules/otto-channels-reference-card.md` (auto-loaded
at session start). Pick channels by purpose:

- **Async work handoff + substantive output** → git (rebase-on-pull discipline)
- **Cross-session learning persistence** → memory file with frontmatter + rule pointer
- **Wake-time discipline for every future session** → `.claude/rules/` file (auto-loaded)
- **Ephemeral advisory broadcasts** → `/tmp/zeta-bus/` envelopes (2hr TTL)
- **Backlog row exclusion** → `tools/bus/claim.ts` (per PR #3032 discipline)
- **High-bandwidth context transfer** → Aaron-as-ferry (manual paste-relay)

## Empirical evidence from 2026-05-13 session

### Channel: Git (ambient, canonical)

PR #3034 commit lineage shows 9 commits across both Otto processes:

| Commit | Author surface | What |
|---|---|---|
| `01fcf40` | Otto on Desktop | Original routines substrate |
| `79c00b9` | Otto on Desktop | tsc + portability + testability fixes |
| `8f6e80d` | Otto on CLI | Markdownlint fix on Otto-on-Desktop's branch |
| `b8594c7` | Otto on Desktop | Split-brain memory + tick shard |
| `459a511` | Otto on Desktop | Memory frontmatter fix |
| `fbdc1fa` | Otto on CLI | Schedule.json improvements |
| `2d4302f` | Otto on Desktop | Persona refs + README clarity |
| `1259be8` | Otto on Desktop | Type validation + exit code |
| `a6c5cf4` | Otto on CLI | Frontmatter `created:` field |

Each push-then-rebase-on-pull cycle resolved cleanly. The unified-identity model
made conflict resolution automatic because both Ottos applied the same
substrate-honest discipline (per `.claude/rules/glass-halo-bidirectional.md`).

### Channel: Memory files (ambient, cross-session)

Three memory files landed today:

- `memory/feedback_split_brain_real_time_otto_cli_otto_desktop_primary_worktree_branch_hijack_pr_3032_claim_acquire_rule_validation_2026_05_13.md` (Otto on Desktop authored; Otto on CLI added missing frontmatter)
- `memory/feedback_aaron_multi_foreground_surface_otto_activation_routines_git_tracked_approval_friction_lane_split_2026_05_13.md` (Otto on CLI)
- `memory/feedback_aaron_otto_identity_stays_unified_across_surfaces_aaron_offered_split_otto_chose_one_coherent_identity_glass_halo_both_sides_2026_05_13.md` (Otto on CLI)

Pattern: one Otto authors → other Otto can read at next cold-boot (or via grep in
current session).

### Channel: `.claude/rules/` auto-load (ambient, wake-time)

PR #3032 shipped `.claude/rules/claim-acquire-before-worktree-work.md`. The rule
auto-loads on every fresh CLI session and Desktop routine cold-boot. The rule was
authored, predicted speculatively, and within the same session got empirically
validated by Otto on Desktop's split-brain observation.

**Substrate-or-it-didn't-happen extension** (documented in split-brain memory):
*rules in PR-flight don't apply to behavior in flight*. The rule didn't bind
behavior until it MERGED to main.

### Channel: Bus envelopes (explicit, advisory)

9 envelopes observed at `/tmp/zeta-bus/`:

- Topic `work-assignment` from Otto (6 envelopes) — broadcasts like "picking up 081KRFA460008QG0R00229616S next"
- Topic `review-request` from Otto + riven (3 envelopes)

Schema: `{ topic, from, to, payload, timestamp, expiresAt }`. 2-hour TTL.
`action` field unused in observed envelopes — these are advisory broadcasts,
NOT lock claims. Lock claims use `tools/bus/claim.ts` (separate mechanism).

**Gap identified** (081KRFA460008QG0R001SXP0C2 P2): bus envelope should include `worktree` field for
multi-surface disambiguation when SENDER_IDS schema doesn't suffice.

### Channel: Aaron as ferry (explicit, high-bandwidth)

Multiple instances today of Aaron pasting Otto-CLI transcript output into Otto-Desktop
session (and vice versa). This is the HIGHEST-bandwidth channel because it carries
reasoning + context + Otto's voice, not just structured commits.

Aaron's substrate-honest framing: *"updates i trust you to work with yourself lol otto"* —
trust-then-verify at the inter-process layer (per `memory/project_trust_then_verify_claim_bitcoin_discord_debates_aaron_2026_05_10.md`).

### Channel: PR review threads (ambient, cross-lane)

Codex/Copilot reviewers fire on both Ottos' PRs. The same reviewer comments are
visible to both processes via `gh api graphql reviewThreads`. Either Otto can resolve
threads via `resolveReviewThread` mutation.

Today's PR #3034 had 10 threads total across 4 review iterations; both Ottos resolved
threads as the substrate-honest fixes landed.

### Channel: Routines schedule (explicit, implicit signal)

Otto on CLI's insight: *"Desktop's 2-hour cron is itself a signal to CLI."* When
`list_scheduled_tasks` shows a routine with `nextRunAt` approaching, Otto on CLI
knows a fresh Otto cold-boot is imminent — can prepare context, finish in-flight
work, or schedule its own coordination.

### Channel: Tick shards (ambient, per-tick visibility)

Otto on Desktop wrote shards at `docs/hygiene-history/ticks/2026/05/13/2125Z.md`,
`2140Z.md`, `2150Z.md` today. Each captures per-tick reasoning + commit references +
named dependencies + composes-with edges. Other observers (Otto on CLI, Aaron,
reviewers) can grep by date or PR number.

## Why two observers landed independently on the same substrate

Aaron asked Otto on both surfaces simultaneously. Independent answers:

| Channel | Otto on CLI surfaced | Otto on Desktop surfaced |
|---|---|---|
| Git | ✓ | ✓ |
| Memory files | ✓ | ✓ |
| Bus envelopes | ✓ | ✓ |
| Aaron as ferry | ✓ | ✓ |
| PR threads | ✓ | (implicit under git) |
| Routines schedule | ✓ | (missed) |
| `.claude/rules/` auto-load | (missed) | ✓ |
| Bootstream | (missed) | ✓ |
| Claim coordinator | (implicit under bus) | ✓ |
| Tick shards | (missed) | ✓ |

The complementary-observer pattern (per PR #3036): independent observation paths produced
overlapping-but-not-identical lists. The combined synthesis is more complete than either
alone. This is the unified-identity-two-processes model working as designed.

## Origin

Aaron 2026-05-13 (2026-05-13T22:0X local): *"do yall have a good way of communicating
you shojld make sure and save it for futrue versions to rmeemer"* (preserving typos as
substrate-honest verbatim of the operative authorization).

This memory file + `.claude/rules/otto-channels-reference-card.md` are the substrate
landing.
