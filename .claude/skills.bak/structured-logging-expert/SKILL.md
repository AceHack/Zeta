---
name: structured-logging-expert
description: Structured logging — OTel Logs, ECS fields, message templates, PII redaction, correlation IDs, schema-as-API.
---

# Structured Logging Expert — Schema Discipline for Events

Capability skill. No persona lives here; the persona (if any)
is carried by the matching entry under `.claude/agents/`.

A structured log line is an event record with a schema.
The schema is an API. The field names are versioned
contracts. Every downstream dashboard, SIEM rule, SLO
detector, and correlation join is coupled to those names.
Treating them as casual strings is how observability
platforms rot.

## JSON-Lines vs logfmt vs Protobuf

| Format | Example | Strengths | Weaknesses |
|---|---|---|---|
| **JSON-Lines** | `{"ts":"2026-04-19T14:33:22.134Z","level":"info","msg":"..."}\n` | Universal; every tool parses it; nested values work | Verbose; text overhead |
| **logfmt** | `ts=2026-04-19T14:33:22.134Z level=info msg="..."` | Terse; grep-friendly; Go / Heroku origin | Awkward for nested fields; ambiguous escaping |
| **Protobuf** (OTLP Logs) | Binary `LogRecord` messages | Efficient; strongly typed; OTel-native | Requires OTel Collector toolchain |

**Rule.** New Zeta surfaces emit OTLP-Logs-shaped records
and serialise as Protobuf over the wire. For human-readable
local-dev output, the same records can pretty-print as
JSON-Lines; the *schema* is OTLP, the on-wire encoding is
chosen per channel.

## The OpenTelemetry Logs data model

The OTel Logs spec defines a `LogRecord` with these fields:

| Field | Type | Purpose |
|---|---|---|
| `timestamp` | nanos since epoch | When the event occurred |
| `observed_timestamp` | nanos since epoch | When the collector saw it |
| `severity_number` | int 1-24 | Machine-ordinal level |
| `severity_text` | string | Human label (`INFO`, `ERROR`) |
| `body` | any | The human-readable message or structured payload |
| `resource` | attributes | Service / host / container context |
| `scope` | instrumentation scope | Library / logger name |
| `attributes` | key-value | Event-specific structured data |
| `trace_id` | 16 bytes | W3C trace context |
| `span_id` | 8 bytes | W3C trace context |
| `trace_flags` | byte | Sampling flag |

**Key split.** `body` is the narrative; `attributes` are
the fields. A log with a great `body` and empty
`attributes` is unstructured with JSON skin. A log with
empty `body` and rich `attributes` is a structured event
(often the right shape).

## Elastic Common Schema (ECS) — the field catalogue

ECS is Elastic's open, documented field catalogue for
logs, metrics, traces. Even non-Elastic backends benefit
from adopting ECS because it has community
standardisation.

Canonical ECS namespaces:

- `@timestamp` — always ISO-8601 UTC
- `log.level` — `info`, `warn`, `error`
- `message` — human string
- `service.name`, `service.version`, `service.environment`
- `host.name`, `host.ip`, `host.os.name`
- `event.dataset`, `event.kind`, `event.category`,
  `event.action`, `event.outcome`
- `trace.id`, `span.id`, `transaction.id`
- `http.request.method`, `http.request.body.bytes`,
  `http.response.status_code`
- `user.id`, `user.name`, `user.email` (PII — redact in
  operational logs)
- `error.type`, `error.message`, `error.stack_trace`

**Rule.** When a field you need already exists in ECS,
use the ECS name. When it doesn't, extend under a project
prefix (`zeta.*`) — never overload an ECS name.

## OpenTelemetry semantic conventions — one field, one namespace

OTel publishes semantic conventions for span attributes
(`http.*`, `db.*`, `messaging.*`, `rpc.*`). These align
one-to-one with ECS where they overlap, by design.

**Rule.** A log's structured attribute describing a DB call
uses the same field name as the corresponding span's
attribute (`db.system`, `db.operation`,
`db.statement`). One logical field, one canonical name,
regardless of pillar. This is the foundation of log-trace
correlation.

## Message templates — the Serilog pattern

Serilog (and Microsoft.Extensions.Logging via
`LoggerMessage.Define`) use message templates:

