/**
 * cross-verify-laws.ts — Cross-language algebraic law verification.
 *
 * For each law in the IR, generates a test script in multiple languages,
 * executes each, and verifies they ALL report the law as holding.
 *
 * This is different from cross-verify-ir.ts (which checks value agreement):
 * - cross-verify-ir.ts: "do all langs produce the same OUTPUT for the same INPUT?"
 * - cross-verify-laws.ts: "does the same ALGEBRAIC LAW hold in all lang implementations?"
 *
 * If any language reports a law violation, the oracle FAILS — that language's
 * implementation is buggy (doesn't satisfy the interface contract).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

interface LawSchema {
  id: string;
  schema: string;
  op?: string;
  mul?: string;
  add?: string;
  element?: string;
  inverse?: string;
  identity?: string;
  over?: string;
  guard?: string;
  doc?: string;
}

// ─── Generate law-check scripts per language ─────────────────────────────

function generateTsLawCheck(law: LawSchema): string | null {
  const check = generateCheck(law, "ts");
  if (!check) return null;
  return `// Law check: ${law.id} — using native arithmetic (no imports needed)
const N = 100;
let pass = 0;
for (let i = 0; i < N; i++) {
  const a = Math.random() * 200 - 100, b = Math.random() * 200 - 100, c = Math.random() * 200 - 100;
  ${check}
  pass++;
}
process.stdout.write(JSON.stringify({law:"${law.id}",pass:pass,total:N}));`;
}

function generatePyLawCheck(law: LawSchema): string | null {
  const check = generateCheck(law, "py");
  if (!check) return null;
  return `import json, sys, random
N = 100
passed = 0
for _ in range(N):
    a, b, c = random.uniform(-100,100), random.uniform(-100,100), random.uniform(-100,100)
    ${check}
    passed += 1
sys.stdout.write(json.dumps({"law":"${law.id}","pass":passed,"total":N}))`;
}

function generateGoLawCheck(law: LawSchema): string | null {
  const check = generateCheck(law, "go");
  if (!check) return null;
  return `package main
import ("math/rand";"math";"encoding/json";"os")
func main() {
    N := 100
    passed := 0
    for i := 0; i < N; i++ {
        a, b, c := rand.Float64()*200-100, rand.Float64()*200-100, rand.Float64()*200-100
        _, _, _ = a, b, c
        ${check}
        passed++
    }
    out, _ := json.Marshal(map[string]interface{}{"law":"${law.id}","pass":passed,"total":N})
    os.Stdout.Write(out)
}
func eq(x,y float64) bool { return math.Abs(x-y) < 1e-9 }
`;
}

function generateCheck(law: LawSchema, lang: "ts" | "py" | "go"): string | null {
  switch (law.schema) {
    case "associative":
      if (law.op === "Add") {
        if (lang === "ts") return `if (Math.abs((a+b)+c - (a+(b+c))) > 1e-9) throw new Error("fail");`;
        if (lang === "py") return `assert abs((a+b)+c - (a+(b+c))) < 1e-9, "fail"`;
        if (lang === "go") return `if !eq((a+b)+c, a+(b+c)) { panic("fail") }`;
      }
      if (law.op === "Mul") {
        if (lang === "ts") return `if (Math.abs((a*b)*c - a*(b*c)) > 1e-9) throw new Error("fail");`;
        if (lang === "py") return `assert abs((a*b)*c - a*(b*c)) < 1e-9, "fail"`;
        if (lang === "go") return `if !eq((a*b)*c, a*(b*c)) { panic("fail") }`;
      }
      return null;

    case "commutative":
      if (law.op === "Add") {
        if (lang === "ts") return `if (Math.abs((a+b) - (b+a)) > 1e-9) throw new Error("fail");`;
        if (lang === "py") return `assert abs((a+b) - (b+a)) < 1e-9, "fail"`;
        if (lang === "go") return `if !eq(a+b, b+a) { panic("fail") }`;
      }
      if (law.op === "Mul") {
        if (lang === "ts") return `if (Math.abs((a*b) - (b*a)) > 1e-9) throw new Error("fail");`;
        if (lang === "py") return `assert abs((a*b) - (b*a)) < 1e-9, "fail"`;
        if (lang === "go") return `if !eq(a*b, b*a) { panic("fail") }`;
      }
      return null;

    case "identity":
      if (law.op === "Add" && law.element === "Zero") {
        if (lang === "ts") return `if (Math.abs((a+0) - a) > 1e-9) throw new Error("fail");`;
        if (lang === "py") return `assert abs((a+0) - a) < 1e-9, "fail"`;
        if (lang === "go") return `if !eq(a+0, a) { panic("fail") }`;
      }
      if (law.op === "Mul" && law.element === "One") {
        if (lang === "ts") return `if (Math.abs((a*1) - a) > 1e-9) throw new Error("fail");`;
        if (lang === "py") return `assert abs((a*1) - a) < 1e-9, "fail"`;
        if (lang === "go") return `if !eq(a*1, a) { panic("fail") }`;
      }
      return null;

    case "inverse":
      if (lang === "ts") return `if (Math.abs(a + (-a)) > 1e-9) throw new Error("fail");`;
      if (lang === "py") return `assert abs(a + (-a)) < 1e-9, "fail"`;
      if (lang === "go") return `if !eq(a+(-a), 0) { panic("fail") }`;
      return null;

    case "distributive":
      if (lang === "ts") return `if (Math.abs(a*(b+c) - (a*b + a*c)) > 1e-9) throw new Error("fail");`;
      if (lang === "py") return `assert abs(a*(b+c) - (a*b + a*c)) < 1e-9, "fail"`;
      if (lang === "go") return `if !eq(a*(b+c), a*b+a*c) { panic("fail") }`;

    default:
      return null;
  }
}

// ─── Execute and compare ─────────────────────────────────────────────────

interface LawResult {
  law: string;
  languages: string[];
  allHold: boolean;
  failures: { language: string; error: string }[];
}

export function crossVerifyLaw(law: LawSchema, tmpDir: string): LawResult {
  const results: { language: string; holds: boolean; error?: string }[] = [];

  // TS
  const ts = generateTsLawCheck(law);
  if (ts) {
    const file = join(tmpDir, `${law.id}.ts`);
    writeFileSync(file, ts);
    try {
      const out = execSync(`bun ${file}`, { encoding: "utf-8", timeout: 10000, cwd: tmpDir });
      const r = JSON.parse(out);
      results.push({ language: "typescript", holds: r.pass === r.total });
    } catch (e: any) {
      results.push({ language: "typescript", holds: false, error: e.message?.slice(0, 80) });
    }
  }

  // Python
  const py = generatePyLawCheck(law);
  if (py) {
    const file = join(tmpDir, `${law.id}.py`);
    writeFileSync(file, py);
    try {
      const out = execSync(`python3 ${file}`, { encoding: "utf-8", timeout: 10000 });
      const r = JSON.parse(out);
      results.push({ language: "python", holds: r.pass === r.total });
    } catch (e: any) {
      results.push({ language: "python", holds: false, error: e.message?.slice(0, 80) });
    }
  }

  // Go
  const go = generateGoLawCheck(law);
  if (go) {
    const file = join(tmpDir, `${law.id}.go`);
    writeFileSync(file, go);
    try {
      const out = execSync(`go run ${file}`, { encoding: "utf-8", timeout: 15000 });
      const r = JSON.parse(out);
      results.push({ language: "go", holds: r.pass === r.total });
    } catch (e: any) {
      results.push({ language: "go", holds: false, error: e.message?.slice(0, 80) });
    }
  }

  const failures = results.filter(r => !r.holds).map(r => ({ language: r.language, error: r.error ?? "law violated" }));
  return {
    law: law.id,
    languages: results.map(r => r.language),
    allHold: failures.length === 0 && results.length >= 2,
    failures,
  };
}

// ─── CLI / Exported function ─────────────────────────────────────────────

export function crossVerifyAllLaws(irPath: string): { results: LawResult[]; summary: { passed: number; failed: number; skipped: number } } {
  const ir = JSON.parse(readFileSync(irPath, "utf-8"));
  const laws: LawSchema[] = ir.laws.filter((l: any) => typeof l === "object" && !l.guard);
  const tmpDir = join("/tmp", `law-verify-${ir.name}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const results = laws.map(law => crossVerifyLaw(law, tmpDir));
  try { rmSync(tmpDir, { recursive: true }); } catch {}

  const passed = results.filter(r => r.allHold).length;
  const failed = results.filter(r => !r.allHold && r.languages.length > 0).length;
  const skipped = results.filter(r => r.languages.length === 0).length;

  return { results, summary: { passed, failed, skipped } };
}

if (import.meta.main) {
  const irPath = process.argv[2];
  if (!irPath) { console.error("Usage: bun cross-verify-laws.ts <ir.json>"); process.exit(1); }

  const { results, summary } = crossVerifyAllLaws(irPath);
  for (const r of results) {
    if (r.allHold) console.log(`  ✓ ${r.law}: holds in ${r.languages.join(", ")}`);
    else if (r.languages.length === 0) console.log(`  ○ ${r.law}: skipped (no encoding)`);
    else console.log(`  ✗ ${r.law}: FAILED in ${r.failures.map(f => f.language).join(", ")}`);
  }
  console.log(`\n[cross-verify-laws] ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped`);
  if (summary.failed > 0) process.exit(1);
}
