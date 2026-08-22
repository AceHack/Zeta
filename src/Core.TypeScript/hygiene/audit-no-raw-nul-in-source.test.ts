// audit-no-raw-nul-in-source.ts — the refusal, demonstrated on bytes rather than on the
// repo, because a fixture file containing a raw NUL is itself a file the tools skip.
//
// The positive case (the repo is clean) is asserted last and is the WEAKEST assertion
// here: it passes trivially the day someone breaks the detector. Everything above it
// exists so that the clean answer means something.
import { describe, expect, test } from "bun:test";
import {
  auditRepo,
  findRawNulSites,
  isCodePath,
  trackedFiles,
} from "./audit-no-raw-nul-in-source.ts";

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
/** A file whose NUL is real, i.e. the thing rg refuses to search. */
const withRawNul = (s: string): Uint8Array => enc(s.replace(/@/gu, "\u0000"));

describe("audit-no-raw-nul-in-source: the detector refuses a bad file", () => {
  test("NUL-1: a raw NUL is found, with its line", () => {
    const sites = findRawNulSites("a.ts", withRawNul('const k = `${a}@${b}`;\n'));
    expect(sites).toEqual([{ path: "a.ts", line: 1, count: 1 }]);
  });

  test("NUL-2: the line number is the NUL's line, not the file's first", () => {
    const sites = findRawNulSites("a.ts", withRawNul('one\ntwo\nconst SEP = "@";\n'));
    expect(sites).toEqual([{ path: "a.ts", line: 3, count: 1 }]);
  });

  test("NUL-3: several NULs on one line are counted, not collapsed to one finding", () => {
    // key-epoch-ledger.ts's real shape: two separators in one template literal.
    const sites = findRawNulSites("a.ts", withRawNul('const k = `${id}@${ep}@${prev}`;\n'));
    expect(sites).toEqual([{ path: "a.ts", line: 1, count: 2 }]);
  });

  test("NUL-4: NULs on different lines are reported separately, in line order", () => {
    const sites = findRawNulSites("a.ts", withRawNul('x@\ny\nz@\n'));
    expect(sites.map((s) => s.line)).toEqual([1, 3]);
  });

  test("NUL-5: the ESCAPED form is not a finding -- that is the whole fix", () => {
    // Byte-identical at runtime, still text to every tool. If this ever reported, the
    // audit would be telling people to make the file unsearchable again.
    expect(findRawNulSites("a.ts", enc('const k = `${a}\\u0000${b}`;\n'))).toEqual([]);
    expect(findRawNulSites("a.ts", enc('let c = \'\\u0000\';\n'))).toEqual([]);
  });

  test("NUL-6: an ordinary file is clean", () => {
    expect(findRawNulSites("a.ts", enc("export const x = 1;\n"))).toEqual([]);
  });

  test("NUL-7: high bytes and CRLF are not mistaken for NUL", () => {
    expect(findRawNulSites("a.ts", new Uint8Array([0xef, 0xbb, 0xbf, 0x0d, 0x0a, 0x41]))).toEqual([]);
  });

  test("NUL-8: a NUL at the very last byte is still found", () => {
    // Off-by-one guard: the loop must not stop before the final byte.
    expect(findRawNulSites("a.ts", new Uint8Array([0x41, 0x00]))).toEqual([
      { path: "a.ts", line: 1, count: 1 },
    ]);
  });

  test("NUL-9: scope is code, and the scope is honest about what it excludes", () => {
    for (const p of ["a.ts", "b.fs", "c.rs", "d.mjs", "e.cs", "f.py", "g.yml"]) {
      expect(isCodePath(p)).toBe(true);
    }
    // Stated limit, asserted so it cannot quietly become a coverage claim.
    for (const p of ["README.md", "data.json", "notes.txt", "image.png"]) {
      expect(isCodePath(p)).toBe(false);
    }
  });
});

describe("audit-no-raw-nul-in-source: the repo itself", () => {
  // The whole-repo pass is a REPO-STATE check, not a unit test: it reads ~42 MB across
  // ~5100 tracked code files in ~20 s, which does not belong in a per-change suite. It
  // runs as its own `gate.yml` step, beside audit-proof-lineage-binaries.ts — the same
  // shape of check, in the same place. Ten tracked files failed it when it was written.
  //
  // What IS asserted here is that the entry point enumerates anything at all: a scan over
  // an empty file list reports clean forever, which is the vacuity form of this audit.
  test("NUL-10: the repo entry point really enumerates tracked code files", () => {
    const paths = trackedFiles();
    expect(paths.filter(isCodePath).length).toBeGreaterThan(1000);
    expect(paths).toContain("src/Core.TypeScript/hygiene/audit-no-raw-nul-in-source.ts");
    expect(typeof auditRepo).toBe("function");
  });
});
