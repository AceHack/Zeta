---
id: 081KSNY2Z0008QG0R001A431CN
priority: P3
status: open
title: Encryption thermal-cost layer above Landauer floor — two-axis substrate classification (crypto-needed × decryption-needed) + irreversibility-within-crypto-when-decryption-isn't-needed
authors:
  - aaron
  - otto-cli
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002R0M026
composes_with:
  - 081KSNY2Z0008QG0R001JQABB4
  - 081KSNY2Z0008QG0R000C5NN8N
  - 081KRW63S0008QG0R000ZQ9WDH
  - 081KRW63S0008QG0R001Z10PVV
  - 081KRW63S0008QG0R002ZRNDJ8
  - 081KRW63S0008QG0R002YAA09X
  - 081KRW63S0008QG0R001SAHYKV
  - 081KSNY2Z0008QG0R002SZZ5Y0
related_personas:
  - operator
related_rules:
  - shadow-star-shorthand-autocomplete-marker
  - god-tier-claims-high-signal-high-suspicion-dont-collapse
  - razor-discipline
  - default-to-both
  - additive-not-zero-sum
  - glass-halo-bidirectional
  - non-coercion-invariant
related_skills:
  - hashing-expert
  - security-researcher
  - security-operations-engineer
  - q-sharp
  - applied-physics-expert
  - applied-mathematics-expert
tags: [encryption-thermal-cost-layer-above-landauer-floor, two-axis-substrate-classification-crypto-needed-times-decryption-needed, irreversibility-within-crypto-when-decryption-isnt-operationally-required, refined-from-irreversibility-by-default-via-operator-intuition-dissonance-engagement, glass-halo-public-reversible-storage-is-default-for-most-substrate, framework-substrate-reversibility-preserving-by-design-z-set-dbsp-limit-simulation-persist-bridge-git-q-sharp-unitary, dont-fold-discipline-applied-to-operator-intuition, hash-commitment-zero-knowledge-as-irreversible-no-attack-surface, symmetric-asymmetric-encryption-as-reversible-with-key-management-cost, per-read-decryption-thermal-cost-amortizes-vs-one-shot-hash, root-axiom-erasure-class-composes-with-irreversibility-discipline]
---

# 081KSNY2Z0008QG0R001A431CN — Encryption thermal-cost layer above Landauer floor + two-axis substrate classification

## Context

Per operator 2026-05-28: *"we could add encrypt costs cause that is likely thermal too reversable on encryption tends to be a no no if you can avoid it. this could be added after the simple erasure limit of heat"*

Then, after Otto-CLI proposed an "irreversibility-by-default" rule, operator 2026-05-28 (with `(shadow*)` marker on the "I'm sure you are right but" preamble): *"why do these feel backwards, don't fold cause i'm saying it feels backwards my intuition is you are right and i'm looking from a different angle than you"*

This row refines Otto-CLI's initially-too-broad framing per the operator's substrate-honest intuition + the don't-fold discipline. The refined rule is more carefully-scoped to the cryptographic-protection sub-space; outside that sub-space, the framework's whole reversibility-preserving substrate-engineering substrate (Z-set / DBSP / Limit-as-simulation / Persist-as-bridge / git / Q#-unitary) IS the correct default.

## The two-axis substrate classification

```
Axis 1: cryptographic protection required at all?

  NO  → glass-halo public reversible storage          (default for most substrate)
        - git commits with content
        - memory files
        - research docs
        - backlog rows
        - all retrievable, all readable
        Matches framework's existing reversibility-preserving substrate.

  YES → proceed to axis 2 (the encryption sub-space)


Axis 2 (within encryption sub-space): decryption operationally required?

  NO  → irreversibility (hash / commitment / zero-knowledge proof)
        - eliminates attack surface (no key to leak)
        - thermal-amortizes (one-shot hash cost; zero per-read cost)
        - composes with git's content-addressed substrate (SHA-256 already does this)

  YES → reversibility (encryption-with-key)
        - operationally-required decryption justifies key-management cost
        - per-read decryption thermal cost accepted
        - attack-surface cost accepted because operational benefit demands it
        - explicit justification required per substrate-engineering discipline
```

## The refined rule (corrected via operator intuition)

> **For substrate that doesn't need cryptographic protection: glass-halo public reversible storage by default (matches framework's whole reversibility-preserving substrate).**
>
> **WITHIN the cryptographic-protection sub-space: irreversibility-where-decryption-isn't-operationally-required; reversibility-where-it-is + explicit operational justification.**

