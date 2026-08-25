import { describe, expect, test } from "bun:test";

import { parseVmStat } from "./macos-panic-capture.ts";
import {
  appFootprints,
  APP_RULES,
  churnRates,
  classifyApp,
  CUMULATIVE_VM_COUNTERS,
  describeFootprints,
  parsePsRows,
  parseThreadCounts,
  residentShare,
  VM_COUNTER_KEYS,
} from "./vm-churn.ts";

describe("churnRates — a rate is a difference, and the first one does not exist", () => {
  const t0 = 1_000_000;
  const a = new Map<string, number>([
    ["Translation faults", 1_000_000],
    ["Pages copy-on-write", 50_000],
    ["Pageins", 900],
  ]);
  const b = new Map<string, number>([
    ["Translation faults", 1_400_000],
    ["Pages copy-on-write", 70_000],
    ["Pageins", 900],
  ]);

  test("computes per-second rates over the interval", () => {
    const r = churnRates(a, t0, b, t0 + 2000);
    expect(r).not.toBeNull();
    if (r === null) throw new Error("unreachable");
    expect(r.intervalS).toBe(2);
    expect(r.perSecond["xlat"]).toBe(200_000);
    expect(r.perSecond["cow"]).toBe(10_000);
    expect(r.perSecond["pgin"]).toBe(0); // genuinely zero, and measured
  });

  test("NULL, not zero, when there is no previous reading", () => {
    // The distinction that matters: the first sample after a boot is exactly
    // the one a crash investigation reads, and `0 faults/s` there would be
    // indistinguishable from an idle machine.
    expect(churnRates(null, null, b, t0)).toBeNull();
    expect(churnRates(a, null, b, t0)).toBeNull();
  });

  test("NULL when a counter went backwards — counters reset across a reboot", () => {
    expect(churnRates(b, t0, a, t0 + 1000)).toBeNull();
  });

  test("NULL on a non-positive interval rather than dividing by zero", () => {
    expect(churnRates(a, t0, b, t0)).toBeNull();
    expect(churnRates(a, t0, b, t0 - 1)).toBeNull();
  });

  test("MUTANT: clamping a backwards counter to 0 would report a reboot as calm", () => {
    const r = churnRates(b, t0, a, t0 + 1000);
    expect(r).toBeNull();
    expect(r?.perSecond).toBeUndefined();
  });

  test("every cumulative counter has a short key, and they are unique", () => {
    const keys = CUMULATIVE_VM_COUNTERS.map((n) => VM_COUNTER_KEYS[n]);
    expect(keys.every((k) => typeof k === "string" && k.length > 0)).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("Translation faults and copy-on-write are present — they ARE the churn signal", () => {
    // pmap_recycle_page sits at the end of the mapping lifecycle these count.
    expect(CUMULATIVE_VM_COUNTERS).toContain("Translation faults");
    expect(CUMULATIVE_VM_COUNTERS).toContain("Pages copy-on-write");
  });
});

describe("classifyApp — real process strings from this machine", () => {
  test("Cursor and its helpers land in one bucket", () => {
    expect(classifyApp("/Applications/Cursor.app/Contents/MacOS/Cursor")).toBe("cursor");
    expect(classifyApp("Cursor Helper (Renderer)")).toBe("cursor");
    expect(classifyApp("Cursor Helper (Plugin): extension-host cursor [1-2]")).toBe("cursor");
    expect(classifyApp("Cursor")).toBe("cursor");
  });

  test("ORDER IS LOAD-BEARING: a Cursor renderer is cursor, not generic electron", () => {
    // `Helper (Renderer)` also matches the electron rule; cursor must win.
    const cursorIdx = APP_RULES.findIndex((r) => r.app === "cursor");
    const electronIdx = APP_RULES.findIndex((r) => r.app === "electron");
    expect(cursorIdx).toBeLessThan(electronIdx);
    expect(classifyApp("Cursor Helper (Renderer)")).not.toBe("electron");
  });

  test("Apple's own indexers are separated so they do not inflate 'other'", () => {
    expect(classifyApp("/System/.../Support/mds_stores")).toBe("apple-index");
    expect(classifyApp("mdworker_shared")).toBe("apple-index");
    expect(classifyApp("/System/.../com.apple.WebKit.WebContent")).toBe("apple-index");
  });

  test("the agent fleet is its own bucket, matched exactly", () => {
    expect(classifyApp("bun")).toBe("agent");
    expect(classifyApp("/opt/homebrew/bin/bun")).toBe("agent");
    expect(classifyApp("dotnet")).toBe("agent");
    // MUTANT: `bunx` and `nodemon` are not the fleet.
    expect(classifyApp("bunx")).toBe("other");
    expect(classifyApp("nodemon")).toBe("other");
  });

  test("unknown processes are 'other', never silently dropped", () => {
    expect(classifyApp("some-random-daemon")).toBe("other");
  });
});

describe("parsePsRows / parseThreadCounts — VERBATIM ps output, not paraphrased", () => {
  const PS = `    1      2048 /sbin/launchd
  428      8192 /usr/libexec/logd
 3079   1720912 /System/Library/Frameworks/WebKit.framework/Versions/A/XPCServices/com.apple.WebKit.WebContent.xpc/Contents/MacOS/com.apple.WebKit.WebContent
 2612    934400 Cursor Helper (Renderer)`;

  /**
   * Real `ps -AM` bytes from this machine. The shape is the whole point: a
   * header, then per process ONE summary line carrying the user and command,
   * then one line per thread carrying neither.
   *
   * The first version of this test used input invented from the field names
   * and passed while the live parser matched nothing. Fixtures written from
   * documentation test the documentation.
   */
  const PS_AM = `USER               PID   TT   %CPU STAT PRI     STIME     UTIME COMMAND
root                 1   ??    0.0 S    31T   0:00.00   0:00.00 /sbin/launchd
                     1         0.3 S    37T   0:00.27   0:00.15
                     1         0.5 S    37T   0:00.03   0:00.04
root               428   ??    0.0 S    31T   0:00.00   0:00.00 /usr/libexec/logd
                   428         1.7 S    20T   0:01.52   0:01.17
                   428         0.6 S    20T   0:00.30   0:00.21
                   428         0.9 S    20T   0:00.26   0:00.19`;

  test("parses pid, rss and a command containing spaces", () => {
    const rows = parsePsRows(PS);
    expect(rows).toHaveLength(4);
    expect(rows[3]).toEqual({ pid: 2612, rssKb: 934400, comm: "Cursor Helper (Renderer)" });
  });

  test("threads = lines bearing the pid MINUS the summary line", () => {
    const t = parseThreadCounts(PS_AM);
    // launchd: 1 summary + 2 thread lines -> 2 threads.
    expect(t.get(1)).toBe(2);
    // logd: 1 summary + 3 thread lines -> 3 threads.
    expect(t.get(428)).toBe(3);
    expect(t.get(999)).toBeUndefined();
  });

  test("CROSS-CHECKED against top: 17 ps -AM lines == 16 threads", () => {
    // Measured on pid 2799 (Cursor Helper): `ps -AM` printed 17 lines and
    // `top -l 1 -pid 2799 -stats th` reported 16. The off-by-one is the
    // process summary line, and this pins it.
    const lines = ["USER PID TT %CPU STAT PRI STIME UTIME COMMAND",
      "acehack 2799 ?? 0.4 S 47T 0:00.54 0:01.27 /Applications/Cursor.app/x"];
    for (let i = 0; i < 16; i += 1) lines.push("     2799     0.0 S 37T 0:00.00 0:00.00");
    expect(parseThreadCounts(lines.join("\n")).get(2799)).toBe(16);
  });

  test("the ps -AM header is not a process", () => {
    expect(parseThreadCounts("USER               PID   TT   %CPU STAT PRI\n").size).toBe(0);
  });

  test("MUTANT: never reports 0 threads for a process that exists", () => {
    // A lone summary line with no thread rows still means one thread. Zero
    // would be a parse failure reported as a fact.
    expect(parseThreadCounts("USER PID\nroot 55 ?? 0.0 S 31T 0:00 0:00 /x").get(55)).toBe(1);
  });
});

describe("parseVmStat quoting — the bug that made the key counter read as '?'", () => {
  /** Verbatim `vm_stat` bytes. Note the quotes on exactly one line. */
  const VM_STAT = `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                                  7820833.
Pages active:                                2197518.
"Translation faults":                       15263099.
Pages copy-on-write:                          390548.
Pageins:                                     1051821.`;

  test("the quoted counter name is recovered", () => {
    const m = parseVmStat(VM_STAT);
    expect(m.get("Translation faults")).toBe(15263099);
    expect(m.get('"Translation faults"')).toBeUndefined();
  });

  test("unquoted counters are unaffected", () => {
    const m = parseVmStat(VM_STAT);
    expect(m.get("Pages copy-on-write")).toBe(390548);
    expect(m.get("Pages free")).toBe(7820833);
  });

  test("MUTANT: without stripping, churnRates loses the primary signal", () => {
    const naive = new Map<string, number>([['"Translation faults"', 100]]);
    const r = churnRates(naive, 0, new Map([['"Translation faults"', 200]]), 1000);
    // The counter is present under the wrong key, so no rate is produced for
    // it -- which is exactly what rendered as `xlat/s=?` in the live run.
    expect(r?.perSecond["xlat"]).toBeUndefined();
  });
});

describe("appFootprints — the measurement that separates trigger from bystander", () => {
  const rows = parsePsRows(
    [
      " 2612    934400 Cursor Helper (Renderer)",
      " 2613    100000 Cursor Helper (Renderer)",
      " 3079   1720912 /System/.../com.apple.WebKit.WebContent",
      " 4001      5000 bun",
    ].join("\n"),
  );
  const threads = new Map<number, number>([
    [2612, 40],
    [2613, 30],
    [3079, 12],
  ]);

  test("folds processes, threads and resident MB per application", () => {
    const f = appFootprints(rows, threads);
    expect(f["cursor"]).toEqual({ procs: 2, threads: 70, rssMb: 1010 });
    expect(f["apple-index"]?.procs).toBe(1);
    expect(f["agent"]?.procs).toBe(1);
  });

  test("a process with no thread rows counts as 1, never 0", () => {
    // pid 4001 is absent from the map. Reporting 0 threads for a live process
    // would be reporting a parse failure as a fact.
    expect(appFootprints(rows, threads)["agent"]?.threads).toBe(1);
  });

  test("residentShare reports a fact, and it is a real fraction", () => {
    const f = appFootprints(rows, threads);
    const share = residentShare(f, "cursor");
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.4);
    expect(residentShare(f, "nonexistent-app")).toBe(0);
    expect(residentShare({}, "cursor")).toBe(0);
  });

  test("describeFootprints sorts by resident bytes, biggest first", () => {
    const d = describeFootprints(appFootprints(rows, threads));
    expect(d.indexOf("apple-index")).toBeLessThan(d.indexOf("cursor"));
    expect(d).toContain("cursor:2p/70t/1010M");
  });
});
