import { describe, expect, it } from "bun:test";
import {
  probeTpm2,
  probeYubikey,
  probePkcs11,
  probeSecureEnclave,
  probeSmartCardReader,
  probeHardwareSecurity,
  availableHardwareSealTiers,
  assertHardwareSealTierAvailable,
  macReadersBlockIsNonEmpty,
  realProbeEffects,
  probeYubiHsm2,
  probeYubiHsm2State,
  probeYubiHsm2Pkcs11,
  pkcs11MatchedPair,
  enumerateDarwinUsb,
  yubiHsm2CheckRan,
  type HardwareProbeEffects,
} from "./frost-hardware-probe.ts";
import type { ListOutcome, PathOutcome, Tpm2LinuxEffects } from "./tpm2-linux-probe.ts";

// These tests used to be four `expect(typeof x).toBe("boolean")` assertions. Every one of
// them passed on any machine, in any state, for any implementation that returned an
// object — including an implementation that always answered "hardware present". They
// could not fail, so they proved nothing. The probe now takes an injected host
// (§13 noninterference), so a test can describe a machine and assert the ANSWER.

/**
 * The Linux TPM door, defaulting to a machine whose kernel exposes the tpm class and
 * registers no chip — i.e. a REAL negative (`absent`), not a "we could not look".
 * `tpm2Present()` below is the opposite pole. The states themselves, and the four causes
 * that must never collapse into each other, are tested in `tpm2-linux-probe.test.ts`.
 */
function tpm2Absent(over: Partial<Tpm2LinuxEffects> = {}): Tpm2LinuxEffects {
  return {
    platform: "linux",
    statPath: () => ({ kind: "not-found" }),
    readText: () => ({ kind: "not-found" }),
    listDir: (p) => (p === "/sys/class/tpm" ? { kind: "listed", entries: [] } : { kind: "not-found" }),
    run: () => ({ kind: "not-installed" }),
    ...over,
  };
}

/** A machine with a TPM 2.0: a node AND a confirmed family. Both are required. */
function tpm2Present(): Tpm2LinuxEffects {
  const found: PathOutcome = { kind: "found" };
  const chips: ListOutcome = { kind: "listed", entries: ["tpm0", "tpmrm0"] };
  return tpm2Absent({
    statPath: () => found,
    listDir: (p) => (p === "/sys/class/tpm" ? chips : { kind: "not-found" }),
    readText: (p) => (p.endsWith("tpm_version_major") ? { kind: "read", text: "2\n" } : { kind: "not-found" }),
  });
}

/** A machine with nothing on it. Individual tests add only what they are about. */
function host(over: Partial<HardwareProbeEffects> = {}): HardwareProbeEffects {
  return {
    exists: () => false,
    readDir: () => [],
    readFile: () => {
      throw new Error("no such file");
    },
    run: () => {
      throw new Error("command not found");
    },
    platform: "linux",
    ...over,
    // The TPM door defaults to the SAME platform as the outer host, so a darwin fake does
    // not accidentally describe a machine that is Linux to one probe and macOS to another.
    tpm2: over.tpm2 ?? tpm2Absent({ platform: over.platform ?? "linux" }),
  };
}

const MAC_PROFILER_NO_READER = `SmartCards:

    Readers:

    Reader Drivers:

      #01: fr.apdu.ccid.smartcardccid:1.5.1 (/usr/libexec/SmartCardServices/drivers/ifd-ccid.bundle)
`;

const MAC_PROFILER_WITH_READER = `SmartCards:

    Readers:

      Yubico YubiKey OTP+FIDO+CCID

    Reader Drivers:

      #01: fr.apdu.ccid.smartcardccid:1.5.1 (/usr/libexec/SmartCardServices/drivers/ifd-ccid.bundle)
`;

/**
 * Driver lists and NO `Readers:` section at all. This is the fixture that makes the
 * "a driver is not a device" guard in the parser CHECKABLE rather than merely stated:
 * both fixtures above happen to open their `Readers:` block on the same line that the
 * substring "Reader" first appears, so they cannot tell a header-exact parser from one
 * that keys on the word — a parser that matched `line.includes("Reader")` passed all 23
 * tests and reported the ifd-ccid DRIVER ENTRY below as an attached reader. That is the
 * same conflation this whole file exists to refuse, one layer down in the parser, and it
 * survived until this fixture existed. Nothing guarantees every macOS build, locale, or
 * SmartCardServices state emits the empty `Readers:` block that this host does, so
 * "absent section" is not permitted to mean "reader found".
 */
