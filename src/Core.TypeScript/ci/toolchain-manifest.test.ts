// toolchain-manifest.test.ts -- falsifiers for the image-vs-declaration drift check.
//
// The thing being guarded is a check that could very easily be VACUOUS. A comparison
// between "what the image has" and "what the repo declares" reads as rigorous and can be
// made to pass in three different ways that measure nothing:
//
//   1. a declared tool that is absent from the runtime is silently skipped;
//   2. a version that does not match is accepted because the comparison is a substring;
//   3. `mise ls` fails to run and the absent output is read as "nothing wrong".
//
// Each of those has a test below that FAILS if the guard against it is removed. The
// third one is not testable through the pure functions -- it lives in the CLI -- so it is
// named here and pinned in the workflow instead, honestly rather than pretended.

import { describe, expect, test } from "bun:test";

import {
  compare,
  parseDeclaredTools,
  parseMiseLs,
  shortName,
  unmanagedSurfaces,
  versionSatisfies,
} from "./toolchain-manifest.ts";

const MISE_TOML_FIXTURE = `
# A comment mentioning bun = "9.9.9" which must NOT be parsed.
min_version = "2026.6.12"

[tools]
dotnet = "10.0.400"
bun = "1.3"
java = "26"
rust = { version = "1.87.0", components = ["rustfmt", "clippy"], targets = ["wasm32-unknown-unknown"] }
"pipx:semgrep" = "1.174.0"
"github:yannh/kubeconform" = "0.7.0"
"1password-cli" = "2.34.1"

[settings]
python.compile = false
node.compile = false
`;

describe("parseDeclaredTools", () => {
  test("reads scalar, quoted-key, and inline-table pins and nothing else", () => {
    const tools = parseDeclaredTools(MISE_TOML_FIXTURE);
    const byKey = new Map(tools.map((t) => [t.key, t.version]));
    expect(byKey.get("dotnet")).toBe("10.0.400");
    expect(byKey.get("bun")).toBe("1.3");
    expect(byKey.get("rust")).toBe("1.87.0");
    expect(byKey.get("pipx:semgrep")).toBe("1.174.0");
    expect(byKey.get("github:yannh/kubeconform")).toBe("0.7.0");
    expect(byKey.get("1password-cli")).toBe("2.34.1");
    expect(tools.length).toBe(7);
  });

  test("`min_version` and the [settings] table are NOT tools", () => {
    const keys = parseDeclaredTools(MISE_TOML_FIXTURE).map((t) => t.key);
    expect(keys).not.toContain("min_version");
    expect(keys).not.toContain("python.compile");
    expect(keys).not.toContain("node.compile");
  });

  test("a version mentioned only in a COMMENT is not a declaration", () => {
    // `.mise.toml` in this repo carries hundreds of lines of prose citing old versions.
    // Reading one as a pin would produce a permanent false red that no rebuild can fix.
    const tools = parseDeclaredTools(MISE_TOML_FIXTURE);
    expect(tools.find((t) => t.key === "bun")?.version).toBe("1.3");
    expect(tools.some((t) => t.version === "9.9.9")).toBe(false);
  });
});

describe("shortName", () => {
  test("strips the mise backend prefix and any owner path", () => {
    expect(shortName("pipx:semgrep")).toBe("semgrep");
    expect(shortName("npm:markdownlint-cli2")).toBe("markdownlint-cli2");
    expect(shortName("github:yannh/kubeconform")).toBe("kubeconform");
    expect(shortName("1password-cli")).toBe("1password-cli");
  });
});

describe("parseMiseLs", () => {
  test("accepts both payload shapes mise has shipped", () => {
    const asArray = parseMiseLs({ bun: [{ version: "1.3.0", installed: true }] });
    const asObject = parseMiseLs({ bun: { version: "1.3.0", installed: true } });
    expect(asArray).toEqual([{ name: "bun", version: "1.3.0" }]);
    expect(asObject).toEqual(asArray);
  });

  // THE VACUITY GUARD. mise LISTS a declared-but-not-installed tool rather than omitting
  // it. Read that row as presence and the checker can never report `missing` -- it would
  // pass on an image where install.sh did nothing at all.
  test("`installed: false` counts as ABSENT, not as present", () => {
    expect(parseMiseLs({ bun: [{ version: "1.3.0", installed: false }] })).toEqual([]);
  });

  test("a row with no version string is not invented into one", () => {
    expect(parseMiseLs({ bun: [{ installed: true }] })).toEqual([]);
  });
});

