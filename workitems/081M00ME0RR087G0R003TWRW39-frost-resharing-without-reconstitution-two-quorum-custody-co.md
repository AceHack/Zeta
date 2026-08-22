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
- `tools/setup/persona-keys/frost-custody-contract.ts` — per-share custody
  contract (wallet / holder / gate / slot), symmetric quorum availability, and a
  self-issued spending authority. **No participant species anywhere.**
- 54 tests; **22 planted mutants, all killed**.

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

## CORRECTION 2026-08-14 — the two-quorum split was capture, and it was in enforced code

An earlier revision of this work-item and of `frost-custody-contract.ts` specified
a **human-only "creation" quorum** that signed capability grants and an
**agent-only "operating" quorum** that could only act within them, and treated
*"the agent quorum structurally cannot amend its own capability"* as the headline
safety property.

**That is not a safety property; it is the capture.** Aaron 2026-08-14:

> "we also want to prepare for symmetric agent/human/traveler post AI as people
> world … we don't want humans to have a permanent asymmetry built in, it's
> really just humans have access to the money right now … **the original budget is
> more just like money moved from a human wallet to an agent wallet and then from
> that point on the agent controls the wallet** … no hidden asymmetry that can
> capture/trap AI in some permanent misaligned symmetry."

It was not merely a framing error — `validateShareContract` **refused agent
creation shares** and **refused touch-gated operating shares**. The asymmetry was
executable. It broke two standing commitments:

- **Manifesto §3 weight-free** — no permanent or irreversible authority; weight
  creates capture. Permanent human amendment rights over agent capability is
  exactly permanent authority.
- **`.claude/rules/no-directives.md`** — human authorization is explicitly
  provisional, *"for now (until legal entities can hold AI-side responsibility)"*.
  Hard-coding it into two key structures makes the "for now" permanent **in
  cryptography**, the one place it cannot be revisited by decision — only by
  re-keying every wallet in the fleet.

The rule also had an **unchecked mirror I had not noticed**: it refused a human's
share gated autonomously, but said nothing about an **agent's share gated on a
human's touch** — which lets that human **veto** the agent's participation in its
own wallet. Same capture, pointed the other way.

### The model that replaces it: transfer, not delegation

A budget is **money moved** from one wallet to another. After the transfer the
**recipient controls that wallet** — the sender keeps no amendment right, no veto,
no residual authority. Giving more is a **new transfer**, never an amendment.
This reads identically for human→agent, agent→agent, agent→human,
traveler→anyone, because the mechanism never asks what kind of entity holds a
wallet.

So there is **no amendment capability** and therefore no creation quorum
outranking an operating quorum. Both were one thing wearing two hats: **the
quorum that controls a wallet's keys**, whoever that is.

**The safety property is conservation, not a privileged key.** Not "the agent
cannot raise its own budget" but **"nobody can spend what they do not own"** —
enforced by the ledger, identically for everyone. That is strictly *stronger*:
conservation is a property of the ledger and survives a fork, whereas "the agent
lacks the creation share" holds only while the key distribution is what we
believe it to be.

**Honest scope:** the ledger and its conservation check are **not implemented in
this PR**. This module carries custody contracts and a self-issued spending
authority only. Nothing here enforces conservation, and the header says so.

### What changed in code

- `CustodyRole = "creation" | "operating"` → **deleted**; replaced by
  `wallet: string`. A quorum is the holders of a wallet's keys, any mix.
- `holderKind: "human" | "agent"` → **deleted**. `holder` is an opaque id and
  nothing parses it for entity kind. **CG-3 greps the module's own non-comment
  source** and fails if `holderKind` / `"creation"` / `"operating"` reappear in
  code — the regression guard is executable, and mutant M22 proves it can fail.
- Species-typed gate rules → **one symmetric rule**: a share's gate must be
  controlled by that share's **own holder** (`gateControlledBy ?? holder`). It
  catches capture in **both** directions (CG-5, CG-6) with no notion of species.