const MAC_PROFILER_DRIVERS_ONLY = `SmartCards:

    Reader Drivers:

      #01: fr.apdu.ccid.smartcardccid:1.5.1 (/usr/libexec/SmartCardServices/drivers/ifd-ccid.bundle)

    SmartCard Drivers:

      #01: com.apple.CryptoTokenKit.pivtoken:1.0 (/System/Library/Frameworks/CryptoTokenKit.framework/PlugIns/pivtoken.appex)
`;

describe("a PKCS#11 driver on disk is not a device", () => {
  // The regression this file exists for. `brew install yubico-piv-tool` drops
  // ykcs11.dylib on a machine with no token; the old probe reported hardware present.
  const driverOnlyHost = host({
    platform: "darwin",
    exists: (p) => p === "/opt/homebrew/lib/ykcs11.dylib",
  });

  it("finds the module", () => {
    expect(probePkcs11(driverOnlyHost)).toEqual({
      found: true,
      path: "/opt/homebrew/lib/ykcs11.dylib",
    });
  });

  it("still reports noHardwareDetected — a driver never clears it", () => {
    const res = probeHardwareSecurity(driverOnlyHost);
    expect(res.pkcs11ModuleFound).toBeTrue();
    expect(res.noHardwareDetected).toBeTrue();
  });

  it("offers no honourable tier, and preflighting hardware-pkcs11 throws", () => {
    const res = probeHardwareSecurity(driverOnlyHost);
    expect(availableHardwareSealTiers(res)).toEqual([]);
    expect(() => assertHardwareSealTierAvailable("hardware-pkcs11", res)).toThrow(
      /a PKCS#11 driver alone is not a device/,
    );
  });

  it("becomes hardware-pkcs11 only once a token is ALSO attached", () => {
    const withToken = host({
      platform: "darwin",
      exists: (p) => p === "/opt/homebrew/lib/ykcs11.dylib",
      run: (cmd) => {
        if (cmd === "system_profiler") return MAC_PROFILER_WITH_READER;
        throw new Error("command not found");
      },
    });
    const res = probeHardwareSecurity(withToken);
    expect(res.noHardwareDetected).toBeFalse();
    expect(availableHardwareSealTiers(res)).toEqual(["hardware-pkcs11"]);
    expect(() => assertHardwareSealTierAvailable("hardware-pkcs11", res)).not.toThrow();
  });
});

describe("an attached token is seen without the ykman CLI", () => {
  // The other direction of the same bug: detection used to require ykman, so a real
  // YubiKey on a machine without the Yubico CLI read as absent.
  it("detects a CCID reader on Linux sysfs with no tools installed", () => {
    const linuxWithReader = host({
      platform: "linux",
      readDir: (p) => (p === "/sys/bus/usb/devices" ? ["1-1", "1-1:1.0"] : []),
      readFile: (p) => {
        if (p === "/sys/bus/usb/devices/1-1:1.0/bInterfaceClass") return "0b\n";
        throw new Error("no such file");
      },
    });
    expect(probeSmartCardReader(linuxWithReader)).toBeTrue();
    expect(probeYubikey(linuxWithReader).detected).toBeTrue();
    expect(probeHardwareSecurity(linuxWithReader).noHardwareDetected).toBeFalse();
  });

  it("does not mistake a non-CCID USB interface for a reader", () => {
    const linuxNoReader = host({
      platform: "linux",
      readDir: (p) => (p === "/sys/bus/usb/devices" ? ["1-1:1.0"] : []),
      // 03 = HID. A keyboard is not a smart-card reader.
      readFile: () => "03\n",
    });
    expect(probeSmartCardReader(linuxNoReader)).toBeFalse();
    expect(probeHardwareSecurity(linuxNoReader).noHardwareDetected).toBeTrue();
  });

  it("prefers the ykman serial when ykman IS installed", () => {
    const withYkman = host({
      run: (cmd) => {
        if (cmd === "ykman") return "31415926\n";
        throw new Error("command not found");
      },
    });
    expect(probeYubikey(withYkman)).toEqual({ detected: true, serial: "31415926" });
  });
});

