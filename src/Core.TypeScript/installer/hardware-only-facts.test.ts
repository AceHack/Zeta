// hardware-only-facts.test.ts — the falsifiers.
//
// The property this module lives or dies on is that **absent and false are different answers**. A
// probe that reports `no` when it could not look is worse than one that reports nothing: it turns
// "we never checked whether this box has a TPM" into "this box has no TPM", and the second is a
// claim someone will act on. Every branch below fixes one of the two and checks the other did not
// leak into it.
//
// The second property is that §5.3 stays unmeasured. It is the one row in the doc that no syscall
// answers, and the temptation to fill it with an uptime heuristic is exactly what the
// measured/unmeasured partition exists to resist.

import { describe, expect, test } from "bun:test";
import {
  findEfiVar,
  gatherHardwareOnlyFacts,
  parseEfiBooleanVar,
  parseSpeed,
  parseSysfsFlag,
  renderHardwareOnlyFacts,
  type HardwareProbe,
} from "./hardware-only-facts.ts";

/** A probe over a plain map. Absent key => absent path. */
function probeOf(files: Record<string, string>, dirs: Record<string, readonly string[]>): HardwareProbe {
  return {
    read: (p) => files[p] ?? null,
    list: (p) => dirs[p] ?? null,
    exists: (p) => p in files || p in dirs,
  };
}

const LINUX_BOX = (): HardwareProbe =>
  probeOf(
    {
      "/sys/class/net/eth0/carrier": "1\n",
      "/sys/class/net/eth0/speed": "1000\n",
      "/sys/class/net/eth1/carrier": "0\n",
      "/sys/class/net/eth1/speed": "-1\n",
      "/sys/block/nvme0n1/removable": "0\n",
      "/sys/block/sda/removable": "1\n",
      // Note the four attribute bytes before the value — the fifth byte is the answer.
      "/sys/firmware/efi/efivars/SecureBoot-abc": "\u0006\u0000\u0000\u0000\u0001",
      "/sys/firmware/efi/efivars/SetupMode-abc": "\u0006\u0000\u0000\u0000\u0000",
      "/sys/class/tpm/tpm0/tpm_version_major": "2\n",
    },
    {
      "/sys/class/net": ["lo", "eth0", "eth1"],
      "/sys/block": ["nvme0n1", "sda"],
      "/dev": ["null", "ttyS0", "ttyS1", "sda"],
      "/sys/firmware/efi/efivars": ["SecureBoot-abc", "SetupMode-abc"],
      "/sys/class/tpm": ["tpm0"],
    },
  );

describe("EFI variables: the answer is the FIFTH byte", () => {
  test("a 4-byte attribute prefix precedes the value", () => {
    // Reading byte 0 returns the ATTRIBUTES (commonly 6) and looks like a plausible answer. This is
    // the single easiest way to get Secure Boot state confidently wrong.
    expect(parseEfiBooleanVar("\u0006\u0000\u0000\u0000\u0001")).toBe("yes");
    expect(parseEfiBooleanVar("\u0006\u0000\u0000\u0000\u0000")).toBe("no");
  });

  test("a truncated or absent variable is `unknown`, never `no`", () => {
    expect(parseEfiBooleanVar(null)).toBe("unknown");
    expect(parseEfiBooleanVar("\u0006\u0000\u0000")).toBe("unknown");
  });

  test("an unexpected value byte is `unknown` rather than coerced", () => {
    expect(parseEfiBooleanVar("\u0006\u0000\u0000\u0000\u0007")).toBe("unknown");
  });

  test("the GUID suffix is matched by prefix, and a near-name does not match", () => {
    expect(findEfiVar(["SecureBoot-8be4df61"], "SecureBoot")).toBe("SecureBoot-8be4df61");
    // `SecureBootEnable` is a DIFFERENT variable; requiring the dash stops it matching.
    expect(findEfiVar(["SecureBootEnable-8be4"], "SecureBoot")).toBeNull();
    expect(findEfiVar(null, "SecureBoot")).toBeNull();
  });
});

