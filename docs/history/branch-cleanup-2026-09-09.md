# Branch cleanup record — 2026-09-09

Deletion record for the remote-head sweep of `Lucent-Financial-Group/Zeta`.
Every branch below was **tagged before it was deleted**, so a tip SHA is enough
to restore it: `git push origin <sha>:refs/heads/<branch>`. Text, per
`.claude/rules/no-binary-in-proof-lineage.md`. Same shape as
[`branch-cleanup-2026-08-25.md`](branch-cleanup-2026-08-25.md).

Workitem: `081M24DW4G0087G0R000MD0QEP`.

## Why

> "we need to cleanup all these branches again." — the maintainer, 2026-09-09

## Totals

| category | count |
|---|---:|
| remote heads before | 162 |
| remote heads after (measured 2026-09-10T01:13:23Z) | 127 |
| **deleted by this sweep** | **34** |
| merged + auto-deleted by GitHub mid-sweep (not this sweep) | 3 |
| pushed by another agent mid-sweep, never triaged | 2 |
| protected, never examined for deletion | 62 |
| kept with a stated reason | 64 rows, 63 still present |
| archive tags created by this sweep | 19 |
| archive tags reused from the 2026-09-03 sweep | 15 |

`162 - 34 - 3 + 2 = 127`, re-measured against `git ls-remote --heads origin`
after the deletes, not inferred from the push output.

## Protected namespaces — never examined (62)

| namespace | count | why |
|---|---:|---|
| `preserve/*` | 31 | a preservation namespace itself |
| `heartbeat/*` | 29 | frozen telemetry lanes; frozen is not abandoned |
| `liveness/observations` | 1 | the observation ledger |
| `main` | 1 | default branch |

`archive/*` **tags** were read, never written over, and never a deletion
candidate. `git ls-remote --tags origin` counts **485** of them after this sweep,
19 of which it added. A local clone shows fewer (449 here) because not every
remote tag is fetched; the remote count is the authoritative one.

## The gate each deleted branch passed

This repo squash-merges, so `git branch -r --merged origin/main` returns **zero**
non-protected branches and ancestry proves nothing. Each deletion rests on one of
four positive tests, plus a tag:

1. **P — already preserved.** The 2026-09-03 sweep created an `archive/*` tag for
   the branch and the tag SHA still **equals the current tip**, so the tip was
   already archived; only the delete had not happened.
2. **A — stale claim lease.** The branch's whole diff is one
   `docs/claims/<slug>.md` marker and its last commit is more than 24 h old, which
   is the documented **force-release** condition in
   `docs/AGENT-CLAIM-PROTOCOL.md#stale-claims-and-force-release`.
3. **B — superseded v1.** The branch's PR is CLOSED-unmerged and a **named
   successor PR merged** (`-v2` / `-2` / `-3`), and the content check below finds
   no basename it adds that is absent from `main`.
4. **C — merged, and the post-merge tip verified.** The branch's PR is MERGED and
   either the merged head **equals** the current tip, or every commit past the
   merged head was found on `main` by subject search, with the landing PR named.

No branch with an **OPEN** PR was deleted; see the falsifier finding below.

## Deleted — group P: tagged 2026-09-03, tag SHA == tip, delete never ran (15)