describe("the macOS Readers-block parser", () => {
  // Stock macOS always lists Reader DRIVERS. A parser that keyed on the word "Reader"
  // would report a reader on every Mac ever made.
  it("reads an empty Readers block as no reader, despite the driver list below it", () => {
    expect(macReadersBlockIsNonEmpty(MAC_PROFILER_NO_READER)).toBeFalse();
  });

  it("reads a populated Readers block as a reader", () => {
    expect(macReadersBlockIsNonEmpty(MAC_PROFILER_WITH_READER)).toBeTrue();
  });

  it("reports no reader when the section is absent entirely", () => {
    expect(macReadersBlockIsNonEmpty("SmartCards:\n")).toBeFalse();
  });

  it("reads a driver list with NO Readers section as no reader", () => {
    // The mutant this kills: `findIndex((l) => l.includes("Reader"))` instead of
    // `l.trim() === "Readers:"`. It matches `Reader Drivers:`, sees the deeper-indented
    // `#01: …ifd-ccid.bundle` beneath it, and calls a bundled driver an attached reader.
    expect(macReadersBlockIsNonEmpty(MAC_PROFILER_DRIVERS_ONLY)).toBeFalse();
  });

  it("does not let a driver-only profiler answer clear noHardwareDetected", () => {
    // End-to-end through the probe, with the PKCS#11 module ALSO on disk — the exact
    // machine the work-item describes. Driver on disk plus driver in the profiler output
    // is still zero devices.
    const driversEverywhere = host({
      platform: "darwin",
      exists: (p) => p === "/opt/homebrew/lib/ykcs11.dylib",
      run: (cmd) => {
        if (cmd === "system_profiler") return MAC_PROFILER_DRIVERS_ONLY;
        throw new Error("command not found");
      },
    });
    const res = probeHardwareSecurity(driversEverywhere);
    expect(res.pkcs11ModuleFound).toBeTrue();
    expect(res.smartCardReaderAttached).toBeFalse();
    expect(res.yubikeyDetected).toBeFalse();
    expect(res.noHardwareDetected).toBeTrue();
    expect(availableHardwareSealTiers(res)).toEqual([]);
  });
});

describe("the Secure Enclave is reported and is not a tier", () => {
  const appleSilicon = host({
    platform: "darwin",
    run: (cmd, args) => {
      if (cmd === "ioreg" && args.includes("AppleSEPManager")) {
        return "+-o AppleSEPManager  <class AppleSEPManager, id 0x1000006ca, registered, matched, active>\n";
      }
      if (cmd === "system_profiler") return MAC_PROFILER_NO_READER;
      throw new Error("command not found");
    },
  });

  it("detects the SEP", () => {
    expect(probeSecureEnclave(appleSilicon)).toBeTrue();
  });

  it("reports SEP present AND noHardwareDetected — both true is the honest answer", () => {
    const res = probeHardwareSecurity(appleSilicon);
    expect(res.secureEnclaveAvailable).toBeTrue();
    expect(res.noHardwareDetected).toBeTrue();
    expect(availableHardwareSealTiers(res)).toEqual([]);
  });

  it("names the Secure Enclave when hardware-tpm2 is preflighted on Apple Silicon", () => {
    const res = probeHardwareSecurity(appleSilicon);
    expect(() => assertHardwareSealTierAvailable("hardware-tpm2", res)).toThrow(
      /Apple Secure Enclave, which is NOT a TPM 2\.0/,
    );
  });

  it("does not look for a SEP off darwin, even if ioreg would answer", () => {
    // The host below WOULD return SEP output if asked. A platform guard that is missing
    // rather than merely unreachable is only visible against a host that answers, so
    // this deliberately does not reuse the bare `host()` whose `run` throws.
    let asked = false;
    const linuxWithLyingIoreg = host({
      platform: "linux",
      run: () => {
        asked = true;
        return "+-o AppleSEPManager  <class AppleSEPManager, registered, matched, active>\n";
      },
    });
    expect(probeSecureEnclave(linuxWithLyingIoreg)).toBeFalse();
    expect(asked).toBeFalse();
  });
});

