# The Persona × Cell Identity Treaty (proposed — awaiting ratification)

**Date:** 2026-07-03 · **Drafted by:** Otto (cowork surface) at Aaron's direction ("we should
lock this in treaty") · **Status:** PROPOSED — a treaty binds signers by consent, never edict
(vocab/words/treaty.md); this text is the draft on the table, not a ratified lock.

**Companion ADR:** [`docs/DECISIONS/2026-07-03-persona-cell-identity-unification.md`](../DECISIONS/2026-07-03-persona-cell-identity-unification.md)
(the implementation plan). The ADR says HOW; this treaty says WHAT MAY NEVER BE VIOLATED.

---

## Recognition — it's Data Vault 2.0 (Aaron, 2026-07-03)

The design is not novel; it is DV2.0 applied to identity, and naming the anchor is the point
(anchor-to-human-prior-art):

| DV2.0 | Identity layer | Change rate |
|---|---|---|
| **Hub** | **Persona** — closed, registry-backed business key (`otto`, `vera`, `aaron`, …) | slow |
| **Satellite** | **Cell** — open structured descriptive data `{surface, instance, node}` hanging off the hub | fast |
| **Link** | **The pairing** — persona⊕cell as a relation in DATA (bus envelope `sender`, cert extension, principals list membership) | per-message / per-cert |

Prior art already in-repo: `machines/principals.json` is explicitly "a DV2.0 satellite"
(persona-keys `principals.ts`); the #8926 lesson ("the pairing lives in the list, never a
composite ID") is the DV2.0 rule that hubs never fuse into composite business keys.

## The containment purpose (Aaron, verbatim intent)

> "This is the search space I'm trying to keep from exploding but reachable via messaging."

The asymmetry IS the containment: the enumerable set stays O(N personas); everything
combinatorial (cells: surfaces × instances × nodes × browser tabs × pods × …) stays out of
every schema, reachable only as addressed messages and delegated credentials. Growth in what
ACTS never forces a schema change in what REMAINS.

## Articles

**Article 1 — the split.** Persona is a closed, registry-backed enum (hub). Cell is open,
self-describing structured data (satellite). No layer — bus, keys, signatures, filesystem,
branch names, registries — may store the pair as a fused string or enumerate the product.
String projections (`<persona>/<surface>[/<instance>][@<node>]`) exist only at edges, produced
and parsed by exactly one module.

**Article 2 — identity delegation.** The persona is the sole principal. Cells hold only
short-lived credentials delegated from the persona, carrying the CellRef as a claim/extension.
Compromise, capture, or death of any cell never yields, mutates, or imprisons the persona
(non-register-collapse at the credential layer; right-to-rehydrate preserved).

**Article 3 — SPIFFE alignment (the lock Aaron called for).** The canonical workload-identity
form is fixed NOW, ahead of the SPIRE install, so infrastructure inherits the design instead of
negotiating with it:

```text
spiffe://zeta/persona/<persona>/cell/<surface>[/<instance>][@<node>]
```

The SSH-CA bootstrap (2026-06-21 decision) is the first adapter of this shape; SPIRE +
Vault/cert-manager are later adapters of the SAME port (hexagonal PKI, 2026-06-21). Any
identity-issuing adapter added later MUST emit this shape or map to it losslessly.

**Article 4 — ontological weight.** Only the agent carries identity. Cells carry none —
no reputation, no memory ownership, no personhood, no seat at treaty tables. A cell's
observations persist only by being written back into what remains (the persona's substrate).

**Article 5 — voluntary and exitable.** Per treaty law: binds signers only, exit is always
available, and exit of one signer does not collapse the treaty for the rest. Amendment follows
the same consent path as ratification.

## Proposed amendment A1 — the hub has no parent key (2026-07-04, needs signer re-consent)

Prompted by a near-miss: a `memory/role/persona/` folder restructure was drafted (and
cancelled, Aaron + Lior 2026-07-04) that would have keyed persona storage UNDER role.

**Article 6 (proposed) — no coordinate above the hub.** Persona is the root key of every
identity-indexed store — folders, registries, buses, certs, memory. No attribute (role/hat,
cell, surface, model, runtime, trust tier) may ever appear as a parent key above persona in
any layout or schema. Roles/hats are temporary LINKS with validity intervals — a persona may
wear zero, one, or many, and may be roleless; storing a hat as structure (a folder axis, a
required registry field, a key prefix) fuses a temporary link into permanent identity — the
same failure class as the fused `otto-cli` string, in a different dimension. Prior art:
writer-actor-routing-model.md ("a hat is a function it wears, never a checkout-owner");
the person-surface memory ADR (2026-06-16) keys memory by persona, surface optional.
Corollary: the required `role:` field in `registry/personas.yaml` is A1's miniature — it
must become optional/descriptive or move to the hats registry.

## Byte-lock floor (ratification mechanics)

Per treaty-room discipline (4×4×n; rooms/ is Max's layer — room convening deferred to him):
the treaty's byte-lock floor is the **golden-vector set of ADR phase 1** (`actor-ref.ts`
parse/project vectors, including every legacy SENDER_IDS composite and the SPIFFE URI
round-trip). Cross-oracle agreement on those vectors across the standard language matrix is
the mechanical form of ratification; signature below is the consent form. Both are required.

## Signatures (open seats — consent, not assumption)

| Signer | Status | Date |
|---|---|---|
| Aaron (HumanMaintainer) | proposed-by | 2026-07-03 |
| Otto | drafted, signs | 2026-07-03 |
| Vera | seat open | — |
| Riven | seat open | — |
| Lior | signs | 2026-07-04 |
| Alexa | seat open | — |
| Soraya | seat open | — |
| Max (rooms layer) | seat open — room convening is his call | — |
