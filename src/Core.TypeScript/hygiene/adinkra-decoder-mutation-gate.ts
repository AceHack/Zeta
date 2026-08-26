/**
 * Adinkra decoder mutation gate.
 *
 * The standing mutation runner chooses small generic edits. This gate is narrower: it plants four
 * known-dangerous transport variants in an isolated copy of Core.TypeScript and requires the
 * end-to-end durable-root suite to distinguish every one. The live checkout is never mutated.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testsExecuted } from "./mutation-runner";

const SEAM_TEST = "src/Core.TypeScript/research/adinkra-ecc/adinkra-durable-evidence-seam.test.ts";

export interface ExactMutationPatch {
  readonly find: string;
  readonly replace: string;
}

export interface AdinkraDecoderMutant {
  readonly id: string;
  readonly source: string;
  readonly patches: readonly ExactMutationPatch[];
  readonly expectedFailure: string;
}

export type AdinkraMutationOutcome =
  | { readonly kind: "killed"; readonly id: string; readonly expectedFailure: string }
  | { readonly kind: "survived"; readonly id: string }
  | { readonly kind: "unresolved"; readonly id: string; readonly why: string };

export interface AdinkraMutationReport {
  readonly baselineTests: number;
  readonly outcomes: readonly AdinkraMutationOutcome[];
}

export const ADINKRA_DECODER_MUTANTS: readonly AdinkraDecoderMutant[] = [
  {
    id: "ambiguity-accepted",
    source: "src/Core.TypeScript/discovery/udp-lossy-transport.ts",
    patches: [{ find: "    if (pivot === -1) return null;", replace: "    if (pivot === -1) continue;" }],
    expectedFailure: "ADES-2 (exhaustive)",
  },
  {
    id: "crc-bypassed",
    source: "src/Core.TypeScript/discovery/udp-lossy-transport.ts",
    patches: [
      {
        find:
          "  if (claimed !== actual) {\n" +
          "    return {\n" +
          "      ok: false,\n" +
          '      reason: "checksum",\n' +
          "      evidence: mintCorruptionEvidence(`crc32c mismatch: claimed ${claimed}, computed ${actual}, ${end} bytes`),\n" +
          "    };\n" +
          "  }",
        replace: "  if (claimed !== actual) { /* deliberate mutant: accept an inconsistent frame */ }",
      },
    ],
    expectedFailure: "ADES-5",
  },
  {
    id: "duplicate-redelivered",
    source: "src/Core.TypeScript/discovery/udp-lossy-transport.ts",
    patches: [
      {
        find:
          "    if (this.deliveredBlocks.has(deliveredKey)) {\n" +
          "      // Already delivered, block long gone. Refresh recency — while stragglers keep arriving for\n" +
          "      // this block, the guard it needs stays alive — and drop the packet. Dropping rather than\n" +
          "      // re-creating the block also keeps a dead block out of the recovery window.\n" +
          "      this.deliveredBlocks.delete(deliveredKey);\n" +
          "      this.deliveredBlocks.add(deliveredKey);\n" +
          "      return;\n" +
          "    }",
        replace:
          "    if (this.deliveredBlocks.has(deliveredKey)) {\n" +
          "      this.deliveredBlocks.delete(deliveredKey);\n" +
          "      this.recvBlocks.delete(deliveredKey);\n" +
          "    }",
      },
    ],
    expectedFailure: "ADES-4",
  },
  {
    id: "semantic-suffix-ignored",
    source: "src/Core.TypeScript/observe/room/durable-room-evidence.ts",
    patches: [
      {
        find: '    if (payload[index] !== 0) return failed("receipt datagram has non-zero bytes after its declared payload");',
        replace: "    if (payload[index] !== 0) continue;",
      },
    ],
    expectedFailure: "ADES-7",
  },
] as const;

function occurrenceCount(source: string, find: string): number {
  if (find.length === 0) throw new Error("mutation find text must not be empty");
  return source.split(find).length - 1;
}

/** Apply one exact mutant. Every site must occur exactly once or the mutation is unresolved. */
export function applyExactAdinkraMutant(source: string, mutant: AdinkraDecoderMutant): string {
  let changed = source;
  for (const patch of mutant.patches) {
    const count = occurrenceCount(changed, patch.find);
    if (count !== 1) {
      throw new Error(`${mutant.id}: expected one exact mutation site, found ${String(count)}`);
    }
    changed = changed.replace(patch.find, patch.replace);
  }
  return changed;
}

interface SuiteRun {
  readonly status: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly tests: number | null;
  readonly output: string;
  readonly error: Error | undefined;
}

function runSeamSuite(root: string): SuiteRun {
  const result = spawnSync("bun", ["test", SEAM_TEST], {
    cwd: root,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return { status: result.status, signal: result.signal, tests: testsExecuted(output), output, error: result.error };
}

/** Non-zero without the named assertion is unresolved: a crash is not credit for the seam suite. */
export function classifyAdinkraMutationRun(mutant: AdinkraDecoderMutant, run: SuiteRun): AdinkraMutationOutcome {
  if (run.error !== undefined || run.signal !== null || run.status === null) {
    return {
      kind: "unresolved",
      id: mutant.id,
      why: run.error?.message ?? `suite terminated by ${run.signal ?? "an unknown condition"}`,
    };
  }
  if (run.status === 0) return { kind: "survived", id: mutant.id };
  if (!run.output.includes(mutant.expectedFailure)) {
    return {
      kind: "unresolved",
      id: mutant.id,
      why: `suite failed without the expected ${mutant.expectedFailure} witness`,
    };
  }
  return { kind: "killed", id: mutant.id, expectedFailure: mutant.expectedFailure };
}

function isolatedCoreCopy(root: string): string {
  const isolated = mkdtempSync(join(tmpdir(), "zeta-adinkra-mutants-"));
  mkdirSync(join(isolated, "src"), { recursive: true });
  cpSync(join(root, "src", "Core.TypeScript"), join(isolated, "src", "Core.TypeScript"), { recursive: true });
  const dependencies = join(root, "node_modules");
  if (existsSync(dependencies)) symlinkSync(dependencies, join(isolated, "node_modules"), "junction");
  return isolated;
}

/** Run the baseline once, then plant and restore every exact mutant in the isolated copy. */
export function runAdinkraDecoderMutationGate(root: string): AdinkraMutationReport {
  const isolated = isolatedCoreCopy(root);
  try {
    const baseline = runSeamSuite(isolated);
    if (baseline.status !== 0 || baseline.tests === null || baseline.tests === 0) {
      throw new Error(
        `mutation baseline produced no verdict: status=${String(baseline.status)}, tests=${String(baseline.tests)}, signal=${String(baseline.signal)}`,
      );
    }

    const outcomes: AdinkraMutationOutcome[] = [];
    for (const mutant of ADINKRA_DECODER_MUTANTS) {
      const sourcePath = join(isolated, mutant.source);
      const original = readFileSync(sourcePath, "utf8");
      try {
        writeFileSync(sourcePath, applyExactAdinkraMutant(original, mutant));
        outcomes.push(classifyAdinkraMutationRun(mutant, runSeamSuite(isolated)));
      } finally {
        writeFileSync(sourcePath, original);
      }
    }
    return { baselineTests: baseline.tests, outcomes };
  } finally {
    rmSync(isolated, { recursive: true, force: true });
  }
}
