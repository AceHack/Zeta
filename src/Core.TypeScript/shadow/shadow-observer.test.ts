import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { runOneCycle, log, detectViaCommand, detectGreyTextMacOS, parseConfig, parseRestoreArrowOutput, RESTORE_ARROW_SEP } from "./shadow-observer.ts";
import type { ShadowConfig, ShadowEvent, OsascriptRunner, RestoreArrowResult } from "./shadow-observer.ts";

const SCRIPT = join(import.meta.dir, "shadow-observer.ts");
let TEST_DIR: string;

function logPath(): string {
  return join(TEST_DIR, "shadow.log");
}

function run(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const r = spawnSync("bun", [SCRIPT, ...args, "--log-file", logPath()], {
    encoding: "utf-8",
  });
  return {
    stdout: (r.stdout ?? "").trim(),
    stderr: (r.stderr ?? "").trim(),
    exitCode: r.status ?? 1,
  };
}

function readLog(): ShadowEvent[] {
  const p = logPath();
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as ShadowEvent);
}

describe("shadow-observer — CLI argument validation", () => {
  beforeEach(() => {
    TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-test-"));
  });
  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("--delay abc exits 1 with error message", () => {
    const r = run("--delay", "abc", "--once");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("--delay");
  });

  test("--delay -5 exits 1", () => {
    const r = run("--delay", "-5", "--once");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("--delay");
  });

  test("--loop-interval abc exits 1", () => {
    const r = run("--loop-interval", "abc", "--once");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("--loop-interval");
  });

  test("unknown flag exits 1", () => {
    const r = run("--bogus-flag");
    expect(r.exitCode).toBe(1);
  });
});

