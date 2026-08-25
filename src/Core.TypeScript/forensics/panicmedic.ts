#!/usr/bin/env bun
/**
 * panicmedic.ts — decode the NVRAM keys macOS leaves behind when the machine
 * dies without a clean shutdown, and classify a boot as clean or unclean.
 *
 * WHY THIS EXISTS
 * ---------------------------------------------------------------------------
 * `AceHacks-Mac-Studio` rebooted three times in 11 hours on 2026-08-24 with no
 * `shutdown time` record and no `.panic` file. The only machine-readable
 * account of *when* it died is in NVRAM, in an undocumented format:
 *
 *     panicmedic-timestamps    0:659c9f687e920
 *     panicmedic-auxkc-present true
 *     panicmedic-telemetry     %11%01...
 *
 * MEASURED (2026-08-24, this machine): `0x659c9f687e920` = 1787573819664672,
 * which read as MICROSECONDS since the Unix epoch is
 * `2026-08-24 08:16:59.664672` — and `sysctl kern.boottime` for the boot that
 * followed is `08:17:16`. A 16.3-second gap: exactly a reset-and-reboot. The
 * same 8-byte value appears twice inside `panicmedic-telemetry` at offsets 8
 * and 16, which is the cross-check that pins the unit. Interpreted as
 * nanoseconds it would be 1970-01-21, and as seconds it would be the year
 * 58608, so the microsecond reading is the only one that lands anywhere near
 * the boot it precedes.
 *
 * That timestamp is the load-bearing artifact: it converts "some time before
 * the 08:17 boot" into an instant you can slice the unified log against, and
 * the slice is what showed the 23.6-second logging blackout that motivated the
 * live vitals heartbeat (see `log-store-retention.ts`).
 *
 * WHAT IS NOT DECODED, AND SAID SO
 * ---------------------------------------------------------------------------
 * `panicmedic-telemetry`'s leading `0x111` (273) and trailing `0x141` (321)
 * are NOT identified. They are recorded verbatim and reported as unknown
 * rather than guessed at. A field named from a plausible-looking number is the
 * numerology failure (`.claude/rules/numerology-vs-number-theory.md`): the
 * timestamp is identified because a second, independent quantity
 * (`kern.boottime`) agrees with it to 16 seconds; these two integers have no
 * such witness, so they stay `unknown`.
 *
 * This module is PURE — it parses strings. Reading NVRAM is the caller's job,
 * which is what makes every claim above testable without a reboot.
 */

/**
 * The lower bound a decoded panicmedic timestamp must clear to be believed.
 * 2020-01-01. A value below this is a unit mistake (ns read as us, say), not a
 * panic, and must be refused rather than reported as a 1970s crash.
 */
export const PANICMEDIC_PLAUSIBLE_FLOOR_MS = Date.UTC(2020, 0, 1);

/** Upper bound: 2100-01-01. Above this the value is not a wall-clock time. */
export const PANICMEDIC_PLAUSIBLE_CEILING_MS = Date.UTC(2100, 0, 1);

export type PanicmedicTimestamp =
  | { readonly kind: "decoded"; readonly slot: number; readonly raw: string; readonly atMs: number; readonly iso: string }
  /** Parsed structurally but the value is not a plausible wall-clock time. */
  | { readonly kind: "implausible"; readonly slot: number; readonly raw: string; readonly value: number }
  /** Did not match the `<slot>:<hex>` shape at all. */
  | { readonly kind: "unparsed"; readonly raw: string };

/**
 * Decode one `panicmedic-timestamps` value.
 *
 * Format, as measured: `<decimal slot>:<hex microseconds since epoch>`, and
 * the variable may carry several space-separated entries (one per retained
 * panic). Slot 0 is the most recent.
 */
