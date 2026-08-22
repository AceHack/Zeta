import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { platform as osPlatform } from "node:os";
import capturesFile from "./tpm2-linux-captures.json" with { type: "json" };
import {
  captureTpm2Linux,
  classifySecp256k1,
  classifyTpm2Linux,
  parseGetcapEccCurves,
  parseGetcapFamily,
  parseVersionMajor,
  probeSecp256k1OnTpm,
  probeTpm2Linux,
  realTpm2LinuxEffects,
  secp256k1CheckRan,
  type Secp256k1State,
  TCG_REGISTERED_ECC_CURVE_NAMES,
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

// ---------------------------------------------------------------------------
// secp256k1 -- three states a caller must be able to tell apart, plus the one the
// device can put us in. This is the falsifier for a claim that was CITED, NOT CHECKED.
// ---------------------------------------------------------------------------

/** Real tpm2-tools shape (dump_ecc_curves prints "NAME: 0xHEX"). Hand-constructed; no TPM
 *  was contacted. A typical fTPM: NIST curves only. */
const CURVES_NIST_ONLY = [
  "TPM2_ECC_NIST_P256: 0x3",
  "TPM2_ECC_NIST_P384: 0x4",
  "",
].join("\n");

/** The same device plus an identifier tpm2-tools cannot name -- the vendor-extension case. */
const CURVES_WITH_UNKNOWN = [
  "TPM2_ECC_NIST_P256: 0x3",
  "unknown20: 0x20",
  "",
].join("\n");

/** A tool patched to know the curve. No TCG code point exists, so this is hypothetical --
 *  and the probe must still be able to SAY so rather than being unable to report present. */
const CURVES_WITH_SECP256K1 = [
  "TPM2_ECC_NIST_P256: 0x3",
  "TPM2_ECC_SECP256K1: 0x40",
  "",
].join("\n");

function curveHost(out: CommandOutcome): Tpm2LinuxEffects {
  return tpm2Host({ run: (_c, args) => (args[0] === "ecc-curves" ? out : GETCAP_2_0) });
}

describe("secp256k1: present, absent, and THE CHECK DID NOT RUN are three answers", () => {
  it("ABSENT -- the device enumerated, every identifier is TCG-registered, none is secp256k1", () => {
    const k1 = classifySecp256k1(captureTpm2Linux(curveHost({ kind: "ran", stdout: CURVES_NIST_ONLY })));
    expect(k1.state).toBe("absent");
    expect(secp256k1CheckRan(k1.state)).toBeTrue();
    expect(k1.curves).toEqual(["TPM2_ECC_NIST_P256", "TPM2_ECC_NIST_P384"]);
    expect(k1.unrecognised).toEqual([]);
    // The consequence, stated where an operator reads it -- not left to a research doc.
    expect(k1.reason).toContain("ABSENT");
    expect(k1.reason).toContain("never a wallet signer");
  });

  it("PRESENT -- a named secp256k1 curve is reported, and is flagged as a vendor extension", () => {
    const k1 = classifySecp256k1(captureTpm2Linux(curveHost({ kind: "ran", stdout: CURVES_WITH_SECP256K1 })));
    expect(k1.state).toBe("present");
    expect(secp256k1CheckRan(k1.state)).toBeTrue();
    expect(k1.reason).toContain("IS PRESENT");
    expect(k1.reason).toContain("vendor extension");
  });

  it("THE CHECK DID NOT RUN -- not Linux, no tpm2-tools, a failed run, and an errored run", () => {
    const cases: readonly { readonly label: string; readonly fx: Tpm2LinuxEffects }[] = [
      { label: "not Linux", fx: host({ platform: "darwin" }) },
      { label: "no tpm2-tools", fx: curveHost({ kind: "not-installed" }) },
      { label: "tool failed", fx: curveHost({ kind: "failed", exitCode: 1, stderr: "ERROR: tcti" }) },
      { label: "tool errored", fx: curveHost({ kind: "error", code: "EACCES" }) },
    ];
    for (const c of cases) {
      const k1 = classifySecp256k1(captureTpm2Linux(c.fx));
      expect(k1.state, c.label).toBe("did-not-run");
      expect(secp256k1CheckRan(k1.state), c.label).toBeFalse();
      // The exact idiom the sibling probe uses. A did-not-run that does not SAY so is the
      // vacuity class: a check that could not run reading as one that ran and said no.
      expect(k1.reason, c.label).toContain('NOT "no secp256k1"');
      expect(k1.curves, c.label).toEqual([]);
    }
  });
});

describe("secp256k1: an unnameable identifier is NOT a negative", () => {
  it("INDETERMINATE -- a vendor code point could be secp256k1 and the tool cannot say", () => {
    // THE LOAD-BEARING CASE. tpm2-tools has no secp256k1 constant (checked against
    // tools/tpm2_getcap.c dump_ecc_curves, 2026-08-20), so a device implementing it prints
    // an unnameable identifier. Reading that as absent would be exactly the existsSync
    // defect this module exists to refuse.
    const k1 = classifySecp256k1(captureTpm2Linux(curveHost({ kind: "ran", stdout: CURVES_WITH_UNKNOWN })));
    expect(k1.state).toBe("indeterminate");
    expect(k1.unrecognised).toEqual(["unknown20"]);
    expect(k1.reason).toContain("NOT excluded");
    expect(secp256k1CheckRan(k1.state)).toBeTrue();
  });
});

describe("secp256k1: parsing and the checked registry roster", () => {
  it("a tool that ran and printed no curve line is did-not-run, never absent", () => {
    // "The output had no curves in it" and "this TPM supports zero ECC curves" are
    // different facts. Only the second is a negative, and this reading cannot tell them
    // apart -- so it must not be spent as one.
    const k1 = classifySecp256k1(captureTpm2Linux(curveHost({ kind: "ran", stdout: "" })));
    expect(k1.state).toBe("did-not-run");
    expect(k1.reason).toContain("different facts");
  });

  it("parseGetcapEccCurves returns undefined for output with no curve line", () => {
    expect(parseGetcapEccCurves("")).toBeUndefined();
    expect(parseGetcapEccCurves("some unrelated banner text")).toBeUndefined();
    const parsed = parseGetcapEccCurves(CURVES_WITH_UNKNOWN);
    expect(parsed?.curves.map((c) => c.name)).toEqual(["TPM2_ECC_NIST_P256", "unknown20"]);
    expect(parsed?.unrecognised).toEqual(["unknown20"]);
  });

  it("the registered-name roster matches tpm2-tools and contains no secp256k1", () => {
    // The CHECKED half of the claim: the tool vocabulary is the registry vocabulary, and
    // it has eight entries, none of them secp256k1.
    expect(TCG_REGISTERED_ECC_CURVE_NAMES.length).toBe(8);
    expect(TCG_REGISTERED_ECC_CURVE_NAMES.filter((n) => n.toUpperCase().includes("K1"))).toEqual([]);
  });
});

describe("secp256k1: the real host, and what it is allowed to conclude", () => {
  it("on THIS machine (Apple silicon) the answer is THE CHECK DID NOT RUN", () => {
    // Registered honestly: this asserts the probe DECLINES to answer where it cannot ask.
    // It is not evidence about any TPM, and it must never be cited as such.
    const k1 = probeSecp256k1OnTpm(realTpm2LinuxEffects());
    if (osPlatform() !== "linux") {
      expect(k1.state).toBe("did-not-run");
      expect(secp256k1CheckRan(k1.state)).toBeFalse();
    }
    expect(["present", "absent", "indeterminate", "did-not-run"]).toContain(k1.state);
  });

  it("no committed capture yields PRESENT or ABSENT -- the hardware gap is still open", () => {
    // Twin of the TPM-2.0 guard above. The secp256k1 question is settled by an x86 node
    // running the capture command, not by this repository agreeing with itself. When that
    // lands, this test flips red and is deleted in the same commit as the real capture.
    // Restricted to OBSERVED captures, exactly like the TPM-2.0 guard above. Restricting
    // to all captures would be vacuous the moment a hand-constructed `absent` fixture
    // exists -- and one does, deliberately, so the classifier's absent branch is exercised.
    const settled = (
      capturesFile.captures as readonly { name: string; provenanceKind: string; capture: Tpm2LinuxCapture }[]
    )
      .filter((c) => c.provenanceKind === "observed")
      .filter((c) => ["present", "absent"].includes(classifySecp256k1(c.capture).state))
      .map((c) => c.name);
    expect(settled).toEqual([]);
  });
});

describe("the committed captures replay", () => {
  const captures = capturesFile.captures as readonly {
    name: string;
    provenanceKind: string;
    provenance: string;
    expectedState: string;
    /** Present only on entries that carry a curve reading. Absent is NOT "did-not-run". */
    expectedSecp256k1?: string;
    capture: Tpm2LinuxCapture;
  }[];

  for (const c of captures) {
    it(`${c.name} (${c.provenanceKind}) → ${c.expectedState}`, () => {
      expect(classifyTpm2Linux(c.capture).state).toBe(c.expectedState as Tpm2State);
    });
  }

  for (const c of captures.filter((x) => x.expectedSecp256k1 !== undefined)) {
    it(`${c.name} -> secp256k1 ${String(c.expectedSecp256k1)}`, () => {
      expect(classifySecp256k1(c.capture).state).toBe(c.expectedSecp256k1 as Secp256k1State);
    });
  }

  it("the curve captures cover all three answers a caller must tell apart", () => {
    // Without this, the fixtures could drift to a set that only ever exercises one branch
    // and the replay above would still be green -- a check that cannot fail.
    const declared = captures.map((c) => c.expectedSecp256k1).filter((x) => x !== undefined);
    for (const want of ["absent", "indeterminate", "did-not-run"]) expect(declared).toContain(want);
  });

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
