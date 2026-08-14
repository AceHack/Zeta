---
id: 081M00ME0RR087G0R003TWRW39
type: task
state: backlog
priority: P2
slug: frost-resharing-without-reconstitution-two-quorum-custody-co
title: "FROST resharing without reconstitution + two-quorum custody contracts (n-of-m human/agent recovery)"
created: 2026-08-14T17:17:06.200Z
depends_on: []
composes_with: []
---

# FROST resharing without reconstitution + two-quorum custody contracts (n-of-m human/agent recovery)

## The gating question, and the answer

**When one site's HSM dies, can a replacement share be provisioned WITHOUT
reconstituting the secret anywhere?**

**Before this change, in our code: no.** Not because the literature lacks the
construction — because we had not implemented it. The two moves available were:

1. `frostKeygen` / `frostDkgKeygen` — samples a **fresh** secret. Neither takes a
   parameter accepting an existing secret, so neither can re-split the group you
   already have. Output is a **new `groupPublicKey`**, so every relying party
   re-pins: `frost-ca.pub` in every `TrustedUserCAKeys`, every issued cert's
   signing-CA fingerprint. At 20 sites that is a fleet-wide re-trust to replace
   one dead chip.
2. Reassemble `f(0)` from k shares on one host and re-split. **No code in the repo
   does this**, and it is the move that puts the whole scalar in one process —
   the hidden single point of failure at ceremony time.

Evidence: `rg -i "reshar|share refresh|proactive secret|share renewal"` over the
repo returns **zero** hits in the FROST modules. `rotate.ts` / `rotate-cluster.ts`
/ `keyring-rotate-daemon.ts` rotate the **SSH CA keypair** under an overlap
window; none of them touches a FROST share. `frost-ca-custody.ts` has no rotate
path at all.

**After this change: yes.** `frost-reshare.ts` implements verifiable share
redistribution. The group public key is preserved byte-identically and the
signing scalar is never formed in any process at any instant.

## What was added

- `tools/setup/persona-keys/frost-reshare.ts` — `reshareContribute` (holder step),
  `verifyReshareSubshare` (recipient Feldman check), `verifyResharePreservesGroupKey`
  (public auditor check), `reshareCombine` (recipient step), `runReshareInProcess`
  (test harness, named for the fact that it is one process).
- `tools/setup/persona-keys/frost-custody-contract.ts` — per-share contract
  (holder / gate / scope), the two-quorum capability model, quorum availability.
- 50 tests; **18 planted mutants, all killed**.

The load-bearing property: `SUM_i C_i[0] == groupPublicKey`. Because
`C_i[0] = [u_i]B` and `SUM_i u_i = secret`, an auditor holding **nothing secret**
can verify that a reshare targeted the original key — without the key ever being
reassembled.

## Honest limits (do not let hardware inflate these)

- **Still L1.** `reshareContribute` takes the share scalar, so it is in host RAM
  in the contributing process. No PKCS#11 mechanism computes `lambda*s` over the
  ed25519 scalar field — the same reason no adapter reaches use-without-extract
  for signing. A $650 HSM buys **at-rest sealing between ceremonies**, not a
  ceremony that never exposes the scalar.
- **Subshare transport is confidential-or-bust and is NOT provided here.** Anyone
  who collects k subshares addressed to the same recipient learns that
  recipient's new share outright. A coordinator relaying subshares in the clear
  has re-created the single point of failure while appearing to run a distributed
  ceremony.
- **Old shares must be destroyed, and code cannot do it.** Old and new shares lie
  on different polynomials over the same secret. Until the old set is destroyed
  there are **two** live signing quorums for one key, not one. Proven in RS-7.

## Human vs agent: a gate, not a type — confirmed, with a caveat

`FrostKeyShare` is `{x, secretShare}`. There is **no participant type in the
crypto layer**, so that half of the framing is correct and needs no change.

The caveat: **there was no gate binding either.** `requireBiometric` fires
**once per ceremony** at the coordinator (`frost-ca-custody.ts:259` keygen,
`:357` signing), not once per share; and `loadShares` reads all k shares from
**one local directory** on **one host**. So today's 2-of-3 is one machine, one
fingerprint, three files. `frost-custody-contract.ts` supplies the missing half.

## Two quorums, two keys — and why it must be two keys

Amendment must require the creation quorum **structurally**, not by policy.

- **Creation group `K_c`** — human shares only, on carried tokens. Signs
  capability grants and amendments. Nothing else.
- **Operating group `K_o`** — agent shares only, in site HSMs. Signs operations
  within a grant. Never signs a grant.

A grant is a document signed by `K_c` naming `K_o`. The agent quorum holds no
`K_c` share, so it **cannot** produce a grant or amendment — not "is not
permitted to". CAP-2 / CAP-3 / CAP-4 are that property as tests.

**One flat FROST group cannot express this.** A single t-of-n over a mixed set is
satisfiable by *any* t members, so it cannot require "at least two humans"
without a t so high it also requires nearly every agent. Flat thresholds cannot
express a compartmented access structure. Two groups express it exactly, using
only the FROST we already have.

### Sizing: both 2-of-3, for unrelated reasons

