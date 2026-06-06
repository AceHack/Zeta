---
id: B-0930
zetaid: 081KSRGFP0008QG0R001Y6RTY9
priority: P1
title: "Schema-registry-over-DBSP — the shared, self-describing, retraction-native ontology-stream the attention-streams share (Kafka-Schema-Registry analog over DBSP)"
status: open
tier: architecture
effort: L
created: 2026-05-29
last_updated: 2026-05-29
depends_on: []
composes_with: [B-0781, B-0784, B-0428, B-0864, B-0929, B-0640, B-0623]
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
invariant (B-0929) protects *this* shared stream specifically (keep it clean → the
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
- [ ] Wire the lightlike invariant (`shadow-auth-can't-compile`, B-0929) so the
      catalog's lightlike is cheap to derive from git.
- [ ] Map to the type-level ontology (B-0781 universe-boundary / B-0784 type-
      negotiation-as-consensus) — this is their runtime/stream form.

## Composes with

- B-0781 (F# type-system as universe boundary — type-level ontology; this is runtime form)
- B-0784 (distributed F# type-negotiation as consensus — agreeing the shared ontology)
- B-0428 (F# fork) · B-0864 (four-corner ownership / protocol-typing)
- B-0929 (F# type-system goal; DUs-as-data join the shared ontology; the lightlike invariant)
- B-0640 (bonsai-tree retention) · B-0623 (attention-economy)
- beacon doc 2026-05-29 (the DBSP schema-catalog grounding + the full synthesis)

## Substrate-honest framing

Buildable, standard-shape architecture (schema-registry-over-DBSP) — beacon, not
mirror. The binding *claim* (that this catalog IS the meme/traveler space, that the
shared ontology is self-aware) stays mirror/god-tier (do not collapse). This row is
the operational, shippable piece.