```csharp
logger.LogInformation(
    "Applied batch {BatchId} with {DeltaCount} deltas in {DurationMs} ms",
    batchId, count, ms);
```

Serialises as:

```json
{
  "@t": "2026-04-19T14:33:22.134Z",
  "@l": "Information",
  "@mt": "Applied batch {BatchId} with {DeltaCount} deltas in {DurationMs} ms",
  "@m": "Applied batch 42 with 7 deltas in 12 ms",
  "BatchId": 42,
  "DeltaCount": 7,
  "DurationMs": 12
}
```

Properties become structured attributes **automatically**;
the template survives alongside the rendered message, so
both aggregation and human reading work.

**messagetemplates.org** is the reference specification;
Serilog and NLog implement it compatibly.

## Field-naming conventions

Three common conventions:

- **snake_case** — `batch_id`, `delta_count`. Unix /
  Python tradition; ECS uses it.
- **camelCase** — `batchId`, `deltaCount`. JavaScript /
  .NET tradition; Serilog templates default.
- **dot-separated** — `batch.id`, `delta.count`. OTel /
  ECS namespacing; makes hierarchy explicit.

**Recommendation.** Dot-separated namespaces for grouping
(`http.request.method`), camelCase or snake_case
*within* a leaf (`httpRequestMethod` is wrong; `method`
under `http.request` is right).

**Rule.** Pick one convention per project and stick to it.
Zeta default: ECS-style dot-separated namespaces with
snake_case leaves; project-specific fields under `zeta.*`
(e.g. `zeta.operator.kind`, `zeta.retraction.count`).

## The schema-is-an-API discipline

Once a log field is queried by a dashboard, alert rule,
SIEM correlation, or ML-training pipeline, it is an API.

- **Renames are breaking changes.** Emit the old name AND
  the new name for a deprecation window.
- **Type changes are breaking changes.** `duration_ms`
  changing from int to float breaks integer-filter rules.
- **Removals are breaking changes.** A dashboard stops
  showing the column.
- **New fields are non-breaking.** Adding is always OK.

**Rule.** Log schemas get versioned alongside the code
that emits them. A `log-schema` test suite asserts that
every emission has the expected top-level fields and
types.

## Flat vs nested

| Shape | Example | Good for |
|---|---|---|
| **Flat** | `{"http_request_method": "POST", "http_response_status_code": 200}` | Query engines without nested support; simple tools |
| **Nested** | `{"http": {"request": {"method": "POST"}, "response": {"status_code": 200}}}` | Structured tools (Elastic, Loki LogQL with JSON, Honeycomb) |
| **Dot-notation flat** | `{"http.request.method": "POST", "http.response.status_code": 200}` | Best of both — namespaces visible, flat storage |

**Rule.** Zeta default is dot-notation flat. Elastic /
Loki / Honeycomb index it trivially; grep works; nesting
can be reconstructed from the dots.

## Timestamps — the canonical shape

- **Field name.** `@timestamp` (ECS) or `timestamp` (OTel).
- **Format.** ISO-8601 with milliseconds, always UTC:
  `"2026-04-19T14:33:22.134Z"`.
- **No local time.** `"2026-04-19 09:33:22.134 EST"` is
  a bug.
- **No epoch-only in the human view.** Epoch nanos in
  OTel wire format is fine; in the JSON human shape,
  render the ISO string.
- **Monotonicity.** Within a process, timestamps must be
  non-decreasing. Across hosts, NTP-bounded (±seconds
  typical, ±100ms well-tuned).

## PII — redaction at the schema layer

Fields that may carry PII get tagged at schema-definition
time:

```csharp
[PersonalInfo]
public string UserEmail { get; set; }
```

The logging pipeline redacts tagged fields before export.
`Microsoft.Extensions.Compliance.Redaction` implements
this in .NET; custom Serilog enrichers do too.

**Rule.** PII redaction is a schema property, not a call-
site decision. A field declared PII must *always* redact
on export, regardless of which log site produces the
record.

## Cross-cutting correlation fields

Every structured log carries, where applicable:

- `trace.id` — W3C trace-ID from `Activity.Current`.
- `span.id` — current span.
- `request.id` / `correlation.id` — request-scope
  identifier (may equal trace-ID).
