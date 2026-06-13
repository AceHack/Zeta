// create-repo.test.ts — DST coverage for the B-0424 Stage 1 scaffold tool.
//
// All tests run create-repo.ts as a subprocess with --dry-run (no external
// side effects, no network, no GitHub calls). Each test asserts the planned
// operation set is correct and complete before anyone runs --apply.
//
// Runs via:
//   bun test tools/scaffold/create-repo.test.ts
//
// Zero network — all data comes from the on-disk scaffold templates.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "bun:test";

const SCRIPT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "create-repo.ts"
);

interface Operation {
  step: string;
  description: string;
  command?: string;
  data?: Record<string, unknown>;
  status: "planned" | "executed" | "skipped" | "failed";
  error?: string;
}

interface RunResult {
  repo: string;
  dryRun: boolean;
  operations: Operation[];
  summary: string;
}

function runDryRun(repo: "forge" | "ace" | "civsim"): RunResult {
  const result = spawnSync("bun", [SCRIPT, "--repo", repo, "--dry-run"], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `create-repo.ts exited ${result.status}: ${result.stderr}`
    );
  }
  return JSON.parse(result.stdout) as RunResult;
}

// Canonical step IDs emitted by the tool (order matches execution order in
// main: 01, 01b, 06, 02, 02b, 03a, 03b, 03c, 03d, 04, 05, 07).
const EXPECTED_STEPS = [
  "01-create-repo",
  "01b-merge-settings",
  "06-push-scaffold-files",
  "02-branch-protection",
  "02b-required-signed-commits",
  "03a-secret-scanning",
  "03b-dependabot-alerts",
  "03c-dependabot-security-updates",
  "03d-private-vuln-reporting",
  "04-codeql-default-setup",
  "05-fork-to-acehack",
  "07-next-steps",
] as const;

function assertCommonInvariants(result: RunResult, repoName: string): void {
  expect(result.dryRun).toBe(true);
  expect(result.repo).toBe(`Lucent-Financial-Group/${repoName}`);
  expect(result.summary).toContain("DRY RUN");
  expect(result.summary).toContain("planned");

  // Every operation is "planned" in dry-run mode.
  for (const op of result.operations) {
    expect(op.status).toBe("planned");
  }

  // Exact step inventory (order-independent).
  const steps = result.operations.map((o) => o.step);
  for (const expected of EXPECTED_STEPS) {
    expect(steps).toContain(expected);
  }
  expect(result.operations).toHaveLength(EXPECTED_STEPS.length);
}

// --- forge ---

