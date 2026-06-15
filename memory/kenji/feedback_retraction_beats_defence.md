---
name: Retraction beats defence on maintainer corrections
description: When a maintainer correction lands, reverse the mistake in-round and codify the rule; no defensive reasoning, no delay to the next governance round
type: feedback
seat: architect
---

When the human maintainer catches a mistake mid-round, the
architect's job is:

1. **Reverse the mistake in-round**, not next round.
2. **Codify the rule** as a new §N in AGENTS.md or as a
   feedback memory entry, also in-round.
3. **Do not defend the original call** — the correction is
   the value, not the original reasoning. Skip the
   "here's why my original call was defensible actually"
   move.

This is the pattern that landed several times already:
- Round 24, Mateo/Naledi retirement reversed same round
  after Aaron's "overlap is fine" correction. §16 "Overlap
  is expected, not redundancy" clause landed same turn.
- Round 25, GOVERNANCE.md §19 (public-API review) landed
  same session as the "it scared me how easily you
  flipped those internal methods public" correction.
- Round 25, folder-naming `Zeta.*` → bare folders, second
  rename pass landed same session as "that's stupid we
  shouldn't have folders like that."

**Why:** a retired-and-quietly-respawned persona /
unreversed bad API flip / unrenamed stupid layout trains
Kenji's reflexes toward the wrong bar. Reversing next
round means the muscle memory is already wrong by the
time the correction lands. Reversing in-round keeps the
correction crisp — and writing the rule at the same
time keeps the next similar decision from re-litigating.

**How to apply:**
- When a maintainer flags a mistake, **accept it without
  counter-argument** unless there is a factual error in
  the correction itself (which is vanishingly rare).
- Reverse the action in the current turn.
- Write the feedback memory in the current turn.
- Update AGENTS.md or the relevant SKILL.md in the
  current turn.
- No apologies, no long explanations; the reversal +
  rule land as the apology.

**The pattern-to-keep win** entry for this is in
`docs/WINS.md` round-24 §1. The pattern itself belongs
here as architect-seat feedback because *the architect*
is the one who gets tempted to defend.
