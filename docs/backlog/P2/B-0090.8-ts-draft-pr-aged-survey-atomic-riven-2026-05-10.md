---
id: B-0090.8
zetaid: 081KDVJT3E008QG0R001TDYYMD
priority: P2
status: open
title: TS survey for draft PRs aged > N days + content snapshot
tier: factory-hygiene
effort: S
depends_on:
  - B-0090.5
composes_with:
  - B-0090
last_updated: 2026-05-13
renumbered_from: B-0090.4
renumbered_reason: "ID collision with the second B-0090 decomposition (PR #2680). Part of Riven's earlier ts-* atomic series renumbered .1→.5/.2→.6/.3→.7/.4→.8 as a unit. Internal depends_on B-0090.1 also remapped to B-0090.5. The original body text referenced 'B-0090.5 (cadence)' which referred to a future cadence-wiring slice — note this no longer collides with the renumbered B-0090.5 (worktree survey) and that downstream cadence work would now be a new sub-row not yet filed. Substrate-cleanup tracked in B-0451."
tags: [riven-2026-05-10, ts-prefer, lost-substrate, draft-pr, renumbered]
---

# B-0090.8 — Atomic child: TS draft PR aged survey (renumbered from B-0090.4)

Depends on B-0090.5 (renumbered from B-0090.1). `tools/hygiene/audit-draft-pr-aged-survey.ts` : gh pr list --search "is:draft", age filter, snapshot title/body, 3-bucket classify.

S, TS only. The original body referenced "B-0090.5 (cadence)" as an unblock target — that referred to a future cadence-wiring slice (Riven's series only went .1-.4). With this renumber, the cadence slot would be a new row, not yet filed.
