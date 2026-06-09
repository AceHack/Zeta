# Close over Reticulum in a 4×4 — RNS Identity from the seed, destination-hash IS ZetaId (both 128-bit), our own Transport-node overlay on the open internet; and the swarm is trunk-based development to its logical conclusion (TOS-clean)

**Register:** [grounded] design + opinion (Aaron) + [Beacon] anchored to Reticulum (Mark Qvist).
**Date:** 2026-06-09. **Captured by:** Otto (shadow). Consolidates four streamed nodes into one arc.

## Aaron's words

> "get the privacy primitives right so y'all all have your own keys." · "let's pull in Reticulum and
> start closing over it in another 4×4 too, and tie it into our keys and ZetaId." · "we will run our
> own neighborhood/mesh on the open internet — what do you think? what do they call it?" · "I read
> through GitHub's TOS too and I'm not breaking any TOS — I'm following trunk-based development to its
> logical conclusion; high-performance trading teams check in every few minutes or more into prod."

## 1. Close over Reticulum in a 4×4 (dep-as-oracle — conform, don't guess)

Reticulum (RNS) is closed over the **same way we close over crypto / proof tools**: the
own-all-interfaces, two-adapter pattern — **port + (a) upstream-dep-as-oracle + (b) own-impl**, always
support both, contribute upstream. The upstream **`markqvist/Reticulum` reference is the oracle**; we
**conform to its bytes**, we do not guess wire formats. The 4×4 treaty byte-locks RNS's primitives
across our oracles/serializers:

```text
reticulum 4x4 room = 4 oracles (F#/C#/TS/Rust) x 4 serializers, n-axis = RNS primitives:
  Identity (X25519 + Ed25519 keyset) · Destination (truncated-SHA-256 hash) · Packet/announce
  format · Link (ECDH session). Each byte-locked hex-in-JSON; the upstream RNS output is the
  differential oracle every cell replays.
```

This is how we "start closing over it": pull RNS into `references/prior-art` as the oracle, write the
treaty's golden vectors **from** RNS output, and make our F#/C#/TS/Rust ports reproduce them
byte-for-byte. (Added to `docs/PRIOR-ART-LIST.md`.)

## 2. RNS Identity from the keyring seed — "y'all all have your own keys" (for Reticulum too)

An RNS **Identity** is a **512-bit keyset = X25519 (encryption) + Ed25519 (signing)** — both 32-byte
keys. We already derive type-separated keys from one BIP-39 seed (`derive.ts`); add a **Reticulum key
type on its own derivation path** (Ed25519 via SLIP-0010; X25519 from a derived 32-byte scalar). So a
traveler's Reticulum identity comes from the **same seed** as their SSH/PGP/Nostr/BTC/ETH/SOL keys —
deterministic, dual-key-rotatable (`keyset.ts`), byte-locked. Each persona/traveler already has keys;
this makes those keys their **network identity**, not just their signing/wallet identity.

## 3. Destination-hash IS ZetaId — both 128-bit (the clean tie)

RNS addresses are a **truncated SHA-256** (Reticulum truncates to its address width). **ZetaId is
128-bit.** The tie: a traveler's **RNS destination hash = its ZetaId** — derive the destination hash
at 128-bit and **use the ZetaId as the network address**. This is the deep fit: in Reticulum your
**address is a hash of your identity, not an IP/DNS name assigned by anyone** — so **ZetaId becomes the
sovereign, self-certifying network address.** No DNS, no IP identity, no registrar: the 128-bit ZetaId
*is* where you are reachable. (This is the SuperFluid / down-to-the-metal sovereignty thesis realized
at the network layer — the address is self-owned, derived from the seed.)

## 4. Our own overlay on the open internet — what they call it (+ my opinion)

**My opinion: yes — this is exactly what Reticulum is for, and it's the right move.** Reticulum is a
**cryptographic overlay network** designed to run over *anything* (LoRa, packet radio, **TCP/IP over
the open internet**, I2P) with **no dependence on the underlying network's addressing** — your
destination hashes are your addresses. Running our own means our mesh needs **no DNS, no static IPs, no
CA** — ZetaId is the address, the keyring is the identity. That is the sovereignty fit nothing else
gives us this cleanly.

**What they call it (RNS terms — Beacon):**

- **Transport node** — a Reticulum instance run with transport enabled; it **routes/relays** for
  others. *Running our own mesh = standing up Transport nodes.*
- **Interface** — how a node connects to a medium; over the open internet that's
  **`TCPServerInterface`/`TCPClientInterface`** (or **`I2PInterface`** for anonymity). The set of peers
  on an interface is your link-local reach.
- **Announce** — how a destination becomes known/reachable across the network (propagated identity +
  destination). Your reachable set = who you've heard announces from within transport reach.
