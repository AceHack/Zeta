# PR #428 drain log — drain follow-up to #126: Gemini capability map xref truth-update

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/428>
Branch: `drain/126-followup-gemini-xref`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: targeted Codex post-merge finding on parent #126
Grok CLI capability-map.
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of the cross-capability-
map xref truth-update.

This PR is the **post-merge cascade** to #126 (Round 44 auto-loop-28:
Grok CLI capability map). The parent PR introduced a Grok CLI
capability map alongside the existing Codex CLI capability map
(`docs/research/openai-codex-cli-capability-map.md`) and the OpenAI
Codex / Claude Code parity research. The cascade caught a Gemini-
side cross-reference that had drifted between the parent's authoring
and merge.

---

## Threads

### Thread 1 — Gemini capability map xref truth-update

- Reviewer: chatgpt-codex-connector
- Severity: P2 (cross-capability-map consistency)
- Finding: parent #126 cited the Gemini capability map at a stale
  state; cross-references between the multi-CLI capability maps
  (Codex / Grok / Gemini / Claude Code) need uniform truth against
  current main. The Gemini capability-map referenced state had
  shifted after parent's authoring window.
- Outcome: **FIX** — cross-reference text updated to match current
  Gemini capability map state. Same class as the parity-matrix
  cross-references on #231 (Codex CLI parity matrix vs
  `docs/research/openai-codex-cli-capability-map.md`); the
  multi-CLI capability-map family forms a related-document cluster
  where cross-references need joint maintenance.

---

## Pattern observations (Otto-250 training-signal class)

1. **Cross-capability-map xref consistency is its own class.**
   The repo has a growing family of CLI capability maps:
   - `docs/research/openai-codex-cli-capability-map.md` (Codex —
     in-tree)
   - `docs/research/codex-cli-first-class-2026-04-23.md` (Codex
     deeper context — pending merge of PR #231 at the time of
     this drain-log; will be in-tree once that PR lands)
   - Grok CLI capability map (#126 parent)
   - Gemini capability map (this xref's target)
   - Claude Code capability surfaces (CLAUDE.md / AGENTS.md)
   When one capability map evolves, the others' cross-references
   drift. Fix template: when authoring/editing one capability map,
   sweep the related-document cluster for stale xrefs. Future
   tooling candidate: doc-lint that maintains a manifest of
   related-document clusters and warns on edit-without-sweep.

2. **Multi-CLI capability-map family is its own substrate
   pattern.** Worth documenting in the related `_patterns.md`
   index: when multiple capability maps cover overlapping but
   distinct CLIs, they form a cluster that benefits from shared
   structure (status taxonomy, parity-matrix shape, score-summary
   conventions) and joint cross-reference maintenance.

3. **Targeted single-finding follow-ups are the cheapest cascade
   shape.** #428 was 1 finding; one commit; one merge gate. When
   the post-merge reviewer-cascade is small + targeted, the
   follow-up cost is minimal. The cascade pattern's amortized cost
   is dominated by the few-thread-cascades, not by the
   1-thread-cascades.

## Final resolution

All threads resolved at SHA `dfe1671` (this PR's only commit).
PR auto-merge SQUASH armed; CI cleared; merged to main.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
