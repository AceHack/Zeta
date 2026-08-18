import type {
  ControllerCell,
  RoomRunTranscript,
  RoomTranscriptTick,
  SLane,
  TranscriptContinuationReadout,
  TranscriptTravelerFrame,
} from "../darkhall-ui/darkhall-room";
import type { HeatRow } from "../darkhall-ui/heat";
import type { PhaseClockReadout } from "../darkhall-ui/darkhall-tv";

export const BROWSER_ROOM_CHECKPOINT_SCHEMA = "zeta.browser-room-checkpoint.v1" as const;
export const MAX_BROWSER_ROOM_CHECKPOINT_BYTES = 256 * 1024;

const MAX_COLLECTION_ITEMS = 4096;
const MAX_JSON_DEPTH = 32;
const MAX_JSON_VALUES = 20_000;
const ROOM_SCHEMA = "zeta.darkhall.room-ui.v1";

const durableFields = new Set([
  "schema",
  "roomName",
  "seed",
  "controller",
  "ticks",
  "heatRows",
  "travelerFrame",
  "phaseClock",
  "continuationReadout",
  "sLanes",
  "generatedBy",
]);

const nonDurableFields = new Set([
  "browserTabReadout",
  "browserTransportReadout",
  "databaseReadout",
  "causalReadout",
  "causalHandoffReadout",
  "heatReadout",
  "temperatureReadout",
  "blackBodyReadout",
  "temperatureTreaty",
]);

export type DurableRoomRunTranscript = Omit<
  RoomRunTranscript,
  | "browserTabReadout"
  | "browserTransportReadout"
  | "databaseReadout"
  | "causalReadout"
  | "causalHandoffReadout"
  | "heatReadout"
  | "temperatureReadout"
  | "blackBodyReadout"
  | "temperatureTreaty"
>;

export interface BrowserRoomCheckpointFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "room-checkpoint-state-invalid"
    | "room-checkpoint-non-durable-state"
    | "room-checkpoint-too-large"
    | "room-checkpoint-encode-failed"
    | "room-checkpoint-decode-failed"
    | "room-checkpoint-schema-unsupported"
    | "room-checkpoint-non-canonical";
  readonly detail: string;
}

export type BrowserRoomCheckpointResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserRoomCheckpointFeedback };

interface BrowserRoomCheckpointEnvelope {
  readonly schema: typeof BROWSER_ROOM_CHECKPOINT_SCHEMA;
  readonly transcript: DurableRoomRunTranscript;
}

type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function succeeded<T>(value: T): BrowserRoomCheckpointResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserRoomCheckpointFeedback["code"],
  detail: string,
  severity: BrowserRoomCheckpointFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: BrowserRoomCheckpointFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length <= MAX_COLLECTION_ITEMS && value.every(isString);
}

function isControllerCell(value: unknown): value is ControllerCell {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeInteger(value.cell) &&
    value.cell < 16 &&
    isString(value.label) &&
    isOptionalString(value.actionId) &&
    isOptionalString(value.actionClass) &&
    isOptionalString(value.gate) &&
    isOptionalBoolean(value.selected) &&
    isOptionalBoolean(value.enabled)
  );
}

function isHeatRow(value: unknown): value is HeatRow {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeInteger(value.tick) &&
    isString(value.roomName) &&
    isNonNegativeInteger(value.heatRejected) &&
    isNonNegativeInteger(value.backpressured) &&
    isNonNegativeInteger(value.storageErrors) &&
    isStringArray(value.heatKinds) &&
    (value.signals === undefined || isStringArray(value.signals)) &&
    isStringArray(value.reasons)
  );
}

function isRoomTick(value: unknown): value is RoomTranscriptTick {
  if (!isRecord(value)) return false;
  return (
    isNonNegativeInteger(value.tick) &&
    (value.phase === "observe" ||
      value.phase === "choose" ||
      value.phase === "execute" ||
      value.phase === "measure" ||
      value.phase === "continue") &&
    isString(value.event) &&
    (value.choiceCell === undefined || (isNonNegativeInteger(value.choiceCell) && value.choiceCell < 16)) &&
    (value.outcome === "ok" ||
      value.outcome === "refused" ||
      value.outcome === "backpressure" ||
      value.outcome === "continued") &&
    (value.heat === undefined || isHeatRow(value.heat)) &&
    isOptionalString(value.continuation)
  );
}

function isTravelerFrame(value: unknown): value is TranscriptTravelerFrame {
  if (!isRecord(value) || !Array.isArray(value.coordinates) || value.coordinates.length > MAX_COLLECTION_ITEMS) {
    return false;
  }
  return (
    value.schema === "zeta.darkhall.traveler-frame.v1" &&
    isString(value.source) &&
    isNonNegativeInteger(value.commonPhase) &&
    value.coordinates.every(
      (coordinate) => isRecord(coordinate) && isString(coordinate.traveler) && isNonNegativeInteger(coordinate.phase),
    ) &&
    isOptionalBoolean(value.commonDominatesRoom) &&
    isOptionalBoolean(value.commonDominatesHeat)
  );
}

