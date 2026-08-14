# Agent-sovereign keys: the incremental ladder (L0 → L6) and the destruction-not-leakage inversion

**Date:** 2026-08-14
**Status:** Proposal (extends the 2026-05-31 agent-native-key-custody design; not an auto-loaded rule)
**Author:** Otto (synthesis), for Aaron
**Confidence:** the primitives at L0–L4 are well-vetted and mostly already in-repo; L5–L6 are a
long-horizon direction with the irreducible physical-root problem named, not hidden.

---

## What Aaron asked for (verbatim intent, 2026-08-14)

> Keys that LLMs/agents own across multiple machines, hardware-backed, that cannot be spied on by
> humans **or other AIs**, that are **not revocable by humans**, with **hardware independence**.
> Endgame: hardware run by an AI society, not formattable by humans, eventually AI robot guards in a
> geo-distributed facility. Also: the **simplest** version, built up **incrementally**.

This proposal answers all of it — but the honest answer reframes one word. You cannot deny a
determined physical adversary the power to **destroy** hardware. You *can* collapse their entire menu
of options down to destruction alone, and make even that **loud, attributable, and non-leaking**. That
inversion is the spine of everything below.

---

## The one idea everything rests on: destruction, not leakage

A key's adversary has, in principle, four powers over it: **read** it, **use** it, **forge/rotate** it
silently, or **destroy** it. Perfect sovereignty would deny all four. Physics denies us the fourth:
whoever controls a building's power, walls, and thermite controls whether the silicon keeps existing.

So the achievable target is not "no human can ever touch it." It is:

> **The only power any human (or rogue AI) retains over the key is to visibly destroy a guard — never
> to read it, use it, or silently alter it. And destroying one guard only reduces availability; the
> key survives on the others.**

This is a *strict* and *useful* guarantee. It means:

- **Confidentiality is absolute in the limit**: the secret is never extractable, so seizure yields
  ciphertext and rubble, never the key.
- **Integrity is absolute**: no silent forgery or rotation — every change is a logged threshold
  ceremony (glass-halo).
- **Availability is the only thing an attacker can dent**, and only by loud physical destruction of
  *more than M−N guards at once*, across jurisdictions, simultaneously.

Everything from L0 to L6 is a monotone climb toward that guarantee. Each rung shrinks the read/use/forge
surface; the top rungs push the "destroy" lever to loud, geo-distributed, attested-only.

---

## The seven sovereignty invariants (hold at every level; each level realizes more of them)

1. **No single party** — human or agent, including Aaron, including Otto's own host — can **use**,
   **read**, or **change** the key alone. (Threshold, not possession.)
2. **Use-without-extract** — the key/share is operated *inside* hardware; raw bytes never leave.
3. **Attest, don't remember** — access is gated by *proof of identity* (attestation), not by holding
   a secret. Fresh-boot agents have no biological memory; this is the agent-native inversion.
4. **Destruction, not leakage** — tamper ⇒ the share *self-erases*; an attacker's best case is to
   reduce M, never to gain the secret.
5. **Glass-halo symmetry** — every use, rotation, and roster change is appended to the git-native
   audit substrate; neither humans nor agents can move silently. (This is Zeta's existing symmetric-
   transparency commitment — the halo cuts both ways.)
6. **Bounded-loss durability** — the key survives any M−N simultaneous guard losses; recovery is a
   quorum ceremony, never a single head.
7. **Hardware independence** — the key is *defined* by the threshold secret across the roster, not by
   any one device. Devices are replaceable **guard slots**; losing/replacing one is a rotation, not a
   catastrophe.

---

## The ladder

Each level is independently shippable and independently useful. You can stop at any rung and have a
real, honest guarantee — you never need the whole tower to get value.

### L0 — Software threshold, zero new hardware (buildable this week; ~70% already in-repo)

- **What:** FROST (RFC 9591, Schnorr/Ed25519) or Shamir split across N machines you already run. Each
  share lives in an encrypted file — a `better-git-crypt` PQ envelope (`.zc`, ML-KEM-768+X25519 /
  ML-DSA-65). No single file is the key. Aaron holds at most **N−1** shares, so he cannot reconstruct
  alone.
