---
id: B-0096
priority: P3
status: open
title: Forbidden Pattern Quarantine / Antigen Library — escrow-eligible candidate (Amara via Aaron 2026-04-29)
tier: research-deferred
effort: L
ask: Aaron 2026-04-29 forwarding Amara's Forbidden Pattern Quarantine + Dormant Red-Team Capability Vault + Game-Day Activation Envelope proposal — substantial conceptual extension to the immune-governance work; explicitly NOT integrated this round per absorb-without-integrating discipline.
created: 2026-04-29
last_updated: 2026-05-02
depends_on: []
composes_with:
  - docs/research/escrowed/aurora-autonomous-flywheel-thesis-2026-04-28.md
  - B-0095
  - PR-707
tags: [aaron-2026-04-29, amara-2026-04-29, escrow-eligible, antigen-library, forbidden-patterns, red-team, ctf, game-day, dual-use, immune-governance, deferred-thesis]
---

# B-0096 — Forbidden Pattern Quarantine / Antigen Library — escrow-eligible candidate

## Source

Aaron 2026-04-29 forwarding Amara's substantive proposal for
preserving knowledge about forbidden patterns without making
them executable substrate. Amara's distillation:

> *Museum, not armory. Antigen library, not pathogen release.
> Quarantine, not canon.*

The proposal has three distinct-but-related concepts:

1. **Forbidden Pattern Quarantine** — antigen library; stores
   knowledge about dangerous patterns (metadata, redacted
   examples, hashes, safe toy analogs); Q0/Q1/Q2/Q3 levels by
   payload exposure.
2. **Dormant Red-Team Capability Vault** — capability
   definitions disabled by default; require activation envelope
   to use; maps to MITRE ATT&CK techniques.
3. **Game-Day / CTF Activation Envelope** — temporary
   permission wrapper; explicit who/what/when/where/logging/
   stop-conditions/postmortem.

## Why P3 + open (not yet escrowed)

Per the absorb-without-integrating discipline + the just-landed
escrow primitive (B-0094, B-0095): substantial conceptual
proposals from a single forwarding event should NOT be
integrated as live substrate, AND should NOT be promoted
directly to a research/escrowed/ file mid-flight. The bounded
shape is:

