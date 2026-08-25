import { describe, expect, test } from "bun:test";

import {
  classifyBoots,
  decodeNvramEscapes,
  decodePanicmedicTimestamp,
  decodePanicmedicTimestamps,
  mostRecentPanicMs,
  parseLastRebootOutput,
  parseNvramDump,
  readPanicmedicState,
  readU64LE,
  telemetryAgreesWithTimestamps,
  uncleanBootCount,
} from "./panicmedic.ts";

/**
 * The exact bytes `nvram -p` printed on AceHacks-Mac-Studio at 08:32 EDT on
 * 2026-08-24, fifteen minutes after the third unclean reboot of the morning.
 * Captured verbatim so every claim in the module header is falsifiable without
 * a machine that is crashing.
 */
const REAL_TIMESTAMPS = "0:659c9f687e920";
const REAL_TELEMETRY =
  "%11%01%00%00%00%00%00%00 %e9%87%f6%c9Y%06%00 %e9%87%f6%c9Y%06%00A%01%00%00%00%00%00%00";

/** The panic instant those bytes encode. `kern.boottime` was 08:17:16 EDT. */
const REAL_PANIC_MS = 1787573819664.672;

describe("decodePanicmedicTimestamp — the measured value", () => {
  test("decodes the real NVRAM value to the instant before the observed boot", () => {
    const d = decodePanicmedicTimestamp(REAL_TIMESTAMPS);
    expect(d.kind).toBe("decoded");
    if (d.kind !== "decoded") throw new Error("unreachable");
    expect(d.slot).toBe(0);
    expect(Math.round(d.atMs)).toBe(Math.round(REAL_PANIC_MS));
    // 2026-08-24 08:16:59.664 EDT == 12:16:59.664 UTC
    expect(d.iso).toBe("2026-08-24T12:16:59.664Z");
  });

  test("the decoded panic PRECEDES the boot that followed, by seconds not hours", () => {
    const d = decodePanicmedicTimestamp(REAL_TIMESTAMPS);
    if (d.kind !== "decoded") throw new Error("unreachable");
    const bootMs = 1787573836285.98; // sysctl kern.boottime, same machine
    const gap = (bootMs - d.atMs) / 1000;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(60);
  });

  test("MUTANT: reading the value as nanoseconds is refused, not reported", () => {
    // 0x659c9f687e920 nanoseconds is 1970-01-21. If the module had guessed the
    // unit, this is the answer it would have produced, and it would have
    // looked like a successful decode.
    const asNanos = Math.round(1787573819664672 / 1e6); // ms if it were ns
    expect(asNanos).toBeLessThan(Date.UTC(1971, 0, 1));
    const d = decodePanicmedicTimestamp("0:1");
    expect(d.kind).toBe("implausible");
  });

  test("refuses a non-matching shape rather than half-parsing it", () => {
    expect(decodePanicmedicTimestamp("garbage").kind).toBe("unparsed");
    expect(decodePanicmedicTimestamp("0:zzz").kind).toBe("unparsed");
    expect(decodePanicmedicTimestamp("").kind).toBe("unparsed");
  });

  test("handles several slots, newest wins", () => {
    const all = decodePanicmedicTimestamps("0:659c9f687e920 1:659c0000e0000");
    expect(all).toHaveLength(2);
    expect(all.every((t) => t.kind === "decoded")).toBe(true);
  });
});

