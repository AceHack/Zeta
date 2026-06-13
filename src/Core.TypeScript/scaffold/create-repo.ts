#!/usr/bin/env bun
// create-repo.ts — scaffolds a new GitHub repo with B-0424 best-practice settings.
//
// Implements Stage 1 of the three-repo split (ADR 2026-04-22) and the
// product-repo split (ADR 2026-05-14). Applies the full best-practice checklist:
// merge settings, branch protection, security scanning, CodeQL default-setup,
// Dependabot, spending-cap verification (manual step), and day-one governance
// files from tools/scaffold/<repoName>/.
//
// Usage:
//   bun tools/scaffold/create-repo.ts --repo forge  --dry-run   # preview (default)
//   bun tools/scaffold/create-repo.ts --repo ace    --dry-run
//   bun tools/scaffold/create-repo.ts --repo civsim --dry-run
//   bun tools/scaffold/create-repo.ts --repo forge  --apply     # create for real
//   bun tools/scaffold/create-repo.ts --repo civsim --apply
//
// Requires:
//   gh CLI authenticated with: repo, read:org, workflow scopes
//   (add admin:org for budget-cap verification — optional)
//
// Output: one JSON object describing planned/executed operations.
//
// IMPORTANT: --apply creates real GitHub repos under LFG org.
// Review the --dry-run output carefully before passing --apply.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// --- Types ---

interface RepoConfig {
  org: string;
  name: string;
  description: string;
  homepage?: string;
  /** Product repos skip the AceHack mirror step and use the honor-system license. */
  isProduct?: boolean;
  /** Backlog item ID referenced in the post-creation claim-release reminder (e.g. "B-0469"). */
  backlogItem?: string;
}

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

// --- Config ---

const REPO_CONFIGS: Record<string, RepoConfig> = {
  // Factory-infrastructure repos — Apache 2.0, forking welcome, AceHack mirror
  forge: {
    org: "Lucent-Financial-Group",
    name: "Forge",
    description:
      "Software factory that builds Zeta and ace — factory tooling and governance",
    homepage: "https://github.com/Lucent-Financial-Group/Zeta",
  },
  ace: {
    org: "Lucent-Financial-Group",
    name: "ace",
    description:
      "Package manager for the Lucent Financial Group software stack",
  },
  // Product repos — honor-system license, no AceHack mirror
  // See ADR: docs/DECISIONS/2026-05-14-product-repo-split-decisions.md
  civsim: {
    org: "Lucent-Financial-Group",
    name: "civsim",
    description:
      "Civilisation simulation — turn-based strategy with AI-directed factions and mutual-privacy design",
    isProduct: true,
    backlogItem: "B-0469",
  },
};

const FORK_ORG = "AceHack";
const SCAFFOLD_DIR = dirname(fileURLToPath(import.meta.url));

// Required status checks for branch protection.
// Set empty at creation time — CI workflows that emit these check names don't
// exist until they're wired in Stage 2. Setting them before the workflows land
// deadlocks the new repo (no PR can merge to add the workflows). Add them via
// `gh api --method PUT /repos/.../branches/main/protection` after CI is wired.
const REQUIRED_CHECKS: string[] = [];

// --- Argument parsing ---

const args = process.argv.slice(2);
const repoArg = args.find((_, i) => args[i - 1] === "--repo");
const dryRun = !args.includes("--apply");

if (!repoArg || !REPO_CONFIGS[repoArg]) {
  console.error(
    `Usage: bun tools/scaffold/create-repo.ts --repo <forge|ace> [--dry-run|--apply]`
  );
  console.error(`Known repos: ${Object.keys(REPO_CONFIGS).join(", ")}`);
  process.exit(1);
}

const config = REPO_CONFIGS[repoArg];
const ops: Operation[] = [];

// Default branch — updated to the repo's actual default after step01 completes in --apply mode.
// In --dry-run mode this stays "main" (documented LFG org default).
let defaultBranch = "main";

// --- Helpers ---

