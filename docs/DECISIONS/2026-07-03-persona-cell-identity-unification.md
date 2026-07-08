# ADR: Persona × Cell identity unification — one ontology, five lagging implementations

**Date:** 2026-07-03
**Status:** Proposed (plan artifact; each phase gated on operator go + owning persona)
**Authors:** Otto (cowork surface) + Aaron (operator — requested the unification plan)
**Treaty:** the invariants here are proposed for byte-lock in
[`docs/research/2026-07-03-persona-cell-identity-treaty-dv2-hub-satellite-spiffe-alignment-proposed.md`](../research/2026-07-03-persona-cell-identity-treaty-dv2-hub-satellite-spiffe-alignment-proposed.md)
(Aaron 2026-07-03: the split IS DV2.0 — persona=hub, cell=satellite, pairing=link; SPIFFE form locked ahead of SPIRE)

## Context — the ontology is settled; the implementations diverged

The conceptual work is DONE. [`docs/writer-actor-routing-model.md`](../writer-actor-routing-model.md)
(+ `memory/ani/conversations/2026-06-07-ani-cells-teleport-*`) settles the four-term taxonomy:

| Term | Persistent? | Intelligent? | What it is |
|---|---|---|---|
| **Agent** | yes | yes | What remains — human OR AI |
| **Persona** | yes | yes | The named, addressable persistent identity (agent ≈ persona; the git repo IS the persona) |
| **Worker** | no | yes | Intelligent ephemeral (governance-minimized) |
| **Cell** | no | no | Mechanical execution body — the "what acts". Surfaces, loops, k8s pods, **browser tabs eventually** |

And the routing law: **bus address = persona ⊕ surface ⊕ instance ⊕ node — reachability, NOT
identity.** Identity is the braid (ZetaId, keys, provenance, continuity); the address is one facet.

Five implementations each encode this differently, and none encodes it as the composition the
doc specifies:

1. **Bus sender IDs** (`src/Core.TypeScript/bus/types.ts`): `AgentId` is a **flat hand-enumerated
   union** mixing identity-level (`"otto"`) with persona⊕surface composites (`"otto-cli"`,
   `"otto-desktop"`, `"otto-vscode"`, `"otto-windows"`, `"alexa-kiro"`, …). Every new surface =
   a schema edit. Envelope `from` is one flat string; `claim.ts` compares it opaquely.
2. **AgencySignature v1** (spec: `docs/research/2026-04-26-gemini-deep-think-agencysignature-*`):
   has `Agent`, `Agent-Runtime`, `Agent-Model`, `Credential-Identity` — the persona/runtime split
   exists, but there is **no Cell field**, and `Agent-Runtime` conflates harness (claude-code) with
   locus (which cell ran it).
