/**
 * Codec for FrontmatterEvent <-> markdown file (the git event-store records).
 *
 * An event file lives at events/<table>/<ZetaIdDecimal>.md. Its frontmatter
 * carries the event metadata under reserved `$`-prefixed keys (so they cannot
 * collide with field/column names) plus the upsert field values flat alongside.
 * Reuses the row codec's parser/serializer so quoting/round-trip rules are
 * identical (numbers, booleans, arrays, number-looking strings).
 */

import {
  parseFrontmatterDocument,
  serializeFrontmatterDocument,
} from "./frontmatter-codec.ts";
import {
  EventOp,
  asZetaIdDecimal,
  type FrontmatterEvent,
} from "./event.ts";
import type { FrontmatterValue } from "./schema.ts";

const Reserved = {
  Id: "$id",
  Table: "$table",
  AggregateId: "$aggregate_id",
  Op: "$op",
  SchemaVersion: "$schema_version",
} as const;

const RESERVED_KEYS: ReadonlySet<string> = new Set(Object.values(Reserved));

export const EventCodecFeedbackReason = {
  ParseFailed: "parse_failed",
  MissingReserved: "missing_reserved",
  BadOp: "bad_op",
  BadId: "bad_id",
} as const;

export type EventCodecFeedbackReason =
  (typeof EventCodecFeedbackReason)[keyof typeof EventCodecFeedbackReason];

export type EventParseResult =
  | { outcome: "ok"; event: FrontmatterEvent }
  | { outcome: "feedback"; feedback: { reason: EventCodecFeedbackReason; message: string } };

const VALID_OPS: ReadonlySet<string> = new Set(Object.values(EventOp));

export function serializeEvent(event: FrontmatterEvent): string {
  const frontmatter: Record<string, FrontmatterValue> = {};
  frontmatter[Reserved.Id] = event.id;
  frontmatter[Reserved.Table] = event.table;
  frontmatter[Reserved.AggregateId] = event.aggregateId;
  frontmatter[Reserved.Op] = event.op;
  frontmatter[Reserved.SchemaVersion] = event.schemaVersion;
  for (const [key, value] of Object.entries(event.fields)) {
    // The `$`-prefix is the reserved metadata namespace. A field key inside it
    // would overwrite event metadata and round-trip as a spoofed event, so
    // reject it as a programmer error (parseEvent already filters these out on
    // read — this keeps write symmetric with read).
    if (key.startsWith("$")) {
      throw new Error(`serializeEvent: field key '${key}' is in the reserved '$' namespace`);
    }
    frontmatter[key] = value;
  }
  return serializeFrontmatterDocument({ frontmatter, body: "" });
}

export function parseEvent(text: string): EventParseResult {
  const parsed = parseFrontmatterDocument(text);
  if (parsed.outcome === "feedback") {
    return { outcome: "feedback", feedback: { reason: EventCodecFeedbackReason.ParseFailed, message: parsed.feedback.message } };
  }

  const fm = parsed.document.frontmatter;
  const idRaw = fm[Reserved.Id];
  const tableRaw = fm[Reserved.Table];
  const aggRaw = fm[Reserved.AggregateId];
  const opRaw = fm[Reserved.Op];
  const versionRaw = fm[Reserved.SchemaVersion];

  if (typeof idRaw !== "string" || typeof tableRaw !== "string" || typeof aggRaw !== "string" || typeof opRaw !== "string") {
    return { outcome: "feedback", feedback: { reason: EventCodecFeedbackReason.MissingReserved, message: "event is missing one or more reserved metadata keys" } };
  }
  if (!VALID_OPS.has(opRaw)) {
    return { outcome: "feedback", feedback: { reason: EventCodecFeedbackReason.BadOp, message: `event op '${opRaw}' is not a known EventOp` } };
  }
  if (!/^[0-9]+$/.test(idRaw) || !/^[0-9]+$/.test(aggRaw)) {
    return { outcome: "feedback", feedback: { reason: EventCodecFeedbackReason.BadId, message: "event id and aggregate id must be base-10 ZetaIds" } };
  }

  const schemaVersion = typeof versionRaw === "number" ? versionRaw : 1;

  const fields: Record<string, FrontmatterValue> = {};
  for (const [key, value] of Object.entries(fm)) {
    if (!RESERVED_KEYS.has(key)) {
      fields[key] = value;
    }
  }

  return {
    outcome: "ok",
    event: {
      id: asZetaIdDecimal(idRaw),
      table: tableRaw,
      aggregateId: asZetaIdDecimal(aggRaw),
      op: opRaw as FrontmatterEvent["op"],
      schemaVersion,
      fields,
    },
  };
}
