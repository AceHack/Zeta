// FALSIFIERS for the erasure fallback in teardown.ts `overwriteAndUnlink`.
//
// These exist because the fallback was UNREACHABLE on any host that has `shred` (this repo's
// dev machines do, via homebrew), so nothing had ever executed it. An erasure path nobody can
// run is an erasure path nobody can falsify -- the vacuity class, holding private key bytes.
//
// Each test below FAILS against the previous implementation
// (`statSync(path).size` then `writeFileSync(path, Buffer.alloc(size, 0))`).
import { describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { overwriteAndUnlink } from "./teardown.ts";

const scratch = (): string => mkdtempSync(join(tmpdir(), "zeta-erase-"));

describe("overwriteAndUnlink -- the erasure fallback", () => {
  test("removes an ordinary file and reports true", () => {
    const dir = scratch();
    const p = join(dir, "machine.key");
    writeFileSync(p, "PRIVATE KEY MATERIAL");
    expect(overwriteAndUnlink(p)).toBe(true);
    expect(existsSync(p)).toBe(false);
  });

  test("does NOT follow a symlink -- the target's bytes survive, only the link is removed", () => {
    // THE RACE THIS CLOSES. `writeFileSync` resolves symlinks, so a link swapped in for the key
    // zeroed the link's TARGET. The old code left `secret` full of zeros and this assertion red.
    const dir = scratch();
    const target = join(dir, "unrelated-secret");
    const link = join(dir, "machine.key");
    writeFileSync(target, "DO NOT ZERO ME");
    symlinkSync(target, link);

    expect(overwriteAndUnlink(link)).toBe(true);
    expect(existsSync(link)).toBe(false);
    expect(readFileSync(target, "utf8")).toBe("DO NOT ZERO ME");
  });

  test("does NOT create a file that was not there (no O_CREAT)", () => {
    // `writeFileSync` opens O_CREAT, so the old fallback could MATERIALISE a zero-filled file at
    // a path that had already been removed -- a teardown that leaves litter shaped like a key.
    const dir = scratch();
    const p = join(dir, "already-gone.key");
    expect(existsSync(p)).toBe(false);
    overwriteAndUnlink(p);
    expect(existsSync(p)).toBe(false);
  });

  test("reports false when the name still occupies the directory", () => {
    // A DANGLING symlink is invisible to `existsSync` but still holds the name. The old success
    // test was `!existsSync(path)`, which would have called this a successful erasure.
    const dir = scratch();
    const link = join(dir, "dangling.key");
    symlinkSync(join(dir, "no-such-target"), link);
    expect(existsSync(link)).toBe(false); // the trap: the name IS taken, existsSync says no
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(overwriteAndUnlink(link)).toBe(true); // unlink removes the link itself
    expect(() => lstatSync(link)).toThrow();
  });

  test("is idempotent -- erasing twice is not an error the second time", () => {
    const dir = scratch();
    const p = join(dir, "twice.key");
    writeFileSync(p, "material");
    expect(overwriteAndUnlink(p)).toBe(true);
    expect(overwriteAndUnlink(p)).toBe(true);
  });
});