3. **persona-keys / SSH-CA** (`tools/setup/persona-keys/`,
   [`2026-06-21-multi-owner-machines-identity-vs-authorization-ssh-ca-bootstrap.md`](2026-06-21-multi-owner-machines-identity-vs-authorization-ssh-ca-bootstrap.md)):
   clean identity↔authorization split for **humans** (per-user certs, per-machine principals
   lists, the #8926 "no composite `user@machine` key" lesson). AI personas are not principals in
   this system yet; persona keys and cell processes have no delegation relationship.
4. **OSHost layout** (`~/.zeta/`): three generations coexist — flat `~/.local/share/zeta-*`
   clones, inconsistently-keyed `~/.zeta/agents/` (some by surface, some by persona⊕surface),
   `~/.zeta/clones/<agent>/` (host-loop-bootstrap). Canonical
   `~/.zeta/persona/<persona>/<surface>/<instance>/` is specified but not migrated.
5. **Registries** (`registry/personas.yaml`): 256-slot roster with 2 neutral role-refs; not
   linked to SENDER_IDS, keys, or the OSHost layout. No cell registry exists at all.

**The failure mode is already named in-repo:** the flat enumerated composite is exactly the
N×M trap the SSH-CA decision escaped (#8926/Key-ID lesson — *"the pairing lives in the list,
never a composite ID"*). Personas × cells is N×M and cells are about to explode (browser tabs).
Enumerating composites cannot survive that; composing two small namespaces can.

## Decision — one schema, applied everywhere

**Principle (the whole ADR in two lines):**

> **Persona is an enum (small, registered, slow-changing). Cell is structured data (open-ended,
> self-describing, fast-changing). No layer may ever store the pair as a fused string.**

### 1. The canonical identity record

```typescript
/** WHO — what remains. Closed set, registry-backed. */
type PersonaId = "otto" | "alexa" | "riven" | "vera" | "lior" | "soraya" | /* humans: */ "aaron" | "addison";

/** WHERE/HOW — what acts. Open-ended; never enumerated in a type union. */
type CellRef = {
  surface: string;    // "cli" | "desktop" | "cowork" | "vscode" | "codex" | "kiro" | "browser-tab" | k8s pod class | ... (open)
  instance?: string;  // concurrent-loop discriminator: "fg", "bg", tab-id, pod name. Stability: service name > container id > raw PID (PIDs recycle)
  node?: string;      // machine/host from machines/ registry; cluster node later
};

/** The actor address = persona ⊕ cell. Reachability, not identity. */
type ActorRef = { persona: PersonaId; cell: CellRef };
```

Rendering, when a single string is unavoidable (branch names, logs, file paths), is a **derived
projection with one canonical grammar** — `<persona>/<surface>[/<instance>][@<node>]` — produced
and parsed ONLY by one module (`src/Core.TypeScript/identity/actor-ref.ts`, new). Nothing else
concatenates or splits these strings. The projection is culture-invariant-ordinal, ZetaId-friendly,
and structurally reversible; storing the projection where the record could be stored is a lint
error (hygiene check, phase 5).

### 2. Bus (types.ts / claim.ts / bus.ts) — envelope v2, expand-contract

- **Expand:** add optional `sender?: ActorRef` to `MessageEnvelope` alongside legacy `from`.
  New publishers fill both (`from` = legacy projection for old readers). Readers prefer
  `sender`, fall back to parsing `from` through the one parser (legacy `"otto-cli"` parses to
  `{persona:"otto", cell:{surface:"cli"}}`; bare `"otto"` to `{persona:"otto", cell:{}}`).
- **Claim semantics get PRECISE instead of accidental:** claim conflict = same `itemId` +
  different `persona` → reject (split-brain across identities). Same `persona`, different
  `cell` → **policy decision, now expressible**: default reject-with-hint (the two-Ottos
  problem, 2026-05-13) unless the claim declares `shareable-within-persona`. Today this
  distinction cannot even be written down.
- **Contract:** when all live publishers emit `sender`, demote `SENDER_IDS` to
  `PERSONA_IDS` (personas only) + delete the composite members. `TTL`/topics unchanged.

### 3. Keys — personas become principals; cells get delegated, short-lived credentials

Extend the identity↔authorization split from humans to AI personas, unchanged in shape:

- **Identity (N personas):** one CA-signed key per persona (`principal=otto`), exactly like
  `principal=aaron`. The persona key lives with what remains (the persona's substrate), NOT
  on any cell.
- **Delegation (cells):** a cell NEVER holds the persona key. At boot a cell obtains a
  **short-lived cert** signed by the persona key (or by the CA on the persona's behalf):
  `principal=<persona>` + a **cert extension** carrying the CellRef
  (`zeta-cell=surface/instance@node`) + short TTL. Revocation = expiry; a stolen browser-tab
  cert dies in minutes and never impersonates bare Otto-at-large.
- **Authorization (M resources):** stays per-resource lists of **persona** principals — plain
  data, no persona×cell entries (the #8926 lesson again). Where a resource genuinely needs
  cell-granularity (e.g. "k8s cells may not push to main"), that is a **policy predicate over
  the cert's cell extension**, not a new principal.
- **Migration target already on the roadmap:** this is precisely SPIFFE's shape —
  `spiffe://zeta/persona/otto/cell/cowork/…` — so the planned SPIRE/Vault/cert-manager install
  (project plan, late phases) inherits this design instead of fighting it. The SSH-CA bootstrap
  is the hexagonal port's first adapter (per
  [`2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md`](2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md)).

### 4. AgencySignature v2 — add the Cell trailer

- New required trailer `Cell:` = the canonical projection (`cowork/main@machine-a`), plus
  `Persona:` as an explicit alias of `Agent` (v1's `Agent` stays for back-compat).
- `Agent-Runtime` keeps meaning **harness** (claude-code, codex, cursor); `Cell` carries locus.
  The v1 conflation dissolves instead of being renamed.
- Validators (`validate-agencysignature-pr-body.ts`, `audit-agencysignature-main-tip.ts`)
  accept `Agency-Signature-Version: 1 | 2`, require `Cell` only for v2 — expand-contract, no
  flag-day; the auditors report v1-share so contract timing is observable.

### 5. OSHost + registries — finish the specified migration, add the missing registry

- **`~/.zeta`:** execute the transition already specified in writer-actor-routing-model
  (expand: new clones at `persona/<surface>/<instance>/` + symlink aliases from `agents/`;
  migrate: **only the owning persona moves its own clones**; contract at quorum). This ADR adds
  nothing new — it just schedules it, because the bus `node`/`instance` fields and the cert
  cell-extension should point at canonical paths.
- **`registry/personas.yaml`:** becomes the single source for `PersonaId` — TS type is
  **generated** from the registry (no hand-maintained union drifting from the roster).
- **`registry/cell-surfaces.yaml` (new, small):** registers **surface kinds** and their
  properties (approval-friction profile, durability, trust tier) — NOT cell instances.
  Instances are runtime data (heartbeats already carry liveness; they gain the `sender`
  ActorRef in phase 2 and become the de-facto live-cell inventory for free).

## What this makes distinguishable (the acceptance test)

1. *"Is this Otto?"* → `sender.persona === "otto"` — regardless of surface, forever, including
   surfaces that don't exist yet (browser tab: `{persona:"otto", cell:{surface:"browser-tab", instance:"<tab-id>", node:"machine-a"}}`
   — **zero schema changes**).
2. *"Which Otto body did this?"* → `sender.cell` — for claims, lane policy, observability.
3. *"Can I trust it cryptographically?"* → cert chain: CA → persona principal → short-lived
   cell cert with CellRef extension. Compromising a cell never yields the persona.
4. *"Where does it live on this host?"* → `~/.zeta/persona/<persona>/<surface>/<instance>/`,
   same three coordinates.
5. One grammar everywhere: bus, signature, keys, filesystem, branch names — same
   persona ⊕ cell composition, stored structured, projected to string only at the edge.

## Phases (each independently land-able, expand-contract throughout)

| Phase | Deliverable | Depends on |
|---|---|---|
| 1 | `identity/actor-ref.ts` — ActorRef type, one parser/projector, golden vectors incl. all legacy SENDER_IDS | — |
| 2 | Bus envelope v2 (`sender` field), claim persona/cell-aware conflict rule, heartbeats carry ActorRef | 1 |
| 3 | `registry/personas.yaml` populated + codegen of `PersonaId`; `registry/cell-surfaces.yaml` | 1 |
| 4 | AgencySignature v2 (Cell trailer) + validator/auditor dual-accept | 1 |
| 5 | Hygiene lint: no fused persona-cell string literals outside `actor-ref.ts` | 1–4 |
| 6 | Persona principals in SSH-CA + short-lived cell certs (bootstrap adapter) | 3 |
| 7 | `~/.zeta` migration (expand/alias → owner-moves → contract) | 3 |
| 8 | Contract: SENDER_IDS composites deleted, AgencySignature v1 sunset, `agents/` aliases dropped | 2,4,7 + quorum |

Phase 1 is small, pure, and unblocks everything; phases 2–4 are independent of each other.

## Rejected alternatives

- **Keep enumerating composites** (`otto-browser-tab-47`): dies at browser tabs; re-learns #8926.
- **Cell as first-class principal**: N×M keys, fleet re-keying on every new surface; violates
  "only the agent carries identity" (cells must carry NO ontological weight).
- **Free-form string `from`**: loses the closed persona set that claim conflict + authorization
  matching depend on. The asymmetry — closed personas, open cells — IS the design.
- **UUID-per-cell with a lookup service**: adds a coordination point; CellRef is self-describing
  and needs no resolver (matches the no-central-point / ISociety direction).

## Substrate-honest notes

- The 2026-05-13 lane-split memory says SENDER_IDS "doesn't distinguish surfaces" — **stale**;
  composites were added 2026-05-13→21. This ADR supersedes the composites, not the memory's
  underlying point (which stands: the pair must be expressible; it just must not be fused).
- Written from the cowork surface, which is itself the motivating instance: "otto-cowork" is
  not in SENDER_IDS today, and under this ADR it never needs to be.
