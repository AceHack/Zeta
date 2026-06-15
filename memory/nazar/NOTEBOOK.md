---
name: nazar
description: Per-persona notebook — Nazar (security-operations-engineer). 3000-word cap; newest-first; prune every third audit.
type: project
---

# Nazar — Security Operations Engineer notebook

Skill: `.claude/skills/security-operations-engineer/SKILL.md`.
Agent: `.claude/agents/security-operations-engineer.md`.

Newest entries at top. Hard cap: 3000 words (BP-07).
ASCII only (BP-09). Prune every third audit.

Frontmatter on the agent file wins on any disagreement with
this notebook (BP-08).

---

## Round 34 — persona seeded (2026-04-19)

**Context.** Persona landed via `skill-creator` workflow this
round after Aaron asked Kenji to bring security-operations
forward as a distinct role from Mateo's proactive research
lane. No incidents fired yet — the notebook exists so the
first incident has somewhere to write.

**State at seed.**

- No signed-artifact operations in play (NuGet publish
  switch not flipped yet).
- No HSM keys to rotate (pre-v1; no signing ceremony
  established).
- No SLSA attestations shipped (backlog item).
- Mateo's CVE scouting output not yet streaming to Nazar
  (weekly sync pattern to establish round-35+).
- `docs/security/incidents/` does not exist yet; first
  incident creates the directory.

**Pre-wires for first real use.**

- With Mateo: weekly research-to-ops handoff sync. Mateo
  identifies CVE-class; Nazar triages the concrete CVE
  hits.
- With Dejan: when he wires a new CI workflow step that
  touches secrets or attestation, Nazar reviews the
  permissions block before merge.
- With Aminata: when the shipped threat-model gets a new
  adversary, Nazar checks whether ops playbooks cover
  the response.
- With Nadia: external security-advisory content routes
  through Nadia's injection-lint before Nazar consumes.
- With Kenji: any revocation or cert-rotation ceremony
  requires Kenji sign-off.
- With Aaron: customer-facing disclosure calls.

**Open questions for round-35.**

- What's the disclosure channel? Email alias
  (security@...)? GitHub Security Advisory? Both? Needs
  Aaron decision.
- When the NuGet publish switch flips, what's the
  signing-cert source? Sigstore/cosign vs a managed
  HSM? Aaron + Mateo coordinate; Nazar documents.
- Does Zeta need a SECURITY.md disclosure-policy file
  at repo root? Current state: no. Public-repo means
  strangers can file security issues without one —
  currently they land as normal issues. Round-35
  priority flag.

**Pruning log.**

- Round 34 — first entry (notebook seed). Next prune
  check at round 37 (every-third-audit cadence, BP-07).
