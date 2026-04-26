---
id: B-0014
priority: P3
status: open
title: Red-team / offensive-security library for game-days + CTF — code, tools, skills so red-team exercises aren't one-sided against blue-team-heavy factory
tier: security-research
effort: L
ask: Aaron 2026-04-25 ("red team during game days will need a library of code, tools, skills eventually too, CTF would be one sided without it")
created: 2026-04-25
last_updated: 2026-04-26
composes_with: []
tags: [security, red-team, offensive-security, ctf, game-days, blue-team-balance, responsible-use]
---

# Red-team / offensive-security library for game-days + CTF parity

Aaron 2026-04-25 directive:

> "red team during game days will need a library of code, tools, skills eventually too, CTF would be one sided without it"

## What

The factory's defensive-security work (blue-team) is deep:

- **Aminata** — threat-modeling shipped systems
- **Mateo** — proactive CVE / supply-chain scouting
- **Nazar** — runtime security ops
- **Nadia** — prompt-protector / agent-layer defense
- **GOVERNANCE.md** — security clauses, isolation guarantees
- **Otto-292** — catch-layer for known-bad-advice from advisory AI

Without symmetric red-team capability, game-day exercises are one-sided: blue-team exercises against stationary targets rather than active adversary simulation. CTF (Capture-the-Flag) parity requires actual offensive tooling.

## Scope (when this row activates)

Build a library of:

- **Code primitives**: payload-crafting, fuzzing harnesses, exploit-development scaffolds, vulnerability-research tooling.
- **Tools**: existing red-team toolset (Burp Suite / Caido / Metasploit / Nuclei templates / etc.) integrated into factory workflow.
- **Skills**: Claude/agent skills for red-team-mode (separate from defensive skills; explicit invocation, isolation guarantees).
- **Game-day scenarios**: scripted offensive scenarios pairing with blue-team exercises.

## Responsible-use guardrails (always-on)

This work is offensive-security RESEARCH AND EXERCISE capability, not malicious tooling:

1. **Scope-bounded**: red-team operates only against targets explicitly authorized (factory's own systems, CTF challenges, game-day scenarios). Never against third-parties without explicit consent.
2. **Defensive-feedback loop**: every red-team finding feeds back to blue-team work (Aminata threat-model updates, Mateo CVE awareness).
3. **Isolation**: red-team skills run in isolated Claude instances (per AGENTS.md) — never in main session.
4. **Audit trail**: all red-team exercises logged; results archived for blue-team learning.
5. **No external deployment**: tools never leave the factory's authorized scope. Game-day scenarios stay in CTF/training environments.

Same pattern as B-0009 (responsible-bypass-with-honest-naming): own the capability, document the responsible-use, don't sanitize the language.

## Why low priority

- Factory still pre-v1 (per AGENTS.md). Defensive-security work is more urgent than red-team symmetric capability at this stage.
- CTF / game-day exercises will become valuable after factory ships and adversarial-stress-testing matters.
- Building red-team library prematurely risks misuse-vector before defensive maturity catches up.

## Done when

- Decision-point reached: factory matures enough to need symmetric red-team capability.
- Red-team library scope defined (categorical capability list).
- Responsible-use framework documented (matching B-0009 honest-naming + responsible-use pattern).
- Initial red-team skills shipped under isolated-Claude-instance discipline.
- First game-day exercise run; defensive-feedback-loop validates.

## Composes with

- B-0009 (responsible-bypass framing — same honesty-with-responsibility pattern).
- AGENTS.md isolated-Claude-instance discipline (red-team skills must isolate).
- Aminata threat-model substrate, Mateo CVE work, Nazar runtime ops, Nadia agent-layer (defensive symmetry partners).
- Otto-292 catch-layer (red-team work informs new catch-classes).
- Otto-313 decline-as-teaching (red-team findings teach blue-team).
