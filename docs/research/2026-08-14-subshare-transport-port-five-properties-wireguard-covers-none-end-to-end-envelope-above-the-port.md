# Subshare transport: the five properties, and why WireGuard covers none of them end to end

**Date:** 2026-08-14 · **Agent:** Nazar · **Work-item:** `081M00QYADA087G0R00354VR6W`

## The blocker this answers

`tools/setup/persona-keys/frost-reshare.ts` (landed in PR #10654) implements verifiable
share redistribution: each holder derives `u_i = λ_i·s_i`, splits _that_, recipients sum,
the group public key is preserved byte-identically, and the signing scalar is never formed
in any process. Its header states its own limit and its own conclusion:

> SUBSHARE TRANSPORT IS CONFIDENTIAL-OR-BUST, AND THIS MODULE DOES NOT PROVIDE THE
> TRANSPORT. … A coordinator that relays subshares in the clear has re-created the single
> point of failure this module exists to remove, while appearing to run a distributed
> ceremony.

So transport was the hard blocker on the geographically-distributed custody story.

## The shape of the answer: a port, not a VPN integration

Aaron 2026-08-14:

> "we will likely use our own alternative to wireguard based on my tcp hole punching and
> websocket reverse tunneling and dht transport eventually, we will have to design all this
> out but **this should be a hexagonal interface** we don't want to fully depend on
> wireguard interfaces fully **we need our own ports**"

This is `interfaces-free-classes-earned-under-rules.md` at the integration boundary: the
port is the free default, an adapter is earned. So the deliverable is the **contract**;
WireGuard is adapter detail, and the analysis below is the contract itself rather than a
verdict on one VPN.

Designing port-first changed the answer materially. A DHT transport has **no session**.
Reticulum and LoRa are closer to store-and-forward than to a tunnel. Sneakernet is
store-and-forward by definition. A WireGuard-first port would have quietly assumed a
session and been wrong for all four.

---

## 1. What a subshare actually needs from a transport

### Is a subshare secret-equivalent in transit?

**Yes, and this is the question that decides everything else.** `k` subshares addressed to
the same new participant `j` sum to `s'_j` — summing them _is_ the reconstruction. And
`s'_j` is a long-lived share of a group key whose whole purpose is to be a stable trust
anchor for years.

Two consequences follow directly, and neither is optional:

1. **Forward secrecy is REQUIRED, not nice-to-have.** An adversary who records the channel
   today and compromises an endpoint at any later date recovers a share that is still live.
   The value of the recording does not decay.
2. **The KEM must be post-quantum.** Harvest-now-decrypt-later is not a hypothetical here;
   it is the literal, precise threat model for this one message type.

The signature is the mirror image and does **not** need to be post-quantum: a forged
subshare must be forged _during_ the ceremony, because the ceremony terminates in
`verifyResharePreservesGroupKey` and the artifacts are archived. A quantum forgery produced
in 2040 against a 2026 ceremony has no verifier left to fool. Hence X-Wing for
confidentiality, ed25519 for authenticity — ~1.2KB per datagram instead of ~5KB, which
matters on LoRa.

### The five properties

|        | Property                                                               | Provided by    |
| ------ | ---------------------------------------------------------------------- | -------------- |
| **P1** | Confidentiality **to the addressee** — not to the node, not to a relay | above the port |
| **P2** | Holder authenticity, bound to a **pinned key**, never to a route       | above the port |
| **P3** | Ceremony binding + replay resistance                                   | above the port |
| **P4** | Forward secrecy under later endpoint compromise                        | above the port |
| **P5** | Eventual delivery, **without** liveness, order, or exactly-once        | the port       |

**On ordering: none is required, and that is a structural fact rather than a tolerance.**
`reshareCombine` _sums_ the subshares. Addition is commutative and associative, so the fold
has no order to preserve. What the ceremony needs is **completeness** — exactly one subshare
per contributor, which `reshareCombine` already enforces — not sequence. This is what makes
the offline story affordable rather than merely permitted.

**On replay, the consequence is worse than a corrupted ceremony.** Replaying ceremony A's
subshares into ceremony B makes the new share set _not independent_ of the old one — and
that independence is precisely the guarantee proactive refresh rests on (Herzberg, Jarecki,
Krawczyk & Yung, CRYPTO '95: `k-1` old plus `k-1` new shares must reveal nothing). So a
successful replay does not merely break one ceremony; it silently downgrades the security of
every refresh that follows. This is the classical Denning–Sacco replay attack on a
key-distribution message, in a setting where the damage is retroactive.

---

## 2. WireGuard's coverage, per property

|        | WireGuard / tailscale                                                                                                                                                                                                  | Sufficient alone? |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **P1** | Point-to-point between **nodes**. A relaying coordinator terminates the tunnel and reads the subshare in clear; a DHT has untrusted intermediaries by construction. Covers the wiretap, not the relay.                 | **No**            |
| **P2** | Authenticates the peer's static **node** key. Node identity is not holder identity (`docs/writer-actor-routing-model.md`): one node may host several personas, a share may move hosts, and headscale can admit a node. | **No**            |
| **P3** | Sliding-window anti-replay **within a session**. Across sessions, reboots, or ceremonies a replayed datagram is a fresh valid packet. A sessionless adapter has no window at all.                                      | **No**            |
| **P4** | Genuine forward secrecy **in flight** (Noise_IK, rekey ~2 min). But FS is a property of a _channel_, and a store-and-forward datagram spends most of its life outside one — in a spool, a DHT, a USB stick.            | **No**            |
| **P5** | Requires both endpoints reachable over UDP; tailscale additionally requires the control plane reachable to establish or refresh. No store-and-forward at all.                                                          | **No**            |

### The headline, stated plainly

**WireGuard is sufficient for none of the five end to end, and required for none of them.**

The expected answer was "sufficient for 3, add 2 at the application layer." That answer is
wrong, and it is wrong in the direction that makes the result _better_: because nothing
depends on the mesh, the ceremony inherits no dependency on it.

What WireGuard genuinely buys, and the honest reason to run it anyway:

- **Metadata concealment.** The datagram's routing exterior (`ceremonyId`, `fromX`, `toX`)
  is cleartext by design so an adapter can address it without opening it. A network observer
  therefore learns who is resharing with whom and when. A mesh hides that from the network.
  This is real value and it is not nothing.
- **Coarse admission and reachability.** Convenient. Not load-bearing.

---

## 3. The control-plane trust dependency, named

Even self-hosted, headscale decides **who is admitted to the mesh** and issues the keys that
admit them. It never sees subshare contents. But admission is an authority, and the question
is whether share custody should depend on it.

**Recommendation: no, and the design makes "no" achievable rather than aspirational.**

Holder keys are pinned in a **`CeremonyRoster`** — an explicit, out-of-band list of
`(participant index → long-term ed25519 public key)` — which the envelope verifies at seal
time and at open time. The roster is deliberately _not_ distributed by any code in this
change; a roster fetched from the mesh would hand the control plane exactly the authority
the pin exists to deny it.

Two independent gates, and they compose:

1. **Mesh admission** (headscale): can this node send packets?
2. **Ceremony admission** (roster): is this a rostered holder for this seat?

A fully compromised control plane can add a node. That node's datagrams fail P2 with
`unknown-sender` — its key is not pinned. If it somehow obtained a rostered holder's
long-term key, `verifyResharePreservesGroupKey` still catches a substituted secret from
public points alone. Compromising the mesh does not silently add a participant.

The residual, stated so nobody discovers it later: **roster distribution is out of scope**
and must happen out of band — fingerprints confirmed on a call, or carried with the hardware.
Roster rotation and revocation belong with the delta-rotation work, not here.

---

## 4. Offline / partition: is live connectivity required?

**Eventual delivery suffices. No property requires a live session, and the port refuses to
require one.**

The port is two verbs. `offer` is named for what it is — handing a datagram to a carrier —
because no adapter can promise delivery. `collect` is a pull, because a push requires a
session. `offer` must succeed when the recipient does not exist; `collect` must return `[]`
rather than blocking. Datagrams may be delayed, reordered, duplicated, and re-offered after
loss.

Sessionlessness has exactly **two costs, both paid locally, neither by the channel**. These
are the constraints on adapter 2 and are the reason to write them down now:

1. **The recipient needs durable local storage.** Replay resistance without a session is a
   seen-log (`ReplayGuard`, grow-only, serialisable to text) rather than a sequence window.
   The channel keeps no state; the recipient does, and it must survive a reboot mid-ceremony
   or it loses P3 across the reboot.
2. **The ceremony has two asynchronous phases.** Forward secrecy without a handshake needs
   the recipient's per-ceremony KEM public key published _before_ holders seal (X3DH's
   signed-prekey trick, minus the sessions). That is a happens-before at the application
   layer, not liveness — both phases can be sneakernet, days apart.

Neither constrains a DHT, a hole-punched TCP link, Reticulum, LoRa, or a person with a USB
stick.

---

## 5. What shipped

| File                                                         | Role                                                                                                                                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/setup/persona-keys/subshare-transport-port.ts`        | The port. Five properties as data, `providedBy` per property, adapter capabilities that no code may depend on.                                                                            |
| `tools/setup/persona-keys/subshare-envelope.ts`              | The above-the-port security layer (P1–P4). X-Wing KEM to a roster-signed per-ceremony pre-key; ed25519 over canonical JSON; coordinate-binding AAD; replay guard; destroyable key handle. |
| `tools/setup/persona-keys/subshare-spool-adapter.ts`         | Adapter 1 (P5). A directory of text files, content-addressed filenames. Carried by mesh, scp, Reticulum, or courier.                                                                      |
| `tools/setup/persona-keys/subshare-transport-conformance.ts` | The falsifier, **shipped** so adapter 2 can be held to the same bar.                                                                                                                      |
| `tools/setup/persona-keys/subshare-transport.test.ts`        | Mutants first, then conformance, then a real three-house reshare over the spool.                                                                                                          |

The placement rule is the whole point of the hexagonal split here: **everything WireGuard
does not cover lives above the port.** If replay protection lived in a WireGuard adapter, the
DHT adapter would reimplement it and get it subtly different. Above the port, every adapter
inherits it unchanged — including the sneakernet "adapter," which is a person and cannot run
adapter code at all.

## 6. Mutation results

Nine checks that could not fail were found in this repository on 2026-08-14 — including a
probe that reported an empty file as attached hardware. A transport conformance suite that
passes against a plaintext channel would have been the tenth, and the worst, because what it
would falsely bless is a key ceremony. So the suite is proved falsifiable _before_ it is used
as evidence, and each mutant must kill **named** probes, not merely fail somewhere.

| Mutant                                                    | Breaks | Named probes that die                                                                                                        |
| --------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| M1 plaintext channel                                      | P1     | `P1.a/secret-not-on-the-wire`, `P1.b/collector-of-all-k-cannot-open`                                                         |
| M2 no sender authentication (trusts the routing exterior) | P2     | `P2.a/unrostered-sender-rejected`                                                                                            |
| M3 no replay guard                                        | P3     | `P3.a/identical-redelivery-is-idempotent`, `P3.b/conflicting-datagram-at-same-coordinate-rejected`                           |
| M4 long-term recipient key, `destroy()` is theatre        | P4     | `P4.a/prekey-is-fresh-per-ceremony`, `P4.b/destroy-revokes-recorded-datagrams`, `P4.c/long-term-compromise-does-not-recover` |
| M5 session-bound transport (cold reader sees nothing)     | P5     | `P5.c/cold-reader-collects-everything-offered`                                                                               |

All five die. The shipped implementation passes all 18 probes on both the memory spool and
the filesystem spool. The end-to-end test runs a real 2-of-3 → 2-of-3 reshare over the spool
with reversed delivery order and every datagram delivered twice, destroys each per-ceremony
key, confirms recorded datagrams are then dead bytes, and verifies a threshold signature
against the **unchanged** group public key.

One mutant had to be rewritten mid-work, and it is worth recording why. M4's first version
wrapped the real key handle with `isDestroyed: () => false`. It "failed" P4 — but for the
wrong reason: the decapsulation capability is bound to the handle _object_ via a `WeakMap`,
so the spread-copy simply could not decrypt anything. A mutant that dies of the wrong cause
is not evidence either. The rewritten M4 re-derives a long-term key from a fixed seed, which
is what a real "we have an encryption key and we use it" implementation looks like.

## 7. What I deliberately left

- **Roster distribution and rotation.** Out of band by design (§3). Rotation/revocation
  belongs with the delta-rotation work already live in this area; I stayed in transport.
- **Traffic-analysis resistance.** Routing fields are cleartext so adapters can route without
  opening. A mesh carrier is the mitigation, and it is the honest reason to run one.
- **A live network adapter.** The spool plus a carrier is smaller, testable hermetically, and
  covers sneakernet and Reticulum for free. Building a socket adapter would have added an
  untestable surface for no property.
- **Tier.** Still L1. The scalar is in host RAM at seal and open, exactly as
  `frost-reshare.ts` caveat 1 says of the reshare arithmetic itself. This changes nothing
  about that, and the arrival of a PKCS#11 chip will not change it either.
- **Old-share destruction** (`frost-reshare.ts` caveat 3). A reshare that does not end in
  verified destruction of the old shares has raised the number of live quorums from one to
  two. Still open, still not transport.
- **The operational half of forward secrecy.** The tests falsify the cryptographic half (a
  destroyed handle cannot open). They cannot falsify swap files or core dumps. A passing test
  is not proof that the secret left the machine.

## Anchors (Beacon)

- Cockburn, _Hexagonal Architecture / Ports and Adapters_ (2005) — the port/adapter split.
- Herzberg, Jarecki, Krawczyk & Yung, _Proactive Secret Sharing_ (CRYPTO '95) — the
  independence property P3 protects.
- Needham & Schroeder (1978); Denning & Sacco (1981) — replay of a recorded key-distribution
  message.
- Günther (1990); Diffie, van Oorschot & Wiener (1992) — forward secrecy.
- Marlinspike & Perrin, _X3DH_ (2016) — signed published prekeys: forward secrecy **without**
  liveness, the construction that lets P4 and P5 both hold.
- Connolly, Schwabe & Westerbaan, _X-Wing: The Hybrid KEM_ (2024).
- Bernstein et al., ed25519 (2011); RFC 8439 (ChaCha20-Poly1305); RFC 5869 (HKDF).
- Goguen & Meseguer (1982) — noninterference: the port is the only declared door.
- Donenfeld, _WireGuard: Next Generation Kernel Network Tunnel_ (NDSS 2017) — the Noise_IK
  construction whose properties are assessed in §2.