describe("shadow-observer — dry-run once mode", () => {
  beforeEach(() => {
    TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-test-"));
  });
  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("--dry-run --once exits 0", () => {
    const r = run("--dry-run", "--once");
    expect(r.exitCode).toBe(0);
  });

  test("--dry-run --once writes started + no-suggestion events to log file", () => {
    run("--dry-run", "--once");
    const events = readLog();
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0]!.type).toBe("started");
    expect(events[0]!.dryRun).toBe(true);
    const last = events[events.length - 1]!;
    expect(last.type).toBe("no-suggestion");
  });

  test("--dry-run --once --delay 0 completes quickly", () => {
    const start = Date.now();
    const r = run("--dry-run", "--once", "--delay", "0");
    expect(r.exitCode).toBe(0);
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test("started event contains delay and dry-run in content", () => {
    run("--dry-run", "--once", "--delay", "500");
    const events = readLog();
    const started = events.find((e) => e.type === "started");
    expect(started).toBeDefined();
    expect(started!.delayMs).toBe(500);
    expect(started!.dryRun).toBe(true);
  });

  test("stdout emits JSON log lines", () => {
    const r = run("--dry-run", "--once");
    expect(r.exitCode).toBe(0);
    const lines = r.stdout.split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

describe("shadow-observer — freshness guard (fix #3 for new-console zsh abort)", () => {
  test("checkWindowFresh returns false on first sighting (window too fresh)", async () => {
    const { checkWindowFresh } = await import("./shadow-observer.ts");
    const history = new Map<string, number>();
    const result = checkWindowFresh({ pid: 1234, name: "Terminal" }, 5000, 1_000_000, history);
    expect(result).toBe(false);
    expect(history.get("1234|Terminal")).toBe(1_000_000);
  });

  test("checkWindowFresh returns true after threshold elapsed", async () => {
    const { checkWindowFresh } = await import("./shadow-observer.ts");
    const history = new Map<string, number>([["1234|Terminal", 1_000_000]]);
    expect(checkWindowFresh({ pid: 1234, name: "Terminal" }, 5000, 1_004_999, history)).toBe(false);
    expect(checkWindowFresh({ pid: 1234, name: "Terminal" }, 5000, 1_005_000, history)).toBe(true);
    expect(checkWindowFresh({ pid: 1234, name: "Terminal" }, 5000, 1_010_000, history)).toBe(true);
  });

  test("checkWindowFresh threshold 0 always returns true (guard disabled)", async () => {
    const { checkWindowFresh } = await import("./shadow-observer.ts");
    const history = new Map<string, number>();
    expect(checkWindowFresh({ pid: 1234, name: "Terminal" }, 0, 1_000_000, history)).toBe(true);
    expect(history.size).toBe(0); // disabled means no history mutation
  });

  test("runOneCycle returns skipped-fresh-window + skips detection when window fresh", async () => {
    const { runOneCycle, _resetFrontmostHistory } = await import("./shadow-observer.ts");
    _resetFrontmostHistory();
    const config: ShadowConfig = {
      delayMs: 0,
      dryRun: true,
      logFile: "/dev/null",
      loopIntervalMs: 0,
      once: true,
      restoreArrow: false,
      freshnessThresholdMs: 5000,
    };
    let detectCalled = false;
    const detectFn = async () => { detectCalled = true; return "should-not-fire"; };
    const acceptFn = async () => true;
    const restoreArrowFn = async () => ({ verdict: "should-not-fire", delta: "" });
    const getFrontmostStateFn = async () => ({ pid: 9999, name: "iTerm2" });
    const fixedNow = () => 1_000_000;

    const verdict = await runOneCycle(config, detectFn, acceptFn, restoreArrowFn, getFrontmostStateFn, fixedNow);
    expect(verdict).toBe("skipped-fresh-window");
    expect(detectCalled).toBe(false);
  });

  test("runOneCycle skips cycle when frontmost probe returns null (per docstring contract)", async () => {
    const { runOneCycle, _resetFrontmostHistory } = await import("./shadow-observer.ts");
    _resetFrontmostHistory();
    const config: ShadowConfig = {
      delayMs: 0,
      dryRun: true,
      logFile: "/dev/null",
      loopIntervalMs: 0,
      once: true,
      restoreArrow: true,
      freshnessThresholdMs: 5000,
    };
    let detectCalled = false;
    let restoreCalled = false;
    const detectFn = async () => { detectCalled = true; return "should-not-fire"; };
    const acceptFn = async () => true;
    const restoreArrowFn = async () => { restoreCalled = true; return { verdict: "should-not-fire", delta: "" }; };
    const getFrontmostStateFn = async () => null;
    const fixedNow = () => 1_000_000;

    const verdict = await runOneCycle(config, detectFn, acceptFn, restoreArrowFn, getFrontmostStateFn, fixedNow);
    expect(verdict).toBe("skipped-fresh-window");
    expect(detectCalled).toBe(false);
    expect(restoreCalled).toBe(false);
  });

  test("checkWindowFresh evicts oldest entry when history reaches FRONTMOST_HISTORY_MAX", async () => {
    const { checkWindowFresh, FRONTMOST_HISTORY_MAX } = await import("./shadow-observer.ts");
    const history = new Map<string, number>();
    // Fill to capacity
    for (let i = 0; i < FRONTMOST_HISTORY_MAX; i++) {
      checkWindowFresh({ pid: 1000 + i, name: "App" }, 5000, 1_000_000 + i, history);
    }
    expect(history.size).toBe(FRONTMOST_HISTORY_MAX);
    expect(history.has("1000|App")).toBe(true);
    // One more insertion → oldest evicted
    checkWindowFresh({ pid: 9999, name: "NewApp" }, 5000, 2_000_000, history);
    expect(history.size).toBe(FRONTMOST_HISTORY_MAX);
    expect(history.has("1000|App")).toBe(false);
    expect(history.has("9999|NewApp")).toBe(true);
  });
});

describe("shadow-observer — runOneCycle unit (injected fns)", () => {
  const baseConfig: ShadowConfig = {
    delayMs: 0,
    dryRun: true,
    logFile: "/dev/null",
    loopIntervalMs: 0,
    once: true,
    restoreArrow: false,
    freshnessThresholdMs: 0,
  };

  test("returns no-suggestion when detectFn returns null", async () => {
    const result = await runOneCycle(baseConfig, async () => null);
    expect(result).toBe("no-suggestion");
  });

  test("returns accepted when detectFn returns text and re-detects same text", async () => {
    const detectFn = async () => "some-suggestion";
    const acceptFn = async (_cfg: ShadowConfig) => true;
    const result = await runOneCycle(baseConfig, detectFn, acceptFn);
    expect(result).toBe("accepted");
  });

  test("returns overridden when re-detection returns null (human keystroke)", async () => {
    let callCount = 0;
    const detectFn = async () => {
      callCount++;
      return callCount === 1 ? "suggestion" : null;
    };
    const result = await runOneCycle(baseConfig, detectFn);
    expect(result).toBe("overridden");
  });

  test("returns error when detectFn throws", async () => {
    const detectFn = async (): Promise<string | null> => {
      throw new Error("accessibility denied");
    };
    const result = await runOneCycle(baseConfig, detectFn);
    expect(result).toBe("error");
  });

  test("returns error when acceptFn returns false", async () => {
    const detectFn = async () => "suggestion";
    const acceptFn = async (_cfg: ShadowConfig) => false;
    const result = await runOneCycle(baseConfig, detectFn, acceptFn);
    expect(result).toBe("error");
  });

  test("restoreArrow=false skips the press (restoreArrowFn never called)", async () => {
    let pressed = 0;
    const restoreArrowFn = async () => { pressed++; return { verdict: "pressed:Terminal", delta: "" }; };
    const result = await runOneCycle(baseConfig, async () => null, undefined, restoreArrowFn);
    expect(result).toBe("no-suggestion");
    expect(pressed).toBe(0);
  });

  test("restoreArrow=true invokes restoreArrowFn exactly once per cycle", async () => {
    const cfg = { ...baseConfig, restoreArrow: true };
    let pressed = 0;
    const restoreArrowFn = async () => { pressed++; return { verdict: "pressed:Terminal", delta: "" }; };
    const result = await runOneCycle(cfg, async () => null, undefined, restoreArrowFn);
    expect(result).toBe("no-suggestion");
    expect(pressed).toBe(1);
  });

  test("restoreArrowFn throw is captured as error verdict, never crashes the cycle", async () => {
    const cfg = { ...baseConfig, restoreArrow: true };
    const restoreArrowFn = async (): Promise<RestoreArrowResult> => { throw new Error("osascript-died"); };
    const result = await runOneCycle(cfg, async () => null, undefined, restoreArrowFn);
    expect(result).toBe("no-suggestion");
  });

  test("restoreArrow=true fires even under dry-run (orthogonal to acceptGreyText safety)", async () => {
    const cfg = { ...baseConfig, restoreArrow: true, dryRun: true };
    let pressed = 0;
    const restoreArrowFn = async () => { pressed++; return { verdict: "pressed:Terminal", delta: "" }; };
    await runOneCycle(cfg, async () => null, undefined, restoreArrowFn);
    expect(pressed).toBe(1);
  });

  test("v2 delta is captured in log event (delta + deltaLen fields)", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "zeta-shadow-delta-test-"));
    try {
      const cfg = { ...baseConfig, restoreArrow: true, logFile: join(tmpDir, "log") };
      const restoreArrowFn = async () => ({ verdict: "pressed:Terminal", delta: "restored-autocomplete-content" });
      await runOneCycle(cfg, async () => null, undefined, restoreArrowFn);
      const events = readFileSync(join(tmpDir, "log"), "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as ShadowEvent);
      const restoreEvent = events.find((e) => e.type === "restore-arrow");
      expect(restoreEvent).toBeDefined();
      expect(restoreEvent!.content).toBe("pressed:Terminal");
      expect(restoreEvent!.delta).toBe("restored-autocomplete-content");
      expect(restoreEvent!.deltaLen).toBe(29);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("v2 empty delta still logs deltaLen=0 (the common no-op restore)", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "zeta-shadow-delta-test-"));
    try {
      const cfg = { ...baseConfig, restoreArrow: true, logFile: join(tmpDir, "log") };
      const restoreArrowFn = async () => ({ verdict: "pressed:Terminal", delta: "" });
      await runOneCycle(cfg, async () => null, undefined, restoreArrowFn);
      const events = readFileSync(join(tmpDir, "log"), "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as ShadowEvent);
      const restoreEvent = events.find((e) => e.type === "restore-arrow");
      expect(restoreEvent!.delta).toBe("");
      expect(restoreEvent!.deltaLen).toBe(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe("shadow-observer — parseRestoreArrowOutput unit (v2 delta-detect)", () => {
  test("pressed verdict with delta: parses verdict + delta on Unit-Separator delimiter", () => {
    const r = parseRestoreArrowOutput(`pressed:Terminal${RESTORE_ARROW_SEP}some-restored-text\n`);
    expect(r.verdict).toBe("pressed:Terminal");
    expect(r.delta).toBe("some-restored-text");
  });

  test("pressed verdict with empty delta: still parses cleanly", () => {
    const r = parseRestoreArrowOutput(`pressed:iTerm2${RESTORE_ARROW_SEP}\n`);
    expect(r.verdict).toBe("pressed:iTerm2");
    expect(r.delta).toBe("");
  });

  test("skipped verdict carries empty delta", () => {
    const r = parseRestoreArrowOutput(`skipped:not-terminal:Safari${RESTORE_ARROW_SEP}\n`);
    expect(r.verdict).toBe("skipped:not-terminal:Safari");
    expect(r.delta).toBe("");
  });

  test("legacy v1 output (no separator) yields verdict-only result", () => {
    const r = parseRestoreArrowOutput("pressed:Terminal\n");
    expect(r.verdict).toBe("pressed:Terminal");
    expect(r.delta).toBe("");
  });

  test("delta containing newlines is preserved (only trailing newlines stripped)", () => {
    const r = parseRestoreArrowOutput(`pressed:Terminal${RESTORE_ARROW_SEP}line-1\nline-2\n`);
    expect(r.delta).toBe("line-1\nline-2");
  });

  test("delta containing leading whitespace is preserved (autocomplete may start with space)", () => {
    const r = parseRestoreArrowOutput(`pressed:Terminal${RESTORE_ARROW_SEP} starts-with-space`);
    expect(r.delta).toBe(" starts-with-space");
  });
});

describe("shadow-observer — log() unit", () => {
  beforeEach(() => {
    TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-test-"));
  });
  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  test("appends JSON events to log file", () => {
    const lf = logPath();
    const event1: ShadowEvent = {
      timestamp: "2026-05-13T00:00:00.000Z",
      type: "started",
      delayMs: 3000,
      dryRun: true,
    };
    const event2: ShadowEvent = {
      timestamp: "2026-05-13T00:00:01.000Z",
      type: "no-suggestion",
      delayMs: 3000,
      dryRun: true,
    };
    log(event1, lf);
    log(event2, lf);

    const lines = readFileSync(lf, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ShadowEvent);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.type).toBe("started");
    expect(lines[1]!.type).toBe("no-suggestion");
  });

  test("log() does not throw when log file directory is /dev/null (non-writable path)", () => {
    const event: ShadowEvent = {
      timestamp: new Date().toISOString(),
      type: "started",
      delayMs: 0,
      dryRun: true,
    };
    expect(() => log(event, "/dev/null/nonexistent/path")).not.toThrow();
  });
});

describe("shadow-observer — detectViaCommand unit (slice 2)", () => {
  test("returns trimmed stdout when command exits 0 with text", async () => {
    const result = await detectViaCommand("echo suggestion");
    expect(result).toBe("suggestion");
  });

  test("returns null when command exits non-0 (false)", async () => {
    const result = await detectViaCommand("false");
    expect(result).toBeNull();
  });

  test("returns '(detected)' sentinel when command exits 0 with empty stdout", async () => {
    const result = await detectViaCommand("true");
    expect(result).toBe("(detected)");
  });

  test("returns null when command exits 1 with output (exit code wins)", async () => {
    const result = await detectViaCommand("sh -c 'echo text; exit 1'");
    expect(result).toBeNull();
  });

  test("returns multi-word trimmed stdout for compound echo", async () => {
    const result = await detectViaCommand("echo hello world");
    expect(result).toBe("hello world");
  });

  test("returns null when shell exits 127 (command not found inside sh)", async () => {
    // sh -c wraps the cmd; unknown command → sh exits 127 (≠ 0) → null
    const result = await detectViaCommand("this-command-absolutely-does-not-exist-zeta-test");
    expect(result).toBeNull();
  });
});

describe("shadow-observer — --detect-cmd CLI integration (slice 2)", () => {
  let TEST_DIR: string;
  beforeEach(() => {
    TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-detect-cmd-test-"));
  });
  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  const SCRIPT = join(import.meta.dir, "shadow-observer.ts");

  function run2(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
    const r = spawnSync("bun", [SCRIPT, ...args, "--log-file", join(TEST_DIR, "shadow.log")], {
      encoding: "utf-8",
    });
    return {
      stdout: (r.stdout ?? "").trim(),
      stderr: (r.stderr ?? "").trim(),
      exitCode: r.status ?? 1,
    };
  }

  function readLog2(): ShadowEvent[] {
    const p = join(TEST_DIR, "shadow.log");
    if (!existsSync(p)) return [];
    return readFileSync(p, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ShadowEvent);
  }

  test("--detect-cmd 'echo suggestion' --dry-run --once logs detected + accepted", () => {
    const r = run2("--detect-cmd", "echo suggestion", "--dry-run", "--once", "--delay", "0");
    expect(r.exitCode).toBe(0);
    const events = readLog2();
    const types = events.map((e) => e.type);
    expect(types).toContain("detected");
    expect(types).toContain("accepted");
  });

  test("--detect-cmd 'echo suggestion' detected event has suggestion as content", () => {
    run2("--detect-cmd", "echo suggestion", "--dry-run", "--once", "--delay", "0");
    const events = readLog2();
    const detected = events.find((e) => e.type === "detected");
    expect(detected?.content).toBe("suggestion");
  });

  test("--detect-cmd 'false' --dry-run --once logs no-suggestion", () => {
    run2("--detect-cmd", "false", "--dry-run", "--once");
    const events = readLog2();
    const types = events.map((e) => e.type);
    expect(types).toContain("no-suggestion");
    expect(types).not.toContain("accepted");
  });

  test("--detect-cmd 'true' --dry-run --once detects sentinel string", () => {
    run2("--detect-cmd", "true", "--dry-run", "--once", "--delay", "0");
    const events = readLog2();
    const detected = events.find((e) => e.type === "detected");
    expect(detected?.content).toBe("(detected)");
  });

  test("--detect-cmd does not override explicit detectFn in unit tests", async () => {
    // When detectFn is passed explicitly to runOneCycle, it wins over detectCmd.
    const baseConfig: ShadowConfig = {
      delayMs: 0,
      detectCmd: "echo should-not-appear",
      dryRun: true,
      logFile: "/dev/null",
      loopIntervalMs: 0,
      once: true,
      restoreArrow: false,
    freshnessThresholdMs: 0,
    };
    const result = await runOneCycle(baseConfig, async () => null);
    expect(result).toBe("no-suggestion");
  });
});

describe("shadow-observer — detectGreyTextMacOS unit (slice 3)", () => {
  test("returns null + logs warning on non-darwin platform", async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };
    try {
      const result = await detectGreyTextMacOS(undefined, undefined, "linux");
      expect(result).toBeNull();
      expect(warnings.some((m) => m.includes("non-macOS"))).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });

  test("returns trimmed text when osascript exits 0 with stdout", async () => {
    const mockRunner: OsascriptRunner = async () => ({
      exitCode: 0,
      stdout: "  some suggestion  \n",
      stderr: "",
    });
    const result = await detectGreyTextMacOS(undefined, mockRunner);
    expect(result).toBe("some suggestion");
  });

  test("returns null when osascript exits 0 with empty stdout", async () => {
    const mockRunner: OsascriptRunner = async () => ({
      exitCode: 0,
      stdout: "   \n",
      stderr: "",
    });
    const result = await detectGreyTextMacOS(undefined, mockRunner);
    expect(result).toBeNull();
  });

  test("returns null + logs warning when osascript exits non-zero", async () => {
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(String(args[0]));
    };
    try {
      const mockRunner: OsascriptRunner = async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "error: osascript failure",
      });
      const result = await detectGreyTextMacOS(undefined, mockRunner);
      expect(result).toBeNull();
      expect(
        warnings.some((m) => m.includes("osascript exited") || m.includes("permission")),
      ).toBe(true);
    } finally {
      console.warn = origWarn;
    }
  });
});

describe("shadow-observer — --loop flag validation (slice 4)", () => {
  let TEST_DIR: string;
  beforeEach(() => {
    TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-loop-val-test-"));
  });
  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  function runLoop(...args: string[]): { stdout: string; stderr: string; exitCode: number } {
    const r = spawnSync("bun", [SCRIPT, ...args, "--log-file", join(TEST_DIR, "shadow.log")], {
      encoding: "utf-8",
    });
    return {
      stdout: (r.stdout ?? "").trim(),
      stderr: (r.stderr ?? "").trim(),
      exitCode: r.status ?? 1,
    };
  }

  test("--loop abc exits 1 with error message", () => {
    const r = runLoop("--loop", "abc", "--once");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("--loop");
  });

  test("--loop -1 exits 1 with error message", () => {
    const r = runLoop("--loop", "-1", "--once");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("--loop");
  });

  test("--loop 0 exits 1 with error message (zero is not positive)", () => {
    const r = runLoop("--loop", "0", "--once");
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain("--loop");
  });

  test("--loop 1000 is accepted by parseConfig (loopMs=1000)", () => {
    const config = parseConfig(["--loop", "1000", "--once"]);
    expect(config.loopMs).toBe(1000);
  });

  test("--restore-arrow defaults to false when absent", () => {
    const config = parseConfig(["--once"]);
    expect(config.restoreArrow).toBe(false);
  });

  test("--restore-arrow sets restoreArrow=true", () => {
    const config = parseConfig(["--once", "--restore-arrow"]);
    expect(config.restoreArrow).toBe(true);
  });
});

describe("shadow-observer — --loop outer restart integration (slice 4)", () => {
  let LOOP_DIR: string;
  const ZETA_SHADOW = join(import.meta.dir, "zeta-shadow.ts");

  beforeEach(() => {
    LOOP_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-loop-int-test-"));
  });
  afterEach(() => {
    if (existsSync(LOOP_DIR)) rmSync(LOOP_DIR, { recursive: true, force: true });
  });

  function logPath(): string {
    return join(LOOP_DIR, "shadow.log");
  }

  function readEvents(): ShadowEvent[] {
    const p = logPath();
    if (!existsSync(p)) return [];
    return readFileSync(p, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ShadowEvent);
  }

  test("--loop 100 --once --dry-run restarts: log shows ≥2 started events within 1200ms", async () => {
    // Use --detect-cmd false so cycles complete instantly (no osascript overhead)
    const proc = Bun.spawn(
      [
        "bun", ZETA_SHADOW,
        "--loop", "100", "--once", "--dry-run", "--delay", "0",
        "--detect-cmd", "false",
        "--log-file", logPath(),
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
    await Bun.sleep(1200);
    proc.kill("SIGTERM");
    await proc.exited;
    const events = readEvents();
    const startedCount = events.filter((e) => e.type === "started").length;
    expect(startedCount).toBeGreaterThanOrEqual(2);
  });

  test("--loop 100 --detect-cmd 'echo hi' --once --dry-run --delay 0: detection runs across restarts", async () => {
    const proc = Bun.spawn(
      [
        "bun", ZETA_SHADOW,
        "--loop", "100",
        "--once", "--dry-run", "--delay", "0",
        "--detect-cmd", "echo hi",
        "--log-file", logPath(),
      ],
      { stdout: "ignore", stderr: "ignore" },
    );
    await Bun.sleep(600);
    proc.kill("SIGTERM");
    await proc.exited;
    const events = readEvents();
    const detectedCount = events.filter((e) => e.type === "detected").length;
    expect(detectedCount).toBeGreaterThanOrEqual(2);
  });

  test("SIGTERM stops outer loop: no new started events appear after kill", async () => {
    const proc = Bun.spawn(
      ["bun", ZETA_SHADOW, "--loop", "2000", "--once", "--dry-run", "--log-file", logPath()],
      { stdout: "ignore", stderr: "ignore" },
    );
    // Let one cycle run, then kill
    await Bun.sleep(300);
    proc.kill("SIGTERM");
    await proc.exited;
    const countAfterKill = readEvents().filter((e) => e.type === "started").length;
    // Wait and verify no extra restarts happened (loopMs=2000 so restart won't trigger before kill)
    await Bun.sleep(300);
    const countAfterWait = readEvents().filter((e) => e.type === "started").length;
    expect(countAfterKill).toBe(countAfterWait);
  });
});

describe("shadow-observer — zeta-shadow.ts smoke tests (slice 4)", () => {
  let SMOKE_DIR: string;
  const ZETA_SHADOW = join(import.meta.dir, "zeta-shadow.ts");

  beforeEach(() => {
    SMOKE_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-smoke-test-"));
  });
  afterEach(() => {
    if (existsSync(SMOKE_DIR)) rmSync(SMOKE_DIR, { recursive: true, force: true });
  });

  test("zeta-shadow.ts --once --dry-run exits 0", () => {
    const r = spawnSync(
      "bun",
      [ZETA_SHADOW, "--once", "--dry-run", "--log-file", join(SMOKE_DIR, "shadow.log")],
      { encoding: "utf-8" },
    );
    expect(r.status).toBe(0);
  });

  test("zeta-shadow.ts with invalid flag exits 1", () => {
    const r = spawnSync(
      "bun",
      [ZETA_SHADOW, "--bogus-flag-zeta"],
      { encoding: "utf-8" },
    );
    expect(r.status).toBe(1);
  });
});

describe("shadow-observer — runOneCycle full cycle paths (slice 3)", () => {
  let CYCLE_TEST_DIR: string;

  beforeEach(() => {
    CYCLE_TEST_DIR = mkdtempSync(join(tmpdir(), "zeta-shadow-cycle-test-"));
  });
  afterEach(() => {
    if (existsSync(CYCLE_TEST_DIR)) rmSync(CYCLE_TEST_DIR, { recursive: true, force: true });
  });

  function cycleConfig(): ShadowConfig {
    return {
      delayMs: 0,
      dryRun: true,
      logFile: join(CYCLE_TEST_DIR, "shadow.log"),
      loopIntervalMs: 0,
      once: true,
      restoreArrow: false,
    freshnessThresholdMs: 0,
    };
  }

  function readCycleLog(): ShadowEvent[] {
    const p = join(CYCLE_TEST_DIR, "shadow.log");
    if (!existsSync(p)) return [];
    return readFileSync(p, "utf-8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ShadowEvent);
  }

  // --- Overridden path ---

  test("overridden path: detectFn called exactly twice", async () => {
    let callCount = 0;
    const detectFn = async () => {
      callCount++;
      return callCount === 1 ? "suggestion" : null;
    };
    await runOneCycle(cycleConfig(), detectFn);
    expect(callCount).toBe(2);
  });

  test("overridden path: writes detected then overridden events to log", async () => {
    let callCount = 0;
    const detectFn = async () => {
      callCount++;
      return callCount === 1 ? "my-suggestion" : null;
    };
    await runOneCycle(cycleConfig(), detectFn);
    const types = readCycleLog().map((e) => e.type);
    expect(types).toContain("detected");
    expect(types).toContain("overridden");
  });

  test("overridden path: detected event carries first-call suggestion content", async () => {
    let callCount = 0;
    const detectFn = async () => {
      callCount++;
      return callCount === 1 ? "hello-world" : null;
    };
    await runOneCycle(cycleConfig(), detectFn);
    const detected = readCycleLog().find((e) => e.type === "detected");
    expect(detected?.content).toBe("hello-world");
  });

  test("overridden path: re-detect throw is treated as override (returns overridden)", async () => {
    let callCount = 0;
    const detectFn = async () => {
      callCount++;
      if (callCount === 2) throw new Error("re-detect failure");
      return "suggestion";
    };
    // runOneCycle catches re-detect throw → stillPresent = null → "overridden"
    const result = await runOneCycle(cycleConfig(), detectFn);
    expect(result).toBe("overridden");
  });

  // --- Accepted path ---

  test("accepted path: detectFn called exactly twice", async () => {
    let callCount = 0;
    const detectFn = async () => {
      callCount++;
      return "suggestion";
    };
    await runOneCycle(cycleConfig(), detectFn, async () => true);
    expect(callCount).toBe(2);
  });

  test("accepted path: writes detected then accepted events to log", async () => {
    const detectFn = async () => "suggestion";
    await runOneCycle(cycleConfig(), detectFn, async () => true);
    const types = readCycleLog().map((e) => e.type);
    expect(types).toContain("detected");
    expect(types).toContain("accepted");
  });

  test("accepted path: dry-run accepted event content includes 'dry-run'", async () => {
    const detectFn = async () => "suggestion";
    await runOneCycle(cycleConfig(), detectFn, async () => true);
    const accepted = readCycleLog().find((e) => e.type === "accepted");
    expect(accepted?.content).toContain("dry-run");
  });

  test("accepted path: acceptFn called exactly once", async () => {
    let acceptCallCount = 0;
    const detectFn = async () => "suggestion";
    const acceptFn = async (_cfg: ShadowConfig) => {
      acceptCallCount++;
      return true;
    };
    await runOneCycle(cycleConfig(), detectFn, acceptFn);
    expect(acceptCallCount).toBe(1);
  });
});
