import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TPM_CHAR_DEVICE } from "../../cluster/bao-load-site.ts";
import { NIXOS_HOST_BAO, nixosHostBaoAsk } from "../firstboot-bao-elf.ts";
import { DEFAULT_QEMU_USB_UUID, parsePrepareBootImageArgs, writeTestCredentialBlob } from "./prepare-boot-image";
import { planQcow2SnapshotRetention } from "./qemu-state";
import { B0891_RETENTION_USB_SERIAL_MARKERS } from "./serial-markers";

describe("parsePrepareBootImageArgs", () => {
  const required = ["--iso", "installer.iso", "--output", "out.img"] as const;

  test("parses --bao-load-site and --bao-path with --role into namedBaoElf", () => {
    const baseline = parsePrepareBootImageArgs([...required]);
    if ("error" in baseline) throw new Error(baseline.error);
    expect(
      parsePrepareBootImageArgs([
        ...required,
        "--role",
        "first-control-plane",
        "--bao-load-site",
        "on-host",
        "--bao-path",
        NIXOS_HOST_BAO,
      ]),
    ).toEqual({
      ...baseline,
      firstbootRole: { kind: "first-control-plane" },
      namedBaoElf: nixosHostBaoAsk(),
    });
  });

  test("refuses --bao-load-site without --bao-path", () => {
    expect(
      parsePrepareBootImageArgs([...required, "--role", "first-control-plane", "--bao-load-site", "on-host"]),
    ).toEqual({ error: "--bao-load-site requires --bao-path" });
  });

  test("refuses --bao-path without --bao-load-site and does not fill NIXOS_HOST_BAO", () => {
    expect(parsePrepareBootImageArgs([...required, "--bao-path", NIXOS_HOST_BAO])).toEqual({
      error: "--bao-path requires --bao-load-site",
    });
  });

  test("refuses an unknown --bao-load-site", () => {
    expect(
      parsePrepareBootImageArgs([...required, "--bao-load-site", "tpmrm0", "--bao-path", NIXOS_HOST_BAO]),
    ).toEqual({ error: "--bao-load-site must be on-host or in-chart-image" });
  });

  test("parses tpmrm0 --bao-path as namedBaoElf null", () => {
    const baseline = parsePrepareBootImageArgs([...required]);
    if ("error" in baseline) throw new Error(baseline.error);
    expect(
      parsePrepareBootImageArgs([
        ...required,
        "--role",
        "first-control-plane",
        "--bao-load-site",
        "on-host",
        "--bao-path",
        TPM_CHAR_DEVICE,
      ]),
    ).toEqual({
      ...baseline,
      firstbootRole: { kind: "first-control-plane" },
      namedBaoElf: null,
    });
  });

  test("parses both bao flags without --role; a non-null ask is still an ask", () => {
    const baseline = parsePrepareBootImageArgs([...required]);
    if ("error" in baseline) throw new Error(baseline.error);
    expect(
      parsePrepareBootImageArgs([...required, "--bao-load-site", "on-host", "--bao-path", NIXOS_HOST_BAO]),
    ).toEqual({
      ...baseline,
      namedBaoElf: nixosHostBaoAsk(),
    });
  });
});

