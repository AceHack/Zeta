import { describe, expect, test } from "bun:test";
import {
  closeSync,
  constants,
  existsSync,
  mkdtempSync,
  openSync,
  rmSync,
  symlinkSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  agentPlist,
  buildFeedbackReport,
  ERROR_RING_SEGMENTS,
  segmentName,
  segmentsToDelete,
  censusFromComm,
  isSymbolCatalogEntry,
  parseLoadavg,
  parseSwapUsedMb,
  parseVmStat,
  runProbe,
} from "./macos-panic-capture.ts";

describe("parseLoadavg", () => {
  test("parses the real sysctl form", () => {
    expect(parseLoadavg("{ 27.46 28.57 19.88 }")).toEqual([27.46, 28.57, 19.88]);
  });

  test("a missing field is NaN, never a silent 0 — a fabricated zero load would", () => {
    const [a, b, c] = parseLoadavg("{ 1.00 }");
    expect(a).toBe(1);
    expect(Number.isNaN(b)).toBe(true);
    expect(Number.isNaN(c)).toBe(true);
  });
});

describe("parseVmStat", () => {
  const REAL = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                  7820833.
Pages active:                                2197518.
Pages inactive:                              1849760.
Pages wired down:                             721395.
Pages occupied by compressor:                      0.
Pageins:                                     1051821.
Pageouts:                                          0.`;

  test("reads the counters, stripping the trailing period", () => {
    const m = parseVmStat(REAL);
    expect(m.get("Pages free")).toBe(7820833);
    expect(m.get("Pages occupied by compressor")).toBe(0);
    expect(m.get("Pageouts")).toBe(0);
  });

  test("the header line is not a counter", () => {
    expect(parseVmStat(REAL).has("Mach Virtual Memory Statistics")).toBe(false);
  });
});

describe("parseSwapUsedMb", () => {
  test("reads the measured zero-swap state", () => {
    expect(parseSwapUsedMb("vm.swapusage: total = 0.00M  used = 0.00M  free = 0.00M  (encrypted)")).toBe(0);
  });

  test("reads a nonzero value", () => {
    expect(parseSwapUsedMb("total = 4096.00M  used = 1234.50M  free = 2861.50M")).toBe(1234.5);
  });
});

describe("censusFromComm — the load hypothesis's numerator", () => {
  const LINES = [
    "/opt/homebrew/bin/bun",
    "bun",
    "node",
    "/usr/local/share/dotnet/dotnet",
    "git",
    "/Applications/Safari.app/Contents/MacOS/Safari",
    "",
    "  ",
  ];

  test("counts by basename, ignoring the path", () => {
    const c = censusFromComm(LINES);
    expect(c.total).toBe(6);
    expect(c.byHarness["bun"]).toBe(2);
    expect(c.byHarness["node"]).toBe(1);
    expect(c.byHarness["dotnet"]).toBe(1);
    expect(c.byHarness["git"]).toBe(1);
  });

  test("every harness key is present even at zero — a missing key reads as 'not measured'", () => {
    const c = censusFromComm([]);
    expect(Object.keys(c.byHarness).length).toBeGreaterThan(5);
    expect(c.byHarness["rg"]).toBe(0);
    expect(c.total).toBe(0);
  });

  test("MUTANT: a substring match would over-count; anchoring keeps it honest", () => {
    // `bunx` and `nodemon` are NOT `bun` and `node`.
    const c = censusFromComm(["bunx", "nodemon"]);
    expect(c.byHarness["bun"]).toBe(0);
    expect(c.byHarness["node"]).toBe(0);
    expect(c.total).toBe(2);
  });
});

describe("isSymbolCatalogEntry — what gets deduplicated", () => {
  test("recognises dsc and the two-hex-digit directories", () => {
    expect(isSymbolCatalogEntry("dsc")).toBe(true);
    expect(isSymbolCatalogEntry("00")).toBe(true);
    expect(isSymbolCatalogEntry("FF")).toBe(true);
    expect(isSymbolCatalogEntry("A3")).toBe(true);
  });

  test("MUTANT: never matches the LOG DATA — deduplicating Persist would delete the evidence", () => {
    expect(isSymbolCatalogEntry("Persist")).toBe(false);
    expect(isSymbolCatalogEntry("Special")).toBe(false);
    expect(isSymbolCatalogEntry("Signpost")).toBe(false);
    expect(isSymbolCatalogEntry("HighVolume")).toBe(false);
    expect(isSymbolCatalogEntry("timesync")).toBe(false);
    expect(isSymbolCatalogEntry("Extra")).toBe(false);
    expect(isSymbolCatalogEntry("Info.plist")).toBe(false);
    expect(isSymbolCatalogEntry("logdata.LiveData.tracev3")).toBe(false);
  });

  test("lowercase hex is not the catalog form macOS uses", () => {
    expect(isSymbolCatalogEntry("ff")).toBe(false);
    expect(isSymbolCatalogEntry("000")).toBe(false);
  });
});

describe("runProbe — the disposition is never discarded", () => {
  test("a clean run is ok", () => {
    const r = runProbe(["/bin/echo", "hello"]);
    expect(r.ok).toBe(true);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe("hello");
  });

  test("a nonzero exit is NOT ok, and the code survives", () => {
    const r = runProbe(["/bin/sh", "-c", "exit 3"]);
    expect(r.ok).toBe(false);
    expect(r.code).toBe(3);
    expect(r.signal).toBeNull();
  });

  test("SIGNAL DEATH: an empty stdout from a killed probe is distinguishable from silence", () => {
    // This is the whole reason runProbe exists rather than a bare spawnSync
    // whose stdout gets grepped. Both produce "" — only one is a measurement.
    const killed = runProbe(["/bin/sh", "-c", "kill -SEGV $$"]);
    const silent = runProbe(["/bin/sh", "-c", "exit 0"]);
    expect(killed.stdout).toBe("");
    expect(silent.stdout).toBe("");
    expect(killed.signal).toBe("SIGSEGV");
    expect(killed.code).toBeNull();
    expect(killed.ok).toBe(false);
    expect(silent.signal).toBeNull();
    expect(silent.ok).toBe(true);
  });

  test("a missing binary is not ok", () => {
    const r = runProbe(["/nonexistent/definitely-not-here"]);
    expect(r.ok).toBe(false);
  });
});

describe("agentPlist", () => {
  const xml = agentPlist("com.zeta.forensics.test", ["snapshot", "--root", "/tmp/x"], {
    interval: 900,
    runAtLoad: true,
    root: "/tmp/x",
    bun: "/opt/homebrew/bin/bun",
    script: "/repo/cap.ts",
  });

  test("is a launchd USER agent — no sudo, no system domain", () => {
    expect(xml).toContain("<key>Label</key>");
    expect(xml).toContain("com.zeta.forensics.test");
    expect(xml).toContain("<integer>900</integer>");
    // Background + LowPriorityIO so the capture never becomes the load it measures.
    expect(xml).toContain("<string>Background</string>");
    expect(xml).toContain("<key>LowPriorityIO</key>");
  });

  test("MUTANT: never emits a privileged or system-domain key", () => {
    // `UserName`/`GroupName` are how a launchd job asks to run as somebody
    // else; their absence is what keeps this a user agent that needs no
    // elevation. (`--root` in the argv is this tool's storage directory flag,
    // not a privilege request — which is why the check is on KEYS, not on the
    // substring "root".)
    expect(xml).not.toContain("<key>UserName</key>");
    expect(xml).not.toContain("<key>GroupName</key>");
    expect(xml).not.toContain("<key>InitGroups</key>");
    expect(xml).not.toContain("sudo");
    expect(xml).not.toContain("/Library/LaunchDaemons");
  });

  test("the argv is ordered bun -> script -> args", () => {
    const i = xml.indexOf("/opt/homebrew/bin/bun");
    const j = xml.indexOf("/repo/cap.ts");
    const k = xml.indexOf("snapshot");
    expect(i).toBeLessThan(j);
    expect(j).toBeLessThan(k);
  });
});

describe("error ring rotation — race-free by construction", () => {
  test("segment names sort chronologically, so no stat is needed to order them", () => {
    const names = [segmentName(2), segmentName(10), segmentName(1)];
    expect([...names].sort()).toEqual([segmentName(1), segmentName(2), segmentName(10)]);
  });

  test("keeps the N newest and deletes the rest", () => {
    const all = [0, 1, 2, 3, 4, 5].map(segmentName);
    expect(segmentsToDelete(all, ERROR_RING_SEGMENTS)).toEqual(
      [0, 1].map(segmentName).slice(0, all.length - ERROR_RING_SEGMENTS),
    );
    expect(segmentsToDelete(all, ERROR_RING_SEGMENTS)).toHaveLength(all.length - ERROR_RING_SEGMENTS);
  });

  test("deletes nothing when the ring is not yet full", () => {
    expect(segmentsToDelete([segmentName(0)], ERROR_RING_SEGMENTS)).toEqual([]);
    expect(segmentsToDelete([], ERROR_RING_SEGMENTS)).toEqual([]);
  });

  test("MUTANT: never touches a file that is not a ring segment", () => {
    const mixed = [segmentName(0), segmentName(1), segmentName(2), segmentName(3), segmentName(4),
      "vitals-2026.ndjson", "index.json", "panic-full-2026-08-24.panic", ".DS_Store"];
    const doomed = segmentsToDelete(mixed, ERROR_RING_SEGMENTS);
    expect(doomed).toEqual([segmentName(0)]);
    // The one that matters: a panic report in the same directory is never a
    // rotation candidate. Deleting evidence to make room is the worst possible
    // failure mode for a forensics tool.
    expect(doomed.some((n) => n.includes("panic"))).toBe(false);
  });

  test("a zero-padded sequence is what makes lexicographic == chronological", () => {
    // Without padding, "errors-10.log" < "errors-2.log" and the ring would
    // delete its NEWEST segment.
    expect(segmentName(10) > segmentName(2)).toBe(true);
    expect("errors-10.log" > "errors-2.log").toBe(false);
  });
});

describe("error ring open flags — the CodeQL js/file-system-race finding, falsified", () => {
  /**
   * The first version rotated with `rm b; mv a b; open(a, "w")`. Between the
   * rename and the open, anything can create `a` — including a symlink — and
   * `open(a, "w")` follows it. This test plants exactly that and shows the two
   * flag sets behave differently, so the fix is not a matter of opinion.
   */
  /** The flags `cmdErrorRing` opens each new segment with. */
  const HARDENED =
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;

  /**
   * Each arm gets its OWN temp directory and performs exactly one open, so
   * neither test contains a check-then-use chain of its own. (The first
   * version ran both arms against one directory with an `existsSync` between
   * them, which is itself the pattern this codebase refuses — CodeQL flagged
   * the test, and it was right about the shape even though the intent was a
   * demonstration.)
   */
  function plantSymlink(): { planted: string; victim: string; dir: string } {
    const dir = mkdtempSync(join(tmpdir(), "zeta-ring-race-"));
    const planted = join(dir, "planted.log");
    const victim = join(dir, "VICTIM");
    symlinkSync(victim, planted);
    return { planted, victim, dir };
  }

  test("the ring's flags REFUSE a planted symlink", () => {
    const { planted, victim, dir } = plantSymlink();
    let code: string | null = null;
    try {
      const fd = openSync(planted, HARDENED, 0o600);
      writeSync(fd, "pwned");
      closeSync(fd);
    } catch (e) {
      code = (e as NodeJS.ErrnoException).code ?? "unknown";
    }
    expect(code).toBe("EEXIST");
    expect(existsSync(victim)).toBe(false); // nothing written through the link
    rmSync(dir, { recursive: true, force: true });
  });

  test("MUTANT: the original open(path, 'w') FOLLOWS it and writes the victim", () => {
    const { planted, victim, dir } = plantSymlink();
    const fd = openSync(planted, "w");
    writeSync(fd, "pwned");
    closeSync(fd);
    // This is what the rotation used to do, and why it had to change.
    expect(existsSync(victim)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("buildFeedbackReport — a draft for a human, never a submission", () => {
  const panic = (ts: string, line: string, task: string) => ({
    path: `/Library/Logs/DiagnosticReports/Retired/panic-${ts}.panic`,
    timestamp: ts, osVersion: "macOS 26.5.2 (25F84)", product: "Mac14,14",
    panicLine: line, sourceSite: "pmap_data.c:2334", cpu: 9, panickedTask: task,
    backtraceOffsets: ["0x55808", "0x1d4014", "0x1d2054", "0x597c", "0x55b18", "0x94486c", "0x1c9358", "0x16ae0c"],
    lastStartedKext: "com.apple.filesystems.smbfs\t6.0.1", bytes: 4_483_637,
  });
  const panics = [
    panic("2026-08-24 07:41:09.00 -0400", "pmap_recycle_page: page 0x109bba68000 is referenced @pmap_data.c:2334", "Cursor Helper (Renderer)"),
    panic("2026-08-24 09:29:44.00 -0400", "pmap_recycle_page: page 0x11226018000 is referenced @pmap_data.c:2334", "Cursor Helper (Renderer)"),
  ];

  test("carries the verbatim panic strings and the kernel version", () => {
    const t = buildFeedbackReport(panics, []);
    expect(t).toContain("page 0x11226018000 is referenced @pmap_data.c:2334");
    expect(t).toContain("xnu-12377.121.10~1 RELEASE_ARM64_T6020");
    expect(t).toContain("roots installed: 0");
  });

  test("reports the repeat as a reproducible code path", () => {
    expect(buildFeedbackReport(panics, [])).toContain("IDENTICAL de-slid kernel backtrace");
  });

  test("MISSING LOAD DATA IS STATED, not omitted", () => {
    // A filing that quietly drops its reproduction conditions invites
    // "cannot reproduce" and gets closed. Absence is declared.
    const t = buildFeedbackReport(panics, []);
    expect(t).toContain("NO LOAD PROFILE CAPTURED");
    expect(t).not.toContain("Load average peaked at 0");
  });

  test("the panicking task is framed as an observation, never a diagnosis", () => {
    const t = buildFeedbackReport(panics, []);
    expect(t).toContain("not a diagnosis");
    // The verdict form must not appear anywhere in a report a human will file.
    expect(t).not.toMatch(/Cursor (causes|caused|is responsible|is the cause)/i);
  });

  test("MUTANT: with vitals present it reports the measured peak, not a placeholder", () => {
    const v = [
      { load1: 12.5, procTotal: 900, threadTotal: 5000, churn: { perSecond: { xlat: 100_000 }, intervalS: 1 }, byApp: {} },
      { load1: 64.91, procTotal: 940, threadTotal: 5700, churn: { perSecond: { xlat: 648_837 }, intervalS: 1 }, byApp: {} },
    ] as unknown as Parameters<typeof buildFeedbackReport>[1];
    const t = buildFeedbackReport(panics, v);
    expect(t).toContain("64.91");
    expect(t).toContain("648,837");
    expect(t).not.toContain("NO LOAD PROFILE CAPTURED");
  });
});
