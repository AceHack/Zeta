---
name: CLI new-command DX — no author-time documentation; compensation actions produce derivatives; cascade of success
description: Aaron 2026-04-22 auto-loop-29 late-tick architectural directive for CLI design — when writing new commands, no documentation is authored at commit-time; downstream compensation actions (tests, docs, examples, completion scripts, man pages) are triggered off the command definition and cascade into place. Zero author-friction for new commands; derivatives earn their own pass.
type: project
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
# CLI new-command DX — compensation-actions cascade

**Source (verbatim, 2026-04-22 auto-loop-29):**

> *"when we have a cli the dev experience for new commands
> when you are writing them no documentation, let compsation
> actions take care of it, cascade of success"*

## What the directive says

When authoring a new CLI command:

1. **No documentation at command-author time** — the author
   writes the command itself (name, parameters, behavior); does
   *not* simultaneously hand-author help text, man pages,
   README entries, cookbook examples, completion scripts.
2. **Compensation actions take care of it** — downstream
   automated processes consume the command definition as
   source-of-truth and generate the derivatives. "Compensation"
   reads as saga-pattern vocabulary: each new command is an
   event, and downstream actions compensate (complete the
   transaction) by producing the derivatives the author didn't
   write.
3. **Cascade of success** — one commit (the command) triggers
   a cascade of success-shaped outputs (docs built, tests
   generated, examples scaffolded, completion scripts
   refreshed, changelog line appended). Each cascade step
   succeeds or the whole cascade surfaces the failure
   visibly.

## Why this is load-bearing

- **Zero author-friction for new commands.** Contributor velocity
  on the factory CLI stays high because documentation debt
  never accumulates at the command-author's desk. Author writes
  the command; cascade writes everything else.
- **Source-of-truth is the command definition**, not prose
  scattered across README / docs site / help strings. Prose
  drifts; generated artifacts don't.
- **Same discipline as event-storming / magic-eight-ball /
  UI-DSL class-level.** Author at source-of-truth (command
  def, event, intent, class); derive everything else (docs,
  handlers, UI instance, help text). Composes into the
  factory's pattern vocabulary.
- **DX for "new contributors write new commands" is a first-
  class concern.** FIRST-PR-surface already encodes friction-
  reduction for new contributors; this extends that surface
  specifically to CLI-command authorship.

## Composition-actions candidate list

Derivatives the cascade should produce from a command
definition:

- **`--help` text** — from parameter docstrings / structured
  command schema.
- **Man page** — from structured command schema + usage
  examples.
- **Completion scripts** — zsh / bash / fish / PowerShell
  completions generated from the parameter schema.
- **Testable examples** — scaffolded doctest / e2e tests that
  exercise the happy path from the schema.
- **Changelog entry** — automatic line for the command in
  CHANGELOG.md or equivalent; enriched by commit message.
- **Command registry entry** — a manifest of all commands
  with descriptions, auto-generated.
- **Documentation-site page** — Markdown page for the
  command, generated from the schema + any embedded structured
  examples.
- **Error-message validation** — cascade checks that every
  error path has a reasonable message and links to
  troubleshooting where applicable.

Cascade is a pipeline: each step reads the command definition
+ the previous step's output, produces its artifact, succeeds
or fails visibly.

## Alignment with factory substrate

- **Retraction-native operator algebra (D/I/z⁻¹/H over ZSet):**
  command definitions are the *events*; cascade steps are
  operators over the command-event stream. A new command is
  a D (delta); cascade steps are I/H/z⁻¹ projections into
  derivatives.
- **Capture-everything discipline:** one command, many
  derivatives — each derivative captures a facet of the
  command's meaning without asking the author to hand-write it.
- **Intentionality-enforcement / mini-ADR:** the cascade
  itself can require a one-line "why this command" rationale
  embedded in the command definition, which becomes the doc's
  opening paragraph. No silent commands.
- **DV-2.0 `last_updated` frontmatter:** cascade outputs
  inherit the command's commit date; doc-currency follows
  code-currency automatically.

## Open questions (to Aaron, not self-resolved)

