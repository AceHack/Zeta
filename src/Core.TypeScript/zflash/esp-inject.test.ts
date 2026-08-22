// esp-inject.test.ts — proves the FAT12 key-inject works against a REAL isohybrid
// installer ISO (copied to a temp file, so no USB stick needed). Auto-skips when
// no installer ISO is present in Downloads (e.g. CI), so it never blocks the suite.
import { describe, expect, test } from "bun:test";
import { closeSync, copyFileSync, existsSync, openSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { injectKeyIntoEsp, verifyKeyInEsp } from "./esp-inject.ts";

function findInstallerIso(): string | null {
  const dir = join(homedir(), "Downloads");
  if (!existsSync(dir)) return null;
  const c = readdirSync(dir)
    .filter((f) => f.startsWith("zeta-installer-") && f.toLowerCase().endsWith(".iso"))
    .map((f) => join(dir, f))
    .filter((p) => { try { return statSync(p).isFile(); } catch { return false; } });
  return c.length ? c[0]! : null;
}

describe("injectKeyIntoEsp on a real ISO copy", () => {
  const iso = findInstallerIso();
  test.skipIf(!iso)("injects + reads back the key from the ISO's FAT12 ESP (fresh handle)", () => {
    const tmp = join(tmpdir(), `esp-inject-test-${process.pid}.iso`);
    copyFileSync(iso!, tmp);
    try {
      const body = Buffer.from("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5TESTKEY esp-inject-test\n", "utf8");
      const fd = openSync(tmp, "r+");
      try {
        injectKeyIntoEsp(fd, body);          // writes + self-verifies (throws on mismatch)
        expect(verifyKeyInEsp(fd, body)).toBe(true);
      } finally {
        closeSync(fd);
      }
      const fd2 = openSync(tmp, "r"); // re-open fresh: prove it persisted to the file
      try {
        expect(verifyKeyInEsp(fd2, body)).toBe(true);
      } finally {
        closeSync(fd2);
      }
    } finally {
      rmSync(tmp, { force: true });
    }
  });
});
