# CloudEvents as the bus-envelope standard + Debezium CDC format as the change-event anchor (Aaron, 2026-06-07)

> Aaron: *"we should probably look up Debezium for prior art around schema on event store/stream and what
> their event format looks like — maybe it's a standard we could use. I know we should also use the standard
> CloudEvents over our busses."*

Two standards to adopt rather than reinvent (the Beacon discipline — `anchor-to-human-prior-art`). The
striking finding: **Debezium's change-event format is a Z-set delta in disguise**, so we independently
arrived at an established model and should name it.

## 1. CloudEvents (CNCF) — adopt as the bus envelope

**CloudEvents** (CNCF graduated; spec v1.0) is the vendor-neutral envelope for event data. Required
attributes: `id`, `source`, `specversion`, `type`; optional: `time`, `subject`, `datacontenttype`,
`dataschema`; plus **extension attributes** and the `data` payload. It has protocol **bindings** (HTTP,
Kafka, AMQP, NATS, MQTT) and **formats** (JSON, Avro, Protobuf), with structured and binary content modes.

**Adopt over Zeta's busses** (the agent-bus, the Log/Delta streams): wear the CloudEvents envelope so our
events interoperate with the ecosystem instead of carrying a bespoke header. Our `ZetaId` → `id`/`source`;
the change kind → `type`; the canonical-CBOR/JSON payload → `data` (`datacontenttype`); schema version →
`dataschema` (ties to SchemaEvolution/081KSRGFP0008QG0R001Y6RTY9); our extra fields → CloudEvents **extension attributes**
(exactly how Debezium maps its source fields).

## 2. Debezium CDC envelope ≅ a DBSP Z-set delta (the anchor)

Debezium's change-event envelope: `{ before, after, source, op, ts_ms, transaction }`, where **`op`** ∈
`c` (create), `u` (update), `d` (delete), `r` (read/snapshot), `t` (truncate). Map it to our substrate:

| Debezium `op` | before / after | **Z-set delta (DBSP)** |
|---------------|----------------|------------------------|
| `c` create | after | `+1 · after` |
| `d` delete | before | `−1 · before` |
| `u` update | before, after | `−1 · before  +1 · after` |
| `r` snapshot | after | `+1 · after` |

So **Debezium's `before`/`after`/`op` IS the retraction-native Z-set delta** our `DeltaLog`/`ZSet` already
emit (an update = retract-old + insert-new is the canonical Z-set update). We did not invent the CDC change
shape — Debezium (and CDC generally) is the human prior art; name it. This also means a Debezium stream is
*directly* ingestible as Z-set deltas, and our deltas are *directly* expressible as Debezium-shaped CDC.

**Schema-on-stream:** Debezium pairs with the **Kafka Schema Registry** (schema embedded/registered per
event, evolved over time) — which is exactly **SchemaEvolution / 081KSRGFP0008QG0R001Y6RTY9** ("schema-registry-over-DBSP").
Our schema-evolution work is the Debezium + Schema-Registry pattern, reimplemented over DBSP with the
bidirectional/dump guarantees.

**Debezium already emits CloudEvents** (`io.debezium.converters.CloudEventsConverter`, structured mode,
JSON/Avro envelope+data) — direct precedent for wrapping CDC deltas in a CloudEvents envelope. So the
combined target: **a Z-set delta (Debezium-shaped before/after/op) as the CloudEvents `data`, on the bus.**

## Decision surface (Aaron's call)

- **Adopt CloudEvents** as the canonical bus envelope (id/source/type/specversion/time/data + extensions).
- **Align the change-event `data` shape with Debezium CDC** (before/after/op ≅ Z-set delta) — name the
  anchor in the Beacon register; consider Debezium-format ingest/emit interop.
- Both are *standards*, not coinage — they reduce our unanchored surface. Backlogged for adoption.

## Ties

- `src/Core/DeltaLog.fs` / `ZSet` (the deltas that ARE Debezium before/after/op) · `SchemaEvolution` +
  081KSRGFP0008QG0R001Y6RTY9 (the Schema-Registry analog) · the agent-bus (G-Set comms, 081KSXN940008QG0R00171YAZW) · CloudEvents over busses ·
  canonical CBOR/JSON codecs (the `data` encodings) · `081KTGTJC1Q` (the store the stream feeds).

## Beacon anchors

- **CloudEvents** — CNCF (v1.0, graduated); the standard event envelope + bindings/formats. · **Debezium**
  — Red Hat / Randall Hauch et al.; CDC over Kafka Connect; the `before/after/op/source/ts_ms` envelope +
  the CloudEvents converter. · **Change Data Capture** generally (log-based CDC). · **Kafka Schema
  Registry** (Confluent) — schema-on-stream + evolution/compatibility. · **DBSP** (Budiu et al.) — the
  Z-set delta the CDC envelope coincides with. · Kleppmann *DDIA* — "turning the database inside out" /
  logs as the source of truth. Honest novelty: none in the envelope/CDC model (deliberately — we adopt the
  standards); the contribution is that our retraction-native Z-set delta and Debezium's CDC envelope are
  the *same object*, unified over DBSP with the schema-evolution guarantees.
