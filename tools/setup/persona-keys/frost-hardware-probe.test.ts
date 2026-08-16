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
  type HardwareProbeEffects,
} from "./frost-hardware-probe.ts";

// These tests used to be four `expect(typeof x).toBe("boolean")` assertions. Every one of
// them passed on any machine, in any state, for any implementation that returned an
// object — including an implementation that always answered "hardware present". They
// could not fail, so they proved nothing. The probe now takes an injected host
// (§13 noninterference), so a test can describe a machine and assert the ANSWER.

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
        return '+-o AppleSEPManager  <class AppleSEPManager, id 0x1000006ca, registered, matched, active>\n';
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
  it("finds /dev/tpmrm0 and offers hardware-tpm2", () => {
    const linuxTpm = host({ exists: (p) => p === "/dev/tpmrm0" });
    expect(probeTpm2(linuxTpm)).toEqual({ available: true, path: "/dev/tpmrm0" });
    const res = probeHardwareSecurity(linuxTpm);
    expect(res.noHardwareDetected).toBeFalse();
    expect(availableHardwareSealTiers(res)).toEqual(["hardware-tpm2"]);
    expect(() => assertHardwareSealTierAvailable("hardware-tpm2", res)).not.toThrow();
  });

  it("falls back to /sys/class/tpm and names the entry it found", () => {
    const sysfsTpm = host({
      exists: (p) => p === "/sys/class/tpm",
      readDir: (p) => (p === "/sys/class/tpm" ? ["tpm0"] : []),
    });
    expect(probeTpm2(sysfsTpm)).toEqual({ available: true, path: "/dev/tpm0" });
  });

  it("reports absent when /sys/class/tpm exists but is empty", () => {
    const emptySysfs = host({ exists: (p) => p === "/sys/class/tpm", readDir: () => [] });
    expect(probeTpm2(emptySysfs).available).toBeFalse();
  });

  it("reports absent on a bare machine", () => {
    expect(probeTpm2(host()).available).toBeFalse();
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
            exists: (p) => (tpm && p === "/dev/tpmrm0") || (driver && p === "/usr/lib/libykcs11.so"),
            readDir: (p) => (reader && p === "/sys/bus/usb/devices" ? ["1-1:1.0"] : []),
            readFile: () => (reader ? "0b\n" : "03\n"),
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
    const fx = host({ exists: (p) => p === "/dev/tpmrm0" });
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
    if (!res.tpm2Available && !res.yubikeyDetected && !res.smartCardReaderAttached) {
      expect(res.noHardwareDetected).toBeTrue();
    }
    // Whatever this machine is, a tier is offered only when its device is present.
    const tiers = availableHardwareSealTiers(res);
    if (tiers.includes("hardware-tpm2")) expect(res.tpm2Available).toBeTrue();
    if (tiers.includes("hardware-pkcs11")) expect(res.pkcs11ModuleFound).toBeTrue();
    if (res.noHardwareDetected) expect(tiers).toEqual([]);
  });

  it("agrees with the platform: darwin never has a TPM 2.0", () => {
    const fx = realProbeEffects();
    if (fx.platform === "darwin") {
      expect(probeTpm2(fx).available).toBeFalse();
    }
  });
});