| | Operating (agents/HSMs) | Creation (humans/tokens) |
|---|---|---|
| Threshold | 2-of-3 | 2-of-3 |
| Binding constraint | survives one dead **site** | any one person may **decline** at no cost |
| Why not 3-of-3 | any site outage halts all autonomous signing | one refusal becomes a veto — a coercion gate |
| No-human recovery? | none available by construction | n/a |

Travel is **not** the outage — a YubiKey 5 is USB **and** NFC, so a travelling
human with token and phone satisfies `human-touch-present`. The real cases are
**token lost/destroyed**, no trusted device, or **unwilling** — and unwilling must
stay cost-free (`declineIsCostFree`, CG-14/CG-15).

Both thresholds leave exactly **one** unit of slack, so a dead HSM or a lost
token consumes all tolerance. Replacement is urgent, and replacement is a
**reshare**, not a re-keygen.

## One token, one role

Aaron's YubiKey pack must be split by role: **external-access tokens (model
provider, cloud) must never be the same physical device as a Zeta identity
share.** Same token = losing it takes out both at once, compromising it
compromises both, and an adversary wanting either gains a reason to target the
other. Cheap now, awkward after provisioning. Enforced by
`assertOneTokenOneRole` (CG-9/CG-10).

## No remote-human gate exists, and none must be added

`CustodyGate` has exactly two members: `autonomous-hsm`, `human-touch-present`.
CG-1 enumerates the union so a third cannot be added silently. The un-remoteable
touch is the strongest property in the scheme: an adversary with full remote
access to **every** site still cannot produce a human signature.

Checked and clean: the IP-KVM / "remote finger" substrate
(`081KSE6WT0008QG0R0029S1D5Z`, `081KSNY2Z0008QG0R003FR5TVG`) is referenced only
for **power cycling and UEFI/BIOS repair** on headless nodes. Nothing wires it to
a token. `detectBiometricPlatform` is host-local (`os.platform()` + local PAM)
and fail-closed. **No remote-human path exists to remove — keep it that way.**

One thing to watch: `sessionBiometric` caches one approval and replays it. That
is correct within a single ceremony on one person's share; it must **never** span
shares held by different humans, or one person's touch would authorize another's.

## Ceremony commands — Aaron runs these, agent runs none

Order matters: each step proves something the next depends on.

**Step 0 — software-only rehearsal, no hardware, no real key.** Proves the math
and the refusals before a token is ever inserted.
```
cd tools/setup/persona-keys
bun test frost-reshare.test.ts frost-custody-contract.test.ts
```
Expect 50 pass / 0 fail. Failure here = stop; the property does not hold and no
hardware will fix it.

**Step 1 — prove the single HSM is genuinely attached** (not merely a driver on
disk — the distinction PR #10644 exists to enforce).
```
bun frost-hardware-probe.ts        # confirm PR #10644 has landed first
```
Expect a report naming a **present token with a serial**. A pass that names only
a driver path is the failure PR #10644 fixes.

**Step 2 — per-share slot binding.** `frost-share-adapter.ts:600` is
`opts.slotId ?? 0`, so every share currently resolves to **slot 0**. Enumerate
real slots before trusting a multi-token threshold:
```
pkcs11-tool --module /usr/local/lib/libykcs11.dylib --list-slots
```
Expect distinct slot ids. If three shares all land in slot 0, "three shares" is
one custody unit and the threshold is fiction. **This is not yet wired — see
Not-done.**

**Step 3 — dead-HSM recovery on ONE device.** With a **throwaway test CA**, never
the real one:
1. `ensureFrostCa` a 2-of-3 test group (`--confirm`, biometric).
2. Record `groupPublicKeyHex`.
3. Delete share 3 — simulate the dead chip.
4. Reshare from shares 1+2 to indices 1,2,4.
5. Assert the group public key is **byte-identical**, then sign with {1,4} and
   verify against the **original** key.

What failure looks like: a changed group public key (you re-keyed, not reshared),
or a verify failure (contributions did not preserve the secret —
`verifyResharePreservesGroupKey` should have caught it earlier and named the
contributing-set error).

**Step 4 — destroy the old shares and prove it.** RS-7 shows resharing revokes
nothing. Until the old set is gone there are two live quorums.

## What was deliberately NOT done

- **No ceremony run, no key material touched, printed, or logged.** Every test
  generates its own throwaway scalars, as the existing FROST tests do.
- **`frost-share-adapter.ts` and `frost-hardware-probe.ts` untouched** — PR
  #10644 (AceHack, `nazar/hardware-lane-honest-ladder`) is live in both. The
  `slotId ?? 0` per-share binding therefore **remains open** and belongs in a
  follow-up on top of #10644, not in a concurrent edit.
- **No CLI, no on-disk artifact format, no network transport.** The confidential
  point-to-point channel subshares require is unimplemented, and a reshare across
  three houses must not be attempted until it exists.
- **No `frost-ca-custody.ts` wiring** — connecting reshare to the on-disk share
  store touches the adapter surface #10644 owns.
- **Nothing centralized.** No CA, no escrow, no coordinator holding secrets. The
  auditor check runs on public points only.
