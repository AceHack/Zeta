# Clean-room: whoever LOOKED may not BUILD

Carved sentence:

> When prior art is examined that we do not own the rights to — a former employer's
> source, a licensed spec, any third-party implementation — the agent who **looked**
> writes only a **functional specification** and is then **barred from implementing it**.
> A **different, named agent that has never seen the original** implements from the spec
> alone. Two teams, one wall: *dirty side* observes and specifies; *clean side* builds.
> The spec crossing the wall carries **requirements, never expression** — no borrowed
> type names, file layouts, call sequences, or structure. Route the build explicitly to a
> fresh agent and say in the handoff that the wall exists.

## Why this is a routing rule and not just advice

The protection is **independent derivation**, and it is destroyed by a single agent doing
both halves — however careful that agent is, the implementation is then *derived from* the
original by definition. Because agents are dispatched programmatically here, the wall is
enforced by **who you route the work to**, which makes this an operational rule: if the
observer implements, there is no clean room, and no amount of paraphrasing fixes it.

Corollary worth stating because it is tempting and wrong: **"make it N% different" is not
a defense.** There is no percentage threshold that makes a derivative work
non-infringing, and reasoning "how do we change it enough" *presupposes* deriving from the
original — conceding the very thing the wall protects. Design from requirements.

## The wall in practice

1. **Dirty side** (the agent that opened the material): records *what the system must do*
   and *why* — capabilities, invariants, forcing cases. Never how the original did it.
2. **The spec is reviewed for expression leakage** before it crosses: names, ordering,
   structure, and anything that reads like a transcription rather than a requirement.
3. **Clean side** (a different named agent, no exposure): implements from the spec, and
   must be *told* it is the clean side so it does not go looking for the original.
4. The handoff records **who was contaminated and when**, so provenance is legible later.

## Pointers

- `feedback_metering_protocols_..._cleanroom_itron_concept_not_code_2026_06_01.md` (**not in-repo**)
  — the origin: paid specs + hand-implementation give genuine first-hand expertise; the
  expertise is usable, the code is not.
- `user_aaron_built_itron_mesh_hardware_firmware_pki_secure_boot_...` (**not in-repo**) — and the
  standing inversion: those patents are **centralized**, Zeta is decentralized, so
  Itron-shaped centralized designs are never the answer here anyway.
- [`anchor-to-human-prior-art.md`](anchor-to-human-prior-art.md) — anchoring names the
  lineage; this rule governs what may be *copied* from it (nothing) versus *learned* from
  it (the requirement).
