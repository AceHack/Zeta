import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  main,
  parseDatfile,
  hashFileSha1,
  scanRomFiles,
  matchAndReport,
} from "./canonicalize.ts";

const FIXTURE_DATFILE = `<?xml version="1.0"?>
<!DOCTYPE datafile SYSTEM "http://www.logiqx.com/Dats/datafile.dtd">
<datafile>
  <header>
    <name>Test Datfile</name>
  </header>
  <game name="Combat (1977)(Atari)">
    <description>Combat (1977)(Atari)</description>
    <rom name="Combat (1977)(Atari).bin" size="2048" crc="4020b4fe" md5="b35e9442525e1a0b30dc0264c112233" sha1="da39a3ee5e6b4b0d3255bfef95601890afd80709" />
  </game>
  <game name="Adventure (1980)(Atari)">
    <description>Adventure (1980)(Atari)</description>
    <rom name="Adventure (1980)(Atari).a26" size="4096" crc="12345678" md5="abcdef0123456789abcdef0123456789" sha1="aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d" />
  </game>
</datafile>`;

describe("parseDatfile", () => {
  test("extracts rom entries from Logiqx XML", () => {
    const lookup = parseDatfile(FIXTURE_DATFILE);
    expect(lookup.size).toBe(2);
  });

  test("keys by lowercase sha1", () => {
    const lookup = parseDatfile(FIXTURE_DATFILE);
    expect(lookup.has("da39a3ee5e6b4b0d3255bfef95601890afd80709")).toBe(true);
    expect(lookup.has("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d")).toBe(true);
  });

  test("preserves canonical name from datfile", () => {
    const lookup = parseDatfile(FIXTURE_DATFILE);
    const entry = lookup.get("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
    expect(entry?.name).toBe("Adventure (1980)(Atari).a26");
  });

  test("decodes XML entities in canonical names", () => {
    const xml = `<rom name="Fish &amp; Chips &quot;Demo&quot;.bin" size="5" sha1="aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d" />`;
    const lookup = parseDatfile(xml);
    const entry = lookup.get("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
    expect(entry?.name).toBe('Fish & Chips "Demo".bin');
  });

  test("handles single-quoted XML attributes", () => {
    const xml = `<rom name='SingleQuote.bin' size='1024' sha1='aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d' />`;
    const lookup = parseDatfile(xml);
    expect(lookup.size).toBe(1);
    const entry = lookup.get("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
    expect(entry?.name).toBe("SingleQuote.bin");
  });

  test("returns empty map for empty input", () => {
    const lookup = parseDatfile("");
    expect(lookup.size).toBe(0);
  });

  test("handles datfile with no sha1 attributes gracefully", () => {
    const xml = `<rom name="NoHash.bin" size="1024" crc="00000000" />`;
    const lookup = parseDatfile(xml);
    expect(lookup.size).toBe(0);
  });
});

describe("hashFileSha1", () => {
  test("computes correct SHA1 for known content", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-test-"));
    const file = join(tmp, "test.bin");
    writeFileSync(file, "hello");
    const sha1 = hashFileSha1(file);
    expect(sha1).toBe("aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
  });

  test("computes correct SHA1 for empty file", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-test-"));
    const file = join(tmp, "empty.bin");
    writeFileSync(file, "");
    const sha1 = hashFileSha1(file);
    expect(sha1).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
  });
});

describe("scanRomFiles", () => {
  test("finds .bin and .a26 files", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-scan-"));
    writeFileSync(join(tmp, "game.bin"), "data");
    writeFileSync(join(tmp, "game2.a26"), "data");
    writeFileSync(join(tmp, "README.md"), "docs");

    const files = scanRomFiles(tmp);
    expect(files.length).toBe(2);
    expect(files.some((f) => f.endsWith("game.bin"))).toBe(true);
    expect(files.some((f) => f.endsWith("game2.a26"))).toBe(true);
  });

  test("ignores non-ROM files", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-scan-"));
    writeFileSync(join(tmp, "notes.txt"), "data");
    writeFileSync(join(tmp, "save.sav"), "data");
    writeFileSync(join(tmp, "README"), "data");
    writeFileSync(join(tmp, ".DS_Store"), "data");

    const files = scanRomFiles(tmp);
    expect(files.length).toBe(0);
  });
});