describe("forge dry-run", () => {
  let result: RunResult;
  beforeAll(() => {
    result = runDryRun("forge");
  });

  test("produces dryRun:true with LFG/Forge repo name", () => {
    expect(result.dryRun).toBe(true);
    expect(result.repo).toBe("Lucent-Financial-Group/Forge");
  });

  test("all operations are planned (no executions in dry-run)", () => {
    for (const op of result.operations) {
      expect(op.status).toBe("planned");
    }
  });

  test("contains all 12 expected step IDs", () => {
    assertCommonInvariants(result, "Forge");
  });

  test("step 01 targets LFG/Forge as public squash-merge repo", () => {
    const op = result.operations.find((o) => o.step === "01-create-repo");
    expect(op).toBeDefined();
    expect(op!.data).toMatchObject({
      visibility: "public",
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      delete_branch_on_merge: true,
      allow_auto_merge: true,
    });
  });

  test("step 02 branch protection disables force-push and requires linear history", () => {
    const op = result.operations.find((o) => o.step === "02-branch-protection");
    expect(op).toBeDefined();
    expect(op!.data).toMatchObject({
      allow_force_pushes: false,
      required_linear_history: true,
      required_conversation_resolution: true,
    });
  });

  test("step 02 branch protection has empty required_status_checks (avoids deadlock)", () => {
    const op = result.operations.find((o) => o.step === "02-branch-protection");
    expect(op).toBeDefined();
    const checks = (op!.data as { required_status_checks: { contexts: string[] } }).required_status_checks;
    // Empty at creation time — CI workflows don't exist yet; adding them before
    // the workflows land deadlocks the repo. Populated after CI is wired.
    expect(checks.contexts).toEqual([]);
  });

  test("step 04 enables CodeQL default-setup (not advanced-only)", () => {
    const op = result.operations.find((o) => o.step === "04-codeql-default-setup");
    expect(op).toBeDefined();
    expect(op!.data).toMatchObject({ state: "configured", query_suite: "default" });
    // Confirm description calls out the ruleset-rule requirement.
    expect(op!.description).toContain("code_scanning");
    expect(op!.description).toContain("default-setup");
  });

  test("step 05 forks to AceHack org", () => {
    const op = result.operations.find((o) => o.step === "05-fork-to-acehack");
    expect(op).toBeDefined();
    expect(op!.data).toMatchObject({ organization: "AceHack" });
    expect(op!.description).toContain("AceHack/Forge");
  });

  test("step 06 lists scaffold files to push", () => {
    const op = result.operations.find((o) => o.step === "06-push-scaffold-files");
    expect(op).toBeDefined();
    const files = (op!.data as { files: string[] }).files;
    expect(files.length).toBeGreaterThan(0);
    // Core governance files must be present.
    expect(files.some((f) => f.includes("README.md"))).toBe(true);
    expect(files.some((f) => f.includes("AGENTS.md"))).toBe(true);
    expect(files.some((f) => f.includes("GOVERNANCE.md"))).toBe(true);
    expect(files.some((f) => f.includes("SECURITY.md"))).toBe(true);
    expect(files.some((f) => f.includes("LICENSE"))).toBe(true);
    // GHA injection protection must be present from day one (B-0424.6).
    expect(files.some((f) => f.includes(".semgrep.yml"))).toBe(true);
    // Toolchain pin for semgrep must be scaffolded alongside it (B-0424.6).
    expect(files.some((f) => f.includes(".mise.toml"))).toBe(true);
    // Dependabot config must be present from day one (B-0424.7).
    // API enablement (steps 03b/03c) toggles the feature; this file names ecosystems.
    expect(files.some((f) => f.includes("dependabot.yml"))).toBe(true);
  });

  test("step 07 lists manual steps including budget-cap verification", () => {
    const op = result.operations.find((o) => o.step === "07-next-steps");
    expect(op).toBeDefined();
    const manual = (op!.data as { manualSteps: string[] }).manualSteps;
    expect(manual.length).toBeGreaterThan(0);
    expect(manual.some((s) => s.toLowerCase().includes("budget"))).toBe(true);
    expect(manual.some((s) => s.toLowerCase().includes("codeql"))).toBe(true);
  });
});

// --- ace ---

describe("ace dry-run", () => {
  let result: RunResult;
  beforeAll(() => {
    result = runDryRun("ace");
  });

  test("produces dryRun:true with LFG/ace repo name", () => {
    expect(result.dryRun).toBe(true);
    expect(result.repo).toBe("Lucent-Financial-Group/ace");
  });

  test("all operations are planned (no executions in dry-run)", () => {
    for (const op of result.operations) {
      expect(op.status).toBe("planned");
    }
  });

  test("contains all 12 expected step IDs", () => {
    assertCommonInvariants(result, "ace");
  });

  test("step 01 targets LFG/ace as public squash-merge repo (no homepage)", () => {
    const op = result.operations.find((o) => o.step === "01-create-repo");
    expect(op).toBeDefined();
    expect(op!.data).toMatchObject({
      name: "ace",
      visibility: "public",
      allow_squash_merge: true,
    });
    // ace has no homepage in the config (unlike Forge which links back to Zeta).
    expect((op!.data as Record<string, unknown>)["homepage"]).toBeUndefined();
  });

  test("step 05 forks to AceHack org", () => {
    const op = result.operations.find((o) => o.step === "05-fork-to-acehack");
    expect(op).toBeDefined();
    expect(op!.data).toMatchObject({ organization: "AceHack" });
    expect(op!.description).toContain("AceHack/ace");
  });

  test("step 06 lists scaffold files to push", () => {
    const op = result.operations.find((o) => o.step === "06-push-scaffold-files");
    expect(op).toBeDefined();
    const files = (op!.data as { files: string[] }).files;
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.includes("README.md"))).toBe(true);
    expect(files.some((f) => f.includes("SECURITY.md"))).toBe(true);
    // GHA injection protection must be present from day one (B-0424.6).
    expect(files.some((f) => f.includes(".semgrep.yml"))).toBe(true);
    // Toolchain pin for semgrep must be scaffolded alongside it (B-0424.6).
    expect(files.some((f) => f.includes(".mise.toml"))).toBe(true);
    // Dependabot config must be present from day one (B-0424.7).
    // API enablement (steps 03b/03c) toggles the feature; this file names ecosystems.
    expect(files.some((f) => f.includes("dependabot.yml"))).toBe(true);
  });
});

