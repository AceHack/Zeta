#!/usr/bin/env bun
/**
 * src/Core.TypeScript/installer/host-capability-vector.ts
 *
 * Workitem 081M0X0C932087G0R001SWQQVQ. Emits the MEASURED host capability
 * vector alongside the tier the existing enum chose, as one JSON artifact.
 *
 * WHY THIS EXISTS (Aaron 2026-08-25): "eventually we want tiers of optional
 * features that can coexist/compose with each other in higher layers" /
 * "in a perfect world i imagine some matrix for cpus, memory, solid state, and
 * rotational disk and picking the right dependence to install based on those
 * results". The shipped design is a TIER ENUM (slim|standard|full), which is a
 * TOTAL ORDER: it cannot express "rotational disk but 128GB RAM", and two tiers
 * do not compose. The capability VECTOR is the shape that can. The full
 * redesign is blocked on hardware that is not installed yet, so this file does
 * the unblocked half.
 *
 * SCOPE — MEASUREMENT ONLY. This module changes NO install behaviour. The tier
 * enum still decides every package, unchanged. What this adds is the RECORD of
 * the pair (measured vector, chosen tier), so that a later design can check
 * whether the tier was a function of the hardware or a guess. Today nothing
 * reads the artifact but a human and the tests; that is stated rather than
 * dressed up.
 *
 * NO TIMESTAMP, ON PURPOSE. The artifact is a pure function of (hardware, env),
 * so emitting it N times produces byte-identical output (discipline #6,
 * idempotency). A wall-clock field would make two emissions on one unchanged
 * host differ, which destroys exactly the byte-comparability that makes the
 * tier checkable. Provenance of *when* belongs to whatever records the file,
 * not to the measurement.
 *
 * NO SERIAL NUMBERS / UUIDS. Device serials are host-identifying and are not
 * needed to decide what to install.
 *
 * VERIFICATION STATUS (be exact — an unrun emitter is the vacuity class):
 *   - darwin/arm64: RUN on the maintainer's host 2026-08-25. The rotational
 *     branch is exercised by real `diskutil` output for two physical disks.
 *   - linux: NOT RUN. The `/sys/block/<dev>/queue/rotational` reader is covered
 *     by unit tests over fixture strings only. No Linux host executed it. Its
 *     sysfs contract is documented by the kernel (Documentation/ABI/stable/
 *     sysfs-block: 1 = rotational, 0 = non-rotational) but documentation is not
 *     a measurement, and this comment does not claim it is.
 *   - win32/other: UNSUPPORTED. Block devices come back as an empty list with
 *     the reason recorded in `unmeasured`, never as a silent zero.
 *
 * USAGE:
 *   bun src/Core.TypeScript/installer/host-capability-vector.ts            # write default path
 *   bun src/Core.TypeScript/installer/host-capability-vector.ts --stdout   # print, write nothing
 *   bun src/Core.TypeScript/installer/host-capability-vector.ts --out FILE
 *
 * EXIT CODES: 0 ok · 2 arg parse error.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { arch, cpus, platform } from "node:os";

import { resolveHostTier, type HostTierContext } from "../ace/setup-realizers/host-tier.ts";

export const CAPABILITY_VECTOR_SCHEMA = "zeta.host-capability-vector/v1";

/**
 * Three-state, and the third state is the point.
 *
 * `null` means NOT DETERMINABLE on this host — it is never a synonym for
 * `true`. Measured live 2026-08-25: an internal Apple SSD reports
 * `SolidState = <true/>`, while a USB flash drive on the same machine OMITS the
 * `SolidState` key entirely. An implementation that computed `rotational =
 * !info.SolidState` would have reported that USB flash drive as ROTATIONAL,
 * which is false. Absence of evidence is recorded as absence of evidence.
 */
export type Rotational = boolean | null;

export interface BlockDeviceCapability {
  readonly name: string;
  readonly rotational: Rotational;
  /** The exact observation that decided `rotational`. A verdict with no control is decoration. */
  readonly rotationalEvidence: string;
  readonly sizeBytes: number | null;
}