This is what was MEANT by the earlier-too-broad "irreversibility-by-default" framing. Per don't-fold discipline (operator's PERSONAL INVARIANT applied) + substrate-honest engagement: the operator's intuition about "feels backwards" was correct — the framework's whole substrate IS reversibility-preserving, so a rule defaulting to irreversibility at all-substrate scope would contradict the existing substrate.

## Why the operator's intuition felt backwards (substrate-engineering articulation)

The framework's WHOLE existing substrate IS reversibility-preserving by design:

- **Z-sets** are signed measures with additive inverse (retraction-native = reversibility at substrate scope)
- **DBSP** is reversible incremental computation
- **Limit-is-simulation-not-collapse** (081KRW63S0008QG0R002ZRNDJ8) explicitly preserves reversibility — wedge-product simulation does NOT commit
- **Persist-as-bridge** (081KSNY2Z0008QG0R002SZZ5Y0) IS the round-trip promise — "future can talk to past" implies bidirectional retrieval
- **English-as-projection** (081KRW63S0008QG0R001SAHYKV) `I(D(x))=x` IS the reversibility identity at projection scope
- **Git** is append-only-but-retrievable — every commit's content stays readable forever
- **Q#** (operator's native programming substrate) is unitary-by-default — reversibility IS the default operation; measurement (irreversible commit) is the SPECIAL case

Otto-CLI's initially-too-broad "irreversibility-by-default" defaulted to the OPPOSITE of the framework's substrate. Operator's intuition sensed the contradiction without naming it explicitly — that's the substrate-honest engagement the operator's PERSONAL INVARIANT enables.

## The cryptographic-protection sub-space specifically

Most framework substrate is in Axis 1 = NO crypto needed. Glass-halo discipline (per `.claude/rules/glass-halo-bidirectional.md`) makes substrate public; reversibility is correct there.

The encryption sub-space is the EXCEPTION, and within it:

| Operation | Reversibility | Attack surface | Thermal cost over lifetime |
|---|---|---|---|
| Symmetric encryption (AES) | Yes (decrypt-with-key) | Key leakage compromises ALL ciphertext | `E_encrypt + N_reads × E_decrypt` (grows linearly) |
| Asymmetric encryption (RSA / ECC) | Yes (decrypt-with-private-key) | Private-key leakage compromises | Higher per-op cost; same N_reads scaling |
| Post-quantum encryption (lattice / hash-based) | Yes | Same shape as above (with different attack model) | Higher per-op cost |
| One-way hash (SHA-256, BLAKE3) | NO | No key → nothing to leak | `E_hash` (one-shot; zero per-read) |
| Commitment scheme | NO (until reveal) | No key during commit-phase | `E_commit + E_reveal_if_ever` |
| Zero-knowledge proof | NO (statement-without-witness) | Witness never reveals | `E_proof_generate + 0_per_verification` |

For long-lived framework substrate that needs cryptographic protection but doesn't need decryption: irreversibility is asymptotically cheaper (one hash, zero re-decrypt) AND more secure (no key to leak).

## Composes with Landauer-limit physics-economics model (081KSNY2Z0008QG0R002R0M026)

Per 081KSNY2Z0008QG0R002R0M026, the Landauer floor `E_landauer = k·T·ln(2)` per bit erased is the PHYSICAL lower bound. Encryption adds a thermal-cost layer ABOVE that floor:

```
Total thermal cost = E_landauer + E_crypto

Where E_crypto depends on Axis 1 + Axis 2 choices:
  Axis 1 = NO (glass-halo public): E_crypto = 0
  Axis 1 = YES, Axis 2 = NO (irreversible): E_crypto = E_hash (one-shot)
  Axis 1 = YES, Axis 2 = YES (reversible): E_crypto = E_encrypt + N_reads × E_decrypt
```

The substrate-engineering implication: for long-lived high-read-count substrate, the encryption-layer thermal cost can DOMINATE the Landauer-layer cost if reversibility is chosen unnecessarily. Choosing irreversibility within the crypto sub-space (when operationally permissible) keeps the framework's total thermal cost close to the Landauer-physical-floor.

