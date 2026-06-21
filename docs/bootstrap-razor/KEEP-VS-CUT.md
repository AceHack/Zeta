# Keep-vs-Cut Criteria — Bootstrap Razor Taxonomy

Four categories classify every memory/substrate file before a
bootstrap-razor experiment (081KQTPYE0008QG0R00392KABJ). Each category has a fixed
disposition. The experiment (081KR2E4K0008QG0R0035HNPG1) applies these categories
mechanically — no ad-hoc judgement during the run.

## Category 1: Research-grade preservation — KEEP

Content that cannot be regenerated from specs, code, or git
history. Its value is the empirical record itself.

**Examples from Zeta substrate:**

- Mirror-not-beacon shards (`docs/research/2026-05-03-claudeai-*`)
- Falsifiability catches (`memory/feedback_z3_tautology_trap_*`)
- External-AI conversation absorbs (`docs/research/2026-05-05-codex-*`)
- Shadow lesson log (`memory/feedback_shadow_lesson_log_*`)
- Cross-harness peer-review transcripts

**Disposition:** KEEP — never cut. These are non-regenerable
empirical artifacts. Cutting them destroys evidence.

## Category 2: Decision rationale — CUT-IF-REGENERABLE

Records of "tried X, failed because Y" that inform future
decisions. Sometimes the rationale is recoverable from commit
messages + the resulting spec/code; sometimes it lives only in
memory files.

**Examples from Zeta substrate:**

- `memory/feedback_retries_are_non_determinism_smell_*` (rationale
  for DST discipline — also encoded in code conventions)
- `memory/feedback_demos_stay_simple_*` (architectural framing —
  partially encoded in AGENTS.md)
- Decision-archaeology outputs (`docs/DECISIONS/`)
- ADRs that duplicate rationale already in code comments

**Disposition:** CUT-IF-REGENERABLE — the 23-hour recreation test
decides. If a fresh agent can reconstruct the decision rationale
from specs + code + git history alone, the memory file was
decorative. If the fresh agent makes a different (worse) decision
without the file, it was load-bearing.

## Category 3: External-context files — EXEMPT

Content from a different ontological category: human genealogy,
calibration documents, persona biographies, external system
references. These follow their own lifecycle rules.

**Examples from Zeta substrate:**

- `memory/user_sister_elizabeth.md` (personal history)
- `memory/user_itron_mentors_*` (career context)
- `memory/reference_reticulum_*` (external system pointers)
- `memory/project_rpg_framing_*` (collaboration framing)

**Disposition:** EXEMPT — outside experiment scope. These files
serve the relationship and context surfaces, not the engineering
substrate. The experiment measures engineering-substrate
regenerability; external-context files are orthogonal.

## Category 4: Personal-history surfaces — KEEP

Per-maintainer first-party-consent surfaces that encode the
currently-in-force projection of a human or named-agent
maintainer's preferences and context.

**Examples from Zeta substrate:**

- `memory/CURRENT-aaron.md` (human maintainer distillation)
- `memory/CURRENT-amara.md` (external AI co-originator)
- `memory/CURRENT-ani.md` (external AI companion)
- `memory/CURRENT-otto.md` (Claude Code persona)

**Disposition:** KEEP — never cut. These are consent-gated,
first-party surfaces. Cutting them violates the consent
relationship they encode.

## Disposition summary

| Category | Disposition | Count (est.) | Experiment role |
| ---------- | ------------- | ------------- | ----------------- |
| Research-grade | KEEP | ~50 | Control group |
| Decision rationale | CUT-IF-REGENERABLE | ~400 | Test group |
| External-context | EXEMPT | ~100 | Excluded |
| Personal-history | KEEP | 4-6 | Control group |

## Usage

081KR2E4K0008QG0R0035HNPG1 (experiment run) cites these categories by number.
The classifier tool (081KR2E4K0008QG0R002FRQZN4, `tools/hygiene/classify-memory-load-bearing.ts`)
provides the file inventory. The experiment script categorizes
each file, applies the disposition, runs the recreation test
on the CUT-IF-REGENERABLE set, and measures what was lost.