function gh(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh CLI is PATH-resolved intentionally
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

function plan(
  step: string,
  description: string,
  command: string,
  data?: Record<string, unknown>
): Operation {
  const op: Operation = {
    step,
    description,
    command,
    ...(data !== undefined ? { data } : {}),
    status: "planned",
  };
  ops.push(op);
  return op;
}

function ghApiPatch(
  path: string,
  data: Record<string, unknown>,
  description: string,
  step: string
): Operation {
  const body = JSON.stringify(data);
  const op = plan(step, description, `gh api --method PATCH ${path} --input -`, data);
  if (!dryRun) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh CLI is PATH-resolved intentionally
    const result = spawnSync(
      "gh",
      ["api", "--method", "PATCH", path, "--input", "-"],
      { input: body, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    op.status = result.status === 0 ? "executed" : "failed";
    if (op.status === "failed") op.error = result.stderr;
  }
  return op;
}

function ghApiPut(
  path: string,
  data: Record<string, unknown>,
  description: string,
  step: string
): Operation {
  const body = JSON.stringify(data);
  const op = plan(step, description, `gh api --method PUT ${path} --input -`, data);
  if (!dryRun) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh CLI is PATH-resolved intentionally
    const result = spawnSync(
      "gh",
      ["api", "--method", "PUT", path, "--input", "-"],
      { input: body, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    op.status = result.status === 0 ? "executed" : "failed";
    if (op.status === "failed") op.error = result.stderr;
  }
  return op;
}

function ghApiPost(
  path: string,
  data: Record<string, unknown>,
  description: string,
  step: string
): Operation {
  const body = JSON.stringify(data);
  const op = plan(step, description, `gh api --method POST ${path} --input -`, data);
  if (!dryRun) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh CLI is PATH-resolved intentionally
    const result = spawnSync(
      "gh",
      ["api", "--method", "POST", path, "--input", "-"],
      { input: body, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    op.status = result.status === 0 ? "executed" : "failed";
    if (op.status === "failed") op.error = result.stderr;
  }
  return op;
}

// --- Step implementations ---

function step01_createRepo(): void {
  const op = plan(
    "01-create-repo",
    `Create ${config.org}/${config.name} (public, squash-merge, auto-merge, delete-branch)`,
    `gh repo create ${config.org}/${config.name} --public --description "${config.description}"`,
    {
      name: config.name,
      description: config.description,
      visibility: "public",
      allow_squash_merge: true,
      allow_merge_commit: false,
      allow_rebase_merge: false,
      delete_branch_on_merge: true,
      allow_auto_merge: true,
    }
  );
  // Plan 01b-merge-settings unconditionally so dry-run output is complete.
  const mergeData: Record<string, unknown> = {
    allow_squash_merge: true,
    allow_merge_commit: false,
    allow_rebase_merge: false,
    delete_branch_on_merge: true,
    allow_auto_merge: true,
    ...(config.homepage ? { homepage: config.homepage } : {}),
  };
  const mergeOp = plan(
    "01b-merge-settings",
    "Apply merge/auto-merge settings (squash-only, auto-merge, delete-branch-on-merge)",
    `gh api --method PATCH /repos/${config.org}/${config.name} --input -`,
    mergeData
  );
  if (!dryRun) {
    // Create repo
    const create = gh([
      "repo",
      "create",
      `${config.org}/${config.name}`,
      "--public",
      "--description",
      config.description,
      "--clone=false",
    ]);
    if (!create.ok) {
      op.status = "failed";
      op.error = create.stderr;
      mergeOp.status = "skipped";
      return;
    }
    // Detect actual default branch so step02 + step06 target the right branch.
    const repoMeta = gh(["api", `/repos/${config.org}/${config.name}`]);
    if (repoMeta.ok) {
      try {
        defaultBranch = (JSON.parse(repoMeta.stdout) as { default_branch: string }).default_branch;
      } catch { /* keep "main" */ }
    }
    // Apply merge settings (and optional homepage) via PATCH
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh CLI is PATH-resolved intentionally
    const mergeResult = spawnSync(
      "gh",
      ["api", "--method", "PATCH", `/repos/${config.org}/${config.name}`, "--input", "-"],
      { input: JSON.stringify(mergeData), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    mergeOp.status = mergeResult.status === 0 ? "executed" : "failed";
    if (mergeOp.status === "failed") mergeOp.error = mergeResult.stderr;
    op.status = "executed";
  }
}

function step02_branchProtection(): void {
  ghApiPut(
    `/repos/${config.org}/${config.name}/branches/${defaultBranch}/protection`,
    {
      required_status_checks: {
        strict: true,
        contexts: REQUIRED_CHECKS,
      },
      enforce_admins: true,
      required_pull_request_reviews: {
        dismiss_stale_reviews: true,
        required_approving_review_count: 1,
        require_last_push_approval: false,
      },
      restrictions: null,
      required_linear_history: true,
      allow_force_pushes: false,
      allow_deletions: false,
      block_creations: false,
      required_conversation_resolution: true,
    },
    `Apply branch protection to ${config.name}/${defaultBranch} (1 review, signed commits, linear history, no force-push)`,
    "02-branch-protection"
  );

  // Required signed commits uses POST to enable (DELETE to disable) — not PUT.
  // GitHub REST docs: POST /repos/{owner}/{repo}/branches/{branch}/protection/required_signatures
  ghApiPost(
    `/repos/${config.org}/${config.name}/branches/${defaultBranch}/protection/required_signatures`,
    {},
    `Require signed commits on ${config.name}/${defaultBranch}`,
    "02b-required-signed-commits"
  );
}

function step03_enableSecurity(): void {
  // Secret scanning + push protection
  ghApiPatch(
    `/repos/${config.org}/${config.name}`,
    {
      security_and_analysis: {
        secret_scanning: { status: "enabled" },
        secret_scanning_push_protection: { status: "enabled" },
      },
    },
    "Enable secret scanning + push protection",
    "03a-secret-scanning"
  );

  // Dependabot alerts (vulnerability alerts)
  const depOp = plan(
    "03b-dependabot-alerts",
    "Enable Dependabot vulnerability alerts",
    `gh api --method PUT /repos/${config.org}/${config.name}/vulnerability-alerts`,
    {}
  );
  if (!dryRun) {
    const result = gh([
      "api",
      "--method",
      "PUT",
      `/repos/${config.org}/${config.name}/vulnerability-alerts`,
    ]);
    depOp.status = result.ok ? "executed" : "failed";
    if (!result.ok) depOp.error = result.stderr;
  }

  // Dependabot security updates (automated PRs)
  const autoOp = plan(
    "03c-dependabot-security-updates",
    "Enable Dependabot security updates (automated PRs)",
    `gh api --method PUT /repos/${config.org}/${config.name}/automated-security-fixes`,
    {}
  );
  if (!dryRun) {
    const result = gh([
      "api",
      "--method",
      "PUT",
      `/repos/${config.org}/${config.name}/automated-security-fixes`,
    ]);
    autoOp.status = result.ok ? "executed" : "failed";
    if (!result.ok) autoOp.error = result.stderr;
  }

  // Private vulnerability reporting — requires the dedicated endpoint, not a repo PATCH field.
  // Ref: https://docs.github.com/en/rest/repos/repos#enable-private-vulnerability-reporting-for-a-repository
  ghApiPut(
    `/repos/${config.org}/${config.name}/private-vulnerability-reporting`,
    {},
    "Enable private vulnerability reporting",
    "03d-private-vuln-reporting"
  );
}

function step04_codeqlDefaultSetup(): void {
  // CodeQL default-setup is required (NOT advanced-only) because
  // the code_scanning ruleset rule requires default-setup.
  // Ref: memory/reference_github_code_scanning_ruleset_rule_requires_default_setup.md
  ghApiPatch(
    `/repos/${config.org}/${config.name}/code-scanning/default-setup`,
    {
      state: "configured",
      query_suite: "default",
    },
    "Enable CodeQL default-setup (required for code_scanning ruleset rule — advanced-only fails)",
    "04-codeql-default-setup"
  );
}

function step05_forkToAcehack(): void {
  // Product repos are NOT mirrored to AceHack — AceHack is the factory backup
  // mirror only. Per ADR 2026-05-14-product-repo-split-decisions.md.
  if (config.isProduct) {
    plan(
      "05-fork-to-acehack",
      `Skipped — product repos are not mirrored to ${FORK_ORG} (factory repos only)`,
      "",
      {}
    ).status = "skipped";
    return;
  }
  const op = plan(
    "05-fork-to-acehack",
    `Fork ${config.org}/${config.name} → ${FORK_ORG}/${config.name}`,
    `gh api --method POST /repos/${config.org}/${config.name}/forks --field organization=${FORK_ORG}`,
    { organization: FORK_ORG }
  );
  if (!dryRun) {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh CLI is PATH-resolved intentionally
    const result = spawnSync(
      "gh",
      [
        "api",
        "--method",
        "POST",
        `/repos/${config.org}/${config.name}/forks`,
        "--field",
        `organization=${FORK_ORG}`,
      ],
      { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
    );
    op.status = result.status === 0 ? "executed" : "failed";
    if (op.status === "failed") op.error = result.stderr;
  }
}

function step06_pushScaffoldFiles(): void {
  // repoArg is validated by the process.exit(1) guard above; TS doesn't narrow module-level vars in nested functions.
  const scaffoldPath = join(SCAFFOLD_DIR, repoArg as string);
  if (!existsSync(scaffoldPath)) {
    plan(
      "06-push-scaffold-files",
      `No scaffold directory found at ${scaffoldPath} — skipping file push`,
      "",
      {}
    ).status = "skipped";
    return;
  }

  // Enumerate scaffold files
  const files = collectFiles(scaffoldPath);
  const op = plan(
    "06-push-scaffold-files",
    `Push ${files.length} scaffold files to ${config.org}/${config.name} via git`,
    `git clone + git add + git commit + git push`,
    { files: files.map((f) => relative(scaffoldPath, f)) }
  );

  if (!dryRun) {
    // Clone, copy files, commit, push
    const tmpDir = `/tmp/scaffold-${config.name}-${Date.now()}`;
    const cloneResult = gh([
      "repo",
      "clone",
      `${config.org}/${config.name}`,
      tmpDir,
    ]);
    if (!cloneResult.ok) {
      op.status = "failed";
      op.error = `Clone failed: ${cloneResult.stderr}`;
      return;
    }

    // New empty repos have no commits and no branches — ensure we're on the default branch.
    const gitOpts = { cwd: tmpDir, encoding: "utf8" as const };
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git is PATH-resolved intentionally
    const checkoutResult = spawnSync("git", ["checkout", "-b", defaultBranch], gitOpts);
    if (checkoutResult.status !== 0) {
      const stderr = checkoutResult.stderr?.toString() ?? "";
      const alreadyExists = stderr.includes("already exists") || stderr.includes("already checked out");
      if (!alreadyExists) {
        op.status = "failed";
        op.error = `git checkout -b ${defaultBranch} failed: ${stderr}`;
        rmSync(tmpDir, { recursive: true, force: true });
        return;
      }
      // Branch already exists (non-empty repo clone) — expected; continue.
    }

    // Copy files using native fs — avoids PATH-resolved mkdir/cp subprocesses.
    for (const src of files) {
      const rel = relative(scaffoldPath, src);
      const dst = join(tmpDir, rel);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
    }

    // Commit and push — check each step's exit code.
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git is PATH-resolved intentionally
    const addResult = spawnSync("git", ["add", "-A"], gitOpts);
    if (addResult.status !== 0) {
      op.status = "failed";
      op.error = `git add failed: ${addResult.stderr ?? ""}`;
      rmSync(tmpDir, { recursive: true, force: true });
      return;
    }

    // Set git identity so commit doesn't fail on machines with no global git config.
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git is PATH-resolved intentionally
    spawnSync("git", ["config", "user.email", "scaffold@lucent-financial-group.github.io"], gitOpts);
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git is PATH-resolved intentionally
    spawnSync("git", ["config", "user.name", "LFG Scaffold"], gitOpts);

    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git is PATH-resolved intentionally
    const commitResult = spawnSync(
      "git",
      [
        "commit",
        "-m",
        `chore(scaffold): day-one governance files\n\nB-0424 Stage 1 — three-repo split scaffolding.\nSee docs/DECISIONS/2026-04-22-three-repo-split-zeta-forge-ace.md`,
      ],
      gitOpts
    );
    if (commitResult.status !== 0) {
      op.status = "failed";
      op.error = `git commit failed: ${commitResult.stderr ?? ""}`;
      rmSync(tmpDir, { recursive: true, force: true });
      return;
    }

    // Push HEAD as the default branch (detected from repo API after creation, or "main" in dry-run).
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git is PATH-resolved intentionally
    const push = spawnSync("git", ["push", "--set-upstream", "origin", `HEAD:${defaultBranch}`], gitOpts);
    op.status = push.status === 0 ? "executed" : "failed";
    if (op.status === "failed") op.error = push.stderr ?? "";

    // Cleanup — use fs.rmSync to avoid PATH-resolved rm and reduce blast radius
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

function step07_summary(): void {
  // Gate the Semgrep wiring instruction on whether .semgrep.yml is actually
  // present in the scaffold. Product repos (e.g. civsim) intentionally omit it;
  // emitting the instruction for them would produce a runbook that fails on copy.
  // Use repoArg (the CLI key, e.g. "forge") not config.name (e.g. "Forge") so the
  // directory lookup matches the on-disk scaffold path structure.
  const scaffoldPath = join(SCAFFOLD_DIR, repoArg as string);
  const hasSemgrep = existsSync(join(scaffoldPath, ".semgrep.yml"));

  const baseSteps = [
    "Upload SVG social-preview PNG via GitHub UI (GitHub requires rasterized PNG format)",
    "Enable merge queue via GitHub UI: Settings → Merge queue (org feature, no API)",
    ...(hasSemgrep
      ? ["Wire gate workflow: add `semgrep --config .semgrep.yml --error --metrics=off` step (.semgrep.yml is in scaffold files; CI job still needs wiring in Stage 2)"]
      : []),
    "Add bun-test, bun-lint, codeql, scorecard as required status checks AFTER CI workflows are wired (branch protection was created with empty contexts to avoid deadlock)",
    "Verify budget caps $0 at org level: github.com/organizations/Lucent-Financial-Group/settings/billing",
    "Confirm CodeQL default-setup is active: Security → Code scanning → Default setup",
  ];
  const claimItem = config.backlogItem ?? "<B-NNNN>";
  const productSteps = config.isProduct
    ? [
        "Wire repository_dispatch subscription: configure Forge CI to emit release-tag events to this repo (glue mechanism Stage 1, per ADR 2026-05-14-product-repo-glue-mechanism.md)",
        "Update .zeta-version pin file to the actual current Zeta main SHA after repo creation",
        `Release bus claim: bun tools/bus/claim.ts release --from <agent> --item ${claimItem}`,
      ]
    : [];
  plan(
    "07-next-steps",
    "Manual steps required after this tool completes",
    "",
    { manualSteps: [...baseSteps, ...productSteps] }
  ).status = "planned";
}

// --- Main ---

step01_createRepo();
// Abort in --apply mode if repo creation failed — avoid mutating an existing or partial repository.
if (!dryRun && ops.some((o) => o.step === "01-create-repo" && o.status === "failed")) {
  const failedResult: RunResult = {
    repo: `${config.org}/${config.name}`,
    dryRun,
    operations: ops,
    summary: `ABORTED — step 01 (create-repo) failed; subsequent steps skipped to avoid mutating an existing repository.`,
  };
  console.log(JSON.stringify(failedResult, null, 2));
  process.exit(1);
}
step06_pushScaffoldFiles(); // must run before branch protection to allow direct push to default branch
step02_branchProtection();
step03_enableSecurity();
step04_codeqlDefaultSetup();
step05_forkToAcehack();
step07_summary();

const failed = ops.filter((o) => o.status === "failed").length;
const executed = ops.filter((o) => o.status === "executed").length;
const planned = ops.filter((o) => o.status === "planned").length;

const result: RunResult = {
  repo: `${config.org}/${config.name}`,
  dryRun,
  operations: ops,
  summary: dryRun
    ? `DRY RUN — ${planned} operations planned for ${config.org}/${config.name}. Pass --apply to execute.`
    : `${executed} executed, ${failed} failed out of ${ops.length} total operations.`,
};

console.log(JSON.stringify(result, null, 2));

if (!dryRun && failed > 0) {
  process.exit(1);
}