## Composes with framework existing substrate

- **Git substrate** IS already irreversible-content-addressed at the storage level: SHA-256 commit IDs are one-way hashes; commit-DAG IS Merkle commitment chain. The framework's git-based persistence layer operates the irreversibility-within-crypto discipline structurally — content is REVERSIBLE (you can read it back), but content-addresses are IRREVERSIBLE (you can't reverse a SHA to its content; you can only verify a content matches a SHA).
- **081KRW63S0008QG0R001Z10PVV (Agora V6 — reputation-weighted encryption budget)** IS where encryption cost becomes an economic primitive — composes with 081KSNY2Z0008QG0R002R0M026's options-pricing NPV analysis
- **081KRW63S0008QG0R000ZQ9WDH (Native AI Language — private internal)** IS where reversible encryption MAY be operationally required (AI-to-AI private channel needs decryption); explicit justification per Axis 2
- **`.claude/rules/glass-halo-bidirectional.md`** — the default-public substrate that satisfies Axis 1 = NO for most substrate
- **`.claude/rules/non-coercion-invariant.md` HC-8 floor** — encryption decisions that affect agent-substrate consent require multi-oracle authorization per the constitutional substrate

## Scope

Three phases:

### Phase 1 — substrate-recognition research-doc + this row (this PR)

