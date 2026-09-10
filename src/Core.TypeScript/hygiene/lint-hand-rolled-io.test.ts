// src/Core.TypeScript/hygiene/lint-hand-rolled-io.test.ts
//
// FALSIFIERS FOR lint-hand-rolled-io.ts.
//
// The first four tests are the ones that matter, and they are the ones this
// repository has watched linters fail:
//
//   * a guard satisfied BY ITS OWN COMMENT. This lint's header names
//     `execSync` and `spawnSync("/bin/sh", ["-c"` in prose, repeatedly. If
//     comments were not masked it would report its own documentation, be
//     disbelieved, and be deleted -- taking the explanations with it.
//   * a guard satisfied BY AN IMPORT LINE. `import { execSync }` carries the
//     identifier and is not a call.
//   * a guard reporting on a STRING LITERAL. Two of this lint's first-run
//     findings were of exactly this shape and both are pinned below.
//   * a rule that CANNOT FIRE. `unbounded-fetch-to-disk` finds nothing on
//     `main` today, so a fixture is the only thing standing between it and
//     being a rule that exists and constrains nothing.
//
// Every fixture below is a string handed to `analyzeSource`, which is pure, so
// none of this touches the filesystem.

import { describe, expect, test } from "bun:test";
import {
  analyzeSource,
  baselineKey,
  callArguments,
  EXEMPT_SUFFIXES,
  isScannable,
  maskComments,
  newFindings,
  parseArgs,
  REPLACEMENTS,
  stripStringLiterals,
  suppressions,
  tally,
  type Finding,
} from "./lint-hand-rolled-io.ts";

const F = "fixture.ts";
const rules = (fs: readonly Finding[]): string[] => fs.map((f) => f.rule);

// ═══════════════════════════════════════════════════════════════════════════
// THE ANTI-VACUITY QUARTET
// ═══════════════════════════════════════════════════════════════════════════

describe("the guard is not satisfied by its own documentation", () => {
  test("a line comment naming execSync is NOT a finding", () => {
    expect(analyzeSource(`// never use execSync(cmd) here\nconst x = 1;\n`, F)).toEqual([]);
  });

  test("a block comment naming a shell spawn is NOT a finding", () => {
    expect(analyzeSource(`/*\n * spawnSync("/bin/sh", ["-c", cmd]) is the defect.\n */\nconst x = 1;\n`, F)).toEqual(
      [],
    );
  });

  test("a jsdoc naming shell: true is NOT a finding", () => {
    expect(analyzeSource(`/** never pass shell: true */\nconst x = 1;\n`, F)).toEqual([]);
  });

  test("...but the SAME text as code IS a finding — the control for all three above", () => {
    // Without this, the three tests above would pass identically if the
    // matcher were removed entirely.
    expect(rules(analyzeSource(`const out = execSync(cmd);\n`, F))).toEqual(["shell-string-spawn"]);
    expect(rules(analyzeSource(`spawnSync("/bin/sh", ["-c", cmd]);\n`, F))).toEqual(["shell-string-spawn"]);
    expect(rules(analyzeSource(`spawnSync("git", ["log"], { shell: true });\n`, F))).toEqual(["shell-string-spawn"]);
  });
});

describe("the guard matches the CALL, never the bare identifier", () => {
  test("an import of execSync is NOT a finding", () => {
    expect(analyzeSource(`import { execSync, execFileSync } from "node:child_process";\n`, F)).toEqual([]);
  });

  test("a type annotation naming execSync is NOT a finding", () => {
    expect(analyzeSource(`type Runner = typeof execSync;\nconst r: Runner = execSync;\n`, F)).toEqual([]);
  });

  test("...but the call IS — the control", () => {
    expect(
      rules(analyzeSource(`import { execSync } from "node:child_process";\nconst o = execSync("ls");\n`, F)),
    ).toEqual(["shell-string-spawn"]);
  });
});

