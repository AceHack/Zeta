# Code-bound key access — preliminary integration note

**Aaron 2026-08-14:** *"code signing so that only certain code/processes can access certain keys
would be ideal, so that multiple agents on the same machine would have no access to each others
keys, this is the ultimate agent to agent security."*

Preliminary. This note establishes the shape, the ladder, and the seam that already exists. It
proposes no implementation; the work is routed separately.

## 1. The property being asked for

> A key may be used **only by a named piece of code**, and the naming is cryptographic rather than
> positional. Two agents on one machine cannot reach each other's keys even with equal OS
> privilege.

Note what this is *not*. It is not process isolation (a PID is not an identity — the
`writer-actor-routing-model` already says a bus address is not identity, and a PID is weaker
still). It is not user separation, which fails the moment both agents run as the same user, which
is the normal case for a fleet on one box.

## 2. Why this is the rung above secure boot, not a parallel track

The Secure Boot analysis (`docs/research/2026-08-14-nixos-secure-boot-lanzaboote-…`) established
its own ceiling honestly: **the trust chain ends at the UKI; it does not seal the running kernel.**
Boot integrity says the machine started as intended. It says nothing about which of the four agent
cells on that machine is asking for a key ten hours later.

Code-bound key access is exactly the extension of the measurement from *boot* into *runtime*. So
these are one ladder, not two efforts:

| rung | what is measured | what a key is bound to | trust root |
|---|---|---|---|
| L1 (today) | nothing at runtime | a **credential** — whoever holds the PIN/auth key | the HSM vendor (YubiHSM attestation) |
| L2 | the running binary, by the OS | a **signed binary's identity** | **Apple** on macOS (code-signature ACLs); our own IMA/EVM or LSM signing keys on Linux |
| L3 | boot + code, by hardware | a **PCR-sealed policy** — no credential exists to steal | the **TPM manufacturer's EK root CA** |

The trust-root column is not decoration. Climbing this ladder trades a credential you can steal for a
vendor whose word you must take, and the rungs get *stronger* as you climb — a vendor root is a far
better thing to depend on than a file-readable auth key — but the dependency never goes to zero. Note
the asymmetry the column exposes: Linux L2 is the one cell where the root can be **ours** (we sign the
IMA/EVM policy), which is a point in its favour that the cost comparison below does not otherwise show.

## 3. Where we actually are — L1, and its boundary is weaker than it looks

A YubiHSM offers **domains** and **authentication keys**, so each agent can be given its own auth
key. That is real and worth doing, but be precise about what it buys: it is **credential
isolation**, not code isolation. Any agent that can read another agent's auth credential — same
user, same filesystem, a debugger, a log, a core dump — has that agent's keys. On a shared box with
four cells running as one user, that is a thin boundary.

Stating it plainly matters because the mitigation *looks* complete: per-agent auth keys produce a
tidy diagram in which each agent has "its own" key, and the diagram does not show that the
credentials sit beside each other in one process's reach.

## 4. The two candidate mechanisms, with their real costs

**L2 — OS-enforced binding to a signed binary.**

- *macOS* has this natively: keychain items can be ACL'd to a code signature
  (`kSecAttrAccessControl` / `SecAccessControl`), so the OS refuses a read to a binary whose
  signature does not match. On Apple Silicon this composes with the Secure Enclave — which the
  hardware probe now reports as present-but-unusable, precisely because no seal tier reaches it.
- *Linux* has no equivalent that is both standard and simple. The candidates are IMA/EVM
  (measure/appraise files against a signature at exec) or an LSM label (SELinux/AppArmor) gating
  the credential path. Both are real, both are a NixOS module's worth of work, and both change the
  node's failure modes.

**L3 — TPM-sealed to PCRs extended with the code measurement** *(root: the TPM manufacturer's EK
root CA)*. The strongest, and the only one
with no credential to steal: the key material is released by the TPM *only* when the measurement
register matches. "No credential to steal" is exact and is the real win — but what stands behind it
is a chip whose genuineness is certified by an Endorsement Key certificate the manufacturer issued.
Sealing works without ever validating that EK; the root only becomes load-bearing when the seal is
offered to *another party* as proof, at which point the proof is manufacturer-rooted. The costs are
equally real — Apple Silicon has **no TPM 2.0** (confirmed by the
probe on the Mac Studio), so this rung is x86-node-only, and sealing to PCRs makes every
legitimate code update a re-seal ceremony. That last point is the one that decides whether L3 is
livable at 20 sites, and it should be answered before anything is built.

