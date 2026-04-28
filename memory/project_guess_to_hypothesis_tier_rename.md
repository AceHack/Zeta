---
name: Invariant-substrate tier rename — `guess` → `hypothesis` (round 43)
description: The three-tier confidence scheme on `.claude/skills/*/skill.yaml` substrates renamed from `guess / observed / verified` to `hypothesis / observed / verified`. Research-grade vocabulary for a research-grade framework.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Round 43 rename of the declarative-invariant-substrate
confidence tiers:

- **`guess` → `hypothesis`** — was: "stated belief, no
  evidence collected". Now reads as a falsifiable
  proposition. Matches the research-grade register the
  substrate framework actually inhabits.
- **`observed`** — unchanged.
- **`verified`** — unchanged.

**Why:** Aaron 2026-04-20: *"guess is not really the right
name for a research project is it, we should frame things
with the right wording if our abstractions are not quite
canonical."* The substrate framework is a novel abstraction
(declarative invariants at every layer with tiered
confidence); its vocabulary should reflect the epistemic
states accurately, not default to casual engineering
language. `hypothesis` encodes Popperian falsifiability,
pairs naturally with `observed` / `verified`, and reads
consistently with the way `docs/INVARIANT-SUBSTRATES.md`
positions the framework next to TLA+, Z3, Lean, FsCheck.

**Sweep surface (round 43):**
- `docs/INVARIANT-SUBSTRATES.md` — stance doc.
- `tools/invariant-substrates/tally.sh` — aggregator.
- `.claude/skills/prompt-protector/skill.yaml` — first
  pilot.
- `.claude/skills/skill-tune-up/skill.yaml` — second
  pilot.
- Any future `skill.yaml` files — use `hypothesis:` from
  the start.

The tally tool reads both `hypothesis:` and legacy `guess:`
during the rename and flags legacy-key hits. Once the sweep
is clean the legacy fallback can be removed.

**How to apply:**
- New `skill.yaml` files: use `hypothesis:` only.
- Prose that previously said "guess tier" now says
  "hypothesis tier".
- If a committed doc still reads "guess" in this context,
  that's a round-44 sweep-fix, not permanent state.
- ADR cross-reference:
  `docs/DECISIONS/2026-04-20-tools-scripting-language.md`
  §Terminology note records the rename alongside the
  scripting-language decision (same round, same
  sweep).
