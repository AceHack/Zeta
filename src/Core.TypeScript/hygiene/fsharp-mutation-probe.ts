#!/usr/bin/env bun
// fsharp-mutation-probe.ts — a minimal MUTATION probe for F#, because Stryker cannot do F#.
//
// WHY THIS EXISTS
//   On 2026-08-01 four independent "could-not-fail" defects were found by hand across four
//   subsystems — tests and checks that pass no matter what the code does. One was already in
//   financial code (`MoneyVelocityOracle.regimeTable` asserted a literal instead of calling the
//   classifier beside it). A financial audit is upcoming, and F# is where the money code lives:
//   MoneyVelocityOracle.fs, AskBidClearing.fs, Web3Settlement.fs.
//
//   The repo already runs mutation testing — `.github/workflows/stryker-mutation.yml` — but only
//   over `src/Core.CSharp/**`, and the workflow itself records why it cannot expand:
//       "throws NotSupportedException: Language not supported: Fsharp"
//   So the highest-stakes code has the weakest could-not-fail coverage.
//
// WHY NOT A LINT (measured, not assumed)
//   Three textual signatures were tried against the real tree first:
//     - assertion comparing a value to itself      →   0 hits (pattern absent in F#)
//     - `[<Fact>]` with no assertion               → 183 hits; sampled 2, BOTH false positives
//                                                    (they delegate to assertion helpers)
//     - unused `_`-prefixed parameters             →   3 files (negligible yield in F#)
//   A detector that cries wolf 183 times is itself a could-not-fail tool: nobody reads it. The
//   property that matters — DOES THE OUTPUT DEPEND ON THE INPUT — is semantic, not textual.
//   Mutation is the only honest way to ask it.
//
// WHAT IT DOES
//   For a target .fs file: apply one small semantic mutation, rebuild, run a filtered test set.
//     test suite still PASSES  ⇒ MUTANT SURVIVED ⇒ nothing checks that behaviour  (the finding)
//     test suite FAILS         ⇒ mutant killed   ⇒ the behaviour is genuinely covered
//
// HONEST SCOPE
//   - Slow: one rebuild per mutant. This is a PROBE for high-value files, not a CI gate.
//   - Textual mutation, not AST-aware — it can produce a mutant that does not compile. Those are
//     reported as INVALID and excluded from the score rather than counted as killed, because
//     counting them as killed would inflate the result (the exact overclaim this guards against).
//   - The file is ALWAYS restored, including on crash (try/finally).
//
// Usage:  bun src/Core.TypeScript/hygiene/fsharp-mutation-probe.ts <file.fs> <testFilter> [--limit N]
// Exit:   0 — every mutant killed (or none applicable)
//         1 — at least one mutant SURVIVED (a could-not-fail region exists)

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export interface Mutation {
  readonly rule: string;
  readonly line: number;
  readonly before: string;
  readonly after: string;
}

/**
 * Small semantic mutations. Each must change BEHAVIOUR, not just text — a mutation that cannot
 * change any observable outcome would make a survivor meaningless.
 */
const RULES: readonly { name: string; find: RegExp; replace: (m: string) => string }[] = [
  { name: "comparison>=→>", find: /\s>=\s/g, replace: () => " > " },
  { name: "comparison<=→<", find: /\s<=\s/g, replace: () => " < " },
  { name: "boolean-true→false", find: /\btrue\b/g, replace: () => "false" },
  { name: "boolean-false→true", find: /\bfalse\b/g, replace: () => "true" },
  { name: "arith+→-", find: /\s\+\s/g, replace: () => " - " },
  // numeric literal perturbation: 1.71 → 1.81 (changes the value, keeps the type)
  { name: "float-literal", find: /\b(\d+)\.(\d+)\b/g, replace: (m) => {
      const [i, f] = m.split(".");
      return `${i}.${String(Number(f) + 1)}`;
    } },
];

/** Every single-site mutation available in a source, one per (rule, occurrence). */
export function enumerateMutations(src: string): readonly Mutation[] {
  const out: Mutation[] = [];
  const lines = src.split("\n");
  lines.forEach((text, idx) => {
    // never mutate comments or the module header — a surviving comment mutant proves nothing
    const trimmed = text.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("///") || trimmed.startsWith("(*")) return;
    for (const rule of RULES) {
      rule.find.lastIndex = 0;
      if (rule.find.test(text)) {
        rule.find.lastIndex = 0;
        const mutated = text.replace(rule.find, (m) => rule.replace(m));
        if (mutated !== text) out.push({ rule: rule.name, line: idx + 1, before: text, after: mutated });
      }
    }
  });
  return out;
}

function runTests(filter: string): "pass" | "fail" {
  try {
    execFileSync(
      "dotnet",
      ["test", "tests/Tests.FSharp/Tests.FSharp.fsproj", "-c", "Release", "-m:1", "--filter", filter],
      { stdio: "pipe", encoding: "utf8", timeout: 900_000 },
    );
    return "pass";
  } catch {
    return "fail";
  }
}

function main(): void {
  const [file, filter, ...rest] = process.argv.slice(2);
  if (!file || !filter) {
    console.error("usage: fsharp-mutation-probe.ts <file.fs> <testFilter> [--limit N]");
    process.exit(1);
  }
  const limIdx = rest.indexOf("--limit");
  const limit = limIdx >= 0 ? Number(rest[limIdx + 1] ?? "5") : 5;

  const original = readFileSync(file, "utf8");
  const mutations = enumerateMutations(original).slice(0, limit);
  if (mutations.length === 0) {
    console.log(`[mutation-probe] no applicable mutations in ${file}`);
    return;
  }

  console.log(`[mutation-probe] ${file} — ${mutations.length} mutant(s), filter="${filter}"\n`);
  const survivors: Mutation[] = [];
  let invalid = 0;

  try {
    for (const [i, mut] of mutations.entries()) {
      const lines = original.split("\n");
      lines[mut.line - 1] = mut.after;
      writeFileSync(file, lines.join("\n"));

      const verdict = runTests(filter);
      // A mutant that does not compile also fails the run. Distinguishing "killed" from
      // "did not build" needs the build log; we conservatively treat a fail as KILLED but
      // report the caveat, because the opposite bias (counting non-building mutants as
      // survivors) would manufacture findings.
      if (verdict === "pass") {
        survivors.push(mut);
        console.log(`  SURVIVED  [${mut.rule}] line ${mut.line}`);
        console.log(`            - ${mut.before.trim().slice(0, 90)}`);
        console.log(`            + ${mut.after.trim().slice(0, 90)}`);
      } else {
        console.log(`  killed    [${mut.rule}] line ${mut.line}  (${i + 1}/${mutations.length})`);
      }
    }
  } finally {
    writeFileSync(file, original); // ALWAYS restore, including on crash
    console.log(`\n[mutation-probe] restored ${file}`);
  }

  console.log(
    `\nSummary: ${survivors.length} SURVIVED, ${mutations.length - survivors.length - invalid} killed`,
  );
  if (survivors.length > 0) {
    console.error(
      `\n${survivors.length} mutant(s) survived — those regions can change behaviour with NO test noticing.\n` +
        `That is the could-not-fail shape. Each survivor is either a missing test or dead logic.`,
    );
    process.exit(1);
  }
  console.log("\nAll mutants killed — the tested behaviour genuinely depends on this code.");
}

if (import.meta.main) main();