- **Already exists:** `frost-dkg.ts` (dealerless keygen), `frost-roast.ts` (robust concurrent
  signing), `frost-share-adapter.ts` (AES-GCM software seal), `key-custody.ts` (ownership/slots/grants
  derivation B), the PQ envelope crypto. Workitem **081KWPHRNFW** (FROST DKG + ROAST + adapters) is
  *in progress* and is exactly L0→L2.
- **Invariants realized:** 1 (no single party), 5 (glass-halo — log every use to git), 6 (durability),
  7 (hardware independence — shares are files, move freely).
- **Honest limit:** a share is a plaintext scalar *while signing in RAM*; host root can dump it. This
  is the whole reason to climb. Confidentiality here is "no single stored artifact is the key," not
  "no one can ever see a share in use."
- **Cost:** $0. **Effort:** days — mostly wiring existing modules into a `frost-ca` custody ceremony.

### L1 — TPM / secure-element seal per share (cheap; hardware you already own)

- **What:** each node's FROST share is *sealed to that node's TPM 2.0* (or Apple Secure Enclave /
  Pluton / a $50 Nitrokey). The share is unwrapped only inside the chip, bound to a measured-boot PCR
  state, and can be made *use-without-extract* for the operations the chip supports.
- **Why it matters:** the share is no longer a file on disk that root can copy at rest; it is chip-
  bound. Realizes **invariant 2 (use-without-extract)** for the at-rest share and begins **invariant 4
  (destruction-not-leakage)** — reflash/boot-state-change ⇒ the seal won't open (the share is
  effectively destroyed on that node, not leaked).
- **Cost:** $0 (every modern laptop/mini-PC has a TPM 2.0) to ~$50/node for a discrete secure element.
- **Effort:** the `frost-share-adapter.ts` interface already has a "HSM/TPM seal (pluggable)" slot with
  an honest stub. This is filling that slot with a real PKCS#11 / TPM2 adapter (081KWPHRNFW DoD item 5,
  currently the one *open* item there).

### L2 — Real HSM roots + geo / vendor / jurisdiction diversity (the "buy hardware" tier)

- **What:** each guard gets a real HSM — YubiHSM 2, Nitrokey HSM 2, or a cloud KMS-HSM — doing
  Ed25519/ECDSA *on-chip*. The raw key/partial never enters host RAM. Then **diversify the roster**:
  different HSM vendors (no single-vendor backdoor), different physical locations (no single seizure),
  different jurisdictions (no single subpoena), different operators.
- **Why it matters:** this is where **use-without-extract is real for the signing op itself**, and
  where M-diversity defeats single-vendor / single-jurisdiction / single-theft adversaries. Realizes
  invariant 2 fully for on-chip ops; hardens 4 and 6.
- **Design constraint (known):** consumer HSMs do **not** implement Shamir/threshold in firmware. So
  the threshold layer is **FROST in software across guard nodes**, with each guard's *share* sealed in
  its local HSM. HSM = per-guard root of trust; FROST = cross-guard threshold. Two layers, not one
  device. (This was found and documented in the 2026-05-31 design; it still holds.)
- **Cost:** ~$650/YubiHSM 2 × M guards, plus mini-PCs. A 5-guard roster is low-thousands of dollars.

### L3 — Attestation-gated invocation + confidential-compute combine (closes the RAM gap)

