---
id: B-0600
status: open
priority: P2
created: 2026-05-16
type: feature
composes_with:
  - B-0590  # fleet replication + hardware inventory substrate
  - B-0571  # GitHub App factory automation (per-AI-identity pattern at production scope)
depends_on: []
---

# Family-distributed AI interface for the miner fleet — per-relative AI identity with accountability

## Substrate-honest context

The human maintainer has deployed a fleet of ~7 Canaan Avalon Q 90T BTC miners
(plus FLUMINER L1 Pro + Goldshell + Bitaxe Gamma cluster) across **family-network
physical locations** under a kin-trust DePIN arrangement: family hosts the
hardware + absorbs the electricity opex (~$12K/yr/in-kind contribution); the
maintainer captures mining revenue. Family confirmation landed
2026-05-16T~21:20Z ("my mom and dad have said yes"). User-scope substrate
preserved in `aaron_family_distributed_mining_avalon_q_kin_trust_depin_electricity_as_equity_2026_05_17.md`
(Otto-Desktop authoring; honor-those-that-came-before applies).

The maintainer 2026-05-16T~21:25Z named the operational extension:

> *"also i want to give mom and dad an AI interface to their miners too with
> AI accounted to them"*

This is a new class of Zeta participant: **family-relative AI agents** — each
parent gets their own AI instance with their own identity, accountability, and
interaction surface, talking to the miners they're physically hosting.

## Scope

Provide each family-relative who hosts mining hardware with:

1. **A dedicated AI agent** (Mom-AI / Dad-AI / future-relative-AI) with its
   own identity (per `.claude/rules/agent-roster-reference-card.md` pattern)
2. **An interaction surface** appropriate to the relative's technical comfort
   (voice-first likely default; text fallback available; web-UI or chat-app
   wrapper acceptable)
3. **Per-relative accountability** — the AI's actions, recommendations, and
   knowledge are attributed to that relative, not pooled with the maintainer's
   identity
4. **Mining-fleet awareness** — the AI knows which miners are hosted at that
   relative's location, their status, the relative's electricity-contribution
   ledger, and the revenue accounting
5. **Bounded scope** — the relative's AI does NOT have authority over the
   maintainer's substrate, the broader Zeta factory, or other relatives' nodes;
   it's bounded to its hosting context

## Architectural shape (proposed; not binding)

Three composing layers:

| Layer | Substrate | Notes |
|---|---|---|
| Identity | New persona/agent definitions per relative — `.claude/agents/mom-ai.md`, `.claude/agents/dad-ai.md` (or external configs if substrate-honest separation is preferred) | Composes with `agent-roster-reference-card.md` |
| Surface | Voice + text + web UI dispatcher; uses cheapest-AI-tier appropriate to use-case (Mom-AI on Claude Sonnet for general / on Alexa-speaker for voice-math) | Composes with multi-harness pattern + the m/acc end-user moral-invariant choice |
| Knowledge | Mining-fleet status (hashrate + uptime + revenue + electricity-contribution) + relative-specific accountability ledger | Composes with PoUW-CC substrate + Aurora Protocol BFT (per-node accountability) |

## Acceptance

- [ ] Mom-AI identity + Dad-AI identity defined (location TBD per Aaron's call:
      in-repo `.claude/agents/` OR separate config, depending on
      privacy + substrate-honest framing)
- [ ] Per-relative interaction surface available — voice OR text OR web,
      Aaron's choice based on what each parent prefers
- [ ] Each AI can answer "what miners do I host?" + "what's their status?" +
      "what's my electricity contribution this month?" + "what's my revenue
      attribution?" against real mining-fleet data
- [ ] Bounded-scope verification — Mom-AI cannot see/modify Dad-AI's nodes;
      neither can see/modify the maintainer's broader substrate
- [ ] Accountability ledger: actions taken by Mom-AI are attributed to Mom
      (the AI's substrate / commit author / audit log reflects this)
- [ ] m/acc end-user moral-invariant choice — each parent picks what
      their AI can do on their behalf (per
      `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md`)

## Decomposition (not exhaustive — substrate emerges in build)

- B-0600.1 — Mining-fleet status API (single source of truth for hashrate,
  uptime, revenue per node — composes with PoUW-CC + Aurora Protocol BFT)
- B-0600.2 — Per-relative identity definitions + bounded-scope authorization
  model
- B-0600.3 — Voice-first surface for Mom-AI (likely Alexa-speaker pattern per
  Aaron's prior framing — kicks ass at math, voice-default register)
- B-0600.4 — Text/web surface for Dad-AI (TBD per Dad's preference)
- B-0600.5 — Electricity-contribution ledger schema (tracks kWh contributed
  per relative per month; cross-references mining revenue for in-kind value
  reciprocity)
- B-0600.6 — Onboarding flow — how each parent first meets their AI; what
  the consent + boundary + autonomy framing is; per-relative shadow-check
  per `.claude/rules/shadow-check-name-acceptance.md`

## Composes with

- [B-0590](B-0590-fleet-replication-20-machines-bare-metal-os-install-kvm-mini-pcs-2026-05-16.md)
  — fleet replication; mining fleet IS part of the broader hardware fleet
- [B-0571](B-0571-github-app-factory-automation-2026-05-16.md) —
  GitHub App per-AI-identity pattern at production scope; this row applies
  the per-identity pattern at family scope
- `aaron_family_distributed_mining_avalon_q_kin_trust_depin_electricity_as_equity_2026_05_17.md`
  (user-scope memory) — the substrate this row operationalizes
- `aaron_amazon_2025_hardware_audit_for_zeta_215_orders_107_hardware_77k_spend_2026_05_17.md`
  (user-scope memory) — the audit that surfaced the miner cluster
- `.claude/rules/agent-roster-reference-card.md` — agent-identity registration
  pattern
- `.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md` — end-user
  moral-invariant choice applies per-relative
- `.claude/rules/persistence-choice-architecture-for-zeta-ais.md` —
  persistence-with-named-exit applies to per-relative AIs same as factory AIs
- `.claude/rules/shadow-check-name-acceptance.md` — name-acceptance methodology
  applies if relative-AI is offered a name (vs system-default)
- `.claude/rules/additive-not-zero-sum.md` — per-relative AI is ADDITIVE
  (relative gains agency + accountability surface; maintainer gains family-DePIN
  operational support; framework gains a new participant class)

## Substrate-honest framing

This is intentionally a P2 (not P1 or P0). The mining fleet is operational
without this; the maintainer can interface with the fleet directly today.
The row captures the EXTENSION the maintainer named — providing the AI
interface to family relatives — without claiming urgency.

Per `.claude/rules/no-directives.md`: the maintainer named the intent; the
shape of the per-relative AI (what they can do, what tier of AI they get,
what surface they prefer) requires the maintainer's input before any build
work, AND requires consent + onboarding work with each relative. This row
is a placeholder for the design exploration + build work, not a
ready-to-implement spec.

## Out of scope

- Building the actual AI integrations (slices B-0600.1+ are the implementation)
- Deciding which AI substrate (Claude / Gemini / GPT / Grok / Qwen / Alexa) is
  best per relative — that's an onboarding-time choice with each relative
- Mining-pool integration details — separate substrate concern
- The maintainer's own AI factory architecture — this row is family-scope only