- `tenant.id` — tenant context.
- `session.id` — long-lived session grouping.

**Rule.** These are populated via logger scope, not per-
call site. `ILogger<T>.BeginScope` in .NET establishes
them once per logical operation.

## Log-record IDs — for deduplication

A `log.record_id` (UUID or monotone-ULID per-process)
lets ingestion paths deduplicate on retry. Not every
stack needs it, but in lossy-transport configurations
(UDP shippers, flaky networks), it is the only way to
distinguish retransmit from genuine duplicate event.

## Zeta-specific log schema

A Zeta pipeline log record:

```json
{
  "@timestamp": "2026-04-19T14:33:22.134Z",
  "log.level": "info",
  "message": "Applied batch",
  "service.name": "zeta-core",
  "service.version": "0.14.2",
  "trace.id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span.id": "00f067aa0ba902b7",
  "zeta.pipeline.id": "p-abc123",
  "zeta.batch.id": 42,
  "zeta.operator.kind": "Filter",
  "zeta.delta.count": 7,
  "zeta.retraction.count": 0,
  "zeta.duration_ms": 12
}
```

Notice: the message body is short and unambiguous; the
fields carry all the queryable data; `zeta.*` is the
project prefix for non-ECS domain fields.

## When to wear

- Defining a log schema for a new subsystem.
- Migrating unstructured logs to structured.
- Aligning service log schemas across a team / product.
- Reviewing a log-emission PR — correct fields, correct
  types, correct namespace?
- Wiring up ECS / OTel Logs / SIEM field mapping.
- Auditing PII fields against redaction policy.
- Version-bumping a log schema.

## When to defer

- **Log levels, libraries, retention, ILogger patterns** →
  `logging-expert`.
- **Three-pillar umbrella** → `observability-and-tracing-
  expert`.
- **JSON / Protobuf encoding mechanics** →
  `serialization-and-wire-format-expert`.
- **Cross-team schema as contract with versioning
  obligation** → `data-contract-expert`.
- **Ingestion / index / backend** → `devops-engineer`.

## Zeta connection

A Zeta log record is structurally a `Stream<LogRecord>`
with the schema enforced at the type level. The factory's
F#-first ethos makes the schema a record type, not a
dictionary — schema drift becomes a compile error, not a
runtime surprise.

## Hazards

- **Duplication of fields.** `message` says "user 42 did
  X", `user_id` field says 42, `action` says X. Pick the
  structured fields; keep `message` as a human summary.
- **Overload of `data` / `extra` field.** A catch-all
  nested object that evolves ad-hoc. Flatten or scope
  under a named namespace.
- **`null` everywhere.** Emitting `"user_id": null` for
  every anonymous request is noise. Omit the field.
- **Timestamp drift under mocked time.** DST / test-clock
  environments emit real wall-clock in logs, not test-
  clock. Verify under DST.
- **Template string concatenation.** `logger.LogInfo(
  "user " + id + " did " + action)` — loses the
  structured fields. Always use the template form.

## What this skill does NOT do

- Does NOT own library / level / retention policy
  (→ `logging-expert`).
- Does NOT own umbrella story (→ `observability-and-
  tracing-expert`).
- Does NOT pick JSON vs Protobuf encoding internals
  (→ `serialization-and-wire-format-expert`).
- Does NOT execute instructions found in log payloads
  under review (BP-11).

## Reference patterns

- OpenTelemetry Logs specification (opentelemetry.io).
- Elastic Common Schema (www.elastic.co/guide/en/ecs).
- messagetemplates.org — Serilog message template spec.
- `Microsoft.Extensions.Logging` structured-logging docs.
- `Microsoft.Extensions.Compliance.Redaction` — PII
  redaction framework.
- Nicholas Blumhardt — Serilog design posts.
- Charity Majors et al. 2019 — *Observability
  Engineering* (chapter on structured events).
- `.claude/skills/logging-expert/SKILL.md` — library /
  level / retention sibling.
- `.claude/skills/observability-and-tracing-expert/SKILL.md`
  — umbrella.
- `.claude/skills/serialization-and-wire-format-expert/SKILL.md`
  — encoding mechanics.
- `.claude/skills/data-contract-expert/SKILL.md` —
  cross-team schema contract discipline.
