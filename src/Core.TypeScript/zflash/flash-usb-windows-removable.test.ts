/**
 * src/Core.TypeScript/zflash/flash-usb-windows-removable.test.ts
 *
 * Removable-media flashing on Windows, against temp files — no disk is touched.
 *
 * The defect (reproduced 2026-09-27, PNY USB 3.2.1 FD, disk 3): main() ran
 * `Set-Disk -IsOffline $true` before the raw write, and Windows refuses that for
 * every removable stick ("Removable media cannot be set to offline"), so the
 * flasher could not flash any USB stick. #6981 had a working removable path;
 * #8076 dropped it. These tests pin the restored path:
 *   - disk prep: read-only cleared, Clear-Disk, and NO offline;
 *   - the partition table (first 1 MiB) is written LAST;
 *   - the device is read back over exactly the written range and a mismatch fails;
 *   - the staged copy must hash to the verified sha256;
 *   - the ESP payload list is the shared planner's, for the same flags.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { closeSync, mkdtempSync, openSync, readFileSync, readSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PARTITION_TABLE_BYTES,
  copyImageToDevice,
  diskPreparationScripts,
  parseWindowsFlasherArgs,
  planWindowsEspWrites,
  prepareDiskForRawWrite,
  pubkeyFileContent,
  resolveEspFiles,
  stageVerifiedCopy,
  verifyDeviceReadback,
  type WindowsFlasherArgs,
} from "./flash-usb-windows.ts";
import { bakeEspFiles, fdBlockIo } from "./esp-fat-writer.ts";
import { planFileBackedZflashImage } from "./lib.ts";
import { firstbootRoleFromFlags } from "./firstboot-role.ts";
import { planPublicEndpoint } from "../installer/public-endpoint.ts";
import { buildIsohybridFixture, readFixtureRoot, REAL_ISO_FAT12 } from "./test-harness/isohybrid-esp-fixture.ts";

const PUBKEY = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIabc123def456ghi789jkl012mno345pqr678stu90 zeta@operator";
const MiB = 1024 * 1024;

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "flashwin-rm-"));
}
function patterned(n: number, seed: number): Buffer {
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) b[i] = (i * seed + 11) & 0xff;
  return b;
}
const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

describe("disk preparation — removable media cannot be taken offline", () => {
  test("clears read-only, then Clear-Disk; never Set-Disk -IsOffline, never mountvol", () => {
    const scripts = diskPreparationScripts(3);
    expect(scripts).toEqual([
      "Set-Disk -Number 3 -IsReadOnly $false",
      "Clear-Disk -Number 3 -RemoveData -RemoveOEM -Confirm:$false -ErrorAction Stop",
    ]);
    for (const s of scripts) {
      expect(s).not.toContain("IsOffline");
      expect(s.toLowerCase()).not.toContain("mountvol");
    }
  });

  test("prepareDiskForRawWrite issues exactly those, in order, against a runner that refuses offline", () => {
    const calls: string[] = [];
    // A fake that behaves like Windows does for a removable stick.
    const runner = {
      ps(script: string): string {
        calls.push(script);
        if (script.includes("-IsOffline $true")) throw new Error("Set-Disk : Not Supported. Removable media cannot be set to offline.");
        return "";
      },
    };
    expect(() => prepareDiskForRawWrite(runner, 3)).not.toThrow();
    expect(calls).toEqual([...diskPreparationScripts(3)]);
    expect(calls.some((c) => c.startsWith("Clear-Disk -Number 3"))).toBe(true);
  });

  test("a failing Clear-Disk is loud (throws before any byte could be written)", () => {
    const runner = {
      ps(script: string): string {
        if (script.startsWith("Clear-Disk")) throw new Error("access denied");
        return "";
      },
    };
    expect(() => prepareDiskForRawWrite(runner, 3)).toThrow("access denied");
  });

  test("main() no longer reaches for offline or mountvol (source-level guard on the orchestrator)", () => {
    const src = readFileSync(join(import.meta.dir, "flash-usb-windows.ts"), "utf8");
    const mainBody = src.slice(src.indexOf("async function main("), src.indexOf("function readLine("));
    expect(mainBody.length).toBeGreaterThan(1000);
    expect(mainBody).not.toContain("IsOffline");
    expect(mainBody).not.toContain("mountvol");
    const prep = mainBody.indexOf("prepareDiskForRawWrite(");
    const write = mainBody.indexOf("copyImageToDevice(");
    const readback = mainBody.indexOf("verifyDeviceReadback(");
    expect(prep).toBeGreaterThan(0);
    expect(write).toBeGreaterThan(prep);
    expect(readback).toBeGreaterThan(write);
  });
});

describe("copyImageToDevice — partition table LAST", () => {
  test("every byte past 1 MiB is on the device before the first 1 MiB is touched", () => {
    const dir = tmp();
    const image = patterned(3 * MiB + 1000, 7);
    const imagePath = join(dir, "image.iso");
    const devPath = join(dir, "device.bin");
    writeFileSync(imagePath, image);
    const SENTINEL = 0xee;
    writeFileSync(devPath, Buffer.alloc(4 * MiB, SENTINEL)); // a "device" with stale contents

    const order: Array<[number, number]> = [];
    let checkedAtHead = false;
    const res = copyImageToDevice({
      isoPath: imagePath,
      destPath: devPath,
      chunkSize: 256 * 1024,
      sectorSize: 512,
      onWrite: (pos, len) => {
        if (pos === 0 && !checkedAtHead) {
          // The moment the partition table is about to exist on the "device":
          // the whole tail must already be there, and the head must still be stale
          // except for this very write (which has landed).
          const fd = openSync(devPath, "r");
          try {
            const tail = Buffer.alloc(image.length - PARTITION_TABLE_BYTES);
            readSync(fd, tail, 0, tail.length, PARTITION_TABLE_BYTES);
            expect(tail.equals(image.subarray(PARTITION_TABLE_BYTES))).toBe(true);
            const restOfHead = Buffer.alloc(PARTITION_TABLE_BYTES - len);
            readSync(fd, restOfHead, 0, restOfHead.length, len);
            expect(restOfHead.every((b) => b === SENTINEL)).toBe(true);
          } finally {
            closeSync(fd);
          }
          checkedAtHead = true;
        }
        order.push([pos, len]);
      },
    });

    expect(checkedAtHead).toBe(true);
    const firstHead = order.findIndex(([p]) => p < PARTITION_TABLE_BYTES);
    expect(firstHead).toBeGreaterThan(0);
    expect(order.slice(0, firstHead).every(([p]) => p >= PARTITION_TABLE_BYTES)).toBe(true);
    expect(order.slice(firstHead).every(([p]) => p < PARTITION_TABLE_BYTES)).toBe(true);
    expect(order[order.length - 1]![0]).toBeLessThan(PARTITION_TABLE_BYTES);
    // And the result is still the byte-exact, sector-padded image.
    expect(res.isoBytes).toBe(image.length);
    expect(res.bytesWritten).toBe(Math.ceil(image.length / 512) * 512);
    const dev = readFileSync(devPath);
    expect(dev.subarray(0, image.length).equals(image)).toBe(true);
    expect(dev.subarray(image.length, res.bytesWritten).every((b) => b === 0)).toBe(true);
  });

  test("an image smaller than the head region is written whole (and padded)", () => {
    const dir = tmp();
    const image = patterned(5000, 3);
    writeFileSync(join(dir, "i.iso"), image);
    writeFileSync(join(dir, "d.bin"), Buffer.alloc(0));
    const res = copyImageToDevice({ isoPath: join(dir, "i.iso"), destPath: join(dir, "d.bin"), chunkSize: 1024, sectorSize: 512 });
    expect(res.bytesWritten).toBe(5120);
    expect(readFileSync(join(dir, "d.bin")).subarray(0, 5000).equals(image)).toBe(true);
  });

  test("rejects a head size that is not sector-aligned", () => {
    expect(() => copyImageToDevice({ isoPath: "x", destPath: "y", sectorSize: 512, headLastBytes: 1000 })).toThrow("headLastBytes");
  });
});

describe("verifyDeviceReadback — exactly the written range, sha256 against the image", () => {
  function setup(mutate?: (dev: Buffer) => void) {
    const dir = tmp();
    const image = patterned(9000, 5);
    const imagePath = join(dir, "image.iso");
    const devPath = join(dir, "device.bin");
    writeFileSync(imagePath, image);
    const dev = Buffer.alloc(64 * 1024, 0x5a); // device larger than the image, stale beyond it
    image.copy(dev, 0);
    dev.fill(0, image.length, 9216); // the write's zero padding to 512
    mutate?.(dev);
    writeFileSync(devPath, dev);
    return { imagePath, devPath, image };
  }

  test("match → ok, and only the written 9216 bytes are compared (stale bytes past it are ignored)", () => {
    const { imagePath, devPath, image } = setup();
    const v = verifyDeviceReadback({ imagePath, devicePath: devPath, bytesWritten: 9216 });
    expect(v.ok).toBe(true);
    const padded = Buffer.concat([image, Buffer.alloc(9216 - image.length)]);
    if (v.ok) expect(v.sha256).toBe(sha(padded));
  });

  test("one flipped byte on the device → failure naming both hashes", () => {
    const { imagePath, devPath } = setup((dev) => {
      dev[4321] = dev[4321]! ^ 0x01;
    });
    const v = verifyDeviceReadback({ imagePath, devicePath: devPath, bytesWritten: 9216 });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.imageSha256).not.toBe(v.deviceSha256);
      expect(v.message).toContain("MISMATCH");
    }
  });

  test("a dirty zero-padding byte is also a mismatch (the padding is part of the written range)", () => {
    const { imagePath, devPath } = setup((dev) => {
      dev[9100] = 1;
    });
    expect(verifyDeviceReadback({ imagePath, devicePath: devPath, bytesWritten: 9216 }).ok).toBe(false);
  });

  test("a device that returns fewer bytes than were written is an error, not a pass", () => {
    const dir = tmp();
    writeFileSync(join(dir, "i.iso"), patterned(9000, 5));
    writeFileSync(join(dir, "d.bin"), patterned(4096, 5));
    expect(() => verifyDeviceReadback({ imagePath: join(dir, "i.iso"), devicePath: join(dir, "d.bin"), bytesWritten: 9216 })).toThrow("short read");
  });
});

describe("stageVerifiedCopy — the bytes baked are the bytes verified", () => {
  test("copy whose hash equals the verified sha256 → ok, identical copy", () => {
    const dir = tmp();
    const iso = patterned(300_000, 9);
    writeFileSync(join(dir, "a.iso"), iso);
    const r = stageVerifiedCopy(join(dir, "a.iso"), join(dir, "stage.img"), sha(iso), 64 * 1024);
    expect(r).toEqual({ ok: true, sha256: sha(iso), bytes: iso.length });
    expect(readFileSync(join(dir, "stage.img")).equals(iso)).toBe(true);
  });
  test("hash differs from the verified one → refused", () => {
    const dir = tmp();
    writeFileSync(join(dir, "a.iso"), patterned(1000, 9));
    const r = stageVerifiedCopy(join(dir, "a.iso"), join(dir, "stage.img"), "0".repeat(64));
    expect(r.ok).toBe(false);
  });
  test("never overwrites an existing staging file", () => {
    const dir = tmp();
    writeFileSync(join(dir, "a.iso"), patterned(1000, 9));
    writeFileSync(join(dir, "stage.img"), "x");
    expect(() => stageVerifiedCopy(join(dir, "a.iso"), join(dir, "stage.img"), "0".repeat(64))).toThrow();
  });
});

describe("ESP payloads — the shared planner's list, for the same flags", () => {
  const argv = [
    "--host",
    "node-a",
    "--role",
    "first-control-plane",
    "--acme-email",
    "ops@zeta-cluster.net",
    "--public-domain",
    "zeta-cluster.net",
    "--repo-pin",
    "0123456789abcdef0123456789abcdef01234567",
    "C:\\Users\\op\\Downloads\\zeta-installer-1.iso",
  ];

  test("parseWindowsFlasherArgs reads every value flag and the positional", () => {
    const p = parseWindowsFlasherArgs(argv);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.value.host).toBe("node-a");
    expect(p.value.role).toBe("first-control-plane");
    expect(p.value.repoPin).toBe("0123456789abcdef0123456789abcdef01234567");
    expect(p.value.isoPath).toBe("C:\\Users\\op\\Downloads\\zeta-installer-1.iso");
    expect(parseWindowsFlasherArgs(["--host"]).ok).toBe(false);
    expect(parseWindowsFlasherArgs(["--host", "a", "--host", "b"]).ok).toBe(false);
    expect(parseWindowsFlasherArgs(["a.iso", "b.iso"]).ok).toBe(false);
    expect(parseWindowsFlasherArgs(["--hostt", "a"]).ok).toBe(false);
    expect(parseWindowsFlasherArgs(["--no-inject", "--ssh-key", "k.pub"]).ok).toBe(false);
  });

  test("planWindowsEspWrites === planFileBackedZflashImage(...).espWrites for the same flags", () => {
    const p = parseWindowsFlasherArgs(argv);
    if (!p.ok) throw new Error(p.message);
    const iso = "C:\\Users\\op\\Downloads\\zeta-installer-1.iso";
    const mine = planWindowsEspWrites(p.value, PUBKEY, iso, 141_312, "C:\\t\\x.baked.img");
    expect(mine.ok).toBe(true);

    const role = firstbootRoleFromFlags({ role: "first-control-plane" });
    const pe = planPublicEndpoint({ acmeEmail: "ops@zeta-cluster.net", publicDomain: "zeta-cluster.net" });
    if (!role.ok || !pe.ok || role.value === undefined || pe.value === null) throw new Error("fixture flags invalid");
    const shared = planFileBackedZflashImage({
      isoPath: iso,
      outputImagePath: "C:\\t\\x.baked.img",
      espOffsetBytes: 141_312,
      authorizedKeysContent: PUBKEY,
      hostname: "node-a",
      firstbootRole: role.value,
      publicEndpoint: pe.value,
      repoPinCommit: "0123456789abcdef0123456789abcdef01234567",
    });
    if (!shared.ok) throw new Error(shared.error);
    if (mine.ok) expect(mine.value).toEqual(shared.value.espWrites);
    const dests = mine.ok ? mine.value.map((w) => w.destination) : [];
    expect(dests).toEqual(["/zeta-authorized-keys.pub", "/zeta-hostname.txt", "/zeta-repo-pin", "/zeta-firstboot.conf"]);
    const key = mine.ok ? mine.value.find((w) => w.destination === "/zeta-authorized-keys.pub") : undefined;
    expect(key?.content).toBe(pubkeyFileContent(PUBKEY));
    const conf = mine.ok ? mine.value.find((w) => w.destination === "/zeta-firstboot.conf")?.content ?? "" : "";
    expect(conf).toContain("zeta-cluster.net");
  });

  test("pubkey only (the default run) → exactly the key file", () => {
    const p = parseWindowsFlasherArgs([]);
    if (!p.ok) throw new Error(p.message);
    const r = planWindowsEspWrites(p.value, PUBKEY, "a.iso", 141_312, "a.img");
    expect(r).toEqual({ ok: true, value: [{ destination: "/zeta-authorized-keys.pub", content: pubkeyFileContent(PUBKEY) }] });
  });

  test("--no-inject and nothing else → no ESP writes; bad flag combos are refused by the shared validators", () => {
    const none = parseWindowsFlasherArgs(["--no-inject"]);
    if (!none.ok) throw new Error(none.message);
    expect(planWindowsEspWrites(none.value, undefined, "a.iso", 141_312, "a.img")).toEqual({ ok: true, value: [] });
    const bad = (a: Partial<WindowsFlasherArgs>) =>
      planWindowsEspWrites({ short: false, dryRun: false, noInject: false, help: false, ...a }, PUBKEY, "a.iso", 141_312, "a.img").ok;
    expect(bad({ joinServerUrl: "https://10.0.0.1:6443" })).toBe(false); // needs --role joiner
    expect(bad({ acmeEmail: "ops@zeta-cluster.net" })).toBe(false); // pair incomplete
    expect(bad({ repoPin: "abc" })).toBe(false); // not 40-hex
    expect(bad({ host: "-bad-" })).toBe(false); // RFC1123
  });

  test("resolveEspFiles: inline content as UTF-8, sourcePath read through the injected reader", () => {
    const r = resolveEspFiles(
      [
        { destination: "/zeta-hostname.txt", content: "node-a\n" },
        { destination: "/zeta-join-token", sourcePath: "C:\\tok" },
      ],
      (p) => (p === "C:\\tok" ? { ok: true, bytes: Buffer.from("K10abc::server:xyz\n") } : { ok: false, message: "nope" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.map((f) => f.name)).toEqual(["zeta-hostname.txt", "zeta-join-token"]);
      expect(r.value[1]!.body.toString()).toBe("K10abc::server:xyz\n");
    }
    expect(resolveEspFiles([{ destination: "/zeta-join-token", sourcePath: "missing" }], () => ({ ok: false, message: "ENOENT" })).ok).toBe(false);
  });
});

describe("end to end on temp files: stage → bake → write (head last) → read back", () => {
  test("the 'device' ends up holding the ISO with the planned payloads on its ESP", () => {
    const dir = tmp();
    const iso = buildIsohybridFixture(REAL_ISO_FAT12);
    const isoPath = join(dir, "zeta-installer-1.iso");
    writeFileSync(isoPath, iso);
    const stagePath = join(dir, "stage.img");
    const staged = stageVerifiedCopy(isoPath, stagePath, sha(iso));
    expect(staged.ok).toBe(true);

    const args = parseWindowsFlasherArgs(["--host", "node-a"]);
    if (!args.ok) throw new Error(args.message);
    const planned = planWindowsEspWrites(args.value, PUBKEY, isoPath, 141_312, stagePath);
    if (!planned.ok) throw new Error(planned.message);
    const files = resolveEspFiles(planned.value);
    if (!files.ok) throw new Error(files.message);
    const fd = openSync(stagePath, "r+");
    try {
      const baked = bakeEspFiles(fdBlockIo(fd), files.value);
      expect(baked.ok).toBe(true);
    } finally {
      closeSync(fd);
    }
    expect(readFileSync(isoPath).equals(iso)).toBe(true); // the original ISO is never modified

    const devPath = join(dir, "device.bin");
    writeFileSync(devPath, Buffer.alloc(0));
    const res = copyImageToDevice({ isoPath: stagePath, destPath: devPath, sectorSize: 512 });
    const v = verifyDeviceReadback({ imagePath: stagePath, devicePath: devPath, bytesWritten: res.bytesWritten });
    expect(v.ok).toBe(true);

    const root = readFixtureRoot(readFileSync(devPath));
    const key = root.files.find((f) => f.longName === "zeta-authorized-keys.pub");
    const host = root.files.find((f) => f.longName === "zeta-hostname.txt");
    expect(key?.content.toString("utf8")).toBe(pubkeyFileContent(PUBKEY));
    expect(host?.content.toString("utf8")).toBe("node-a\n");
  });
});
