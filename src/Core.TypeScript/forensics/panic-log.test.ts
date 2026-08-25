import { describe, expect, test } from "bun:test";

import {
  findPanicReports,
  groupPanics,
  panicSearchDirs,
  parsePanicReport,
  panicSiteSignature,
  sameKernelBacktrace,
  samePanicSite,
  sharedFramePrefix,
} from "./panic-log.ts";

/**
 * A minimal but structurally faithful panic report. The shape — one line of
 * JSON, newline, then a second JSON document — is exactly what macOS writes,
 * and is why a naive `JSON.parse(wholeFile)` fails.
 */
function makePanic(opts: {
  ts: string;
  panic: string;
  cpu: number;
  task: string;
  execBase: string;
  lrs: readonly string[];
  userLr?: string;
}): string {
  const head = JSON.stringify({
    bug_type: "210",
    timestamp: opts.ts,
    os_version: "macOS 26.5.2 (25F84)",
  });
  const lrLines = opts.lrs.map((l) => `\t\t  lr: ${l}  fp: 0xfffffec20d2ab1f0`).join("\n");
  const userLine = opts.userLr === undefined ? "" : `\n\t\t  lr: ${opts.userLr}  fp: 0x0000000000000000`;
  const panicString = [
    `panic(cpu ${opts.cpu} caller 0xfffffe004d6c40c4): ${opts.panic}`,
    `Debugger message: panic`,
    `Kernel text exec base:  ${opts.execBase}`,
    `Panicked task 0xfffffe2309a05cd0: 1 pages, 1 threads: pid 3621: ${opts.task}`,
    `Panicked thread: 0xfffffe187b7e62d8, backtrace: 0xfffffec20d2ab150, tid: 48753`,
    lrLines + userLine,
    `last started kext at 70733107420: com.apple.filesystems.smbfs\t6.0.1 (addr 0x0, size 1)`,
  ].join("\n");
  return `${head}\n${JSON.stringify({ product: "Mac14,14", panicString }, null, 2)}`;
}

/** The two real `pmap_recycle_page` panics, at their real KASLR bases. */
const KERNEL_FRAMES_A = ["0xfffffe00392b1808", "0xfffffe0039430014", "0xfffffe0039425358"];
const KERNEL_FRAMES_B = ["0xfffffe003f85d808", "0xfffffe003f9dc014", "0xfffffe003f9d1358"];

const PANIC_0741 = makePanic({
  ts: "2026-08-24 07:41:09.00 -0400",
  panic: "pmap_recycle_page: page 0x109bba68000 is referenced @pmap_data.c:2334",
  cpu: 8,
  task: "Cursor Helper (Renderer)",
  execBase: "0xfffffe003925c000",
  lrs: KERNEL_FRAMES_A,
  userLr: "0x00000001840db3c0",
});

const PANIC_0817 = makePanic({
  ts: "2026-08-24 08:17:54.00 -0400",
  panic: "pmap_recycle_page: page 0x10758888000 is referenced @pmap_data.c:2334",
  cpu: 4,
  task: "Cursor Helper (Renderer)",
  execBase: "0xfffffe003f808000",
  lrs: KERNEL_FRAMES_B,
  userLr: "0x000000018f7af3b8",
});