| branch | tip | tag |
|---|---|---|
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-24` | `424fa4502b3f` | `archive/2026-09-03-branch-sweep/...` |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-25` | `55f71cf0cf44` | `archive/2026-09-03-branch-sweep/...` |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-26` | `1f8b461ed1be` | `archive/2026-09-03-branch-sweep/...` |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-27` | `e16abea6d091` | `archive/2026-09-03-branch-sweep/...` |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-28` | `79172a261ce1` | `archive/2026-09-03-branch-sweep/...` |
| `claim/081ktqx7w6q08qg0r000-otto-2026-08-29` | `c4bb82e6c5f0` | `archive/2026-09-03-branch-sweep/...` |
| `claim/task-browser-checkpoint-port` | `1b688a027b51` | `archive/2026-09-03-branch-sweep/...` |
| `claim/task-browser-pwa-checkpoint-transport` | `329364be6c99` | `archive/2026-09-03-branch-sweep/...` |
| `claim/task-browser-zetadb-invalidation` | `9aa2c64c1f8f` | `archive/2026-09-03-branch-sweep/...` |
| `codex/browser-zetadb-startup-hydration` | `7dc5eef17eff` | `archive/2026-09-03-branch-sweep/...` |
| `cursor/longhorn-common-nix-default-test-06ca` | `274e217e207c` | `archive/2026-09-03-branch-sweep/...` |
| `cursor/longhorn-rebase-clean-06ca` | `b85aba867489` | `archive/2026-09-03-branch-sweep/...` |
| `cursor/rework-pr-13767-9c53` | `9142e163f9bb` | `archive/2026-09-03-branch-sweep/...` |
| `otto/agent-sovereign-keys-proposal` | `316b67b41920` | `archive/2026-09-03-branch-sweep/...` |
| `otto/telemetry-zetaid-shards` | `81351e0ddfd9` | `archive/2026-09-03-branch-sweep/...` |

Nine of the fifteen are also group A (marker-only stale claim leases) and one,
`codex/browser-zetadb-startup-hydration`, carries content the basename gate calls
UNLANDED — it is deleted on the **prior sweep's** already-executed preservation
judgement, not on a fresh content check.

## Deleted — group A: stale claim lease, marker-only (1 not already in P)

| branch | tip | diff vs main | last commit | tag |
|---|---|---|---|---|
| `claim/task-character-evolution-20260908` | `6f04bcec6cef` | 1 file, 12 insertions | 2026-09-08 17:31 (>24 h) | `archive/2026-09-09-branch-sweep/claim/task-character-evolution-20260908` |

Superseded by `claim/task-character-evolution-20260909`, which is **under 24 h
old and therefore an ACTIVE lease** — kept.

## Deleted — group B: closed-unmerged v1, named successor merged (13)

| branch | tip | closed PR | successor that merged |
|---|---|---|---|
| `change-control-kernel` | `3639d830472b` | #16427 | `change-control-v2` #16433 |
| `control-plane-estop` | `cb03cc847e85` | #16418 | `control-plane-estop-v2` #16434 |
| `observe-act-promotion-gate` | `26bbf79d15cb` | #16425 | `promotion-gate-v2` #16432 |
| `state-reconciliation-exhaustive` | `ea493d01c330` | #16423 | `action-table-v2` #16431 |
| `specialization-cache-treaty` | `80a8d99d6ee5` | #16458 | `specialization-cache-treaty-v2` #16463 |
| `tlc-retry` | `35afecd9996c` | none | `tlc-retry-v2` #16489 |
| `feat/zetafs-pr6-jumprope` | `b1feb6a9169f` | #16215 | `feat/zetafs-pr6-jumprope-2` #16224 |
| `feat/zetafs-pr7-freeze` | `56abd8357772` | #16227 | `feat/zetafs-pr7-freeze-3` #16232 |
| `feat/zetafs-pr7-freeze-2` | `c17c641e3776` | #16230 | `feat/zetafs-pr7-freeze-3` #16232 |
| `feat/zset-map-monotone` | `159f5238af14` | #16255 | `feat/zset-map-monotone-2` #16259 |
| `feat/zset-join-rent-output` | `dc295ba77fcd` | #16256 | `feat/zset-join-rent-output-3` #16262 |
| `feat/zset-join-rent-output-2` | `9119e64f9168` | #16258 | `feat/zset-join-rent-output-3` #16262 |
| `otto/serve-tree-dev-rung` | `f707c18ab61d` | none | `otto/serve-tree-dev-rung-v2` #16543 |

Each is tagged `archive/2026-09-09-branch-sweep/<branch>`.

## Deleted — group C: merged PR, post-merge tip verified on main (5)

| branch | tip | merged PR | evidence for the commits past the merged head |
|---|---|---|---|
| `cursor/zflash-cli-bao-flags-27c5` | `a9fc6245a461` | #16813 | none — tip **equals** the merged head |
| `otto/nci-and-headscale-raw-manifests` | `7224d5d9e0a6` | #16696 | `base_domain must not contain server_url's host` landed as **#16720** |
| `otto/opensearch-defer-on-live-measurement` | `349c12bd1ad1` | #16662 | both trailing commits recovered by **#16669** ("two commits auto-merge left behind") |
| `otto/recover-opensearch-fix` | `3bd565b890cd` | #16669 | `drift goes GREEN ... headscale moves home` landed as **#16675** |
| `shadow/retire-three-stale-branch-claims` | `f7e095c70a2c` | #16478 | `pigeonhole :156 and n3 doc point at docs/derivations/` landed as **#16487** |

Each is tagged `archive/2026-09-09-branch-sweep/<branch>`.

## Kept, with the reason (64 rows; one merged mid-sweep, so 63 survive)

### Open PR at triage time — must survive (11; one merged mid-sweep)