describe("telemetry cross-check — what promotes a number to an identification", () => {
  const nvram = parseNvramDump(
    [
      `panicmedic-timestamps\t${REAL_TIMESTAMPS}`,
      `panicmedic-telemetry\t${REAL_TELEMETRY}`,
      `panicmedic-auxkc-present\ttrue`,
    ].join("\n"),
  );

  test("both embedded copies agree with panicmedic-timestamps", () => {
    const st = readPanicmedicState(nvram);
    expect(st.telemetryTimestampsUs).toHaveLength(2);
    expect(st.telemetryTimestampsUs[0]).toBe(1787573819664672);
    expect(st.telemetryTimestampsUs[1]).toBe(1787573819664672);
    expect(telemetryAgreesWithTimestamps(st)).toBe(true);
  });

  test("MUTANT: corrupt one embedded copy and the agreement fails", () => {
    const bad = parseNvramDump(
      [
        `panicmedic-timestamps\t${REAL_TIMESTAMPS}`,
        `panicmedic-telemetry\t${REAL_TELEMETRY.replace("%e9%87%f6%c9Y%06%00 ", "%00%00%00%00%00%00%00 ")}`,
      ].join("\n"),
    );
    expect(telemetryAgreesWithTimestamps(readPanicmedicState(bad))).toBe(false);
  });

  test("no telemetry means null — absence of a cross-check is NOT agreement", () => {
    const only = parseNvramDump(`panicmedic-timestamps\t${REAL_TIMESTAMPS}`);
    expect(telemetryAgreesWithTimestamps(readPanicmedicState(only))).toBeNull();
  });

  test("the two unidentified integers are reported, not named", () => {
    const st = readPanicmedicState(nvram);
    expect(st.telemetryUnknownFields).toEqual([273, 321]);
  });

  test("auxkc flag is read exactly, not truthily", () => {
    expect(readPanicmedicState(nvram).auxkcPresent).toBe(true);
    const f = parseNvramDump("panicmedic-auxkc-present\tfalse");
    expect(readPanicmedicState(f).auxkcPresent).toBe(false);
    // "1" is not "true": guessing here would misreport a security-relevant flag.
    const one = parseNvramDump("panicmedic-auxkc-present\t1");
    expect(readPanicmedicState(one).auxkcPresent).toBe(false);
  });
});

describe("nvram escape decoding", () => {
  test("decodes %xx to bytes and leaves literals alone", () => {
    const b = decodeNvramEscapes("%11%01A ");
    expect(Array.from(b)).toEqual([0x11, 0x01, 0x41, 0x20]);
  });

  test("readU64LE refuses to read past the end", () => {
    expect(readU64LE(new Uint8Array([1, 2, 3]), 0)).toBeNull();
    expect(readU64LE(new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]), 0)).toBe(1);
  });
});

describe("boot classification — the clean/unclean discriminator", () => {
  /** Verbatim `last reboot shutdown` from the machine, 2026-08-24 08:29 EDT. */
  const REAL_LAST = `reboot time                                Mon Aug 24 08:17
reboot time                                Mon Aug 24 07:40
reboot time                                Sun Aug 23 21:35
reboot time                                Thu Aug 13 11:14
shutdown time                              Thu Aug 13 11:13
reboot time                                Sat Aug  8 15:09
reboot time                                Thu Aug  6 01:00

wtmp begins Tue Jan 13 11:49:32 EST 2026`;

  test("parses the real output", () => {
    const recs = parseLastRebootOutput(REAL_LAST);
    expect(recs).toHaveLength(7);
    expect(recs[0]).toEqual({ kind: "reboot", rawTime: "Mon Aug 24 08:17" });
    expect(recs[4]).toEqual({ kind: "shutdown", rawTime: "Thu Aug 13 11:13" });
  });

  test("the three 2026-08-24/23 boots are UNCLEAN and Aug 13 is CLEAN", () => {
    const boots = classifyBoots(parseLastRebootOutput(REAL_LAST));
    expect(boots[0]).toEqual({ rawTime: "Mon Aug 24 08:17", clean: false });
    expect(boots[1]).toEqual({ rawTime: "Mon Aug 24 07:40", clean: false });
    expect(boots[2]).toEqual({ rawTime: "Sun Aug 23 21:35", clean: false });
    expect(boots[3]).toEqual({ rawTime: "Thu Aug 13 11:14", clean: true });
  });

  test("counts unclean boots in a window", () => {
    const boots = classifyBoots(parseLastRebootOutput(REAL_LAST));
    expect(uncleanBootCount(boots, 3)).toBe(3);
    expect(uncleanBootCount(boots, 10)).toBe(5);
  });

  test("MUTANT: insert a shutdown record and the newest boot becomes clean", () => {
    const patched = `reboot time                                Mon Aug 24 08:17
shutdown time                              Mon Aug 24 08:16
${REAL_LAST.split("\n").slice(1).join("\n")}`;
    const boots = classifyBoots(parseLastRebootOutput(patched));
    expect(boots[0]?.clean).toBe(true);
  });

  test("ignores the wtmp footer and blank lines", () => {
    expect(parseLastRebootOutput("\n\nwtmp begins Tue Jan 13\n")).toHaveLength(0);
  });
});

describe("mostRecentPanicMs", () => {
  test("null when nothing decodes — never a fabricated zero", () => {
    const st = readPanicmedicState(parseNvramDump("panicmedic-timestamps\tgarbage"));
    expect(mostRecentPanicMs(st)).toBeNull();
  });
});
