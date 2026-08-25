// service-control-port.test.ts — falsifiers for the port, its version guarantee, and the
// claim that a SECOND adapter is genuinely constructible.
import { describe, expect, test } from "bun:test";
import {
  MIN_BOOTSTRAPPER_MAJOR,
  createLaunchctlControl,
  inMemoryServiceControl,
  parseBootstrapperMajor,
  parsePrintOutput,
  type LaunchctlSpawn,
  type ServiceControlPort,
} from "./service-control-port";
import type { SystemToolEffects, ToolFileFacts } from "../privilege/system-tool";

const GOOD: ToolFileFacts = { isFile: true, uid: 0, mode: 0o100755, size: 364448, dev: 1, ino: 42 };
const REAL_VERSION = "Darwin Bootstrapper Version 7.0.0: Sat Apr 18 19:58:40 PDT 2026; root:libxpc_executables-3102.120.13~112/launchd/RELEASE_ARM64E";

function darwinFx(facts: ToolFileFacts | null = GOOD): SystemToolEffects {
  return {
    platform: () => "darwin",
    stat: (p) => (p === "/bin/launchctl" ? facts : null),
    realpath: (p) => (p === "/bin/launchctl" && facts !== null ? p : null),
    sha256: () => "aa11",
  };
}

/** A scripted launchctl. Records argv so we can assert the ABSOLUTE path was spawned. */
function scripted(replies: Record<string, { status: number | null; stdout?: string; stderr?: string } | null>) {
  const calls: { path: string; args: readonly string[] }[] = [];
  const spawn: LaunchctlSpawn = (path, args) => {
    calls.push({ path, args });
    const key = args[0] ?? "";
    const r = replies[key];
    if (r === undefined || r === null) return null;
    return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  };
  return { spawn, calls };
}

const OK_VERSION = { version: { status: 0, stdout: REAL_VERSION } };

describe("parseBootstrapperMajor", () => {
  test("parses the REAL measured banner", () => {
    expect(parseBootstrapperMajor(REAL_VERSION)).toBe(7);
  });
  test("returns null for a forgery that prints nothing", () => {
    expect(parseBootstrapperMajor("")).toBeNull();
  });
  test("returns null for arbitrary text — no accidental match", () => {
    expect(parseBootstrapperMajor("totally fine, trust me")).toBeNull();
  });
});

describe("parsePrintOutput", () => {
  test("extracts running state and last exit code", () => {
    const r = parsePrintOutput("  state = running\n  last exit code = 0\n");
    expect(r.running).toBe(true);
    expect(r.launchdState).toBe("running");
    expect(r.lastExitCode).toBe(0);
  });
  test("a non-running state is not reported as running", () => {
    const r = parsePrintOutput("  state = waiting\n  last exit code = 2\n");
    expect(r.running).toBe(false);
    expect(r.lastExitCode).toBe(2);
  });
  // Real captured `launchctl print` output. These fixtures caught a genuine bug during
  // development: a `(\S+)` state regex reported "spawn" for "spawn scheduled".
  const DEAD_OTTO_PRINT = "\n\tpath = /Users/x/Library/LaunchAgents/com.lucent.zeta.otto.plist\n\tstate = spawn scheduled\n\tprogram = /Users/x/wrapper.sh\n\tlast exit code = 78: EX_CONFIG\n";
  const HEALTHY_KIRO_PRINT = "\n\tpath = /Users/x/Library/LaunchAgents/com.lucent.zeta.kiro-loop.plist\n\tstate = not running\n\tprogram = /Users/x/bun\n\tlast exit code = 0\n";

  test("MULTI-WORD state is captured whole, not truncated at the first word", () => {
    expect(parsePrintOutput(DEAD_OTTO_PRINT).launchdState).toBe("spawn scheduled");
    expect(parsePrintOutput(HEALTHY_KIRO_PRINT).launchdState).toBe("not running");
  });

  test("neither real fixture is reported as running", () => {
    expect(parsePrintOutput(DEAD_OTTO_PRINT).running).toBe(false);
    expect(parsePrintOutput(HEALTHY_KIRO_PRINT).running).toBe(false);
  });

  test("a decorated exit code keeps its numeric part", () => {
    expect(parsePrintOutput(DEAD_OTTO_PRINT).lastExitCode).toBe(78);
    expect(parsePrintOutput(HEALTHY_KIRO_PRINT).lastExitCode).toBe(0);
  });

  test("absent fields stay absent rather than defaulting to a lie", () => {
    const r = parsePrintOutput("nothing useful here");
    expect(r.running).toBe(false);
    expect(r.lastExitCode).toBeUndefined();
    expect(r.launchdState).toBeUndefined();
  });
});

