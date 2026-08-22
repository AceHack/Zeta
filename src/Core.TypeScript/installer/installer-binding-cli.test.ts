import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  bindingFactorSidecarPath,
  RESTORE_BINDING_SERIAL,
  selectCliBindingMaterial,
  selectInstallPersistBinding,
  selectRestoreBinding,
} from "./installer-binding-cli.ts";
import { UEFI_KEYFILE_BYTES, UEFI_KEYFILE_SERIAL } from "./uefi-keyfile-esp.ts";
import { readUsbSysfsDevice, USB_ISERIAL_SERIAL } from "./usb-iserial-probe.ts";
import { parseUuidFromDiskutilInfo } from "../zflash/lib.ts";

describe("selectCliBindingMaterial", () => {
  it("defaults to usbUuid", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: "uuid-1",
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbUuid");
    expect(selected.material).toBe("uuid-1");
  });

  it("prefers usbISerial over uuid when set", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: "uuid-1",
      usbISerial: "ZETA-STICK-001",
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbISerial");
    expect(selected.material).toBe("ZETA-STICK-001");
  });

  it("rejects iserial and keyfile together", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: "AAA",
      uefiKeyfileBytes: new Uint8Array(UEFI_KEYFILE_BYTES).fill(1),
    });
    expect("error" in selected).toBe(true);
  });

  it("errors when no factor is present", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(true);
  });
});

describe("boundary whitespace is REJECTED -- not rewritten, not accepted", () => {
  // The fast falsifier for a value that reached main twice in one day in two different
  // directions. key-refusal-falsifier.test.ts covers it end-to-end, but that test spawns
  // two CLIs and pays scrypt N=2^17 twice (~600ms); here it is a string comparison.
  //
  // The property is that key material is never silently altered AND never silently
  // mis-taken. `.trim()` fails the first; bare acceptance fails the second, by turning a
  // typo into a lockout discovered at restore time. An error fails neither.
  const uuid = "AAAAAAAA-1111-2222-3333-444444444444";

  it("refuses a usbUuid with a trailing space rather than trimming it", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: `${uuid} `,
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(true);
  });

  it("refuses a usbUuid with a leading space too -- the boundary, not just the tail", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: ` ${uuid}`,
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(true);
  });

  it("refuses a usbISerial with a trailing newline rather than trimming it", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: "ZETA-STICK-001\n",
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(true);
  });

  it("says WHY, so the operator can fix it instead of being locked out later", () => {
    // The whole argument for rejecting over accepting is that the operator finds out now,
    // with the input still in front of them. A bare non-zero exit would not deliver that,
    // so the message is part of the contract and gets an assertion.
    const selected = selectCliBindingMaterial({
      usbUuid: `${uuid} `,
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(true);
    if (!("error" in selected)) return;
    expect(selected.error).toContain("whitespace");
    expect(selected.error).toContain("--usb-uuid");
  });

  it("passes a clean value through byte-for-byte", () => {
    // The rejection must not become its own quiet normalization. A value with no boundary
    // whitespace reaches the KDF exactly as supplied.
    const selected = selectCliBindingMaterial({ usbUuid: uuid, usbISerial: null, uefiKeyfileBytes: null });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.material).toBe(uuid);
  });

  it("leaves INTERIOR whitespace alone -- a serial may legitimately contain a space", () => {
    // Scope discipline: only the class the old `.trim()` silently absorbed is refused.
    // Inventing an opinion about the middle of an identity would refuse real devices.
    const selected = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: "ZETA STICK 001",
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.material).toBe("ZETA STICK 001");
  });

  it("still treats a whitespace-ONLY value as no factor at all", () => {
    // "   " carries no identity -- it is a typo or an empty shell variable -- so it is
    // absence, not a malformed value. Different error, deliberately.
    const selected = selectCliBindingMaterial({
      usbUuid: "   ",
      usbISerial: null,
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(true);
    if (!("error" in selected)) return;
    expect(selected.error).toContain("binding factor required");
  });

  // The above decides "whitespace-only == absence". That is deliberate and it is the rule
  // this block follows. What was never written down is what the rule COSTS when a second
  // factor is present, and the cost is not obvious from either the rule or the header.
  it("a whitespace-only iserial is absence, so it does not conflict with a keyfile", () => {
    const selected = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: "   ",
      uefiKeyfileBytes: new Uint8Array(UEFI_KEYFILE_BYTES).fill(1),
    });

    // Not an error: `hasIserial` is false, so the mutual-exclusion guard never fires and
    // the keyfile is the only factor left standing. Consistent with "absence".
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("uefiKeyfile");
  });

  it("...which means an unset shell variable silently CHANGES the binding factor", () => {
    // `--usb-iserial "$SERIAL" --uefi-keyfile k` with SERIAL unset. The operator asked to
    // bind to a specific USB device; the blob is bound to the keyfile instead, with no
    // diagnostic. Nobody is locked out -- the factor is recorded, so restore agrees -- but
    // the binding an operator BELIEVES they have is not the one they have.
    //
    // This test does not argue for changing that. It pins the consequence so the choice is
    // visible: if "absence" is right, this passes and documents the trade; if the trade is
    // judged wrong, this is the test that turns red and names exactly what changed.
    const asked = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: "",
      uefiKeyfileBytes: new Uint8Array(UEFI_KEYFILE_BYTES).fill(1),
    });
    const supplied = selectCliBindingMaterial({
      usbUuid: null,
      usbISerial: null,
      uefiKeyfileBytes: new Uint8Array(UEFI_KEYFILE_BYTES).fill(1),
    });

    // Passing the flag with an empty value is indistinguishable from never passing it.
    expect(asked).toEqual(supplied);
  });
});