describe("string literals are not code", () => {
  test('a path segment spelled like a body variable does not pair (the "data" false positive)', () => {
    const src = [
      `const res = await fetch(url);`,
      `const data = await res.json();`,
      `appendFileSync(join(cwd(), "data", "history.jsonl"), JSON.stringify(report));`,
    ].join("\n");
    expect(analyzeSource(src, F)).toEqual([]);
  });

  test("a fixture whose CONTENT calls fetch is not a fetch-to-disk site", () => {
    const src = `writeFileSync(p, \`fetch("docs/index.json");\`, "utf8");\n`;
    expect(analyzeSource(src, F)).toEqual([]);
  });

  test("...but the real pairing IS caught — the control for both", () => {
    const paired = [
      `const res = await fetch(url);`,
      `const data = await res.json();`,
      `writeFileSync(dest, data);`,
    ].join("\n");
    expect(rules(analyzeSource(paired, F))).toEqual(["unbounded-fetch-to-disk"]);
    expect(rules(analyzeSource(`writeFileSync(dest, await (await fetch(u)).text());\n`, F))).toEqual([
      "unbounded-fetch-to-disk",
    ]);
  });
});

describe("unbounded-fetch-to-disk can fire at all", () => {
  // MEASURED: this rule finds ZERO sites in src/Core.TypeScript on the day it
  // landed, because every real `js/http-to-file-access` alert in this tree is
  // INTERPROCEDURAL -- `writeCache(url, body)` in ace/registry-remote.ts is
  // called several frames below the fetch. A regex cannot follow that and this
  // one does not pretend to. So these fixtures are the only evidence the rule
  // is a rule; without them it is a name in a union type.
  for (const [name, src] of [
    ["writeFileSync", `const r = await fetch(u);\nconst b = await r.text();\nwriteFileSync(p, b);`],
    ["appendFileSync", `const r = await fetch(u);\nconst b = await r.text();\nappendFileSync(p, b);`],
    ["a piped stream", `const r = await fetch(u);\nawait r.body.pipeTo(createWriteStream(p));`],
    ["node's pipeline", `const r = await fetch(u);\nawait pipeline(r.body, createWriteStream(p));`],
    ["Bun.write", `const r = await fetch(u);\nconst b = await r.bytes();\nBun.write(p, b);`],
  ] as const) {
    test(`fires on ${name}`, () => {
      expect(rules(analyzeSource(src, F))).toEqual(["unbounded-fetch-to-disk"]);
    });
  }

  test("a LOCAL file read-modify-write is not a network flow", () => {
    // The `ci/perf-regression-ledger.ts` false positive: `.text()` on a
    // `Bun.file`, no network anywhere in it.
    const src = `await Bun.write(out, (await Bun.file(out).text()) + markdown);\n`;
    expect(analyzeSource(src, F)).toEqual([]);
  });

  test("a body bound far above a sink does not pair across a whole file", () => {
    const src = [
      `const r = await fetch(u);`,
      `const b = await r.text();`,
      ...Array(40).fill("// filler"),
      `writeFileSync(p, b);`,
    ].join("\n");
    expect(analyzeSource(src, F)).toEqual([]);
  });

  test("a pipe into a file stream that is NOT fed by a fetch does not fire", () => {
    expect(analyzeSource(`await localStream.pipeTo(createWriteStream(p));`, "fixture.ts")).toEqual([]);
  });

  test("a `.text()` on something that was never a fetch does not pair", () => {
    const src = [`const r = openReader(u);`, `const b = await r.text();`, `writeFileSync(p, b);`].join("\n");
    expect(analyzeSource(src, F)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SHELL DETECTION
// ═══════════════════════════════════════════════════════════════════════════

describe("shell-string-spawn", () => {
  for (const [name, src] of [
    ["/bin/sh -c", `spawnSync("/bin/sh", ["-c", wrapped], opts);`],
    ["/bin/bash -c", `spawnSync("/bin/bash", ["-c", wrapped], opts);`],
    ["bare sh -c", `spawn("sh", ["-c", cmd]);`],
    ["zsh -c", `spawnSync("/usr/bin/zsh", ["-c", cmd]);`],
    ["cmd /c", `spawnSync("cmd.exe", ["/c", cmd]);`],
    ["pwsh -Command", `spawnSync("pwsh", ["-Command", cmd]);`],
    ["a LOCAL WRAPPER, not named spawnSync", `return runSpawn("/bin/sh", ["-c", commandLine], options);`],
    ["execSync", `const s = execSync(\`git log \${range}\`, { encoding: "utf8" });`],
    ["shell true", `spawnSync(bin, args, { encoding: "utf8", shell: true });`],
  ] as const) {
    test(`fires on ${name}`, () => {
      expect(rules(analyzeSource(src, F))).toEqual(["shell-string-spawn"]);
    });
  }

  test("the wrapper case is why the match is on the SHAPE, not the callee name", () => {
    // A name-based matcher (`spawnSync\(`) would miss this, and a local
    // wrapper is precisely how the pattern hides from a grep.
    const findings = analyzeSource(`const r = myRunner("/bin/bash", ["-c", s]);`, F);
    expect(findings.length).toBe(1);
    expect(findings[0]?.signature).toBe("shell-argv-bash");
  });

  for (const [name, src] of [
    ["a shell running a FILE", `spawnSync("/bin/bash", ["./install.sh"]);`],
    ["an argv spawn of a real program", `spawnSync("git", ["log", "--oneline"]);`],
    ["execFileSync, which takes an argv", `execFileSync("git", ["status"]);`],
    ["shell: false", `spawnSync(bin, args, { shell: false });`],
  ] as const) {
    test(`does NOT fire on ${name}`, () => {
      expect(analyzeSource(src, F)).toEqual([]);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EVERY REFUSAL PRINTS THE REPLACEMENT
// ═══════════════════════════════════════════════════════════════════════════

describe("refusals name what to write instead", () => {
  test("both real rules carry a replacement that names the primitive", () => {
    for (const rule of ["shell-string-spawn", "unbounded-fetch-to-disk"] as const) {
      const fix = REPLACEMENTS.get(rule);
      expect(fix).toBeDefined();
      expect(fix).toContain("src/Core.TypeScript/io/safe-io.ts");
      expect((fix ?? "").length).toBeGreaterThan(80);
    }
  });

  test("the replacement travels on the finding, not only in the map", () => {
    const f = analyzeSource(`execSync("ls");`, F)[0];
    expect(f?.fix).toContain("spawnArgv");
    const g = analyzeSource(`writeFileSync(p, await (await fetch(u)).text());`, F)[0];
    expect(g?.fix).toContain("fetchToFile");
  });

  test("the shell replacement names the declared-shell escape, so the contract case has a route", () => {
    expect(REPLACEMENTS.get("shell-string-spawn")).toContain("spawnShellDeclared");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUPPRESSION
// ═══════════════════════════════════════════════════════════════════════════

describe("suppression", () => {
  test("a marker with a reason on the same line suppresses", () => {
    expect(analyzeSource(`execSync("ls"); // safe-io-ok: literal, no external input\n`, F)).toEqual([]);
  });

  test("a marker on the line above suppresses", () => {
    expect(analyzeSource(`// safe-io-ok: literal, no external input\nexecSync("ls");\n`, F)).toEqual([]);
  });

  test("a marker two lines above does NOT suppress", () => {
    expect(rules(analyzeSource(`// safe-io-ok: reason\n\nexecSync("ls");\n`, F))).toEqual(["shell-string-spawn"]);
  });

  test("an EMPTY reason is itself a finding — an unreasoned hatch is an allowlist", () => {
    const f = analyzeSource(`execSync("ls"); // safe-io-ok:\n`, F);
    expect(rules(f)).toEqual(["empty-suppression"]);
    expect(f[0]?.fix).toContain("reason");
  });

  test("suppressions() reads the ORIGINAL text, since the marker lives in a comment", () => {
    const text = `execSync("ls"); // safe-io-ok: because\n`;
    expect(suppressions(text).get(1)).toBe("because");
    // ...and the masked text has lost it, which is why the read is separate.
    expect(suppressions(maskComments(text)).size).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MASKING, ARGUMENT SLICING, STRING STRIPPING
// ═══════════════════════════════════════════════════════════════════════════

describe("maskComments", () => {
  test("preserves length and newlines so offsets still index the original", () => {
    const text = `const a = 1; // execSync(x)\nconst b = 2;\n`;
    const masked = maskComments(text);
    expect(masked.length).toBe(text.length);
    expect(masked.split("\n").length).toBe(text.split("\n").length);
    expect(masked).not.toContain("execSync");
  });

  test("a URL inside a string is not treated as a comment", () => {
    const text = `const u = "https://example.com/x"; const v = execSync("ls");`;
    expect(maskComments(text)).toContain("execSync");
  });

  test("string interiors survive — the shell path lives in one", () => {
    expect(maskComments(`spawnSync("/bin/sh", ["-c", x]);`)).toContain("/bin/sh");
  });
});

describe("callArguments", () => {
  test("slices to the matching close paren, counting nested brackets", () => {
    const t = `writeFileSync(p, JSON.stringify({ a: [1, 2] }), "utf8");`;
    expect(callArguments(t, t.indexOf("("))).toBe(`p, JSON.stringify({ a: [1, 2] }), "utf8"`);
  });

  test("is bounded, so a malformed file cannot make it walk the whole buffer", () => {
    const t = `f(${"x".repeat(5000)}`;
    expect(callArguments(t, 1).length).toBeLessThanOrEqual(400);
  });
});

describe("stripStringLiterals", () => {
  test("blanks interiors and preserves length", () => {
    const t = `f("data", 'x', \`y\`)`;
    const s = stripStringLiterals(t);
    expect(s.length).toBe(t.length);
    expect(s).not.toContain("data");
    expect(s).toContain("f(");
  });

  test("an escaped quote does not end the literal", () => {
    expect(stripStringLiterals(`"a\\"data"`)).not.toContain("data");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BASELINE
// ═══════════════════════════════════════════════════════════════════════════

describe("baseline", () => {
  const two = analyzeSource(`execSync("a");\nexecSync("b");\n`, F);

  test("two sites of the same shape in one file produce a count of two", () => {
    expect(two.length).toBe(2);
    expect(tally(two)[baselineKey(two[0] as Finding)]).toBe(2);
  });

  test("a baseline of two grandfathers both", () => {
    expect(newFindings(two, tally(two))).toEqual([]);
  });

  test("A THIRD SITE IN AN ALREADY-BASELINED FILE IS STILL A FINDING", () => {
    // This is what a SET-shaped baseline would have missed, and it is the
    // whole reason the baseline stores counts.
    const three = analyzeSource(`execSync("a");\nexecSync("b");\nexecSync("c");\n`, F);
    const fresh = newFindings(three, tally(two));
    expect(fresh.length).toBe(1);
    expect(fresh[0]?.line).toBe(3);
  });

  test("an empty baseline grandfathers nothing", () => {
    expect(newFindings(two, {}).length).toBe(2);
  });

  test("the key is line-free, so an edit ABOVE a baselined site does not thaw it", () => {
    const shifted = analyzeSource(`const x = 1;\nconst y = 2;\nexecSync("a");\nexecSync("b");\n`, F);
    expect(newFindings(shifted, tally(two))).toEqual([]);
  });

  test("meta rules are never baselined — a check that did not run cannot be grandfathered", () => {
    const unreadable: Finding = {
      rule: "unreadable",
      file: F,
      line: 1,
      signature: "unreadable",
      detail: "d",
      fix: "f",
    };
    expect(Object.keys(tally([unreadable])).length).toBe(0);
    expect(newFindings([unreadable], {}).length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SCOPE AND CLI
// ═══════════════════════════════════════════════════════════════════════════

describe("scope", () => {
  test("EXEMPT_SUFFIXES has exactly two entries — an exemption with room to grow is an allowlist", () => {
    expect(EXEMPT_SUFFIXES.length).toBe(2);
    expect(EXEMPT_SUFFIXES).toContain("src/Core.TypeScript/io/safe-io.ts");
  });

  test("the primitive itself is exempt; its neighbours are not", () => {
    expect(isScannable("src/Core.TypeScript/io/safe-io.ts")).toBe(false);
    expect(isScannable("src/Core.TypeScript/io/safe-io.test.ts")).toBe(true);
    expect(isScannable("src/Core.TypeScript/hygiene/lint-hand-rolled-io.test.ts")).toBe(false);
  });

  test("declaration files and non-TypeScript are out of scope", () => {
    expect(isScannable("x/types.d.ts")).toBe(false);
    expect(isScannable("x/readme.md")).toBe(false);
    expect(isScannable("x/a.ts")).toBe(true);
    expect(isScannable("x/a.mjs")).toBe(true);
  });
});

describe("parseArgs", () => {
  test("reads roots, floor, baseline and flags", () => {
    const o = parseArgs(["src", "tools", "--min-files", "1500", "--baseline", "b.json", "--json"]);
    expect(o.roots).toEqual(["src", "tools"]);
    expect(o.minFiles).toBe(1500);
    expect(o.baselinePath).toBe("b.json");
    expect(o.json).toBe(true);
    expect(o.writeBaseline).toBe(false);
  });

  test("with no root given it scans the working tree rather than nothing", () => {
    expect(parseArgs([]).roots).toEqual(["."]);
  });
});
