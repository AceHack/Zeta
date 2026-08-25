// service-control-port.ts — the PORT for launchd service control, in OUR vocabulary.
//
// HEXAGONAL, and the indirection has to earn itself (Cockburn 2005, "Ports and Adapters").
// Aaron 2026-08-25: *"at a minimum make sure we install the right version behind our own
// hexagonal interface that can be guaranteed to work, this is how we replace it eventually
// with our own code."* So the contract below is ours, the binary is one adapter, and the
// test of whether that is real is whether a SECOND adapter exists that shares no mechanism
// with the first. `inMemoryServiceControl()` in this file is that second adapter: it
// implements every operation with no subprocess, no filesystem and no launchd. If the port
// had accidentally encoded "spawn a subprocess" — argv arrays, exit codes, raw stdout —
// that adapter could not have been written. It was, so the shape holds.
//
// Maps onto `.claude/rules/interfaces-free-classes-earned-under-rules.md`: the port is the
// interface (free, weight-free, pure shape); each adapter is the earned class.
//
// HONEST SCOPE — this port is NOT OS-portable, and pretending otherwise would be the
// overclaim. Its vocabulary (`domain`, `definitionPath`) is launchd-shaped. The repo
// already HAS the cross-OS port: `IServiceManager` in `service/service-manager.ts`, with
// launchd/systemd/task-scheduler adapters. This port sits one layer BELOW that one and
// makes the launchd adapter's *mechanism* swappable. Two ports, two jobs:
//     IServiceManager      — "manage a persona service"     (cross-OS)
//     ServiceControlPort   — "control a launchd domain"     (launchd, swappable mechanism)
//
// WHAT THE VERSION GUARANTEE ACTUALLY VERIFIES. `launchctl version` self-reports; measured
// on macOS 26.5.2: `Darwin Bootstrapper Version 7.0.0: ...`. The adapter parses the major
// and refuses below `MIN_BOOTSTRAPPER_MAJOR` (2 — the launchd generation that introduced
// the `bootstrap`/`bootout` subcommands this repo uses; the older `load`/`unload` verbs are
// NOT a fallback here). It refuses an UNPARSEABLE version too, rather than proceeding.
// What that proves: the program at the admitted path answers `version` with a string of
// the expected shape and generation. What it does NOT prove: that the program is Apple's
// launchctl. A substituted binary can print any string it likes — the version string is a
// COMPATIBILITY check, not an authenticity check. Authenticity here rests on the absolute
// allowlisted path and its measured SIP `SF_RESTRICTED` flag (see `privilege/system-tool.ts`
// for why that flag is asserted from measurement and not re-verified at run time).
import { spawnSync } from "node:child_process";
import {
  LAUNCHCTL_SPEC,
  resolveSystemTool,
  type ToolIdentity,
  type SystemToolEffects,
} from "../privilege/system-tool";

/** launchd generation that introduced `bootstrap`/`bootout`. Below this we refuse. */
export const MIN_BOOTSTRAPPER_MAJOR = 2;

/** What the port promises about whatever is behind it. */
export interface ServiceControlGuarantee {
  /** Which adapter answered — `"launchctl"`, `"in-memory"`, later `"zeta-native"`. */
  readonly implementation: string;
  /** Self-reported version string, verbatim. */
  readonly version: string;
  /** Parsed major generation, checked against MIN_BOOTSTRAPPER_MAJOR. */
  readonly major: number;
  /** The admitted absolute path, or `null` when the adapter is not backed by a binary. */
  readonly path: string | null;
  /** Observed identity of that binary, or `null` for a non-binary adapter. */
  readonly identity: ToolIdentity | null;
}

