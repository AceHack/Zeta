// audit-install-tier-declared.test.ts — falsifiers for the undeclared-apt-payload audit.
//
// The audit's whole value is that it fires on the shape that was measured live. So the
// first test IS that shape, transcribed from `ci-cache-paths-lint.yml` as it stood on
// 2026-08-25 — the job named "audit actions/cache paths vs git ls-files" whose last 20
// completed runs carried 5 failures, ALL FIVE inside the install step and none inside
// the audit step it is named for.

import { describe, expect, test } from "bun:test";

import { auditWorkflow, inScope, parseJobs } from "./audit-install-tier-declared.ts";

/** The live specimen, reduced to the keys the audit reads. */
const UNDECLARED = `name: ci-cache-paths-lint
on:
  push:
    branches: [main]
jobs:
  audit:
    name: audit actions/cache paths vs git ls-files
    runs-on: ubuntu-24.04
    timeout-minutes: 12
    steps:
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1
      - name: Install toolchain via three-way-parity script (GOVERNANCE §24)
        env:
          MISE_GITHUB_TOKEN: \${{ github.token }}
        run: ./tools/setup/install.sh
      - name: Run audit-ci-cache-paths
        run: bun src/Core.TypeScript/hygiene/audit-ci-cache-paths.ts
`;

const DECLARED = UNDECLARED.replace(
  "          MISE_GITHUB_TOKEN: ${{ github.token }}",
  "          MISE_GITHUB_TOKEN: ${{ github.token }}\n          ZETA_HOST_TIER: slim",
);

describe("the measured specimen", () => {
  test("an ubuntu job that runs install.sh without declaring a tier is a finding", () => {
    const r = auditWorkflow(".github/workflows/ci-cache-paths-lint.yml", UNDECLARED);
    expect(r.inScope).toBe(1);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.job).toBe("audit");
    expect(r.findings[0]?.runsOn).toBe("ubuntu-24.04");
  });

  test("declaring ANY tier clears it — the audit refuses silence, never a value", () => {
    for (const tier of ["slim", "standard", "full"]) {
      const src = DECLARED.replace("ZETA_HOST_TIER: slim", `ZETA_HOST_TIER: ${tier}`);
      expect(auditWorkflow("w.yml", src).findings).toHaveLength(0);
    }
  });
});

describe("scope — stated, not silent", () => {
  test("a matrix runs-on is OUT of scope: macOS/Windows legs do not detect a constant", () => {
    // gate.yml's `build-and-test`. A step-level declaration there would silently change
    // what the 7 GB macos-15 leg installs (it detects `standard`, not `full`), which is a
    // real decision needing its own measurement rather than a side effect of this audit.
    const src = UNDECLARED.replace("runs-on: ubuntu-24.04", "runs-on: ${{ matrix.os }}");
    const r = auditWorkflow("gate.yml", src);
    expect(r.inScope).toBe(0);
    expect(r.findings).toHaveLength(0);
  });

  test("a macos/windows install-shield is OUT of scope: detection is its subject", () => {
    for (const runner of ["macos-15", "windows-2025", "ubuntu-24.04-arm"]) {
      const src = UNDECLARED.replace("runs-on: ubuntu-24.04", `runs-on: ${runner}`);
      const inScopeCount = auditWorkflow("w.yml", src).inScope;
      expect(inScopeCount).toBe(runner.startsWith("ubuntu-") ? 1 : 0);
    }
  });

  test("a job that never runs install.sh is out of scope however it is configured", () => {
    const src = UNDECLARED.replace("        run: ./tools/setup/install.sh", "        run: echo hi");
    expect(auditWorkflow("w.yml", src).inScope).toBe(0);
  });

  test("install.sh named only in a COMMENT is not an invocation", () => {
    // The vacuity in the other direction: half this repo's workflow prose mentions
    // install.sh. Counting a comment would flag jobs that install nothing, and an audit
    // that cries wolf gets muted — which is how the real one stops being read.
    const src = UNDECLARED.replace(
      "        run: ./tools/setup/install.sh",
      "        # same retry rationale as every ./tools/setup/install.sh step in this file\n        run: echo hi",
    );
    expect(auditWorkflow("w.yml", src).inScope).toBe(0);
  });
});

describe("the job splitter", () => {
  test("a declaration in ONE job does not clear a sibling job", () => {
    // helm-validate.yml is the live instance: it declared `full` on a later job while an
    // earlier one was silent. A whole-file grep for ZETA_HOST_TIER would have passed it.
    const two = `jobs:
  declared:
    runs-on: ubuntu-24.04
    steps:
      - name: Install
        env:
          ZETA_HOST_TIER: full
        run: ./tools/setup/install.sh
  silent:
    runs-on: ubuntu-24.04
    steps:
      - name: Install
        run: ./tools/setup/install.sh
`;
    const r = auditWorkflow("helm-validate.yml", two);
    expect(r.inScope).toBe(2);
    expect(r.findings.map((f) => f.job)).toEqual(["silent"]);
  });

  test("parseJobs reads runs-on per job and never leaks it across the boundary", () => {
    const jobs = parseJobs(`jobs:
  a:
    runs-on: ubuntu-24.04
    steps: []
  b:
    runs-on: macos-15
    steps: []
`);
    expect(jobs.map((j) => [j.job, j.runsOn])).toEqual([
      ["a", "ubuntu-24.04"],
      ["b", "macos-15"],
    ]);
    expect(jobs.filter(inScope)).toEqual([]);
  });
});
