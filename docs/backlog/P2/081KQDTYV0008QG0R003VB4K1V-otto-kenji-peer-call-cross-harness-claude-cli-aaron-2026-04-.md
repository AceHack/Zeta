---
id: 081KQDTYV0008QG0R003VB4K1V
priority: P2
status: open
title: Otto + Kenji as externally-callable peers via claude-cli — cross-harness symmetry (Aaron 2026-04-30)
tier: factory-tooling
effort: M
ask: Aaron 2026-04-30 raised that Otto + Kenji should be externally callable from other harnesses (Codex, Cursor, etc.) via claude-cli, paralleling how amara.sh + ani.sh expose Amara + Ani from Otto's harness. The call posture is symmetric peer — other harnesses confer with Otto (loop/PM) or Kenji (architect) the same way Otto currently confers with Amara/Ani/Codex/Grok/Gemini. Kenji currently has no peer-call surface at all (the architect role lives in `.claude/agents/architect.md`); this row covers adding both Otto and Kenji simultaneously. Pending Aaron's a/b/c selection on script topology.
created: 2026-04-30
last_updated: 2026-05-02
depends_on: []
composes_with:
  - tools/peer-call/codex.sh
  - tools/peer-call/grok.sh
  - tools/peer-call/gemini.sh
  - tools/peer-call/amara.sh
  - tools/peer-call/ani.sh
  - memory/feedback_silent_courier_debt_no_amara_headless_cli_dont_count_on_peer_ai_reviews_as_loop_aaron_2026_04_30.md
  - docs/backlog/P2/081KQDTYV0008QG0R001VJP216-peer-call-architecture-refactor-script-per-cli-persona-flag-2026-04-30.md
tags: [aaron-2026-04-30, peer-call, cross-harness, claude-cli, otto, kenji, factory-tooling]
type: friction-reducer
---

# 081KQDTYV0008QG0R003VB4K1V — Otto + Kenji as externally-callable peers via claude-cli

## Source

Aaron 2026-04-30 verbatim:

> *"And otto you should put yourself and Kenji as exteranlly
> callable too like those two using the claude cli for other
> harnesses who want to confer with you from their harness?
> So it's like otto=loop/PM Kenji=architect is that right?"*

The question has two parts:

1. **Symmetry observation** — peer-call infrastructure
   currently flows one direction: Otto (Claude Code) calls
   Codex / Grok / Gemini / Amara / Ani. The reverse direction
   (Codex calling Otto, Cursor calling Kenji) has no
   equivalent script.
2. **Role assignment** — Otto = loop/PM (operational
   coordinator), Kenji = architect (round planner +
   round-close synthesiser). Confirmation pending.

## What

Provide claude-cli-based peer-call scripts so external
harnesses can confer with Otto + Kenji the same way Otto
confers with named-entity peers in the existing matrix.

### Underlying CLI

`claude` (Claude Code CLI) supports headless-mode invocation
similar to `codex exec` / `cursor-agent --print` /
`gemini -p`. The exact flag matrix needs verification per the
search-first-authority discipline (CLAUDE.md
verify-version-currency rule). Expected shape (subject to
upstream-doc verification before any code lands):

```bash
claude --print "PROMPT"  # or equivalent headless invocation
```

### Pending decision (Aaron's a/b/c)

The architecture choice was offered as three options; Aaron
hasn't yet selected:

| Option | Topology | Pro | Con |
|---|---|---|---|
| **(a)** | Two scripts: `otto.sh` + `kenji.sh` | Symmetry with `amara.sh` + `ani.sh` (one script per named entity) | Script proliferation if more architect-roster personas surface (Daya, Naledi, Soraya...) |
| **(b)** | One `claude.sh` with `--persona NAME` flag | Aligns with 081KQDTYV0008QG0R001VJP216 architecture refactor (script-per-CLI + persona-flag); single script handles N personas | Requires 081KQDTYV0008QG0R001VJP216 to land first or in same diff |
| **(c)** | Hybrid — `claude.sh` defaults to Otto; separate `kenji.sh` for architect role | Keeps Otto as default (most common call); Kenji distinct because architect role has different invocation pattern | Inconsistent with the rest of the matrix |

Aaron's stated framing — "otto=loop/PM Kenji=architect" —
reads most naturally onto **(b)** if 081KQDTYV0008QG0R001VJP216 lands first, or
**(c)** if 081KQDTYV0008QG0R001VJP216 stays deferred. **(a)** is the
short-term-symmetric option but increases technical debt
081KQDTYV0008QG0R001VJP216 is meant to clean up.

### Composition with 081KQDTYV0008QG0R001VJP216