export type ServiceOutcome = { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** Three states, never two — `unknown` means the check did not run (cf. runtime-probe.ts). */
export type ServiceDescription =
  | { readonly found: false }
  | { readonly found: true; readonly running: boolean; readonly lastExitCode?: number; readonly launchdState?: string }
  | { readonly found: "unknown"; readonly why: string };

/**
 * The capability, in our terms. No argv, no exit codes, no raw stdout: those are adapter
 * internals, and keeping them out is precisely what makes a non-spawning adapter possible.
 */
export interface ServiceControlPort {
  readonly guarantee: ServiceControlGuarantee;
  /** Install + start a service from its definition file in `domain`. */
  bootstrap(domain: string, definitionPath: string): ServiceOutcome;
  /** Stop + remove. IDEMPOTENT by contract: "not loaded" is `ok:true`, not an error. */
  bootout(domain: string, labelOrDefinition: string): ServiceOutcome;
  /** Facts about one service. */
  describe(domain: string, label: string): ServiceDescription;
  /** Labels known to the domain, or `null` for indeterminate (the check did not run). */
  listLabels(): readonly string[] | null;
}

export type ServiceControlResolution =
  | { readonly ok: true; readonly port: ServiceControlPort }
  | { readonly ok: false; readonly reason: string };

/** The single injected door for the binary adapter. `null` = could not run at all. */
export interface LaunchctlSpawn {
  (absPath: string, args: readonly string[]): { status: number | null; stdout: string; stderr: string } | null;
}

export function realLaunchctlSpawn(): LaunchctlSpawn {
  return (absPath, args) => {
    try {
      const r = spawnSync(absPath, [...args], { encoding: "utf8", timeout: 15000 });
      if (r.error !== undefined && r.error !== null) return null;
      return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
    } catch {
      return null;
    }
  };
}

/** Parse `Darwin Bootstrapper Version 7.0.0: ...` -> 7. `null` when it does not conform. */
export function parseBootstrapperMajor(versionText: string): number | null {
  const m = /Version\s+(\d+)\./.exec(versionText);
  if (m === null) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse `launchctl print` output for the two facts callers actually consume.
 * Moved OFF the call sites and INTO the adapter on purpose: stdout shape is a launchctl
 * detail, and leaving it at the call site is what would have made the port fake.
 */
export function parsePrintOutput(stdout: string): { running: boolean; lastExitCode?: number; launchdState?: string } {
  // `(.+)$` with `m`, NOT `(\S+)`: launchd states are multi-word ("spawn scheduled",
  // "not running"). An earlier draft of this function used `(\S+)` and silently reported
  // "spawn" for "spawn scheduled". The regex below is the one `parseLaunchctlPrint` has
  // been shipping, and the fixtures that caught the bug are in the test file.
  const stateMatch = /^\s*state = (.+)$/m.exec(stdout);
  const exitMatch = /last exit code = (\d+)/.exec(stdout);
  const launchdState = stateMatch?.[1]?.trim();
  const out: { running: boolean; lastExitCode?: number; launchdState?: string } = {
    running: launchdState === "running",
  };
  if (launchdState !== undefined) out.launchdState = launchdState;
  if (exitMatch?.[1] !== undefined) out.lastExitCode = Number(exitMatch[1]);
  return out;
}

/**
 * The binary adapter. FAIL-CLOSED at construction: an unadmitted binary, an unrunnable
 * `version`, an unparseable version string, or a generation below the minimum all return a
 * refusal naming the cause. A caller that gets `ok:false` has NO port and cannot proceed
 * to spawn anything — which is the point.
 */
export function createLaunchctlControl(
  spawn: LaunchctlSpawn = realLaunchctlSpawn(),
  fx?: SystemToolEffects,
  pin?: Partial<ToolIdentity>,
): ServiceControlResolution {
  const admitted = fx === undefined ? resolveSystemTool(LAUNCHCTL_SPEC, undefined, pin) : resolveSystemTool(LAUNCHCTL_SPEC, fx, pin);
  if (!admitted.ok) return { ok: false, reason: admitted.reason };

  const abs = admitted.path;
  const v = spawn(abs, ["version"]);
  if (v === null) return { ok: false, reason: `'${abs} version' could not be run — refusing to use an unverified launchctl` };
  const major = parseBootstrapperMajor(v.stdout + v.stderr);
  if (major === null) {
    return {
      ok: false,
      reason:
        `'${abs} version' returned an unrecognised version string (${JSON.stringify((v.stdout + v.stderr).slice(0, 120))}) — ` +
        "refusing rather than assuming a compatible generation",
    };
  }
  if (major < MIN_BOOTSTRAPPER_MAJOR) {
    return { ok: false, reason: `launchctl generation ${String(major)} is below the required ${String(MIN_BOOTSTRAPPER_MAJOR)} (no bootstrap/bootout subcommands)` };
  }

  const guarantee: ServiceControlGuarantee = {
    implementation: "launchctl",
    version: (v.stdout + v.stderr).trim(),
    major,
    path: abs,
    identity: admitted.identity,
  };

  const port: ServiceControlPort = {
    guarantee,
    bootstrap(domain, definitionPath) {
      const r = spawn(abs, ["bootstrap", domain, definitionPath]);
      if (r === null) return { ok: false, reason: "launchctl bootstrap could not be run" };
      if (r.status !== 0) return { ok: false, reason: `launchctl bootstrap failed (status ${String(r.status)}): ${r.stderr.trim()}` };
      return { ok: true };
    },
    bootout(domain, labelOrDefinition) {
      const target = labelOrDefinition.startsWith("/") ? [domain, labelOrDefinition] : [`${domain}/${labelOrDefinition}`];
      const r = spawn(abs, ["bootout", ...target]);
      // Idempotent by contract: a service that was not loaded is a successful uninstall.
      if (r === null) return { ok: false, reason: "launchctl bootout could not be run" };
      return { ok: true };
    },
    describe(domain, label) {
      const r = spawn(abs, ["print", `${domain}/${label}`]);
      if (r === null) return { found: "unknown", why: "launchctl print could not be run" };
      if (r.status !== 0) return { found: false };
      return { found: true, ...parsePrintOutput(r.stdout) };
    },
    listLabels() {
      const r = spawn(abs, ["list"]);
      if (r === null || r.status !== 0) return null;
      return r.stdout
        .split("\n")
        .map((l) => l.split("\t").pop() ?? "")
        .filter((l) => l.length > 0 && l !== "Label");
    },
  };
  return { ok: true, port };
}

/** State an in-memory adapter holds. Exported so tests can seed and inspect it. */
export interface InMemoryService {
  readonly label: string;
  running: boolean;
  lastExitCode?: number;
}

/**
 * THE SECOND ADAPTER — the falsifier for "is this actually a port?".
 *
 * It implements the full contract with no subprocess, no launchctl and no filesystem. It
 * is not a mock of the first adapter: it shares no code path with it and reaches nothing
 * outside this object. That it can exist at all is the evidence that the interface
 * describes a CAPABILITY rather than a way of invoking a binary — and it is the shape a
 * future native implementation would take.
 */
export function inMemoryServiceControl(seed: readonly InMemoryService[] = []): ServiceControlPort {
  const services = new Map<string, InMemoryService>();
  for (const s of seed) services.set(`${s.label}`, { ...s });
  return {
    guarantee: {
      implementation: "in-memory",
      version: "zeta-in-memory-1",
      major: MIN_BOOTSTRAPPER_MAJOR,
      path: null,
      identity: null,
    },
    bootstrap(_domain, definitionPath) {
      const label = definitionPath.split("/").pop()?.replace(/\.plist$/, "") ?? "";
      if (label.length === 0) return { ok: false, reason: `cannot derive a label from '${definitionPath}'` };
      if (services.has(label)) return { ok: false, reason: `service '${label}' is already bootstrapped` };
      services.set(label, { label, running: true });
      return { ok: true };
    },
    bootout(_domain, labelOrDefinition) {
      const label = labelOrDefinition.startsWith("/")
        ? (labelOrDefinition.split("/").pop() ?? "").replace(/\.plist$/, "")
        : labelOrDefinition;
      services.delete(label);
      return { ok: true };
    },
    describe(_domain, label) {
      const s = services.get(label);
      if (s === undefined) return { found: false };
      const d: ServiceDescription = {
        found: true,
        running: s.running,
        ...(s.lastExitCode === undefined ? {} : { lastExitCode: s.lastExitCode }),
        launchdState: s.running ? "running" : "not running",
      };
      return d;
    },
    listLabels() {
      return [...services.keys()];
    },
  };
}
