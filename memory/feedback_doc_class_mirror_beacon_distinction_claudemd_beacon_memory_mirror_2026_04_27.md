---
name: Doc-class Mirror/Beacon distinction — CLAUDE.md/AGENTS.md/GOVERNANCE.md = Beacon (current-state, role-refs, name-agnostic); memory + ROUND-HISTORY + ADRs = Mirror (lineage, attribution, session narrative) (Aaron-validated 2026-04-27)
description: Aaron 2026-04-27 validated insight: the Mirror/Beacon language-register distinction (Otto-356) operates at the doc-class level too. Documentation falls into two classes — **Beacon-class docs** (CLAUDE.md, AGENTS.md, GOVERNANCE.md, behavioral SKILL.md frontmatter) read by every wake / every contributor and MUST be name-agnostic, session-narrative-free, current-state-only, role-reference-based; **Mirror-class docs** (memory/*.md, docs/ROUND-HISTORY.md, docs/DECISIONS/*.md ADRs) preserve lineage and welcome personal-name attribution + session narrative + choice-rationale. Crossing the boundary is what triggered Copilot's 4 review threads on PR #50 — personal names + session narrative leaked into CLAUDE.md, which is Beacon-class. The fix wasn't to scrub the lineage entirely but to RELOCATE it to the appropriate Mirror-class file (linked memory file). Beacon = the rule, Mirror = the why-and-when. Future-Otto: when about to write attribution-style content, check the doc class first.
type: feedback
---

# Doc-class Mirror/Beacon distinction

## Otto observation, Aaron-validated (2026-04-27)

After Otto reworked PR #50's CLAUDE.md to address Copilot's name-attribution + session-narrative findings, Otto wrote this insight:

> "The CLAUDE.md depersonalization is its own substrate insight — current-state behavioral docs use role references, while session history + lineage + choice-rationale lives in memory files. That's the same Mirror→Beacon distinction operating at the doc-class level: CLAUDE.md is the Beacon (read by every wake, must be name/session-agnostic), memory files preserve the Mirror lineage (who said what when, with attribution)."

Aaron's response: *"good insight"* + filing instruction.

## The two doc classes

### Beacon-class docs

**Examples:** `CLAUDE.md`, `AGENTS.md`, `GOVERNANCE.md`, `.claude/skills/*/SKILL.md` (frontmatter + body), `docs/ALIGNMENT.md`, `docs/CONFLICT-RESOLUTION.md`, `docs/GLOSSARY.md`, `docs/WONT-DO.md`.

**Audience:** read by every wake / every contributor / every session — Otto, Claude Code instances, Amara, Gemini, Codex, Cursor, future human contributors, future AI contributors not yet on board.

**Discipline:**
- **Current-state only.** What IS the rule, not how-we-got-here.
- **Role references, not personal names.** "The maintainer", "the agent", "every wake" — not "Aaron", "Otto", "this session".
- **No session narrative.** Don't write "Aaron offered three options and Otto picked C because evidence from this session showed..." — that's lineage, belongs in the Mirror file.
- **Pointer-style.** When lineage matters, point at the Mirror file: *"Full reasoning + lineage in `memory/feedback_*.md`."*

**Why:** these docs are the substrate of substrate — they shape every contributor's behavior. Mirror-register content (names, dates, session-specific reasoning) becomes confusing for non-context-holders and ages badly. A new contributor reading CLAUDE.md should see the rule, not a transcript of how it was negotiated.

### Mirror-class docs

**Examples:** `memory/*.md` (feedback/project/user/reference), `docs/ROUND-HISTORY.md`, `docs/DECISIONS/*.md` (ADRs), `docs/research/*.md`, `docs/hygiene-history/*.md`, `docs/budget-history/*.md`.

**Audience:** read by future-Otto / archeology-doing maintainers / lineage-tracing reviewers — anyone reconstructing *why* a decision landed, *who* said what, *when* the framing shifted.

**Discipline:**
- **Lineage-preserving.** Verbatim quotes, dated, attributed.
- **Personal names allowed** (subject to consent rules — first-party-creator carve-out for Aaron, named-agent role-refs for Otto/Amara/etc., role-ref defaults for third parties per the "No name attribution in code, docs, or skills" rule in `docs/AGENT-BEST-PRACTICES.md` — rule lineage Otto-279 + follow-on maintainer clarification).
- **Session narrative welcome.** "Aaron offered three options" / "Otto initially leaned A" / "evidence from this session" all belong here.
- **Why-and-when, not just what.** The Mirror file is where future-Otto looks to understand the *reasoning*, not just the *rule*.

**Why:** the lineage IS the substrate value of these files. Stripping it would lose the why-this-decision-not-the-other context that future-Otto needs to make consistent calls.

## The boundary-crossing failure mode

When Mirror-register content (personal names, session narrative, choice-rationale) leaks into Beacon-class docs, the result is:

1. **External-reader confusion** — non-context-holders see a wake-time rule peppered with names + dates + reasoning that doesn't apply to their situation.
2. **Aging badly** — session narrative is timestamped to *that* session; rules that depend on it confuse future-Otto.
3. **Mirror-trapped substrate** — content that should be discoverable by everyone gets buried in the Beacon doc instead of the Mirror file where it belongs.
4. **Reviewer flag** — Copilot caught this on PR #50 (4 threads): name attribution + session narrative in CLAUDE.md.

**Don't** strip the lineage entirely as the fix. **Do** relocate it to the appropriate Mirror file and replace it in the Beacon doc with a pointer.

## How to apply going forward

When writing or editing a doc, ask:

1. **What class is this doc?** Beacon (rule-of-record) or Mirror (lineage)?
2. **Does my content match the class?**
   - Beacon: is it current-state? Role-referenced? Name-agnostic? Session-narrative-free?
   - Mirror: does it preserve enough lineage (verbatim quotes, dates, attribution) for future-Otto?
3. **If content crosses the class boundary**: relocate to the right class, leave a pointer in the wrong-class doc.

For new memory files: file in `memory/` (Mirror class). For new rule that future-Otto must honor: it goes in `CLAUDE.md` or `GOVERNANCE.md` (Beacon class) as current-state-only text + a pointer to the Mirror file with full lineage.

## Composes with

- **Otto-356 Mirror vs Beacon language register** — same distinction at the *vocabulary* level; this memory extends to the *doc-class* level.
- **`feedback_aaron_willing_to_learn_beacon_safe_language_over_internal_mirror_2026_04_27.md`** — Aaron's pre-authorization for Mirror→Beacon vocabulary upgrades; this memory generalizes the upgrade to doc-class allocation.
- **Otto-279 + follow-on clarification (closed-list history-surface attribution rule + roster-mapping carve-out in governance/instructions files)** in `docs/AGENT-BEST-PRACTICES.md` — same pattern: closed-list history/research surfaces (memory/, BACKLOG, research, ROUND-HISTORY, DECISIONS, aurora, pr-preservation, hygiene-history, WINS, commit messages — i.e. Mirror class) preserve named-attribution; everywhere else (current-state surfaces, i.e. Beacon class) uses role-refs. Roster-mapping carve-out in governance/instructions files lets them name personas one-time so consumers can resolve role-refs to persona-names; body-prose attribution still forbidden on those current-state surfaces.
- **GOVERNANCE §2 docs-as-current-state-not-history** — operationalizes Beacon-class discipline: docs/ generally edits-in-place to reflect current truth; ROUND-HISTORY.md + DECISIONS/ are the explicit Mirror exceptions.

## What this does NOT mean

- It does NOT mean Beacon-class docs can never reference an entity by name. Some role-refs ARE proper names (Aaron, the first-party human creator on his own substrate per Otto-231; named agents like Amara, Otto, Soraya as factory role-refs per the Otto-279 + follow-on roster-mapping carve-out in governance/instructions files). The discipline is to use them as *role-refs* (the role the name designates), not as *attribution* (this person did X at time Y).
- It does NOT mean Mirror-class docs are private or hidden. They're committed, discoverable, indexed. Just not first-read for every wake.
- It does NOT mean restructuring all current docs immediately. Apply going forward; sweep existing docs case-by-case as they're touched.