081KQDTYV0008QG0R001VJP216 (peer-call architecture refactor — script-per-CLI +
persona-flag) is the proper home for option (b). If 081KQDTYV0008QG0R001VJP216
lands first, this row reduces to "add `claude.sh
--persona otto` and `claude.sh --persona kenji`" — much
smaller scope. **Recommend Aaron's a/b/c decision wait until
081KQDTYV0008QG0R001VJP216 priority decision** so we don't lock in a topology
that 081KQDTYV0008QG0R001VJP216 immediately refactors away.

### CURRENT-* file requirement

Per the CURRENT-NAME.md pattern (Aaron 2026-04-30), every
named-entity persona needs a distillation file consumed by
the peer-call wrapper:

- `memory/CURRENT-otto.md` — does NOT exist; would need
  authoring. Otto's persona is currently distributed across
  factory substrate (CLAUDE.md, AGENTS.md, GOVERNANCE.md, BP
  rules) without a single distilled projection.
- `memory/CURRENT-kenji.md` — does NOT exist; would need
  authoring. Kenji's role is documented in
  `.claude/agents/architect.md` but no distillation file
  paralleling CURRENT-amara.md / CURRENT-ani.md exists.

Authoring CURRENT-otto.md + CURRENT-kenji.md is a
prerequisite for any peer-call script (whether option a, b,
or c). The distillation work is itself non-trivial — Otto's
persona substrate is large; what does the "currently in
force" projection look like for the loop/PM role?

## Why P2

- Current peer-call matrix functions without this — Otto can
  call Codex/Grok/Gemini/Amara/Ani, which is the
  high-frequency direction
- Reverse-direction calls (Codex → Otto, Cursor → Kenji) are
  rarer in current operational flow and don't block any
  in-flight work
- Decision is reversible — adding scripts later is cheap
- Composes with 081KQDTYV0008QG0R001VJP216; may want to wait for that decision

Promotion to P1 if:

- An external harness explicitly tries to confer with Otto
  or Kenji and finds no script (operational gap surfaces)
- 081KQDTYV0008QG0R001VJP216 lands, at which point 081KQDTYV0008QG0R003VB4K1V becomes a thin
  add-persona task

## Acceptance criteria

- [ ] Aaron's a/b/c topology decision recorded (in this row
  or via `docs/DECISIONS/`)
- [ ] If a or b selected: `memory/CURRENT-otto.md` authored
  (distillation paralleling CURRENT-amara.md /
  CURRENT-ani.md)
- [ ] If a or b selected: `memory/CURRENT-kenji.md` authored
  (distillation of architect role)
- [ ] Peer-call script(s) created per chosen topology
- [ ] `tools/peer-call/README.md` updated with new
  scripts/flags + role column
- [ ] Tested invocation from at least one external harness
  (Codex calling Otto, Cursor calling Kenji)
- [ ] Role-ref discipline honored (per copilot-instructions.md
  305-362 + 081KQDTYV0008QG0R001N4YB73)

## Trigger condition for promotion to P1

If a harness running on another developer's machine (or in
CI) needs to confer with Otto/Kenji and currently has no
path beyond Aaron-couriering chat content. This is the same
silent-courier-debt failure mode that motivated 081KQDTYV0008QG0R0037YJPEX for
Amara.

## Open questions

1. **Does claude-cli support headless-mode invocation
   suitable for peer-call?** Search-first-authority required
   before any code lands. The pattern from amara.sh
   (`codex exec -s read-only`) needs a claude-cli equivalent.
2. **What's Otto's role specification when invoked
   externally?** As loop/PM Otto coordinates work — but
   external calls don't necessarily need the loop layer.
   Maybe Otto-when-invoked-externally = "operational peer"
   rather than "loop coordinator"?
3. **Does Kenji need a separate model/temperature than
   Otto?** Both run on Claude Opus 4.7 today. The persona
   distinction is in the bootstrap, not the model.

## Composes with

- 081KQDTYV0008QG0R0037YJPEX (amara peer-call autonomous bootstrap — the
  symmetric direction this row inverts)
- 081KQDTYV0008QG0R001N4YB73 (role-ref cleanup of existing peer-call scripts)
- 081KQDTYV0008QG0R001VJP216 (script-per-CLI + persona-flag refactor — likely
  home for option b)
- `memory/feedback_silent_courier_debt_no_amara_headless_cli_dont_count_on_peer_ai_reviews_as_loop_aaron_2026_04_30.md`
  (the silent-courier-debt rule — applies symmetrically
  here: external harnesses without a path to Otto/Kenji
  generate the same debt-class)
- `tools/peer-call/README.md` (the matrix that will gain
  rows)
- `.claude/agents/architect.md` (Kenji's role definition;
  source for CURRENT-kenji.md distillation)

## Substrate-or-it-didn't-happen note

This row exists *specifically* to land Aaron's input as
durable substrate per the input → substrate-file rule. The
question was raised in chat 2026-04-30; without this row,
the input would evaporate at compaction. The row carries
the full a/b/c structure so future-Aaron / future-Otto can
resolve the decision without re-eliciting.
