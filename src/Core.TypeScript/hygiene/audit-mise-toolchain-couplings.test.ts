import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CANONICAL,
  PROVENANCE,
  findRustRestatements,
  findZigRestatements,
  parseRustPin,
  parseZigPin,
  sha256File,
  type Provenance,
} from "./audit-mise-toolchain-couplings.ts";

describe("parseRustPin — both spellings mise accepts", () => {
  test("table form (what .mise.toml actually uses)", () => {
    expect(
      parseRustPin(`rust = { version = "1.87.0", components = ["rustfmt", "clippy"], targets = ["wasm32-unknown-unknown"] }`),
    ).toBe("1.87.0");
  });
  test("plain form", () => {
    expect(parseRustPin(`rust = "1.87.0"`)).toBe("1.87.0");
  });
  test("absent is null, not a crash and not a silent pass", () => {
    expect(parseRustPin(`go = "1.26.4"`)).toBeNull();
  });
});

describe("findRustRestatements — what counts as OPERATIVE", () => {
  test("a rustup cache glob is a restatement", () => {
    const r = findRustRestatements("gate.yml", `          path: |\n            ~/.rustup/toolchains/1.87.0-*\n`);
    expect(r).toHaveLength(1);
    expect(r[0]?.version).toBe("1.87.0");
    expect(r[0]?.kind).toBe("rustup cache glob");
  });

  test("a shell RUST_VERSION default is a restatement", () => {
    const r = findRustRestatements("install-rust-wasm32.sh", `RUST_VERSION="\${RUST_VERSION:-1.87.0}"\n`);
    expect(r.map((x) => x.kind)).toEqual(["RUST_VERSION shell default"]);
  });

  test("a second mise config's own pin is a restatement", () => {
    const r = findRustRestatements(".mise.full.toml", `rust = { version = "1.87.0", components = [] }\n`);
    expect(r.map((x) => x.kind)).toEqual(["mise rust pin"]);
  });

  test("PROSE IS NOT A RESTATEMENT — this is the check's own falsifier", () => {
    // `.mise.toml` and the workflows both DISCUSS the version in `#` comments, and
    // `docs/` is full of true historical statements like "1.87.0 is 11 releases behind".
    // A checker that fired on those would be silenced within a week, or would force people
    // to falsify their own records. Check what executes, never what narrates.
    const prose = [
      `# A version bump must also move the \`1.87.0-*\` rustup-toolchain cache globs.`,
      `#     \`~/.local/share/mise/installs/rust/1.87.0\` is a SYMLINK to`,
      `  echo "  WARNING: rustup not found (Rust managed via mise: rust = \\"1.87.0\\")"`,
      `rust 1.87.0 is eleven releases behind 1.98.0`,
    ].join("\n");
    expect(findRustRestatements("mixed.toml", prose)).toEqual([]);
  });

  test("a commented-out mise pin does not count", () => {
    expect(findRustRestatements("x.toml", `# rust = "1.60.0"\n`)).toEqual([]);
  });
});

describe("findZigRestatements", () => {
  test("finds the pin, ignores the comment", () => {
    const r = findZigRestatements(".mise.full.toml", `# zig = "0.11.0" was the old one\nzig = "0.13.0"\n`);
    expect(r.map((x) => x.version)).toEqual(["0.13.0"]);
  });
});

describe("the REAL tree — the state this check was written to protect", () => {
  const canonical = readFileSync(CANONICAL, "utf8");

  test("the canonical pins are present and parse", () => {
    expect(parseRustPin(canonical)).toMatch(/^\d+\.\d+\.\d+$/);
    expect(parseZigPin(canonical)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("the recorded byte-lock sha256 is the artifact's ACTUAL hash", () => {
    // Not a restatement of a restatement: this hashes the committed bytes.
    const prov = JSON.parse(readFileSync(PROVENANCE, "utf8")) as Provenance;
    expect(sha256File(prov.zig.artifact)).toBe(prov.zig.sha256);
  });

  test("the recorded byte-lock zig version is the pinned one", () => {
    const prov = JSON.parse(readFileSync(PROVENANCE, "utf8")) as Provenance;
    expect(prov.zig.version).toBe(parseZigPin(canonical) ?? "<no zig pin in .mise.toml>");
  });

  test("more than the two restatement sites the prose named actually exist", () => {
    // `.mise.toml`'s own comment describes this coupling as two workflow files. Measured
    // 2026-08-23 it is materially more, which is why the site list is discovered rather
    // than written down. If this ever drops to <= 2 the discovery has broken, not the tree.
    const files = [".mise.full.toml", ".github/workflows/gate.yml", ".github/workflows/installer-unit-tests.yml"];
    const found = files.flatMap((f) => findRustRestatements(f, readFileSync(f, "utf8")));
    expect(found.length).toBeGreaterThan(2);
  });
});
