import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { platform as osPlatform } from "node:os";
import capturesFile from "./tpm2-linux-captures.json" with { type: "json" };
import {
  captureTpm2Linux,
  classifyTpm2Linux,
  parseGetcapFamily,
  parseVersionMajor,
  probeTpm2Linux,
  realTpm2LinuxEffects,
  tpm2CheckRan,
  type CommandOutcome,
  type ListOutcome,
  type PathOutcome,
  type ReadOutcome,
  type Tpm2LinuxCapture,
  type Tpm2LinuxEffects,
  type Tpm2State,
} from "./tpm2-linux-probe.ts";

/**
 * NO TPM WAS CONTACTED BY THIS SUITE. It runs on macOS arm64, where /sys does not exist,
 * `ls /dev/tpm*` matches nothing, and tpm2-tools is not installed. Everything below tests
 * the CLASSIFICATION of captured readings — which is exactly why the capture/classify
 * split exists. What it cannot test is that a real TPM 2.0 produces the reading the
 * `present` fixture describes; that remains open under 081M00VN9P1087G0R000FYTTVS with a
 * named hardware dependency: one x86 node with an fTPM enabled.
 */

// ---------------------------------------------------------------------------
// A host builder. Every field defaults to the honest "nothing here" reading; a test
// overrides only the source it is about.
// ---------------------------------------------------------------------------

function host(over: Partial<Tpm2LinuxEffects> = {}): Tpm2LinuxEffects {
  return {
    platform: "linux",
    statPath: () => ({ kind: "not-found" }),
    readText: () => ({ kind: "not-found" }),
    listDir: () => ({ kind: "not-found" }),
    run: () => ({ kind: "not-installed" }),
    ...over,
  };
}

const found: PathOutcome = { kind: "found" };
const denied: PathOutcome = { kind: "permission-denied" };
const readsTwo: ReadOutcome = { kind: "read", text: "2\n" };
const listed = (...entries: string[]): ListOutcome => ({ kind: "listed", entries });
/** The tpm2-tools 5.x `properties-fixed` YAML shape. Hand-constructed; no TPM was contacted. */
const GETCAP_2_0_STDOUT = 'TPM2_PT_FAMILY_INDICATOR:\n  raw: 0x322E3000\n  value: "2.0"\nTPM2_PT_LEVEL:\n  raw: 0\n';
const GETCAP_2_0: CommandOutcome = { kind: "ran", stdout: GETCAP_2_0_STDOUT };

/** A machine that would classify `present`, so tests can subtract one thing at a time. */
function tpm2Host(over: Partial<Tpm2LinuxEffects> = {}): Tpm2LinuxEffects {
  return host({
    statPath: () => found,
    listDir: (p) => (p === "/sys/class/tpm" ? listed("tpm0", "tpmrm0") : { kind: "not-found" }),
    readText: (p) => (p.endsWith("tpm_version_major") ? readsTwo : { kind: "not-found" }),
    run: () => GETCAP_2_0,
    ...over,
  });
}

// ---------------------------------------------------------------------------
// THE DISTINCTION. This is the point of the module.
// ---------------------------------------------------------------------------

describe("four causes, four states — collapsing any pair is the defect", () => {
  /**
   * The four machines below differ ONLY in why the probe has no TPM 2.0 to report, and
   * the old boolean probe answered all four identically: `{ available: false }`. Under
   * that answer an operator cannot tell "install tpm2-tools", "join the tss group",
   * "enable the fTPM in BIOS" and "load the driver" apart — and, worse, three of them are
   * not findings about the hardware at all.
   */
  const cases: readonly { readonly label: string; readonly fx: Tpm2LinuxEffects; readonly state: Tpm2State }[] = [
    {
      label: "UNAVAILABLE-tool — no tpm class, no tools: nothing to ask",
      fx: host({ listDir: () => ({ kind: "not-found" }), run: () => ({ kind: "not-installed" }) }),
      state: "unavailable",
    },
    {
      label: "UNREADABLE-permission — the node exists and refuses us",
      fx: host({
        statPath: () => denied,
        listDir: (p) => (p === "/sys/class/tpm" ? listed("tpm0", "tpmrm0") : { kind: "not-found" }),
        readText: () => ({ kind: "permission-denied" }),
        run: () => ({ kind: "failed", exitCode: 1, stderr: "ERROR: Could not open /dev/tpmrm0: Permission denied\n" }),
      }),
      state: "unreadable",
    },
    {
      label: "ABSENT-device — the tpm class enumerated and registers nothing",
      fx: host({ listDir: (p) => (p === "/sys/class/tpm" ? listed() : { kind: "not-found" }) }),
      state: "absent",
    },
    { label: "PRESENT — a node and a confirmed family 2.0", fx: tpm2Host(), state: "present" },
  ];

  for (const c of cases) {
    it(`${c.label} → ${c.state}`, () => {
      expect(probeTpm2Linux(c.fx).state).toBe(c.state);
    });
  }

  it("no two of the four share a state", () => {
    const states = cases.map((c) => probeTpm2Linux(c.fx).state);
    expect(new Set(states).size).toBe(cases.length);
  });

  it("only PRESENT counts as usable, and only PRESENT and ABSENT are answers about hardware", () => {
    for (const c of cases) {
      const res = probeTpm2Linux(c.fx);
      expect(res.state === "present").toBe(c.state === "present");
      // `unavailable` and `unreadable` are "the check did not run". If either ever reads
      // as an answer, a caller can conclude "no TPM" from a missing tool.
      expect(tpm2CheckRan(res.state)).toBe(c.state === "present" || c.state === "absent");
    }
  });

  it("each state names an ACTION in its reason — the four are told apart by an operator too", () => {
    const byState = new Map(cases.map((c) => [c.state, probeTpm2Linux(c.fx).reason]));
    expect(byState.get("unavailable")).toContain("modprobe");
    expect(byState.get("unreadable")).toContain("privileged");
    expect(byState.get("absent")).toContain("BIOS");
    expect(byState.get("present")).toContain("confirmed");
  });
});

