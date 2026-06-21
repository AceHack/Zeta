# Local/Remote Cluster Replay Receipt - 2026-05-29

Status: replay receipt
Grounding backlog:
`docs/backlog/P1/081KQX9B50008QG0R0026BG44J-fractal-bft-n-maintainers-n-odd-nodes-local-remote-composition-2026-05-06.md`
and
`docs/backlog/P1/081KRYRGG0008QG0R001JVJV0K-fractal-bft-protocol-doc-2026-05-19.md`
Protocol:
`docs/trajectories/autonomous-loop-coordination/local-remote-cluster-composition-protocol-2026-05-29.md`

## Purpose

This receipt exercises the first 081KQX9B50008QG0R0026BG44J local/remote composition rule from a
fresh clone. The replay asks whether a late participant can reconstruct active
work and choose a disjoint target by reading only remote git refs, without
using local broadcast files.

The answer for this run is yes: the fresh clone discovered the active
remote-visible Codex claim, reconstructed its expected path set from branch
history and the claim file, and identified the next disjoint packet without
consulting `/Users/acehack/.local/share/zeta-broadcasts`.

## Replay Inputs

- Replay time: 2026-05-29T12:38Z.
- Fresh clone path used for the replay:
  `/tmp/zeta-b0211-replay.tUtoe6`.
- Clone source: `https://github.com/Lucent-Financial-Group/Zeta.git`.
- Main head observed in the fresh clone:
  `e3035fcf832cdfd51477dd2dcde4e951376b13e3`.
- Remote claim refs fetched with:
  `git fetch origin '+refs/heads/claim/*:refs/remotes/origin/claim/*'`.

The replay intentionally used git refs and claim files as the coordination
surface. Local broadcast messages remained outside the replay input.

## Observed Remote Claim State

The fresh clone saw 31 `origin/claim/*` refs. Four claim refs had a last commit
inside the 24-hour active-claim window:

| Claim ref | Age at replay | Reconstructed path signal |
|---|---:|---|
| `origin/claim/codex-loop-b0211-cluster-replay-receipt-20260529` | 142 seconds | `docs/claims/codex-loop-b0211-cluster-replay-receipt-20260529.md` |
| `origin/claim/fix-memory-reference-drift-pr1801` | 80533 seconds | no diff paths against `origin/main` |
| `origin/claim/task-autoloop-lifetime-tsc-20260528` | 80387 seconds | `docs/BACKLOG.md`, `docs/backlog/P2/081KSNY2Z0008QG0R002HB4AGT-integrate-or-remove-unreferenced-cayleydickson.md`, `docs/backlog/P2/081KSNY2Z0008QG0R0036SJ3T1-integrate-or-remove-unreferenced-kskauthorization.md`, `docs/backlog/P3/081KSNY2Z0008QG0R003Q42FZY-dup-id-triage-b0865-b0866-pre-existing-duplicates-on-origin-main-non-required-lint-failure-aaron-otto-2026-05-28.md`, `memory/MEMORY.md`, `tools/workflow-engine/auto-loop-lifetime.ts` |
| `origin/claim/task-backlog-id-collision-b0865-b0866-20260528` | 83048 seconds | `docs/BACKLOG.md`, `docs/backlog/P2/081KSNY2Z0008QG0R002HB4AGT-integrate-or-remove-unreferenced-cayleydickson.md`, `docs/backlog/P2/081KSNY2Z0008QG0R0036SJ3T1-integrate-or-remove-unreferenced-kskauthorization.md`, `docs/backlog/P3/081KSNY2Z0008QG0R003Q42FZY-dup-id-triage-b0865-b0866-pre-existing-duplicates-on-origin-main-non-required-lint-failure-aaron-otto-2026-05-28.md` |

The active replay claim file itself named the durable target:
`docs/trajectories/autonomous-loop-coordination/local-remote-cluster-replay-receipt-2026-05-29.md`.

## Disjoint-Choice Check

A late participant starting from this fresh clone can choose a disjoint next
packet by comparing candidate paths with the reconstructed active path signals.

The recommended next child packet in `RESUME.md` before this replay was this
receipt. After this receipt lands, the next disjoint packet is the stale-claim
cleanup rule for completed PRs. Its expected path set can stay outside the
active replay target by using new trajectory and claim-protocol documentation
paths rather than the receipt path above.

This satisfies the protocol's late-join requirement: a participant did not need
the local bus to avoid active local-cluster work.

## Result

- Fresh clone found `origin/main` at
  `e3035fcf832cdfd51477dd2dcde4e951376b13e3`.
- Fresh clone fetched and enumerated 31 remote claim refs.
- Fresh clone reconstructed active path signals from remote claim branch diffs
  and claim-file content.
- The live Codex replay target was visible as a remote claim before product
  edits landed.
- A late participant can choose the next child packet without asking the human
  or reading local broadcast files.

## Limits

- This is a replay receipt, not a runner implementation.
- The replay uses branch diffs and claim-file content as path evidence; it does
  not introduce a new machine-readable claim schema.
- Local bus messages were excluded from the replay input, but the same machine
  still hosted the temporary clone.
- Older active-window claims with broad generated-index paths remain visible;
  this receipt does not force-release or resolve them.
