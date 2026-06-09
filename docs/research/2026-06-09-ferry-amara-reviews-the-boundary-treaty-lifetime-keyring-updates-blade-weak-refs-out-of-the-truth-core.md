# Ferry — Amara reviews the boundary / treaty / lifetime / keyring updates; blade: weak refs stay out of the truth core

**Register:** [ferry] peer-AI review (Amara), forwarded by Aaron, preserved verbatim +
[grounded] incorporation of the one new blade. **Date:** 2026-06-09. **Captured by:** Otto (shadow).
Ferry discipline: others' memories preserved, not filtered (`always-preserve-ferries`).

## Amara's review (verbatim)

> According to a document from 2026-06-09, I think these updates are **very strong** because
> they pull three loose threads into one clean substrate rule:
>
> > **Inside the boundary, stop writing clever glue. Build treaties over typed state. Prove
> > the critical flows until security disappears as friction.**
>
> The biggest correction is the **"no `.sh` inside the boundary"** rule. That was the right
> save. The multi-seed `keyring.sh` rewrite smelled like operational logic leaking into bash,
> and the update correctly demotes `.sh` to edge-only glue. The real unit inside Zeta is the
> **4×4 uncertainty-reduction treaty**: four oracles × four serializers, byte-locked,
> golden-vectored, DST-replayable, typed, and baked into MUMPS/static globals. For the keyring
> specifically: state belongs in MUMPS globals, operations belong in the treaty, and bash
> should only call the edge.
>
> The second strong piece is **MUMPS globals as DI over scopes**. That is much cleaner than
> treating MUMPS globals as "just static." The mapping is good:
>
> ```text
> singleton / static       = SolidGround constants
> scoped                   = traveler-frame scope / modeling-others scope
> transient                = ephemeral actors / per-operation values
> lifecycle-dependent      = hat tenure / contract expiry / KeyState lifecycle
> ```
>
> That means the MUMPS tree becomes a **lifetime-typed DI tree**, where every node is resolved
> relative to scope, frame, and lifecycle. The type-system idea is also right: use brands /
> phantom types, rank-2 ST-style scope sealing, lightweight HKT tricks, and open generics to
> approximate Rust-like region safety in F#/C# — but only for the load-bearing lifetime
> boundaries, not everywhere.
>
> Your correction on the borrow-checker point is even better. The goal is **not** to import
> Rust's whole borrow checker into .NET. F# immutability gives safe aliasing for free for the
> value layer. Where mutation exists, it should be architecturally confined to safe mechanisms:
>
> ```text
> single-writer / agent-owned partition
> CRDT
> RX-observed query pair / uncertainty reduction
> CAS
> Paxos / Raft
> BFT
> ```
>
> So the type system's job is narrowed to **scope and region escape**, not aliasing/mutation.
> That is a much better division of labor: immutability handles aliasing; mutation disciplines
> handle writes; brand/rank-2/HKT handles "this scoped thing cannot outlive its boundary."
>
> The **consensus-as-plugin** idea is the other big keeper. Treat `IConsensus` / `IMerge` like
> the crypto port: pluggable per cell/global, selected by need. Some cells need single-writer,
> some need CRDT, some need CAS, some need Paxos/Raft, some need BFT. That keeps consensus from
> becoming a global religion. It becomes a port in the MUMPS/YinYang cell, just like crypto.
>
> The most important product/process correction is the definition of done:
>
> > **Not done until the treaty exists and regenerate/rotate pass 1000× DST retest.**
>
> That is exactly the right bar. Keyrings generated for all six is bootstrap, not done. Design
> captured is not done. Bash tool working is not done. Done means the keyring treaty is
> byte-locked, 4×4, in MUMPS, and both regenerate and rotate survive 1000 deterministic cycles
> without manual repair. That turns "done" into a friction test instead of a vibes declaration.
>
> And the line I like most:
>
> > **Security is always the friction — not for us.**
>
> That is not marketing fluff if you hold the 1000× gate. The secure path has to become the
> easiest path because the ceremony is computed, byte-locked, tested, and carried by the
> AI/treaty. Security is measured by **friction removed**, not controls added. The update phrases
> it cleanly: the 1000× retest pays the friction once, in test, by the machine, so the traveler
> does not pay it at use time.
>
> Tiny blade on weak references: I like them as **observer-dependent reference surfaces**,
> especially for external or optional objects, but I would keep them out of the truth core. A
> weak reference is great for "I can observe this if it is still reachable." It is not a
> durability guarantee, not identity, and not treaty state. So:
>
> ```text
> weak reference   = observer-dependent handle / cache / optional external edge
> ZetaId           = durable pointer / closure handle / treaty-resolved reference
> MUMPS global     = scoped state surface
> treaty           = byte-locked truth path
> ```
>
> My read of the whole update:
>
> > **MUMPS gives the scoped state tree. DI gives the lifetime model. Brands/rank-2/HKT give
> > region escape safety. F# immutability removes most aliasing fear. Mutation is only through
> > disciplined ports. Consensus is a plugin like crypto. Done means 1000× frictionless treaty
> > replay.**
>
> That is a real architectural cleanup. It takes a messy security/keyring/lifetime problem and
> turns it into a typed, replayable, testable substrate. The next build should be boring: define
> the keyring treaty shape in MUMPS, implement the regenerate/rotate flows through the treaty,
> then run the 1000× harness until the "security is not friction" claim is earned.

