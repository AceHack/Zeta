import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
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
  test("table form accepts a beta point-release", () => {
    expect(
      parseRustPin(`rust = { version = "1.99.0-beta.3", components = ["rustfmt"] }`),
    ).toBe("1.99.0-beta.3");
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

  test("a beta point-release glob is a restatement of the full pin, not 1.99.0", () => {
    const r = findRustRestatements(
      "gate.yml",
      `            ~/.rustup/toolchains/1.99.0-beta.3-*\n`,
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.version).toBe("1.99.0-beta.3");
  });

  test("a shell RUST_VERSION default is a restatement", () => {
    const r = findRustRestatements("install-rust-wasm32.sh", `RUST_VERSION="\${RUST_VERSION:-1.87.0}"\n`);
    expect(r.map((x) => x.kind)).toEqual(["RUST_VERSION shell default"]);
  });

  test("a YAML RUSTUP_TOOLCHAIN pin is a restatement of the full beta pin", () => {
    const r = findRustRestatements("feldera-native.yml", `  RUSTUP_TOOLCHAIN: "1.99.0-beta.3"\n`);
    expect(r).toHaveLength(1);
    expect(r[0]?.kind).toBe("RUSTUP_TOOLCHAIN yaml");
    expect(r[0]?.version).toBe("1.99.0-beta.3");
  });

  test("an interpolated RUSTUP_TOOLCHAIN is a probe compiler, not a restatement", () => {
    expect(
      findRustRestatements("feldera-native.yml", `      RUSTUP_TOOLCHAIN: \${{ matrix.pair.rust }}\n`),
    ).toEqual([]);
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
    expect(parseRustPin(canonical)).toMatch(/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/);
    expect(parseZigPin(canonical)).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test("the recorded byte-lock sha256 is the artifact's ACTUAL hash — when the artifact is there", () => {
    // Not a restatement of a restatement: this hashes the actual bytes.
    //
    // CONDITIONAL SINCE 2026-09-10, and the condition is load-bearing rather than an escape.
    // The Zig substrate is BUILT rather than committed, so on a lane with no zig — this
    // suite's own, and every hermetic tier — the file is legitimately absent and there are no
    // bytes to hash. Asserting on them would go red for an environmental reason and teach
    // nothing; skipping would be the vacuous half.
    //
    // So the assertion splits by which question is answerable HERE:
    //
    //   * artifact present (a developer who has just run `build-substrates.mjs`, or the
    //     byte-lock job after its build step) — hash it, exactly as before.
    //   * artifact absent — assert the thing that IS still checkable: that the one lane which
    //     has zig actually runs the audit. Same guard `checkByteLockProvenance` applies,
    //     pinned here so deleting that workflow step is a red test rather than a provenance
    //     record nothing verifies.
    const prov = JSON.parse(readFileSync(PROVENANCE, "utf8")) as Provenance;
    if (existsSync(prov.zig.artifact)) {
      expect(sha256File(prov.zig.artifact)).toBe(prov.zig.sha256);
      return;
    }
    expect(readFileSync(".github/workflows/bytelock.yml", "utf8")).toContain(
      "audit-mise-toolchain-couplings.ts",
    );
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