// --- civsim (product repo) ---

describe("civsim dry-run", () => {
  let result: RunResult;
  beforeAll(() => {
    result = runDryRun("civsim");
  });

  test("produces dryRun:true with LFG/civsim repo name", () => {
    expect(result.dryRun).toBe(true);
    expect(result.repo).toBe("Lucent-Financial-Group/civsim");
  });

  test("contains all 12 expected step IDs", () => {
    const steps = result.operations.map((o) => o.step);
    for (const expected of EXPECTED_STEPS) {
      expect(steps).toContain(expected);
    }
    expect(result.operations).toHaveLength(EXPECTED_STEPS.length);
  });

  test("step 05 is skipped — product repos are not mirrored to AceHack", () => {
    const op = result.operations.find((o) => o.step === "05-fork-to-acehack");
    expect(op).toBeDefined();
    expect(op!.status).toBe("skipped");
  });

  test("all non-skipped operations are planned in dry-run mode", () => {
    for (const op of result.operations) {
      if (op.step !== "05-fork-to-acehack") {
        expect(op.status).toBe("planned");
      }
    }
  });

  test("step 06 lists civsim scaffold files — minimal product set without .semgrep.yml", () => {
    const op = result.operations.find((o) => o.step === "06-push-scaffold-files");
    expect(op).toBeDefined();
    const files = (op!.data as { files: string[] }).files;
    expect(files.some((f) => f.includes("README.md"))).toBe(true);
    expect(files.some((f) => f.includes("LICENSE"))).toBe(true);
    expect(files.some((f) => f.includes("CONTRIBUTING.md"))).toBe(true);
    expect(files.some((f) => f.includes(".zeta-version"))).toBe(true);
    // civsim scaffold intentionally omits .semgrep.yml (product repo, not factory)
    expect(files.some((f) => f.includes(".semgrep.yml"))).toBe(false);
  });

  test("step 07 omits semgrep wiring instruction — .semgrep.yml not in civsim scaffold", () => {
    const op = result.operations.find((o) => o.step === "07-next-steps");
    expect(op).toBeDefined();
    const manual = (op!.data as { manualSteps: string[] }).manualSteps;
    expect(manual.some((s) => s.includes(".semgrep.yml"))).toBe(false);
  });

  test("step 07 includes repository_dispatch glue wiring step", () => {
    const op = result.operations.find((o) => o.step === "07-next-steps");
    expect(op).toBeDefined();
    const manual = (op!.data as { manualSteps: string[] }).manualSteps;
    expect(manual.some((s) => s.toLowerCase().includes("repository_dispatch"))).toBe(true);
  });

  test("step 07 includes B-0469 claim release with correct item ID", () => {
    const op = result.operations.find((o) => o.step === "07-next-steps");
    expect(op).toBeDefined();
    const manual = (op!.data as { manualSteps: string[] }).manualSteps;
    expect(manual.some((s) => s.includes("B-0469"))).toBe(true);
  });
});

// --- error handling ---