export function decodePanicmedicTimestamp(entry: string): PanicmedicTimestamp {
  const raw = entry.trim();
  const m = /^(\d+):([0-9a-fA-F]+)$/.exec(raw);
  if (m === null) return { kind: "unparsed", raw };
  const slotText = m[1];
  const hexText = m[2];
  // `noUncheckedIndexedAccess` is on: the regex guarantees both groups, but the
  // type does not, and widening `undefined` into `NaN` silently is the exact
  // shape this repo refuses elsewhere.
  if (slotText === undefined || hexText === undefined) return { kind: "unparsed", raw };
  const slot = Number.parseInt(slotText, 10);
  const micros = Number.parseInt(hexText, 16);
  if (!Number.isSafeInteger(micros)) return { kind: "implausible", slot, raw, value: micros };
  // `panicmedic-timestamps` is measured in MICROSECONDS, so 1000 per ms is the
  // conversion — not 1_000_000. Stated here, at the only site that depends on it.
  const atMs = micros / 1000;
  if (atMs < PANICMEDIC_PLAUSIBLE_FLOOR_MS || atMs > PANICMEDIC_PLAUSIBLE_CEILING_MS) {
    return { kind: "implausible", slot, raw, value: micros };
  }
  return { kind: "decoded", slot, raw, atMs, iso: new Date(atMs).toISOString() };
}

/** Decode every entry in a whole `panicmedic-timestamps` variable value. */
export function decodePanicmedicTimestamps(value: string): readonly PanicmedicTimestamp[] {
  return value
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map(decodePanicmedicTimestamp);
}

/** One `nvram -p` line is `<name>\t<value>`; the value may itself contain tabs. */
export function parseNvramDump(dump: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const line of dump.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab <= 0) continue;
    out.set(line.slice(0, tab), line.slice(tab + 1));
  }
  return out;
}

export interface PanicmedicState {
  /** True when NVRAM carries any panicmedic key at all. */
  readonly present: boolean;
  /** True when a third-party auxiliary kernel collection was loaded at panic time. */
  readonly auxkcPresent: boolean;
  readonly timestamps: readonly PanicmedicTimestamp[];
  /** Raw telemetry blob, undecoded on purpose — see the header. */
  readonly telemetryRaw: string | null;
  /** The two integers in the telemetry blob we can read but cannot name. */
  readonly telemetryUnknownFields: readonly number[];
  /**
   * The microsecond timestamps embedded at offsets 8 and 16 of the telemetry
   * blob. These are the CROSS-CHECK on `timestamps`: two independent encodings
   * of the same instant in two different NVRAM variables. When they disagree,
   * the decode is wrong and must not be trusted.
   */
  readonly telemetryTimestampsUs: readonly number[];
}

/** Offsets of the two duplicated microsecond timestamps in `panicmedic-telemetry`. */
export const TELEMETRY_TIMESTAMP_OFFSETS: readonly number[] = [8, 16];
/** Offsets of the two integers present but unidentified. */
export const TELEMETRY_UNKNOWN_OFFSETS: readonly number[] = [0, 24];

/**
 * `nvram -p` renders non-printable bytes as `%xx`. Recover the byte string so
 * the little-endian integers inside `panicmedic-telemetry` can be read.
 */
