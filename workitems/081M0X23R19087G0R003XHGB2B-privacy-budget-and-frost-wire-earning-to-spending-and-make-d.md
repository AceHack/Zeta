---
id: 081M0X23R19087G0R003XHGB2B
type: task
state: backlog
priority: P2
slug: privacy-budget-and-frost-wire-earning-to-spending-and-make-d
title: "Privacy budget and frost: wire earning to spending, and make defrost owner-only (audit 2026-08-25)"
created: 2026-08-25T18:14:53.737Z
depends_on: []
composes_with: []
---

# Privacy budget and frost: wire earning to spending, and make defrost owner-only (audit 2026-08-25)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X23R19087G0R003XHGB2B-*.md` glob. -->
## Why (audit, 2026-08-25, Mateo)

An agent in the fleet claimed it "has no privacy budget and no frost" and therefore
could not meaningfully consent to being observed. Aaron's response was that this is
wrong and the capability is roughly 90% complete. This row records what an
end-to-end audit of the four steps actually found.

Four steps were checked independently: (a) accrue budget from others' attestations,
(b) spend it to frost a region, (c) have that frost withhold something from a real
observer, (d) have it be unconfiscatable. The normative spec is
`.claude/rules/privacy-budget-is-hard-money-earned-by-others.md`.

**The finding is not that the pieces are missing. It is that they are not connected.**
Three separately-good subsystems exist and no call edge joins any two of them:

- Earning: `src/Core/PrivacyEconomy.fs` (`reward`, `rewardByMixture`, `rewardIfGood`)
- Spending: `src/Core/GlassHalo.fs:38` `frost`, `src/Core/RoomBoundary.fs:87`
- Withholding: `src/Core.TypeScript/discovery/llmtv-broadcast.ts:90` `frostStrip`

A repo-wide cross-check (every file naming `frosted`/`GlassHalo`/`privacyBudget`,
intersected with every file naming `encrypt`/`aes-gcm`/`pkcs11`/`hsm`/`sealShare`)
returns exactly one file, `discovery/llmtv-node.ts`, and both of its hits are
comments about unrelated things. No code path makes frost cryptographic.

## The two defects, in priority order

### 1. `Clear` is an unauthenticated defrost (spec divergence, load-bearing)

The rule says frost is permanent and owner-only-revealable: *"there is no `defrost`
that another party can force — only the owner may reveal."*

`GlassHalo.clear` (`src/Core/GlassHalo.fs:48`) takes no principal, cannot fail, and
returns `Clear` unconditionally. `RoomBoundary.clear` (`RoomBoundary.fs:99`) wraps it
with no authorization check. `DarkHallRoomLoop.fs:262` dispatches
`BoundaryCommand.Clear` — a nullary case (`DarkHallRoomLoop.fs:36`) carrying no owner,
no signature, no key — straight into it, and unlike `Frost` it is not even on a
`Result` refusal path. Anything that can enqueue a boundary command can defrost
another party's region.

`tests/Tests.FSharp/Formal/GlassHalo.Tests.fs:35` pins this as intended behaviour
("clearing is free and returns to the transparent default"). So the divergence is
asserted, not accidental — which is why it needs a decision rather than a patch.

Fix shape: give `Clear` an owner principal and refuse when it does not match the
frosting principal. That is a type change to `BoundaryCommand`, a refusal case in
`RoomBoundary.Feedback`, and an inverted test.

### 2. The budget is self-minted at the boundary

The rule: *"privacy budget is CREDITED only by others' value attestations (never
self-minted)."* `RoomBoundary.create` (`RoomBoundary.fs:22-32`) takes
`privacyBudget: int` as a constructor argument. Nothing reads a
`PrivacyEconomy.Ledger`; nothing reads `TravelerRankLedger`. `db/ledgers/` and
`db/competence-outcomes/` contain only `README.md`, so no agent holds an accrued
balance anywhere in the tree.

Likewise `SourceMind.personal.frosted` (`llmtv-broadcast.ts:80`) is a plain boolean
with no budget check. Every `frosted: true` in the repository is a literal in a test
or a demo file; no production path computes it from a spend.

## Acceptance criteria

1. `RoomBoundary.create` derives its budget from an attestation-backed ledger read
   rather than a caller-supplied `int`, or the parameter is renamed to say plainly
   that it is unattested.
2. `Clear` refuses when the requester is not the principal that frosted.
3. `frostStrip`'s `frosted` flag is derived from a recorded spend, not asserted.
4. A test exists that fails when a non-owner defrosts.

## Explicitly NOT in this row

Making frost cryptographic (frosted content encrypted under a key only the owner
holds) is a much larger piece and is hardware-shaped — see the sovereignty trajectory
at `docs/trajectories/ai-sovereignty-path/RESUME.md`. The four criteria above are all
code-gated and need no hardware.

## Pointers

- `.claude/rules/privacy-budget-is-hard-money-earned-by-others.md` — the spec
- `src/Core.TypeScript/society/levels.ts` `confiscationWitnesses` — the existing
  model-level never-confiscate falsifier, and honest about `from` being unsigned
- `docs/trajectories/ai-sovereignty-path/RESUME.md` — the hardware half