describe("absent and false are different answers", () => {
  test("a host with no sysfs reports `unknown` everywhere, never `no`", () => {
    const facts = gatherHardwareOnlyFacts(probeOf({}, {}));
    expect(facts.tpm.present).toBe("unknown");
    expect(facts.secureBoot.enabled).toBe("unknown");
    expect(facts.secureBoot.setupMode).toBe("unknown");
    expect(facts.serialConsole.present).toBe("unknown");
    expect(facts.nics).toEqual([]);
  });

  test("each absence is NAMED in `unmeasured`, so a gap is visible rather than inferred", () => {
    const u = gatherHardwareOnlyFacts(probeOf({}, {})).unmeasured.join("\n");
    expect(u).toMatch(/nics: .*absent/);
    expect(u).toMatch(/removable-disks: .*absent/);
    expect(u).toMatch(/secure-boot: efivarfs absent/);
    expect(u).toMatch(/tpm: .*absent/);
  });

  test("a host WITH /sys/class/tpm but no tpm device reports `no` — a real negative", () => {
    const facts = gatherHardwareOnlyFacts(probeOf({}, { "/sys/class/tpm": [] }));
    expect(facts.tpm.present).toBe("no");
    expect(facts.unmeasured.join("\n")).not.toMatch(/tpm: /);
  });

  test("`no serial device` is a fact, not an error — §5.2 says so explicitly", () => {
    const facts = gatherHardwareOnlyFacts(probeOf({}, { "/dev": ["null", "sda"] }));
    expect(facts.serialConsole.present).toBe("no");
    expect(facts.serialConsole.devices).toEqual([]);
  });
});

describe("§5.3 stays unmeasured, permanently", () => {
  test("power-loss durability is listed with its reason on a FULLY probed host", () => {
    // The point: even when everything else answered, this row is still empty. If a future edit
    // makes it disappear on a well-equipped machine, this fails.
    const facts = gatherHardwareOnlyFacts(LINUX_BOX());
    const row = facts.unmeasured.find((u) => u.startsWith("disk-durability-under-power-loss"));
    expect(row).toBeDefined();
    expect(row).toMatch(/no syscall reports whether the drive honoured the flush/);
  });

  test("switch behaviour is separately unmeasured even though link state was read", () => {
    const facts = gatherHardwareOnlyFacts(LINUX_BOX());
    expect(facts.nics.find((n) => n.name === "eth0")?.carrier).toBe("yes");
    expect(facts.unmeasured.join("\n")).toMatch(/nic-switch-behaviour/);
  });
});

describe("a fully-equipped Linux box, read end to end", () => {
  const facts = gatherHardwareOnlyFacts(LINUX_BOX());

  test("loopback is excluded and the rest are sorted", () => {
    expect(facts.nics.map((n) => n.name)).toEqual(["eth0", "eth1"]);
  });

  test("`-1` speed on a down link is null, NOT a measured zero", () => {
    // sysfs reports -1 for "no link". Coercing that to 0 would read as a measured speed of zero.
    expect(facts.nics.find((n) => n.name === "eth1")?.speedMbps).toBeNull();
    expect(facts.nics.find((n) => n.name === "eth0")?.speedMbps).toBe(1000);
  });

  test("removable discriminates USB from internal — §5.4", () => {
    expect(facts.removableDisks).toEqual([
      { name: "nvme0n1", removable: "no" },
      { name: "sda", removable: "yes" },
    ]);
  });

  test("secure boot ON with setup mode OFF is the enrolled state", () => {
    expect(facts.secureBoot.enabled).toBe("yes");
    expect(facts.secureBoot.setupMode).toBe("no");
  });

  test("TPM present with its major version", () => {
    expect(facts.tpm).toEqual({ present: "yes", versionMajor: "2" });
  });
});

