---
name: Factory supports multiple AI coding harnesses; each harness's integration with the factory must be tested by a *different* harness — no harness can honestly self-test its own factory integration
description: Aaron 2026-04-20 "since we are going muli test harness support we should technically do this for all harnesses… i want them to test their integration points you cant. i konw codex and cursor git copilot are the ones we care abount immediatly then maybe anitgratify and the amazon one and any less popular ones" (plus "and Kiro for the inital stubs"). Two rules: (1) the cadenced-surface-research discipline (established in `feedback_claude_surface_cadence_research.md`) extends to every harness the factory supports, not just Claude — immediate queue is Codex / Cursor / GitHub Copilot; watched queue is Antigravity / Amazon Q / Kiro; less-popular is TBD. (2) A harness cannot honestly test its own integration with the factory from inside itself — this is a capability-boundary fact. Claude Code cannot verify Codex's factory integration; Codex cannot verify Cursor's. The integration-point test per harness is therefore *owned by a different harness* operating the factory, scheduled cross-harness.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

## The rule

Two halves, both durable:

### Half 1 — multi-harness inventory discipline

The cadenced audit of Anthropic's Claude
surfaces (model / Code CLI / Desktop / Agent
SDK / API) established at
`feedback_claude_surface_cadence_research.md`
is not a Claude-specific policy. It is a
**per-harness** policy. Every harness the
factory supports inherits the same discipline:

- Living inventory doc (`docs/HARNESS-SURFACES.md`
  — was `CLAUDE-SURFACES.md`; renamed
  2026-04-20).
- Per-harness section with feature tables and
  adoption statuses (`adopted` / `watched` /
  `untested` / `rejected` / `stub`).
- Cadenced audit every 5-10 rounds **once the
  harness is populated** — stubs don't tick.
- Per-harness owner persona (or a shared multi-
  harness guide — TBD when more than one
  harness is populated).

**Phased buildout** per Aaron's priority:

- **Primary (populated):** Claude — already done.
- **Immediate queue (priority 1):** Codex
  (OpenAI), Cursor, GitHub Copilot. Build out
  when the factory actually runs on them.
- **Watched queue (priority 2):** Antigravity
  (Google; spelling TBD), Amazon Q Developer /
  CodeWhisperer, Kiro (Amazon's AI-native IDE
  — distinct from Amazon Q, Aaron called it
  out explicitly for initial stubs).
- **Less popular:** TBD.

### Half 2 — each-harness-tests-own-integration

A harness cannot honestly test its own
integration with the factory from *within*
itself. This is a capability-boundary fact,
not a process preference.

Concrete cases:

- Claude Code cannot verify that Claude Code
  correctly reads `.claude/skills/`, honours
  `MEMORY.md`, respects hooks — because the
  verifier is the same runtime as the thing
  being verified. A bug that corrupts skill-
  loading will also corrupt the verifier.
- Codex cannot verify its own factory
  integration for the same reason.
- Cursor cannot verify Cursor's.

The integration-point test per harness is
therefore *owned by a different harness* that
operates the factory and can observe whether
the first harness's artefacts behave correctly
when loaded externally.

### Harness vs reviewer robot — scope of the rule (2026-04-20 correction)

The capability-boundary rule applies to
**harnesses**, not to **reviewer robots**.

- A **harness** loads factory artefacts
  (skills, hooks, persona agents, `MEMORY.md`)
  and *is the runtime* that executes agent-
  directed work. Claude Code, VS Code Copilot
  extension, Codex CLI, Cursor are harnesses.
  Same-runtime-verifies-same-runtime fails.
- A **reviewer robot** reads diffs and
  comments. GitHub Copilot PR code review,
  automated linters on PRs, Sonatype scan bots
  are reviewer robots. They do not load the
  factory runtime; the verifier is a *different*
  process from the harness being reviewed.

Concrete implication: **GitHub Copilot is a
brand for three distinct products**, each with
a different relationship to this rule:

1. **Copilot PR code review** (reviewer robot).
   Reads `.github/copilot-instructions.md`;
   reviews PRs when requested. **Not on the
   each-tests-own rule.** A Copilot PR review
   of a PR authored by Claude Code is external
   verification — two different products,
   different runtimes.
2. **Copilot in VS Code** (the actual harness).
   **On the each-tests-own rule.** It cannot
   self-verify its own factory integration.
3. **Copilot coding agent** (`@copilot`
   autonomous PR author). Hybrid — it authors
   PRs in a sandbox; partially loads factory
   artefacts. **On the each-tests-own rule**
   for integration tests of *its own sandbox
   behaviour against the factory*, but its
   PR output can be reviewed externally by
   any other product.

Aaron 2026-04-20 verbatim on this separation:
*"Out current copilot stuff is a Github
integration we need that on our PRs, it's not
the harness the vscode harness is what needs
to test it's own entry point, I don't think
you can get the GitHub PR copilot to test its
own surface area and tell us can you? and
repair itself? … we will use vvscode for the
rest."*