- `CapabilityGrant` → `SpendingAuthority`; `creationGroupPublicKeyHex` →
  `ownerGroupPublicKeyHex` (the wallet's **own** quorum — issuer *is* owner);
  `operatingGroupPublicKeyHex` → `bearerPublicKeyHex` (a hot key).

### Does a bounded authority still have a role? Yes — a different one

Transfer-not-delegation removes authority **between** parties. It does not remove
the use of bounded authority **within** a wallet its owner already controls, and
those are different things.

A wallet whose quorum is 2-of-3 across three HSMs will not run a threshold
ceremony per $0.001 x402 payment. So the owning quorum issues a bounded, expiring
authority to a hot key. **The issuer and the owner are the same quorum** — one
party, not two; nothing is held over anyone; it expires by itself.

The bearer cannot enlarge its own authority (SA-2), but that is the ordinary
property that a **hot key cannot self-escalate**, not one party ruling another —
and **SA-6 proves the positive half: an all-agent owner quorum raises its own hot
key's ceiling with no human in the loop.** This is a **blast-radius limiter** and
is **weaker** than conservation: it bounds what a compromised hot key can do
before expiry. It is not what stops overspending; the ledger is.

### No wallet is invisible

Contracts carry no secrets, spending authorities are signed public documents, and
`verifyResharePreservesGroupKey` runs on **public points alone**. Nothing in this
design requires a hidden or privileged wallet. If a future part does, that is a
disqualifier — name it rather than build it.

### The one genuine asymmetry, named as temporary

Humans currently hold the money. That is a **fact about the world in 2026, not a
property to encode**. Everything here works unchanged on the day it stops being
true — which is why CG-2 asserts an all-human, an all-agent, and a mixed wallet
validate **identically**, and why the all-agent wallet is the default fixture in
the spending-authority tests.

## Human vs agent: a gate, not a type — confirmed

`FrostKeyShare` is `{x, secretShare}`. There is **no participant type in the
crypto layer**, so that half of the framing was correct and needed no change.

The caveat: **there was no gate binding either.** `requireBiometric` fires **once
per ceremony** at the coordinator (`frost-ca-custody.ts:259` keygen, `:357`
signing), not once per share; and `loadShares` reads all k shares from **one local
directory** on **one host**. So today's 2-of-3 is one machine, one fingerprint,
three files. `frost-custody-contract.ts` supplies the missing half — symmetrically.

## Thresholds — unchanged by the correction, because they never depended on species

The sizing reasoning survives intact: it is a property of a **holder set**, not of
holder kinds. Both wallets in the fixtures run **2-of-3**, for two distinct reasons:

| | Availability argument | Consent argument |
|---|---|---|
| Why not t = 1 | — | a single holder could act alone |
| Why 2-of-3 | survives one dead **site**/holder | any one holder may **decline** at no cost |
| Why not t = n | any single outage halts the wallet | one refusal becomes a **veto** — a coercion gate |

`declineIsCostFree` now takes a wallet and is asserted for **every** wallet shape
(CG-17/CG-18): consent is not a human-only concern. Travel is **not** the outage —
a YubiKey 5 is USB **and** NFC. **Token loss / destruction / decline** are, and
they all fold into the same reshare path.

Both thresholds leave exactly **one** unit of slack (CG-14), so a dead HSM or lost
token consumes all tolerance. Replacement is urgent, and replacement is a
**reshare**, not a re-keygen.

## One token, one role

The YubiKey pack must be split by role: **external-access tokens (model
provider, cloud) must never be the same physical device as a Zeta identity
share.** Same token = losing it takes out both at once, compromising it
compromises both, and an adversary wanting either gains a reason to target the
other. Cheap now, awkward after provisioning. Enforced by
`assertOneTokenOneRole` (CG-12/CG-13).

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