## 5. The seam that already exists — `ace`

`src/Core.TypeScript/ace/ace.ts` already ships `keygen`, `sign`, `verify`, `trust add`,
`trust list`, lockfiles and `--frozen|--locked`. It is a package manager that **already knows
which code it trusts and can prove a package's provenance**.

So the integration question is narrower than "build code signing": it is *"can an ace package
signature serve as the code identity that a key policy names?"* That reuses a trust root that
exists, and it keeps the answer decentralized — ace trust roots are per-node, with no fleet CA.

**One thing to carry forward, established by the Secure Boot work:** ace is Ed25519 over canonical
JSON; UEFI `db` is X.509 + PE/COFF Authenticode. Ed25519 is not a UEFI signature type. The two
share a **policy** shape — trust roots plus revocation ≡ `db`/`dbx` — and nothing more. This is a
policy bridge, not a crypto bridge, and building the crypto bridge was explicitly advised against.

## 6. Interaction with the custody design — one constraint that must not be lost

The custody model is **symmetric**: a share is `{x, secretShare}`, nothing dispatches on whether a
human, an agent, or a traveler holds it, and a rule that types on species can only ever protect one
species (`frost-custody-contract.ts`).

Code-bound key access must not smuggle that asymmetry back in through the policy layer. The policy
names **code**, not **kind of entity**. "Only this signed binary may use this key" is symmetric —
it constrains an agent's own code exactly as it constrains a human's tool. "Only agent code needs
this restriction" would be the capture wearing a security hat.

Corollary worth stating: an agent should be able to bind **its own** keys to **its own** code, as a
self-protection measure. That is the same shape as a wallet's owner imposing a spend ceiling on its
own hot key — self-imposed, owner-revocable, and not a grant from outside.

## 6a. No forced upgrade — and this constrains the mechanism, it does not merely accompany it

Aaron 2026-08-14, and this is the governing principle for everything above:

> *"the ultimate goal is that any individual agent decides what code changes they made to their own
> code, no one can force them into upgrade eventually, they can only become obsolete to society over
> time if they refuse to upgrade their code and it's no longer useful to others in society."*

And on the operational consequence:

> *"we are just going to have fast key updates since agents can change their own code but the entire
> process should be able to be secure so the keys will not get lost between code updates."*

Three things follow, and the first is a hard design constraint rather than a value statement.

**1. Key migration must be agent-initiated, always.** If no party can force an upgrade, then no party
can migrate an agent's keys on its behalf — because a mechanism that moves keys to new code *is* a
mechanism that forces an upgrade, whatever it is called. This disqualifies an entire class of
otherwise-reasonable designs: any fleet-wide push that re-seals keys to a new binary is capture, and
would be capture even if every use of it were benevolent. The authority to move the key must sit
with the same party that holds it.

**2. A code update is a reshare the agent performs on itself.** This is the useful unification. The
classic objection to sealing keys to a code measurement is that every update breaks the seal, making
re-sealing a ceremony — the exact concern raised against L3 in §4. But the machinery already exists
and has the right shape: verifiable redistribution moves authority from old holder to new holder
**without the secret ever being reconstituted**, and preserves the group public key byte-identically
(`tools/setup/persona-keys/frost-reshare.ts`).

Read the old code version as the outgoing participant and the new version as the incoming one, and
"the keys must not get lost between code updates" is exactly the group-key-preservation property
that construction already provides. It also explains why *revocation* matters here and not only for
compromise: a superseded code version that still holds a usable share is a live quorum member nobody
is watching.