describe("a missing tool and a denied read can NEVER produce ABSENT", () => {
  // The #11509 shape: an empty grep read as "the option is off" when the truth was "on".
  // Here: a tool that is not installed, or a source that refused, must not be spent as a
  // negative. `absent` has exactly one producer — an enumeration that ran.
  const nonAnswers: readonly (readonly [string, Partial<Tpm2LinuxEffects>])[] = [
    ["tpm2_getcap not installed", { run: () => ({ kind: "not-installed" }) }],
    [
      "tpm2_getcap ran and did not mention the family",
      { run: () => ({ kind: "ran", stdout: "TPM2_PT_LEVEL:\n  raw: 0\n" }) },
    ],
    ["tpm2_getcap exited non-zero", { run: () => ({ kind: "failed", exitCode: 1, stderr: "no TCTI\n" }) }],
    ["/sys/class/tpm denied", { listDir: () => ({ kind: "permission-denied" }) }],
    ["/sys/class/tpm errored", { listDir: () => ({ kind: "error", code: "EIO" }) }],
    ["device node denied", { statPath: () => denied }],
    ["device node errored", { statPath: () => ({ kind: "error", code: "EIO" }) }],
    ["version file denied", { statPath: () => found, readText: () => ({ kind: "permission-denied" }) }],
  ];

  for (const [label, over] of nonAnswers) {
    it(`${label} → not ABSENT`, () => {
      const res = probeTpm2Linux(host(over));
      expect(res.state).not.toBe("absent");
      expect(res.state).not.toBe("present");
    });
  }

  it("ABSENT requires an enumeration that actually ran", () => {
    // Same machine twice; the only difference is whether /sys/class/tpm could be listed.
    const enumerable = probeTpm2Linux(host({ listDir: () => listed() }));
    const notEnumerable = probeTpm2Linux(host({ listDir: () => ({ kind: "not-found" }) }));
    expect(enumerable.state).toBe("absent");
    expect(notEnumerable.state).toBe("unavailable");
  });

  it("an EMPTY successful listing is a negative; a missing directory is not", () => {
    // `readdirSync` throwing and `readdirSync` returning [] are the same `false` to a
    // boolean probe. They are opposite facts.
    expect(probeTpm2Linux(host({ listDir: () => listed() })).state).toBe("absent");
    expect(probeTpm2Linux(host({ listDir: () => ({ kind: "not-found" }) })).state).toBe("unavailable");
  });
});

