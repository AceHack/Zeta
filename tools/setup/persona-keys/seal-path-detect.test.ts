/**
 * seal-path-detect.test.ts — falsifiers for the look→decision join.
 *
 * These run in CI, on described machines, BEFORE any of it meets metal
 * (Aaron 2026-09-08: "i'm talking about testing in CI before on hardware").
 * Each test names a host and asserts the SEAL PATH that host should get, so a
 * joiner that ignored the probe would fail rather than pass on shape.
 *
 * The load-bearing one is `the look is actually consulted` at the bottom: it
 * pins that the SAME machine yields DIFFERENT decisions under `--effects real`
 * and `--effects null`. A join that never read the probe would satisfy every
 * other test in this file and fail only that one.
 */

import { describe, expect, it } from "bun:test";
import { joinLookToDecision, requestEnvFromArgv, runSealPathDetectCli, UNSEAL_REQUEST_KEY } from "./seal-path-detect.ts";
import { PKCS11_TOKEN_LIBRARY_PATHS, type HardwareProbeEffects } from "./frost-hardware-probe.ts";
import type { ListOutcome, PathOutcome, Tpm2LinuxEffects } from "./tpm2-linux-probe.ts";

/** A Linux TPM door that enumerated and found no chip — a real negative. */
function tpm2Absent(over: Partial<Tpm2LinuxEffects> = {}): Tpm2LinuxEffects {
  return {
    platform: "linux",
    statPath: () => ({ kind: "not-found" }) as PathOutcome,
    listDir: (p) => (p === "/sys/class/tpm" ? ({ kind: "listed", entries: [] } as ListOutcome) : { kind: "not-found" }),
    readText: () => ({ kind: "not-found" }),
    run: () => ({ kind: "not-installed" }),
    ...over,
  };
}

/** A Linux TPM door with a family-2.0 chip confirmed, not merely a node. */
function tpm2Present(): Tpm2LinuxEffects {
  return tpm2Absent({
    statPath: () => ({ kind: "found" }),
    listDir: (p) =>
      p === "/sys/class/tpm" ? ({ kind: "listed", entries: ["tpm0", "tpmrm0"] } as ListOutcome) : { kind: "not-found" },
    readText: (p) => (p.endsWith("tpm_version_major") ? { kind: "read", text: "2\n" } : { kind: "not-found" }),
  });
}

/** A machine with nothing on it. Each test adds only what it is about. */
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
    tpm2: over.tpm2 ?? tpm2Absent({ platform: over.platform ?? "linux" }),
  };
}

/** A Linux box whose USB tree enumerates, with or without the HSM on it. */
function linuxUsb(product: string, over: Partial<HardwareProbeEffects> = {}): HardwareProbeEffects {
  return host({
    platform: "linux",
    readDir: (p) => (p === "/sys/bus/usb/devices" ? ["usb1", "1-2"] : []),
    readFile: (p) => {
      if (p === "/sys/bus/usb/devices/usb1/product") return "xHCI Host Controller";
      if (p === "/sys/bus/usb/devices/1-2/product") return product;
      throw new Error("no such file");
    },
    ...over,
  });
}

const WITH_HSM = () => linuxUsb("YubiHSM");
const NO_HSM = () => linuxUsb("Generic USB Hub");

function detect(argv: readonly string[], fx: HardwareProbeEffects, env: Record<string, string | undefined> = {}) {
  const lines: string[] = [];
  const code = runSealPathDetectCli(argv, env, fx, (l) => lines.push(l));
  return { code, body: JSON.parse(lines.join("")) };
}

describe("a live look reaches a seal path", () => {
  it("names pkcs11-yubihsm when the USB tree holds a YubiHSM", () => {
    const { code, body } = detect(["--os", "nixos", "--effects", "real", "--request", "auto"], WITH_HSM());
    expect(code).toBe(0);
    expect(body.probe.yubiHsm2).toBe("attached");
    expect(body.decision).toMatchObject({ ok: true, path: "pkcs11-yubihsm", autoUnseal: true });
    expect(body.ladder).toBe("hsm");
  });

  it("names pkcs11-tpm when the chip is family-2.0 confirmed and no HSM is attached", () => {
    const fx = linuxUsb("Generic USB Hub", { tpm2: tpm2Present() });
    const { body } = detect(["--os", "nixos", "--effects", "real", "--request", "auto"], fx);
    expect(body.probe.tpm2).toBe("present");
    expect(body.decision).toMatchObject({ ok: true, path: "pkcs11-tpm" });
    expect(body.ladder).toBe("tpm");
  });

  it("falls to lucent-shamir when both looks ran and found nothing", () => {
    const { body } = detect(["--os", "nixos", "--effects", "real", "--request", "auto"], NO_HSM());
    expect(body.probe.yubiHsm2).toBe("absent");
    expect(body.decision).toMatchObject({ ok: true, path: "lucent-shamir" });
    expect(body.ladder).toBe("sidecar");
  });

  it("HSM attached with TPM present still picks hsm (one seal)", () => {
    const fx = linuxUsb("YubiHSM", { tpm2: tpm2Present() });
    const { body } = detect(["--os", "nixos", "--effects", "real", "--request", "auto"], fx);
    expect(body.decision).toMatchObject({ ok: true, path: "pkcs11-yubihsm" });
    expect(body.ladder).toBe("hsm");
  });
});

