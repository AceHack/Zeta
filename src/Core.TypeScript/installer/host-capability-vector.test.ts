import { describe, expect, test } from "bun:test";
import { platform } from "node:os";

import {
  CAPABILITY_VECTOR_SCHEMA,
  buildCapabilityVector,
  gatherCapabilityVector,
  parseArgs,
  parseDarwinRotational,
  parseDarwinWholeDisks,
  parseLinuxRotational,
  parseProcMeminfoTotalBytes,
  renderCapabilityVector,
  resolveTierWithReportedSource,
  type BlockDeviceCapability,
} from "./host-capability-vector.ts";
import { resolveHostTier } from "../ace/setup-realizers/host-tier.ts";

// Captured VERBATIM from this host on 2026-08-25 via
//   diskutil info -plist disk0 | plutil -convert json -o - -
// trimmed to the keys under test. disk0 is the internal Apple SSD.
const DARWIN_INFO_SSD = JSON.stringify({
  DeviceIdentifier: "disk0",
  SolidState: true,
  Size: 8004444651520,
  BusProtocol: "Apple Fabric",
});

// Captured VERBATIM from the same host, same command, for disk6 — a USB flash
// drive. NOTE WHAT IS MISSING: there is no `SolidState` key at all. This is the
// fixture the whole three-state design exists for.
const DARWIN_INFO_NO_SOLIDSTATE_KEY = JSON.stringify({
  DeviceIdentifier: "disk6",
  Size: 123979431936,
  BusProtocol: "USB",
  Internal: false,
});

const DARWIN_INFO_SPINNING = JSON.stringify({
  DeviceIdentifier: "disk9",
  SolidState: false,
  Size: 2000398934016,
});

const DARWIN_LIST = JSON.stringify({
  AllDisks: ["disk0", "disk0s1", "disk0s2", "disk6", "disk6s2"],
  WholeDisks: ["disk0", "disk6"],
});

function device(name: string): BlockDeviceCapability {
  return { name, rotational: null, rotationalEvidence: "test", sizeBytes: null };
}

describe("darwin rotational — absence is not rotation", () => {
  test("MISSING SolidState key yields null, NEVER true", () => {
    // The bug this forbids: `rotational = !info.SolidState` reports a USB flash
    // drive as rotational. Verified live 2026-08-25 that disk6 omits the key.
    const r = parseDarwinRotational(DARWIN_INFO_NO_SOLIDSTATE_KEY);
    expect(r.rotational).toBeNull();
    expect(r.rotational).not.toBe(true);
    expect(r.evidence).toContain("absent");
    expect(r.sizeBytes).toBe(123979431936);
  });

  test("SolidState=true yields rotational=false with the deciding evidence", () => {
    const r = parseDarwinRotational(DARWIN_INFO_SSD);
    expect(r.rotational).toBe(false);
    expect(r.evidence).toBe("darwin:diskutil info SolidState=true");
    expect(r.sizeBytes).toBe(8004444651520);
  });

  test("SolidState=false yields rotational=true (polarity is not accidental)", () => {
    const r = parseDarwinRotational(DARWIN_INFO_SPINNING);
    expect(r.rotational).toBe(true);
    expect(r.evidence).toBe("darwin:diskutil info SolidState=false");
  });

  test("unparsable input yields null, not a guess", () => {
    expect(parseDarwinRotational("not json").rotational).toBeNull();
    expect(parseDarwinRotational("null").rotational).toBeNull();
  });

  test("non-boolean SolidState yields null, not coercion", () => {
    const r = parseDarwinRotational(JSON.stringify({ SolidState: "yes" }));
    expect(r.rotational).toBeNull();
    expect(r.evidence).toContain("non-boolean");
  });
});

describe("darwin whole-disk enumeration", () => {
  test("takes WholeDisks and therefore excludes partitions", () => {
    const disks = parseDarwinWholeDisks(DARWIN_LIST);
    expect(disks).toEqual(["disk0", "disk6"]);
    expect(disks).not.toContain("disk0s1");
    expect(disks).not.toContain("disk6s2");
  });

  test("malformed input yields an empty list, never a throw", () => {
    expect(parseDarwinWholeDisks("{{{")).toEqual([]);
    expect(parseDarwinWholeDisks(JSON.stringify({ WholeDisks: "disk0" }))).toEqual([]);
    expect(parseDarwinWholeDisks(JSON.stringify({}))).toEqual([]);
  });
});

describe("linux rotational (FIXTURE-TESTED ONLY — never run on a Linux host)", () => {
  test("sysfs 1 is rotational, 0 is not", () => {
    expect(parseLinuxRotational("1\n").rotational).toBe(true);
    expect(parseLinuxRotational("0\n").rotational).toBe(false);
  });

  test("unreadable and unparsable both yield null", () => {
    expect(parseLinuxRotational(null).rotational).toBeNull();
    expect(parseLinuxRotational("maybe").rotational).toBeNull();
    expect(parseLinuxRotational("").rotational).toBeNull();
  });

  test("evidence names the file that decided it", () => {
    expect(parseLinuxRotational("1").evidence).toContain("/sys/block");
    expect(parseLinuxRotational("1").evidence).toContain("=1");
  });
});

describe("memory parse", () => {
  test("MemTotal kB becomes bytes", () => {
    expect(parseProcMeminfoTotalBytes("MemTotal:       16302344 kB\nMemFree: 1 kB\n")).toBe(
      16302344 * 1024,
    );
  });
  test("absent MemTotal is 0 (the caller records it as unmeasured)", () => {
    expect(parseProcMeminfoTotalBytes("MemFree: 1 kB\n")).toBe(0);
  });
});

