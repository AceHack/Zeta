/**
 * bonsai-discipline-probe.ts — the check that keeps the discipline labels honest.
 *
 * `bonsai-discipline.ts` claims that `BonsaiSoft.evalSoft` is **predicated** and
 * that `Resume.run` / `resume.ts start` are **short-circuit**. A table of claims is
 * a comment unless something executes it, so this script does:
 *
 *   1. Runs the discriminating probe — `Cond(true, 1, Param "nope")` — through ALL
 *      THREE evaluators. TypeScript in-process; the two F# evaluators through the
 *      real built `Zeta.Core.dll` via `dotnet fsi`, not a transcription of them.
 *   2. Reads each outcome back to the discipline it DEMONSTRATES, and FAILS if that
 *      disagrees with the registration. An evaluator whose `Cond` handling changes
 *      breaks this, by name, instead of silently invalidating the table.
 *   3. Demonstrates the guard on the substitution that was silent before it
 *      existed: a short-circuit-authored, discipline-sensitive program aimed at the
 *      predicated evaluator is REFUSED.
 *   4. Demonstrates the guard does NOT fire where it would be noise: a program
 *      whose meaning does not depend on the discipline passes either way.
 *
 * Not a `bun test` file: it needs the .NET SDK and a built `src/Core`. The pure
 * halves — sensitivity analysis, the verdict, refusal — are unit-tested in
 * `bonsai-discipline.test.ts` and run in CI.
 *
 *   bun tests/cross-verification/_harness/bonsai-discipline-probe.ts
 *
 * Exit 0 only if every registration was reproduced and both guard demonstrations
 * behaved as claimed.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { serialize } from "../../../src/Core.TypeScript/bonsai/index";
import { start } from "../../../src/Core.TypeScript/bonsai/resume";
import {
  EVALUATORS,
  type ProbeOutcome,
  checkHandoff,
  disciplineOfProbeOutcome,
  disciplineProbe,
  disciplineSensitivity,
  evaluatorNamed,
  handoffVerdict,
} from "./bonsai-discipline";

const REPO = resolve(import.meta.dir, "../../..");
const CORE_DLL = join(REPO, "src/Core/bin/Release/net10.0/Zeta.Core.dll");

/** Run the probe through the TypeScript saga interpreter, in-process. */
function probeTypeScript(): ProbeOutcome {
  const r = start(disciplineProbe(), {});
  if (!r.ok) return { kind: "error", message: JSON.stringify(r.error) };
  if (r.value.kind !== "done") return { kind: "value", value: `<${r.value.kind}>` };
  const v = r.value.value;
  return { kind: "value", value: v.t === "int" ? String(v.v) : `<${v.t}>` };
}

/**
 * Run the probe through the two F# evaluators, against the REAL built assembly.
 *
 * The script is generated here rather than committed so it cannot drift from the
 * probe expression above — one definition, two languages reading it.
 */
