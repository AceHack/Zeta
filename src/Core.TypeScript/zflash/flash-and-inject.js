#!/usr/bin/env bun
/**
 * flash-and-inject.ts — flash the AI-cluster installer ISO to a Windows USB
 * AND inject the operator SSH pubkey, for the REMOVABLE-MEDIA case that
 * flash-usb-windows.ts cannot handle.
 *
 * Approach (fixed 2026-06-14): inject the key into the ISO *file* BEFORE the raw
 * write, never into the device afterward. The old post-write device inject lost a
 * race — after the ISO write Windows rescans the new partition table and
 * auto-mounts the ESP, which invalidates the \\.\PhysicalDriveN handle (EBADF)
 * and RO-locks the region; the filesystem path is also dead (Windows mounts the
 * isohybrid ESP write-protected). A plain FILE has none of those semantics, so
 * the inject is reliable; the verbatim raw copy then carries the key onto the
 * stick (file offset == device offset). A final device read-back proves it.
 *
 * The FAT12 inject/verify core lives in esp-inject.ts (unit-tested against a real
 * ISO copy in esp-inject.test.ts). This file is the Windows device orchestration.
 *
 * argv: <device> <keyFile> <log>   (ISO auto-discovered from Downloads)
 * Must run from an ELEVATED shell.
 */
import { appendFileSync, closeSync, fstatSync, fsyncSync, openSync, readFileSync, readSync, writeFileSync, writeSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { autoDiscoverIso, human, validateIso } from "./flash-usb-windows.js";
import { injectKeyIntoEsp, parseEspGeom, readRegion, verifyKeyInEsp } from "./esp-inject.js";
const device = process.argv[2] ?? "\\\\.\\PhysicalDrive3";
const keyFile = process.argv[3];
const log = process.argv[4] ?? "D:\\Zeta\\.flash-inject.log";
const diskNum = Number((device.match(/PhysicalDrive(\d+)/) ?? [])[1] ?? 3);
function W(s) {
    appendFileSync(log, s + "\n");
    process.stdout.write(s + "\n");
}
function fail(m) {
    W(`RESULT:FAIL-${m}`);
    process.exit(1);
}
function ps(s) {
    return execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", s], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
}
// ── 1. resolve ISO + key ──
const isoPath = autoDiscoverIso(join(homedir(), "Downloads"));
if (!isoPath)
    fail("no-iso");
const isoFd0 = openSync(isoPath, "r");
const isoSize = fstatSync(isoFd0).size;
closeSync(isoFd0);
const v = validateIso(isoPath, isoSize, true);
if (!v.ok)
    fail(`iso-${v.message}`);
const body = Buffer.from(readFileSync(keyFile, "utf8").replace(/\r\n/g, "\n").replace(/\n+$/, "") + "\n", "utf8");
W(`=== flash-and-inject device=${device} iso=${isoPath} (${human(isoSize)}) key=${keyFile} (${body.length}B) ===`);
// ── 2. inject the key into the ISO FILE (reliable: no mount/lock/RO-medium) ──
{
    const fd = openSync(isoPath, "r+");
    try {
        injectKeyIntoEsp(fd, body, W);
    }
    catch (e) {
        closeSync(fd);
        fail(`iso-inject ${e instanceof Error ? e.message : e}`);
    }
    closeSync(fd);
}
// ── 3. blank + raw-write the now-keyed ISO to the device (no device inject) ──
try {
    execFileSync("mountvol", ["/R"], { encoding: "utf8" });
    W(`mountvol /R`);
}
catch { /* best effort */ }
try {
    execFileSync("mountvol", ["/N"], { encoding: "utf8" });
    W(`mountvol /N`);
}
catch { /* best effort */ }
try {
    ps(`Set-Disk -Number ${diskNum} -IsReadOnly $false -ErrorAction SilentlyContinue`);
}
catch { /* ignore */ }
try {
    ps(`Clear-Disk -Number ${diskNum} -RemoveData -RemoveOEM -Confirm:$false -ErrorAction Stop`);
    W(`Clear-Disk ok`);
}
catch (e) {
    W(`Clear-Disk failed (${e instanceof Error ? e.message.split("\n")[0] : e}); diskpart clean fallback`);
    const t = join(process.env.TEMP ?? "C:\\Windows\\Temp", `zclean-${process.pid}.txt`);
    writeFileSync(t, `select disk ${diskNum}\r\nclean\r\n`, "ascii");
    W(execFileSync("diskpart", ["/s", t], { encoding: "utf8" }).trim());
}
const SECTOR = 4096; // pad unit (works for 512 & 4096 drives)
{
    const fd = openSync(device, "r+");
    try {
        W(`writing keyed ISO -> ${device} ...`);
        const isoFd = openSync(isoPath, "r");
        try {
            const chunk = 4 * 1024 * 1024;
            const buf = Buffer.allocUnsafe(chunk);
            let written = 0, srcPos = 0, lastBucket = -1;
            while (srcPos < isoSize) {
                const n = readSync(isoFd, buf, 0, chunk, srcPos);
                if (n <= 0)
                    break;
                let len = n;
                if (len % SECTOR !== 0) {
                    const padded = Math.ceil(len / SECTOR) * SECTOR;
                    buf.fill(0, len, padded);
                    len = padded;
                }
                writeSync(fd, buf, 0, len, written);
                written += len;
                srcPos += n;
                const bucket = Math.floor((srcPos / isoSize) * 10);
                if (bucket !== lastBucket) {
                    lastBucket = bucket;
                    W(`  ${Math.floor((srcPos / isoSize) * 100)}% (${human(Math.min(srcPos, isoSize))}/${human(isoSize)})`);
                }
            }
            fsyncSync(fd);
            W(`ISO write complete (${human(written)})`);
        }
        finally {
            closeSync(isoFd);
        }
    }
    finally {
        closeSync(fd);
    }
}
try {
    execFileSync("mountvol", ["/E"], { encoding: "utf8" });
    W(`automount re-enabled (mountvol /E)`);
}
catch { /* best effort */ }
// ── 4. device read-back: prove the key actually landed on the stick ──
{
    const fd = openSync(device, "r");
    try {
        parseEspGeom(readRegion(fd, 0, 256 * 1024), W); // logs MBR/ESP layout
        if (!verifyKeyInEsp(fd, body, W))
            fail("device-readback-mismatch");
        W(`device verify OK — key is on the USB ESP`);
    }
    finally {
        closeSync(fd);
    }
}
W("RESULT:OK");