describe("probe-canonicalization-is-the-single-authority", () => {
  // This is the test the rejection above LEANS ON, and without it that rejection is a
  // plausibility argument rather than a checked one.
  //
  // Refusing boundary whitespace is only safe because no real device can present it: each
  // source canonicalizes where the artefact is born, so the CLI never sees one. If a probe
  // ever stops doing that, the rejection would begin refusing genuine hardware -- a
  // self-inflicted outage that would look like a hardware fault. So the probes' guarantee
  // is pinned here, next to the code that depends on it, rather than assumed.
  it("diskutil parsing cannot emit boundary whitespace, even from padded input", () => {
    const padded = "   Volume UUID:               ABCD-1234   \n";
    const parsed = parseUuidFromDiskutilInfo(padded);
    expect(parsed).not.toBeNull();
    expect(parsed).toBe("ABCD-1234");
    expect(parsed).toBe(parsed!.trim());
  });

  it("a diskutil value that survived with whitespace would be rejected as malformed", () => {
    // Belt and braces: the UUID regex is total, so a spaced value cannot get through at
    // all. This pins that it fails CLOSED (null) rather than falling back to the raw text.
    expect(parseUuidFromDiskutilInfo("Volume UUID:  ABCD 1234\n")).toBeNull();
  });

  it("sysfs iSerial parsing strips the trailing newline at the source", () => {
    const device = readUsbSysfsDevice("/sys/bus/usb/devices", "1-1", (path) =>
      path.endsWith("/serial") ? "ZETA-STICK-001\n" : null,
    );
    expect(device.serial).toBe("ZETA-STICK-001");
    expect(device.serial).toBe(device.serial!.trim());
  });
});

