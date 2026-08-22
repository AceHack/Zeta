/**
 * bonsai-emit-lanes.ts — the EXECUTING falsifier for the Bonsai→Rust edge.
 *
 * `bonsai-emit.test.ts` asserts on emitted TEXT. Text assertions pass happily on
 * a program that does not compile — that is the exact defect `codegen-from-ir.test.ts`
 * corrected in itself on 2026-08-15 ("the test did not execute the generated
 * oracle"). So this script COMPILES and RUNS both arrest lanes and checks three
 * things that only execution can check:
 *
 *   1. Both lanes COMPILE (`cargo build`, raw exit code).
 *   2. Both lanes produce BYTE-IDENTICAL `rust-output.json`. Arresting higher
 *      must change how the program reads, never what it computes.
 *   3. Both lanes reproduce the committed splitmix64 vectors, vector by vector
 *      by name — diffed against `tests/cross-verification/splitmix64/rust-output.json`,
 *      the HAND-WRITTEN port (its `_source` differs by design and is excluded).
 *
 * It also reports the idiom measurement as TWO NUMBERS rather than a subset
 * verdict, because the subset verdict is provably vacuous here: the hand-written
 * control carries `clippy::format_push_string` itself, so `lints(gen) ⊆ lints(hand)`
 * silently excuses the very class the arrest removes (#10827 predicted this
 * weakness in the abstract; this lane is a measured instance of it).
 *
 * Not a `bun test` file because it needs a Rust toolchain. Run it directly:
 *
 *   bun tests/cross-verification/_harness/bonsai-emit-lanes.ts
 *   bun tests/cross-verification/_harness/bonsai-emit-lanes.ts --clippy
 *
 * Exit code is 0 only if every check passed. `--clippy` additionally runs
 * `cargo clippy -W pedantic -W nursery` on both lanes plus the hand-written
 * control and prints the three counts; the clippy step is reporting, not a gate,
 * because pinning a linter version's finding count would be a byte-lock against
 * a moving target.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseIrJson, type ZetaIrV1 } from "./codegen-from-ir";
import { TARGET_RUST_IDIOMATIC, TARGET_RUST_PORTABLE, arrest, emitRustAt, levelOf, outputAssemblyProgram } from "./bonsai-emit";

const HERE = import.meta.dir;

/** Write a one-binary cargo crate around `src` and return its dir. */
function crate(root: string, name: string, src: string): string {
  const dir = join(root, name);
  mkdirSync(join(dir, "src"), { recursive: true });
  writeFileSync(join(dir, "src", "main.rs"), src);
  writeFileSync(
    join(dir, "Cargo.toml"),
    `[package]\nname = "${name}"\nversion = "0.0.0"\nedition = "2021"\n\n[[bin]]\nname = "${name}"\npath = "src/main.rs"\n\n[workspace]\n`,
  );
  return dir;
}

/**
 * Build and run a crate. The emitted program writes `rust-output.json` to its
 * PARENT dir (the committed lanes' convention), so it runs from `<dir>/run`.
 */
function buildAndRun(lane: string, dir: string, failures: string[]): Record<string, string> | undefined {
  // Every step names the LANE on failure. A mutation to one renderer must produce
  // a message that says which lane broke, not an anonymous stack trace — that is
  // what makes this usable as a mutation check.
  mkdirSync(join(dir, "run"), { recursive: true });
  try {
    execFileSync("cargo", ["build", "--quiet", "--manifest-path", join(dir, "Cargo.toml")], { stdio: "pipe" });
  } catch (e) {
    failures.push(`lane "${lane}": emitted Rust DID NOT COMPILE — ${String((e as { stderr?: Buffer }).stderr ?? e).slice(0, 400)}`);
    return undefined;
  }
  try {
    execFileSync("cargo", ["run", "--quiet", "--manifest-path", join(dir, "Cargo.toml")], {
      cwd: join(dir, "run"),
      stdio: "pipe",
    });
  } catch (e) {
    failures.push(`lane "${lane}": emitted Rust compiled but FAILED AT RUN TIME — ${String(e).slice(0, 400)}`);
    return undefined;
  }
  const text = readFileSync(join(dir, "rust-output.json"), "utf-8");
  try {
    return JSON.parse(text) as Record<string, string>;
  } catch {
    failures.push(`lane "${lane}": the program ran but wrote output that is NOT VALID JSON (first 120 bytes: ${JSON.stringify(text.slice(0, 120))})`);
    return undefined;
  }
}

