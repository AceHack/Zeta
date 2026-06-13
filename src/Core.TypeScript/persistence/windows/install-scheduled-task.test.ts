import { test, expect } from "bun:test";
import { xmlEscape, substitutePlaceholders, toUtf16WithBom, parseArgs, defaultCloneDir } from "./install-scheduled-task";
import { readFileSync } from "node:fs";
import { join } from "node:path";

test("xmlEscape escapes the five XML entities", () => {
  expect(xmlEscape(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
});

test("substitutePlaceholders fills all keys and XML-escapes values", () => {
  const tpl = "<U>{{USER_ID}}</U><W>{{WRAPPER_PATH}}</W>";
  const out = substitutePlaceholders(tpl, {
    USER_ID: "S-1-5-21",
    WRAPPER_PATH: "C:\\w & x.ps1",
    TASK_NAME: "T",
    PWSH_PATH: "p",
    CONHOST_PATH: "c",
    REPO_ROOT: "r",
  });
  expect(out).toBe("<U>S-1-5-21</U><W>C:\\w &amp; x.ps1</W>");
});

test("substitutePlaceholders throws on an unknown leftover placeholder", () => {
  expect(() =>
    substitutePlaceholders("{{NOT_A_KEY}}", { USER_ID: "", WRAPPER_PATH: "", TASK_NAME: "", PWSH_PATH: "", CONHOST_PATH: "", REPO_ROOT: "" }),
  ).toThrow(/NOT_A_KEY/);
});

test("toUtf16WithBom prefixes the LE BOM and encodes UTF-16LE", () => {
  // BOM 0xFF 0xFE, then 'A'=0x41 0x00, 'B'=0x42 0x00
  expect([...toUtf16WithBom("AB")]).toEqual([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
});

test("parseArgs defaults: heartbeat-first, ref=main, no register/dry-run", () => {
  const a = parseArgs([]);
  expect(a.taskName).toBe("ZetaOttoLoop");
  expect(a.ref).toBe("main");
  expect(a.runClaude).toBe(false);
  expect(a.register).toBe(false);
  expect(a.dryRun).toBe(false);
});

test("parseArgs reads flags incl. --ref and --run-claude", () => {
  const a = parseArgs(["--task-name", "Foo", "--ref", "feat/x", "--run-claude", "--model", "opus", "--dry-run", "--register"]);
  expect(a.taskName).toBe("Foo");
  expect(a.ref).toBe("feat/x");
  expect(a.runClaude).toBe(true);
  expect(a.model).toBe("opus");
  expect(a.dryRun).toBe(true);
  expect(a.register).toBe(true);
});

test("parseArgs throws on a missing flag value", () => {
  expect(() => parseArgs(["--ref"])).toThrow(/Missing value for --ref/);
});

test("parseArgs throws on an unknown flag", () => {
  expect(() => parseArgs(["--nope"])).toThrow(/Unknown argument/);
});

test("defaultCloneDir lands under a zeta-otto-loop\\Zeta path", () => {
  expect(defaultCloneDir().replace(/\\/g, "/")).toMatch(/zeta-otto-loop\/Zeta$/);
});

test("scheduled-task.xml: every placeholder substitutes, no leftovers, conhost shape preserved", () => {
  const xml = readFileSync(join(import.meta.dir, "scheduled-task.xml"), "utf8");
  const out = substitutePlaceholders(xml, {
    TASK_NAME: "T",
    USER_ID: "S-1-5-21",
    CONHOST_PATH: "conhost.exe",
    PWSH_PATH: "pwsh.exe",
    WRAPPER_PATH: "wrap.ps1",
    REPO_ROOT: "repo",
  });
  expect(out).not.toMatch(/\{\{[A-Z_]+\}\}/); // no leftover placeholders
  expect(out).toContain("--headless");        // windowless launch shape preserved
  expect(out).toContain("conhost.exe");       // conhost launcher present
});
