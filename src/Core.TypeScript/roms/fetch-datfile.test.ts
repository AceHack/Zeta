import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseManifest,
  isPlaceholder,
  sha256Hex,
  verifyChecksum,
  fetchBlockReason,
  checkedDownloadUrl,
  loadManifest,
  main,
  DEFAULT_MANIFEST,
  type DatfilePin,
} from "./fetch-datfile.ts";

const VERIFIED_PIN: DatfilePin = {
  platform: "test-2600",
  source: "TOSEC",
  release: "2025-03-13",
  datfileName: "Test (TOSEC).dat",
  sourceUrl: "https://example.test/release",
  // sha256Hex of UTF-8 "abc"
  downloadUrl: "https://example.test/test.dat",
  sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  romsDir: "test/2600",
};

function manifestJson(pins: readonly Partial<DatfilePin>[]): string {
  return JSON.stringify({ datfiles: pins });
}

describe("parseManifest", () => {
  test("parses a well-formed entry into a platform-keyed map", () => {
    const pins = parseManifest(manifestJson([VERIFIED_PIN]));
    expect(pins.size).toBe(1);
    expect(pins.get("test-2600")?.source).toBe("TOSEC");
  });

  test("throws on invalid JSON", () => {
    expect(() => parseManifest("{not json")).toThrow(/not valid JSON/);
  });

  test("throws when datfiles array is missing", () => {
    expect(() => parseManifest("{}")).toThrow(/missing "datfiles"/);
  });

  test("throws on an entry missing a required field", () => {
    const { sha256, ...partial } = VERIFIED_PIN;
    expect(() => parseManifest(manifestJson([partial]))).toThrow(/sha256/);
  });

  test("throws on an empty-string required field", () => {
    expect(() =>
      parseManifest(manifestJson([{ ...VERIFIED_PIN, platform: "" }])),
    ).toThrow(/platform/);
  });

  test("throws on a missing romsDir (explicit-path field is required)", () => {
    const { romsDir, ...partial } = VERIFIED_PIN;
    expect(() => parseManifest(manifestJson([partial]))).toThrow(/romsDir/);
  });

  test("throws on a duplicate platform", () => {
    expect(() =>
      parseManifest(manifestJson([VERIFIED_PIN, VERIFIED_PIN])),
    ).toThrow(/duplicate platform/);
  });

  test("ignores the _comment field", () => {
    const json = JSON.stringify({
      _comment: ["doc string"],
      datfiles: [VERIFIED_PIN],
    });
    expect(parseManifest(json).size).toBe(1);
  });
});

describe("isPlaceholder", () => {
  test("flags angle-bracket-wrapped values", () => {
    expect(isPlaceholder("<SHA256-VERIFY-ON-FETCH>")).toBe(true);
    expect(isPlaceholder("<DIRECT-DAT-URL-VERIFY-ON-FETCH>")).toBe(true);
  });

  test("passes concrete values", () => {
    expect(isPlaceholder("https://example.test/x.dat")).toBe(false);
    expect(isPlaceholder("ba7816bf")).toBe(false);
    expect(isPlaceholder("")).toBe(false);
  });
});

describe("sha256Hex / verifyChecksum", () => {
  const abc = new TextEncoder().encode("abc");
  const knownAbc =
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

  test("computes a known SHA-256", () => {
    expect(sha256Hex(abc)).toBe(knownAbc);
  });

  test("verifyChecksum accepts a match (case-insensitive expected)", () => {
    expect(verifyChecksum(abc, knownAbc)).toBe(true);
    expect(verifyChecksum(abc, knownAbc.toUpperCase())).toBe(true);
  });

  test("verifyChecksum rejects a mismatch", () => {
    expect(verifyChecksum(abc, "deadbeef")).toBe(false);
    expect(verifyChecksum(new TextEncoder().encode("abd"), knownAbc)).toBe(
      false,
    );
  });
});

describe("fetchBlockReason (fail-closed gate)", () => {
  test("blocks a placeholder downloadUrl", () => {
    const pin = { ...VERIFIED_PIN, downloadUrl: "<DIRECT-DAT-URL-VERIFY-ON-FETCH>" };
    expect(fetchBlockReason(pin)).toMatch(/downloadUrl.*placeholder/);
  });

  test("blocks a placeholder sha256", () => {
    const pin = { ...VERIFIED_PIN, sha256: "<SHA256-VERIFY-ON-FETCH>" };
    expect(fetchBlockReason(pin)).toMatch(/sha256.*placeholder/);
  });

  test("allows a fully verified pin", () => {
    expect(fetchBlockReason(VERIFIED_PIN)).toBeNull();
  });
});

