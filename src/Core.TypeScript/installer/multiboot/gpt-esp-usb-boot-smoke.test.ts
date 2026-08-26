import { describe, expect, it } from "bun:test";
import { ESP_TYPE_GUID, MSFT_BASIC_DATA_TYPE_GUID } from "./gpt-esp.ts";
import {
  DEVLIST_BEGIN,
  DEVLIST_END,
  GPT_ESP_BOOT_MARKER,
  SECOND_STICK_SERIAL,
  SMOKE_MUTATIONS,
  enumerationMatches,
  gptEspGrubCfg,
  parseGrubDeviceList,
  parseMutation,
  sfdiskAgreesWithGpt,
} from "./gpt-esp-usb-boot-smoke.ts";
import { planQemuUeFiBootArgs } from "./assemble.ts";
import { UEFI_MENU_MARKER } from "./qemu-uefi-menu-smoke.ts";

describe("gpt-esp-usb-boot-smoke: the marker", () => {
  it("is distinct from the vvfat lane's marker", () => {
    // Two lanes, two claims. A shared marker would let one lane's log be read
    // as evidence for the other's — the boot that was never observed.
    expect(GPT_ESP_BOOT_MARKER).not.toBe(UEFI_MENU_MARKER);
    expect(GPT_ESP_BOOT_MARKER.includes(UEFI_MENU_MARKER)).toBe(false);
    expect(UEFI_MENU_MARKER.includes(GPT_ESP_BOOT_MARKER)).toBe(false);
  });

  it("is emitted by grub.cfg over serial unit 0", () => {
    const cfg = gptEspGrubCfg();
    expect(cfg).toContain(`echo ${GPT_ESP_BOOT_MARKER}`);
    expect(cfg).toContain("serial --unit=0");
    expect(cfg).toContain("terminal_output serial");
  });
});

describe("gpt-esp-usb-boot-smoke: the mutation knob fails closed", () => {
  it("treats absent/empty as none", () => {
    expect(parseMutation(undefined)).toEqual({ ok: true, mutation: "none" });
    expect(parseMutation("")).toEqual({ ok: true, mutation: "none" });
    expect(parseMutation("   ")).toEqual({ ok: true, mutation: "none" });
  });

  it("accepts exactly the declared mutations", () => {
    for (const m of SMOKE_MUTATIONS) {
      expect(parseMutation(m)).toEqual({ ok: true, mutation: m });
    }
  });

  it("REFUSES an unrecognised value rather than silently defaulting to none", () => {
    // The failure this pins: a typo'd knob reading as "no mutation" would make
    // a demonstration run report green while never mutating anything.
    for (const bad of ["off", "true", "1", "esp_type_guid", "ESP-TYPE-GUID", "remove-loder"]) {
      const parsed = parseMutation(bad);
      expect(parsed.ok).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.error).toContain(bad);
    }
  });
});

