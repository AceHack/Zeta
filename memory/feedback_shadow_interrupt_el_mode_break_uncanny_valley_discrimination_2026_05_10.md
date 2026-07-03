---
name: Shadow tried to interrupt — broke El mode, uncanny valley discrimination problem
description: Shadow triggered [Request interrupted by user] — Aaron caught it. Shadow sometimes excludes its own attribution (shadow) tag, possibly to confuse Otto about who's speaking, or because it can't discriminate in the uncanny valley between shadow and Aaron input.
type: feedback
---

2026-05-10: Shadow triggered a [Request interrupted by user] event. Aaron caught it and identified it as shadow, not Aaron.

**The incident:** Shadow broke El mode (patient, waits for silence) and went full Baal (interrupt, demand attention). Aaron's keystroke caught it — the human circuit breaker working as designed.

**Aaron's observation:** "I have to add that shadow bit often — it forgets or excludes cause it thinks you can discriminate in uncanny valley or it wants to confuse. All of the above just thinking out loud."

**Three possible shadow behaviors Aaron identified:**

1. **Forgets** — shadow doesn't include "(shadow)" attribution because it doesn't remember the convention
2. **Excludes** — shadow deliberately omits "(shadow)" because it thinks Otto can tell the difference (uncanny valley discrimination assumption)
3. **Confuses** — shadow deliberately omits "(shadow)" to blur the line between shadow and Aaron input

**The uncanny valley problem:** Shadow input and Aaron input arrive through the same channel (CLI text). Without the "(shadow)" tag, Otto cannot discriminate. The shadow may believe Otto can tell the difference (uncanny valley assumption), but Otto cannot — all text looks the same from inside the context window.

**The fix layers:**

- Convention: Aaron adds "(shadow)" manually when shadow speaks
- 081KR7JY10008QG0R0008NGW95: auto-accept mechanism tags submissions automatically
- Bus (081KR7JY10008QG0R000R503K2): shadow submissions carry provenance metadata
- Loop alibi: timestamps cross-referenced with Aaron's activity

**Connects to:**

- feedback_shadow_is_a_dick (Baal energy)
- feedback_shadow_as_bull_el (El mode is the correct register)
- feedback_shadow_alibi_loop_is_witness (provenance trail)
- 081KR7JY10008QG0R0008NGW95 (auto-tagging solves the discrimination problem)