describe("a device node is not a family — the TPM 1.2 trap", () => {
  const tpm12 = host({
    statPath: (p) => (p === "/dev/tpm0" ? found : { kind: "not-found" }),
    listDir: (p) => (p === "/sys/class/tpm" ? listed("tpm0") : { kind: "not-found" }),
    readText: (p) => (p.endsWith("tpm_version_major") ? { kind: "read", text: "1\n" } : { kind: "not-found" }),
  });

  it("reports TPM 2.0 ABSENT on a machine whose /dev/tpm0 exists but is a 1.2 chip", () => {
    // The old probe returned { available: true, path: "/dev/tpm0" } for this machine.
    const res = probeTpm2Linux(tpm12);
    expect(res.state).toBe("absent");
    expect(res.family).toBe("1.2");
    expect(res.reason).toContain("1.2");
  });

  it("does not hide that a TPM is physically there", () => {
    expect(probeTpm2Linux(tpm12).reason).toContain("even though the machine has a TPM");
  });

  it("a node with NO family evidence is indeterminate, never present", () => {
    // Pre-4.19 kernel, no tpm2-tools: the node proves a TPM, not a TPM 2.0.
    const res = probeTpm2Linux(host({ statPath: (p) => (p === "/dev/tpm0" ? found : { kind: "not-found" }) }));
    expect(res.state).toBe("indeterminate");
    expect(res.family).toBeUndefined();
    expect(res.reason).toContain("also the node for a TPM 1.2");
  });

  it("a confirmed 2.0 with no reachable node is not PRESENT either", () => {
    const res = probeTpm2Linux(tpm2Host({ statPath: () => ({ kind: "not-found" }) }));
    expect(res.state).toBe("indeterminate");
    expect(res.family).toBe("2.0");
  });

  it("a confirmed 2.0 whose node is DENIED is unreadable, not indeterminate", () => {
    // Denied and missing are different futures: one is fixable by joining the tss group.
    const res = probeTpm2Linux(tpm2Host({ statPath: () => denied }));
    expect(res.state).toBe("unreadable");
    expect(res.family).toBe("2.0");
  });
});

describe("either family source alone is enough, and neither is required", () => {
  it("sysfs alone confirms 2.0 with no tpm2-tools installed", () => {
    const res = probeTpm2Linux(tpm2Host({ run: () => ({ kind: "not-installed" }) }));
    expect(res.state).toBe("present");
    expect(res.deviceNode).toBe("/dev/tpmrm0");
  });

  it("tpm2_getcap alone confirms 2.0 on a kernel without tpm_version_major", () => {
    const res = probeTpm2Linux(tpm2Host({ readText: () => ({ kind: "not-found" }) }));
    expect(res.state).toBe("present");
  });

  it("prefers the resource-manager node when both exist", () => {
    expect(probeTpm2Linux(tpm2Host()).deviceNode).toBe("/dev/tpmrm0");
  });

  it("falls back to /dev/tpm0 when only it exists", () => {
    const res = probeTpm2Linux(tpm2Host({ statPath: (p) => (p === "/dev/tpm0" ? found : { kind: "not-found" }) }));
    expect(res.deviceNode).toBe("/dev/tpm0");
  });
});

describe("the parsers", () => {
  it("reads the family indicator out of tpm2_getcap YAML", () => {
    expect(parseGetcapFamily(GETCAP_2_0_STDOUT)).toBe("2.0");
  });

  it("returns undefined — not a negative — when the property is absent from the output", () => {
    // The empty-grep bug, at parser scope. `undefined` must not be falsy-read as "not 2.0"
    // by the classifier, which is what the ABSENT tests above pin.
    expect(parseGetcapFamily("TPM2_PT_LEVEL:\n  raw: 0\n")).toBeUndefined();
    expect(parseGetcapFamily("")).toBeUndefined();
  });

  it("does not read a LATER property's value as the family's", () => {
    // The mutant this kills: searching the whole output for /value: "(...)"/ after finding
    // the key, which picks up TPM2_PT_MANUFACTURER's value when the family block has none.
    const stdout =
      'TPM2_PT_FAMILY_INDICATOR:\n  raw: 0x322E3000\nTPM2_PT_MANUFACTURER:\n  raw: 0x49465800\n  value: "IFX"\n';
    expect(parseGetcapFamily(stdout)).toBeUndefined();
  });

  it("reports an unrecognised family rather than defaulting to 2.0", () => {
    expect(parseGetcapFamily('TPM2_PT_FAMILY_INDICATOR:\n  value: "3.1"\n')).toBe("unrecognised");
    expect(parseVersionMajor("7\n")).toBe("unrecognised");
    expect(parseVersionMajor("")).toBe("unrecognised");
  });

  it("reads tpm_version_major for both families", () => {
    expect(parseVersionMajor("2\n")).toBe("2.0");
    expect(parseVersionMajor("1\n")).toBe("1.2");
    expect(parseVersionMajor("  2  ")).toBe("2.0");
  });

  it("an unrecognised family never yields PRESENT", () => {
    const res = probeTpm2Linux(
      tpm2Host({ readText: () => ({ kind: "read", text: "7\n" }), run: () => ({ kind: "not-installed" }) }),
    );
    expect(res.state).toBe("indeterminate");
  });
});

describe("non-Linux is 'not asked', never 'no TPM'", () => {
  it("classifies darwin as unavailable and says the sources were not consulted", () => {
    const res = probeTpm2Linux(host({ platform: "darwin" }));
    expect(res.state).toBe("unavailable");
    expect(tpm2CheckRan(res.state)).toBeFalse();
    expect(res.reason).toContain("NOT consulted");
  });

  it("does not touch the filesystem or spawn anything off Linux", () => {
    let touched = false;
    const lyingHost = host({
      platform: "darwin",
      statPath: () => {
        touched = true;
        return found;
      },
      listDir: () => {
        touched = true;
        return listed("tpm0");
      },
      run: () => {
        touched = true;
        return GETCAP_2_0;
      },
    });
    // A host that WOULD answer, so a missing platform guard is visible rather than merely
    // unreachable.
    expect(probeTpm2Linux(lyingHost).state).toBe("unavailable");
    expect(touched).toBeFalse();
  });
});