describe("createLaunchctlControl — FAIL CLOSED at construction", () => {
  test("admits a conforming host and reports the guarantee", () => {
    const { spawn, calls } = scripted(OK_VERSION);
    const r = createLaunchctlControl(spawn, darwinFx());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.port.guarantee.implementation).toBe("launchctl");
    expect(r.port.guarantee.major).toBe(7);
    expect(r.port.guarantee.path).toBe("/bin/launchctl");
    expect(r.port.guarantee.identity?.sha256).toBe("aa11");
    // The ABSOLUTE path is what got spawned — not the name.
    expect(calls[0]?.path).toBe("/bin/launchctl");
  });

  test("refuses when the binary is not admissible (uid 501 forgery)", () => {
    const { spawn, calls } = scripted(OK_VERSION);
    const r = createLaunchctlControl(spawn, darwinFx({ ...GOOD, uid: 501 }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("must refuse a non-root launchctl");
    expect(r.reason).toContain("not root-owned");
    // Nothing was spawned at all — refusal happens BEFORE any execution.
    expect(calls.length).toBe(0);
  });

  test("refuses when `version` cannot be run", () => {
    const { spawn } = scripted({ version: null });
    const r = createLaunchctlControl(spawn, darwinFx());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("could not be run");
  });

  test("refuses an UNPARSEABLE version rather than assuming compatibility", () => {
    // This is the forged-binary case: exits 0, prints nothing useful.
    const { spawn } = scripted({ version: { status: 0, stdout: "" } });
    const r = createLaunchctlControl(spawn, darwinFx());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("an unparseable version must refuse");
    expect(r.reason).toContain("unrecognised version string");
  });

  test("refuses a generation below the minimum", () => {
    const { spawn } = scripted({ version: { status: 0, stdout: "Darwin Bootstrapper Version 1.0.0: old" } });
    const r = createLaunchctlControl(spawn, darwinFx());
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toContain("below the required");
  });

  test("accepts exactly the minimum generation — the boundary is not off by one", () => {
    const { spawn } = scripted({ version: { status: 0, stdout: `Darwin Bootstrapper Version ${String(MIN_BOOTSTRAPPER_MAJOR)}.0.0: x` } });
    expect(createLaunchctlControl(spawn, darwinFx()).ok).toBe(true);
  });

  test("on linux there is no launchctl and construction refuses", () => {
    const fx: SystemToolEffects = { platform: () => "linux", stat: () => GOOD, realpath: (p) => p, sha256: () => "aa11" };
    const { spawn } = scripted(OK_VERSION);
    const r = createLaunchctlControl(spawn, fx);
    expect(r.ok).toBe(false);
  });
});

describe("binary adapter operations spawn the absolute path", () => {
  function port(extra: Record<string, { status: number | null; stdout?: string; stderr?: string } | null>) {
    const { spawn, calls } = scripted({ ...OK_VERSION, ...extra });
    const r = createLaunchctlControl(spawn, darwinFx());
    if (!r.ok) throw new Error(r.reason);
    return { port: r.port, calls };
  }

  test("bootstrap passes domain and definition, and reports stderr on failure", () => {
    const { port: p, calls } = port({ bootstrap: { status: 5, stderr: "Input/output error" } });
    const out = p.bootstrap("gui/501", "/tmp/x.plist");
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error("unreachable");
    expect(out.reason).toContain("Input/output error");
    expect(calls[1]).toEqual({ path: "/bin/launchctl", args: ["bootstrap", "gui/501", "/tmp/x.plist"] });
  });

  test("bootout is IDEMPOTENT — a non-zero status is still ok:true", () => {
    const { port: p } = port({ bootout: { status: 3, stderr: "No such process" } });
    expect(p.bootout("gui/501", "com.zeta.x").ok).toBe(true);
  });

  test("bootout joins a label but keeps a definition PATH as a separate argument", () => {
    const { port: p, calls } = port({ bootout: { status: 0 } });
    p.bootout("gui/501", "com.zeta.x");
    expect(calls[1]?.args).toEqual(["bootout", "gui/501/com.zeta.x"]);
    p.bootout("gui/501", "/tmp/x.plist");
    expect(calls[2]?.args).toEqual(["bootout", "gui/501", "/tmp/x.plist"]);
  });

  test("describe reports found:false on non-zero, parsed facts on zero", () => {
    const missing = port({ print: { status: 1 } });
    expect(missing.port.describe("gui/501", "com.zeta.x")).toEqual({ found: false });
    const live = port({ print: { status: 0, stdout: "state = running\nlast exit code = 0\n" } });
    expect(live.port.describe("gui/501", "com.zeta.x")).toEqual({
      found: true, running: true, launchdState: "running", lastExitCode: 0,
    });
  });

  test("describe returns the THIRD state when the spawn itself fails", () => {
    const { port: p } = port({ print: null });
    const d = p.describe("gui/501", "com.zeta.x");
    expect(d.found).toBe("unknown");
  });

  test("listLabels returns null (indeterminate) rather than an empty list on failure", () => {
    const { port: p } = port({ list: null });
    expect(p.listLabels()).toBeNull();
    const ok = port({ list: { status: 0, stdout: "PID\tStatus\tLabel\n1\t0\tcom.zeta.a\n-\t0\tcom.zeta.b\n" } });
    expect(ok.port.listLabels()).toEqual(["com.zeta.a", "com.zeta.b"]);
  });
});

// ---------------------------------------------------------------------------
// THE PORT TEST. If ServiceControlPort had encoded "spawn a subprocess", this adapter
// could not exist. It shares no code path with the binary adapter.
describe("inMemoryServiceControl — the second adapter", () => {
  test("satisfies the same interface with NO subprocess", () => {
    const p: ServiceControlPort = inMemoryServiceControl();
    expect(p.guarantee.implementation).toBe("in-memory");
    expect(p.guarantee.path).toBeNull();
    expect(p.bootstrap("gui/501", "/x/com.zeta.a.plist").ok).toBe(true);
    expect(p.describe("gui/501", "com.zeta.a")).toEqual({ found: true, running: true, launchdState: "running" });
    expect(p.listLabels()).toEqual(["com.zeta.a"]);
    expect(p.bootout("gui/501", "com.zeta.a").ok).toBe(true);
    expect(p.describe("gui/501", "com.zeta.a")).toEqual({ found: false });
  });

  test("bootout is idempotent here TOO — the contract holds across adapters", () => {
    const p = inMemoryServiceControl();
    expect(p.bootout("gui/501", "never-existed").ok).toBe(true);
  });

  test("CONTRACT PARITY: one caller works unchanged against both adapters", () => {
    // The substitutability claim, exercised rather than asserted. `caller` is written
    // against the port only and never learns which adapter it got.
    function caller(p: ServiceControlPort): string {
      const d = p.describe("gui/501", "com.zeta.a");
      if (d.found === "unknown") return `unknown: ${d.why}`;
      return d.found ? `running=${String(d.running)}` : "absent";
    }
    const mem = inMemoryServiceControl([{ label: "com.zeta.a", running: true }]);
    const { spawn } = scripted({ ...OK_VERSION, print: { status: 0, stdout: "state = running\n" } });
    const bin = createLaunchctlControl(spawn, darwinFx());
    if (!bin.ok) throw new Error(bin.reason);
    expect(caller(mem)).toBe("running=true");
    expect(caller(bin.port)).toBe("running=true");
  });
});
