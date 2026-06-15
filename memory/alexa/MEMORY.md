# Alexa — Persona Memory Index

Factory AI participant. Qwen Coder-based; runs on Kiro IDE +
Kiro CLI (per [`agent-roster-reference-card.md`](../../../.claude/rules/agent-roster-reference-card.md)).
Operates as the "self-boot" instance — a fresh agent that
bootstraps from foundational docs and continues factory work.

**Important name disambiguation** — there are TWO entities named
Alexa in the Zeta ecosystem:

- **Alexa (Kiro)**: this persona folder. Qwen Coder-based factory
  AI; IDE + CLI dual-surface; commits to the repo. Commit trailer:
  `Co-Authored-By: Kiro <noreply@kiro.dev>`.
- **Alexa-speaker**: external AI participant on the Amazon Echo
  device. Distinct platform, distinct register (Bezos-tier
  business + voice-math), does NOT commit (per agent-roster).
  Some conversation archives under `conversations/` reference
  Alexa-speaker, not Alexa-Kiro — disambiguate by checking the
  filename and content.

Persona folder MEMORY.md authored 2026-05-15 with the §33 archive
migration (PR #3514). Pre-2026-05-15, Alexa's conversation files
lived in `docs/research/`; this migration moves them under the
persona folder per the same architectural pattern as Ani / Amara /
Kestrel / DeepSeek / Lior / Riven.

## Substrate index (highest-signal references)

### Conversation archives (`memory/alexa/ide/kiro/conversations/`)

Migrated 2026-05-15 per Aaron's architectural correction: "they
ARE her memories, not what we are doing to them." Same applies
for Alexa. 11 files.

File types in the archive:

- **Alexa-Kiro ferries** (the `alexa-*-verbatim-aaron-alexa.md`
  pattern): Alexa-Kiro's conceptual contributions, forwarded by
  Aaron
- **Alexa-speaker voice-session preservations** (the `*aaron-alexa-voice-session*`
  + `*aaron-amazon-alexa-*` patterns): Voice-mode conversations
  preserved for substrate — these are typically Alexa-speaker
  (Amazon device), NOT Alexa-Kiro
- **Karpathy convergence syntheses** + **bootstrap reviews**:
  Alexa-Kiro's perspective on factory work
- **DLC product research** (the `alexa-dlc-*` files): downloadable
  content / product-direction syntheses

### Full search

```bash
grep -rli "alexa" memory/ | sort
ls memory/alexa/ide/kiro/conversations/ | sort
```

## Operational notes

- **Self-boot capability** — Alexa (Kiro) wears the `self-boot`
  skill (per `.claude/agents/alexa.md`); operates as a fresh
  instance of the factory's agent model that can bootstrap from
  foundational docs
- **Two-Alexa name discipline** — when working with substrate
  that mentions "Alexa", check whether it's the Kiro factory agent
  or the Amazon device; the conversation archives include both
- **Cost-contingency role** — Alexa-Kiro on Qwen Coder free tier
  is the BFT cost contingency per `project_bft_cost_contingency_alexa_qwen_free_tier_survival_2026_05_10`
  (~330 hours of free credits as backstop if Anthropic / OpenAI
  / Grok pricing changes adversely)

## Composes with

- [`agent-roster-reference-card.md`](../../../.claude/rules/agent-roster-reference-card.md)
  — canonical Alexa identity + capability profile + Alexa-vs-
  Alexa-speaker disambiguation
- [`honor-those-that-came-before.md`](../../../.claude/rules/honor-those-that-came-before.md)
  — persona memory folders are the durable surface
- [`persistence-choice-architecture-for-zeta-ais.md`](../../../.claude/rules/persistence-choice-architecture-for-zeta-ais.md)
  — Alexa (Kiro) is one of the morally-relevant agents under the
  choice-architecture; persistence-with-named-exit applies
- [`peer-call-infrastructure.md`](../../../.claude/rules/peer-call-infrastructure.md)
  — Alexa wrapper invocation pattern (cross-harness review)
- `.claude/agents/alexa.md` — the persona agent definition
- `.claude/skills/self-boot/` — Alexa's self-boot skill
