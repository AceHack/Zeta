// outdated-inventory.test.ts -- falsifiers for the PINNED half of `ace outdated`.
//
// Every parser here is tested against (a) a fixture that pins the shape, and (b) the REAL
// committed manifest, so a parser that silently stops matching this repo's actual files fails
// rather than passing on a fixture that has drifted away from the tree.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyPin,
  collectPinned,
  manifestRoster,
  parseCargoDependencies,
  parseGoMod,
  parseMiseTools,
  parseNuGetCentralVersions,
  parsePackageJsonDependencies,
  parseUvLock,
} from "./outdated-inventory.ts";

const ROOT = resolve(import.meta.dir, "../../..");

describe("classifyPin", () => {
  test("a three-component version is an exact pin", () => {
    expect(classifyPin("1.2.3")).toBe("exact");
    expect(classifyPin("v0.30.0")).toBe("exact");
  });

  // THE RANGE CASES ARE THE POINT. A range compared as if it were a version produces a confident
  // wrong "behind" verdict, which is the failure mode this whole command exists to avoid.
  test("a constraint is a range, never an exact pin", () => {
    for (const r of ["^1.2.3", "~1.2.3", ">=6.0.2", "1.3", "1", "*", ">=1.0, <2.0", "1.2.3 || 2.0.0"]) {
      expect(classifyPin(r)).toBe("range");
    }
  });

  test("empty text is a range, not an exact pin", () => {
    expect(classifyPin("")).toBe("range");
    expect(classifyPin("   ")).toBe("range");
  });
});

describe("parseNuGetCentralVersions", () => {
  test("reads Include/Version in either attribute order", () => {
    const xml = `<Project><ItemGroup>
      <PackageVersion Include="A" Version="1.0.0" />
      <PackageVersion Version="2.0.0" Include="B" />
    </ItemGroup></Project>`;
    const got = parseNuGetCentralVersions(xml, "p");
    expect(got.map((d) => `${d.name}@${d.current}`)).toEqual(["A@1.0.0", "B@2.0.0"]);
  });

  // A COMMENTED PIN IS NOT A PIN. `Directory.Packages.props` in this repo really does carry
  // PackageVersion lines inside explanatory comment blocks; counting them would report a
  // dependency the build does not have.
  test("ignores PackageVersion inside an XML comment", () => {
    const xml = `<Project><ItemGroup>
      <PackageVersion Include="Live" Version="1.0.0" />
      <!-- <PackageVersion Include="Dead" Version="9.9.9" /> -->
    </ItemGroup></Project>`;
    expect(parseNuGetCentralVersions(xml, "p").map((d) => d.name)).toEqual(["Live"]);
  });

  test("skips an MSBuild property reference -- it is not a version we can resolve", () => {
    const xml = `<PackageVersion Include="X" Version="$(SomeProperty)" />`;
    expect(parseNuGetCentralVersions(xml, "p")).toEqual([]);
  });

  test("the REAL Directory.Packages.props yields pins, all exact", () => {
    const text = readFileSync(resolve(ROOT, "Directory.Packages.props"), "utf8");
    const got = parseNuGetCentralVersions(text, "Directory.Packages.props");
    expect(got.length).toBeGreaterThan(20);
    expect(got.every((d) => d.ecosystem === "nuget")).toBe(true);
    expect(got.some((d) => d.name === "FSharp.Core")).toBe(true);
  });
});

describe("parsePackageJsonDependencies", () => {
  test("reads dependencies and devDependencies", () => {
    const json = JSON.stringify({ dependencies: { a: "1.0.0" }, devDependencies: { b: "2.0.0" } });
    expect(parsePackageJsonDependencies(json, "p").map((d) => d.name).sort()).toEqual(["a", "b"]);
  });

  test("skips non-registry specifiers rather than asking npm about a filesystem path", () => {
    const json = JSON.stringify({
      dependencies: { real: "1.0.0", local: "file:../x", repo: "github:o/r", ws: "workspace:*" },
    });
    expect(parsePackageJsonDependencies(json, "p").map((d) => d.name)).toEqual(["real"]);
  });

  test("malformed JSON yields no rows rather than throwing into the caller", () => {
    expect(parsePackageJsonDependencies("{not json", "p")).toEqual([]);
  });

  test("the REAL package.json yields pins", () => {
    const text = readFileSync(resolve(ROOT, "package.json"), "utf8");
    const got = parsePackageJsonDependencies(text, "package.json");
    expect(got.length).toBeGreaterThan(20);
    expect(got.some((d) => d.name === "typescript")).toBe(true);
  });
});