describe("versionSatisfies", () => {
  test("a partial pin is satisfied by a longer version at a dot boundary", () => {
    expect(versionSatisfies("1.3", "1.3.0")).toBe(true);
    expect(versionSatisfies("26", "26.0.1")).toBe(true);
    expect(versionSatisfies("10.0.400", "10.0.400")).toBe(true);
  });

  // THE SUBSTRING TRAP. Without the required separator, `1.3` would be satisfied by
  // `1.30.0` -- a different minor -- and the check would accept a real drift.
  test("the dot separator is REQUIRED, so 1.30 does not satisfy 1.3", () => {
    expect(versionSatisfies("1.3", "1.30.0")).toBe(false);
    expect(versionSatisfies("26", "260")).toBe(false);
  });
});

describe("compare", () => {
  const declared = parseDeclaredTools(MISE_TOML_FIXTURE);

  test("a runtime carrying every pin produces NO findings", () => {
    const installed = declared.map((d) => ({ name: d.name, version: `${d.version}.0` }));
    expect(compare(declared, installed)).toEqual([]);
  });

  test("a declared tool absent from the runtime is reported MISSING", () => {
    const installed = declared.filter((d) => d.key !== "bun").map((d) => ({ name: d.name, version: d.version }));
    const findings = compare(declared, installed);
    expect(findings).toEqual([{ kind: "missing", key: "bun", declared: "1.3" }]);
  });

  // The live drift this whole mechanism exists for: someone bumps a pin in `.mise.toml`
  // and the image is not rebuilt. If this test can be made to pass with the comparison
  // deleted, the check is decoration.
  test("a pin that moved without an image rebuild is reported MISMATCH", () => {
    const installed = declared.map((d) => ({
      name: d.name,
      version: d.key === "dotnet" ? "10.0.303" : d.version,
    }));
    const findings = compare(declared, installed);
    expect(findings).toEqual([{ kind: "mismatch", key: "dotnet", declared: "10.0.400", installed: "10.0.303" }]);
  });

  test("an EMPTY runtime is maximally red, not silently green", () => {
    expect(compare(declared, []).length).toBe(declared.length);
  });

  test("extra tools the runtime carries beyond the declaration are not an error", () => {
    const installed = [
      ...declared.map((d) => ({ name: d.name, version: d.version })),
      { name: "something-else", version: "0.0.1" },
    ];
    expect(compare(declared, installed)).toEqual([]);
  });
});

describe("scope honesty", () => {
  // A green from this check covers the mise-managed set and NOTHING ELSE. The list of
  // blind spots is printed on every run; this pins that it stays non-empty, because an
  // emptied list would turn a narrow pass into an implied full verification.
  test("the uncovered surfaces are enumerated, not left implicit", () => {
    const surfaces = unmanagedSurfaces();
    expect(surfaces.length).toBeGreaterThan(0);
    expect(surfaces.join("\n")).toContain("manifests/apt");
    expect(surfaces.join("\n")).toContain("from-elan");
  });
});

describe("the real .mise.toml", () => {
  // Not a fixture: the file the image is actually built against. If the hand parser ever
  // stops understanding the shapes this repo uses, this goes red here rather than in a
  // container build twenty minutes later.
  test("parses the repo's own pins and finds the ones we depend on", async () => {
    const { readFile } = await import("node:fs/promises");
    const tools = parseDeclaredTools(await readFile(".mise.toml", "utf8"));
    const keys = new Set(tools.map((t) => t.key));
    for (const required of ["bun", "dotnet", "go", "rust", "python", "node"]) {
      expect(keys.has(required)).toBe(true);
    }
    // Every parsed pin must carry a non-empty version -- a blank one would compare
    // against everything and quietly satisfy itself.
    expect(tools.every((t) => t.version.length > 0)).toBe(true);
  });
});