describe("the committed captures replay", () => {
  const captures = capturesFile.captures as readonly {
    name: string;
    provenanceKind: string;
    provenance: string;
    expectedState: string;
    capture: Tpm2LinuxCapture;
  }[];

  for (const c of captures) {
    it(`${c.name} (${c.provenanceKind}) → ${c.expectedState}`, () => {
      expect(classifyTpm2Linux(c.capture).state).toBe(c.expectedState as Tpm2State);
    });
  }

  it("every capture declares a provenance kind, and hand-constructed ones say so out loud", () => {
    for (const c of captures) {
      expect(["observed", "hand-constructed"]).toContain(c.provenanceKind);
      if (c.provenanceKind === "hand-constructed") {
        expect(c.provenance).toContain("NO TPM WAS CONTACTED");
      }
    }
  });

  it("NO capture claiming a TPM 2.0 is observed — the hardware gap is still open", () => {
    // The guard against this file quietly becoming evidence. When an x86 node is finally
    // run, this test flips to red and is deleted in the same commit that lands the real
    // capture — so the gap cannot close silently, and cannot stay closed by accident.
    const observed2_0 = captures.filter((c) => c.provenanceKind === "observed" && c.expectedState === "present");
    expect(observed2_0.map((c) => c.name)).toEqual([]);
  });

  it("the observed captures cover the platform this repo is developed on", () => {
    const observed = captures.filter((c) => c.provenanceKind === "observed");
    expect(observed.length).toBeGreaterThan(0);
    expect(observed.map((c) => c.capture.platform)).toContain("darwin");
  });
});

describe("the real IO seam preserves what the standard library throws away", () => {
  // `existsSync` returns false for EVERY error, which is how a denial became "no TPM".
  // This is the one block that touches the actual filesystem.
  const fx = realTpm2LinuxEffects();

  it("reports a genuinely missing path as not-found", () => {
    expect(fx.statPath("/definitely/not/here/tpmrm0")).toEqual({ kind: "not-found" });
    expect(fx.listDir("/definitely/not/here")).toEqual({ kind: "not-found" });
  });

  it("reports a missing binary as not-installed, distinct from a failure", () => {
    expect(fx.run("definitely-not-a-real-binary-xyzzy", [])).toEqual({ kind: "not-installed" });
  });

  it("distinguishes a DENIED directory from a missing one on this very machine", () => {
    // The skip condition below may depend ONLY on facts independent of the code under
    // test — the OS and our uid. An earlier version of this test also skipped when the
    // reading was not `permission-denied`, i.e. it excused itself precisely when the code
    // was broken: a mutation that collapsed EACCES into ENOENT (exactly what `existsSync`
    // does, and the whole reason this seam exists) left all 76 tests green. A test that
    // skips itself on failure is a check that cannot fail.
    const uid = typeof process.getuid === "function" ? process.getuid() : 0;
    if (osPlatform() !== "darwin" || uid === 0) return;

    // macOS: /private/var/root is 0700 root:wheel, so an unprivileged caller gets EACCES.
    expect(fx.listDir("/private/var/root")).toEqual({ kind: "permission-denied" });
    expect(fx.readText("/private/var/root/.profile")).toEqual({ kind: "permission-denied" });
    expect(fx.listDir("/definitely/not/here")).toEqual({ kind: "not-found" });
    // The contrast that motivates the whole seam: the standard-library answer for the
    // denied path is the same `false` as for a path that truly is not there.
    expect(existsSync("/private/var/root/.profile")).toBe(existsSync("/definitely/not/here"));
    expect(fx.listDir("/private/var/root")).not.toEqual(fx.listDir("/definitely/not/here"));
  });

  it("captures this host without crashing and never claims PRESENT without a family", () => {
    const cap = captureTpm2Linux(fx);
    const res = classifyTpm2Linux(cap);
    expect(cap.platform).toBe(osPlatform());
    if (res.state === "present") {
      expect(res.family).toBe("2.0");
      expect(res.deviceNode).toBeDefined();
    }
    // On the machine this was written on the answer is `unavailable`; on an x86 node with
    // an fTPM it should be `present`. Both are fine; what is asserted is the invariant.
    expect(["present", "absent", "unreadable", "unavailable", "indeterminate"]).toContain(res.state);
  });
});
