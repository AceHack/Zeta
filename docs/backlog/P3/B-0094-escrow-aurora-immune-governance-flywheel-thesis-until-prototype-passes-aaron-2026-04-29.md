---
id: B-0094
priority: P3
status: escrowed
title: Escrow Aurora Immune Governance flywheel thesis until prototype passes
tier: research-deferred
effort: M
ask: Aaron 2026-04-29 via Amara translation — *"This is not rejected. It is escrowed. The thesis is important enough that we do not let it land sloppily."*
created: 2026-04-29
last_updated: 2026-04-29
composes_with:
  - B-0089
  - B-0093
  - PR-707
tags: [aaron-2026-04-29, escrow, research-deferred, aurora-immune-governance, flywheel-thesis, mimetic-coupling, falsifier-gated, session-closure-rule, restraint-discipline]
---

# B-0094 — Escrow Aurora Immune Governance flywheel thesis until prototype passes

## Source

Aaron 2026-04-29, via Amara's translation of Aaron's intent
after the multi-AI Aurora-Immune-Governance synthesis arc:

> *"This is not rejected. It is escrowed. The thesis is
> important enough that we do not let it land sloppily.
> Don't bury it, don't bloat it, and don't rush it. Put it
> in escrow and make it earn its way into the system."*

The harsh pushback from external-AI second-opinion-reviewer
across two consecutive rounds was protecting the thesis,
not killing it: the synthesis was diagnosing the exact
pathology it was exhibiting (`r_flywheel_capture` —
momentum increasing while evidence quality flat). The
disciplined response is to preserve the thesis without
integrating it before the prototype runs.

## Why P3 + escrowed status

Escrow is the bounded-preservation status, not the
deferral-of-work status. The thesis components survive
session boundaries via this row + the conversation-log
pointers below. The thesis cannot be lost; it also cannot
land prematurely.

## The escrowed thesis (verbatim)

```text
The factory is a network of autonomous desire-bearing flywheels.

Girard / Wanting explain how desire, imitation, rivalry,
scapegoating, and shared common-good pursuit move through
the network.

Infer.NET-style probabilistic inference gives the
computational shape for modeling correlated belief, mimetic
coupling, and evidence updates.

The immune membrane supplies the action layer: detect
danger, gate execution, quarantine, require proof, record
memory, and prevent thin/rivalrous flywheels from capturing
the factory.
```

Short form:

```text
The first sub-thesis names why consensus can lie.
The second names what the desire is aimed at.
The third names how to model correlated belief.
The fourth names when belief is allowed to act.
```

Flywheel rule (parking lot):

```text
Momentum is not validation.
Momentum is desire under acceleration.
The immune system must inspect what the desire is aimed at.
```

## Current boundary (escrow constraints)

While ESCROWED, the thesis MUST NOT:

- Be added to the minimal Aurora bridge research note as
  appendix
- Be sent through another multi-AI synthesis loop
- Mutate any existing operational rule body or memory file
- Become the basis for new substrate creation

The thesis MAY:

- Be cited from this row by future research notes after
  the falsifier-gate opens
- Be discussed verbally / in conversation logs
- Be referenced as candidate substrate from history surfaces

## Falsifier gate (load-bearing)

The thesis advances from ESCROWED to ACTIVE-RESEARCH only
when ALL of the following hold:

1. The minimal Aurora Immune Governance Bridge research
   note (now landed at
   `docs/research/aurora-immune-governance-bridge-minimal-2026-04-28.md`)
   has run its first prototype: the Candidate-count
   scanner self-destruct test.
2. The prototype has produced a measurable result —
   pass or fail, recorded.
3. If the prototype passes: the thesis may reopen as
   ONE focused research note (e.g. `docs/research/
   autonomous-flywheel-network-appendix-candidate-<date>.md`),
   NOT as bridge-note expansion.
4. If the prototype fails: revise the bridge first, then
   re-evaluate whether the thesis still earns its place.

Until at least conditions 1 + 2 hold, this row's status
remains `escrowed`.

## Required order before reopening

Per the converged cross-AI stance:

1. Land / confirm the minimal bridge substrate — DONE
   (PR #707 merged 2026-04-29T00:59:23Z).
2. Confirm durable homes for the round's already-named
   rules. Specifically:
   - `docs/CONTRIBUTOR-COMPLIANCE.md` per B-0092 — NOT
     YET LANDED.
   - Candidate-count Goodhart glossary entry in
     `docs/GLOSSARY.md` — NOT YET LANDED.
   - Trajectory-owners table — pending B-0093.
   - Session-closure rule in
     `docs/AGENT-BEST-PRACTICES.md` — IN FLIGHT
     (PR #712).
3. Run the Candidate-count scanner self-destruct
   prototype.
4. Report pass/fail.
5. Only after step 4 produces a result, reopen the
   thesis as the next research layer.

## Preservation pointers

The full thesis content lives in the conversation log
from the 2026-04-28 session. Specifically the multi-AI
synthesis packets including:

- Mimetic-coupling discount (carrier-exposed agreement
  is signal not proof)
- Object-drift detection
  (`Drift_i(t) = distance(O_i(t), O_i*)` × `Momentum_i(t)`)
- Cycle 1 / Cycle 2 classification of flywheels
- Thin vs thick desire (`r_thin_desire_capture(a)`)
- Model proximity as rivalry-contamination predictor
- Attribution as mimetic object (provenance-truth vs
  status-rivalry)
- Autonomous flywheel network (no central flywheel;
  immune membrane regulates coupling)

Future-Claude or future-Aaron picking up this thread
should read:

- This row (entry point)
- `docs/research/aurora-immune-governance-bridge-minimal-2026-04-28.md`
  (the minimum viable bridge that grounds the thesis)
- `memory/feedback_pr_boundary_restraint_validation_bead_promoted_aaron_amara_2026_04_29.md`
  (the validated bead the thesis composes with)
- The conversation log around 2026-04-28 / 2026-04-29
  for the full multi-AI synthesis packets

## Composes with

- **B-0089** — Veridicality.fs graduation roadmap (the
  formal scoring substrate the thesis would integrate
  with if and when it advances).
- **B-0093** — Multi-AI synthesis enhancements (where
  several of the thesis components were originally
  noted as candidate substrate).
- **PR #707** — minimal Aurora Immune Governance Bridge
  research note (the artifact this thesis would extend).

## Acceptance (for status transition out of escrow)

- [ ] Candidate-count scanner self-destruct prototype
      run with measurable result recorded.
- [ ] Result documented in tick-history and / or
      `docs/research/`.
- [ ] If pass: this row's status moves to
      `active-research` and the thesis reopens as ONE
      focused research note.
- [ ] If fail: bridge revision row filed, this row
      remains `escrowed`.

## Why M effort

Setting up the prototype + running it + recording the
result is M-effort. The actual thesis development (if
the prototype passes) is L-effort and is its own
separate row to be filed at that time, not subsumed
under this one.

## What this row does NOT authorize

- Does NOT authorize reopening the thesis before the
  prototype runs.
- Does NOT authorize bridge-note expansion.
- Does NOT authorize new memory files encoding any of
  the escrowed thesis components as load-bearing.
- Does NOT authorize sending the thesis back through
  another multi-AI synthesis loop.

## The canonical phrase

> *"Escrow protects the thesis from both forgetting and
> premature canonization."*

That balance — survive session boundaries without becoming
active substrate — is what this row encodes.