describe("matchAndReport", () => {
  test("matches file by SHA1 and reports canonical name", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-match-"));
    const file = join(tmp, "hello.bin");
    writeFileSync(file, "hello");

    const lookup = parseDatfile(FIXTURE_DATFILE);
    const results = matchAndReport(lookup, [file], false);
    expect(results.length).toBe(1);
    expect(results[0]?.matched).toBe(true);
    expect(results[0]?.canonicalName).toBe("Adventure (1980)(Atari).a26");
    expect(results[0]?.renamed).toBe(false);
  });

  test("reports unmatched files", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-nomatch-"));
    const file = join(tmp, "unknown.bin");
    writeFileSync(file, "this content has no datfile entry");

    const lookup = parseDatfile(FIXTURE_DATFILE);
    const results = matchAndReport(lookup, [file], false);
    expect(results.length).toBe(1);
    expect(results[0]?.matched).toBe(false);
    expect(results[0]?.canonicalName).toBeNull();
  });

  test("renames file when --apply is true", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-rename-"));
    const file = join(tmp, "wrong-name.bin");
    writeFileSync(file, "hello");

    const lookup = parseDatfile(FIXTURE_DATFILE);
    const results = matchAndReport(lookup, [file], true);
    expect(results[0]?.renamed).toBe(true);

    const renamedPath = join(tmp, "Adventure (1980)(Atari).a26");
    expect(() => readFileSync(renamedPath)).not.toThrow();
  });

  test("does not apply unsafe canonical names with path separators", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-unsafe-name-"));
    const file = join(tmp, "wrong-name.bin");
    writeFileSync(file, "hello");

    const lookup = parseDatfile(
      `<rom name="../escaped.a26" size="5" sha1="aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d" />`,
    );
    const results = matchAndReport(lookup, [file], true);

    expect(results[0]?.matched).toBe(true);
    expect(results[0]?.renamed).toBe(false);
    expect(existsSync(file)).toBe(true);
    expect(existsSync(join(tmp, "..", "escaped.a26"))).toBe(false);
  });

  test("does not apply unsafe canonical names with Windows separators", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-unsafe-win-name-"));
    const file = join(tmp, "wrong-name.bin");
    writeFileSync(file, "hello");

    const lookup = parseDatfile(
      `<rom name="nested\\\\escaped.a26" size="5" sha1="aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d" />`,
    );
    const results = matchAndReport(lookup, [file], true);

    expect(results[0]?.matched).toBe(true);
    expect(results[0]?.renamed).toBe(false);
    expect(existsSync(file)).toBe(true);
  });

  test("does not rename when file already has canonical name", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-already-"));
    const file = join(tmp, "Adventure (1980)(Atari).a26");
    writeFileSync(file, "hello");

    const lookup = parseDatfile(FIXTURE_DATFILE);
    const results = matchAndReport(lookup, [file], true);
    expect(results[0]?.matched).toBe(true);
    expect(results[0]?.renamed).toBe(false);
  });
});

describe("main", () => {
  test("reports missing datfile value clearly", () => {
    const originalStderrWrite = process.stderr.write;
    let stderr = "";

    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderr += String(chunk);
      return true;
    }) as typeof process.stderr.write;

    try {
      const code = main(["--datfile"]);
      expect(code).toBe(64);
      expect(stderr).toContain("missing value for --datfile");
    } finally {
      process.stderr.write = originalStderrWrite;
    }
  });

  test("accepts hyphen-prefixed datfile and directory values", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rom-cli-hyphen-"));
    const originalCwd = process.cwd();
    writeFileSync(join(tmp, "-set.dat"), FIXTURE_DATFILE);
    mkdirSync(join(tmp, "-roms"));

    try {
      process.chdir(tmp);
      const code = main(["--datfile", "-set.dat", "--dir", "-roms"]);
      expect(code).toBe(0);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
