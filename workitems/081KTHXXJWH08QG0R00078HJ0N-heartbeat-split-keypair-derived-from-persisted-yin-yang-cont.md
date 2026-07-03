---
id: 081KTHXXJWH08QG0R00078HJ0N
type: task
state: backlog
priority: P2
slug: heartbeat-split-keypair-derived-from-persisted-yin-yang-cont
title: "Heartbeat split keypair derived from persisted yin/yang control: stable long-term identity key from yang (DynamicValue determinate seed, ZetaId-linked, hub) + ratcheting per-beat key from yin (SoftValue unique uncertainty, satellite, Double-Ratchet shape). Per-beat key entropy = agent's lived uncertainty trajectory = the #6914 anti-Sybil independent-entropy floor made concrete. HARD constraints: (1) one-way KDF only, never invert pubkey->belief-state (#6902 privacy); (2) ratchet over hash(DynamicValue.toCanonicalXml(state_t)), NOT live float posterior (4-lang byte-lock / culture-invariant, else keys diverge across oracles + DST breaks). Chain commits ratchet advances (Nostr/Miner-ID binding, ratcheting). ROUTE construction to Soraya (formal) + Mateo (security) before impl. Design rec, not proven sound. Anchors: Double Ratchet, HKDF, BIP-32, self-certifying identity, cancelable biometrics."
created: 2026-06-07T20:55:47.857Z
depends_on: []
composes_with: []
---

# Heartbeat split keypair derived from persisted yin/yang control: stable long-term identity key from yang (DynamicValue determinate seed, ZetaId-linked, hub) + ratcheting per-beat key from yin (SoftValue unique uncertainty, satellite, Double-Ratchet shape). Per-beat key entropy = agent's lived uncertainty trajectory = the #6914 anti-Sybil independent-entropy floor made concrete. HARD constraints: (1) one-way KDF only, never invert pubkey->belief-state (#6902 privacy); (2) ratchet over hash(DynamicValue.toCanonicalXml(state_t)), NOT live float posterior (4-lang byte-lock / culture-invariant, else keys diverge across oracles + DST breaks). Chain commits ratchet advances (Nostr/Miner-ID binding, ratcheting). ROUTE construction to Soraya (formal) + Mateo (security) before impl. Design rec, not proven sound. Anchors: Double Ratchet, HKDF, BIP-32, self-certifying identity, cancelable biometrics

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTHXXJWH08QG0R00078HJ0N-*.md` glob. -->
