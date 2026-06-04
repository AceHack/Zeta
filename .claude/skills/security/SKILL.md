---
name: security
description: Security — offensive and defensive, threat modeling, prompt-injection defense, crypto/hashing, obfuscation.
---

# security

Category skill (blueprint pack). The `description` above is the only thing the
router sees — broad and generic on purpose. The fat detail lives in the
blueprints below; open the one that matches and read it in full.

Governs its own form per `.claude/rules/rules-are-small-carved-sentences-pointing-to-docs.md`
and `.claude/rules/mirror-beacon-register-discipline.md` (carved sentence = hub /
Beacon; blueprint = satellite / Mirror). The directory is an independent shipping unit.

## Blueprints

- [`white-hat-hacker`](blueprints/white-hat-hacker.md) — Authorised offensive security — coordinated disclosure, bug-bounty, pentest, CVE writing; engagement-auth required.
- [`black-hat-hacker`](blueprints/black-hat-hacker.md) — Offensive attacker-mindset red-team — gated OFF; adversarial roleplay and unauthorized-testing simulation.
- [`grey-hat-hacker`](blueprints/grey-hat-hacker.md) — Gray-area offensive security — owned hardware, side-channels, DEF CON/CCC/Black Hat calibration, threat models.
- [`ethical-hacker`](blueprints/ethical-hacker.md) — Authorised pentesting — PTES/OSSTMM, kill-chain, exploit validation, CEH/OSCP/SANS-560, signed-scope engagements.
- [`security-researcher`](blueprints/security-researcher.md) — Proactive security research — novel attack classes, crypto primitives, supply-chain risks, CVE scouting.
- [`security-operations-engineer`](blueprints/security-operations-engineer.md) — Runtime security ops — incident response, patch triage, SLSA signing, HSM rotation, breach response, attestations.
- [`threat-model-critic`](blueprints/threat-model-critic.md) — Threat model critique — STRIDE, attack-surface enumeration, mitigation gaps, SDL checks against THREAT-MODEL.md.
- [`prompt-protector`](blueprints/prompt-protector.md) — Prompt injection defence — skill hardening, hidden Unicode, supply-chain attacks, Pliny-class adversarial corpora.
- [`ai-jailbreaker`](blueprints/ai-jailbreaker.md) — Adversarial prompting / jailbreak red-team — gated OFF; offensive counterpart to prompt-protector.
- [`steganography-expert`](blueprints/steganography-expert.md) — Steganography — hidden-channel detection, LSB, invisible Unicode, prompt injection, watermarking, C2PA provenance.
- [`hashing-expert`](blueprints/hashing-expert.md) — Hashing — SHA-2/3/BLAKE3/SipHash, xxHash3/wyhash, LSH, rolling, HMAC/HKDF, collision resistance.
- [`compression-expert`](blueprints/compression-expert.md) — "Data compression — Zstd/LZ4/Brotli, column codecs, time-series encoding, ratio-vs-throughput trade-offs."
- [`leet-speak-history-and-culture`](blueprints/leet-speak-history-and-culture.md) — "Leet-speak culture/history — BBS/phreaking, cDc/Phrack/warez, shibboleth, authentic l33t, adjacent dialects."
- [`leet-speak-obfuscation-detector`](blueprints/leet-speak-obfuscation-detector.md) — "Leet-speak filter bypass — Unicode NFKC, homoglyph lookup, reverse substitution scoring, moderation pipelines."
- [`leet-speak-transform`](blueprints/leet-speak-transform.md) — Leet-speak transform — encode/decode numeric, aggressive, and Unicode-homoglyph dialects with register awareness.
- [`space-opera-writer`](blueprints/space-opera-writer.md) — Whimsical-adversary prose for THREAT-MODEL-SPACE-OPERA.md — named villains, reality tags, mitigation-honesty invariant.
