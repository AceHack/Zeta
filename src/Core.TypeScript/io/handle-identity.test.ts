// src/Core.TypeScript/io/handle-identity.test.ts
//
// The falsifiers. The one that matters is the LAST one: two files with identical bytes must
// compare `different`, because the whole point of the helper is to catch a read-back that
// verified the wrong object and reported a pass. A content check cannot see that; this can.

import { describe, expect, test } from "bun:test";
import { closeSync, mkdtempSync, openSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compareHandleIdentity, describeHandleIdentity, handleIdentity } from "./handle-identity.ts";

function scratch(): string {
  return mkdtempSync(join(tmpdir(), "handle-identity-"));
}

describe("handle-identity", () => {
  test("two descriptors on ONE file compare same", () => {
    const dir = scratch();
    try {
      const path = join(dir, "a.bin");
      writeFileSync(path, "same bytes");
      const a = openSync(path, "r");
      const b = openSync(path, "r");
      try {
        expect(compareHandleIdentity(handleIdentity(a), handleIdentity(b))).toBe("same");
      } finally {
        closeSync(a);
        closeSync(b);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("TWO FILES WITH IDENTICAL BYTES compare different — the case a content check cannot see", () => {
    // MUTANT: make `compareHandleIdentity` return "same" whenever `a.known && b.known`.
    // Every byte-level assertion in the tree still passes and this one goes red, which is the
    // whole reason the helper exists.
    const dir = scratch();
    try {
      const one = join(dir, "one.bin");
      const two = join(dir, "two.bin");
      writeFileSync(one, "identical");
      writeFileSync(two, "identical");
      const a = openSync(one, "r");
      const b = openSync(two, "r");
      try {
        expect(compareHandleIdentity(handleIdentity(a), handleIdentity(b))).toBe("different");
      } finally {
        closeSync(a);
        closeSync(b);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a descriptor that says nothing is UNKNOWN, never a match", () => {
    // MUTANT: drop the `known` guard from `compareHandleIdentity` so two zeroed identities
    // compare equal. This assertion goes red — and that mutant is exactly the vacuity the
    // third register exists to refuse: a raw device handle reporting (0, 0) would then
    // "verify" against anything.
    const silent = { dev: 0, ino: 0, known: false };
    const real = { dev: 42, ino: 7, known: true };
    expect(compareHandleIdentity(silent, silent)).toBe("unknown");
    expect(compareHandleIdentity(silent, real)).toBe("unknown");
    expect(compareHandleIdentity(real, silent)).toBe("unknown");
    expect(compareHandleIdentity(real, { dev: 42, ino: 7, known: true })).toBe("same");
  });

  test("a closed descriptor reports unknown rather than throwing", () => {
    const dir = scratch();
    try {
      const path = join(dir, "c.bin");
      writeFileSync(path, "x");
      const fd = openSync(path, "r");
      closeSync(fd);
      expect(handleIdentity(fd).known).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the log rendering names the unknown case out loud", () => {
    expect(describeHandleIdentity({ dev: 0, ino: 0, known: false })).toBe("identity-unavailable");
    expect(describeHandleIdentity({ dev: 3, ino: 9, known: true })).toBe("dev=3 ino=9");
  });
});