describe("invalid --repo argument", () => {
  test("exits non-zero with usage message for unknown repo", () => {
    const result = spawnSync("bun", [SCRIPT, "--repo", "nonexistent", "--dry-run"], {
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("Usage:");
  });

  test("exits non-zero when --repo is omitted", () => {
    const result = spawnSync("bun", [SCRIPT, "--dry-run"], {
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain("Usage:");
  });
});

// --- scaffold template content assertions (B-0424.8) ---
//
// These tests read the .semgrep.yml templates directly. The dry-run
// subprocess tests above verify file presence; these verify content.
// Zero network — readFileSync only.

const SCAFFOLD_DIR = dirname(fileURLToPath(import.meta.url));

// Required rule IDs and their purpose in the day-one security baseline.
const REQUIRED_SEMGREP_RULES = [
  "gha-untrusted-in-run-line",  // B-0424.6 — GHA workflow-injection (present from day one)
  "invisible-unicode-in-text",   // B-0424.8 — BP-10 invisible Unicode / prompt injection
  "gha-action-mutable-tag",      // B-0424.8 — supply-chain SHA-pin (CVE-2025-30066)
] as const;

describe("forge .semgrep.yml content (B-0424.8)", () => {
  let content: string;
  beforeAll(() => {
    content = readFileSync(join(SCAFFOLD_DIR, "forge", ".semgrep.yml"), "utf8");
  });

  for (const ruleId of REQUIRED_SEMGREP_RULES) {
    test(`contains rule id: ${ruleId}`, () => {
      expect(content).toContain(`id: ${ruleId}`);
    });
  }

  test("invisible-unicode rule targets .md, .ts, .yml, .toml", () => {
    const ruleStart = content.indexOf("id: invisible-unicode-in-text");
    expect(ruleStart).toBeGreaterThan(-1);
    const ruleBlock = content.slice(ruleStart, ruleStart + 600);
    expect(ruleBlock).toContain("**/*.md");
    expect(ruleBlock).toContain("**/*.ts");
    expect(ruleBlock).toContain("**/*.yml");
    expect(ruleBlock).toContain("**/*.toml");
  });

  test("invisible-unicode pattern-regex uses \\uXXXX escapes, not literal invisible chars (BP-10 self-clean)", () => {
    // The pattern-regex must not embed the very codepoints it detects.
    // Literal invisible chars would make this template trip its own lint
    // (bootstrap paradox). Verify the file is ASCII-clean in that line.
    const ruleStart = content.indexOf("id: invisible-unicode-in-text");
    expect(ruleStart).toBeGreaterThan(-1);
    const ruleBlock = content.slice(ruleStart, ruleStart + 600);
    const patternLine = ruleBlock.split("\n").find((l) => l.includes("pattern-regex"));
    expect(patternLine).toBeDefined();
    const invisibleRanges = /[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/;
    expect(invisibleRanges.test(patternLine!)).toBe(false);
  });

  test("mutable-tag rule targets .github/workflows", () => {
    const ruleStart = content.indexOf("id: gha-action-mutable-tag");
    expect(ruleStart).toBeGreaterThan(-1);
    const ruleBlock = content.slice(ruleStart, ruleStart + 400);
    expect(ruleBlock).toContain(".github/workflows");
  });
});

describe("ace .semgrep.yml content (B-0424.8)", () => {
  let content: string;
  beforeAll(() => {
    content = readFileSync(join(SCAFFOLD_DIR, "ace", ".semgrep.yml"), "utf8");
  });

  for (const ruleId of REQUIRED_SEMGREP_RULES) {
    test(`contains rule id: ${ruleId}`, () => {
      expect(content).toContain(`id: ${ruleId}`);
    });
  }

  test("invisible-unicode rule severity is ERROR", () => {
    const ruleStart = content.indexOf("id: invisible-unicode-in-text");
    expect(ruleStart).toBeGreaterThan(-1);
    const ruleBlock = content.slice(ruleStart, ruleStart + 1200);
    expect(ruleBlock).toContain("severity: ERROR");
  });

  test("invisible-unicode pattern-regex uses \\uXXXX escapes, not literal invisible chars (BP-10 self-clean)", () => {
    const ruleStart = content.indexOf("id: invisible-unicode-in-text");
    expect(ruleStart).toBeGreaterThan(-1);
    const ruleBlock = content.slice(ruleStart, ruleStart + 600);
    const patternLine = ruleBlock.split("\n").find((l) => l.includes("pattern-regex"));
    expect(patternLine).toBeDefined();
    const invisibleRanges = /[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/;
    expect(invisibleRanges.test(patternLine!)).toBe(false);
  });

  test("mutable-tag rule severity is ERROR", () => {
    const ruleStart = content.indexOf("id: gha-action-mutable-tag");
    expect(ruleStart).toBeGreaterThan(-1);
    const ruleBlock = content.slice(ruleStart, ruleStart + 800);
    expect(ruleBlock).toContain("severity: ERROR");
  });
});