export interface HostCapabilityVector {
  readonly schema: typeof CAPABILITY_VECTOR_SCHEMA;
  readonly platform: string;
  readonly cpu: {
    readonly logicalCount: number;
    readonly arch: string;
  };
  readonly memory: {
    readonly totalBytes: number;
    readonly source: string;
  };
  readonly blockDevices: readonly BlockDeviceCapability[];
  /** The enum's verdict, recorded BESIDE the measurement it is supposed to follow from. */
  readonly tier: {
    readonly tier: HostTierContext["tier"];
    readonly rank: number;
    readonly source: HostTierContext["source"];
  };
  /**
   * Named gaps. The meter's product is the measured/unmeasured PARTITION, not
   * just the numbers — a quantity we did not measure must never look like one
   * we did.
   */
  readonly unmeasured: readonly string[];
}

// ── Linux ────────────────────────────────────────────────────────────────────

/**
 * Read one `/sys/block/<dev>/queue/rotational` value.
 * "1" => rotational, "0" => not. Anything else is UNKNOWN, not a default.
 *
 * NOT EXERCISED ON A REAL LINUX HOST — fixture-tested only. See VERIFICATION
 * STATUS in the module header.
 */
export function parseLinuxRotational(raw: string | null): {
  readonly rotational: Rotational;
  readonly evidence: string;
} {
  if (raw === null) {
    return { rotational: null, evidence: "linux:/sys/block/*/queue/rotational unreadable" };
  }
  const trimmed = raw.trim();
  if (trimmed === "1") {
    return { rotational: true, evidence: "linux:/sys/block/*/queue/rotational=1" };
  }
  if (trimmed === "0") {
    return { rotational: false, evidence: "linux:/sys/block/*/queue/rotational=0" };
  }
  return {
    rotational: null,
    evidence: `linux:/sys/block/*/queue/rotational unparsable (${JSON.stringify(trimmed)})`,
  };
}

// ── Darwin ───────────────────────────────────────────────────────────────────

/**
 * Whole physical disks from `diskutil list -plist physical` converted to JSON.
 * The `physical` filter is what excludes synthesized APFS containers and
 * mounted disk images; `WholeDisks` is what excludes partitions.
 */
export function parseDarwinWholeDisks(listJson: string): readonly string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(listJson);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const whole = (parsed as { WholeDisks?: unknown }).WholeDisks;
  if (!Array.isArray(whole)) return [];
  return whole.filter((d): d is string => typeof d === "string");
}

/**
 * Decide rotational for one disk from `diskutil info -plist <disk>` as JSON.
 *
 * The discriminator is KEY PRESENCE, not truthiness. Verified on this host:
 *   disk0 -> `<key>SolidState</key><true/>`  (present, true)
 *   disk6 -> key absent entirely             (a USB flash drive; NOT rotational)
 */
export function parseDarwinRotational(infoJson: string): {
  readonly rotational: Rotational;
  readonly evidence: string;
  readonly sizeBytes: number | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(infoJson);
  } catch {
    return {
      rotational: null,
      evidence: "darwin:diskutil info -plist unparsable",
      sizeBytes: null,
    };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return {
      rotational: null,
      evidence: "darwin:diskutil info -plist not an object",
      sizeBytes: null,
    };
  }
  const info = parsed as { SolidState?: unknown; Size?: unknown };
  const sizeBytes = typeof info.Size === "number" ? info.Size : null;

  if (!("SolidState" in info)) {
    return {
      rotational: null,
      evidence: "darwin:diskutil info SolidState key absent (undetermined, NOT rotational)",
      sizeBytes,
    };
  }
  if (typeof info.SolidState !== "boolean") {
    return {
      rotational: null,
      evidence: `darwin:diskutil info SolidState non-boolean (${JSON.stringify(info.SolidState)})`,
      sizeBytes,
    };
  }
  return {
    rotational: !info.SolidState,
    evidence: `darwin:diskutil info SolidState=${String(info.SolidState)}`,
    sizeBytes,
  };
}

// ── Memory ───────────────────────────────────────────────────────────────────

/** MemTotal (kB) from /proc/meminfo, as bytes. 0 when absent — the caller records that. */
export function parseProcMeminfoTotalBytes(procMeminfo: string): number {
  const m = procMeminfo.match(/^MemTotal:\s+(\d+)\s+kB/m);
  const kb = m?.[1];
  if (kb === undefined) return 0;
  return Number.parseInt(kb, 10) * 1024;
}

// ── Assembly (the pure, testable seam) ───────────────────────────────────────

