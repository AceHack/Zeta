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

/**
 * A SECOND real-hardware sample, and it DISAGREES.
 * ---------------------------------------------------------------------------
 * Everything above this line is built on one `nvram -p` reading (08:16:59 EDT,
 * 2026-08-24), and in that reading `panicmedic-timestamps` and the two copies
 * inside `panicmedic-telemetry` carry the identical 64-bit value. The module
 * header offers that agreement as the evidence that "pins the unit".
 *
 * The MUTANT test above proves the code CAN report disagreement — it zeroes
 * bytes in the fixture and gets `false`. What it cannot prove is the claim about
 * the HARDWARE, because a corrupted fixture is not a second reading.
 *
 * This is the second reading. Same machine, watchdog reset later the same night
 * (`ResetCounter-2026-08-24-223927.diag`: `Boot faults: wdog,reset_in1`), and
 * the two variables differ by EXACTLY 1,000,000 us — one second, to the
 * microsecond.
 *
 * These tests pin the OBSERVED BEHAVIOUR and nothing more. The production logic
 * is deliberately unchanged: it is not determined whether the two NVRAM
 * variables latch at genuinely different instants (a ~1 s stage separation in
 * the panic path would be unremarkable) or whether the offset-8/16 fields were
 * misidentified from the single sample that happened to match. Loosening the
 * predicate to a tolerance would manufacture agreement without understanding the
 * mechanism, which is the failure this module exists to refuse.
 *
 * Work-item: 081M0VE8T8X087G0R003FYC0WF
 */