describe("checkedDownloadUrl — the manifest decides where this process connects", () => {
  const withUrl = (downloadUrl: string): DatfilePin => ({ ...VERIFIED_PIN, downloadUrl });

  test("returns the URL it validated, so the caller cannot use the unchecked one", () => {
    const url = "https://example.org:8443/tosec/pack.zip?v=1&x=2#frag";
    expect(checkedDownloadUrl(withUrl(url))).toBe(url);
  });

  test("refuses every scheme but https — including the two that turn a download into a local read", () => {
    for (const bad of [
      "file:///etc/passwd",
      "data:text/plain,x",
      "http://example.org/a.zip",
      "ftp://example.org/a.zip",
      "//example.org/a.zip",
    ]) {
      expect(() => checkedDownloadUrl(withUrl(bad))).toThrow(/not an https URL/);
    }
  });

  test("refuses userinfo, whitespace, control characters and non-ASCII", () => {
    // `[^\s]*` accepted every one of these; the explicit RFC 3986 set does not.
    for (const bad of [
      "https://user:pass@example.org/a.zip",
      "https://example.org/a b.zip",
      "https://example.org/a\u0000.zip",
      "https://example.org/\u202Ezip.exe",
      "https://exa\u0000mple.org/a.zip",
    ]) {
      expect(() => checkedDownloadUrl(withUrl(bad))).toThrow(/not an https URL/);
    }
  });

  test("a placeholder never reaches the network, from either guard", () => {
    const pin = withUrl("<DIRECT-DAT-URL-VERIFY-ON-FETCH>");
    expect(fetchBlockReason(pin)).toMatch(/downloadUrl.*placeholder/); // the fail-closed gate, first
    expect(() => checkedDownloadUrl(pin)).toThrow(/not an https URL/); // and again at the value boundary
  });
});

describe("real pinned manifest", () => {
  test("src/Core.TypeScript/roms/manifests/datfiles.json parses", () => {
    const pins = loadManifest(DEFAULT_MANIFEST);
    expect(pins.has("atari-2600")).toBe(true);
  });

  test("atari-2600 pins the WebSearch-verified TOSEC release", () => {
    const pin = loadManifest(DEFAULT_MANIFEST).get("atari-2600")!;
    expect(pin.source).toBe("TOSEC");
    expect(pin.release).toBe("2025-03-13");
  });

  test("atari-2600 is fail-closed until the operator verifies the pin", () => {
    const pin = loadManifest(DEFAULT_MANIFEST).get("atari-2600")!;
    expect(fetchBlockReason(pin)).not.toBeNull();
  });
});

describe("main (CLI, no network)", () => {
  test("no args => usage error exit 64", async () => {
    expect(await main([])).toBe(64);
  });

  test("unknown arg => exit 64", async () => {
    expect(await main(["--bogus"])).toBe(64);
  });

  test("--help => exit 0", async () => {
    expect(await main(["--help"])).toBe(0);
  });

  test("missing manifest => exit 1", async () => {
    expect(
      await main(["--platform", "atari-2600", "--manifest", "/no/such/file"]),
    ).toBe(1);
  });

  test("--list against real manifest => exit 0", async () => {
    expect(await main(["--list"])).toBe(0);
  });

  test("unknown platform => exit 1", async () => {
    expect(await main(["--platform", "nonesuch-9999"])).toBe(1);
  });

  test("placeholder pin fails closed => exit 2 (no network)", async () => {
    expect(await main(["--platform", "atari-2600"])).toBe(2);
  });

  test("verified pin with missing platform in a temp manifest still exit 2 when placeholder", async () => {
    const dir = mkdtempSync(join(tmpdir(), "datfile-test-"));
    const path = join(dir, "m.json");
    writeFileSync(
      path,
      manifestJson([{ ...VERIFIED_PIN, downloadUrl: "<placeholder>" }]),
    );
    expect(
      await main(["--platform", "test-2600", "--manifest", path]),
    ).toBe(2);
  });
});