describe("selectInstallPersistBinding", () => {
  it("keeps FAT UUID when the opt-in is off even if a serial was probed", () => {
    const selected = selectInstallPersistBinding({
      usbUuid: "uuid-1",
      probedISerial: "ZETA-QEMU-001",
      bindUsbISerial: false,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbUuid");
    expect(selected.flag).toBe("--usb-uuid");
    expect(selected.material).toBe("uuid-1");
    expect(selected.marker).toBe(USB_ISERIAL_SERIAL.persistDefaultUuid);
  });

  it("binds probed iSerial only when ZETA_BIND_USB_ISERIAL is on", () => {
    const selected = selectInstallPersistBinding({
      usbUuid: "uuid-1",
      probedISerial: "ZETA-QEMU-001",
      bindUsbISerial: true,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbISerial");
    expect(selected.flag).toBe("--usb-iserial");
    expect(selected.material).toBe("ZETA-QEMU-001");
    expect(selected.marker).toBe(USB_ISERIAL_SERIAL.persistOptInIserial);
  });

  it("falls back to UUID when opt-in is on but the probe produced nothing", () => {
    const selected = selectInstallPersistBinding({
      usbUuid: "uuid-1",
      probedISerial: null,
      bindUsbISerial: true,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbUuid");
    expect(selected.marker).toBe(USB_ISERIAL_SERIAL.persistOptInFallbackUuid);
  });

  it("refuses to bind an iSerial with boundary whitespace rather than trimming it", () => {
    const selected = selectInstallPersistBinding({
      usbUuid: "uuid-1",
      probedISerial: "ZETA-QEMU-001\n",
      bindUsbISerial: true,
    });
    expect("error" in selected).toBe(true);
  });

  it("binds the ESP keyfile path when ZETA_BIND_UEFI_KEYFILE write succeeded", () => {
    const selected = selectInstallPersistBinding({
      usbUuid: "uuid-1",
      probedISerial: null,
      bindUsbISerial: false,
      bindUefiKeyfile: true,
      uefiKeyfilePath: "/mnt/boot/EFI/ZETA/keyfile",
      uefiKeyfileWritten: true,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("uefiKeyfile");
    expect(selected.flag).toBe("--uefi-keyfile");
    expect(selected.material).toBe("/mnt/boot/EFI/ZETA/keyfile");
    expect(selected.marker).toBe(UEFI_KEYFILE_SERIAL.persistOptInKeyfile);
  });

  it("falls back to UUID when keyfile opt-in is on but the write failed", () => {
    const selected = selectInstallPersistBinding({
      usbUuid: "uuid-1",
      probedISerial: null,
      bindUsbISerial: false,
      bindUefiKeyfile: true,
      uefiKeyfilePath: "/mnt/boot/EFI/ZETA/keyfile",
      uefiKeyfileWritten: false,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbUuid");
    expect(selected.marker).toBe(UEFI_KEYFILE_SERIAL.persistOptInFallbackUuid);
  });

  it("stays UUID when both bind opt-ins are set rather than guessing", () => {
    const selected = selectInstallPersistBinding({
      usbUuid: "uuid-1",
      probedISerial: "ZETA-QEMU-001",
      bindUsbISerial: true,
      bindUefiKeyfile: true,
      uefiKeyfilePath: "/mnt/boot/EFI/ZETA/keyfile",
      uefiKeyfileWritten: true,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbUuid");
    expect(selected.marker).toBe(UEFI_KEYFILE_SERIAL.persistBothOptInsUuid);
  });
});

describe("selectRestoreBinding", () => {
  it("defaults to FAT UUID when the sidecar is missing", () => {
    const selected = selectRestoreBinding({
      recordedFactorRaw: null,
      usbUuid: "uuid-1",
      recordedISerial: "ZETA-QEMU-001",
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbUuid");
    expect(selected.flag).toBe("--usb-uuid");
    expect(selected.material).toBe("uuid-1");
    expect(selected.marker).toBe(RESTORE_BINDING_SERIAL.defaultUuid);
  });

  it("uses recorded iSerial and refuses UUID fallback when the sidecar says usbISerial", () => {
    const selected = selectRestoreBinding({
      recordedFactorRaw: "usbISerial\n",
      usbUuid: "uuid-1",
      recordedISerial: "ZETA-QEMU-001",
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("usbISerial");
    expect(selected.flag).toBe("--usb-iserial");
    expect(selected.material).toBe("ZETA-QEMU-001");
    expect(selected.marker).toBe(RESTORE_BINDING_SERIAL.iserial);
  });

  it("fails closed when sidecar says usbISerial but the serial file is missing", () => {
    const selected = selectRestoreBinding({
      recordedFactorRaw: "usbISerial",
      usbUuid: "uuid-1",
      recordedISerial: null,
    });
    expect("error" in selected).toBe(true);
    if (!("error" in selected)) return;
    expect(selected.marker).toBe(RESTORE_BINDING_SERIAL.iserialMissing);
  });

  it("does not decrypt an iSerial blob with the stored UUID", () => {
    const selected = selectRestoreBinding({
      recordedFactorRaw: "usbISerial",
      usbUuid: "uuid-1",
      recordedISerial: "",
    });
    expect("error" in selected).toBe(true);
  });

  it("restores from the ESP keyfile path when the sidecar says uefiKeyfile", () => {
    const bytes = new Uint8Array(UEFI_KEYFILE_BYTES).fill(0xab);
    const selected = selectRestoreBinding({
      recordedFactorRaw: "uefiKeyfile\n",
      usbUuid: "uuid-1",
      recordedISerial: null,
      uefiKeyfilePath: "/boot/EFI/ZETA/keyfile",
      uefiKeyfileBytes: bytes,
    });
    expect("error" in selected).toBe(false);
    if ("error" in selected) return;
    expect(selected.factor).toBe("uefiKeyfile");
    expect(selected.flag).toBe("--uefi-keyfile");
    expect(selected.material).toBe("/boot/EFI/ZETA/keyfile");
    expect(selected.marker).toBe(RESTORE_BINDING_SERIAL.uefi);
  });

  it("fails closed when sidecar says uefiKeyfile but the ESP file is missing", () => {
    const selected = selectRestoreBinding({
      recordedFactorRaw: "uefiKeyfile",
      usbUuid: "uuid-1",
      recordedISerial: null,
      uefiKeyfilePath: "/boot/EFI/ZETA/keyfile",
      uefiKeyfileBytes: null,
    });
    expect("error" in selected).toBe(true);
    if (!("error" in selected)) return;
    expect(selected.marker).toBe(RESTORE_BINDING_SERIAL.uefiMissing);
  });

  it("does not decrypt a keyfile blob with the stored UUID", () => {
    const selected = selectRestoreBinding({
      recordedFactorRaw: "uefiKeyfile",
      usbUuid: "uuid-1",
      recordedISerial: null,
      uefiKeyfilePath: null,
      uefiKeyfileBytes: new Uint8Array(UEFI_KEYFILE_BYTES).fill(1),
    });
    expect("error" in selected).toBe(true);
    if (!("error" in selected)) return;
    expect(selected.marker).toBe(RESTORE_BINDING_SERIAL.uefiMissing);
  });
});

describe("bindingFactorSidecarPath", () => {
  it("maps zeta-creds.enc to zeta-creds.factor", () => {
    expect(bindingFactorSidecarPath("/boot/zeta-creds.enc")).toBe("/boot/zeta-creds.factor");
    expect(bindingFactorSidecarPath("/mnt/boot/zeta-creds.enc")).toBe("/mnt/boot/zeta-creds.factor");
  });
});

describe("restore.nix stays coupled to the restore-binding markers", () => {
  const nix = readFileSync(
    resolve(import.meta.dir, "../../../full-ai-cluster/nixos/modules/zeta-creds-restore.nix"),
    "utf8",
  );

  it("refuses UUID fallback when iSerial was recorded", () => {
    expect(nix).toContain(RESTORE_BINDING_SERIAL.iserialMissing);
    expect(nix).toContain(RESTORE_BINDING_SERIAL.iserial);
    expect(nix).toContain(RESTORE_BINDING_SERIAL.defaultUuid);
    expect(nix).toContain("$BIND_FLAG");
    expect(nix).toContain("factorPath");
    expect(nix).toContain("/boot/zeta-creds.factor");
    expect(nix).toContain("/etc/zeta/usb-iserial");
  });

  it("wires UEFI keyfile restore and refuses UUID fallback", () => {
    expect(nix).toContain(RESTORE_BINDING_SERIAL.uefi);
    expect(nix).toContain(RESTORE_BINDING_SERIAL.uefiMissing);
    expect(nix).toContain("/boot/EFI/ZETA/keyfile");
    expect(nix).toContain("--uefi-keyfile");
    expect(nix).not.toContain("uefiKeyfile restore is not wired");
  });
});