describe("unmeasured is never rounded to a value", () => {
  it("a look that did not happen yields probe-did-not-run, not a path", () => {
    const { code, body } = detect(["--os", "nixos", "--effects", "null", "--request", "auto"], WITH_HSM());
    expect(code).toBe(0);
    expect(body.probe).toBeNull();
    expect(body.decision).toMatchObject({ ok: false, reason: "probe-did-not-run" });
    expect(body.ladder).toBeNull();
  });

  it("a missing request is unmeasured, NOT auto", () => {
    const { body } = detect(["--os", "nixos", "--effects", "real"], WITH_HSM());
    expect(body.requested).toBeNull();
    expect(body.decision).toBeNull();
    expect(body.ladder).toBeNull();
  });

  it("a PKCS#11 driver on disk is not a device", () => {
    const lib = PKCS11_TOKEN_LIBRARY_PATHS[0] as string;
    const fx = linuxUsb("Generic USB Hub", { exists: (p) => p === lib });
    const { body } = detect(["--os", "nixos", "--effects", "real", "--request", "pkcs11-hsm"], fx);
    expect(body.probe.pkcs11ModuleOnDisk).toBeTrue();
    expect(body.decision).toMatchObject({ ok: false, reason: "driver-is-not-a-device" });
    expect(body.ladder).toBeNull();
  });

  it("an emulator is declared by the install matrix, never detected", () => {
    const { body } = detect(["--os", "nixos", "--effects", "real", "--request", "ci-softhsm"], WITH_HSM());
    expect(body.decision).toMatchObject({ ok: false, reason: "emulator-not-declared" });
    expect(body.ladder).toBeNull();
  });

  it("smartcardHsm stays not-asked — the CardContact probe is not run by the frost look", () => {
    const { body } = detect(["--os", "nixos", "--effects", "real", "--request", "auto"], WITH_HSM());
    expect(body.probe.smartcardHsm).toBe("not-asked");
  });
});

describe("unparseable input exits 2 and decides nothing", () => {
  it("refuses an unknown OS", () => {
    const { code, body } = detect(["--os", "notanos", "--effects", "real"], WITH_HSM());
    expect(code).toBe(2);
    expect(body).toMatchObject({ ok: false, reason: "unknown-os" });
  });

  it("refuses a device node as a request", () => {
    const { code, body } = detect(["--os", "nixos", "--effects", "real", "--request", "/dev/tpmrm0"], WITH_HSM());
    expect(code).toBe(2);
    expect(body).toMatchObject({ ok: false, reason: "unknown-request" });
  });
});

describe("requestEnvFromArgv", () => {
  it("leaves env untouched when the flag is absent — missing is unmeasured", () => {
    expect(requestEnvFromArgv(["--os", "nixos"], {})[UNSEAL_REQUEST_KEY]).toBeUndefined();
  });

  it("does not treat a flag with no value as absent", () => {
    expect(requestEnvFromArgv(["--request"], {})[UNSEAL_REQUEST_KEY]).toBe("");
  });

  it("carries the value through", () => {
    expect(requestEnvFromArgv(["--request", "auto"], {})[UNSEAL_REQUEST_KEY]).toBe("auto");
  });
});

describe("the look is actually consulted", () => {
  // The falsifier that a join ignoring its probe would fail, and only this one.
  it("the SAME machine decides differently under a real look and a null look", () => {
    const real = detect(["--os", "nixos", "--effects", "real", "--request", "auto"], WITH_HSM()).body.decision;
    const none = detect(["--os", "nixos", "--effects", "null", "--request", "auto"], WITH_HSM()).body.decision;
    expect(real).not.toEqual(none);
    expect(real.ok).toBeTrue();
    expect(none.ok).toBeFalse();
  });

  // And that two DIFFERENT machines under the same flags decide differently —
  // pinning that the answer tracks the host, not the arguments.
  it("two different machines under identical flags reach different paths", () => {
    const argv = ["--os", "nixos", "--effects", "real", "--request", "auto"];
    expect(detect(argv, WITH_HSM()).body.decision.path).toBe("pkcs11-yubihsm");
    expect(detect(argv, WITH_HSM()).body.ladder).toBe("hsm");
    expect(detect(argv, NO_HSM()).body.decision.path).toBe("lucent-shamir");
    expect(detect(argv, NO_HSM()).body.ladder).toBe("sidecar");
  });
});

describe("joinLookToDecision is reachable without argv", () => {
  it("refuses a parse failure without consulting the host", () => {
    let looked = false;
    const fx = host({
      readDir: () => {
        looked = true;
        return [];
      },
    });
    const out = joinLookToDecision({ ok: false, reason: "unknown-os" } as never, {}, fx);
    expect(out.code).toBe(2);
    expect(looked).toBeFalse();
  });
});
