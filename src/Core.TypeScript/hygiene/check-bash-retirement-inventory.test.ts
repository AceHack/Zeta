import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  buildInventoryReport,
  hasDrift,
  renderReport,
  EXPECTED_RETAINED_SHELL,
  RETAINED_SHELL_SCOPE,
  trackedNonLeanShellFilesFromGit,
} from "./check-bash-retirement-inventory";

function runGit(args: readonly string[], cwd: string): void {
  // Test helper uses repo-pinned git with explicit argv; no shell expansion.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) {
    throw new Error(`failed to start git ${args.join(" ")}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
}

function splitExpectedRetained(): readonly [string, readonly string[]] {
  const [missing, ...rest] = EXPECTED_RETAINED_SHELL;
  if (missing === undefined) throw new Error("expected retained shell allowlist must be non-empty");
  return [missing, rest];
}

function firstTwoExpectedRetained(): readonly [string, string, readonly string[]] {
  const [first, second, ...rest] = EXPECTED_RETAINED_SHELL;
  if (first === undefined || second === undefined) {
    throw new Error("expected retained shell allowlist must contain at least two entries");
  }
  return [first, second, rest];
}

describe("package.json wiring", () => {
  test("keeps the package wiring pointed at the enforcing inventory guard", () => {
    const packageJsonPath = resolve(import.meta.dir, "../../..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      readonly scripts?: Readonly<Record<string, string>>;
    };

    expect(packageJson.scripts?.["hygiene:check-bash-retirement-inventory"]).toBe(
      "bun ./src/Core.TypeScript/hygiene/check-bash-retirement-inventory.ts --enforce",
    );
  });
});

describe("buildInventoryReport", () => {
  test("accepts the retained shell allowlist", () => {
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL);

    expect(hasDrift(report)).toBe(false);
    expect(report.allowlistIntegrity.duplicateEntries).toEqual([]);
    expect(report.allowlistIntegrity.orderViolations).toEqual([]);
    expect(report.allowlistIntegrity.uncategorizedEntries).toEqual([]);
    expect(report.allowlistIntegrity.staleCategoryEntries).toEqual([]);
    expect(report.retained).toHaveLength(EXPECTED_RETAINED_SHELL.length);
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("flags new post-install shell files as drift", () => {
    const report = buildInventoryReport([...EXPECTED_RETAINED_SHELL, "tools/hygiene/new-post-install-wrapper.sh"]);

    expect(hasDrift(report)).toBe(true);
    expect(report.drift.unexpected).toEqual(["tools/hygiene/new-post-install-wrapper.sh"]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("flags repo-wide shell files outside the allowlist as drift", () => {
    const report = buildInventoryReport([
      ...EXPECTED_RETAINED_SHELL,
      "full-ai-cluster/tools/cluster-inventory/capture.sh",
    ]);

    expect(hasDrift(report)).toBe(true);
    expect(report.drift.unexpected).toEqual(["full-ai-cluster/tools/cluster-inventory/capture.sh"]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("flags missing retained shell scripts", () => {
    const [missing, rest] = splitExpectedRetained();
    const report = buildInventoryReport(rest);

    expect(hasDrift(report)).toBe(true);
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([missing]);
  });

  test("flags duplicate allowlist entries before classifying repo shell drift", () => {
    const [duplicate, rest] = splitExpectedRetained();
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL, [duplicate, duplicate, ...rest]);

    expect(hasDrift(report)).toBe(true);
    expect(report.allowlistIntegrity.duplicateEntries).toEqual([duplicate]);
    expect(report.allowlistIntegrity.orderViolations).toEqual([]);
    expect(report.allowlistIntegrity.uncategorizedEntries).toEqual([]);
    expect(report.allowlistIntegrity.staleCategoryEntries).toEqual([]);
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("flags unsorted allowlist entries before classifying repo shell drift", () => {
    const [first, second, rest] = firstTwoExpectedRetained();
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL, [second, first, ...rest]);

    expect(hasDrift(report)).toBe(true);
    expect(report.allowlistIntegrity.duplicateEntries).toEqual([]);
    expect(report.allowlistIntegrity.orderViolations).toEqual([{ index: 1, previous: second, current: first }]);
    expect(report.allowlistIntegrity.uncategorizedEntries).toEqual([]);
    expect(report.allowlistIntegrity.staleCategoryEntries).toEqual([]);
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("flags category metadata entries that are no longer retained", () => {
    const [stale, rest] = splitExpectedRetained();
    const report = buildInventoryReport(rest, rest);

    expect(hasDrift(report)).toBe(true);
    expect(report.allowlistIntegrity.duplicateEntries).toEqual([]);
    expect(report.allowlistIntegrity.orderViolations).toEqual([]);
    expect(report.allowlistIntegrity.uncategorizedEntries).toEqual([]);
    expect(report.allowlistIntegrity.staleCategoryEntries).toEqual([stale]);
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("flags retained allowlist entries without category metadata", () => {
    const uncategorized = "tools/setup/zz-new-bootstrap.sh";
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL, [...EXPECTED_RETAINED_SHELL, uncategorized]);

    expect(hasDrift(report)).toBe(true);
    expect(report.allowlistIntegrity.duplicateEntries).toEqual([]);
    expect(report.allowlistIntegrity.orderViolations).toEqual([]);
    expect(report.allowlistIntegrity.uncategorizedEntries).toEqual([uncategorized]);
    expect(report.allowlistIntegrity.staleCategoryEntries).toEqual([]);
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("summarizes retained shell files by explicit category", () => {
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL);

    const firstCategory = report.retainedCategories[0];
    expect(firstCategory).toBeDefined();
    if (firstCategory) {
      expect(firstCategory.category).toBe("setup/bootstrap");
      expect(firstCategory.files).toContain("tools/setup/install.sh");
      expect(firstCategory.files).toContain("tools/setup/common/mise.sh");
    }

    expect(report.retainedCategories.slice(1)).toEqual([
      {
        category: "git hooks",
        files: [
          "githooks/pre-push",
          "scripts/hooks/commit-msg",
          "scripts/hooks/install-git-hooks.sh",
          "scripts/hooks/pre-push",
        ],
      },
      {
        category: "host-service wrappers",
        files: [
          ".gemini/service/install-lior-service.sh",
          ".gemini/service/lior-loop.sh",
          // systemd ExecStart on a NixOS cluster node, ordered before
          // k3s.service. The node's closure carries no bun, so the boot path
          // is a retained-shell edge.
          "full-ai-cluster/nixos/modules/k3s-datastore-preflight.sh",
        ],
      },
      {
        category: "nixos installer",
        files: [
          "full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh",
          "full-ai-cluster/usb-nixos-installer/zeta-install.sh",
          "tools/installer/zeta-self-register.sh",
        ],
      },
    ]);
    expect(report.retainedCategories.flatMap((summary) => summary.files)).toHaveLength(EXPECTED_RETAINED_SHELL.length);
  });

  test("matches the current tracked repo shell inventory", () => {
    const report = buildInventoryReport(trackedNonLeanShellFilesFromGit());

    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("enumerates tracked shell-family files while excluding Lean vendor scripts", () => {
    const repo = mkdtempSync(join(tmpdir(), "zeta-bash-retirement-"));
    try {
      runGit(["init"], repo);

      mkdirSync(join(repo, "db", "tools"), { recursive: true });
      mkdirSync(join(repo, "docs", "recovered-orphan-branches-2026-05", "tools"), { recursive: true });
      mkdirSync(join(repo, "scripts"), { recursive: true });
      mkdirSync(join(repo, "tools", "lean4"), { recursive: true });
      writeFileSync(join(repo, "db", "tools", "generated.sh"), "#!/usr/bin/env bash\n");
      writeFileSync(join(repo, "db", "tools", "generated-extensionless"), "#!/usr/bin/env bash\n");
      writeFileSync(
        join(repo, "docs", "recovered-orphan-branches-2026-05", "tools", "historical.sh"),
        "#!/usr/bin/env bash\n",
      );
      writeFileSync(
        join(repo, "docs", "recovered-orphan-branches-2026-05", "tools", "historical-extensionless"),
        "#!/usr/bin/env bash\n",
      );
      writeFileSync(join(repo, "scripts", "a.sh"), "#!/usr/bin/env bash\n");
      writeFileSync(join(repo, "scripts", "a-uppercase.SH"), "echo uppercase extension drift\n");
      writeFileSync(join(repo, "scripts", "b.bash"), "#!/usr/bin/env bash\n");
      writeFileSync(join(repo, "scripts", "b-uppercase.BASH"), "echo uppercase extension drift\n");
      writeFileSync(join(repo, "scripts", "c.zsh"), "#!/usr/bin/env zsh\n");
      writeFileSync(join(repo, "scripts", "c-uppercase.ZSH"), "echo uppercase extension drift\n");
      writeFileSync(join(repo, "scripts", "d.ksh"), "#!/usr/bin/env ksh\n");
      writeFileSync(join(repo, "scripts", "d-uppercase.KSH"), "echo uppercase extension drift\n");
      writeFileSync(join(repo, "scripts", "e.command"), "#!/usr/bin/env bash\n");
      writeFileSync(join(repo, "scripts", "e-uppercase.COMMAND"), "echo uppercase extension drift\n");
      writeFileSync(join(repo, "scripts", "extensionless-bash"), "#!/usr/bin/env bash\n");
      writeFileSync(join(repo, "scripts", "extensionless-bash-env-s"), "#!/usr/bin/env -S bash -eu\n");
      writeFileSync(
        join(repo, "scripts", "extensionless-bash-env-s-assignment"),
        "#!/usr/bin/env -S NAME=value bash -eu\n",
      );
      writeFileSync(
        join(repo, "scripts", "extensionless-bash-env-s-quoted-assignment"),
        "#!/usr/bin/env -S 'NAME=two words' bash -eu\n",
      );
      writeFileSync(join(repo, "scripts", "extensionless-bash-env-s-quoted"), '#!/usr/bin/env -S "bash -eu"\n');
      writeFileSync(join(repo, "scripts", "extensionless-bash-env-argv0"), "#!/usr/bin/env -a test-argv0 bash\n");
      writeFileSync(join(repo, "scripts", "extensionless-bash-env-chdir"), "#!/usr/bin/env --chdir /tmp bash\n");
      writeFileSync(join(repo, "scripts", "extensionless-bash-env-path"), "#!/usr/bin/env -P /bin bash\n");
      writeFileSync(
        join(repo, "scripts", "extensionless-zsh-env-split-string-quoted"),
        '#!/usr/bin/env --split-string "zsh -eu"\n',
      );
      writeFileSync(join(repo, "scripts", "extensionless-zsh-env-unset"), "#!/usr/bin/env -u NAME zsh\n");
      writeFileSync(join(repo, "scripts", "extensionless-zsh-env-unset-long"), "#!/usr/bin/env --unset NAME zsh\n");
      writeFileSync(join(repo, "scripts", "extensionless-dash"), "#!/bin/dash\n");
      writeFileSync(join(repo, "scripts", "extensionless-sh"), "#!/bin/sh\n");
      writeFileSync(join(repo, "scripts", "extensionless-bun"), "#!/usr/bin/env bun\n");
      writeFileSync(join(repo, "scripts", "extensionless-node-with-bash-arg"), "#!/usr/bin/env node --loader bash\n");
      writeFileSync(join(repo, "scripts", "extensionless-node-with-sh-arg"), "#!/usr/bin/env node sh\n");
      writeFileSync(
        join(repo, "scripts", "extensionless-node-env-s-bash-arg"),
        "#!/usr/bin/env -S node --loader bash\n",
      );
      writeFileSync(join(repo, "scripts", "dotted-shell-entry.env"), "#!/usr/bin/env bash\n");
      writeFileSync(join(repo, "scripts", "dotted-shell-shebang.txt"), "#!/usr/bin/env bash\n");
      writeFileSync(join(repo, "tools", "lean4", "vendor.sh"), "#!/usr/bin/env bash\n");
      writeFileSync(join(repo, "README.md"), "not shell\n");
      runGit(["add", "."], repo);
      runGit(["update-index", "--chmod=+x", "scripts/dotted-shell-entry.env"], repo);

      expect(trackedNonLeanShellFilesFromGit(repo)).toEqual(
        [
          "scripts/a.sh",
          "scripts/a-uppercase.SH",
          "scripts/b.bash",
          "scripts/b-uppercase.BASH",
          "scripts/c.zsh",
          "scripts/c-uppercase.ZSH",
          "scripts/d.ksh",
          "scripts/d-uppercase.KSH",
          "scripts/dotted-shell-entry.env",
          "scripts/e.command",
          "scripts/e-uppercase.COMMAND",
          "scripts/extensionless-bash",
          "scripts/extensionless-bash-env-argv0",
          "scripts/extensionless-bash-env-chdir",
          "scripts/extensionless-bash-env-path",
          "scripts/extensionless-bash-env-s",
          "scripts/extensionless-bash-env-s-assignment",
          "scripts/extensionless-bash-env-s-quoted-assignment",
          "scripts/extensionless-bash-env-s-quoted",
          "scripts/extensionless-dash",
          "scripts/extensionless-sh",
          "scripts/extensionless-zsh-env-split-string-quoted",
          "scripts/extensionless-zsh-env-unset",
          "scripts/extensionless-zsh-env-unset-long",
        ].sort((a, b) => a.localeCompare(b)),
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe("renderReport", () => {
  test("renders an OK summary for a matching inventory", () => {
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL);

    expect(renderReport(report)).toContain(`OK: retained non-Lean shell surface matches ${RETAINED_SHELL_SCOPE}.`);
    expect(renderReport(report)).toContain("## Retained shell categories");
    const bootstrapCount =
      report.retainedCategories.find((summary) => summary.category === "setup/bootstrap")?.files.length ?? 0;
    expect(renderReport(report)).toContain(`- setup/bootstrap: ${bootstrapCount.toString()}`);
    expect(renderReport(report)).toContain("- git hooks: 4");
    expect(renderReport(report)).toContain("- host-service wrappers: 3");
  });

  test("renders drift sections", () => {
    const [missing, rest] = splitExpectedRetained();
    const report = buildInventoryReport([...rest, "tools/hygiene/new-post-install-wrapper.sh"]);
    const rendered = renderReport(report);

    expect(rendered).toContain("## Unexpected non-Lean shell files");
    expect(rendered).toContain("tools/hygiene/new-post-install-wrapper.sh");
    expect(rendered).toContain(`## Missing retained ${RETAINED_SHELL_SCOPE} files`);
    expect(rendered).toContain(missing);
  });

  test("renders allowlist integrity errors before drift sections", () => {
    const [duplicate, rest] = splitExpectedRetained();
    const rendered = renderReport(buildInventoryReport(EXPECTED_RETAINED_SHELL, [duplicate, duplicate, ...rest]));

    expect(rendered).toContain("## Retained shell allowlist integrity errors");
    expect(rendered).toContain("### Duplicate entries");
    expect(rendered).toContain(duplicate);
    expect(rendered).not.toContain("## Unexpected non-Lean shell files");
  });

  test("renders out-of-order allowlist entries as allowlist integrity errors", () => {
    const [first, second, rest] = firstTwoExpectedRetained();
    const rendered = renderReport(buildInventoryReport(EXPECTED_RETAINED_SHELL, [second, first, ...rest]));

    expect(rendered).toContain("## Retained shell allowlist integrity errors");
    expect(rendered).toContain("unique, sorted, fully categorized");
    expect(rendered).toContain("### Out-of-order entries");
    expect(rendered).toContain(`- index 1: ${second} > ${first}`);
    expect(rendered).not.toContain("## Unexpected non-Lean shell files");
  });

  test("renders stale category map entries as allowlist integrity errors", () => {
    const [stale, rest] = splitExpectedRetained();
    const rendered = renderReport(buildInventoryReport(rest, rest));

    expect(rendered).toContain("## Retained shell allowlist integrity errors");
    expect(rendered).toContain("free of stale category metadata");
    expect(rendered).toContain("### Stale category entries");
    expect(rendered).toContain(stale);
    expect(rendered).not.toContain("## Unexpected non-Lean shell files");
  });

  test("renders uncategorized allowlist entries as allowlist integrity errors", () => {
    const uncategorized = "tools/setup/zz-new-bootstrap.sh";
    const rendered = renderReport(
      buildInventoryReport(EXPECTED_RETAINED_SHELL, [...EXPECTED_RETAINED_SHELL, uncategorized]),
    );

    expect(rendered).toContain("## Retained shell allowlist integrity errors");
    expect(rendered).toContain("fully categorized");
    expect(rendered).toContain("### Missing category entries");
    expect(rendered).toContain(uncategorized);
    expect(rendered).not.toContain(`## Missing retained ${RETAINED_SHELL_SCOPE} files`);
  });
});