describe("vector assembly", () => {
  const base = {
    platform: "linux",
    arch: "x86_64",
    logicalCpuCount: 8,
    memoryTotalBytes: 1024,
    memorySource: "test",
    tier: resolveHostTier({ ZETA_HOST_TIER: "standard" }),
    unmeasured: ["z-gap", "a-gap"],
  };

  test("block devices are sorted so two emissions are byte-identical", () => {
    const v = buildCapabilityVector({
      ...base,
      blockDevices: [device("sdb"), device("nvme0n1"), device("sda")],
    });
    expect(v.blockDevices.map((d) => d.name)).toEqual(["nvme0n1", "sda", "sdb"]);
  });

  test("unmeasured gaps are sorted and preserved, never dropped", () => {
    const v = buildCapabilityVector({ ...base, blockDevices: [] });
    expect(v.unmeasured).toEqual(["a-gap", "z-gap"]);
  });

  test("the chosen tier is carried BESIDE the measurement", () => {
    const v = buildCapabilityVector({ ...base, blockDevices: [] });
    expect(v.tier).toEqual({ tier: "standard", rank: 1, source: "declared" });
  });

  test("render is JSON text that round-trips", () => {
    const v = buildCapabilityVector({ ...base, blockDevices: [device("sda")] });
    const text = renderCapabilityVector(v);
    expect(text.endsWith("\n")).toBe(true);
    expect(JSON.parse(text)).toEqual(v);
    expect(JSON.parse(text).schema).toBe(CAPABILITY_VECTOR_SCHEMA);
  });

  test("NO wall-clock field — a timestamp would break byte-idempotency", () => {
    const v = buildCapabilityVector({ ...base, blockDevices: [] });
    const text = renderCapabilityVector(v);
    for (const forbidden of ["timestamp", "emittedAt", "generatedAt", "date", "Serial", "serial"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("tier provenance — a detected tier must never be recorded as declared", () => {
  test("an explicitly reported source wins over re-inference from an exported var", () => {
    // host-tier.sh exports ZETA_HOST_TIER before invoking the emitter, so the
    // child would otherwise infer "declared" for an auto-DETECTED tier.
    const v = gatherCapabilityVector({
      ZETA_HOST_TIER: "full",
      ZETA_HOST_TIER_SOURCE: "detected",
    });
    expect(v.tier.tier).toBe("full");
    expect(v.tier.source).toBe("detected");
  });

  test("without a reported source, an exported tier IS a declaration", () => {
    const v = gatherCapabilityVector({ ZETA_HOST_TIER: "slim" });
    expect(v.tier.source).toBe("declared");
    expect(v.tier.tier).toBe("slim");
  });

  test("a junk reported source is ignored, not trusted", () => {
    const v = resolveTierWithReportedSource({
      ZETA_HOST_TIER: "standard",
      ZETA_HOST_TIER_SOURCE: "vibes",
    });
    expect(v.source).toBe("declared");
  });
});

describe("arg parsing", () => {
  test("defaults to writing the default path", () => {
    const a = parseArgs([], {});
    expect(a.mode).toBe("write");
    expect(a.out).toBe(".zeta/host-capability-vector.json");
  });
  test("--stdout writes nothing to disk", () => {
    expect(parseArgs(["--stdout"], {}).mode).toBe("stdout");
  });
  test("--out consumes its operand", () => {
    expect(parseArgs(["--out", "/x/y.json"], {}).out).toBe("/x/y.json");
    expect(parseArgs(["--out"], {}).error).toBeDefined();
  });
  test("unknown arg is an error, not a silent ignore", () => {
    expect(parseArgs(["--rotational"], {}).error).toContain("unknown arg");
  });
  test("env override supplies the default path", () => {
    expect(parseArgs([], { ZETA_CAPABILITY_VECTOR_OUT: "/e.json" }).out).toBe("/e.json");
  });
});

describe("live gather", () => {
  test("emits a coherent vector on the host actually running the test", () => {
    const v = gatherCapabilityVector({});
    expect(v.schema).toBe(CAPABILITY_VECTOR_SCHEMA);
    expect(v.platform).toBe(platform());
    expect(v.cpu.logicalCount).toBeGreaterThan(0);
    // The pair must agree with the enum that actually drives installs.
    expect(v.tier.tier).toBe(resolveHostTier({}).tier);
    // Every gap is NAMED; an empty-string gap is a gap pretending not to exist.
    for (const gap of v.unmeasured) expect(gap.length).toBeGreaterThan(0);
  });

  test("is byte-idempotent: two gathers render identically", () => {
    expect(renderCapabilityVector(gatherCapabilityVector({}))).toBe(
      renderCapabilityVector(gatherCapabilityVector({})),
    );
  });

  test.skipIf(platform() !== "darwin")(
    "darwin: finds at least one physical disk and every verdict carries evidence",
    () => {
      const v = gatherCapabilityVector({});
      expect(v.blockDevices.length).toBeGreaterThan(0);
      expect(v.memory.totalBytes).toBeGreaterThan(0);
      for (const d of v.blockDevices) {
        expect(d.name).toMatch(/^disk\d+$/);
        expect(d.rotationalEvidence.length).toBeGreaterThan(0);
        expect(d.rotationalEvidence).toContain("darwin:");
        expect([true, false, null]).toContain(d.rotational);
      }
    },
  );
});
