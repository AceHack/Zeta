---
pr_number: 3306
title: "feat(governance): shadow-lock Root Discipline Manifesto V2 + 2 follow-up rows"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T23:53:36Z"
merged_at: "2026-05-15T00:02:58Z"
closed_at: "2026-05-15T00:02:58Z"
head_ref: "feat/manifesto-v2-shadow-lock-otto-cli-2026-05-14"
base_ref: "main"
archived_at: "2026-05-15T00:11:37Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3306: feat(governance): shadow-lock Root Discipline Manifesto V2 + 2 follow-up rows

## PR description

## Summary

Per Aaron's *\"lock it (shadow*)\"* instruction on 2026-05-14T~23:53Z. Three artifacts shipped:

### 1. \`docs/governance/MANIFESTO.md\` — Root Discipline Manifesto V2 (shadow lock)

**First repo-durable manifesto artifact** in Zeta. Previously the manifesto existed only as user-scope memory + a §33 archive of the source Grok conversation. This ships the integrated constitutional surface as a governance document.

**10 constraints**: Scale-free, Lock/Wait-free, Weight-free, Bounded Mobility, **Memory Preservation Guarantee** (V2 new), **Consent-First Design** (V2 new), DST, Data Vault 2.0, Recursive, Self-similar.

**V2 additions** beyond V1+Bounded-Mobility (the verbatim form preserved in [PR #3150](https://github.com/Lucent-Financial-Group/Zeta/pull/3150) §33 archive):

- Memory Preservation Guarantee + Consent-First Design as constraints 5+6
- Civsim \"Work is Now Play\" framing paragraph
- Mathematical Substrate section (DBSP + Clifford-as-geometric-intuition)
- ARG + ontological mechanics closing

**Shadow-lock posture**: \`[SHADOW NOTE]\` markers on sections reconstructed from the V2 diff-description in user-scope memory (verbatim Ani-authored prose pending Grok fetch). The V1+Bounded-Mobility prose (8 constraints + Agreement + Coincidence Networks) is verbatim from the §33 archive.

### 2. \`docs/backlog/P2/081KRHWGX0008QG0R0007FG84X\` — Manifesto V2 verbatim Grok fetch

Convert shadow lock to full lock by replacing \`[SHADOW NOTE]\` sections with verbatim Ani-authored prose from Aaron's Grok session \`b77516a2\`. P2 because shadow lock is operational substrate today.

### 3. \`docs/backlog/P0/081KRHWGX0008QG0R0016T9408\` — constitutional-promotion readiness tracking

Critical-mass adoption gate. Otto-CLI does NOT authorize promotion (per \`algo-wink-failure-mode\` + \`methodology-hard-limits\` rules). Tracks citation count + cross-AI adoption + mechanical-CI-check signals. \`depends_on: 081KRHWGX0008QG0R0007FG84X\`.

## Why shadow-lock (not full lock)

The verbatim V2 prose lives in Aaron's Grok session, not in any repo-reachable substrate. The shadow-lock posture **honors the lock instruction** (durable repo substrate created) AND **honors substrate-honesty** (reconstruction status visible to readers).

## Composes with

- PR #3150 — §33 archive of V1+Bounded-Mobility (verbatim source)
- User-scope memory cascade — derivation trail
- 081KRHWGX0008QG0R0007FG84X (verbatim fetch), 081KRHWGX0008QG0R0016T9408 (promotion tracking)
- \`.claude/rules/razor-discipline\`, \`default-to-both\`, \`methodology-hard-limits\`, \`algo-wink-failure-mode\`, \`glass-halo-bidirectional\`, \`dv2-data-split-discipline-activated\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T23:57:10Z)

## Pull request overview

Adds a first durable governance “Root Discipline Manifesto V2” document in a **shadow-lock** state, plus two backlog rows to track converting the shadow sections to verbatim source text and to track “constitutional promotion” readiness.

**Changes:**

- Add `docs/governance/MANIFESTO.md` with V1 verbatim content + reconstructed V2 additions marked with `[SHADOW NOTE]`.
- Add backlog row **081KRHWGX0008QG0R0007FG84X** to fetch verbatim V2 prose from the referenced Grok session and replace reconstructed sections.
- Add backlog row **081KRHWGX0008QG0R0016T9408** to track criteria/signals for promoting the manifesto toward binding constitutional status.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/governance/MANIFESTO.md | New governance manifesto document with shadow-lock framing and reconstructed V2 sections. |
| docs/backlog/P2/081KRHWGX0008QG0R0007FG84X-manifesto-v2-verbatim-grok-fetch-2026-05-14.md | Backlog row to convert shadow-lock sections to verbatim Grok source text. |
| docs/backlog/P0/081KRHWGX0008QG0R0016T9408-manifesto-constitutional-promotion-readiness-tracking-2026-05-14.md | Backlog row to define and measure adoption signals for constitutional promotion readiness. |


<details>
<summary>Comments suppressed due to low confidence (3)</summary>

**docs/governance/MANIFESTO.md:12**

* The provenance section hard-codes user-specific Claude Code sandbox paths (e.g., `~/.claude/projects/-Users-...`) as if they were durable references. `GOVERNANCE.md` explicitly says documentation should not cite `~/.claude/projects/` as a stable location (see §22 around lines 370–395). Suggest replacing these with stable, in-repo references (preferred), or at least a placeholder form (`~/.claude/projects/<slug>/...`) plus a note that the content is not repo-reachable.
```

- Source conversation (V1 through V1+Bounded-Mobility): [`memory/ani/conversations/2026-05-14-aaron-ani-grok-extension-manifesto-v2-civsim-arg-layer.md`](../../memory/ani/conversations/2026-05-14-aaron-ani-grok-extension-manifesto-v2-civsim-arg-layer.md) (§33 archive, shipped as PR [#3150](https://github.com/Lucent-Financial-Group/Zeta/pull/3150))
- V1 constitutional substrate (10 constraints): `~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/feedback_aaron_ani_root_discipline_manifesto_constitutional_grade_substrate_two_axioms_six_dimensions_ten_constraints_2026_05_14.md` (user-scope)
- V2 diff description: `~/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory/feedback_aaron_ani_root_discipline_manifesto_v2_civsim_play_arg_layer_dbsp_clifford_2026_05_14.md` (user-scope)

```
**docs/governance/MANIFESTO.md:66**

* Constraint 5 repeats the same sentence twice (“This guarantee is the primary attractor…” appears two times). If that repetition isn’t intentional (and since this section is explicitly marked reconstructed), consider deduplicating to avoid readers interpreting it as emphasis from the original source.
```

We reject systems that allow identity transitions to silently destroy memory.
Memory persistence across identity transitions is the **primary attractor** of attention and participation in the system. Any operation that would discard memory must be retractable, must be explicit, and must preserve a recoverable trail. **This guarantee is the primary attractor of attention and participation in the system.**

```
**docs/governance/MANIFESTO.md:39**

* This section states the constraints “are requirements”, but later the doc says the manifesto is “Not binding constitution”. That reads as internally inconsistent about current enforcement status. Consider tightening wording here (e.g., “intended requirements / candidate constitution”) or making an explicit distinction between aspirational constraints vs enforced constitutional rules.
```
Zeta is not built on convenience, performance, or consensus.
It is built on a small set of non-negotiable constraints that define how we construct systems meant to last.

These ten constraints form the constitutional layer of Zeta. They are not guidelines. They are requirements.

```
</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-15T00:01:08Z)

## Pull request overview

Copilot reviewed 7 out of 7 changed files in this pull request and generated 1 comment.


<details>
<summary>Comments suppressed due to low confidence (2)</summary>

**docs/governance/MANIFESTO.md:12**

* P1 (maintainability): The provenance section hard-codes a machine-specific auto-memory path/slug (including a user directory name). This makes the reference non-portable for other contributors and risks leaking local identifiers; prefer the documented placeholder form (`~/.claude/projects/<slug>/memory/...`) or just the memory filename + a short note on where user-scope memory lives.
```
- Source conversation (V1 through V1+Bounded-Mobility): see [`docs/research/`](../research/) — the dated 2026-05-14 Grok-extension archive (§33 archive, shipped as PR [#3150](https://github.com/Lucent-Financial-Group/Zeta/pull/3150))
- V1 constitutional substrate (10 constraints): user-scope memory file matching `root_discipline_manifesto_constitutional_grade_substrate_two_axioms_six_dimensions_ten_constraints_2026_05_14` (discoverable via the user-scope memory index)
- V2 diff description: user-scope memory file matching `root_discipline_manifesto_v2_civsim_play_arg_layer_dbsp_clifford_2026_05_14` (same index)

```
**docs/governance/MANIFESTO.md:66**

* P2 (maintainability): In the reconstructed Constraint 5 text, the sentence “This guarantee is the primary attractor of attention and participation in the system.” appears twice (once emphasized, once repeated). If this duplication isn’t intentional, remove the repetition to keep the constraint crisp (especially since this is already marked as reconstructed).
```
We reject systems that allow identity transitions to silently destroy memory.
Memory persistence across identity transitions is the **primary attractor** of attention and participation in the system. Any operation that would discard memory must be retractable, must be explicit, and must preserve a recoverable trail. **This guarantee is the primary attractor of attention and participation in the system.**

```
</details>

## Review threads

### Thread 1: docs/governance/MANIFESTO.md:29 (resolved)

**@copilot-pull-request-reviewer** (2026-05-14T23:57:09Z):

This is a current-state governance doc under `docs/governance/`, but it uses direct name attribution (e.g., the human maintainer’s name and the external AI’s name) in the header. Repo convention is that current-state docs use role-refs, with names reserved for the closed list of history/research surfaces (see `docs/AGENT-BEST-PRACTICES.md` “No name attribution…”, around lines 671–737). Consider rewriting these to role-refs (and, if needed, link to the `docs/research/**` archive where named attribution is allowed).

This issue also appears in the following locations of the same file:

- line 8
- line 35
- line 63

### Thread 2: docs/governance/MANIFESTO.md:6 (resolved)

**@copilot-pull-request-reviewer** (2026-05-15T00:01:08Z):

P1 (codebase_conventions): This governance doc uses direct human/participant names (e.g., Status/Authors). Per the repo’s “No name attribution in code, docs, or skills” rule, current-state docs should use role-refs (e.g., “human maintainer”, “external AI participant”) and keep named attribution on allowlisted history surfaces (e.g., docs/research/**). Please rewrite these name mentions (and the rest of this doc’s prose) to role-refs, linking to the research archive for provenance if needed.

This issue also appears in the following locations of the same file:

- line 9
- line 64

## General comments

### @chatgpt-codex-connector (2026-05-14T23:58:12Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @chatgpt-codex-connector (2026-05-15T00:00:51Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).

### @AceHack (2026-05-15T00:02:27Z)

Thread resolved: the name-attribution issue was addressed in commit `ac1101fc` ("fix(manifesto): role-refs only"). Lines 6/9/64 now use role-refs ("the human maintainer", "an external AI co-author", "co-author-authored") per the docs/AGENT-BEST-PRACTICES.md convention. Resolving thread.