The earlier conflation — treating
`.github/copilot-instructions.md` as if it
were a VS Code Copilot harness contract —
was a category error. Reviewer robot and
harness are different runtime relationships;
the capability boundary does not generalize
from one to the other.

**Concrete ownership map (2026-04-20):**

- Claude Code's factory-integration tests →
  owned by Codex / Cursor / Copilot once any
  of them is populated. Until then, the
  integration is un-verified externally and
  the factory accepts that limitation
  transparently.
- Codex's factory-integration tests → owned by
  Claude Code (or any other populated harness).
- Cursor's → owned by Claude Code (or another).
- Copilot's → owned by Claude Code (or
  another).
- Antigravity / Amazon Q / Kiro / less-popular
  → same pattern.

**This is why we need more than one harness
populated.** A single-harness factory has a
permanent blind spot on its own integration
tests. Getting a second harness populated is
the shortest path to closing that blind spot.

## Why (the reason Aaron gave)

Verbatim:

> *"since we are going muli test harness
> support we should technically do this for
> all harnesses but it will be a while before
> we need to build it out for the others ones,
> i want them to test their integration points
> you cant. i konw codex and cursor git copilot
> are the ones we care abount immediatly then
> maybe anitgratify and the amazon one and any
> less popular ones"*

Plus: *"and Kiro for the inital stubs"*.

Two things in that quote, both load-bearing:

1. **"you cant"** (referring to self-testing
   integration points) — Aaron names the
   capability-boundary reason. Claude Code
   genuinely cannot. Not "shouldn't for policy
   reasons" — **cannot**, because the verifier
   and the verified are the same process. This
   is why the rule is not "each harness writes
   good integration tests" (a quality goal)
   but "each harness's integration is tested
   by a **different** harness" (a capability
   statement).

2. **Phasing.** Aaron is not asking for all
   five harnesses to be populated now. He's
   asking for the **structure** to support it
   now (inventory doc + hygiene row + BACKLOG
   entry) so that when Codex / Cursor /
   Copilot come online, the slot is already
   there. This is the same "land the structure,
   fill it later" pattern the factory has
   applied to many other areas.

Compound, typos-expected (per
`user_typing_style_typos_expected_asterisk_correction.md`):
"muli" = multi; "abount" = about; "konw" =
know; "anitgratify" = Antigravity (Google);
"inital" = initial. Aaron's typing-fast-to-
steer posture applies.

## How to apply

### When designing or auditing factory features

- **Ask:** does this feature depend on a
  specific harness, or is it harness-agnostic?
  If harness-specific, which section of
  `HARNESS-SURFACES.md` does it live under?
- **Ask:** does this feature need a per-harness
  integration test? If yes, the test is
  **owned by a different harness** than the
  one the feature targets. Do not write the
  test to run from inside the harness it's
  testing.
- **Ask:** is the scope factory-wide or
  harness-specific? Tag appropriately (`scope:`
  field research in
  `docs/research/memory-scope-frontmatter-schema.md`).

### When the factory is asked to run on a new harness

1. Add a stub section in `HARNESS-SURFACES.md`.
2. Add a FACTORY-HYGIENE row cadence entry once
   populated (once the factory actually runs
   on the harness).
3. Schedule the first-populated audit as a
   BACKLOG row.
4. Route integration-point tests to **another
   populated harness** — never self-owned.

### When proposing a Claude-specific rule

- Consider: would this rule also apply to
  Codex / Cursor / Copilot? If yes, write it
  harness-agnostically or as a per-harness
  template. Don't bake "Claude" into the rule
  name unless the rule is genuinely Claude-
  specific (e.g., `ScheduleWakeup` cache-warm
  window is Claude-API specific).

### When Claude tries to claim its own factory integration is verified

Don't. It isn't. It cannot be, from inside
itself. The honest disclosure is: "Claude
Code's factory integration is not externally
verified until a second harness is populated
and run against the factory." Future-self is
not bound to this (per
`feedback_future_self_not_bound_by_past_decisions.md`)
if the capability boundary changes, but **as
of 2026-04-20 the boundary holds**.

## Cross-references

- `feedback_claude_surface_cadence_research.md`
  — the Claude-specific origin; this memory
  extends it multi-harness.
- `docs/HARNESS-SURFACES.md` — living inventory
  (multi-harness refactor 2026-04-20).
- `docs/FACTORY-HYGIENE.md` row 38 — widened
  from "Claude-surface audit" to
  "Harness-surface audit" per this memory.
- `.github/copilot-instructions.md` — existing
  Copilot-surface artefact, already factory-
  managed per GOVERNANCE §31. The full Copilot
  harness section of `HARNESS-SURFACES.md`
  subsumes its audit.
- `user_typing_style_typos_expected_asterisk_correction.md`
  — typo disambiguation for Aaron's quote.
- `project_zeta_as_primitive_for_ai_research.md`
  — the "factory reused beyond Zeta" constraint
  that motivates multi-harness at all.

## Scope

**Scope:** factory-wide. Any adopter of the
factory kit that runs it on multiple AI
harnesses inherits both halves of this rule.
Zeta is the first adopter; Zeta's multi-harness
buildout is the first instance.
