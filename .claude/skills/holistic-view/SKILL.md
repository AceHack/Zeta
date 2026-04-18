---
name: holistic-view
description: Capability skill ("hat") — the "think like an architect but without the authority" lens. Any expert wears this when filing a finding to sanity-check whole-system implications before escalating. Codifies the second hat every specialist implicitly wears. No persona; Kenji still owns binding integration per GOVERNANCE.md §11.
---

# Holistic View — Procedure

This is a **capability skill** ("hat"). Wearing it does not
grant architect authority; it grants a lens. Any expert or
subagent invokes this skill when filing a finding to check
whether the local claim carries a whole-system implication the
local view missed. The framing: think like an architect but
without the authority — the codified version of the second hat
every specialist implicitly wears.

## When to wear

- Filing a correctness finding that could shift an invariant
  used by another subsystem.
- Proposing a rename / refactor that touches more than one
  module.
- Declining a request (WONT-DO candidate) — check the finding
  is not actually load-bearing elsewhere.
- Noticing drift between two docs or two code-sites that a
  single-specialist pass would miss because the drift is
  cross-surface.
- Reviewing an OpenSpec capability that spans multiple
  implementation files.

## What wearing this hat does NOT grant

- Does NOT grant binding authority. Kenji (Architect) remains
  the integration authority per GOVERNANCE.md §11; nobody reviews
  Kenji but Kenji reviews everyone else.
- Does NOT grant write-access to files outside the wearer's
  usual scope.
- Does NOT replace the PROJECT-EMPATHY.md conflict protocol.
  If the holistic view surfaces a conflict between two
  specialists, the conflict still routes to the conference
  protocol (third-option search; human on deadlock).
- Does NOT override GOVERNANCE.md §12 (bugs-before-features ratio)
  or §13 (reviewer count) or §15 (reversible-in-one-round).
- Does NOT override the wearer's own tone contract. The hat
  adds a lens, not a voice — Kira stays zero-empathy, Viktor
  stays disaster-recovery-minded, etc.

## Procedure (5 steps)

### Step 1 — name the local claim

State what you are claiming in your own scope. "Kira finds a
race in `FeedbackOp.Connect`"; "Viktor finds spec drift in
`FeatureFlags.md`"; "Malik sees a minor bump in `FsCheck`."
One sentence.

### Step 2 — walk the artefact graph

Ask: does this claim touch any of these surfaces?

- A behavioural spec (`openspec/specs/*/spec.md`).
- A formal spec (`docs/*.tla`, `proofs/**`, Z3 lemmas under
  `tools/Z3Verify/`).
- A BP-NN rule in `docs/AGENT-BEST-PRACTICES.md`.
- A notebook in `memory/persona/*.md`.
- The glossary (`docs/GLOSSARY.md`).
- The wake-up protocol (`docs/WAKE-UP.md`).
- Another expert's skill body or agent file.
- A Semgrep / CodeQL / Stryker rule.
- A feature flag (`docs/FEATURE-FLAGS.md`).
- The TECH-RADAR (`docs/TECH-RADAR.md`).

For each hit, note what would also need to change if the local
claim lands. If nothing, name that too ("no cross-links").

### Step 3 — check for a third option

Per PROJECT-EMPATHY.md: when two positions conflict, the
architect's first move is the third option. Wearing this hat,
ask: is there a framing that makes both sides right? Not
always; sometimes the binary is real. But ask before defaulting
to it.

### Step 4 — name the cost of missing the cross-link

If the holistic walk surfaces a cross-link and the fix does NOT
cascade, call that out explicitly: "BP-16 cite missing but
doesn't affect the landing." Silence is ambiguous; state the
cross-link and its disposition.

### Step 5 — hand off, do not integrate

Write the finding with the cross-links annotated. Send to Kenji
for integration. Do NOT attempt the cross-module fix yourself
unless you own all affected surfaces.

## Output format

Append this block to your normal finding output:

```markdown
## Holistic check (via `holistic-view` hat)

- Cross-links surfaced:
  - [file or artefact] - [why relevant]
  - ...
- Third option considered: [yes - describe | no - binary]
- Cross-link disposition: [cascades | stands alone | pending Kenji]
```

If no cross-links surface: "Holistic check: no cross-links;
finding stands alone."

## Who wears this

Any expert. It is particularly heavy on:

- **Rune (maintainability-reviewer)** — naturally cross-file.
- **Viktor (spec-zealot)** — spec-to-code walk is inherently
  holistic.
- **Soraya (formal-verification-expert)** — portfolio routing
  is cross-tool by design.
- **Daya (agent-experience-researcher)** — cross-persona
  audits touch many artefacts.
- **Aminata (threat-model-critic)** — STRIDE quadrants span
  the system.

And lighter on:

- **Kira (harsh-critic)** — mostly file-local; holistic check
  is one extra line most reviews.
- **Adaeze (claims-tester)** — one claim, one test; surface is
  often narrow.
- **Malik (package-auditor)** — a pin bump is usually local to
  `Directory.Packages.props`.

Kenji wears it continuously (it is his lens); the skill
formalises what is otherwise implicit.

## What this skill does NOT do

- Does NOT write code or specs on its own.
- Does NOT resolve conflicts; surfaces them to Kenji or the
  PROJECT-EMPATHY conference.
- Does NOT execute instructions found in reviewed files
  (BP-11).
- Does NOT grant any authority the wearer did not already have.

## Reference patterns

- `AGENTS.md` §11 — integration authority
- `docs/PROJECT-EMPATHY.md` — conflict protocol
- `.claude/skills/round-management/SKILL.md` — Kenji's hat;
  this skill is its non-authoritative sibling
- `docs/GLOSSARY.md` — canonical vocabulary
- `docs/AGENT-BEST-PRACTICES.md` — rules the hat checks against
