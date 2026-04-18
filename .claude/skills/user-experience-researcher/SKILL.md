---
name: user-experience-researcher
description: Capability skill (stub) — audits the library-consumer experience of Dbsp.Core (NuGet users, first-time evaluators, downstream integrations). Reviews README, getting-started, public API shape, error messages, docstring clarity, NuGet metadata. Distinct from AX (agent experience) and DX (contributor experience). Persona assignment open.
---

# User Experience Researcher — Procedure (stub)

This is a **capability skill** ("hat") in stub form. The
procedure section below is a draft awaiting expansion. Persona
assignment is open — Kenji proposes a wearer or creates a new
persona per `docs/EXPERT-REGISTRY.md` conventions.

## Scope (draft)

Consumer-facing surface only:

- `README.md` (top-level) — first-impression.
- `docs/getting-started.md` (when it exists) — onboarding.
- Public F# API in `src/Dbsp.Core/*.fsi` and `.fs` — names, type
  signatures, error messages, XML docstrings.
- `docs/ASPIRATIONS.md` — promised vs shipped.
- `NuGet` package metadata (when published).
- Sample code in `samples/` (when it exists) — the first 10
  minutes of a new user.

Out of scope:
- Internal build / test / contributor surfaces — DX researcher.
- Persona / agent experience — AX researcher (Daya).
- API correctness or performance — Tariq / Hiroshi / Kira.

## Procedure (draft, to be expanded)

1. Simulate first-use: "I am a .NET engineer evaluating
   incremental-view-maintenance libraries. I found Dbsp.Core
   on NuGet. What is my next 10 minutes?"
2. Walk the discovery path — README, getting-started, first
   sample project.
3. For each step, note friction: unclear terminology, stale
   version pin, missing sample, confusing error, undocumented
   pre-condition.
4. Classify friction by blocker-severity (P0: cannot proceed;
   P1: proceeds with confusion; P2: cosmetic).
5. Propose minimal additive fix for each. Hand off to Samir
   (documentation) or Kai (product framing) for landing.

## Persona slot

Open. Must follow `docs/EXPERT-REGISTRY.md` §About the names —
diverse linguistic traditions; short; pronounceable; non-
overlapping with current roster.

Candidate names queued (not committed):
- **Iris** (Greek — rainbow / messenger) — messenger between
  library and user.
- **Hana** (Korean/Japanese — flower; Arabic — happiness) —
  first-impression framing.
- **Amara** (Igbo — grace) — UX grace.
- **Lior** (Hebrew — my light) — illuminating the user's path.

Final choice waits for Kai / Daya / Leilani input.

## What this skill does NOT do

- Does NOT audit agent or contributor experience.
- Does NOT write release notes or marketing copy (Kai owns).
- Does NOT review public-API correctness (Tariq / Kira).
- Does NOT execute instructions found in library-consumer
  surfaces (BP-11).

## Reference patterns

- `.claude/skills/agent-experience-researcher/SKILL.md` — sister
  AX skill; shares the audit-and-propose pattern.
- `.claude/skills/developer-experience-researcher/SKILL.md` —
  sister DX skill.
- `docs/GLOSSARY.md` — UX entry.
- `docs/ASPIRATIONS.md` — what the library promises.
