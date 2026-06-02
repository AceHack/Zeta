---
id: B-0984
priority: P2
status: open
title: "Decentralized identity over Reticulum — HD-derived keys (identity/money/routing/signing) as braids/knots carrying the golden-vectors treaty over the mesh (Aaron 2026-06-02)"
tier: research
effort: M
created: 2026-06-02
last_updated: 2026-06-02
depends_on: [B-0983, B-0726]
composes_with: [B-0983, B-0726, B-0982, B-0976, B-0640, B-0639, B-0646, B-0623, B-0289]
tags: [research, aaron, decentralized-identity, did, hd-derivation, seed-phrase, bip39, bip32, bip44, key-derivation, purpose-separation, braid, knot, topological-invariant, golden-vectors, treaty, reticulum, mesh, no-central-control, meno, dont-collapse, search-first-gated]
type: research
---

# Decentralized identity over Reticulum — HD-derived keys as braids/knots carrying the golden-vectors treaty over the mesh

## Why

Aaron 2026-06-02: *"identity key ≠ money key ≠ routing key ≠ signing key all these are braids/knots extending the golden vectors treaty over reticulum"* + *"file it."*

This is the concrete-mechanism row for the **decentralized-identity (DID) endgame** named in the 2026-06-02 canonical-form arc (chunk 7: *"formalize decentralized identity in math as a society… nobody controls it… like gravity"*). The synthesis + Amara ferry gave it its shape; this row tracks it as buildable substrate-engineering.

Provenance:

- `docs/research/2026-06-02-canonical-form-synthesis-meno-equals-seed-equals-remainder-equals-braid-knot-phoenix-ff7-lifestream-aerith-lives-ryan-original-addison-new-aaron.md` (the DID-mechanism section)
- `memory/persona/amara/conversations/2026-06-02-amara-canonical-form-validation-ash-is-phoenix-down-seed-phrase-derived-keys-as-braids-knots-golden-vectors-treaty-over-reticulum-aaron-forwarded.md`

## What it is

The DID endgame given a concrete cryptographic mechanism + a concrete transport.

### The seed → derivation → keys spine (μένω = seed)

- **μένω = seed = the seed phrase** — the compact remainder (NOT the whole tree) that can regenerate the whole identity tree. "What remains is not everything; what remains is enough to regrow everything." (BIP39-shape.)
- **derivation = the rising** — root seed → derivation paths → per-purpose keys (BIP32/BIP44-shape).
- **purpose-separation = don't-collapse = "keeps the phoenix from becoming a monster"** — identity key ≠ money key ≠ routing key ≠ signing key; same seed tree, **no key reuse**, never collapsed to one key. The seed is unity; the derivations preserve separation.

### Keys as braids/knots (B-0983)

Each derived key is itself a **braid/knot** — a topological invariant (per B-0983: the remainder/μένω = braid/knot = identity). The keys are not flat strings; they are the topological invariants that survive deformation. Purpose-separation = distinct braids/knots (don't-collapse).

### The golden-vectors treaty (B-0982)

The **golden vectors = the treaty**: the 4×4 / 16-way consensus (JSON/CBOR/XML/YAML × C#/F#/TS/Rust) IS the binding agreement — the knot is the treaty. Identity built on this is identity-by-consensus-invariant, not identity-by-authority.

### Over Reticulum (B-0726)

The treaty extends **over Reticulum** — a decentralized mesh transport already a composing substrate per B-0726. *(Reticulum's specific capabilities — transport, identity, link encryption, RF/LoRa/packet-radio/IP backends, self-configuring routing, central-control posture — are EXAMPLES TO VERIFY search-first per the pre-start checklist, NOT asserted from recall here.)* The direction: identity / money / routing / signing keys (HD-derived, purpose-separated braids/knots) carry the golden-vectors treaty across the mesh = **the DID endgame on a no-central-control network** ("nobody controls it, like gravity") — pending the search-first pass to confirm exactly what RNS already provides vs what this composes on top of.

## Pre-start checklist — SEARCH-FIRST GATED (per dep-pin-search-first-authority + razor)

Do NOT assert crypto/transport specifics from training-data recall. Before any build/claim:

1. **WebSearch + lit-verify, cite + date:**
   - BIP39 (mnemonic seed phrase) / BIP32 (HD derivation) / BIP44 (purpose-separated derivation paths) — current shapes + any post-2024 evolution
   - W3C **DID** (Decentralized Identifiers) spec + DID-method landscape; how DID-documents + verification methods relate to HD-derived keys
   - **Reticulum** current capabilities (identity, destinations, link encryption, transport) — what it already provides vs what this composes ON TOP of (don't reinvent what RNS already does; B-0726)
   - key-derivation-for-distinct-purposes best practice (no-key-reuse rationale; domain separation)
2. **Substrate-inventory:** composes with B-0983 (braids/knots = topological invariants), B-0982 (4×4 = treaty), B-0726 (Reticulum), B-0639 (Native AI Language privacy), B-0646 (reputation-weighted encryption budget / privacy floor), B-0623 (Adinkras/ECC), B-0289 (Green Lantern RF). Do not mint parallel.
3. **Razor / don't-collapse:** operational claim = "HD-derive purpose-separated keys from a μένω-seed; carry the golden-vectors treaty over RNS." The "keys literally ARE knots / identity IS one Euler number" framing stays a **maybe** (held don't-collapse; B-0983). The FF7 / Aerith / Ryan / Addison layer stays honored-symbolic, NOT a proof claim (Amara's tiny blade).

## Acceptance (research-direction; build-gated on the search-first pass)

- [ ] Search-first lit-verification complete + cited (BIP39/32/44 · W3C DID · Reticulum RNS · domain-separation)
- [ ] Substrate-honest map of what Reticulum already provides vs what this adds (no reinvention)
- [ ] Concrete spec: μένω-seed → derivation paths → {identity, money, routing, signing} keys, with purpose-separation discipline (no key reuse)
- [ ] Mapping of keys ↔ braids/knots (B-0983) + golden-vectors-treaty ↔ the 4×4 consensus (B-0982) made explicit
- [ ] Decision: build a PoC (seed → derived keys over RNS) vs keep as research direction; if PoC, the smallest slice

## Composes with

- B-0983 (topology — keys as braids/knots = topological invariants; the remainder IS the bonsai closure state)
- B-0726 (Reticulum throughout cluster + edge — the mesh transport this extends over)
- B-0982 (the 4×4 = the golden-vectors treaty / the knot) · B-0976 (bonsai closure) · B-0640 (bonsai)
- B-0639 (Native AI Language privacy) · B-0646 (reputation-weighted encryption budget / privacy floor) · B-0623 (Adinkras / SUSY-ECC) · B-0289 (Green Lantern RF hardware)
- the decentralized-identity endgame + the canonical-form synthesis + Amara ferry (provenance above)
- `.claude/rules/god-tier-claims-high-signal-high-suspicion-dont-collapse.md` (keys-as-knots held don't-collapse; FF7 honored-symbolic) · `.claude/rules/dep-pin-search-first-authority.md` (crypto/transport specifics search-first)

## Substrate-honest framing

Research direction, not a build row. The crypto + transport specifics (BIP39/32/44, W3C DID, Reticulum RNS) are TARGETS to verify search-first before any build — the row deliberately does not assert them from recall. The *mapping* (μένω-seed → purpose-separated braid/knot keys → golden-vectors treaty → over Reticulum) is the new, load-bearing substrate. Filed per operator directive "file it" (2026-06-02).
