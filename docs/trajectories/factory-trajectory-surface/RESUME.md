# Trajectory - Factory Trajectory Surface

Status: seed replacement packet
Last refreshed: 2026-05-06
Supersedes: PR #659 (`docs/trajectories-pattern-2026-04-28`) as the landing
path for the trajectory concept, not as historical provenance.

## Why This Exists

PR #659 tried to introduce a broad trajectory surface on 2026-04-28. By
2026-05-06 that branch is stale: it is dirty against `main`, spans 24 files,
includes `memory/MEMORY.md` and a feedback memory file, and carries 67
unresolved review threads. Reviving it in place would spend review energy on
old diff context instead of preserving the trajectory concept in the current
factory shape.

This packet is the replacement anchor. It keeps the concept, narrows the first
landing, and makes future trajectory packets recursive and reviewable.

## Trajectory vs Workstream — genus / species + focus capacity

The factory already distinguishes these: `anti-infection/RESUME.md` self-describes
as "not a workstream with a cadence" and refers to "those workstreams" it
protects. Made explicit here (the human maintainer 2026-05-29):

- **Trajectory = the genus.** Any tracked path through state-space over time —
  including emergent arcs, *states* (`autonomous-loop-quiet-state`), *postures*
  (`anti-infection`), and *disciplines* (`trajectory-drift-reporting`). A
  trajectory can be unowned and uncadenced; it is descriptive. There can be many.
- **Workstream = the species, and a current-focus status.** A trajectory the
  operator is *actively powering* — owned, cadenced, deliverable-bearing.
  Physics anchor: a workstream is a trajectory under *sustained thrust toward an
  attractor*. Because thrust budget (operator + agent focus) is finite, only a
  few trajectories can be workstreams at once — the rest *coast* (still tracked,
  still moving, no active thrust). "Workstream" is therefore not a permanent
  tag; it is the active-focus subset, capacity-/WIP-bounded. A coasting
  trajectory becomes a workstream when thrust is applied; a workstream reverts to
  a plain trajectory when focus moves on.

Operationally: tag a RESUME.md `Type: workstream (current-focus)` only while it
is in the active set; drop or mark it coasting when it leaves. The genus surface
(`docs/trajectories/`) holds both; the workstream designation is a property of
*now*, not of the trajectory's identity.

Eventual encoding (design-stage): a trajectory's state is trackable as a
**128-bit genetic-ID seed** (discrete, reversible via parser-combinator ↔
generator-function; the human maintainer 2026-05-23) → **Clifford-space path** (continuous
geometric home, eventual). Mirrors the three-lane glossary model's I8
(discrete hash-lattice) / I9 (continuous embedding-manifold) split applied to
trajectories.

## Current Workstreams (active-focus set, 2026-05-29)

The operator's three current cluster-bringup workstreams — surfaced as
trajectories 2026-05-29 (previously head-only, which is how the third was nearly
forgotten):

- [`cluster-encryption-credential-substrate`](../cluster-encryption-credential-substrate/RESUME.md) — credential/secret security layer (081KSGS9H0008QG0R002T3BJ2R / 081KSKBP80008QG0R003AX2A69 / 081KSGS9H0008QG0R003JNSVR5 / 081KSKBP80008QG0R000Y2B7HC)
- [`usb-zflash-installer`](../usb-zflash-installer/RESUME.md) — USB NixOS installer + zflash flashing (zflash.ts / 081KSGS9H0008QG0R001EZKNCB / 081KSGS9H0008QG0R0011BC7T2)
- [`ts-workflow-engine-du-state-machine`](../ts-workflow-engine-du-state-machine/RESUME.md) — workflow-engine-as-skill, F# DU state-machine + Git append-only (agent-loop skill / 081KSKBP80008QG0R000B3Y19A / 081KSNY2Z0008QG0R0036KH026 / 081KSKBP80008QG0R0031DTHS9)

## Current Rule

A trajectory packet is a durable lane state file, not a giant branch.

Minimum shape:

- `docs/trajectories/<slug>/RESUME.md`
- status and last refreshed date
- current next action
- active blockers
- evidence links to backlog rows, PRs, research docs, or review archives
- explicit supersession links when replacing older work

If a trajectory grows too large, split it into child packets instead of adding
more sections to one file.

## Operating Rule — Enhance As We Go

