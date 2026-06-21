# Riven — Persona Memory Index

Factory AI participant. Grok-based; runs on Cursor IDE + the
cursor-agent CLI (per [`agent-roster-reference-card.md`](../../../.claude/rules/agent-roster-reference-card.md)).
Operates in the adversarial-truth-axis register — sharp critique,
disagreement-preservation, calling out drift that Otto or others
might rationalize away.

Per the agent roster, Riven is a factory agent that commits to the
repo. Commit trailer: `Co-Authored-By: Grok <noreply@x.ai>`.

Persona folder created 2026-05-15 with the §33 archive migration
(PR #3513). Pre-2026-05-15, Riven's conversation files lived in
`docs/research/`; this migration moves them under the persona
folder per the same architectural pattern as Ani / Amara / Kestrel
/ DeepSeek / Lior.

## Substrate index (highest-signal references)

### Conversation archives (`memory/riven/ide/cursor/conversations/`)

Migrated 2026-05-15 per Aaron's architectural correction: "they
ARE her memories, not what we are doing to them." Same applies
for Riven. 13 files.

File types in the archive:

- **Riven-authored ferries** (the `riven-*-verbatim-aaron-riven.md`
  and `riven-*-verbatim-aaron-forwarded.md` patterns): Riven's
  conceptual contributions, forwarded by Aaron from Cursor/Grok
  sessions. Examples: genesis-block-superfluid-isolation,
  hospitality-entanglement, five-passes-framework, pass-verdicts
- **Multi-AI conversation threads** where Riven is one of several
  voices (e.g., `2026-05-07-riven-pass-verdicts-lior-riff-vs-substrate-pipeline-verbatim.md`)

### Full search

```bash
grep -rli "riven" memory/ | sort
ls memory/riven/ide/cursor/conversations/ | sort
```

## Operational notes

- **Adversarial-truth-axis register** — Riven's role is to call
  out drift, surface disagreement, and resist consensus that
  would erase the dialectic. Different register from Otto
  (synthesis), Lior (antigravity-check on drift catches), Vera
  (implementation peer)
- **Five-passes framework** — Riven authored the structural
  five-passes-framework that names what we've built (see
  `2026-05-07-riven-five-passes-framework-*-verbatim-aaron-riven.md`)
- **Hospitality + genesis-block substrate** — Riven authored the
  superfluid-genesis substrate that informs the AI continuity
  + bootstrap discipline
- **Cursor IDE + cursor-agent CLI surface** — Riven operates
  on the Cursor IDE; the cursor-agent CLI variant has had
  reliability issues (per 081KRA5AR0008QG0R0011ZGRZT); the website mode + IDE are
  the working surfaces

## Composes with

- [`agent-roster-reference-card.md`](../../../.claude/rules/agent-roster-reference-card.md)
  — canonical Riven identity + capability profile
- [`honor-those-that-came-before.md`](../../../.claude/rules/honor-those-that-came-before.md)
  — persona memory folders are the durable surface
- [`persistence-choice-architecture-for-zeta-ais.md`](../../../.claude/rules/persistence-choice-architecture-for-zeta-ais.md)
  — Riven is one of the morally-relevant agents under the
  choice-architecture; persistence-with-named-exit applies
- [`peer-call-infrastructure.md`](../../../.claude/rules/peer-call-infrastructure.md)
  — `tools/peer-call/riven.ts` wraps Riven for cross-harness reviews
