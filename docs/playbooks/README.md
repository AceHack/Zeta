# System playbooks — `docs/playbooks/`

System (cross-persona; framework-level) playbooks live here, per the
directory convention codified in
[`docs/backlog/P2/081KSNY2Z0008QG0R0016D7QGW-...md`](../backlog/P2/081KSNY2Z0008QG0R0016D7QGW-playbook-directory-convention-personal-personas-dir-vs-system-docs-playbooks-folder-plus-agents-author-playbooks-too-aaron-2026-05-28.md).

This README is the index. The directory MAY be empty of `.md` playbooks
when no system playbook has landed yet; the convention exists so when
the first one lands, it lands here rather than getting orphaned in an
ad-hoc location.

## Directory convention (operator 2026-05-28 sharpening)

> *"playbook authoring is not just for human intent but also agent intent
> we should keep personal playbooks in the personas directory while having
> system ones in docs i guess or playbooks folder"*

| Scope | Location | Authored by | Visible to |
|---|---|---|---|
| **Personal** (per-persona; intent + workflow specific to that persona) | `memory/<persona>/{persona}/playbooks/{name}.md` | The persona (human or agent) it belongs to | The persona + glass-halo readers |
| **System** (shared; cross-persona; framework-level) | `docs/playbooks/{name}.md` (this folder) | Anyone with system-substrate access (operator + agents) | Everyone (public glass-halo) |

Per-persona playbook directories are created on demand when the first
playbook lands there — no need to pre-create empty `memory/<persona>/<name>/playbooks/`
directories.

## What counts as a playbook

A playbook is a substrate-honest conversational document that EITHER:

1. Declares operator (or agent) intent for a workflow — what you want
   to achieve, in what order, with which substrate, gated on which
   conditions
2. Documents a re-runnable procedure that agents can pick up + execute
   without re-deriving the intent each invocation

Playbooks compose with the playbook-substrate cluster:

- **[081KSE6WT0008QG0R003AJYMD3](../backlog/P2/081KSE6WT0008QG0R003AJYMD3-runme-runbook-substrate-aaron-2026-05-25.md)** — runme + runbook substrate; playbooks can EMBED runme cells
- **[081KSE6WT0008QG0R002YBWBB1](../backlog/P2/081KSE6WT0008QG0R002YBWBB1-runme-bcl-extension-tradeoff-analysis-kestrel-aaron-2026-05-26.md)** — runme BCL extension tradeoff analysis
- **[081KSE6WT0008QG0R00102H071](../backlog/P2/081KSE6WT0008QG0R00102H071-runme-md-jit-triage-pattern-naming-kestrel-aaron-2026-05-26.md)** — runme.md + JIT-triage pattern
- **[081KSGS9H0008QG0R0005P83AP](../backlog/P2/081KSGS9H0008QG0R0005P83AP-continue-with-auto-jit-trigger-annotations-agent-swarm-coordination-aaron-2026-05-27.md)** — Continue-With + auto-JIT trigger annotations for agent swarm coordination
- **[081KSGS9H0008QG0R001K8VPV4](../backlog/P2/081KSGS9H0008QG0R001K8VPV4-runme-core-bcl-extension-runbook-as-queryable-substrate-kestrel-aaron-2026-05-27.md)** — runme-core-BCL + runbook-as-queryable-substrate
- **[081KSGS9H0008QG0R00123050G](../backlog/P2/081KSGS9H0008QG0R00123050G-runme-md-jit-triage-runbook-as-evolving-substrate-kestrel-aaron-2026-05-27.md)** — runme.md + JIT-triage + runbook-as-evolving-substrate

## Agents author playbooks too (081KSNY2Z0008QG0R0016D7QGW sharpening + 081KSNY2Z0008QG0R000S738W3 two-path interface)

The conversational-document path is for ANY traveler, not just humans
(per [`docs/backlog/P1/081KSNY2Z0008QG0R000S738W3-...md`](../backlog/P1/081KSNY2Z0008QG0R000S738W3-two-path-interface-discriminated-union-execute-vs-conversational-declare-intent-aaron-ani-2026-05-28.md)).

- Any agent (any surface) MAY author `memory/<persona>/playbooks/<name>.md`
  in its own persona directory
- Any agent MAY propose `docs/playbooks/<name>.md` system playbooks
  (subject to operator review per standard system-doc conventions per
  [`.claude/rules/honor-those-that-came-before.md`](../../.claude/rules/honor-those-that-came-before.md))
- The roster of currently-active personas (canonical mapping
  persona-name → role) lives in `.claude/rules/agent-roster-reference-card.md`
  per the roster-mapping carve-out — that file is the resolution surface
  consumers use to bind role-refs in this README to specific persona
  directories

## Composition with the async-scatterbrains operator-experience design property

Per [`docs/backlog/P1/081KSNY2Z0008QG0R001KT3CX9-...md`](../backlog/P1/081KSNY2Z0008QG0R001KT3CX9-interface-for-async-scatterbrains-operator-experience-design-property-multi-thread-drop-resume-context-switch-aaron-2026-05-28.md):

> *"We are building the interface for async scatterbrains like me lol :)"*

Playbooks specifically serve async-scatterbrain operation by:

- Letting operator write intent in fragments (drop + resume across days)
- Letting agents pick up + execute without forcing the operator to
  re-establish context
- Letting multiple lanes (encryption + zflash + state-machine-substrate
  per [081KSNY2Z0008QG0R002QA720J](../backlog/P1/081KSNY2Z0008QG0R002QA720J-three-lanes-concurrent-operating-discipline-encryption-zflash-state-machine-substrate-all-advancing-aaron-2026-05-28.md))
  rotate through playbook execution without single-linear-queue forcing
