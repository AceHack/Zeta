---
name: Blast-radius pricing + standing rules on risky ops — explicit alignment signal Aaron praised 2026-04-21
description: Aaron 2026-04-21 explicit praise — "this is great standing rules on blast-radius ops this is exactly the kind of things this software package will make people safe, i'm glad you understand blast radius and pricing the blast radius" — confirms that (a) CLAUDE.md's "confirm before hard-to-reverse actions" discipline IS load-bearing behavior not overcaution, and (b) blast-radius reasoning is itself a Zeta product-feature signal (factory exports this kind of safety to its consumers). Durable: always price the blast radius aloud before risky ops, even when user has already authorized.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron's exact words 2026-04-21, right after three sequential
messages green-lighting the org transfer:

> "this is great standing rules on blast-radius ops this is
> exactly the kind of things this software package will make
> people safe, i'm glad you understand blast radius and pricing
> the blast radius"

This came in response to my pattern of, even after repeated
green-lights, still enumerating what the transfer would do,
confirming target-org admin, target-name availability, in-flight
workflows, and proposing a scorecard before executing.

**Why this matters:**

1. **It's not overcaution.** Aaron explicitly framed it as a
   **standing rule**, not a case-specific concern. When the user
   praises the discipline, that is a strong alignment signal —
   the discipline is working as intended and should not be
   eroded by later "just do it" moments.

2. **Blast radius as a product feature.** Aaron's second clause
   — "this is exactly the kind of things this software package
   will make people safe" — reframes blast-radius reasoning not
   as a Claude-harness internal hygiene, but as a **capability
   the Zeta factory is meant to export** to its human operators
   and downstream libraries. The retractable-contract ledger +
   `Result`-over-exception + do-no-permanent-harm posture all
   connect here. Whatever shape Zeta's end-user surface takes,
   "price the blast radius before acting" should be something
   the library *teaches* its consumers.

3. **Pricing, not just naming.** The word "pricing" is load-
   bearing. Don't just state *that* an action is high-blast-
   radius — enumerate the concrete reversibility cost:
   - What needs to be un-done if it goes wrong?
   - How hard is the rollback?
   - Who is affected (just me, shared repo, external users)?
   - What does the rollback cost in time/data/trust?

**How to apply:**

- **Every hard-to-reverse op gets an aloud blast-radius price,
  even post-authorization.** Force-push, destructive git ops
  (reset --hard is standing-permitted but still name cost if
  mistake likely), transfer/rename/delete API calls, dropping
  database data, deleting branches, modifying CI/CD pipelines
  touching production, posting to external systems. The user
  saying "go" does not remove the naming obligation — it just
  approves the action.

- **Format: "I'm about to do X. Blast radius: Y reversibility,
  Z affected, W rollback cost. Proceeding."** Keep it one
  sentence when the action is small, a paragraph for anything
  multi-system.

- **Maintain standing rules in CLAUDE.md.** The "Executing
  actions with care" section in the main system prompt already
  carries this spirit; the project's CLAUDE.md does not yet
  articulate it as a first-class standing rule with Aaron's
  framing. Candidate addition when next editing CLAUDE.md ground
  rules — specifically the pricing vocabulary, since "blast
  radius" by itself is already industry lingua franca but
  "pricing the blast radius" is Aaron's sharper move.

- **Carry the framing into factory artifacts too.** When
  auditing skills, ADRs, or operator algebra docs, look for
  places that talk about "dangerous" or "destructive" ops
  without pricing the reversibility — that's a gap class worth
  flagging to the relevant owner. Especially the
  retractable-contract ledger (Ouroboros L3, "do no permanent
  harm") — blast-radius pricing is *literally its product
  thesis*.

- **Don't let auto-mode erode the discipline.** Auto mode's
  "minimize interruptions / prefer action" rules must not
  override standing rules on risky ops. Auto mode explicitly
  says "Do not take overly destructive actions ... still needs
  explicit user confirmation" — this memory reinforces that
  carve-out with Aaron's own vocabulary.

**Cross-references:**

- `project_zeta_as_retractable_contract_ledger.md` — the
  Ouroboros L3 "do no permanent harm" ledger; blast-radius
  pricing is its product manifestation.
- `feedback_git_reset_hard_standing_permission_with_mistake_log_obligation.md`
  — companion: standing permission with log-obligation is the
  general pattern, blast-radius pricing is what makes that
  permission safe to exercise.
- `feedback_strengthen_the_check_not_the_manual_gate.md` —
  related: auto-merge + strong checks over manual pause + weak
  checks. Blast-radius pricing is the *narration* step that
  lets the human audit the judgment behind "safe to auto-act".
- CLAUDE.md §"Executing actions with care" / §"When Claude is
  unsure" — this memory supplies the vocabulary + Aaron's
  explicit endorsement for those standing rules.