describe("TPM 2.0 detection", () => {
  it("finds a confirmed TPM 2.0 and offers hardware-tpm2", () => {
    const linuxTpm = host({ tpm2: tpm2Present() });
    expect(probeTpm2(linuxTpm)).toMatchObject({ available: true, path: "/dev/tpmrm0", state: "present" });
    const res = probeHardwareSecurity(linuxTpm);
    expect(res.noHardwareDetected).toBeFalse();
    expect(availableHardwareSealTiers(res)).toEqual(["hardware-tpm2"]);
    expect(() => assertHardwareSealTierAvailable("hardware-tpm2", res)).not.toThrow();
  });

  it("a device node alone does NOT offer hardware-tpm2 — /dev/tpm0 is also a TPM 1.2 node", () => {
    // This machine used to be reported `{ available: true, path: "/dev/tpm0" }`. A node is
    // not a family, and hardware-tpm2 needs 2.0 specifically (there is no tpm2_unseal on
    // a 1.2 chip). Fail-closed: the tier is withheld and the preflight says why.
    const nodeOnly = host({
      tpm2: tpm2Absent({
        statPath: (p) => (p === "/dev/tpm0" ? { kind: "found" } : { kind: "not-found" }),
        listDir: (p) => (p === "/sys/class/tpm" ? { kind: "listed", entries: ["tpm0"] } : { kind: "not-found" }),
      }),
    });
    const probe = probeTpm2(nodeOnly);
    expect(probe.available).toBeFalse();
    expect(probe.state).toBe("indeterminate");
    const res = probeHardwareSecurity(nodeOnly);
    expect(availableHardwareSealTiers(res)).toEqual([]);
    expect(() => {
      assertHardwareSealTierAvailable("hardware-tpm2", res);
    }).toThrow(/INDETERMINATE/);
  });

  it("reports absent when /sys/class/tpm enumerates no chip", () => {
    expect(probeTpm2(host()).state).toBe("absent");
    expect(probeTpm2(host()).available).toBeFalse();
  });

  it("the four not-present states reach the caller intact, and only one is a hardware finding", () => {
    // The whole point of routing the TPM path through a state: `assertHardwareSealTierAvailable`
    // used to say "no TPM 2.0 device node" for all four, which is a false claim in three.
    const machines = {
      unavailable: tpm2Absent({ listDir: () => ({ kind: "not-found" }) }),
      unreadable: tpm2Absent({
        statPath: () => ({ kind: "permission-denied" }),
        listDir: (p) => (p === "/sys/class/tpm" ? { kind: "listed", entries: ["tpm0"] } : { kind: "not-found" }),
      }),
      absent: tpm2Absent(),
      indeterminate: tpm2Absent({ statPath: () => ({ kind: "found" }) }),
    };
    const seen = new Set<string>();
    for (const [expected, tpm2] of Object.entries(machines)) {
      const res = probeHardwareSecurity(host({ tpm2 }));
      expect(res.tpm2State).toBe(expected as typeof res.tpm2State);
      expect(res.tpm2Available).toBeFalse();
      expect(availableHardwareSealTiers(res)).toEqual([]);
      // The reason reaches the throw, so the operator is told which of the four it is.
      let thrown = "";
      try {
        assertHardwareSealTierAvailable("hardware-tpm2", res);
      } catch (e) {
        thrown = String(e);
      }
      expect(thrown).toContain(expected.toUpperCase());
      // Only `absent` may assert anything about the hardware.
      const claimsCheckRan = !thrown.includes("the check did NOT run");
      expect(claimsCheckRan).toBe(expected === "absent" || expected === "indeterminate");
      seen.add(res.tpm2Reason);
    }
    // Four distinct reasons. One shared string would be the collapse wearing a state's clothes.
    expect(seen.size).toBe(4);
  });

  it("darwin is UNAVAILABLE, not ABSENT — macOS was never asked", () => {
    const mac = host({ platform: "darwin" });
    const probe = probeTpm2(mac);
    expect(probe.available).toBeFalse();
    expect(probe.state).toBe("unavailable");
    expect(probe.reason).toContain("NOT consulted");
  });
});