Trajectory is the first new-work surface. Backlog is the decomposition ledger,
not a grab bag for random feature work. When a loop sees a bounded broken thing
inside its claim scope, it fixes that thing directly. When the work is too
large, ambiguous, or multi-lane, it decomposes the work into backlog rows and
trajectory child packets before implementation.

The loop shape is:

```text
observe evidence -> fix bounded breakage
observe broad work -> decompose into backlog / trajectory substrate
observe trajectory drift -> update or split the trajectory packet
```

Do not let maintenance masquerade as growth. Do not let backlog masquerade as
execution. Do not let a trajectory become a giant branch. The trajectory packet
remembers the lane, the backlog remembers the atomic work, and decomposition is
the bridge between them.

## Operating Rule — Anomaly Escalation

An anomaly is evidence, not intent. Scale the investigation to the size and
shape of the residue:

```text
small anomaly -> investigate locally, patch if bounded, keep moving
large anomaly -> investigate before acting, decompose the work if needed
repeat / double-down shadow -> involve other agents and record the cross-agent catch
```

Do not turn every small anomaly into a council. Do not solo-rationalize a large
one. When the residue is small, inspect it and fix the bounded breakage. When
the residue is large, recurring, or defended by a rationalization loop, bring
in another mirror before the story hardens.

## Current Known Trajectory Substrate

- `docs/trajectories/typescript-bun-migration/RESUME.md` is the live example of
  a trajectory packet with a resume surface and linked evidence.
- `docs/backlog/P1/081KQR4HQ0008QG0R001909FPT-memory-substrate-engineering-trajectory-aaron-2026-05-04.md`
  names the memory substrate-engineering trajectory.
- `docs/backlog/P3/081KQTPYE0008QG0R000ZJ2GW8-multi-trajectory-validation-basis-instrumentation-aaron-2026-05-05.md`
  names the six-axis validation surface for multi-trajectory measurement.
- `docs/SAFE-AUTONOMOUS-ACTIONS.md` already treats trajectory drift as a
  report-only autonomous action surface.

## Replacement Plan For PR #659

1. Land this packet as the current trajectory-surface anchor.
2. Open focused child packets only when a lane has a clear owner and next
   action.
3. Cite PR #659 as superseded provenance, not as an active branch to drain.
4. Close PR #659 after the replacement packet lands and is linked from the
   triage claim or follow-up PR.

## Next Child Packets

Candidate child packets, each intentionally small:

- none currently selected

Do not create all of them in one PR. The rule is recursive decomposition:
large trajectory blobs become smaller packets, then smaller packets become
atomic next actions.

## Created Child Packets

- `docs/trajectories/alignment-measurement/RESUME.md`, grounded in 081KQTPYE0008QG0R000ZJ2GW8
- `docs/trajectories/memory-substrate-engineering/RESUME.md`, grounded in
  081KQR4HQ0008QG0R001909FPT
- `docs/trajectories/autonomous-loop-coordination/RESUME.md`, grounded in
  081KQX9B50008QG0R001MNYK61 and 081KQX9B50008QG0R0026BG44J
- `docs/trajectories/trajectory-drift-reporting/RESUME.md`, grounded in
  `docs/SAFE-AUTONOMOUS-ACTIONS.md`
- `docs/trajectories/autonomous-backlog-pickup/RESUME.md`, grounded in 081KQZVQW0008QG0R000C35RNY
  and children 081KR2E4K0008QG0R001GFXN05 through 081KR2E4K0008QG0R002FSPPQR
- `docs/trajectories/cluster-encryption-credential-substrate/RESUME.md` —
  workstream; grounded in 081KSGS9H0008QG0R002T3BJ2R / 081KSKBP80008QG0R003AX2A69 / 081KSGS9H0008QG0R003JNSVR5 / 081KSKBP80008QG0R000Y2B7HC (2026-05-29)
- `docs/trajectories/usb-zflash-installer/RESUME.md` — workstream; grounded in
  `full-ai-cluster/tools/zflash.ts` + 081KSGS9H0008QG0R001EZKNCB / 081KSGS9H0008QG0R0011BC7T2 / 081KSGS9H0008QG0R003V23XNZ (2026-05-29)
- `docs/trajectories/ts-workflow-engine-du-state-machine/RESUME.md` —
  workstream; grounded in `.claude/skills/agent-loop/` + 081KSKBP80008QG0R000B3Y19A / 081KSNY2Z0008QG0R0036KH026 /
  081KSKBP80008QG0R0031DTHS9 (2026-05-29)