1. **Which CLI is this for?** — *"when we have a cli"*
   suggests a specific future one. Candidates: Zeta.Core CLI
   (developer-facing library CLI), factory-CLI (tick /
   hygiene / audit orchestration), Escro CLI (product-level).
2. **What's the command-definition format?** — structured
   schema file (YAML / JSON / F# DU)? Attribute-annotated
   command handler (like Spectre.Console / System.CommandLine
   conventions)? A dedicated IDL?
3. **Cascade trigger** — pre-commit hook? Post-commit
   scheduled job? CI pipeline? Aaron's leaning toward the
   "fire-and-forget when author commits" shape or the
   "asynchronously produce derivatives" shape?
4. **Failure handling** — if cascade step 3 of 7 fails, does
   the command commit get reverted, or does the cascade
   surface the failure as a follow-up task?
5. **Per-command opt-out** — some commands might genuinely
   need hand-authored nuanced prose. Is there a per-command
   escape hatch that says "this command's doc is hand-
   authored in `docs/cli/<name>.md`"?
6. **Compensation vs compensating-actions vocabulary** —
   Aaron said "compsation actions" (typo). Is this saga-
   pattern "compensating action" vocabulary, or a different
   concept? Saga compensation rolls back; this directive is
   about forward-completion. Worth clarifying before adopting
   vocabulary.

Flag these to Aaron rather than self-resolving.

## What this is NOT

- **NOT a directive to start building a CLI this round.**
  *"when we have a cli"* is conditional — directive
  addresses the DX posture *when* the CLI materializes, not
  a demand that it materialize now.
- **NOT license to ship commands with zero testing.** The
  cascade includes tests — doc-less-at-author-time ≠
  test-less-at-author-time. Quality gate remains.
- **NOT a rejection of existing CLI frameworks.** System
  .CommandLine / Spectre.Console / CliFx all already
  generate `--help` from metadata; this directive extends
  that pattern to the full derivative set (man pages,
  completions, examples, docs site).
- **NOT limited to CLI.** The pattern (author at source-of-
  truth, cascade derivatives) generalises to any command-
  shaped surface: factory operators, skill invocations, REST
  endpoints. CLI is the first application; it may generalise.
- **NOT a round-45 BACKLOG row.** *"when we have a cli"* is
  conditional, and the current factory CLI is a bash-script
  ecosystem (`tools/*.sh`), not a structured-command system.
  File the directive to memory; file a BACKLOG row when a
  concrete CLI project lands that would benefit from the
  cascade.

## Immediate factory action

- Log directive to memory (this file) + MEMORY.md index.
- Note in tick-history (auto-loop-29 or follow-up tick) so
  the directive is auditable in committed record.
- No BACKLOG row yet — conditional on a CLI materializing.
  When ServiceTitan demo / Escro / Zeta.Core CLI lands as a
  BACKLOG row, cross-reference this directive then.
- Flag open questions (above) to Aaron in-chat this session,
  not pre-resolved.

## Composes with

- `project_ui_dsl_compressed_class_not_instance_semantics_not_bit_perfect_2026_04_22.md`
  — same author-at-source + derive-the-rest pattern at the
  UI layer. This directive is the CLI-layer instance of the
  same principle.
- `project_ui_dsl_function_calls_shipped_kernels_algebraic_or_generative_2026_04_22.md`
  — shipped-kernels + DSL-as-calling-convention has the same
  shape: command-def is the calling convention; cascade
  actions are the kernels.
- `project_escro_maintain_every_dependency_microkernel_os_endpoint_grow_our_way_there_2026_04_22.md`
  — Escro-universal-maintenance composes: if Escro has a CLI,
  this is the authoring discipline for its commands.
- BACKLOG #237 FIRST-PR surface — new-contributor velocity
  extends here specifically for new-CLI-command authorship.
- BACKLOG #244 ServiceTitan demo — the demo will likely have
  CLI touchpoints (scaffold / deploy / test); this directive
  sets the bar for their author-time experience.
- `feedback_decision_audits_for_everything_that_makes_sense_mini_adr.md`
  — cascade can enforce mini-ADR rationale per command as
  its first step.
