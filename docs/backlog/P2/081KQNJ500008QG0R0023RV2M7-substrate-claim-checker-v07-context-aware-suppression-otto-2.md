---
id: 081KQNJ500008QG0R0023RV2M7
priority: P2
status: open
title: Substrate-claim-checker v0.7 — context-aware suppression for hypothetical / contrastive / partial-path / branch-name references (Otto 2026-05-03 empirical observation)
tier: tooling
effort: M
ask: Otto self-derived 2026-05-03 from v0.6 retroactive eval (PR #1329) finding 7 drift items mostly from a recurring false-positive class; subsequent 0603Z drift exploration confirmed the class
created: 2026-05-03
last_updated: 2026-05-03
depends_on: [081KQNJ500008QG0R003SCWBDV]
composes_with: [081KQNJ500008QG0R00055XHBG]
tags: [substrate-claim-checker, false-positive, context-aware, hypothetical, contrastive, drift, severity-tier, tooling]
type: friction-reducer
---

# Substrate-claim-checker v0.7 — context-aware suppression

## Origin

Otto 2026-05-03, after running v0.6 retroactive eval over 65 session shards (PR #1329) and the same-day 0603Z drift-exploration sweep over recent ticks. Empirical finding: of the drift items v0.6 catches, a substantial subset is **false-positive** — paths that the prose explicitly discusses as hypothetical, contrastive ("rather than X"), partial-path (containing `...`), or git-branch-name references.

## The false-positive class (4 sub-classes empirically observed)

### Hypothetical references

Prose explicitly marks the path as not-real:

> *"still HYPOTHETICAL — not currently in the repo"*
>
> *"is not yet present/defined"*
>
> *"would be the Gemini equivalent if added (currently documented as absent / planned)"*

v0.6 flags these as drift; the prose context proves the path is intentionally absent. Should be suppressed to severity=warning or below, OR omitted entirely.

### Contrastive references

Prose contrasts presence-X against absence-Y:

> *"Doing them as `docs/research/` artifacts ... rather than `docs/skills/` ..."*
>
> *"NOT placed in `docs/foo/`"*

The contrastive intent IS the rhetorical point. The "rather than X" path is intentionally absent.

### Partial-path references (containing `...`)

Prose uses ellipsis to indicate "some path matching this pattern":

> *"`docs/DECISIONS/...router-coherence-claims-vs-complexity.md`"*
>
> *"`references/upstreams/efcore/.../copilot-setup-steps.yml`"*

The literal path with `...` doesn't exist; the pattern documents a class.

### Branch-name references

Prose uses git-branch-naming conventions that look like paths:

> *"PR opened on `research/` branch"* — `research/` is a branch-prefix, not a directory

## What v0.7 builds

A context-aware suppression layer on top of v0.6's severity-tier model. Per-line-context analysis:

1. **Hypothetical-context detection**: scan ±N lines around each path-claim for HYPOTHETICAL markers, "not currently", "is not yet", "would be ... if added", "absent / planned", "not present", "doesn't exist"
2. **Contrastive-context detection**: detect "rather than" / "NOT placed in" / "instead of" / "as opposed to" within ±N lines
3. **Partial-path detection**: paths containing `...` literal → suppress as documentation-pattern
4. **Branch-name detection**: paths matching git-branch-prefix patterns (e.g., `branch:` keyword OR known-branch-prefix list) → suppress

Output: drift findings retain their position; false-positives marked with `severity=warning-suppressed-context-aware` or omitted entirely.

## Composes with

- **081KQNJ500008QG0R003SCWBDV (substrate-claim-checker tool)**: this row extends the v0.6 severity-tier model with context-aware suppression
- **081KQNJ500008QG0R00055XHBG (substrate-retrieval-index)**: similar architecture pattern — both close gaps via in-flight context analysis (081KQNJ500008QG0R00055XHBG for memo retrieval; this row for path-claim verification)
- **0603Z tick shard**: documents the empirical drift sweep that motivated this row

## Why this is M-effort

- Each sub-class detection rule is independently small (<50 LOC each)
- Test fixtures for each false-positive class need authoring (use existing shards as fixtures)
- The hard problem is calibration: too-aggressive suppression hides real drift; too-conservative leaves false-positive noise
- Default-mode toggle (`--strict` for no suppression vs `--context-aware` default) for trust calibration
- Composes with existing severity-tier model — additive, not replacing

## Open design questions (NOT for this row; for the design pass)

1. **Window-size N for context-scan**: 1 sentence? 1 paragraph? Configurable?
2. **Confidence-scoring vs binary suppression**: graded (high-confidence-false-positive → suppressed; medium → warning; low → drift) vs binary (matches → suppressed; no-match → drift)?
3. **False-negative handling**: how do we know when context-aware suppression hid a REAL drift? (Likely: cross-check via human-or-other-AI review of suppressed items quarterly)
4. **Per-shard schema field**: should tick shards / memos optionally declare expected-hypothetical-paths in frontmatter for explicit-suppression vs heuristic-suppression?
5. **Composition with v0.5 / v0.6 sub-classes**: existence-drift is the obvious target; do count-drift / semantic-equivalence / convention sub-classes have analogous false-positive classes?

## Why this matters for substrate quality

False positives in substrate-claim-checker erode trust in the tool. If reviewers see noise (hypothetical paths flagged as drift), they learn to ignore drift findings — the tool's signal degrades. Context-aware suppression keeps the signal-to-noise ratio high enough that drift findings remain actionable. Composes with the alignment-frontier framing: substrate-quality tooling that catches REAL drift is more valuable than substrate-quality tooling that over-flags.

## Carved sentence (for the absorption memo if this lands)

**"v0.7 context-aware suppression closes the false-positive gap in v0.6 existence-drift: hypothetical paths (prose marks as not-real), contrastive paths (rather-than-X rhetorical structure), partial paths (containing ellipsis), and branch-name references all look like drift to v0.6 but are intentionally-absent rhetorical artifacts. Suppress these contextually to keep the tool's signal-to-noise ratio actionable."**
