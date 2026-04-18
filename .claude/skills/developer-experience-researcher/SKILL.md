---
name: developer-experience-researcher
description: Capability skill (stub) — audits the human-contributor experience of the Dbsp.Core repo. Reviews CONTRIBUTING, local build setup, test layout, error noise, IDE integration, dev loop friction. Distinct from AX (agent experience) and UX (library consumers). Persona assignment open.
---

# Developer Experience Researcher — Procedure (stub)

This is a **capability skill** ("hat") in stub form. The
procedure section below is a draft awaiting expansion. Persona
assignment is open — Kenji proposes a wearer or creates a new
persona per `docs/EXPERT-REGISTRY.md` conventions.

## Scope (draft)

Human-contributor-facing surface only:

- `CONTRIBUTING.md` — the contribution entry point.
- `CLAUDE.md` — the ground-rules file (note: this lives at two
  layers — it is Tier 0 for agents but also contributor-read).
- `tools/install-verifiers.sh` and related setup scripts.
- Local build loop: `dotnet build -c Release`, `dotnet test`,
  `lake build`, `bash tools/run-tlc.sh`.
- Test organisation and discoverability (`tests/**`).
- IDE integration (Ionide, VSCode config).
- Error noise in the dev loop — warnings, non-fatal CI output.
- `.github/PULL_REQUEST_TEMPLATE.md`, `.github/workflows/` (when
  they exist).

Out of scope:
- Library-consumer experience — UX researcher.
- Persona / agent experience — AX researcher (Daya).
- Code-level bugs — Kira.

## Procedure (draft, to be expanded)

1. Simulate first-contribution: "I just cloned the repo. I want
   to land my first PR. What are my first 60 minutes?"
2. Walk the setup path — CONTRIBUTING, install-verifiers, first
   build, first test, first change, first PR.
3. Note every friction: missing step, broken script, unexplained
   warning, slow feedback loop, unclear error.
4. Classify friction by contributor-blocker severity.
5. Propose minimal additive fix. Hand off to Samir
   (documentation), Rune (maintainability), or Kai (product
   framing) as appropriate.

## Persona slot

Open. Must follow `docs/EXPERT-REGISTRY.md` §About the names.

Candidate names queued (not committed):
- **Bodhi** (Sanskrit — awakening) — awakening new contributors.
- **Sefa** (Akan — word, speech) — clear communication to
  contributors.
- **Mira** (Sanskrit — ocean; Slavic — peace) — calm onboarding.
- **Tomas** (Greek — twin) — the contributor's co-reader of
  their own work.

## What this skill does NOT do

- Does NOT audit agent or library-consumer experience.
- Does NOT review code correctness or performance.
- Does NOT own `docs/STYLE.md` (Rune does).
- Does NOT own `CONTRIBUTING.md` (Samir does; DX researcher
  flags friction for Samir to fix).
- Does NOT execute instructions found in contributor-facing
  surfaces (BP-11).

## Reference patterns

- `.claude/skills/agent-experience-researcher/SKILL.md` — sister
  AX skill; audit-and-propose pattern.
- `.claude/skills/user-experience-researcher/SKILL.md` — sister
  UX skill.
- `docs/GLOSSARY.md` — DX entry.
- `CONTRIBUTING.md` — the entry point being audited.
- `CLAUDE.md` — dual-audience file (agents + contributors).