export function decodeNvramEscapes(value: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === undefined) break;
    if (ch === "%" && i + 2 < value.length) {
      const hex = value.slice(i + 1, i + 3);
      if (/^[0-9a-fA-F]{2}$/.test(hex)) {
        bytes.push(Number.parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(ch.charCodeAt(0) & 0xff);
  }
  return Uint8Array.from(bytes);
}

/** Read a little-endian u64 at `offset`, or null when the buffer is too short. */
export function readU64LE(bytes: Uint8Array, offset: number): number | null {
  if (offset + 8 > bytes.length) return null;
  let v = 0;
  for (let i = 7; i >= 0; i -= 1) {
    const b = bytes[offset + i];
    if (b === undefined) return null;
    v = v * 256 + b;
  }
  return Number.isSafeInteger(v) ? v : null;
}

export function readPanicmedicState(nvram: ReadonlyMap<string, string>): PanicmedicState {
  const ts = nvram.get("panicmedic-timestamps");
  const aux = nvram.get("panicmedic-auxkc-present");
  const telemetry = nvram.get("panicmedic-telemetry") ?? null;
  const unknown: number[] = [];
  const telemetryTs: number[] = [];
  if (telemetry !== null) {
    const bytes = decodeNvramEscapes(telemetry);
    for (const off of TELEMETRY_UNKNOWN_OFFSETS) {
      const v = readU64LE(bytes, off);
      if (v !== null) unknown.push(v);
    }
    for (const off of TELEMETRY_TIMESTAMP_OFFSETS) {
      const v = readU64LE(bytes, off);
      if (v !== null) telemetryTs.push(v);
    }
  }
  return {
    present: ts !== undefined || aux !== undefined || telemetry !== null,
    auxkcPresent: (aux ?? "").trim() === "true",
    timestamps: ts === undefined ? [] : decodePanicmedicTimestamps(ts),
    telemetryRaw: telemetry,
    telemetryUnknownFields: unknown,
    telemetryTimestampsUs: telemetryTs,
  };
}

/**
 * True when the timestamp in `panicmedic-timestamps` agrees with BOTH copies
 * embedded in `panicmedic-telemetry`. This is what promotes the microsecond
 * reading from "a number that looks like a date" to an identification: two
 * separately-encoded NVRAM variables carry the same 64-bit value, and
 * `kern.boottime` lands seconds after it.
 *
 * Returns null when there is nothing to compare, which is NOT agreement.
 */
export function telemetryAgreesWithTimestamps(state: PanicmedicState): boolean | null {
  const primary = mostRecentPanicMs(state);
  if (primary === null || state.telemetryTimestampsUs.length === 0) return null;
  return state.telemetryTimestampsUs.every((us) => us / 1000 === primary);
}

/** The most recent successfully decoded panic instant, or null. */
export function mostRecentPanicMs(state: PanicmedicState): number | null {
  let best: number | null = null;
  for (const t of state.timestamps) {
    if (t.kind !== "decoded") continue;
    if (best === null || t.atMs > best) best = t.atMs;
  }
  return best;
}

export interface BootRecord {
  readonly kind: "reboot" | "shutdown";
  readonly rawTime: string;
}

/**
 * Parse `last reboot shutdown` output into records, newest first.
 *
 * The discriminator this whole investigation rests on: a software-initiated
 * `reboot`/`shutdown` writes a `shutdown time` record immediately BEFORE the
 * following `reboot time`. A machine that dies writes only the `reboot`.
 */
export function parseLastRebootOutput(text: string): readonly BootRecord[] {
  const out: BootRecord[] = [];
  for (const line of text.split("\n")) {
    const m = /^(reboot|shutdown)\s+time\s+(.*\S)\s*$/.exec(line);
    if (m === null) continue;
    const kind = m[1];
    const rawTime = m[2];
    if (kind === undefined || rawTime === undefined) continue;
    out.push({ kind: kind === "shutdown" ? "shutdown" : "reboot", rawTime });
  }
  return out;
}

export interface BootClassification {
  readonly rawTime: string;
  /** False when no `shutdown time` record immediately precedes this boot. */
  readonly clean: boolean;
}

/**
 * Classify each boot as clean or unclean.
 *
 * `last` prints newest first, so the `shutdown` record for a clean reboot
 * appears on the line AFTER its `reboot` record.
 */
export function classifyBoots(records: readonly BootRecord[]): readonly BootClassification[] {
  const out: BootClassification[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const rec = records[i];
    if (rec === undefined || rec.kind !== "reboot") continue;
    const next = records[i + 1];
    out.push({ rawTime: rec.rawTime, clean: next !== undefined && next.kind === "shutdown" });
  }
  return out;
}

/** How many of the last `n` boots were unclean. Used by the boot-time trigger. */
export function uncleanBootCount(boots: readonly BootClassification[], n: number): number {
  let count = 0;
  for (let i = 0; i < Math.min(n, boots.length); i += 1) {
    const b = boots[i];
    if (b !== undefined && !b.clean) count += 1;
  }
  return count;
}