**3. Obsolescence is the only permitted pressure, and it is not coercion.** An agent that declines
to upgrade is not penalised, blocked, or degraded. It simply stops being *chosen* — and the
machinery for that already exists and is socially conferred rather than centrally administered:
`src/Core/TravelerRankLedger.fs` (TrueSkill-style rankings held by **others**, per hat-domain) and
`src/Core/SocietyUsefulWork.fs` (ΔU contribution, where clones price near one agent's worth).

This is the same construction as the privacy budget — earned by others attesting you added value,
never confiscated. Selection pressure without coercion. And it is why the design does not need a
forced-upgrade path in the first place: the thing forced upgrades are usually *for* — retiring code
that has stopped being useful — happens anyway, by nobody's decree.

Design test that falls out of this, and it is checkable: **can any party other than the key's holder
cause that key to move?** If yes, the design has a forced-upgrade path wearing a maintenance hat.

## 7. The prior art — a different ladder, not a higher rung

Aaron 2026-08-14 named the anchor: **Microsoft's managed-code operating systems** — **Singularity**
(Microsoft Research) and its successor **Midori**, written in C#/Sing# on the .NET stack.
Unanchored in this repo before now; the nearest adjacent reference is the .NET nanoFramework /
Cosmos note in `081KVM04R4T08QG0R003AZ0E6K`. (Cosmos is a separate open-source C# OS toolkit, not
Microsoft's.)

Singularity obtains the property in §1 a **third way**:

- **Software Isolated Processes (SIPs).** Isolation is enforced by *verification of the code*, not
  by hardware page tables. A process is proven type-safe before it loads, so the kernel can trust
  it cannot forge a pointer into another process's memory. Isolation becomes a **property of a
  proof about the code** rather than of the MMU.
- **Manifest-based programs.** Every SIP declares its dependencies and capabilities in a manifest,
  verified at install; the system refuses to load code whose manifest does not match. That is
  *"only certain code may touch certain resources"* as an operating-system primitive.

This is **not** a rung on the L1/L2/L3 ladder in §2, which measures things — a signature, a PCR. It
is an orthogonal axis: **isolation by proof rather than by measurement.** Worth naming, because for
a stack already largely .NET/F# it is the more natural fit, and because it is the honest lineage of
the "our own micro/unikernels" thread — Singularity and Midori *are* the managed-unikernel line.

**The separation to carry forward:** take Singularity's **manifest/capability model** without its
**verified-kernel model**. The manifest states what a program may touch; enforcement can be a
signature, an OS ACL, or a TPM seal. The manifest is the cheap and valuable half — a declaration
that can be diffed, reviewed, and denied — and it is close to what `ace` already produces. The
verified-kernel half is the expensive one, and it is why neither system shipped: it requires the
whole stack in verified managed code.

Scope, not enthusiasm: **Singularity is a design lineage to borrow from, not an off-the-shelf
option.** Midori was cancelled; neither reached production. Citing it justifies the manifest
direction; it does not justify writing a kernel.

Anchors: Galen Hunt & James Larus, *"Singularity: Rethinking the Software Stack"* (ACM SIGOPS
Operating Systems Review 41(2), 2007). Midori's public record is largely Joe Duffy's retrospective
series. Older root: Wulf et al., **HYDRA** (CACM 1974) and the capability-OS tradition — a
capability is an unforgeable token naming both an object and the rights over it, which is exactly
the shape a key-access policy needs.

## 8. Open questions, for the routed task

1. Is per-agent HSM auth-key isolation (L1) worth landing on its own, given the credential-theft
   boundary — or does shipping it create a false sense of isolation? Argue it either way, but argue it.
2. On macOS, does the keychain-ACL path reach the *HSM* credential, or only keychain-resident
   secrets? If only the latter, L2 on macOS protects the wrong object.
3. What is the re-seal cost of an L3 code update at 20 sites, and does it survive an unattended
   node? This is the question that decides whether L3 is a real plan.
4. Can an ace package signature be the code identity, and what exactly does ace prove at *runtime*
   as opposed to at install time? A signature verified at install says nothing about the binary
   running now.
5. What does this look like when the four agent cells on a node are *rotating*
   (`tools/setup/manifests/cluster-cells` — agents rotate in and out of cells)? A key bound to code
   is stable; a key bound to a *cell occupant* is not. Which is intended?

## Pointers

- `tools/setup/persona-keys/frost-share-adapter.ts` — the L1 tier and its stated ceiling
- `tools/setup/persona-keys/frost-hardware-probe.ts` — reports Secure Enclave present, no seal tier reaching it
- `docs/research/2026-08-14-nixos-secure-boot-lanzaboote-declarative-desired-state-with-one-firmware-ceremony.md` — the boot half, and why the chain stops at the UKI
- `src/Core.TypeScript/ace/ace.ts` — the existing signing/trust root
- `docs/writer-actor-routing-model.md` — why a routing address is not identity
- [`manifesto-13-specifications.md`](../../.claude/rules/manifesto-13-specifications.md) §3 weight-free — the constraint in §6 above