`agent/dotnet10-unify-081M241X65G087G0R00298CCQ8` #17176 ·
`agent/lane-metal-fidelity-audit-081M241X64R087G0R0038NK0V3` #17186 ·
`agent/qemu-uefi-firmware-081M24BB3TD087G0R001PJTW9A` #17194 ·
`agent/workflow-enablement-audit-081M243GZ19087G0R001F914Q4` #17182 ·
`claudemd-liveness-paused` #17193 (**merged 01:10Z mid-sweep, auto-deleted by GitHub — not by this sweep**) · `h3-rank3-phase-0` #17179 ·
`shadow/csp-proof-tag-filter` #17173 ·
`shadow/ferry-simulation-papers-and-learned-geometry-direction` #17180 ·
`shadow/prototype-pollution-deps` #17177 · `shadow/rolling-pin-repin-race` #17178 ·
`shadow/xss-through-dom-cart-viewer` #17175

### Live lane / active lease (2)

- `agent-heartbeats` — **a live heartbeat lane** carrying thousands of
  `heartbeat(...)` commits. It is not under `heartbeat/*` and so is not caught by
  the usual exclusion; treat it as protected. Its PR #5470 merged long ago and the
  tip has advanced by the whole lane since.
- `claim/task-character-evolution-20260909` — claim lease **under 24 h old**, i.e.
  ACTIVE under `docs/AGENT-CLAIM-PROTOCOL.md`. Deleting it would force-release a
  live claim.

### Unlanded content, no PR — the 2026-09-07/08 codex/wip/claim swarm (31)

Not sweepable, and worth a maintainer decision rather than a sweep: these carry
real durable content absent from `main` with **no PR open to land it**. Several
are very large (`codex/mixed-message-epoch-integration-20260908` adds 1300+ files;
`claim/task-compiled-capture-five-publication-20260907` adds 2566).

`claim/chsh-bucket-coverage-20260906` ·
`claim/task-compiled-capture-five-publication-20260907` ·
`claim/task-compiled-prerequisites-publication-20260907` ·
`claim/task-compiled-replay-custody-publication-20260908` ·
`claim/task-distributional-learning-20260908` ·
`claim/task-distributional-publication-20260908` ·
`claim/task-hidden-switch-compiled-20260907` ·
`codex/checked-mixed-message-core-20260908` ·
`codex/compiled-capture-publication-review-20260907` ·
`codex/compiled-runtime-admission-review-20260907` ·
`codex/distributional-learning-rooms-publication-20260908` (PR #17021 closed
unmerged, 230 files still absent) ·
`codex/distributional-rooms-reference-20260908` ·
`codex/hidden-switch-compiled-integration-20260907` ·
`codex/hidden-switch-compiled-native-20260907` ·
`codex/hidden-switch-compiled-protocol-review-provenance-20260907` ·
`codex/hidden-switch-compiled-reference-20260907` ·
`codex/hidden-switch-native-20260907` ·
`codex/hidden-switch-prospective-note-20260907` ·
`codex/hidden-switch-reference-20260907` ·
`codex/mixed-message-epoch-bridge-20260908` ·
`codex/mixed-message-epoch-integration-20260908` ·
`codex/mixed-message-peer-20260908` ·
`wip/compiled-validation-native-20260907` ·
`wip/compiled-validation-reference-20260907` ·
`wip/compiled-validation-review-20260907` ·
`wip/compiled-validation-root-20260907` ·
`wip/precision-projection-registration-20260908` ·
`wip/vera-compiled-integration-20260907` · `wip/vera-compiled-native-20260907` ·
`wip/vera-compiled-reference-20260907` · `wip/vera-compiled-review-20260907`

### Merged PR, but the tip advanced and the extra commits were NOT found on main (4)

Each has a merged PR **and** post-merge commits whose content could not be shown to
have landed. Group C's test failed for them, so they are kept:

| branch | merged PR | unverified commit |
|---|---|---|
| `otto/serve-tree-dev-rung-v2` | #16543 | `the lane-tree ConfigMap needs a SERVER-side apply` |
| `shadow/credential-rotation-verb` | #16952 | `make rotation EASY — the awkwardness bought no safety` |
| `shadow/first-metal-findings-register` | #17001 | `correct two findings the maintainer reframed` |
| `shadow/repo-split-plan` | #16837 | `the language repos are CHALLENGERS to the IR, not legacy` |

### Closed-unmerged with no merged successor found (8)

`cursor/lumen-unique-confirm-16678-77c2` #16681 ·
`cursor/lumen-unique-confirm-16678-fa0b` #16679 ·
`feat/zetafs-unwrap-oracles-mac-hsm` #16194 · `io-boundary-treaty` #16449 ·
`shadow/capability-ratchet-benchmark` #16845 ·
`shadow/deprecated-chart-is-a-finding` #16357 ·
`shadow/ratchet-benchmark-ohms-regimes` #16847 ·
`shadow/triangle-corner-meter` #16849