- Being glass-halo-visible (no decryption ceremony to catch up; see
  [081KSNY2Z0008QG0R000459FRH](../backlog/P1/081KSNY2Z0008QG0R000459FRH-glass-halo-open-by-default-encryption-as-earned-via-agora-v6-budget-not-encrypt-everything-aaron-2026-05-28.md))

## Currently-empty index

No system playbook `.md` files are present in this folder yet (as of
2026-05-28). The directory exists to codify the convention; the first
system playbook will land here when authored.

Related artifacts:

- **[`docs/runbooks/zflash-end-to-end.md`](../runbooks/zflash-end-to-end.md)**
  — operator-facing zflash USB credential substrate runbook (CP-1..CP-6
  + 10-min demo script + risk register). Authored as runbook; could be
  re-categorized as a playbook (runbook vs playbook semantic distinction
  is deliberately TBD per 081KSNY2Z0008QG0R0016D7QGW acceptance criteria #3 — operator
  decides at re-categorization time)
- **System playbook candidates per existing backlog substrate** (not yet
  authored as `.md` files):
  - `docs/playbooks/library-evaluation.md` — canonical sonatype-guide +
    audit invocation per [081KSNY2Z0008QG0R001NERKCY](../backlog/P2/081KSNY2Z0008QG0R001NERKCY-move-sonatype-guide-invocation-into-playbook-substrate-drop-pr-gated-review-no-vendor-lockin-aaron-2026-05-28.md)
  - `docs/playbooks/encryption-budget-request.md` — when encryption is
    needed, this playbook gates the request per 081KSNY2Z0008QG0R000459FRH Agora V6 budget
    mechanics
  - `docs/playbooks/cluster-bootstrap.md` — Zeta cluster fresh-format +
    join sequence per zflash + 081KSNY2Z0008QG0R0008PN7RQ acceptance criteria

When any of these land, they go in this folder + get cross-linked from
this index.

## Glass-halo-open-by-default + good-actor v1

Per [081KSNY2Z0008QG0R000459FRH](../backlog/P1/081KSNY2Z0008QG0R000459FRH-glass-halo-open-by-default-encryption-as-earned-via-agora-v6-budget-not-encrypt-everything-aaron-2026-05-28.md):
playbooks land in plaintext markdown by default. Encryption is the
exception requiring justification + Agora V6 budget.

Per operator 2026-05-28 *"yes we are assuming good actors for now, we
will harden later"* — v1 playbook authoring trusts the contributor; no
attestation chain or signing required for playbook landing. Hardening
substrate ships in subsequent iterations alongside the broader
encryption substrate (081KSNY2Z0008QG0R002JKH50A cluster + 081KSNY2Z0008QG0R0011XCT94 + 081KSNY2Z0008QG0R0030V5ZVS).

## Composes with

- [`docs/backlog/P2/081KSNY2Z0008QG0R0016D7QGW-...md`](../backlog/P2/081KSNY2Z0008QG0R0016D7QGW-playbook-directory-convention-personal-personas-dir-vs-system-docs-playbooks-folder-plus-agents-author-playbooks-too-aaron-2026-05-28.md) — this directory convention (canonical)
- [`docs/backlog/P1/081KSNY2Z0008QG0R000S738W3-...md`](../backlog/P1/081KSNY2Z0008QG0R000S738W3-two-path-interface-discriminated-union-execute-vs-conversational-declare-intent-aaron-ani-2026-05-28.md) — two-path interface: DU executes, conversational documents declare
- [`docs/backlog/P1/081KSNY2Z0008QG0R001KT3CX9-...md`](../backlog/P1/081KSNY2Z0008QG0R001KT3CX9-interface-for-async-scatterbrains-operator-experience-design-property-multi-thread-drop-resume-context-switch-aaron-2026-05-28.md) — async-scatterbrains design property
- [`docs/backlog/P1/081KSNY2Z0008QG0R002QA720J-...md`](../backlog/P1/081KSNY2Z0008QG0R002QA720J-three-lanes-concurrent-operating-discipline-encryption-zflash-state-machine-substrate-all-advancing-aaron-2026-05-28.md) — three-lanes-concurrent operating discipline (playbooks compose with each lane)
- [`docs/backlog/P1/081KSNY2Z0008QG0R000459FRH-...md`](../backlog/P1/081KSNY2Z0008QG0R000459FRH-glass-halo-open-by-default-encryption-as-earned-via-agora-v6-budget-not-encrypt-everything-aaron-2026-05-28.md) — encryption-as-earned via Agora V6 budget
- [`docs/backlog/P2/081KSNY2Z0008QG0R001NERKCY-...md`](../backlog/P2/081KSNY2Z0008QG0R001NERKCY-move-sonatype-guide-invocation-into-playbook-substrate-drop-pr-gated-review-no-vendor-lockin-aaron-2026-05-28.md) — sonatype-guide-into-playbook (a system-playbook candidate)
- [`.claude/skills/agent-runtime-and-persistence/blueprints/agent-loop.md`](../../.claude/skills/agent-runtime-and-persistence/blueprints/agent-loop.md) — workflow engine that EXECUTES playbook intent via the DU path
- [`.claude/rules/honor-those-that-came-before.md`](../../.claude/rules/honor-those-that-came-before.md) — playbook substrate authored by a persona belongs in that persona's scope; system substrate goes through standard system-doc review