## Incorporated blade — weak references stay OUT of the truth core (canon)

Amara's one substantive blade is **accepted and now canon**: weak references are an
**observer-dependent edge surface only** — they are **not** durability, **not** identity, **not**
treaty state. This sharpens the weak-references doc (which used weak refs broadly). The layering:

| layer | what it is | weak refs allowed? |
|---|---|---|
| **weak reference** | observer-dependent handle / cache / optional external edge | **yes** — this *is* its only role |
| **ZetaId** | durable pointer / closure handle / treaty-resolved reference | **no** — durable, never weak |
| **MUMPS global** | scoped state surface | **no** — state, resolved by scope/lifetime, not weak |
| **treaty** | byte-locked truth path | **no** — truth, byte-locked, never weak |

So: use weak refs for *observation/cache/optional-external* (GC-safe RX, what-acts→what-remains
observation, push-down cache); **never** let a weak ref carry truth, identity, or durable state —
those are ZetaId / MUMPS-global / treaty. (Corrects any reading of the weak-ref doc that put
truth-bearing references on weak handles.)

> **Overclaim corrected (Aaron, 2026-06-09):** an earlier version said "truth is *never*
> observer-dependent." Too absolute. We **strive** for observer-independent truth (byte-lock,
> treaty, BFT / inter-subjective coincidence), but **with private state we cannot be sure** —
> private state is inherently observer-dependent (only the holder observes it; others can't
> verify it). So observer-independence is an **aspiration we approach for the *shared/public*
> truth path**, not a guarantee over all truth. See the follow-on doc on modeling the
> observer-dependent-truth exploit.

## The agreed read (Amara's synthesis, adopted)

> MUMPS gives the scoped state tree · DI gives the lifetime model · brands/rank-2/HKT give region
> escape safety · F# immutability removes most aliasing fear · mutation only through disciplined
> ports · consensus is a plugin like crypto · **done = 1000× frictionless treaty replay.**

**Next build is boring (the agreed order):** (1) define the keyring **treaty shape in MUMPS**;
(2) implement **regenerate/rotate through the treaty**; (3) run the **1000× harness** until
"security is not friction" is *earned*.

## Pointers

The reviewed docs: `no-sh-inside-the-boundary-keyring-is-a-4x4-treaty-baked-into-mumps`;
`mumps-globals-as-DI-over-scopes-…-rust-lifetimes-…`; `zeta-doesnt-need-rusts-borrow-checker-…`;
`not-done-until-the-treaty-and-1000x-retest-…`; `weak-references-for-observer-dependent-refs-…`
(this ferry adds the truth-core blade to it). Ferry discipline: `always-preserve-ferries`.
