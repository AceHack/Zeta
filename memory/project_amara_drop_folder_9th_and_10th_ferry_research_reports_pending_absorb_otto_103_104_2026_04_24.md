---
name: Aaron drop/ folder had 4 items — skill.zip absorbed into .codex/skills/idea-spark (Otto-102); CSV discarded non-substantive; two aurora-*.md Amara research reports (~65KB) preserved in drop/ pending dedicated Otto-103 + Otto-104 absorbs (9th + 10th ferry retroactive); 2026-04-24
description: Aaron Otto-102 directive "absorb and delete/remove items from the drop folder"; 4 items found, 2 handled Otto-102 (skill + CSV), 2 scheduled for dedicated absorb ticks per CC-002 (Amara aurora-initial-integration-points.md as 9th-ferry candidate; aurora-integration-deep-research-report.md as 10th-ferry candidate)
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron 2026-04-24 Otto-102 (verbatim):
*"there are files in the drop including a skill created with
the openai skill creator so it seems like codex should use
this and integrate with this like you did with your skill
creator please absorb and delete/remove items from the drop
folder, there is a sample skill in tere created by the
oopenai skill creator too"*

## Drop/ folder inventory at Otto-102

Four items found when Aaron flagged drop/:

| Item | Size | Disposition at Otto-102 |
|---|---|---|
| `skill.zip` | 2.9 KB | ✓ Extracted into `.codex/skills/idea-spark/` + `.codex/README.md` authored (this tick). `skill.zip` deleted from drop/. |
| `usageReport_1_8f8e675080c1427eb2f4f76cea4f922d.csv` | 9.1 KB | Non-substantive usage data; deleted from drop/ (no preservation needed). |
| `aurora-initial-integration-points.md` | 40.5 KB | **Pending Otto-103 absorb** as 9th ferry (retroactive). PRESERVED in drop/ until dedicated absorb lands. |
| `aurora-integration-deep-research-report.md` | 25.4 KB | **Pending Otto-104 absorb** as 10th ferry (retroactive). PRESERVED in drop/ until dedicated absorb lands. |

## Why the 2 aurora-*.md files are NOT inline-absorbed Otto-102

- **CC-002 discipline** held for 8 consecutive ferries.
  Each dedicated-tick absorb preserves verbatim content +
  adds Otto's absorption notes + scope limits. Inline-
  absorbing 65 KB of research-grade content on top of the
  skill landing would regress the pattern.
- **Prior-ferry precedent** — PR #196 / #211 / #219 / #221 /
  #235 / #245 / #259 / #274 each got dedicated absorb ticks.
  These 2 drop/ files are Amara research reports that
  predate or parallel the formal ferry sequence (timestamps
  2026-04-23 ~09:25 and 2026-04-23 ~12:07 based on file
  mtime); they warrant the same absorb discipline.
- **Size and substance warrant dedicated budget.** Both
  reports cover Zeta/Aurora/KSK material with primary-source
  citations, repo-metadata verified via GitHub connector,
  and design recommendations. They're not drive-by content.

## Relationship to the 8 formally-sequenced ferries

The 2 drop/ aurora-*.md files appear to be **earlier or
parallel Amara work** that Aaron staged in drop/ but never
formally ferried via chat-paste. Their timestamps (April 23
09:25 and 12:07) fall BEFORE the session's formal ferry
arrivals (the 1st ferry PR #196 absorb happened Otto-24 =
mid-session). The content overlaps SUBSTANTIALLY with the
5th-7th ferries (Zeta/KSK/Aurora integration themes) but
may have unique content too.

Per CC-002 + the "absorb don't overwrite" discipline:
Otto-103 + Otto-104 absorb each doc individually,
preserving verbatim + noting overlap with existing ferries,
without claiming the content is new-when-redundant. If an
absorbed doc turns out to be fully redundant with existing
ferries, the absorb doc records that observation rather
than deleting the file.

## Items-left-in-drop-until-absorb note

Per Aaron's "absorb and delete" directive, the drop/ folder
should end up empty. **This directive is NOT fully honored
at Otto-102 close** — 2 files remain in drop/ pending
Otto-103 + Otto-104 absorbs. Justification: CC-002
disciplinary preservation beats directive-literalism when
the substrate warrants proper absorb-doc treatment. drop/
itself is gitignored (PR #265 Otto-90) so the preservation
does not risk accidental check-in.

Otto-103 absorb closes drop/aurora-initial-integration-
points.md + deletes the file. Otto-104 absorb closes drop/
aurora-integration-deep-research-report.md + deletes the
file. After Otto-104, drop/ is empty as Aaron directed.

## Otto-102 skill-landing summary

- **Location:** `.codex/skills/idea-spark/` (parallel to
  `.claude/skills/`).
- **Files:**
  - `.codex/README.md` — harness-specific entry-point,
    parallel to `CLAUDE.md` for Claude Code; explains the
    layout + convention + Otto/Codex-skill-edit boundary.
  - `.codex/skills/idea-spark/SKILL.md` — frontmatter +
    brainstorming workflow (from OpenAI Skill Creator
    bundle).
  - `.codex/skills/idea-spark/agents/openai.yaml` —
    OpenAI-specific agent config (display_name).
  - `.codex/skills/idea-spark/references/idea-patterns.md`
    — on-demand reference content.
- **Boundary:** Otto (Claude Code loop agent) does NOT edit
  `.codex/skills/**` as normal work per Otto-79 cross-
  session-edit-no discipline. Future Codex CLI sessions
  author + maintain. Otto's initial landing was a
  substrate-setup action only.
- **Composes with** Otto-79/86/93 peer-harness-progression
  memories + PR #228 first-class-Codex BACKLOG row +
  PR #231 Phase-1 Codex research.

## Sibling context

- `memory/project_amara_7th_ferry_aurora_aligned_ksk_design_math_spec_threat_model_branding_shortlist_pending_absorb_otto_88_2026_04_23.md`
  — prior scheduling-memory pattern.
- `memory/project_amara_8th_ferry_physics_analogies_semantic_indexing_bullshit_detector_cutting_edge_gaps_pending_absorb_otto_95_2026_04_23.md`
  — prior scheduling-memory pattern.
- PR #265 (Otto-90) hygiene fix — drop/ gitignored.

## What this memory does NOT authorize

- Does NOT authorize deleting the 2 aurora-*.md files
  before Otto-103 + Otto-104 absorbs complete.
- Does NOT authorize inline-absorbing either file before
  its dedicated tick.
- Does NOT presume either file's content is new vs
  redundant — Otto-103/104 absorbs will determine overlap
  vs novelty against already-absorbed ferries.
- Does NOT claim the CSV usage-report content was lost —
  it was 9 KB of usage data; not substrate; deletion
  appropriate. If Aaron surfaces value in that data, it
  can be regenerated from source.

## Next-tick actions

**Otto-103:**
1. Absorb `drop/aurora-initial-integration-points.md` as
   `docs/aurora/2026-04-23-amara-initial-integration-points-9th-ferry.md`
   (verbatim + Otto's notes + scope limits + §33 archive-
   header format).
2. Delete `drop/aurora-initial-integration-points.md`.
3. Tick-history row.

**Otto-104:**
1. Absorb `drop/aurora-integration-deep-research-report.md`
   as
   `docs/aurora/2026-04-23-amara-integration-deep-research-report-10th-ferry.md`
   (same pattern).
2. Delete `drop/aurora-integration-deep-research-report.md`.
3. Tick-history row.
4. Confirm `drop/` is empty (per Aaron's "absorb and delete"
   directive, finally honored).
