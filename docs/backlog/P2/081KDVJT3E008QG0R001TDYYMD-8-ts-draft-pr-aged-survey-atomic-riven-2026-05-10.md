---
id: 081KDVJT3E008QG0R001TDYYMD
priority: P2
status: open
title: TS survey for draft PRs aged > N days + content snapshot
tier: factory-hygiene
effort: S
depends_on:
  - 081KDVJT3E008QG0R000SCFYN5
composes_with:
  - 081KQ8P5D0008QG0R0002TN22C
last_updated: 2026-05-13
renumbered_from: 081KDVJT3E008QG0R002GGF22P
renumbered_reason: "ID collision with the second 081KQ8P5D0008QG0R0002TN22C decomposition (PR #2680). Part of Riven's earlier ts-* atomic series renumbered .1→.5/.2→.6/.3→.7/.4→.8 as a unit. Internal depends_on 081KDVJT3E008QG0R003GV8BHV also remapped to 081KDVJT3E008QG0R000SCFYN5. The original body text referenced '081KDVJT3E008QG0R000SCFYN5 (cadence)' which referred to a future cadence-wiring slice — note this no longer collides with the renumbered 081KDVJT3E008QG0R000SCFYN5 (worktree survey) and that downstream cadence work would now be a new sub-row not yet filed. Substrate-cleanup tracked in 081KRFA460008QG0R00308W7FJ."
tags: [riven-2026-05-10, ts-prefer, lost-substrate, draft-pr, renumbered]
---

# 081KDVJT3E008QG0R001TDYYMD — Atomic child: TS draft PR aged survey (renumbered from 081KDVJT3E008QG0R002GGF22P)

Depends on 081KDVJT3E008QG0R000SCFYN5 (renumbered from 081KDVJT3E008QG0R003GV8BHV). `tools/hygiene/audit-draft-pr-aged-survey.ts` : gh pr list --search "is:draft", age filter, snapshot title/body, 3-bucket classify.

S, TS only. The original body referenced "081KDVJT3E008QG0R000SCFYN5 (cadence)" as an unblock target — that referred to a future cadence-wiring slice (Riven's series only went .1-.4). With this renumber, the cadence slot would be a new row, not yet filed.