describe("LIVE SAMPLE 2026-08-25 — the cross-check does NOT hold on real data", () => {
  /** `nvram -p`, verbatim, AceHacks-Mac-Studio, after the 22:38:13 EDT boot. */
  const LIVE_TIMESTAMPS = "0:659d5fd687db9";
  /**
   * Verbatim, split only for line width. The first 32 bytes are the whole of
   * what the module reads; the remainder is 111 literal `%00` pad bytes, and
   * `telemetry blob is 143 bytes` below is the check that this reconstruction
   * is byte-exact rather than a convenient approximation.
   */
  const LIVE_TELEMETRY =
    "%11%01%00%00%00%00%00%00" + // offset 0  — unknown field, 0x111 = 273
    "y;Y%fd%d5Y%06%00" + //        offset 8  — LE u64 = 1787625473653625
    "y;Y%fd%d5Y%06%00" + //        offset 16 — LE u64 = 1787625473653625 (same)
    "A%01%00%00%00%00%00%00" + //  offset 24 — unknown field, 0x141 = 321
    "%00".repeat(111); //          pad

  /** Decoded from `panicmedic-timestamps`: 2026-08-24 22:37:54.653625 EDT. */
  const LIVE_TIMESTAMPS_US = 1787625474653625;
  /** Decoded from both telemetry copies: 22:37:53.653625 EDT — one second earlier. */
  const LIVE_TELEMETRY_US = 1787625473653625;

  const nvram = parseNvramDump(
    [
      `panicmedic-timestamps\t${LIVE_TIMESTAMPS}`,
      `panicmedic-telemetry\t${LIVE_TELEMETRY}`,
      `panicmedic-auxkc-present\ttrue`,
    ].join("\n"),
  );

  test("the fixture is a byte-exact reconstruction of the live blob", () => {
    const bytes = decodeNvramEscapes(LIVE_TELEMETRY);
    expect(bytes.length).toBe(143);
    expect(Array.from(bytes.slice(0, 32))).toEqual([
      0x11, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, //
      0x79, 0x3b, 0x59, 0xfd, 0xd5, 0x59, 0x06, 0x00, //
      0x79, 0x3b, 0x59, 0xfd, 0xd5, 0x59, 0x06, 0x00, //
      0x41, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, //
    ]);
    expect(Array.from(bytes.slice(32)).every((b) => b === 0)).toBe(true);
  });

  test("the two copies INSIDE the telemetry blob still agree with each other", () => {
    // The intra-blob half of the header's claim survives this sample. Only the
    // cross-VARIABLE half fails, so the disagreement is not a decode error.
    const st = readPanicmedicState(nvram);
    expect(st.telemetryTimestampsUs).toEqual([LIVE_TELEMETRY_US, LIVE_TELEMETRY_US]);
  });

  test("panicmedic-timestamps decodes to the panic instant the machine reported", () => {
    const d = decodePanicmedicTimestamp(LIVE_TIMESTAMPS);
    expect(d.kind).toBe("decoded");
    if (d.kind !== "decoded") throw new Error("unreachable");
    expect(d.atMs * 1000).toBe(LIVE_TIMESTAMPS_US);
    // 2026-08-24 22:37:54.653 EDT == 2026-08-25 02:37:54.653 UTC.
    expect(d.iso).toBe("2026-08-25T02:37:54.653Z");
  });

  test("the two NVRAM variables differ by EXACTLY 1,000,000 us", () => {
    const st = readPanicmedicState(nvram);
    const primaryUs = mostRecentPanicMs(st);
    const embeddedUs = st.telemetryTimestampsUs[0];
    if (primaryUs === null || embeddedUs === undefined) throw new Error("unreachable");
    expect(primaryUs * 1000 - embeddedUs).toBe(1_000_000);
    // Exactly 10^6 is a round number in DECIMAL microseconds and 0xF4240 in hex.
    // A truncation or an off-by-one byte read would not land there.
    expect((primaryUs * 1000 - embeddedUs).toString(16)).toBe("f4240");
  });

  test("the gap is not a float artifact — both sides are exact in the number domain", () => {
    // Every value here is a safe integer, and the `/ 1000` the comparison
    // performs is exact for both, so `===` is comparing what it appears to.
    expect(Number.isSafeInteger(LIVE_TIMESTAMPS_US)).toBe(true);
    expect(Number.isSafeInteger(LIVE_TELEMETRY_US)).toBe(true);
    expect((LIVE_TIMESTAMPS_US / 1000) * 1000).toBe(LIVE_TIMESTAMPS_US);
    expect((LIVE_TELEMETRY_US / 1000) * 1000).toBe(LIVE_TELEMETRY_US);
    // 1000 ms of separation against a ~0.00024 ms ULP at this magnitude.
    const ulp = 2 ** (Math.floor(Math.log2(LIVE_TIMESTAMPS_US / 1000)) - 52);
    expect((LIVE_TIMESTAMPS_US - LIVE_TELEMETRY_US) / 1000 / ulp).toBeGreaterThan(1e6);
  });

  test("PINNED: telemetryAgreesWithTimestamps returns FALSE on this live sample", () => {
    // NOT an assertion that false is correct. An assertion that false is what
    // the shipped code reports for real, uncorrupted hardware data — so the
    // header's "two separately-encoded NVRAM variables carry the same 64-bit
    // value" is a claim with a live counter-example, recorded rather than
    // papered over. See work-item 081M0VE8T8X087G0R003FYC0WF.
    expect(telemetryAgreesWithTimestamps(readPanicmedicState(nvram))).toBe(false);
  });

  test("both readings still precede the observed boot, so kern.boottime cannot adjudicate", () => {
    // `sysctl kern.boottime` = { sec = 1787625493, usec = 559935 }.
    // Neither candidate is excluded by the boottime witness: 18.3 s and 19.3 s
    // are both ordinary reset-and-reboot intervals. This is why the mechanism
    // stays undetermined instead of being decided here.
    const bootUs = 1787625493 * 1e6 + 559935;
    const fromTimestamps = (bootUs - LIVE_TIMESTAMPS_US) / 1e6;
    const fromTelemetry = (bootUs - LIVE_TELEMETRY_US) / 1e6;
    expect(fromTimestamps).toBeGreaterThan(0);
    expect(fromTimestamps).toBeLessThan(60);
    expect(fromTelemetry).toBeGreaterThan(0);
    expect(fromTelemetry).toBeLessThan(60);
    expect(fromTelemetry - fromTimestamps).toBeCloseTo(1, 9);
  });

  test("the two unidentified integers are unchanged across both real samples", () => {
    // 0x111 and 0x141 held steady while the timestamps moved, which is a fact
    // about them worth having and still not enough to name them.
    expect(readPanicmedicState(nvram).telemetryUnknownFields).toEqual([273, 321]);
  });
});