describe("the derivation itself", () => {
  it("noHardwareDetected is exactly 'no device', across every combination", () => {
    // Exhaustive over the four device/driver axes: the flag must track devices only.
    for (const tpm of [false, true]) {
      for (const reader of [false, true]) {
        for (const driver of [false, true]) {
          const fx = host({
            platform: "linux",
            exists: (p) => driver && p === "/usr/lib/libykcs11.so",
            readDir: (p) => (reader && p === "/sys/bus/usb/devices" ? ["1-1:1.0"] : []),
            readFile: () => (reader ? "0b\n" : "03\n"),
            tpm2: tpm ? tpm2Present() : tpm2Absent(),
          });
          const res = probeHardwareSecurity(fx);
          expect(res.noHardwareDetected).toBe(!(tpm || reader));
          expect(res.pkcs11ModuleFound).toBe(driver);
          expect(availableHardwareSealTiers(res).includes("hardware-tpm2")).toBe(tpm);
          expect(availableHardwareSealTiers(res).includes("hardware-pkcs11")).toBe(driver && reader);
        }
      }
    }
  });

  it("never returns a tier that its own preflight would reject", () => {
    const fx = host({ tpm2: tpm2Present() });
    const res = probeHardwareSecurity(fx);
    for (const tier of availableHardwareSealTiers(res)) {
      expect(() => assertHardwareSealTierAvailable(tier, res)).not.toThrow();
    }
  });

  it("stamps a parseable timestamp", () => {
    const res = probeHardwareSecurity(host());
    expect(Number.isNaN(Date.parse(res.timestamp))).toBeFalse();
  });
});