`io-boundary-treaty` is the odd one in its family: its five siblings from the same
2026-09-02/03 session all got a merged `-v2`, and it did not. Its tip subject is
`the transcript generator failed the blocking eslint gate`.

### No PR, provenance clear but landing unverified (8)

`archive/nci-emitter-capability-20260906` · `feat/zetafs-groupcommit-blockio` ·
`feat/zetafs-posix-object-skip-existing` · `otto-16696` ·
`otto/nci-higher-resolution-2026-09-05` ·
`shadow/joiner-control-plane-label-is-async` ·
`shadow/k3s-joiner-label-async-retry` · `shadow/triangle-meter`

Two branches appeared **during** this sweep and were never triaged: `pr-inspect-tool` and `security/tranche6-npm-advisories`. The repo is live; every count here carries its measurement time.

`archive/nci-emitter-capability-20260906` is a **branch** sitting in the
`archive/*` name, which is the tag-side preservation namespace. It is kept, and
the collision is flagged below rather than resolved by a sweep.

## Findings — three defects this sweep surfaced

### 1. `triage-orphan-branches.ts` classes OPEN-PR branches as prunable

`src/Core.TypeScript/hygiene/triage-orphan-branches.ts` gates only on content
(*"a branch is SAFE iff it adds no basename absent from main"*). It never asks
whether the branch has an **open PR**. Measured here: its SAFE set contained
`agent/face-lattice-flake-081M243GZ19087G0R001F914Q4` (PR #17184, open at the time)
and `agent/unrun-flake-eval-checks-081M243GZ19087G0R001F914Q4` (#17187, open).
Running it with `--prune` at that moment would have deleted the head refs of two
live PRs. Both were excluded here by intersecting the SAFE set with an
open-PR list read over REST before any delete.

### 2. The basename gate produces FALSE SAFEs on generated-log corpora

The same gate says SAFE when every basename a branch adds already exists somewhere
on `main` — a *name* collision, not a content one. On the 2026-09-07/08 custody-log
corpus (files called `001.gz`, `producer-00-0.json.gz`, and similar) this fires
constantly. `claim/task-compiled-capture-five-publication-20260907` was classed
**SAFE** while carrying **2566 files / 23286 insertions** absent from `main`;
`claim/task-compiled-prerequisites-publication-20260907` likewise at 2314 files.
No branch was deleted on that signal alone: the executed set required a merged PR,
a named merged successor, a >24 h marker-only claim lease, or a prior sweep's tag.

### 3. The 2026-09-03 sweep tagged 15 branches and never deleted them

Fifteen `archive/2026-09-03-branch-sweep/*` tags point at SHAs that were **still
the live branch tips** six days later. Preservation ran; the delete did not. A
delete that silently fails reads as success, which is why this record re-lists the
remote and confirms absence rather than trusting the push output.

### 4. The pre-push floor hook cannot tell an archive tag from a contract change

`scripts/hooks/pre-push` refused
`archive/2026-09-09-branch-sweep/feat/zetafs-pr{6,7}-*` with
`BLOCKED (treaty-byte-lock-vectors)`. For a **new** remote ref the hook scopes its
scan to `merge-base(tip, origin/main)..tip` — its own comment says "scope to
commits not already on any origin ref", but the code only consults `origin/main`.
An archive tag names commits that are **already published** (each target was
verified with `git branch -r --contains`, which returned the branch itself), so the
push transferred zero objects and changed no vector on any lane. Pushed with
`ZETA_FLOOR_VECTORS_ACK=1` on that basis, recorded here rather than left silent.

The fix is one condition — skip the scan when `local_sha` is already reachable from
an existing `origin/*` ref — and it belongs to whoever owns the hook.

## What was deliberately NOT touched

- **`preserve/*` (31), `heartbeat/*` (29), `liveness/observations`, `main`** — never
  listed as candidates.
- **`archive/*` tags** — read, never written over, never deleted.
- **`agent-heartbeats`** — a live heartbeat lane outside the `heartbeat/*` prefix.
- **Every branch with an open PR.**
- **The 31-branch codex/wip/claim swarm of 2026-09-07/08** — real unlanded content
  with no PR. A sweep is the wrong instrument; these need landing or an explicit
  `release: <slug> - abandoned` per the claim protocol.
- **Anything whose landing could not be shown** — the four merged-PR branches with
  unverified trailing commits, the eight closed-unmerged branches with no successor,
  and the eight no-PR branches above.

## How to restore any row

```
git push origin archive/2026-09-09-branch-sweep/<branch>^{}:refs/heads/<branch>
```

For the fifteen group-P rows substitute `archive/2026-09-03-branch-sweep/<branch>`.