function isPhaseClock(value: unknown): value is PhaseClockReadout {
  if (!isRecord(value)) return false;
  return (
    value.schema === "zeta.darkhall.phase-clock.v1" &&
    isString(value.source) &&
    value.basis === "seed-phase" &&
    isString(value.seed) &&
    isNonNegativeInteger(value.phase) &&
    isNonNegativeInteger(value.skewBoundTicks) &&
    typeof value.appendOnly === "boolean" &&
    isNonNegativeInteger(value.travelers)
  );
}

function isContinuation(value: unknown): value is TranscriptContinuationReadout {
  if (!isRecord(value)) return false;
  return (
    value.schema === "zeta.darkhall.continuation-readout.v1" &&
    isString(value.source) &&
    isString(value.loopId) &&
    typeof value.resumable === "boolean" &&
    isString(value.token) &&
    isString(value.statePointer) &&
    isNonNegativeInteger(value.nextLap) &&
    isNonNegativeInteger(value.ticksSpent) &&
    isNonNegativeInteger(value.resumeBaseTick) &&
    isString(value.stopReason) &&
    isStringArray(value.admissionFeedback)
  );
}

function isSLane(value: unknown): value is SLane {
  return isRecord(value) && isString(value.a) && isString(value.b) && isSafeInteger(value.sMilli);
}

function validateDurableTranscript(value: unknown): BrowserRoomCheckpointResult<DurableRoomRunTranscript> {
  if (!isRecord(value)) {
    return failed("room-checkpoint-state-invalid", "A room checkpoint must contain an object transcript.");
  }

  const presentNonDurable = Object.keys(value).filter((key) => nonDurableFields.has(key));
  if (presentNonDurable.length > 0) {
    return failed(
      "room-checkpoint-non-durable-state",
      `Room checkpoint input contains non-durable fields: ${presentNonDurable.sort().join(", ")}. Recompute them after recovery.`,
      "backpressure",
    );
  }

  const unknownFields = Object.keys(value).filter((key) => !durableFields.has(key));
  if (unknownFields.length > 0) {
    return failed(
      "room-checkpoint-state-invalid",
      `Room checkpoint input contains fields outside ${BROWSER_ROOM_CHECKPOINT_SCHEMA}: ${unknownFields.sort().join(", ")}.`,
    );
  }

  if (
    value.schema !== ROOM_SCHEMA ||
    !isString(value.roomName) ||
    !isString(value.seed) ||
    !Array.isArray(value.controller) ||
    value.controller.length > 16 ||
    !value.controller.every(isControllerCell) ||
    !Array.isArray(value.ticks) ||
    value.ticks.length > MAX_COLLECTION_ITEMS ||
    !value.ticks.every(isRoomTick) ||
    !Array.isArray(value.heatRows) ||
    value.heatRows.length > MAX_COLLECTION_ITEMS ||
    !value.heatRows.every(isHeatRow) ||
    (value.travelerFrame !== undefined && !isTravelerFrame(value.travelerFrame)) ||
    (value.phaseClock !== undefined && !isPhaseClock(value.phaseClock)) ||
    (value.continuationReadout !== undefined && !isContinuation(value.continuationReadout)) ||
    (value.sLanes !== undefined &&
      (!Array.isArray(value.sLanes) || value.sLanes.length > MAX_COLLECTION_ITEMS || !value.sLanes.every(isSLane))) ||
    !isOptionalString(value.generatedBy)
  ) {
    return failed(
      "room-checkpoint-state-invalid",
      "The room checkpoint transcript does not satisfy its bounded integer-valued schema.",
    );
  }

  return succeeded(value as unknown as DurableRoomRunTranscript);
}

