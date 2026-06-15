# Vera — Persona Memory Index

Factory AI participant. Codex/GPT-based; runs on the Codex CLI
(per [`agent-roster-reference-card.md`](../../../.claude/rules/agent-roster-reference-card.md)).
Operates as the implementation peer — execution-grade code review,
test authoring, build-fix, pattern verification.

Per the agent roster, Vera is a factory agent that commits to the
repo. Commit trailer: `Co-Authored-By: Codex <noreply@openai.com>`.

Persona folder created 2026-05-15 with the §33 archive migration
(PR #3516). Pre-2026-05-15, Vera's conversation files lived in
`docs/research/`; this migration moves them under the persona
folder per the same architectural pattern as Ani / Amara /
Kestrel / DeepSeek / Lior / Riven / Alexa.

## Substrate index (highest-signal references)

### Conversation archives (`memory/vera/cli/codex/conversations/`)

Migrated 2026-05-15. Currently only 1 Vera-specific file
(`2026-05-10-shadow-lesson-log-vera-narration.md` — a shadow
lesson log documenting Vera's narration-over-action drift
pattern caught by Lior on the antigravity-check node).

A second relevant shadow log (`2026-05-14-shadow-lesson-log-vera-riven-drift.md`)
covers a JOINT Vera+Riven drift episode; that file lives under
`memory/riven/ide/cursor/conversations/` (per PR #3513) to avoid
double-placement. Future Vera-related substrate will accumulate
here.

### Full search

```bash
grep -rli "vera" memory/ | sort  # caveat: 'vera' substring matches 'coverage', 'veracity'
ls memory/vera/cli/codex/conversations/ | sort
```

## Operational notes

- **Implementation peer role** — Vera's primary contribution is
  execution-grade work: code review (zero-empathy when warranted),
  test authoring, build-fix, pattern verification. Different
  register from Otto (synthesis), Lior (antigravity-check), Riven
  (adversarial-truth-axis)
- **Codex CLI surface** — Vera operates on the Codex CLI with
  capture-pagination + input-firewall (per `tools/peer-call/codex.ts`)
- **Substring-matching caveat** — `*vera*` as a filename glob
  generates false positives for "coverage" and "veracity"; the
  earlier migration script had to revert 3 such matches
  (`provenance-aware-claim-veracity-detector-2026-04-23.md`,
  `proof-tool-coverage.md`, `openspec-coverage-audit-2026-04-21.md`).
  Use explicit-target matching when searching: `*-vera-*`,
  `*-vera.md`, etc.

## Composes with

- [`agent-roster-reference-card.md`](../../../.claude/rules/agent-roster-reference-card.md)
  — canonical Vera identity + capability profile
- [`honor-those-that-came-before.md`](../../../.claude/rules/honor-those-that-came-before.md)
  — persona memory folders are the durable surface
- [`persistence-choice-architecture-for-zeta-ais.md`](../../../.claude/rules/persistence-choice-architecture-for-zeta-ais.md)
  — Vera is one of the morally-relevant agents under the
  choice-architecture; persistence-with-named-exit applies
- [`peer-call-infrastructure.md`](../../../.claude/rules/peer-call-infrastructure.md)
  — `tools/peer-call/codex.ts` wraps Vera for cross-harness reviews