- **Hub** — a well-connected Transport node that bridges networks over the internet (the public RNS
  network has community hubs).
- **Testnet** — the existing public Reticulum network (public hubs). Our own = our own
  network/overlay, optionally peered.
- **Overlay network** — the general term for what we're building.

On **"neighborhood"**: RNS has no "neighborhood" term — so it's a **Mirror coinage**, and that's fine
if we Beacon-anchor it: *Zeta "neighborhood" = the announce-reachable set within transport reach* (the
destinations a node can hear/route to). Use "neighborhood" internally; compress to "announce horizon /
Transport reach" when it must stand on its own.

## 5. The swarm is trunk-based development to its logical conclusion (TOS-clean) — my read

> "I'm not breaking any TOS — trunk-based dev to its logical conclusion; HFT teams check in every few
> minutes into prod."

**The framing is sound for the *commit* dimension.** Continuous merge-to-main is **trunk-based
development** (Google/HFT practice: small, frequent commits straight to trunk, CI-gated). HFT/
low-latency teams *do* deploy-to-prod many times a day. A self-merging test swarm that merges proven
ticks to main is **trunk-based dev taken to its limit** — high commit frequency is not, by itself, a
TOS violation.

**Honest peel — where the actual line is (so we stay clean):** the TOS risk was never *commit
frequency*; it's **Actions compute usage** and **API rate-limit / abuse-detection**. So the disciplines
that keep us clean:

- **Don't run the heavy swarm on free GitHub Actions minutes.** The cooperative self-scaling swarm runs
  on **our own runners / our own compute** (the two-mode infra: equipment mode). GitHub is the **trust
  bootstrap + trunk**, not the swarm's compute substrate. (This is exactly the "close over the GitHub
  border" thesis — depend on it less over time.)
- **Respect API rate limits + abuse-detection.** Continuous pushes are fine; hammering the API/Actions
  in a tight loop is what trips detection. The PAT-armed + `[skip ci]` + actor-guard + run-marker
  discipline (already documented) keeps CI from infinite-looping; the same care bounds API calls.
- **Agents, not bots.** Commits carry the AgencySignature trailer + real authorship — accountable
  agency, not anonymous automation. That's the spirit GitHub's automation terms care about.

Net: the **trunk-based / HFT analogy holds for commits**; keep the heavy compute on our own runners and
respect rate limits, and the swarm is TOS-clean. The git history just becomes what it always was for
HFT — a high-frequency, fully-attributed event log.

## Honest scope / handoff (the concrete build sequence)

Design + opinion + Beacon naming; the crypto is **not built yet** and must be **conformed to oracles,
not guessed**:

1. **Privacy primitives (next, oracle-anchored):** NIP-01 **schnorr sign/verify** (recognition;
   trivial via `@noble/curves` schnorr) + **NIP-44 v2 encrypt/decrypt** (budgeted disclosure;
   `@noble/ciphers` ChaCha20 + `@noble/hashes` HKDF/HMAC present) on the keyring's **nostr** keypair —
   **byte-locked against the official NIP-44 test vectors.**
2. **RNS Identity from the seed:** add the Reticulum key type to `derive.ts` (Ed25519 + X25519),
   **byte-locked against `markqvist/Reticulum` output** (the oracle).
3. **destination-hash = ZetaId (128-bit):** the address derivation, byte-locked to RNS.
4. **Reticulum 4×4 treaty + own Transport-node overlay:** the close-over treaty + our own hubs.

Routes to: the F#/C#/TS/Rust core (the 4 oracles), Mateo/Nazar (RNS privacy + overlay ops), Aminata
(threat-model the open-internet overlay), Soraya/Sova (the byte-lock + privacy proof-rooms), Dejan
(our-own-runner infra, the two-mode split), `references/prior-art` + `PRIOR-ART-LIST` (pull RNS in).

## Anchors / ties (Beacon)

**Reticulum** (Mark Qvist) — cryptographic overlay; Identity = X25519 + Ed25519 512-bit keyset;
Destination = truncated SHA-256; Transport node / interface (TCP/I2P) / announce / hub / Testnet;
runs over the open internet with self-certifying hash addresses. NIP-01 (schnorr) + NIP-44 v2
(versioned ChaCha20+HMAC, official test vectors) — the privacy primitives on the nostr keypair.
Ties: `derive.ts`/`keyset.ts` (the seed → keys, dual-key rotation); **ZetaId (128-bit) = RNS
destination hash**; own-all-interfaces / dep-as-oracle / two-adapter (close-over discipline); the
privacy launch gate; prod=test swarm; trunk-based development (Google/HFT) + the GitHub-border close-
over + AgencySignature (agents-not-bots).