function normalizeJson(
  value: unknown,
  depth: number,
  ancestors: ReadonlySet<object>,
  budget: { count: number },
): BrowserRoomCheckpointResult<JsonValue> {
  budget.count += 1;
  if (budget.count > MAX_JSON_VALUES || depth > MAX_JSON_DEPTH) {
    return failed(
      "room-checkpoint-too-large",
      "Room checkpoint structure exceeds its value-count or nesting-depth budget.",
      "backpressure",
    );
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return succeeded(value);
  if (isSafeInteger(value)) return succeeded(value);
  if (typeof value !== "object") {
    return failed("room-checkpoint-encode-failed", "Room checkpoint state contains a non-JSON value.");
  }
  if (ancestors.has(value)) {
    return failed("room-checkpoint-encode-failed", "Room checkpoint state contains a reference cycle.");
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(value);
  if (Array.isArray(value)) {
    if (value.length > MAX_COLLECTION_ITEMS) {
      return failed("room-checkpoint-too-large", "A room checkpoint collection exceeds 4096 items.", "backpressure");
    }
    const result: JsonValue[] = [];
    for (const item of value) {
      const normalized = normalizeJson(item, depth + 1, nextAncestors, budget);
      if (!normalized.ok) return normalized;
      result.push(normalized.value);
    }
    return succeeded(result);
  }
  if (!isRecord(value)) {
    return failed("room-checkpoint-encode-failed", "Room checkpoint state contains an unsupported object.");
  }

  const stringKeys = Object.keys(value);
  if (Reflect.ownKeys(value).length !== stringKeys.length) {
    return failed("room-checkpoint-encode-failed", "Room checkpoint objects may contain only enumerable string keys.");
  }
  const result: Record<string, JsonValue> = {};
  for (const key of stringKeys.sort()) {
    let property: unknown;
    try {
      property = Reflect.get(value, key);
    } catch {
      return failed("room-checkpoint-encode-failed", `Room checkpoint field ${key} could not be read.`);
    }
    const normalized = normalizeJson(property, depth + 1, nextAncestors, budget);
    if (!normalized.ok) return normalized;
    result[key] = normalized.value;
  }
  return succeeded(result);
}

function canonicalBytes(value: unknown): BrowserRoomCheckpointResult<Uint8Array> {
  const normalized = normalizeJson(value, 0, new Set<object>(), { count: 0 });
  if (!normalized.ok) return normalized;
  let payload: Uint8Array;
  try {
    payload = new TextEncoder().encode(JSON.stringify(normalized.value));
  } catch (error) {
    return failed("room-checkpoint-encode-failed", `Room checkpoint encoding failed: ${String(error)}`);
  }
  if (payload.byteLength > MAX_BROWSER_ROOM_CHECKPOINT_BYTES) {
    return failed(
      "room-checkpoint-too-large",
      `Room checkpoint payload is ${String(payload.byteLength)} bytes; the limit is ${String(MAX_BROWSER_ROOM_CHECKPOINT_BYTES)}.`,
      "backpressure",
    );
  }
  return succeeded(payload);
}

export function encodeBrowserRoomCheckpoint(transcript: RoomRunTranscript): BrowserRoomCheckpointResult<Uint8Array> {
  try {
    const validated = validateDurableTranscript(transcript);
    if (!validated.ok) return validated;
    const envelope: BrowserRoomCheckpointEnvelope = {
      schema: BROWSER_ROOM_CHECKPOINT_SCHEMA,
      transcript: validated.value,
    };
    return canonicalBytes(envelope);
  } catch (error) {
    return failed("room-checkpoint-encode-failed", `Room checkpoint inspection failed: ${String(error)}`);
  }
}

export function decodeBrowserRoomCheckpoint(
  payload: Uint8Array,
): BrowserRoomCheckpointResult<DurableRoomRunTranscript> {
  try {
    return decodeBrowserRoomCheckpointUnchecked(payload);
  } catch (error) {
    return failed("room-checkpoint-decode-failed", `Room checkpoint inspection failed: ${String(error)}`);
  }
}

function decodeBrowserRoomCheckpointUnchecked(
  payload: Uint8Array,
): BrowserRoomCheckpointResult<DurableRoomRunTranscript> {
  if (!(payload instanceof Uint8Array) || payload.byteLength === 0) {
    return failed("room-checkpoint-decode-failed", "Room checkpoint payload must contain bytes.");
  }
  if (payload.byteLength > MAX_BROWSER_ROOM_CHECKPOINT_BYTES) {
    return failed(
      "room-checkpoint-too-large",
      `Room checkpoint payload is ${String(payload.byteLength)} bytes; the limit is ${String(MAX_BROWSER_ROOM_CHECKPOINT_BYTES)}.`,
      "backpressure",
    );
  }

  let text: string;
  let parsed: unknown;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
    parsed = JSON.parse(text);
  } catch (error) {
    return failed("room-checkpoint-decode-failed", `Room checkpoint decoding failed: ${String(error)}`);
  }
  if (!isRecord(parsed) || parsed.schema !== BROWSER_ROOM_CHECKPOINT_SCHEMA) {
    return failed(
      "room-checkpoint-schema-unsupported",
      `Room checkpoint schema must be ${BROWSER_ROOM_CHECKPOINT_SCHEMA}.`,
    );
  }

  const validated = validateDurableTranscript(parsed.transcript);
  if (!validated.ok) return validated;
  const canonical = canonicalBytes({ schema: BROWSER_ROOM_CHECKPOINT_SCHEMA, transcript: validated.value });
  if (!canonical.ok) return canonical;
  if (
    canonical.value.byteLength !== payload.byteLength ||
    canonical.value.some((byte, index) => byte !== payload[index])
  ) {
    return failed("room-checkpoint-non-canonical", "Room checkpoint bytes are valid JSON but not canonical bytes.");
  }
  return succeeded(validated.value);
}