export interface CapabilityInputs {
  readonly platform: string;
  readonly arch: string;
  readonly logicalCpuCount: number;
  readonly memoryTotalBytes: number;
  readonly memorySource: string;
  readonly blockDevices: readonly BlockDeviceCapability[];
  readonly tier: HostTierContext;
  readonly unmeasured: readonly string[];
}

export function buildCapabilityVector(inputs: CapabilityInputs): HostCapabilityVector {
  return {
    schema: CAPABILITY_VECTOR_SCHEMA,
    platform: inputs.platform,
    cpu: { logicalCount: inputs.logicalCpuCount, arch: inputs.arch },
    memory: { totalBytes: inputs.memoryTotalBytes, source: inputs.memorySource },
    // Ordinal sort: the artifact must be byte-stable across emissions, and
    // device enumeration order is not guaranteed to be.
    blockDevices: [...inputs.blockDevices].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    tier: { tier: inputs.tier.tier, rank: inputs.tier.rank, source: inputs.tier.source },
    unmeasured: [...inputs.unmeasured].sort(),
  };
}

/** Canonical text form. JSON, never a binary (.claude/rules/no-binary-in-proof-lineage.md). */
export function renderCapabilityVector(vector: HostCapabilityVector): string {
  return JSON.stringify(vector, null, 2) + "\n";
}

// ── Live gathering (the I/O half) ────────────────────────────────────────────

