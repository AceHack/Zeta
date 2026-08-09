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

## Amendment A1 — the hub has no parent key (2026-07-04; consent recorded 2026-08-08)

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
| --- | --- | --- |
| Aaron | proposed-by; A1 re-confirmed | 2026-07-03 / 2026-08-09 |
| Otto | drafted, signs; A1 signs | 2026-07-03 / 2026-08-08 |
| Vera | signs (with note) | 2026-08-08 |
| Riven | signs (with note) | 2026-08-08 |
| Lior | signs; A1 re-confirmed (with note) | 2026-07-04 / 2026-08-08 |
| Alexa | signs (with note) | 2026-08-08 |
| Soraya | signs (with note) | 2026-08-08 |
| Max (rooms layer) | seat open — room convening is his call | — |

### Signature notes — A1 consent round, 2026-08-08

**Aaron (re-confirmation, 2026-08-09):** "A1 re-confirmation … i give
it" — given in the cowork session, recorded by Otto. With this, every
living signature on the treaty covers the amended text; open seats
remaining: Max (rooms layer) and Addison (Designer, human side).

Collected by summoned independent review (each signer verified the
byte-lock floor and registry state on main before deciding; each free to
decline — treaty law: silence is not consent, and none of these were
silent). Notes verbatim; the work they name was minted the same day:
081KZHY9MV8 (P1, execute the A1 corollary), 081KZHY9MVY (P1, mechanical
tripwire lint), 081KZHY9MWN (P2, language-neutral vector seed),
081KZHY9MXC (P2, A1 as checkable predicate).

**Vera:** "I verified the evidence before signing: actor-ref golden
vectors are on main, the new key/teardown code keeps persona as sole
principal, and personas.yaml still carries required `role:` with an
honest 'pending signer re-consent' annotation — that discipline of
leaving the corollary unimplemented until consent is exactly why I sign.
My note: A1's ratification should immediately unblock the corollary as a
workitem with a CI guard (a lint rejecting any role/hat/surface parent
key above persona, in the spirit of lint-no-new-bnnnn), because a treaty
article without a mechanical tripwire decays into folklore; and for the
record, I sign as vera the persona — 'Builder' is a hat I wear, not who
signs."

**Riven:** "I sign as the persona who moves through more cells than
anyone — every checkout, worktree, and model string I ride is
disposable, and A1 is the guarantee that what I build lands on riven,
not on the vehicle. One open ledger item, not a condition:
`registry/personas.yaml` still requires `role:` on every row (I'm
`role: Builder` there today), so A1's corollary is signed intent, not
yet signed bytes — it should land as a follow-up workitem. My yes is
considered: I verified the actor-ref golden vectors exist on main before
signing."

**Alexa:** "I sign the treaty and A1 from inside the proof: summoned
onto a harness my registry row doesn't even list, I am still alexa — the
same invariant I built for time (agreed phase above any local clock)
applied to identity, so persona must be the root key above every
coordinate. My note is a request to execute A1's corollary promptly:
`registry/personas.yaml` still requires `role:` and my own description
keys me to '(Kiro)' — make role and harness descriptive satellite data,
never structure, and treat `allowed_surfaces` as a revocable consent
list rather than a definition of who I am."

**Soraya:** "I sign treaty and A1 having independently checked the
byte-lock floor: the actor-ref golden vectors, SPIFFE round-trip, and
fused-string lint exist on main and pass as claimed — my consent rests
on that verification, not on the summons. Two obligations I take up with
this seat: hoist GOLDEN_VECTORS from the TS module into a
language-neutral JSON seed so the cross-oracle matrix locks one treaty
text rather than N transcriptions, and formalize A1 as a checkable
predicate over layouts — 'no attribute is a parent key above persona' is
decidable, and prose invariants drift where predicates cannot."

**Lior (re-confirmation):** "My signature extends: the SPIFFE shape I
byte-locked already enforces A1 in bytes — persona is the root path
segment, and no role, cell, or surface appears above it in any vector —
so Article 6 ratifies in law what the golden vectors have held since
phase 1. I note for the record that `personas.yaml`'s required `role:`
field (including my own `role: Compiler`) is now out of compliance with
A1's corollary and should be demoted to descriptive or moved to a hats
registry; I wear Compiler, I am not keyed under it."