function probeFSharp(): Map<string, ProbeOutcome> {
  if (!existsSync(CORE_DLL)) {
    console.log(`building src/Core (no ${CORE_DLL})…`);
    execFileSync("dotnet", ["build", join(REPO, "src/Core/Core.fsproj"), "-c", "Release"], { stdio: "pipe" });
  }
  const dir = mkdtempSync(join(tmpdir(), "bonsai-discipline-probe-"));
  try {
    const fsx = join(dir, "probe.fsx");
    writeFileSync(
      fsx,
      `#I "${join(REPO, "src/Core/bin/Release/net10.0")}"
#r "Zeta.Core.Abstractions.dll"
#r "Zeta.Core.dll"
open Zeta.Core
// Cond(true, 1, Param "nope") — the same expression \`disciplineProbe()\` builds.
let probe = Bonsai.Cond(Bonsai.Const(Bonsai.CBool true), Bonsai.Const(Bonsai.CInt 1L), Bonsai.Param "nope")
let esc (s: string) = s.Replace("\\\\", "\\\\\\\\").Replace("\\t", " ").Replace("\\n", " ")
let emit name kind payload = printfn "PROBE\\t%s\\t%s\\t%s" name kind (esc payload)
match BonsaiSoft.snap 0.5 Map.empty probe with
| Ok (Some dv) -> emit "BonsaiSoft.evalSoft" "value" (sprintf "%A" dv)
| Ok None -> emit "BonsaiSoft.evalSoft" "value" "<held>"
| Error e -> emit "BonsaiSoft.evalSoft" "error" e
match Resume.start probe Map.empty with
| Ok (Resume.SagaStep.Done (Bonsai.CInt i)) -> emit "Resume.run" "value" (string i)
| Ok (Resume.SagaStep.Done other) -> emit "Resume.run" "value" (sprintf "%A" other)
| Ok (Resume.SagaStep.Suspended _) -> emit "Resume.run" "value" "<suspended>"
| Error e -> emit "Resume.run" "error" (sprintf "%A" e)
`,
    );
    const r = spawnSync("dotnet", ["fsi", fsx], { encoding: "utf-8" });
    const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const out = new Map<string, ProbeOutcome>();
    for (const line of text.split("\n")) {
      const parts = line.split("\t");
      if (parts[0] !== "PROBE") continue;
      const [, name, kind, payload] = parts;
      if (name === undefined || payload === undefined) continue;
      out.set(name, kind === "error" ? { kind: "error", message: payload } : { kind: "value", value: payload });
    }
    if (out.size === 0) {
      // A probe that produced no observations is a check that did not run, and
      // reporting it as agreement is the exact failure this file guards against.
      throw new Error(`bonsai-discipline-probe: dotnet fsi produced NO probe lines. Output was:\n${text.slice(0, 1200)}`);
    }
    return out;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main(): number {
  const failures: string[] = [];

  const wire = serialize(disciplineProbe());
  console.log(`probe (one expression, serialized once):\n  ${wire.ok ? wire.value : "SERIALIZE FAILED"}\n`);

  // ── 1 + 2: every registration reproduced by execution ──────────────────────
  const observed = probeFSharp();
  observed.set("resume.ts start", probeTypeScript());

  console.log("observed — the label is CHECKED, not trusted:");
  for (const reg of EVALUATORS) {
    const o = observed.get(reg.name);
    if (o === undefined) {
      failures.push(`evaluator "${reg.name}" produced no probe observation at all`);
      continue;
    }
    let demonstrated: string;
    try {
      demonstrated = disciplineOfProbeOutcome(o);
    } catch (e) {
      failures.push(`evaluator "${reg.name}": ${String(e)}`);
      continue;
    }
    const shown = o.kind === "value" ? `value ${o.value}` : `error ${o.message}`;
    const agree = demonstrated === reg.discipline;
    console.log(`  ${reg.name.padEnd(22)} ${shown.padEnd(46)} demonstrates ${demonstrated.padEnd(14)} registered ${reg.discipline.padEnd(14)} ${agree ? "OK" : "MISMATCH"}`);
    if (!agree) {
      failures.push(
        `evaluator "${reg.name}" is REGISTERED \`${reg.discipline}\` but DEMONSTRATES \`${demonstrated}\` — ` +
          `the registration in bonsai-discipline.ts is now false and must be corrected, not the evaluator`,
      );
    }
  }

  // ── 3: the substitution that used to be silent is now refused ──────────────
  console.log("\nguard — the substitution that was silent before this existed:");
  const sensitive = {
    expr: disciplineProbe(),
    discipline: "short-circuit" as const,
    origin: "a saga authored against resume.ts",
  };
  const s = disciplineSensitivity(sensitive.expr);
  console.log(`  discipline-sensitive: ${String(s.sensitive)} (${s.reasons.map((r) => `${r.path} ${r.cause}`).join(", ")})`);
  let refused = false;
  try {
    checkHandoff(sensitive, evaluatorNamed("BonsaiSoft.evalSoft"));
  } catch (e) {
    refused = true;
    console.log(`  REFUSED: ${String(e).slice(0, 200)}…`);
  }
  if (!refused) failures.push("a short-circuit-authored, discipline-sensitive program was ACCEPTED by the predicated evaluator — the guard did not fire");

  // …and the same program through its own discipline is fine.
  const own = handoffVerdict(sensitive, evaluatorNamed("resume.ts start"));
  console.log(`  same program → resume.ts start: ok=${String(own.ok)} (${own.why})`);
  if (!own.ok) failures.push("a program was refused by an evaluator of its OWN discipline");

  // ── 4: the guard is quiet where it would be noise ──────────────────────────
  const insensitive = {
    expr: { kind: "cond", test: { kind: "const", value: { t: "bool", v: true } }, then: { kind: "const", value: { t: "int", v: 1 } }, else: { kind: "const", value: { t: "int", v: 2 } } },
    discipline: "short-circuit" as const,
    origin: "a closed, total Cond",
  } as const;
  const quiet = handoffVerdict(insensitive, evaluatorNamed("BonsaiSoft.evalSoft"));
  console.log(`  a closed/total Cond → predicated evaluator: ok=${String(quiet.ok)} (${quiet.why})`);
  if (!quiet.ok) failures.push("the guard fired on a program whose meaning does NOT depend on the discipline — that is noise, and noise is how a guard gets turned off");

  for (const f of failures) console.error(`\nFAIL: ${f}`);
  return failures.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main());
}
