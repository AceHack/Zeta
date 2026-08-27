import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_QEMU_USB_UUID, writeTestCredentialBlob } from "./prepare-boot-image";
import { planQcow2SnapshotRetention } from "./qemu-state";
import { B0891_RETENTION_USB_SERIAL_MARKERS } from "./serial-markers";

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