describe("the real host", () => {
  // The one test that touches the actual machine. It asserts a property that holds on
  // every host rather than a fact about this one, so it stays true in CI.
  it("probes without crashing and keeps the driver-is-not-a-device invariant", () => {
    const res = probeHardwareSecurity(realProbeEffects());
    if (!res.tpm2Available && !res.yubikeyDetected && !res.smartCardReaderAttached && !res.yubiHsm2Detected) {
      expect(res.noHardwareDetected).toBeTrue();
    }
    // Whatever this machine is, a tier is offered only when its device is present.
    const tiers = availableHardwareSealTiers(res);
    if (tiers.includes("hardware-tpm2")) expect(res.tpm2Available).toBeTrue();
    // NOT `pkcs11ModuleFound` alone: that assertion was true only while the token module
    // was the only module this file knew about, and it would have gone red the first time
    // a YubiHSM 2 and yubihsm_pkcs11 were the honourable pair -- on ceremony day, in a
    // test named "the real host". A tier now requires a MATCHED pair, and that is what is
    // asserted.
    if (tiers.includes("hardware-pkcs11")) expect(pkcs11MatchedPair(res)).toBeDefined();
    if (res.noHardwareDetected) expect(tiers).toEqual([]);
  });

  it("agrees with the platform: darwin never has a TPM 2.0, and says it was not asked", () => {
    const fx = realProbeEffects();
    if (fx.platform === "darwin") {
      const probe = probeTpm2(fx);
      expect(probe.available).toBeFalse();
      // Not `absent`. The true statement about a Mac is "there is no Linux TPM interface
      // to consult", and the probe is required to say the true one.
      expect(probe.state).toBe("unavailable");
    }
  });

  it("never reports tpm2Available without a device node on THIS machine", () => {
    const res = probeHardwareSecurity(realProbeEffects());
    if (res.tpm2Available) expect(res.tpmDeviceNode).toBeDefined();
    expect(res.tpm2Reason.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// YubiHSM 2 (2026-08-18, Nazar). Written BEFORE the device was plugged in, so what is
// asserted here is the probe's logic, never a reading taken from a machine that had one.
// Every fixture below is a described host.
// ============================================================================

/** `system_profiler SPUSBDataType` on a Mac with a YubiHSM 2 on the bus (abridged). */
const MAC_USB_WITH_YUBIHSM = `USB:

    USB 3.1 Bus:

        YubiHSM:

          Manufacturer: Yubico
`;

/** The same Mac with only a keyboard. The fixture that makes the marker falsifiable. */
const MAC_USB_NO_YUBIHSM = `USB:

    USB 3.1 Bus:

        USB Keyboard:

          Manufacturer: Apple Inc.
`;

const YUBIHSM_MODULE = "/usr/local/lib/yubihsm_pkcs11.dylib";
const TOKEN_MODULE = "/opt/homebrew/lib/ykcs11.dylib";

/** A Mac with a YubiHSM 2 attached and nothing else. */
function macWithYubiHsm(over: Partial<HardwareProbeEffects> = {}): HardwareProbeEffects {
  return host({
    platform: "darwin",
    run: (cmd, args) => {
      if (cmd === "system_profiler" && args[0] === "SPUSBDataType") return MAC_USB_WITH_YUBIHSM;
      if (cmd === "system_profiler" && args[0] === "SPSmartCardsDataType") return MAC_PROFILER_NO_READER;
      throw new Error("command not found");
    },
    ...over,
  });
}

describe("a YubiHSM 2 is a device the other probes cannot see", () => {
  it("is detected on macOS by USB product string", () => {
    expect(probeYubiHsm2(macWithYubiHsm())).toBeTrue();
  });

  it("is NOT reported when the USB tree holds no such device", () => {
    const fx = host({
      platform: "darwin",
      run: (cmd, args) => {
        if (cmd === "system_profiler" && args[0] === "SPUSBDataType") return MAC_USB_NO_YUBIHSM;
        throw new Error("command not found");
      },
    });
    expect(probeYubiHsm2(fx)).toBeFalse();
  });

  it("is detected on Linux by the sysfs product string", () => {
    const fx = host({
      platform: "linux",
      readDir: (p) => (p === "/sys/bus/usb/devices" ? ["1-1", "1-2"] : []),
      readFile: (p) => {
        if (p === "/sys/bus/usb/devices/1-2/product") return "YubiHSM 2";
        throw new Error("no such file");
      },
    });
    expect(probeYubiHsm2(fx)).toBeTrue();
  });

  it("matches the product marker case-insensitively", () => {
    const fx = host({ platform: "linux", readDir: () => ["1-1"], readFile: () => "yubihsm" });
    expect(probeYubiHsm2(fx)).toBeTrue();
  });

  it("answers false rather than throwing when the platform is not probed", () => {
    expect(probeYubiHsm2(host({ platform: "win32" }))).toBeFalse();
  });

  it("clears noHardwareDetected -- an attached HSM is a device", () => {
    const res = probeHardwareSecurity(macWithYubiHsm());
    expect(res.yubiHsm2Detected).toBeTrue();
    expect(res.smartCardReaderAttached).toBeFalse();
    expect(res.yubikeyDetected).toBeFalse();
    expect(res.noHardwareDetected).toBeFalse();
  });
});

describe("the yubihsm_pkcs11 module is a driver, not a device", () => {
  it("is reported without clearing noHardwareDetected", () => {
    const fx = host({ platform: "darwin", exists: (q) => q === YUBIHSM_MODULE });
    const res = probeHardwareSecurity(fx);
    expect(res.yubiHsm2Pkcs11ModuleFound).toBeTrue();
    expect(res.yubiHsm2Pkcs11LibraryPath).toBe(YUBIHSM_MODULE);
    expect(res.yubiHsm2Detected).toBeFalse();
    expect(res.noHardwareDetected).toBeTrue();
    expect(availableHardwareSealTiers(res)).toEqual([]);
  });

  it("finds nothing when no module is installed", () => {
    expect(probeYubiHsm2Pkcs11(host()).found).toBeFalse();
  });
});

describe("a PKCS#11 module must MATCH the device it is asked to drive", () => {
  // The forcing case. Both halves are present and the pair is still wrong: ykcs11 speaks
  // PIV to a CCID card and cannot address a YubiHSM 2. Flat module-and-device logic
  // reported this host as able to honour hardware-pkcs11.
  it("refuses ykcs11 + YubiHSM 2 -- a module for a different device is not a pair", () => {
    const fx = macWithYubiHsm({ exists: (q) => q === TOKEN_MODULE });
    const res = probeHardwareSecurity(fx);
    expect(res.pkcs11ModuleFound).toBeTrue();
    expect(res.yubiHsm2Detected).toBeTrue();
    expect(res.yubiHsm2Pkcs11ModuleFound).toBeFalse();

    expect(pkcs11MatchedPair(res)).toBeUndefined();
    expect(availableHardwareSealTiers(res)).toEqual([]);
  });

  it("names the mismatch in the refusal instead of a generic not-attached", () => {
    const res = probeHardwareSecurity(macWithYubiHsm({ exists: (q) => q === TOKEN_MODULE }));
    let message = "";
    try {
      assertHardwareSealTierAvailable("hardware-pkcs11", res);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("NOT a matched pair");
    expect(message).toContain("yubihsm_pkcs11 is not installed");
    // The old message claimed nothing was attached. Something IS attached.
    expect(message).not.toContain("no smart-card reader, token, or YubiHSM 2 attached");
  });

  it("accepts yubihsm_pkcs11 + YubiHSM 2 as a pair", () => {
    const res = probeHardwareSecurity(macWithYubiHsm({ exists: (q) => q === YUBIHSM_MODULE }));
    expect(pkcs11MatchedPair(res)).toEqual({ module: YUBIHSM_MODULE, device: "YubiHSM 2" });
    expect(availableHardwareSealTiers(res)).toEqual(["hardware-pkcs11"]);
    expect(() => assertHardwareSealTierAvailable("hardware-pkcs11", res)).not.toThrow();
  });

  it("still accepts a token module + an attached CCID token (no regression)", () => {
    const fx = host({
      platform: "darwin",
      exists: (q) => q === TOKEN_MODULE,
      run: (cmd, args) => {
        if (cmd === "system_profiler" && args[0] === "SPSmartCardsDataType") return MAC_PROFILER_WITH_READER;
        if (cmd === "system_profiler" && args[0] === "SPUSBDataType") return MAC_USB_NO_YUBIHSM;
        throw new Error("command not found");
      },
    });
    const res = probeHardwareSecurity(fx);
    expect(res.smartCardReaderAttached).toBeTrue();
    expect(pkcs11MatchedPair(res)?.device).toBe("CCID token / smart-card reader");
    expect(availableHardwareSealTiers(res)).toEqual(["hardware-pkcs11"]);
  });

  it("refuses a YubiHSM 2 with no module at all", () => {
    const res = probeHardwareSecurity(macWithYubiHsm());
    expect(availableHardwareSealTiers(res)).toEqual([]);
    expect(() => assertHardwareSealTierAvailable("hardware-pkcs11", res)).toThrow(/no PKCS#11 module on disk/);
  });
});

// THE NEGATIVE CONTROL THAT WAS MISSING (2026-08-18, Nazar).
//
// The first fix for "the probe cannot see a YubiHSM" shipped green and was WRONG on the
// first real device it met. system_profiler SPUSBDataType returned EMPTY OUTPUT and
// EXIT 0 on the maintainer Mac with the HSM attached; the empty string never throws, so
// the catch was dead code and an empty haystack matched no marker.
//
// Every fixture above described a host where the enumerator either WORKED or THREW. None
// described the third case -- ran, succeeded, said nothing -- so nothing could fail.
// These tests are that case, and they need no hardware.

/** A macOS host where every USB enumerator succeeds and returns nothing. */
function macEnumeratorsEmpty(over: Partial<HardwareProbeEffects> = {}): HardwareProbeEffects {
  return host({
    platform: "darwin",
    run: (cmd) => {
      if (cmd === "ioreg" || cmd === "system_profiler") return "";
      throw new Error("absent");
    },
    ...over,
  });
}

describe("an enumerator that succeeds and says nothing is NOT a negative finding", () => {
  it("classifies empty-but-successful output as empty, not as an answer", () => {
    expect(enumerateDarwinUsb(macEnumeratorsEmpty()).kind).toBe("empty");
  });

  it("yields indeterminate, NOT absent -- the mutation that would have caught the bug", () => {
    const probe = probeYubiHsm2State(macEnumeratorsEmpty());
    expect(probe.state).toBe("indeterminate");
    expect(probe.state).not.toBe("absent");
    expect(yubiHsm2CheckRan(probe.state)).toBeFalse();
  });

  it("distinguishes empty from unavailable -- non-answers with different causes", () => {
    const gone = host({
      platform: "darwin",
      run: () => {
        throw new Error("absent");
      },
    });
    expect(enumerateDarwinUsb(gone).kind).toBe("unavailable");
    expect(enumerateDarwinUsb(macEnumeratorsEmpty()).kind).toBe("empty");
  });

  it("still refuses the tier -- unknown is fail-closed, never an optimistic YES", () => {
    const res = probeHardwareSecurity(macEnumeratorsEmpty({ exists: (q) => q === YUBIHSM_MODULE }));
    expect(res.yubiHsm2Detected).toBeFalse();
    expect(availableHardwareSealTiers(res)).toEqual([]);
  });
});

describe("the refusal must not claim absence it did not establish", () => {
  it("says the check did not run rather than claiming the device is absent", () => {
    const res = probeHardwareSecurity(macEnumeratorsEmpty({ exists: (q) => q === YUBIHSM_MODULE }));
    let message = "";
    try {
      assertHardwareSealTierAvailable("hardware-pkcs11", res);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("attach-state is UNKNOWN");
    expect(message).toContain("absence was NOT established");
    // It must ALSO still say the driver bought nothing -- an earlier revision of this
    // refusal replaced that clause instead of adding to it, and a test caught it.
    expect(message).toContain("a PKCS#11 driver alone is not a device");
  });

  it("keeps the empty case out of absent on Linux too", () => {
    const bare = host({ platform: "linux", readDir: () => [] });
    expect(probeYubiHsm2State(bare).state).toBe("indeterminate");
    const noProducts = host({
      platform: "linux",
      readDir: () => ["1-1", "1-2"],
      readFile: () => {
        throw new Error("absent");
      },
    });
    expect(probeYubiHsm2State(noProducts).state).toBe("indeterminate");
  });

  it("reports a REAL negative as absent when the bus was genuinely read", () => {
    const seen = host({
      platform: "darwin",
      run: (cmd) => {
        if (cmd === "ioreg") return "+-o Root|+-o USB Keyboard@00100000";
        throw new Error("absent");
      },
    });
    const probe = probeYubiHsm2State(seen);
    expect(probe.state).toBe("absent");
    expect(yubiHsm2CheckRan(probe.state)).toBeTrue();
  });
});

describe("ioreg is the primary enumerator and system_profiler the fallback", () => {
  const IOREG_WITH_HSM = "+-o Root|  +-o USB2.0 Hub@00142000|  +-o YubiHSM@00142200";

  it("finds the device through ioreg with system_profiler unusable", () => {
    const fx = host({
      platform: "darwin",
      run: (cmd) => {
        if (cmd === "ioreg") return IOREG_WITH_HSM;
        throw new Error("absent");
      },
    });
    const probe = probeYubiHsm2State(fx);
    expect(probe.state).toBe("attached");
    expect(probe.reason).toContain("ioreg");
  });

  it("falls back to system_profiler when ioreg returns empty", () => {
    const fx = host({
      platform: "darwin",
      run: (cmd, args) => {
        if (cmd === "ioreg") return "";
        if (cmd === "system_profiler" && args[0] === "SPUSBDataType") return MAC_USB_WITH_YUBIHSM;
        throw new Error("absent");
      },
    });
    expect(probeYubiHsm2State(fx).state).toBe("attached");
  });

  it("finds the device when system_profiler is the empty one -- the measured live case", () => {
    const fx = host({
      platform: "darwin",
      run: (cmd) => {
        if (cmd === "ioreg") return IOREG_WITH_HSM;
        if (cmd === "system_profiler") return "";
        throw new Error("absent");
      },
    });
    expect(probeYubiHsm2(fx)).toBeTrue();
  });
});

describe("a check that could NOT RUN is never a confident absent (mutation-driven)", () => {
  // Both of these survived a mutation run: the suite asserted the enumerator OUTCOME but
  // never the resulting STATE, so flipping either branch to "absent" went unnoticed.
  // "absent" is a claim about the hardware and only a completed look may make it.
  it("darwin: no enumerator can be run at all -> indeterminate, not absent", () => {
    const gone = host({
      platform: "darwin",
      run: () => {
        throw new Error("absent");
      },
    });
    expect(enumerateDarwinUsb(gone).kind).toBe("unavailable");
    const probe = probeYubiHsm2State(gone);
    expect(probe.state).toBe("indeterminate");
    expect(probe.state).not.toBe("absent");
    expect(yubiHsm2CheckRan(probe.state)).toBeFalse();
  });

  it("linux: the USB tree cannot be listed -> indeterminate, not absent", () => {
    const unlistable = host({
      platform: "linux",
      readDir: () => {
        throw new Error("permission denied");
      },
    });
    const probe = probeYubiHsm2State(unlistable);
    expect(probe.state).toBe("indeterminate");
    expect(probe.state).not.toBe("absent");
    expect(probe.reason).toContain("NOT consulted");
  });

  it("an unprobed platform is indeterminate, not absent", () => {
    const probe = probeYubiHsm2State(host({ platform: "win32" }));
    expect(probe.state).toBe("indeterminate");
    expect(yubiHsm2CheckRan(probe.state)).toBeFalse();
  });
});
