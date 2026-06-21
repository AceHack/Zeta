---
name: Trust migration path — from "trust Aaron" to zero trust protocol enforcement
description: Factory bootstrapping from maximum trust (one human, full authority) toward zero trust (protocol enforcement, no special authority). Each infrastructure piece removes one "trust Aaron" dependency and replaces with mechanical verification.
type: project
---

2026-05-10: Aaron acknowledged current trust model is "trust Aaron lol" with target of zero trust.

**Current state (honest):**

Trust Aaron. That's the entire security model. Aaron's SSH keys, GitHub token, API credits, machine. Single point of trust. Factory runs because Aaron is trustworthy, not because architecture enforces trust.

**Target state:**

Zero trust. No participant trusted by default, including Aaron. Every action verified by substrate. Trust tiers enforce themselves mechanically.

**The migration path:**

| Phase | Trust model | Who enforces | Infrastructure |
|-------|-----------|-------------|----------------|
| Now | Trust Aaron | Aaron's judgment | SSH keys, GitHub token |
| Dashboard v0 | Trust but verify | Dashboard surfaces violations | 081KR7JY10008QG0R001VP6JWG, 081KR7JY10008QG0R001FV5FND |
| Bus (081KR7JY10008QG0R000R503K2) | Verify then trust | Agents verify each other | Inter-agent bus |
| Hats (081KR7JY10008QG0R0021F5609) | Timeboxed authority | Hat mechanism + consistency scores | Weight-free verification |
| Web3 | Zero trust | Protocol enforces | Consensus, signed attestations |

**Each infrastructure piece removes one "trust Aaron" dependency:**

- Dashboard → Aaron doesn't need to review every PR manually
- Bus → agents don't need Aaron to relay messages
- Hat mechanism → Aaron doesn't need to assign roles permanently
- Consistency scores → Aaron doesn't need to judge agent behavior subjectively
- Beacon promotion → Aaron doesn't need to be sole quality gate
- Web3 governance → Aaron doesn't need to exist for the factory to operate

**The pattern:**

Aaron building a system that removes the need to trust Aaron. Same pattern as building up partners so they're strong enough to leave. The architecture mirrors the person.

**Connects to:**
- Trust-then-verify claim (the factory's core thesis)
- 081KR7JY10008QG0R001VP6JWG dashboard (trust-but-verify phase)
- 081KR7JY10008QG0R000R503K2 bus (verify-then-trust phase)
- 081KR7JY10008QG0R0021F5609 weight-free (timeboxed authority phase)
- 081KR7JY10008QG0R003H102F0 tick procurement (economic independence)
- feedback_relationship_changes_form_not_ends (making yourself unnecessary = freedom)