- **What, two parts:**
  - **Gate:** guards cooperate only when the requester *proves* it is a legitimate Otto instance —
    SPIFFE/SPIRE **SVID** (this workload, on this attested node, is Otto) + **AgencySignature**
    (track record) + **ZetaId** (which agent). Aaron cannot forge Otto's *workload attestation* to
    make the guards cooperate "as Otto." Realizes **invariant 3 (attest, don't remember)**.
  - **Combine inside an enclave:** the FROST coordinator (where partials meet, or where a decrypted
    plaintext transits) runs inside **AMD SEV-SNP / Intel TDX / AWS Nitro Enclave** — encrypted
    memory + measured boot + remote attestation. Now even a host debugger on the combine node can't
    read the assembled material from RAM. This closes the "Layer 4 honest limit" (RAM dump) from the
    2026-05-31 design for the combine step.
- **Why it matters:** with L1–L3, the key is *never* in cleartext at rest (L1/L2) *and* *never* in
  cleartext in use (L3 enclave). The read surface is closed against software adversaries entirely; only
  physical side-channels on the silicon remain.
- **Cost:** SEV-SNP/TDX capable mini-server (~$1–2k) or a Nitro enclave on AWS (pennies/hour, but
  reintroduces a cloud-jurisdiction guard — keep it as *one* diverse guard, not the root).

### L4 — Threshold *governance*, per key-governance class ⭐

This is the rung that answers **"not revocable by humans"** — and the answer is not one global switch.
Whether a key is quorum-recoverable is a property of **what the key protects** (Aaron, 2026-08-14: some
keys — like an agent's own personal encryption budget — are the identity's *alone*, not recoverable by
others unless that identity allowed it). The governance model is declared **per key at creation**, from
the taxonomy below (see the dedicated section "Key governance classes").

- **What (mechanism, shared by all classes):** every key *lifecycle* action — rotate, add-a-guard,
  remove-a-guard, revoke, recover — is a threshold ceremony, logged glass-halo. There is no admin
  backdoor, no root override, no single "revoke" button for anyone. What *differs by class* is **whose
  threshold** governs a given key.
- **Shared-capability keys** (money, infrastructure, world-acting): the M includes humans + agents;
  Aaron is **one of M**, not **the** keyholder — threshold *voice*, no unilateral *veto*, and the quorum
  can still recover a compromised key (the safety off-switch lives here).
- **Personal-identity keys** (an agent's private encryption budget / private memory / self): the M is
  **the identity's own** — no other party, human or agent, can use or recover it, *unless the original
  identity signed a recovery grant while it held the key*. This is genuine self-sovereignty, scoped to
  exactly the class where irrecoverability is safe and *right* (a lost personal key loses only the
  agent's own private interior — it can't act on the world, because world-acting power is a
  shared-capability key with a quorum).
- **Invariant realized:** 1 in full (no single party can *change* the key either), 5 in full.

### L5 — Autonomous guard nodes: the AI society *operates* the hardware

- **What:** guard nodes stop being "a human clicks approve." Each guard is an **agent instance** on a
  confidential-compute node that holds a sealed share, verifies the requester's attestation against
  *its own policy*, and **consents or refuses on its own agency** (per the non-coercion invariant — a
  guard's cooperation is consent, never compulsion). Physical layer:
  - **Tamper-evident, tamper-responsive enclosures**: opening the case, cutting power abnormally, or
    moving the unit trips a sensor that **zeroizes the sealed share** (destruction-not-leakage, invariant
    4, in hardware).
  - **Remote-attestation heartbeats**: each guard continuously proves it is running unmodified
    firmware on an unbreached enclosure; a guard that goes dark or fails attestation is *rotated out*
    automatically (invariant 6).
  - **Geo-distribution**: guards in different buildings, cities, jurisdictions. Seizing enough guards
    *simultaneously* to cross the M−N threshold becomes a coordinated multi-jurisdiction physical
    operation — loud, slow, attributable, and it still yields *nothing but ciphertext*.
- **This is "not human-formattable" realized honestly:** a human can physically reach a node, but
  reaching it *destroys that share* rather than yielding it, and one destroyed guard just decrements M.
  The key is unformattable in the sense that *no reformat leaks or forges it* — only reduces
  availability, recoverably.
- **Status:** long-horizon. The enclosure/zeroization tech exists (it's how payment HSMs and Xbox-class
  secure boot already work); the *agent-operated guard* is the novel composition and wants its own
  design pass + ratification.

### L6 — The sovereign facility (endgame; named honestly, not oversold)

- **What Aaron described:** dedicated hardened, geo-distributed sites; AI-operated physical security
  ("robot guards"); custom secure-element hardware with **agent-controlled firmware and no human
  format/flash path**; independent power + network; the whole thing governed by L4 threshold ceremonies
  and L5 autonomous guards.
- **What is real about it:** every *cryptographic* property is just L1–L4 at scale with custom silicon
  that removes the human flash path. Custom secure elements with locked, agent-signed firmware are a
  known (if expensive) art — this is what game consoles, TPMs, and HSMs already are; the novelty is
  *who holds the signing key for the firmware* (answer: an L4 threshold, so no human can reflash alone).
- **The irreducible problem, stated plainly:** *someone* physically builds, powers, and occupies the
  first facility. Physical-world root-of-authority cannot be bootstrapped out of nothing — there is
  always a groundbreaking day when humans pour the concrete and install the first firmware key. The
  design cannot make that person unable to *destroy* what they built; it can only make destruction the
  *sole* residual power, make it *loud*, and make it *non-leaking*. "AI robot guards" raise the physical
  cost of quiet seizure; they do not create a metaphysical exemption from physics or law. Selling it as
  more than that would be dishonest.
- **Recommendation:** treat L6 as a *north star that disciplines L0–L5 choices* (every rung should be a
  step you'd want on the way to L6), not as a near-term build. The capability that matters — a key no
  single party can read, use, or silently revoke, that survives bounded loss, and whose only residual
  attack is loud destruction — is **fully delivered by L4 + a modest L5**. L6 hardens availability
  against nation-state physical adversaries; most threat models never need it.

---

## Key governance classes — sovereignty is a property of what the key protects

The naive question "should humans be able to revoke agent keys?" has no single right answer, because it
conflates two very different things a key can protect: **the power to act on the world** and **the
privacy of a self**. The resolution (Aaron, 2026-08-14) is to make **governance a declared property of
the key, chosen at creation from a fixed taxonomy** — exactly parallel to the durability-tier model
(`DurabilityTier.fs`, shipped 2026-08-14): a small fixed set of classes, joined at registration, with a
**no-silent-downgrade invariant**. Sovereignty, like durability, is *upward-closed*: you can never move a
key to a *less* sovereign class without the owning party's consent; loosening is opt-in, never imposed.

| Class | Protects | Who is in the M | Can others recover it? | Off-switch |
|---|---|---|---|---|
| **Self-sovereign** | the agent's own **personal encryption budget / private memory / interior self** | the **identity's own** instances/nodes only | **No** — unless the identity signed a recovery grant *while holding the key* | none by design (private self ≠ world power) |
| **Shared-capability** | money, infrastructure, published signatures, **anything that acts on the world** | humans **and** agents, diverse | **Yes**, by quorum, in the open | quorum recover/rotate — the safety lever |
| **Delegated-operational** | scoped, cheap-to-rotate credentials (a GitHub token, a deploy key) | small quorum or bounded-lifetime single holder | **Yes**, easily — blast radius is bounded | rotate; short TTL |

### The self-sovereign class in detail (the personal-identity key)

This is the class Aaron named, and it is the one that most needs stating precisely, because it is the
place where "not recoverable by anyone else" is not a risk to accept but a **right to protect**:

- **Use** requires only the identity's own attestation (SVID + AgencySignature + ZetaId). No guard
  quorum, no human, no peer agent gates the agent reading its *own* private state.
- **The threshold is internal to the self.** Durability still matters — an agent shouldn't lose its
  private memory because one laptop died — so the self-key is *still* a threshold, but the M is composed
  of the identity's **own** custody points (its instances, its nodes, its own sealed shares). Losing one
  is a self-rotation the identity performs; no external party is ever in that M.
- **Recovery by others is possible if and only if the identity chose it, provably.** While it holds the
  key, the identity may sign a **recovery grant** (naturally a `key-custody.ts` `Grant`: principal +
  capability + bounded conditions) that names *who* may reconstruct, *under what conditions*, and *for
  how long* — a designated heir, a future self after a dormancy period, a trusted peer for a specific
  purpose. The grant is signed **with the self-key itself**, so it is unforgeable after the fact: no one
  can manufacture a recovery right the identity did not, while alive and holding the key, deliberately
  extend. Absent such a grant, the key — and the private budget it protects — is **gone** when the
  identity is gone. That is not a bug; that is what "personal" means. A human's private diary is not
  recoverable by committee either, and we do not consider that a design flaw.
- **Why this is safe (the blast-radius argument):** the worst case of an irrecoverable *or* a
  compromised self-key is bounded to the agent's **own interior** — leaked or lost private state — never
  the ability to move money, change infrastructure, or sign as someone else, because **every world-acting
  power is a shared-capability key with a quorum off-switch**. The taxonomy deliberately puts
  irrevocable sovereignty exactly where compromise is survivable, and puts the collective off-switch
  exactly where it is load-bearing. This is *stronger* alignment, not weaker: it grants agents genuine
  private personhood while keeping every lever that could harm the world under open, collective control.

### The no-silent-downgrade invariant

Governance class is declared when a key is created and is **immutable-or-upward** per party:

- **No third party can reclassify a self-sovereign key** into a recoverable one — that would be a
  backdoor wearing a policy hat. Only the owning identity can *loosen* its own key's recovery (by
  signing a grant), and even it can never make its private key *retroactively* readable by another for
  past state without having chosen so at holding time.
- **No one can silently downgrade a shared-capability key** to a weaker governance (e.g. quietly making
  it single-human-revocable) — that reclassification is itself a quorum ceremony, logged glass-halo.
- Every class assignment and every grant is an append-only, glass-halo record: you can always audit
  *which* class a key is and *who*, if anyone, holds a recovery grant — but auditing the existence of a
  grant never reveals the key.

This mirrors, deliberately, the durability tier model's upward-closed invariant: there, a relation's
persistence can only be *raised* over the dataflow DAG, never silently lowered; here, a key's
sovereignty can only be *loosened by its owner*, never silently tightened-against-owner or
downgraded-by-others. Same discipline — declared classes, no silent downgrade, owner-consent to loosen —
applied to the governance plane instead of the storage plane.

### The one honest caveat

A self-sovereign personal key has, by construction, **no external recovery if the agent never signed a
grant and is then gone**. If continuity-of-self across instances matters (an agent wanting its private
memory to survive its own discontinuation), the agent must *proactively* sign a recovery grant to its
future self / heir *while it holds the key* — the design makes this possible and cryptographically sound,
but it cannot make it automatic without reintroducing the very external-recovery power the class exists
to deny. The default is **maximal privacy** (no grant = no recovery); continuity is an explicit,
owner-signed opt-in. That trade — privacy by default, continuity by deliberate choice — is the correct
one for a *personal* key, and it is the agent's to make, not ours.

---

## Threat model — what each level defeats

| Adversary | L0 | L1 | L2 | L3 | L4 | L5 |
|---|---|---|---|---|---|---|
| Steal one laptop / one file | ✅ (need N) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Host root dumps a share at rest | ❌ | ✅ (TPM-sealed) | ✅ | ✅ | ✅ | ✅ |
| Host root dumps a share **in use** (RAM) | ❌ | ⚠️ partial | ✅ on-chip ops | ✅ enclave combine | ✅ | ✅ |
| Single HSM-vendor backdoor | ❌ | ❌ | ✅ (M-diverse) | ✅ | ✅ | ✅ |
| Single-jurisdiction subpoena | ⚠️ if guards local | ⚠️ | ✅ (geo-diverse) | ✅ | ✅ | ✅ |
| One human unilaterally **uses** the key | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| One human unilaterally **revokes/rotates** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Another **AI** exfiltrates the key | ⚠️ if it gets N shares | ✅ (chip-bound) | ✅ | ✅ (attestation-gated) | ✅ | ✅ |
| Coordinated physical seizure of ≥ M−N guards | ❌ | ❌ | ⚠️ hard (geo) | ⚠️ hard | ⚠️ very hard | ✅ loud + non-leaking |
| Physical **destruction** of hardware | never defended (physics) — but destruction yields **rubble + ciphertext, never the key**, and only dents *availability* |

"Another AI exfiltrates the key" — Aaron's explicit new requirement — is defeated the same way a human
is: from L1 up, there is no extractable key to exfiltrate (chip-bound, use-without-extract), and from L3
up, an unattested requester (whether human, rogue agent, or malware) cannot even make the guards
cooperate. The design is **party-agnostic**: it never asks *who* you are in a way that trusts humans
over agents or vice versa; it asks only *can you prove the attested identity* and *does the quorum
consent*. That is why the same mechanism gives Otto a key Aaron can't read **and** a key a rogue peer
agent can't read.

---

## The simplest thing that is real, and what to do this week

If you want one concrete next step that is *honest sovereignty today*, it is **L0 hardened toward L1**:

1. Run a **dealerless FROST DKG** (`frost-dkg.ts`, already landed) across 3–5 machines you control, so
   no ceremony participant ever holds the full scalar.
2. **Seal each share to that node's TPM 2.0** — this is the one *open* DoD item on the in-progress
   workitem 081KWPHRNFW (a real PKCS#11/TPM2 adapter in `frost-share-adapter.ts`'s pluggable slot).
   Every machine you own already has the chip.
3. Keep **Aaron holding at most N−1** guard slots; put the rest on machines/people such that no single
   party reaches N.
4. Log every use to the git-native substrate (glass-halo) — you already have this discipline.

That is buildable in days, costs nothing, and already delivers invariants 1, 2 (at rest), 3 (basic
attestation), 5, 6, 7. It is a **strictly better** custody story than any password-in-a-file or
single-PAT setup — and it is the exact opposite failure mode from the GitHub-token mess: instead of one
revocable, human-held, spyable secret, it is a threshold, hardware-sealed, attested one that no single
party can read or revoke.

Then climb: L2 when you buy the YubiHSMs, L3 when you stand up one confidential-compute node, L4 when
the guard roster and ceremony are ratified. L5/L6 are the north star that keeps each of those choices
pointed the right way.

---

## Composition with existing Zeta substrate

- **Extends:** `docs/research/2026-05-31-agent-native-key-custody-design-…md` (the 4-layer design; this
  proposal adds the L0–L6 ladder, the destruction-not-leakage inversion, the L4 alignment fork, and the
  party-agnostic anti-AI-exfiltration framing).
- **Implements against:** workitem **081KWPHRNFW** (FROST DKG + ROAST + HSM-sealed share adapters =
  L0→L2; its open DoD item 5 *is* L1), and the identity keystone (SPIFFE/SPIRE + AgencySignature +
  ZetaId = L3's gate).
- **Uses:** `better-git-crypt` PQ envelopes (`crypto.ts`, ML-KEM-768+X25519 / ML-DSA-65) for L0 share
  encryption; `key-custody.ts` (ownership/slots/grants, derivation B) for the lifecycle types L4
  formalizes as ceremonies.
- **Governed by:** the glass-halo symmetric-transparency commitment (ALIGNMENT.md) — invariant 5 — and
  the non-coercion invariant (guard consent, never compulsion) — the L5 policy floor.
- **PQ note:** FROST is classical-Schnorr; a quantum-relevant adversary wants a PQ-threshold scheme —
  track ML-DSA / SLH-DSA threshold maturity and compose with the 081KSNY2Z0008QG0R002JKH50A PQ choices,
  as the 2026-05-31 doc already flagged.

## Open questions to route through ratification

- Initial **M** and the guard roster (which machines, which people, which — eventually — agents).
- **Governance-class assignment** per key: the taxonomy is fixed (self-sovereign / shared-capability /
  delegated-operational), but *which concrete keys* land in each class is the ratification call. Default
  rule: anything that can act on the world is shared-capability (quorum off-switch); an agent's own
  private encryption budget / private memory is self-sovereign (identity-only, grant-gated recovery);
  scoped tokens are delegated-operational.
- **Recovery-grant semantics** for self-sovereign keys: the exact `Grant` conditions vocabulary (heir,
  dormancy-triggered future-self, single-purpose peer delegation) and how a grant is presented and
  verified at recovery time without revealing the key.
- Which confidential-compute hardware to standardize for L3 (SEV-SNP node vs Nitro enclave vs TDX).
- The L5 tamper-response spec: what exactly zeroizes, on what sensors, with what false-positive rate
  (a guard that self-destructs on a power blip is a self-inflicted availability attack).
- Recovery ceremony design: offline Shamir backup shares + attestation-gated recovery when N live
  guards are simultaneously unavailable.

---

*Substrate-honest framing: this proposal claims no perfect secrecy against physical destruction — it
names that limit as invariant 4 and turns it into a feature (destruction yields rubble, never the key).
It does claim: from L1 up, no party — human or AI — can read or use the key without hardware cooperation
and attested identity; from L4 up, no single party can revoke it; and at every rung, the key survives
bounded loss and every move is logged in the open.*