/** clippy findings and distinct lint classes for a crate. */
function clippy(dir: string): { findings: number; classes: string[] } {
  // Defeat the fingerprint cache: a silent cached "Finished" is a check that did
  // not run reported as one that passed.
  execFileSync("touch", [join(dir, "src", "main.rs")]);
  // clippy writes DIAGNOSTICS TO STDERR and exits 0 when they are only warnings.
  // Reading stdout therefore returns "" and reports a clean crate — the first
  // version of this function did exactly that and printed 0/0/0 for three crates
  // known to differ. spawnSync, and read stderr.
  const r = spawnSync(
    "cargo",
    ["clippy", "--quiet", "--manifest-path", join(dir, "Cargo.toml"), "--", "-W", "clippy::pedantic", "-W", "clippy::nursery"],
    { encoding: "utf-8" },
  );
  const diag = `${r.stderr ?? ""}${r.stdout ?? ""}`;
  const findings = (diag.match(/^warning:/gm) ?? []).length;
  const classes = [...new Set([...diag.matchAll(/index\.html#([a-z_]+)/g)].map((m) => m[1]!))].sort();
  if (findings === 0 && classes.length === 0 && !diag.includes("Checking") && !diag.includes("Finished")) {
    // A silent, findingless, evidence-free run is indistinguishable from a check
    // that never executed. Say so instead of printing a zero.
    throw new Error(
      `bonsai-emit-lanes: clippy produced no diagnostics AND no progress output for ${dir} — ` +
        `treating that as a check that did not run, not as a clean crate.`,
    );
  }
  return { findings, classes };
}

function main(): number {
  const withClippy = process.argv.includes("--clippy");
  const goldenMap: Record<string, string> = JSON.parse(
    readFileSync(join(HERE, "../zeta-ir-v1/zeta-ir-v1.golden.json"), "utf-8"),
  );
  const ir: ZetaIrV1 = parseIrJson(goldenMap["rng.splitmix64"]!);

  const root = mkdtempSync(join(tmpdir(), "bonsai-emit-lanes-"));
  const failures: string[] = [];
  try {
    const idiomatic = crate(root, "idiomatic", emitRustAt(ir, TARGET_RUST_IDIOMATIC));
    const portable = crate(root, "portable", emitRustAt(ir, TARGET_RUST_PORTABLE));

    console.log(`arrest levels: idiomatic=${levelOf(arrest(outputAssemblyProgram(), TARGET_RUST_IDIOMATIC))} portable=${levelOf(arrest(outputAssemblyProgram(), TARGET_RUST_PORTABLE))}`);

    const a = buildAndRun("idiomatic (L1)", idiomatic, failures);
    const b = buildAndRun("portable (L0)", portable, failures);
    if (a !== undefined && b !== undefined) {
      console.log("both lanes COMPILED and RAN");

      // (2) the two lanes agree with each other, byte for byte
      const aj = JSON.stringify(a, Object.keys(a).sort(), 2);
      const bj = JSON.stringify(b, Object.keys(b).sort(), 2);
      if (aj !== bj) failures.push('lanes "idiomatic (L1)" and "portable (L0)" DISAGREE: arresting higher changed WHAT the program computes');
      else console.log("lane outputs are byte-identical (L1 === L0)");

      // (3) both reproduce the committed hand-written port, vector by vector
      const committed = JSON.parse(
        readFileSync(join(HERE, "../splitmix64/rust-output.json"), "utf-8"),
      ) as Record<string, string>;
      const before = failures.length;
      for (const [id, expected] of Object.entries(committed)) {
        if (id === "_source") continue; // "hand-port" vs "generated-from-ir", by design
        for (const [lane, got] of [["idiomatic (L1)", a], ["portable (L0)", b]] as const) {
          if (got[id] !== expected) failures.push(`lane "${lane}": ${id} = ${String(got[id])}, committed hand-written port says ${expected}`);
        }
      }
      if (failures.length === before) {
        console.log(`both lanes reproduce all ${String(Object.keys(committed).length - 1)} committed splitmix64 vectors`);
      }
    }

    if (withClippy) {
      const handwritten = crate(root, "handwritten", readFileSync(join(HERE, "../splitmix64/_gen/gen.rs"), "utf-8"));
      const rows = [
        ["generated, arrested L0 (portable)", clippy(portable)],
        ["generated, arrested L1 (idiomatic)", clippy(idiomatic)],
        ["hand-written control", clippy(handwritten)],
      ] as const;
      console.log("\nclippy -W pedantic -W nursery — reported as separate numbers, NOT a subset verdict:");
      for (const [label, r] of rows) {
        console.log(`  ${label.padEnd(36)} ${String(r.findings).padStart(3)} findings / ${String(r.classes.length)} classes  [${r.classes.join(", ")}]`);
      }
      console.log(
        "\n  A `lints(generated) ⊆ lints(hand-written)` bar is VACUOUS on this corpus: the\n" +
          "  hand-written control carries the same class the arrest removes, so the L0 lane\n" +
          "  would pass it while being no cleaner than the human.",
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }

  for (const f of failures) console.error(`FAIL: ${f}`);
  return failures.length === 0 ? 0 : 1;
}

if (import.meta.main) {
  process.exit(main());
}