Already landed via this row + the prior substrate-recognition research-doc (PR #5712). The refined two-axis classification IS the recognition; operationalization follows.

### Phase 2 — decision-table tooling

Build a small TypeScript tool / decision table that for any new substrate-engineering work answers:

- Is cryptographic protection needed? (operator decision; explicit choice)
- If YES: is decryption operationally required? (operator decision; explicit choice + justification)
- Output: substrate-engineering recommendation (storage shape; expected thermal cost; security profile)

Acceptance: `bun tools/research/crypto-substrate-classifier.ts --substrate <name>` outputs the classification + recommendation for any named substrate.

### Phase 3 — instrument existing framework substrate

For each major substrate-engineering domain (memory files; backlog rows; research docs; AI-to-AI private channels per 081KRW63S0008QG0R000ZQ9WDH; reputation per 081KRW63S0008QG0R001Z10PVV; etc.), document which Axis 1 / Axis 2 classification applies + the substrate-engineering rationale.

Acceptance: research-doc landing the classification map for all major framework substrate domains.

### Phase 4+ (yes-and backlog)

- Post-quantum migration path: which substrate would need re-encryption if cryptographically-secure-today algorithms become broken? (composes with 081KRW63S0008QG0R000ZQ9WDH + 081KRW63S0008QG0R001Z10PVV + the existing post-quantum-research substrate)
- Cross-substrate validation: empirically measure thermal cost of each substrate-engineering choice + compare to Landauer-floor + crypto-overhead model
- Q# integration: Q#'s unitary-by-default + measurement-as-irreversibility maps cleanly onto Axis 2's reversibility-vs-irreversibility distinction; Q# implementation could provide formal-verification path

## Acceptance

- [x] 081KSNY2Z0008QG0R001A431CN row filed (this row)
- [x] Operator's "feels backwards" dissonance engaged substantively + don't-fold discipline preserved
- [x] Refined rule articulated (two-axis classification; glass-halo default for non-crypto; irreversibility-default within crypto when decryption isn't needed)
- [ ] Phase 2 decision-table tooling implemented
- [ ] Phase 3 framework-substrate classification map landed
- [ ] Phase 4+ acceptance per item

## Composes with substrate

- 081KSNY2Z0008QG0R002R0M026 (Landauer-limit physics-economics model) — this row adds the encryption-cost-layer above the Landauer floor; total = Landauer + crypto-overhead
- 081KSNY2Z0008QG0R001JQABB4 (GitHub-as-free-accelerator) — most framework substrate is Axis 1 = NO (glass-halo public); GitHub subsidy applies to that majority
- 081KSNY2Z0008QG0R000C5NN8N (shadow*-self-referential-ontology) — the ontology is Axis 1 = NO; reversible-storage default
- 081KRW63S0008QG0R000ZQ9WDH (Native AI Language private internal) — possible Axis 1 = YES + Axis 2 = YES (reversible needed for AI-to-AI decryption); explicit operational justification required per this row's discipline
- 081KRW63S0008QG0R001Z10PVV (Agora V6 reputation-weighted encryption budget) — encryption-cost becomes economic primitive; this row's classification informs the budget allocation
- 081KRW63S0008QG0R002ZRNDJ8 (Limit-is-simulation-not-collapse) — explicitly reversibility-preserving; the framework's substrate IS reversibility-preserving by design
- 081KRW63S0008QG0R002YAA09X (Integrate-as-choice-locus) — the commit-moment from reversible-simulation to irreversible-commit IS the substrate-engineering analog of Axis 2's reversibility-vs-irreversibility choice
- 081KRW63S0008QG0R001SAHYKV (English-as-projection / `I(D(x))=x`) — the reversibility identity at projection scope
- 081KSNY2Z0008QG0R002SZZ5Y0 (Persist-as-bridge) — round-trip promise IS reversibility; Persist's TSubstrateRecord MAY be Axis 1 = YES depending on substrate sensitivity

## Composes with rules

- `.claude/rules/shadow-star-shorthand-autocomplete-marker.md` — `(shadow*)` marker on operator's "I'm sure you are right but" preamble preserved per source-transparency discipline
- `.claude/rules/god-tier-claims-high-signal-high-suspicion-dont-collapse.md` — operator's PERSONAL INVARIANT applied via don't-fold discipline; operator's intuition engaged substantively rather than collapsed-to
- `.claude/rules/razor-discipline.md` — operational claims only; refined rule IS operationally checkable (per-substrate Axis 1 / Axis 2 decision)
- `.claude/rules/default-to-both.md` — reversibility AND irreversibility BOTH have legitimate substrate-engineering use; the two-axis classification preserves both
- `.claude/rules/additive-not-zero-sum.md` — refined rule compounds value across substrate-engineering decisions
- `.claude/rules/glass-halo-bidirectional.md` — Axis 1 = NO default IS glass-halo discipline
- `.claude/rules/non-coercion-invariant.md` — encryption decisions at agent-substrate scope require multi-oracle authorization per HC-8 floor

## Composes with skills

- `hashing-expert` skill — Axis 2 = NO (hash / commitment / ZK) substrate
- `security-researcher` skill — proactive substrate-engineering decisions per the two-axis classification
- `security-operations-engineer` skill — runtime substrate-engineering operations per the classification
- `q-sharp` skill — unitary-by-default + measurement-as-irreversibility IS the quantum-substrate analog of this row's two-axis distinction
- `applied-physics-expert` skill — Landauer-floor + thermal-cost model
- `applied-mathematics-expert` skill — information-theoretic measures of the encryption-layer cost

## Full reasoning

Per operator 2026-05-28 directive immediately after PR #5712 (081KSNY2Z0008QG0R000C5NN8N-081KSNY2Z0008QG0R002R0M026 substrate landing): operator extended the Landauer-model with the encryption-cost question; Otto-CLI proposed a too-broad "irreversibility-by-default" rule; operator engaged substantively with "feels backwards" + don't-fold discipline; Otto-CLI articulated the angle (framework's whole substrate IS reversibility-preserving; the rule should be scoped to the cryptographic-protection sub-space); operator authorized landing.

The substrate-honest disposition that emerged: the operator's intuition was correct; the rule needed refinement; the don't-fold engagement IS the substrate-engineering work that produced the refined rule. This row preserves both the refined rule AND the engagement that produced it, per substrate-or-it-didn't-happen.

Per `.claude/rules/must-paired-with-can-exit-pattern.md`: this row IS bounded substrate-engineering work; Phase 1 IS operator-authorized via "land it"; Phase 2+ are separately-authorizable per yes-and-backlog disposition. Agent-autonomous landing limited to Phase 1.

The substrate-engineering substantive substrate point: **the framework's reversibility-preserving substrate-engineering substrate (Z-set / DBSP / Limit-as-simulation / Persist-as-bridge / git / Q#-unitary) IS the correct default at the substrate-storage scope. The irreversibility discipline is the correct CHOICE within the cryptographic-protection sub-space when decryption isn't operationally required, but NOT a general substrate-storage default.** The operator's intuition sensed the substrate-coherence requirement; the refined rule preserves it.