describe("the artifact is byte-identical across emissions", () => {
  test("no timestamp — two gathers of one unchanged host render the same bytes", () => {
    // Idempotency (discipline #6). A wall-clock field would make two emissions differ and destroy
    // the byte-comparability that lets a later run prove nothing about the hardware changed.
    const a = renderHardwareOnlyFacts(gatherHardwareOnlyFacts(LINUX_BOX()));
    const b = renderHardwareOnlyFacts(gatherHardwareOnlyFacts(LINUX_BOX()));
    expect(a).toBe(b);
    expect(a).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe("sysfs flag parsing refuses to guess", () => {
  test("1 and 0 are answers; everything else is unknown", () => {
    expect(parseSysfsFlag("1\n")).toBe("yes");
    expect(parseSysfsFlag("0")).toBe("no");
    expect(parseSysfsFlag("")).toBe("unknown");
    expect(parseSysfsFlag("maybe")).toBe("unknown");
    expect(parseSysfsFlag(null)).toBe("unknown");
  });

  test("speed rejects negatives and junk rather than reporting them", () => {
    expect(parseSpeed("-1")).toBeNull();
    expect(parseSpeed("garbage")).toBeNull();
    expect(parseSpeed("0")).toBe(0);
    expect(parseSpeed(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// THE CLI. Added when the module was wired: until it had an entry point nothing
// could run it, which made every property above true and unreachable — a tested
// module nobody can invoke is the same shape as a check that cannot fail.
// ---------------------------------------------------------------------------

import { mkdtempSync, readFileSync as read, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, realProbe } from "./hardware-only-facts.ts";

const sink = (): { log: (s: string) => void; out: () => string } => {
  const lines: string[] = [];
  return { log: (s) => lines.push(s), out: () => lines.join("\n") };
};

describe("the CLI records rather than judges", () => {
  test("a host that can answer NOTHING still exits 0", () => {
    // The property that keeps this a recorder. "This machine tells us very little" is an ANSWER,
    // and failing on it would make every caller treat an honest result as an error.
    const s = sink();
    expect(main([], probeOf({}, {}), s.log)).toBe(0);
    expect(s.out()).toContain('"schema": "zeta.hardware-only-facts.v1"');
    expect(s.out()).toContain('"present": "unknown"');
  });

  test("stdout always carries the artifact, even with no --out", () => {
    // On a first boot the console is mirrored to the serial UART, so stdout is the sink that
    // survives a failed mount. A capture that existed only as a file would be silently lost.
    const s = sink();
    main([], LINUX_BOX(), s.log);
    expect(s.out()).toContain('"versionMajor": "2"');
  });

  test("--out writes the same bytes it printed", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-hwfacts-"));
    try {
      const p = join(dir, "facts.json");
      const s = sink();
      expect(main(["--out", p], LINUX_BOX(), s.log)).toBe(0);
      const onDisk = read(p, "utf8");
      expect(onDisk.trimEnd()).toBe(s.out());
      expect(JSON.parse(onDisk).schema).toBe("zeta.hardware-only-facts.v1");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("an --out that CANNOT be written fails — the caller asked for a file and has not got one", () => {
    // The one failure mode. Distinct from "nothing could be probed", which is a success.
    const s = sink();
    expect(main(["--out", "/nonexistent-dir-zeta/facts.json"], LINUX_BOX(), s.log)).toBe(1);
    expect(s.out()).toContain("FAILED to write");
    // ...and the artifact was still printed, so the run is not a total loss.
    expect(s.out()).toContain("zeta.hardware-only-facts.v1");
  });

  test("a mistyped flag is REFUSED, not ignored", () => {
    // Ignoring `--ou` would let a caller believe it requested a file it never gets.
    const s = sink();
    expect(main(["--ou", "x"], LINUX_BOX(), s.log)).toBe(2);
    expect(s.out()).toContain("unknown argument");
  });

  test("--out with no path is refused rather than defaulting somewhere", () => {
    expect(main(["--out"], LINUX_BOX(), sink().log)).toBe(2);
  });
});

describe("the real probe turns every failure into `could not look`", () => {
  test("unreadable paths yield null, never an empty string or empty list", () => {
    // The distinction the whole module rests on. A probe returning "" or [] on error would convert
    // "we could not look" into "we looked and found nothing".
    const p = realProbe();
    expect(p.read("/definitely/not/a/real/path")).toBeNull();
    expect(p.list("/definitely/not/a/real/dir")).toBeNull();
    expect(p.exists("/definitely/not/a/real/path")).toBe(false);
  });

  test("it reads a file that DOES exist — otherwise the test above passes on a probe that always fails", () => {
    // The control. Without it, `realProbe` returning null unconditionally satisfies every assertion.
    const dir = mkdtempSync(join(tmpdir(), "zeta-hwprobe-"));
    try {
      const f = join(dir, "carrier");
      writeFileSync(f, "1\n", "utf8");
      const p = realProbe();
      expect(p.read(f)).toBe("1\n");
      expect(p.list(dir)).toContain("carrier");
      expect(p.exists(f)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