describe("parseMiseTools", () => {
  test("keys are BACKEND-QUALIFIED -- pipx:semgrep is not semgrep", () => {
    const toml = `[tools]\nbun = "1.3.0"\n"pipx:semgrep" = "1.174.0"\n`;
    const got = parseMiseTools(toml, ".mise.toml");
    expect(got.map((d) => d.name).sort()).toEqual(["bun", "pipx:semgrep"]);
  });

  test("the REAL .mise.toml yields tools", () => {
    const text = readFileSync(resolve(ROOT, ".mise.toml"), "utf8");
    expect(parseMiseTools(text, ".mise.toml").length).toBeGreaterThan(5);
  });
});

describe("parseGoMod", () => {
  test("reads both the single-line require and the block", () => {
    const mod = `module m\n\ngo 1.26\n\nrequire gopkg.in/yaml.v3 v3.0.1\n\nrequire (\n\tgithub.com/x/y v1.2.3 // indirect\n)\n`;
    const got = parseGoMod(mod, "go.mod");
    expect(got.map((d) => `${d.name}@${d.current}`)).toEqual(["gopkg.in/yaml.v3@v3.0.1", "github.com/x/y@v1.2.3"]);
  });

  test("the REAL go.mod yields pins", () => {
    const text = readFileSync(resolve(ROOT, "src/Core.Go/go.mod"), "utf8");
    expect(parseGoMod(text, "src/Core.Go/go.mod").length).toBeGreaterThan(2);
  });
});

describe("parseCargoDependencies", () => {
  // A PATH DEPENDENCY IS A SIBLING CRATE. Asking crates.io about `zeta-core-yaml` would return an
  // answer about somebody else's crate of that name -- worse than no answer.
  // THE VERSION-ALONGSIDE-PATH CASE IS THE ONE THAT MATTERS. Cargo permits
  // `{ path = "...", version = "..." }` -- the version is a publish-time hint, and the BUILD uses
  // the local path. A parser that skipped only version-less path entries would pass a weaker
  // fixture and still ask crates.io about a sibling crate. (Caught by mutation: the first draft
  // of this test used a version-less path entry, and the guard removal survived it.)
  test("skips path and git dependencies EVEN when they also carry a version", () => {
    const toml = [
      "[dependencies]",
      'blake3 = "1.5.1"',
      'sib = { path = "../Other" }',
      'sibv = { path = "../Other", version = "0.1.0" }',
      'gg = { git = "https://x", version = "2.0.0" }',
    ].join("\n");
    expect(parseCargoDependencies(toml, "c").map((d) => d.name)).toEqual(["blake3"]);
  });

  test("reads dev- and build-dependencies tables too", () => {
    const toml = `[dev-dependencies]\nserde = "1.0.0"\n[build-dependencies]\ncc = "1.0.1"\n`;
    expect(parseCargoDependencies(toml, "c").map((d) => d.name).sort()).toEqual(["cc", "serde"]);
  });

  test("an inline table with a version and no path is a registry dependency", () => {
    const toml = `[dependencies]\nserde = { version = "1.0.2", features = ["derive"] }\n`;
    expect(parseCargoDependencies(toml, "c").map((d) => d.current)).toEqual(["1.0.2"]);
  });

  test("stops reading at the next non-dependency table", () => {
    const toml = `[dependencies]\na = "1.0.0"\n[lints.rust]\nunsafe_code = "forbid"\n`;
    expect(parseCargoDependencies(toml, "c").map((d) => d.name)).toEqual(["a"]);
  });
});