- File this backlog row as the canonical home for the proposal.
- Note it is escrow-eligible (the next step on graduation is
  promotion to `docs/research/escrowed/` per B-0094's pattern).
- Do NOT integrate any of the proposal's substrate into active
  canon, memory files, AGENT-BEST-PRACTICES.md, or skill
  files this round.

## The escrowed candidate concept (preserved verbatim)

```text
Forbidden Pattern Quarantine

Core rule:
  Forbidden patterns may be studied.
  They may not execute, propagate, train behavior, or become
  normal substrate.

Distinction:
  canonical memory  = what the system should use
  quarantine memory = what the system should recognize, explain,
                      and contain

Quarantine levels:
  Q0 — Metadata only (no payload)
  Q1 — Redacted specimen (defanged, recognizable but not
        reproducible)
  Q2 — Sealed specimen (exact content; non-indexed,
        access-gated; not loaded into agent context by default;
        not RAG-retrievable by default)
  Q3 — External-only reference (pointer/hash/source/reason in
        repo; content NOT in repo)

Default Q0 or Q1. Q2 requires explicit human review. Q3 for
legally sensitive / dangerous / employer-confidential / high-
risk material.
```

```text
Dormant Red-Team Capability Vault

Core rule:
  Knowledge can be retained.
  Capability stays dormant.
  Activation requires envelope.
  Execution stays gated.

Maps capabilities to MITRE ATT&CK technique IDs (e.g., T1090
Proxy for source-address-variation simulation). Capability
records define allowed_outputs (concept overview / detector
plan / lab simulation plan / postmortem template) vs
blocked_outputs (evasion playbook / bypass instructions /
public-target guidance / stealth optimization).
```

```text
Game-Day / CTF Activation Envelope

Temporary permission wrapper. Required fields: authorized_by,
capabilities, environment (lab / staging only), targets
(explicit allowlist), start/end time, logging_required,
data_retention, stop_conditions, postmortem_required.
```

## External lineage (from Amara's packet)

- **NIST zero trust** (SP 800-207): no implicit trust based on
  location/ownership; access authenticated/authorized before
  resource access. Anchors "it's in our repo doesn't mean
  agents may use it" rule.
- **Microsoft / CISA quarantine model**: detected threats moved
  to safe location, blocked from running; isolated environments
  for analysis. Anchors the museum-not-armory framing.
- **MITRE ATT&CK T1090 Proxy** + multi-hop proxy techniques.
  Anchors dual-use treatment of source-address-variation.
- **OWASP LLM01 prompt injection**: understanding ≠ normalizing
  payload as trusted instructions. Anchors the
  study-without-execute split.

## Aurora integration (sketch, NOT integrated)

If/when this graduates from escrow to active research, the
candidate Aurora mapping:

```text
ForbiddenPattern  ∈ A_quarantine   (new antigen class)
RedTeamCapability ∈ A_capability   (new antigen class)
ActivationEnvelope ∈ A_governance  (existing antigen class)

Execute(capability) = 1 iff
  capability.status = enabled_for_exercise
  ∧ activation_envelope.valid = 1
  ∧ target ∈ authorized_scope
  ∧ time_now ∈ authorized_window
  ∧ logging = enabled
  ∧ Danger ≤ θ
```

This is candidate substrate. NOT integrated into the minimal
Aurora bridge (PR #707). NOT integrated into the escrowed
flywheel thesis (B-0094). Independent escrow candidate.

## Naming preference (per Amara)

Avoid `forbidden/` directory naming (will attract attention
from agents and chaos goblins). Preferred names:

- `.quarantine/forbidden-patterns/` (hidden directory)
- `docs/immune/antigen-library/` (preferred — sounds like a
  lab, not a dare)
- `docs/immune/quarantine-index.md`

## Acceptance (for promotion from backlog → escrow)

When this row is ready to graduate to a research/escrowed/
file, the work shape is:

- [ ] Single canonical home picked (`docs/research/escrowed/
      forbidden-pattern-quarantine-2026-04-29.md` or
      `docs/immune/antigen-library/`).
- [ ] §33 archive header (Scope / Attribution / Operational
      status: research-grade / Lifecycle status: escrowed /
      Non-fusion disclaimer).
- [ ] Status header block (gate / reopen condition / multi-AI
      loop policy / expiration / created / last surfaced).
- [ ] Falsifier gate explicit (what would prove the quarantine
      separation is the wrong primitive?).
- [ ] Three-way concept split preserved (Quarantine vs
      Capability Vault vs Activation Envelope).
- [ ] Schema definitions captured per-concept.
- [ ] Composition with Aurora bridge (B-0094) named.
- [ ] Non-activation rule + bilateral-clarification carve-out
      per B-0094's escrow shape.

## What this row does NOT authorize

- Does NOT authorize creating an `antigen-library/` directory
  this round.
- Does NOT authorize integrating any quarantine schema into
  active memory files or skill files.
- Does NOT authorize sending the proposal back through the
  multi-AI synthesis loop.
- Does NOT authorize implementing the activation envelope
  mechanism in the autonomous-loop framework.

## Composes with

- **B-0094** — escrow primitive; this row eventually graduates
  to a sibling escrow file under that primitive's pattern.
- **B-0095** — escrow rules + naming-collision; sub-ask 3
  (migrate other deferred research) covers exactly this kind
  of substrate.
- **PR #707** — minimal Aurora bridge; the new antigen classes
  (A_quarantine, A_capability) would EXTEND the bridge if/when
  this graduates.
- **GOVERNANCE.md §33** — archive-header schema for the
  eventual escrow file.

## Pickup for future Otto

If picking up this row:

1. Decide canonical home (escrow-style file vs `docs/immune/`
   directory).
2. Create the escrow file with §33 header + status header
   block + falsifier gate.
3. Preserve the three-way concept split (Quarantine /
   Capability Vault / Activation Envelope) — they are
   related-but-distinct.
4. Add MITRE ATT&CK + NIST zero trust + OWASP LLM01 + CISA
   external lineage citations.
5. Status: escrowed (not active substrate).

## Why L effort

The proposal is conceptually substantial (3 distinct
primitives + schemas + Aurora integration sketch + external
lineage). Even a minimal escrow file would be ~200-300 lines
and require careful naming-expert review to avoid the
"forbidden/" attractor failure mode Amara names. Implementation
of the dormant capability + activation envelope mechanism
would be additional L-effort on top.

## The keeper distillation (preserved verbatim)

> *Museum, not armory.*
> *Vault, not runtime.*
> *Envelope before execution.*

> *Knowledge can be retained.*
> *Capability stays dormant.*
> *Activation requires envelope.*
> *Execution stays gated.*
