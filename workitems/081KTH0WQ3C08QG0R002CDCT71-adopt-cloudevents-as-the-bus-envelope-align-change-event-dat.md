---
id: 081KTH0WQ3C08QG0R002CDCT71
type: task
state: backlog
priority: P2
slug: adopt-cloudevents-as-the-bus-envelope-align-change-event-dat
title: "Adopt CloudEvents as the bus envelope + align change-event data with Debezium CDC (before/after/op = Z-set delta)"
created: 2026-06-07T12:28:30.700Z
depends_on: []
composes_with: ["081KSRGFP0008QG0R001Y6RTY9", "081KSXN940008QG0R00171YAZW"]
---

# Adopt CloudEvents as the bus envelope + align change-event data with Debezium CDC (before/after/op = Z-set delta)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH0WQ3C08QG0R002CDCT71-*.md` glob. -->

## Purpose

Adopt two established standards instead of bespoke envelopes (Aaron 2026-06-07; Beacon discipline). Full
analysis: `docs/research/2026-06-07-cloudevents-bus-envelope-and-debezium-cdc-as-zset-delta-anchor-aaron.md`.

## Two adoptions

1. **CloudEvents (CNCF v1.0) as the bus envelope.** Wear `id`/`source`/`specversion`/`type` (+ `time`,
   `subject`, `datacontenttype`, `dataschema`, extension attributes, `data`) over the agent-bus + Log/Delta
   streams. Map ZetaId->id/source; change kind->type; canonical CBOR/JSON->data; schema version->dataschema;
   extra fields->extension attributes. Bindings (Kafka/HTTP/NATS/AMQP/MQTT), JSON/Avro/Protobuf formats.
2. **Align change-event `data` with the Debezium CDC envelope** (`before/after/op/source/ts_ms`) — which
   IS a DBSP Z-set delta (c=+after, d=-before, u=-before+after, r=+snapshot). Our DeltaLog/ZSet deltas
   already are this; name the anchor + consider Debezium-format ingest/emit interop. Debezium pairs with the
   Kafka Schema Registry = SchemaEvolution/081KSRGFP0008QG0R001Y6RTY9 over DBSP. Debezium already emits CloudEvents
   (CloudEventsConverter) -> precedent: a Z-set delta (Debezium-shaped) as the CloudEvents `data`.

## Acceptance

A CloudEvents envelope type over the bus (with the ZetaId/extension mapping), round-trippable via the
canonical codecs; change-event data documented as the Debezium before/after/op shape ≅ Z-set delta;
both anchored in the Beacon register / PRIOR-ART-LIST. Standards adoption — no new coinage.

## Anchors

- CloudEvents (CNCF) · Debezium/CDC (Red Hat) · Kafka Schema Registry · DBSP (Z-set delta) ·
  src/Core/DeltaLog.fs + ZSet · SchemaEvolution + 081KSRGFP0008QG0R001Y6RTY9 · agent-bus 081KSXN940008QG0R00171YAZW · docs/PRIOR-ART-LIST.md.