function runCapture(cmd: string, args: readonly string[], input?: string): string | null {
  try {
    return execFileSync(cmd, [...args], {
      encoding: "utf8",
      ...(input === undefined ? {} : { input }),
      stdio: ["pipe", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function plistToJson(plist: string): string | null {
  return runCapture("plutil", ["-convert", "json", "-o", "-", "-"], plist);
}

function gatherDarwinBlockDevices(unmeasured: string[]): BlockDeviceCapability[] {
  const listPlist = runCapture("diskutil", ["list", "-plist", "physical"]);
  if (listPlist === null) {
    unmeasured.push("block-devices: `diskutil list -plist physical` failed or absent");
    return [];
  }
  const listJson = plistToJson(listPlist);
  if (listJson === null) {
    unmeasured.push("block-devices: `plutil -convert json` failed on diskutil list output");
    return [];
  }
  const devices: BlockDeviceCapability[] = [];
  for (const name of parseDarwinWholeDisks(listJson)) {
    const infoPlist = runCapture("diskutil", ["info", "-plist", name]);
    const infoJson = infoPlist === null ? null : plistToJson(infoPlist);
    if (infoJson === null) {
      devices.push({
        name,
        rotational: null,
        rotationalEvidence: "darwin:diskutil info -plist failed for this device",
        sizeBytes: null,
      });
      continue;
    }
    const { rotational, evidence, sizeBytes } = parseDarwinRotational(infoJson);
    devices.push({ name, rotational, rotationalEvidence: evidence, sizeBytes });
  }
  return devices;
}

function gatherLinuxBlockDevices(unmeasured: string[]): BlockDeviceCapability[] {
  unmeasured.push(
    "block-devices(linux): this code path has NEVER been executed on a Linux host; fixture-tested only",
  );
  let names: readonly string[] = [];
  try {
    // `readdirSync` is imported lazily so the darwin path never touches it.
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    names = readdirSync("/sys/block");
  } catch {
    unmeasured.push("block-devices(linux): /sys/block unreadable");
    return [];
  }
  const devices: BlockDeviceCapability[] = [];
  for (const name of names) {
    let raw: string | null = null;
    try {
      raw = readFileSync(`/sys/block/${name}/queue/rotational`, "utf8");
    } catch {
      raw = null;
    }
    const { rotational, evidence } = parseLinuxRotational(raw);
    let sizeBytes: number | null = null;
    try {
      // sysfs `size` is in 512-byte sectors, always, regardless of logical block size.
      sizeBytes = Number.parseInt(readFileSync(`/sys/block/${name}/size`, "utf8").trim(), 10) * 512;
    } catch {
      sizeBytes = null;
    }
    devices.push({ name, rotational, rotationalEvidence: evidence, sizeBytes });
  }
  return devices;
}

export function gatherCapabilityVector(env: NodeJS.ProcessEnv = process.env): HostCapabilityVector {
  const unmeasured: string[] = [];
  const plat = platform();

  let memoryTotalBytes = 0;
  let memorySource = "";
  if (plat === "darwin") {
    const out = runCapture("sysctl", ["-n", "hw.memsize"]);
    memoryTotalBytes = out === null ? 0 : Number.parseInt(out.trim(), 10) || 0;
    memorySource = "darwin:sysctl -n hw.memsize";
  } else if (plat === "linux") {
    let meminfo = "";
    try {
      meminfo = readFileSync("/proc/meminfo", "utf8");
    } catch {
      meminfo = "";
    }
    memoryTotalBytes = parseProcMeminfoTotalBytes(meminfo);
    memorySource = "linux:/proc/meminfo MemTotal";
  } else {
    memorySource = `unsupported-platform:${plat}`;
  }
  if (memoryTotalBytes === 0) {
    unmeasured.push(`memory: total bytes not determined via ${memorySource}`);
  }

  let blockDevices: BlockDeviceCapability[] = [];
  if (plat === "darwin") {
    blockDevices = gatherDarwinBlockDevices(unmeasured);
  } else if (plat === "linux") {
    blockDevices = gatherLinuxBlockDevices(unmeasured);
  } else {
    unmeasured.push(`block-devices: no probe implemented for platform ${plat}`);
  }

  // Honest limits on the CPU count, named rather than implied away.
  unmeasured.push("cpu: cgroup/container CPU quota not measured (logicalCount is host-visible CPUs)");
  unmeasured.push("cpu: core frequency, cache sizes, and performance/efficiency core split not measured");
  unmeasured.push("gpu: not probed by this emitter");

  return buildCapabilityVector({
    platform: plat,
    arch: arch(),
    logicalCpuCount: cpus().length,
    memoryTotalBytes,
    memorySource,
    blockDevices,
    tier: resolveTierWithReportedSource(env),
    unmeasured,
  });
}

/**
 * Resolve the tier, but let an ALREADY-RESOLVED source win.
 *
 * Caught by a control 2026-08-25, and it is not cosmetic. `host-tier.sh`
 * `export`s ZETA_HOST_TIER **before** it invokes this emitter, so a naive
 * `resolveHostTier(process.env)` in the child sees a set variable and records
 * `source: "declared"` for a tier the shell had just AUTO-DETECTED. The artifact
 * would then assert that an operator chose the tier when nobody did — which
 * destroys the one provenance fact the artifact exists to carry, since
 * "was this tier a function of the hardware, or a human's assertion?" is
 * precisely the question a later capability-vector design has to answer.
 *
 * So when the caller has already resolved the tier it passes its own verdict
 * down in ZETA_HOST_TIER_SOURCE, and that verdict wins over re-inference.
 * Anything other than the two known values is ignored rather than trusted.
 */
export function resolveTierWithReportedSource(env: NodeJS.ProcessEnv): HostTierContext {
  const resolved = resolveHostTier(env);
  const reported = env.ZETA_HOST_TIER_SOURCE;
  if (reported === "detected" || reported === "declared") {
    return { ...resolved, source: reported };
  }
  return resolved;
}

export const DEFAULT_OUT_PATH = ".zeta/host-capability-vector.json";

interface Args {
  readonly mode: "write" | "stdout" | "help";
  readonly out: string;
  readonly error?: string;
}

export function parseArgs(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Args {
  let mode: Args["mode"] = "write";
  let out = env.ZETA_CAPABILITY_VECTOR_OUT ?? DEFAULT_OUT_PATH;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--stdout") mode = "stdout";
    else if (a === "--help" || a === "-h") mode = "help";
    else if (a === "--out") {
      const next = argv[i + 1];
      if (next === undefined) return { mode, out, error: "--out requires a path" };
      out = next;
      i++;
    } else return { mode, out, error: `unknown arg: ${String(a)}` };
  }
  return { mode, out };
}

function main(): number {
  const args = parseArgs(Bun.argv.slice(2));
  if (args.error !== undefined) {
    process.stderr.write(args.error + "\n");
    return 2;
  }
  if (args.mode === "help") {
    process.stdout.write(
      "Usage: bun src/Core.TypeScript/installer/host-capability-vector.ts [--stdout | --out FILE]\n",
    );
    return 0;
  }
  const text = renderCapabilityVector(gatherCapabilityVector());
  if (args.mode === "stdout") {
    process.stdout.write(text);
    return 0;
  }
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, text, "utf8");
  process.stderr.write(`→ host capability vector recorded: ${args.out} (measurement only; installs unchanged)\n`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