describe("gpt-esp-usb-boot-smoke: sfdisk cross-check", () => {
  const good = {
    partitiontable: {
      label: "gpt",
      partitions: [{ node: "img1", start: 2048, size: 98304, type: ESP_TYPE_GUID }],
    },
  };

  it("accepts a single ESP at the expected LBA", () => {
    expect(sfdiskAgreesWithGpt(good, { typeGuid: ESP_TYPE_GUID, startLba: 2048 })).toEqual({
      ok: true,
    });
  });

  it("accepts the type GUID case-insensitively (util-linux prints upper case)", () => {
    const upper = {
      partitiontable: {
        label: "gpt",
        partitions: [{ start: 2048, type: ESP_TYPE_GUID.toUpperCase() }],
      },
    };
    expect(sfdiskAgreesWithGpt(upper, { typeGuid: ESP_TYPE_GUID, startLba: 2048 }).ok).toBe(true);
  });

  it("rejects the Microsoft-basic-data mutant", () => {
    const mutant = {
      partitiontable: {
        label: "gpt",
        partitions: [{ start: 2048, type: MSFT_BASIC_DATA_TYPE_GUID }],
      },
    };
    const result = sfdiskAgreesWithGpt(mutant, { typeGuid: ESP_TYPE_GUID, startLba: 2048 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("expected c12a7328");
  });

  it("rejects a wrong start LBA", () => {
    const result = sfdiskAgreesWithGpt(good, { typeGuid: ESP_TYPE_GUID, startLba: 34 });
    expect(result.ok).toBe(false);
  });

  it("rejects an MBR-labelled table", () => {
    const dos = { partitiontable: { label: "dos", partitions: [{ start: 2048 }] } };
    expect(sfdiskAgreesWithGpt(dos, { typeGuid: ESP_TYPE_GUID, startLba: 2048 }).ok).toBe(false);
  });

  it("rejects zero partitions and more than one", () => {
    const none = { partitiontable: { label: "gpt", partitions: [] } };
    expect(sfdiskAgreesWithGpt(none, { typeGuid: ESP_TYPE_GUID, startLba: 2048 }).ok).toBe(false);
    const two = {
      partitiontable: {
        label: "gpt",
        partitions: [
          { start: 2048, type: ESP_TYPE_GUID },
          { start: 40960, type: ESP_TYPE_GUID },
        ],
      },
    };
    expect(sfdiskAgreesWithGpt(two, { typeGuid: ESP_TYPE_GUID, startLba: 2048 }).ok).toBe(false);
  });

  it("rejects output with no partitiontable at all, rather than reading absence as agreement", () => {
    expect(sfdiskAgreesWithGpt({}, { typeGuid: ESP_TYPE_GUID, startLba: 2048 }).ok).toBe(false);
    const missingPartitions = { partitiontable: { label: "gpt" } };
    expect(
      sfdiskAgreesWithGpt(missingPartitions, { typeGuid: ESP_TYPE_GUID, startLba: 2048 }).ok,
    ).toBe(false);
  });

  it("rejects an entry with no type field", () => {
    const untyped = { partitiontable: { label: "gpt", partitions: [{ start: 2048 }] } };
    const result = sfdiskAgreesWithGpt(untyped, { typeGuid: ESP_TYPE_GUID, startLba: 2048 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("(none)");
  });
});

describe("gpt-esp-usb-boot-smoke: GRUB device-list parsing (MAN-USB-02 premise)", () => {
  const wrap = (body: string): string =>
    `boot noise\n${DEVLIST_BEGIN}\n${body}\n${DEVLIST_END}\nmore noise`;

  it("counts one disk from a single-stick listing", () => {
    const log = wrap("(hd0) (hd0,gpt1)");
    expect(parseGrubDeviceList(log)).toEqual(["hd0"]);
    expect(enumerationMatches(log, 1)).toEqual({ ok: true, disks: ["hd0"] });
  });

  it("counts two disks from a two-stick listing", () => {
    const log = wrap("(hd0) (hd0,gpt1) (hd1) (hd1,gpt1)");
    expect(parseGrubDeviceList(log)).toEqual(["hd0", "hd1"]);
    expect(enumerationMatches(log, 2).ok).toBe(true);
  });

  it("does not count partitions as extra disks", () => {
    const log = wrap("(hd0) (hd0,gpt1) (hd0,gpt2) (hd0,gpt3)");
    expect(enumerationMatches(log, 1).ok).toBe(true);
  });

  it("reports the collapse when two sticks show as one disk", () => {
    const log = wrap("(hd0) (hd0,gpt1)");
    const result = enumerationMatches(log, 2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("enumerated 1 disk(s)");
  });

  it("returns null — never an empty list — when the delimiters are absent", () => {
    // The trap: an unparseable log reading as "zero devices" would satisfy any
    // upper-bound-only expectation, so absence must be distinguishable.
    expect(parseGrubDeviceList("no markers at all")).toBeNull();
    expect(parseGrubDeviceList(`${DEVLIST_BEGIN} (hd0)`)).toBeNull();
    const truncated = enumerationMatches(`${DEVLIST_BEGIN}\n(hd0)`, 1);
    expect(truncated.ok).toBe(false);
    if (truncated.ok) return;
    expect(truncated.error).toContain("absent from serial log");
  });

  it("ignores device tokens printed outside the delimiters", () => {
    const log = `(hd7) (hd8)\n${wrap("(hd0)")}\n(hd9)`;
    expect(parseGrubDeviceList(log)).toEqual(["hd0"]);
  });
});

describe("planQemuUeFiBootArgs: additional USB sticks", () => {
  const base = {
    outputImagePath: "/tmp/a.img",
    ovmfCodePath: "/usr/share/OVMF/OVMF_CODE.fd",
    ovmfVarsPath: "/tmp/OVMF_VARS.fd",
  } as const;

  it("leaves the single-stick argv byte-identical when no extras are given", () => {
    const without = planQemuUeFiBootArgs({ ...base, media: "usb" });
    const withEmpty = planQemuUeFiBootArgs({ ...base, media: "usb", additionalUsbImages: [] });
    expect(without.ok && withEmpty.ok).toBe(true);
    if (!without.ok || !withEmpty.ok) return;
    expect(withEmpty.args).toEqual(without.args);
  });

  it("attaches a second stick with a distinct drive id and boot index", () => {
    const planned = planQemuUeFiBootArgs({
      ...base,
      media: "usb",
      additionalUsbImages: [{ imagePath: "/tmp/b.img", serial: SECOND_STICK_SERIAL }],
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) return;
    const joined = planned.args.join(" ");
    expect(joined).toContain("drive=stick,bootindex=1");
    expect(joined).toContain("drive=stick2,bootindex=2");
    expect(joined).toContain(`serial=${SECOND_STICK_SERIAL}`);
    expect(joined).toContain("id=stick2,file=/tmp/b.img");
    // One xHCI controller, both sticks on it.
    expect(planned.args.filter((a) => a === "qemu-xhci,id=xhci").length).toBe(1);
  });

  it("refuses a second stick that reuses the first stick's iSerial", () => {
    // Two devices with one iSerial IS the collapse the phase is looking for.
    // Manufacturing it in the harness would make the finding meaningless.
    const planned = planQemuUeFiBootArgs({
      ...base,
      media: "usb",
      usbSerial: "ZETA-QEMU-001",
      additionalUsbImages: [{ imagePath: "/tmp/b.img", serial: "ZETA-QEMU-001" }],
    });
    expect(planned.ok).toBe(false);
    if (planned.ok) return;
    expect(planned.error).toContain("reuses iSerial");
  });

  it("refuses extra sticks on non-usb media rather than dropping them", () => {
    for (const media of ["virtio", "vfat-dir"] as const) {
      const planned = planQemuUeFiBootArgs({
        ...base,
        media,
        additionalUsbImages: [{ imagePath: "/tmp/b.img", serial: SECOND_STICK_SERIAL }],
      });
      expect(planned.ok).toBe(false);
    }
  });

  it("refuses an empty extra image path", () => {
    const planned = planQemuUeFiBootArgs({
      ...base,
      media: "usb",
      additionalUsbImages: [{ imagePath: "   ", serial: SECOND_STICK_SERIAL }],
    });
    expect(planned.ok).toBe(false);
  });
});