describe("parsePanicReport — the real 2026-08-24 reports", () => {
  test("parses the header/body two-document format", () => {
    const p = parsePanicReport("/x/a.panic", PANIC_0741);
    expect(p).not.toBeNull();
    if (p === null) throw new Error("unreachable");
    expect(p.timestamp).toBe("2026-08-24 07:41:09.00 -0400");
    expect(p.product).toBe("Mac14,14");
    expect(p.cpu).toBe(8);
    expect(p.panickedTask).toBe("Cursor Helper (Renderer)");
  });

  test("extracts the kernel source site the assertion named", () => {
    const p = parsePanicReport("/x/a.panic", PANIC_0741);
    expect(p?.sourceSite).toBe("pmap_data.c:2334");
  });

  test("MUTANT: a single JSON.parse of the whole file fails — the format is two documents", () => {
    let threw = false;
    try {
      JSON.parse(PANIC_0741);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(parsePanicReport("/x/a.panic", PANIC_0741)).not.toBeNull();
  });

  test("garbage yields null, never a half-populated record", () => {
    expect(parsePanicReport("/x/a.panic", "not a panic")).toBeNull();
    expect(parsePanicReport("/x/a.panic", "{}\n{not json}")).toBeNull();
  });
});

describe("de-sliding — the step without which repeats look unique", () => {
  test("the two real panics have IDENTICAL de-slid kernel backtraces", () => {
    const a = parsePanicReport("/x/a.panic", PANIC_0741);
    const b = parsePanicReport("/x/b.panic", PANIC_0817);
    if (a === null || b === null) throw new Error("unreachable");
    expect(a.backtraceOffsets).toEqual(["0x55808", "0x1d4014", "0x1c9358"]);
    expect(b.backtraceOffsets).toEqual(["0x55808", "0x1d4014", "0x1c9358"]);
    expect(sameKernelBacktrace(a, b)).toBe(true);
  });

  test("MUTANT: their RAW addresses share nothing — comparing those reports two unrelated panics", () => {
    expect(KERNEL_FRAMES_A[0]).not.toBe(KERNEL_FRAMES_B[0]);
    expect(KERNEL_FRAMES_A[2]).not.toBe(KERNEL_FRAMES_B[2]);
  });

  test("the userspace return address is EXCLUDED — it is slid by a different base", () => {
    const a = parsePanicReport("/x/a.panic", PANIC_0741);
    if (a === null) throw new Error("unreachable");
    // Four `lr:` lines are in the fixture; only the three kernel ones survive.
    expect(a.backtraceOffsets).toHaveLength(3);
    expect(a.backtraceOffsets.some((o) => o.startsWith("-"))).toBe(false);
  });

  test("a different panic at the same entry shares a PREFIX but is not the same", () => {
    const socd = makePanic({
      ts: "2026-08-24 05:46:58.00 -0400",
      panic: "pmap_remove_range_options: ... wired count underflow @pmap.c:5072",
      cpu: 17,
      task: "Cursor",
      execBase: "0xfffffe003925c000",
      lrs: [KERNEL_FRAMES_A[0] ?? "", KERNEL_FRAMES_A[1] ?? "", "0xfffffe0039410fc4"],
    });
    const a = parsePanicReport("/x/a.panic", PANIC_0741);
    const s = parsePanicReport("/x/s.panic", socd);
    if (a === null || s === null) throw new Error("unreachable");
    expect(sameKernelBacktrace(a, s)).toBe(false);
    expect(sharedFramePrefix(a, s)).toBe(2);
    expect(s.sourceSite).toBe("pmap.c:5072");
  });
});

describe("groupPanics — a repeat is a reproducible bug, not three incidents", () => {
  test("groups the two identical panics into one group of two", () => {
    const a = parsePanicReport("/x/a.panic", PANIC_0741);
    const b = parsePanicReport("/x/b.panic", PANIC_0817);
    if (a === null || b === null) throw new Error("unreachable");
    const g = groupPanics([a, b]);
    expect(g).toHaveLength(1);
    expect(g[0]?.count).toBe(2);
    expect(g[0]?.tasks).toEqual(["Cursor Helper (Renderer)"]);
  });

  test("an empty backtrace does not silently merge with another", () => {
    const a = parsePanicReport("/x/a.panic", PANIC_0741);
    if (a === null) throw new Error("unreachable");
    const blank = { ...a, backtraceOffsets: [] as readonly string[] };
    expect(sameKernelBacktrace(a, blank)).toBe(false);
    expect(sameKernelBacktrace(blank, blank)).toBe(false);
  });
});

describe("findPanicReports — the search that must include Retired/", () => {
  test("Retired/ is in the search set (its omission hid the root cause)", () => {
    const dirs = panicSearchDirs();
    expect(dirs.some((d) => d.endsWith("/Library/Logs/DiagnosticReports/Retired"))).toBe(true);
    expect(dirs.some((d) => d === "/Library/Logs/DiagnosticReports")).toBe(true);
  });

  test("a directory that cannot be listed is UNSEARCHABLE, not empty", () => {
    const r = findPanicReports(["/definitely/not/a/real/path"]);
    expect(r.paths).toHaveLength(0);
    expect(r.searched).toHaveLength(0);
    // This is the whole distinction: zero results from zero directories
    // searched must never read as "there are no panics".
    expect(r.unsearchable).toEqual(["/definitely/not/a/real/path"]);
  });

  test("the dot-prefixed .contents.panic bookkeeping stub is not a report", () => {
    const r = findPanicReports(panicSearchDirs());
    expect(r.paths.every((p) => !p.includes("/.contents.panic"))).toBe(true);
  });
});

describe("panicSiteSignature — grouping by the fault, not the deep stack", () => {
  /**
   * The real behaviour this exists for: the two `pmap_recycle_page` panics on
   * 2026-08-24 share 25 of 26 de-slid kernel frames and diverge at frame 24,
   * deep below the fault. Whole-stack comparison calls them unrelated; site
   * comparison calls them the same bug twice. The second is correct.
   */
  const SITE = ["0x55808", "0x1d4014", "0x1d2054", "0x597c", "0x55b18", "0x94486c", "0x1c9358", "0x16ae0c"];
  const deep = (tail: string) => [...SITE, "0x1a", "0x2b", tail];

  function synth(task: string, ts: string, tail: string) {
    return {
      path: "/x", timestamp: ts, osVersion: "", product: "", panicLine: "pmap_recycle_page",
      sourceSite: "pmap_data.c:2334", cpu: 1, panickedTask: task,
      backtraceOffsets: deep(tail), lastStartedKext: null, bytes: 0,
    };
  }

  test("same site + divergent deep frame => SAME group", () => {
    const a = synth("Cursor Helper (Renderer)", "07:41", "0x1d2194");
    const b = synth("Cursor Helper (Renderer)", "08:17", "0x1d2330");
    expect(sameKernelBacktrace(a, b)).toBe(false); // strict comparison disagrees...
    expect(samePanicSite(a, b)).toBe(true); // ...and the site comparison is the right one
    const g = groupPanics([a, b]);
    expect(g).toHaveLength(1);
    expect(g[0]?.count).toBe(2);
  });

  test("MUTANT: a different fault at the same entry is NOT grouped", () => {
    const a = synth("Cursor Helper (Renderer)", "07:41", "0x1d2194");
    const other = { ...a, backtraceOffsets: [...SITE.slice(0, 6), "0x1b40c4", "0x1b9a58", "0x1a"] };
    expect(samePanicSite(a, other)).toBe(false);
    expect(groupPanics([a, other])).toHaveLength(2);
  });

  test("a backtrace too short for a site never merges into another group", () => {
    const a = synth("Cursor", "07:41", "0x1d2194");
    const stub = { ...a, backtraceOffsets: ["0x55808"] };
    expect(panicSiteSignature(stub)).toBeNull();
    expect(samePanicSite(a, stub)).toBe(false);
    expect(groupPanics([a, stub])).toHaveLength(2);
  });
});
