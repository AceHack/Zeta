/**
 * src/Core.TypeScript/hygiene/audit-local-helm-charts.test.ts
 *
 * MUTATION SUITE — proves `audit-local-helm-charts.ts` can go RED.
 *
 * Same discipline as infra/k8s/tests/validate-applications.test.ts, for the same reason: a
 * green check is worth nothing until someone has watched it fail. Each case
 * copies the REAL example chart tree to a temp dir, applies ONE mutation, runs
 * the validator as a subprocess, and asserts BOTH exit code 1 AND the specific
 * expected reason in the output. Exit code alone is insufficient — a script can
 * exit 1 for the wrong reason (bad argument, missing file) and still look like
 * a working check.
 *
 * `control` runs the UNMUTATED copy and asserts exit 0, so a validator that
 * failed unconditionally cannot satisfy this suite.
 *
 * Two cases are load-bearing and belong to nothing else in the repo:
 *   - `name does not match directory` — `helm lint` does NOT catch this
 *     (verified 2026-08-23: a chart dir `c` declaring `name: WRONGNAME` lints
 *     clean, rc=0), and zeta-deps.yaml addresses charts BY NAME.
 *   - `zeta-deps version drift` — the two literals were unbound before today.
 *
 * All cases are offline and take ~0.05 s each.
 */

import { describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const validator = join(here, "audit-local-helm-charts.ts");
const realExample = join(repoRoot, "examples", "helm-dependency-graph");

interface RunResult {
  readonly exitCode: number;
  readonly output: string;
}

/** Copy the real example tree into an isolated root, mutate it, validate it. */
function runWithMutation(mutate: (exampleDir: string) => void): RunResult {
  const dir = mkdtempSync(join(tmpdir(), "zeta-chart-mutation-"));
  try {
    const exampleDir = join(dir, "examples", "helm-dependency-graph");
    mkdirSync(join(dir, "examples"), { recursive: true });
    cpSync(realExample, exampleDir, { recursive: true });
    mutate(exampleDir);
    const proc = Bun.spawnSync(["bun", validator, "--root", dir], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: repoRoot,
    });
    return {
      exitCode: proc.exitCode,
      output: `${proc.stdout.toString()}${proc.stderr.toString()}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function chartYaml(exampleDir: string, chart: string): string {
  return join(exampleDir, "charts", chart, "Chart.yaml");
}

function edit(path: string, fn: (text: string) => string): void {
  writeFileSync(path, fn(readFileSync(path, "utf-8")), "utf-8");
}

describe("audit-local-helm-charts mutation suite", () => {
  test("control: the unmutated example tree passes", () => {
    const r = runWithMutation(() => {});
    expect(r.output).toContain("Discovered 2 in-repo chart(s)");
    expect(r.output).toContain("0 failed");
    expect(r.exitCode).toBe(0);
  });

  test("Chart.yaml that does not parse as YAML fails", () => {
    const r = runWithMutation((d) => {
      edit(chartYaml(d, "postgres"), (t) => `${t}\n\tbad: [unclosed\n`);
    });
    expect(r.output).toContain("does not parse as YAML");
    expect(r.exitCode).toBe(1);
  });

  test("missing name fails", () => {
    const r = runWithMutation((d) => {
      edit(chartYaml(d, "postgres"), (t) => t.replace(/^name: .*$/m, ""));
    });
    expect(r.output).toContain("name is required");
    expect(r.exitCode).toBe(1);
  });

  test("name that does not match the directory fails (helm lint does NOT catch this)", () => {
    const r = runWithMutation((d) => {
      edit(chartYaml(d, "postgres"), (t) => t.replace(/^name: postgres$/m, "name: postgrez"));
    });
    expect(r.output).toContain('does not match its directory "postgres"');
    expect(r.exitCode).toBe(1);
  });

  test("missing version fails", () => {
    const r = runWithMutation((d) => {
      edit(chartYaml(d, "my-app"), (t) => t.replace(/^version: .*$/m, ""));
    });
    expect(r.output).toContain("version is required");
    expect(r.exitCode).toBe(1);
  });

  test("non-SemVer version fails", () => {
    const r = runWithMutation((d) => {
      edit(chartYaml(d, "my-app"), (t) => t.replace(/^version: .*$/m, 'version: "1.0"'));
    });
    expect(r.output).toContain("is not valid SemVer");
    expect(r.exitCode).toBe(1);
  });

  test("unquoted numeric version fails with the same reason helm gives", () => {
    // `version: 1.0` is a YAML float. helm: "version should be of type string
    // but it's of type float64" (verified 2026-08-23, helm v4.2.0).
    const r = runWithMutation((d) => {
      edit(chartYaml(d, "my-app"), (t) => t.replace(/^version: .*$/m, "version: 1.0"));
    });
    expect(r.output).toContain("version should be of type string");
    expect(r.exitCode).toBe(1);
  });

  test("invalid apiVersion fails", () => {
    const r = runWithMutation((d) => {
      edit(chartYaml(d, "my-app"), (t) => t.replace(/^apiVersion: v2$/m, "apiVersion: v9"));
    });
    expect(r.output).toContain('apiVersion must be "v1" or "v2"');
    expect(r.exitCode).toBe(1);
  });

  test("zeta-deps.yaml pinning a version the chart does not declare fails", () => {
    const r = runWithMutation((d) => {
      edit(join(d, "my-app-postgres", "zeta-deps.yaml"), (t) =>
        t.replace(/version: "15\.2\.0"/, 'version: "16.0.0"'),
      );
    });
    expect(r.output).toContain('pins version "16.0.0"');
    expect(r.output).toContain('Chart.yaml declares "15.2.0"');
    expect(r.exitCode).toBe(1);
  });

  test("bumping Chart.yaml without bumping zeta-deps.yaml fails (the other direction)", () => {
    const r = runWithMutation((d) => {
      edit(chartYaml(d, "postgres"), (t) => t.replace(/^version: 15\.2\.0$/m, "version: 16.0.0"));
    });
    expect(r.output).toContain('pins version "15.2.0"');
    expect(r.output).toContain('Chart.yaml declares "16.0.0"');
    expect(r.exitCode).toBe(1);
  });

  test("an unparseable chart does not launder the dependency edge pointing at it", () => {
    // REGRESSION (found 2026-08-23 by breaking the real chart): the coupling
    // check keyed `owned` off the PARSED name, so a chart whose Chart.yaml did
    // not parse disappeared from the map and its inbound edge was reported as
    // "not a chart we own" -- a PASS. The parse failure was loud, but this
    // second check silently stopped constraining anything.
    const r = runWithMutation((d) => {
      edit(chartYaml(d, "postgres"), (t) => `${t}\n\tbad: [unclosed\n`);
    });
    expect(r.output).not.toContain('dependsOn "postgres" is not a chart we own');
    expect(r.output).toContain("whose Chart.yaml could not be read");
    expect(r.exitCode).toBe(1);
  });

  test("an empty chart set fails rather than reporting 0 failures", () => {
    // An empty run is not zero failures. If discovery silently returns nothing,
    // every other case in this file would pass vacuously.
    const dir = mkdtempSync(join(tmpdir(), "zeta-chart-empty-"));
    try {
      const proc = Bun.spawnSync(["bun", validator, "--root", dir], {
        stdout: "pipe",
        stderr: "pipe",
        cwd: repoRoot,
      });
      const output = `${proc.stdout.toString()}${proc.stderr.toString()}`;
      expect(output).toContain("no charts discovered");
      expect(proc.exitCode).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the offline run states that helm checks were skipped, rather than skipping silently", () => {
    const r = runWithMutation(() => {});
    expect(r.output).toContain("SKIPPED (stated, not silent)");
    expect(r.exitCode).toBe(0);
  });
});
