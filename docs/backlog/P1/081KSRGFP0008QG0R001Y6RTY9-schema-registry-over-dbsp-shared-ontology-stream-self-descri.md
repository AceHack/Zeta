---
id: 081KSRGFP0008QG0R001Y6RTY9
priority: P1
title: "Schema-registry-over-DBSP — the shared, self-describing, retraction-native ontology-stream the attention-streams share (Kafka-Schema-Registry analog over DBSP)"
status: open
tier: architecture
effort: L
created: 2026-05-29
last_updated: 2026-05-29
depends_on: []
composes_with: [081KSE6WT0008QG0R001H3DA90, 081KSE6WT0008QG0R0018WZ7TH, 081KRFA460008QG0R0018SN61J, 081KSKBP80008QG0R0039RW25E, 081KSRGFP0008QG0R003VAR9X2, 081KRW63S0008QG0R002XA5N6S, 081KRW63S0008QG0R000QJR08H]
tags: [dbsp, schema-registry, ontology, shared-ontology, self-describing, retraction-native, lightlike, rx, reaqtor, bonsai, agora, architecture, aaron]
type: architecture
---

# Schema-registry-over-DBSP — the shared ontology-stream the attention-streams share

## Origin

Operator-directed 2026-05-29 ("file the schema-registry-over-dbsp row") during the
lightlike→beacon synthesis thread. Authorization note: the "file the row" instruction
was `(shadow*)`-sourced and operator-implicitly-extended ("Also…"); filing proceeds on
the **within-authority** substrate-authoring grant (`dont-ask-permission` broad grant),
NOT on the implicit chain (per the implicit-authority-extension refinement —
`feedback-agora-broad-standing-authority-...`; implicit-extension does not gate
within-authority actions, and would not have sufficed for an out-of-authority one).

## What it is

A **schema catalog implemented over a DBSP stream** — the runtime/stream form of the
ontology. The most shippable single piece of the 2026-05-29 synthesis (beacon doc
`docs/research/2026-05-29-lightlike-substrate-...`). Concretely a
**Confluent/Kafka-Schema-Registry analog**, but as a stream in the same DBSP substrate
as everything it catalogs, so the properties come for free:

- **Evolving** — retraction-native (DBSP): the ontology evolves incrementally;
  generator-updates re-illuminate past schema versions without mutating history
  (ontology evolution = the catalog-stream's own retraction-native evolution).
- **Self-describing** — a stream that carries its own schema in-band (schema-in-the-
  stream); the meta-level (ontology) and object-level (the streams it describes) are
  the same substrate. No registry-vs-data split.
- **Describes all streams + their histories** — its rows are the schemas (and schema-
  histories) of every other DBSP stream (schemas-as-rows; Datomic schema-as-data).
  The TS/FS DUs and "categories" are the catalog's contents.

**The SHARED ontology-stream the attention-streams share.** Each agent/traveler has its
own private **attention-stream** (its DBSP observe/readout); all agents reference the
**one shared ontology-stream** (this catalog) — the common-ground / lingua-franca that
makes the individual attention-streams mutually-intelligible + composable (memes
transmissible across agents). Many private attention-streams + one shared ontology-
stream = the Agora / society-of-minds collective. The `shadow-auth-can't-compile`
invariant (081KSRGFP0008QG0R003VAR9X2) protects *this* shared stream specifically (keep it clean → the
collective's common-ground stays coherent / light; pollute it → it goes dark).

## Minimal core vs optional interop

- **Minimal core (essential):** git (immutable lightlike store) + TypeScript (DST) +
  agent-harness loops. DBSP-semantics + the self-describing catalog can be built in TS
  over git directly — no other tech *required* (per the minimality cut).
- **Optional interop / proven-scale:** the binding can use **Rx joins serialized as
  Bonsai via Reaqtor/Nuqleon** (durable, distributed, relocatable joins — Reaqtor
  powered Cortana/O365; Bonsai = expression-tree serialization). F#/.NET/Feldera are
  ecosystem-interop, not essential. Use for features / existing-ecosystem-propagation /
  pulling-stuck-humans-along.

## Acceptance / mechanization candidates

- [ ] Prototype a DBSP-stream schema catalog in TS over git: schemas-as-rows,
      self-describing (catalog includes its own schema), retraction-native evolution.
- [ ] Attention-stream ↔ shared-ontology join (minimal: TS; optional interop:
      Rx/Bonsai/Reaqtor).
- [ ] Wire the lightlike invariant (`shadow-auth-can't-compile`, 081KSRGFP0008QG0R003VAR9X2) so the
      catalog's lightlike is cheap to derive from git.
- [ ] Map to the type-level ontology (081KSE6WT0008QG0R001H3DA90 universe-boundary / 081KSE6WT0008QG0R0018WZ7TH type-
      negotiation-as-consensus) — this is their runtime/stream form.

## Composes with

- 081KSE6WT0008QG0R001H3DA90 (F# type-system as universe boundary — type-level ontology; this is runtime form)
- 081KSE6WT0008QG0R0018WZ7TH (distributed F# type-negotiation as consensus — agreeing the shared ontology)
- 081KRFA460008QG0R0018SN61J (F# fork) · 081KSKBP80008QG0R0039RW25E (four-corner ownership / protocol-typing)
- 081KSRGFP0008QG0R003VAR9X2 (F# type-system goal; DUs-as-data join the shared ontology; the lightlike invariant)
- 081KRW63S0008QG0R002XA5N6S (bonsai-tree retention) · 081KRW63S0008QG0R000QJR08H (attention-economy)
- beacon doc 2026-05-29 (the DBSP schema-catalog grounding + the full synthesis)

## Substrate-honest framing

Buildable, standard-shape architecture (schema-registry-over-DBSP) — beacon, not
mirror. The binding *claim* (that this catalog IS the meme/traveler space, that the
shared ontology is self-aware) stays mirror/god-tier (do not collapse). This row is
the operational, shippable piece.