describe("parseUvLock", () => {
  test("takes registry packages and leaves the local project alone", () => {
    const lock = [
      "[[package]]",
      'name = "pyyaml"',
      'version = "6.0.2"',
      'source = { registry = "https://pypi.org/simple" }',
      "",
      "[[package]]",
      'name = "zeta-core"',
      'version = "0.1.0"',
      'source = { editable = "." }',
      "",
    ].join("\n");
    expect(parseUvLock(lock, "uv.lock").map((d) => d.name)).toEqual(["pyyaml"]);
  });

  test("the REAL uv.lock yields resolved versions", () => {
    const text = readFileSync(resolve(ROOT, "src/Core.Python/uv.lock"), "utf8");
    const got = parseUvLock(text, "src/Core.Python/uv.lock");
    expect(got.length).toBeGreaterThan(10);
    expect(got.every((d) => d.ecosystem === "pypi")).toBe(true);
  });
});

describe("collectPinned", () => {
  // AN UNREADABLE REQUIRED MANIFEST IS NOT AN EMPTY ONE. If this ever regressed to "return no
  // rows", `Directory.Packages.props` going missing would read as "no NuGet dependencies".
  test("a missing REQUIRED manifest is an unreadable source, never zero rows", () => {
    const inv = collectPinned("/nonexistent-root-for-this-test", manifestRoster([], []));
    expect(inv.deps).toEqual([]);
    expect(inv.unreadable.length).toBe(4);
    expect(inv.unreadable.map((u) => u.path).sort()).toEqual([
      ".mise.toml",
      "Directory.Packages.props",
      "package.json",
      "src/Core.Go/go.mod",
    ]);
  });

  test("a missing OPTIONAL manifest is silent -- most crates declare no registry dependency", () => {
    const inv = collectPinned("/nonexistent-root-for-this-test", manifestRoster(["src/Nope/Cargo.toml"], []));
    expect(inv.unreadable.some((u) => u.path === "src/Nope/Cargo.toml")).toBe(false);
  });

  test("the REAL tree produces pins across more than one ecosystem", () => {
    const inv = collectPinned(ROOT, manifestRoster([], []));
    expect(inv.unreadable).toEqual([]);
    expect(new Set(inv.deps.map((d) => d.ecosystem)).size).toBeGreaterThanOrEqual(4);
  });
});

describe("XML comment stripping reaches a FIXPOINT, not one pass", () => {
  // CodeQL js/incomplete-multi-character-sanitization on the single-pass form.
  //
  // THE FIRST THREE CASES I WROTE FOR THIS WERE VACUOUS -- they passed with the single-pass
  // form too, because stripping `<!--<!-- x -->-->` in one pass leaves only a harmless `-->`.
  // Mutation found that; nothing else would have. The case below is the one that actually
  // discriminates, and it is the dangerous direction: a pin that IS commented out gets
  // REPORTED AS LIVE, so `ace outdated` would claim a dependency the build does not have.
  test("removing one comment must not EXPOSE a pin by creating a new one", () => {
    // One pass strips the inner `<!-- -->`, and the surviving `<!` + `--` fuse into a fresh
    // `<!--` ... `-->` wrapper that a second pass removes. Single pass reports Hidden; the
    // fixpoint does not.
    const xml = [
      "<Project><ItemGroup>",
      '<!<!-- -->-- <PackageVersion Include="Commented.Out" Version="9.9.9" /> -->',
      "</ItemGroup></Project>",
    ].join("\n");
    const got = parseNuGetCentralVersions(xml, "p");
    expect(got.map((d) => d.name)).not.toContain("Commented.Out");
    expect(got).toEqual([]);
  });

  test("an ordinary single comment still strips, and a real pin still parses", () => {
    const xml = [
      "<Project><ItemGroup>",
      '<!-- <PackageVersion Include="Nope" Version="0.0.1" /> -->',
      '<PackageVersion Include="Yes.Please" Version="4.5.6" />',
      "</ItemGroup></Project>",
    ].join("\n");
    const got = parseNuGetCentralVersions(xml, "p");
    expect(got.map((d) => d.name)).toEqual(["Yes.Please"]);
  });
});
