// esp-inject.test.ts — proves the FAT12 key-inject works against a REAL isohybrid
// installer ISO (copied to a temp file, so no USB stick needed). Skips when no
// installer ISO is present in Downloads (e.g. CI), and the skip CARRIES ITS REASON
// in the test title — see findInstallerIso below.
//
// ENVIRONMENT-DEPENDENT TIER. Its verdict depends on the host having a physical
// installer ISO, so it is excluded from `bun --config=bunfig.hermetic.toml test` and
// declared in registry/environment-dependent-test-files.json. It still runs on
// every PR, in `test (TS environment-dependent)`.
import { describe, expect, test } from "bun:test";
import { closeSync, copyFileSync, existsSync, fstatSync, mkdtempSync, openSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { injectKeyIntoEsp, verifyKeyInEsp } from "./esp-inject.ts";

/**
 * The ISO, or the NAMED reason there is none. Never a throw.
 *
 * `existsSync` is not permission: MEASURED 2026-08-16 on macOS, the directory exists and
 * `readdirSync` still throws `EPERM: operation not permitted` because Downloads is
 * TCC-protected. That throw happened at MODULE SCOPE, before `test.skipIf` could decide
 * anything, so it surfaced as `1 error` — an unhandled error between tests, in a run whose
 * other 11,577 tests were fine. A host privacy setting must not be able to take the suite
 * down, and it must not read as a code defect either.
 *
 * The absence is returned as a SENTENCE, not as `null`, because this file is in the
 * environment-dependent tier (registry/environment-dependent-test-files.json) and the whole
 * discipline of that tier is that a skip names what is missing. A silent skip and a passing
 * test look alike in the summary line; a skip whose title says `no ISO: <reason>` does not.
 */
function findInstallerIso(): { readonly iso: string } | { readonly absent: string } {
  const dir = join(homedir(), "Downloads");
  if (!existsSync(dir)) return { absent: `${dir} does not exist (expected on a CI runner)` };
  let names: readonly string[];
  try {
    names = readdirSync(dir);
  } catch (err) {
    return { absent: `${dir} is unreadable: ${err instanceof Error ? err.message : String(err)}` };
  }
  const c = names
    .filter((f) => f.startsWith("zeta-installer-") && f.toLowerCase().endsWith(".iso"))
    .map((f) => join(dir, f))
    .filter((p) => { try { return statSync(p).isFile(); } catch { return false; } });
  const first = c[0];
  return first === undefined ? { absent: `no zeta-installer-*.iso in ${dir}` } : { iso: first };
}

describe("injectKeyIntoEsp on a real ISO copy", () => {
  const found = findInstallerIso();
  const iso = "iso" in found ? found.iso : null;
  // The `[skip] <what is missing> — <what did not run>` line is this repo's existing
  // convention for an attributed skip (20-plus sites across tools/Z3Verify). It is a
  // console.warn and not only a test title because bun's non-TTY reporter — the one CI
  // and a piped local run both use — prints the COUNT of skips and not their names, so a
  // title-only attribution is invisible in exactly the log a reviewer reads.
  const why = "iso" in found ? "" : ` [skipped — ${found.absent}]`;
  if (iso === null) {
    console.warn(`  [skip] no zeta-installer ISO — ${"absent" in found ? found.absent : ""}; FAT12 ESP inject not exercised`);
  }
  test.skipIf(!iso)("injects + reads back the key from the ISO's FAT12 ESP (fresh handle)" + why, () => {
    // A PRIVATE, UNPREDICTABLE directory -- not a name in the shared /tmp.
    //
    // This was `join(tmpdir(), `esp-inject-test-${process.pid}.iso`)` (CodeQL
    // js/insecure-temporary-file, alerts 260 and 261). A pid is small, guessable
    // and REUSED, so the full path is predictable to any local user, and both
    // `copyFileSync` and `openSync(.., "r+")` FOLLOW SYMLINKS -- a pre-planted
    // link at that path turns this test into an arbitrary-file overwrite running
    // as the test user. `mkdtempSync` returns a 0700 directory with an
    // unpredictable suffix, created atomically, which is the whole fix.
    const tmpDir = mkdtempSync(join(tmpdir(), "esp-inject-test-"));
    const tmp = join(tmpDir, "installer.iso");
    copyFileSync(iso!, tmp);
    try {
      const body = Buffer.from("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5TESTKEY esp-inject-test\n", "utf8");
      let wroteTo: { dev: number; ino: number };
      const fd = openSync(tmp, "r+");
      try {
        // The identity of the object we are about to write, taken from the DESCRIPTOR rather
        // than from the path, so nothing between here and the read-back can change what it
        // names. Compared below.
        const st = fstatSync(fd);
        wroteTo = { dev: st.dev, ino: st.ino };
        injectKeyIntoEsp(fd, body);          // writes + self-verifies (throws on mismatch)
        expect(verifyKeyInEsp(fd, body)).toBe(true);
      } finally {
        closeSync(fd);
      }
      // THE RE-OPEN IS THE ASSERTION, and it is now CHECKED rather than trusted.
      //
      // CodeQL reports this as `js/file-system-race` (alert #256) because `tmp` was opened
      // "r+" above and is opened again here. The report is right about the shape: `tmp` is a
      // path, a path resolves afresh on every call, and a read-back that resolved to a
      // DIFFERENT object would be a verification of the wrong file reported as a pass -- the
      // worst outcome available to a check.
      //
      // The re-open itself is not the defect and must not be removed: reusing the write
      // handle would assert only that the bytes this test wrote are the bytes this test
      // wrote, which is the vacuous check this line exists to avoid. What was missing is the
      // one thing that makes a re-resolution safe -- proof that the two descriptors name the
      // SAME inode. Node exposes no `openat`, so the re-resolution cannot be eliminated; it
      // CAN be made unable to pass on the wrong object, which is what the dev+ino comparison
      // below does. A swap is now a failure rather than a silent success.
      const fd2 = openSync(tmp, "r"); // re-open fresh: prove it persisted to the file
      try {
        const st2 = fstatSync(fd2);
        expect({ dev: st2.dev, ino: st2.ino }).toEqual(wroteTo);
        expect(verifyKeyInEsp(fd2, body)).toBe(true);
      } finally {
        closeSync(fd2);
      }
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