describe("prepare-boot-image", () => {
  test("writeTestCredentialBlob produces a non-empty encrypted blob", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-prepare-boot-image-"));
    try {
      const blobPath = join(dir, "zeta-creds.enc");
      writeTestCredentialBlob(blobPath);
      const bytes = readFileSync(blobPath);
      expect(bytes.byteLength).toBeGreaterThan(32);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("retention restart uses 081KSNY2Z0008QG0R0008PN7RQ USB markers when booting from a zflash-prepared image", () => {
    const planned = planQcow2SnapshotRetention({
      isoPath: "/tmp/installer.iso",
      bootImagePath: "/tmp/zflash-boot.img",
      diskPath: "/tmp/disk.qcow2",
      serialLogPath: "/tmp/serial.log",
      snapshotName: "post-initial-format",
      uefiFirmware: {
        kind: "ovmf",
        codePath: "/usr/share/OVMF/OVMF_CODE_4M.fd",
        varsPath: "/tmp/OVMF_VARS.fd",
      },
    });
    expect("ok" in planned).toBe(true);
    if (!("ok" in planned)) throw new Error("expected plan");
    for (const marker of B0891_RETENTION_USB_SERIAL_MARKERS) {
      expect(planned.ok.requiredSerialMarkers).toContain(marker);
      expect(planned.ok.restartStopCondition.successMarkers).toContain(marker);
    }
  });
});

describe("prepare-boot-image constants", () => {
  test("uses deterministic QEMU USB UUID for test blobs", () => {
    expect(DEFAULT_QEMU_USB_UUID).toContain("b0891");
  });

  test("exports deterministic QEMU wifi ESP credentials for software-only gates", async () => {
    const { DEFAULT_QEMU_WIFI_SSID, DEFAULT_QEMU_WIFI_PASSWORD } = await import("./prepare-boot-image");
    expect(DEFAULT_QEMU_WIFI_SSID).toBe("zeta-qemu-homelab");
    expect(DEFAULT_QEMU_WIFI_PASSWORD).toContain("qemu");
  });

  test("installer probe token matches DEFAULT_QEMU_PROBE_GH_CLI", async () => {
    const { DEFAULT_QEMU_PROBE_GH_CLI } = await import("./prepare-boot-image");
    const installer = readFileSync(
      join(import.meta.dir, "../../../../full-ai-cluster/usb-nixos-installer/zeta-install.sh"),
      "utf8",
    );
    expect(DEFAULT_QEMU_PROBE_GH_CLI).toBe("test-token-for-qemu-b0891");
    expect(installer).toContain(`PICKER_PROBE_ENV="${DEFAULT_QEMU_PROBE_GH_CLI}"`);
  });
});

describe("ESP offset resolution — 081M39CJP96087G0R001T4J2R3 (WP29)", () => {
  function syntheticIso(espLba: number | null, totalBytes: number): Buffer {
    const iso = Buffer.alloc(totalBytes);
    iso.writeUInt16LE(0xaa55, 0x1fe);
    if (espLba !== null) {
      iso[0x1be + 4] = 0xef;
      iso.writeUInt32LE(espLba, 0x1be + 8);
      const esp = iso.subarray(espLba * 512, espLba * 512 + 512);
      esp.writeUInt16LE(0xaa55, 0x1fe);
      esp.write("FAT12   ", 0x36, "latin1");
    }
    return iso;
  }

  function withIso(iso: Buffer, run: (isoPath: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), "zeta-wp29-esp-offset-"));
    try {
      const isoPath = join(dir, "zeta-installer.iso");
      writeFileSync(isoPath, iso);
      run(isoPath);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("the real ISO's LBA-268 ESP resolves from the MBR, not from the fallback constant", async () => {
    // The measured installer ISO of run 36044770870: ESP at LBA 268 (137_216
    // bytes), 3 MiB, FAT12. The LBA-276 fallback constant is 4_096 bytes
    // INSIDE that partition, so "fell back" and "read the MBR" are not
    // distinguishable by the number alone.
    const { resolveEspOffsetForIso } = await import("./prepare-boot-image");
    withIso(syntheticIso(268, 1024 * 1024), (isoPath) => {
      expect(resolveEspOffsetForIso(isoPath)).toEqual({
        offsetBytes: 268 * 512,
        source: "mbr",
      });
    });
  });

  test("an ESP past the old 141_824-byte head bound is now FOUND, not silently guessed", async () => {
    // The old `resolveEspOffsetBytesForIso` handed the scan exactly
    // `fallback + 512` bytes, so this ISO's 0xEF entry failed
    // `isoHead.length >= partOffset + 512`, the MBR branch was skipped without
    // a word, and 141_312 came back for an image whose ESP is at 2_097_152.
    const { resolveEspOffsetForIso } = await import("./prepare-boot-image");
    withIso(syntheticIso(4096, 4 * 1024 * 1024), (isoPath) => {
      expect(resolveEspOffsetForIso(isoPath)).toEqual({
        offsetBytes: 4096 * 512,
        source: "mbr",
      });
    });
  });

  test("prepareBootImage REFUSES an ISO whose ESP offset nothing confirms", async () => {
    // No 0xEF entry and no FAT boot sector at the fallback. Baking would send
    // every injection to a constant and then read its own writes back from
    // that same constant as proof — so the refusal has to happen here, before
    // the write, or not at all.
    const { prepareBootImage } = await import("./prepare-boot-image");
    withIso(syntheticIso(null, 1024 * 1024), (isoPath) => {
      const result = prepareBootImage({
        isoPath,
        outputImagePath: join(tmpdir(), "zeta-wp29-never-written.img"),
        withCredentialBlob: false,
        testMode: true,
        hostname: "node-qemu-test",
        pubkeyPath: join(import.meta.dir, "keys/zeta-test-infra.pub"),
      });
      expect("error" in result).toBe(true);
      if (!("error" in result)) throw new Error("expected a refusal");
      expect(result.error).toContain("ESP offset could not be confirmed");
    });
  });
});
