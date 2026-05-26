import { describe, expect, test } from "bun:test";

import {
  buildInventoryReport,
  hasDrift,
  renderReport,
  EXPECTED_RETAINED_SHELL,
  RETAINED_SHELL_SCOPE,
  trackedNonLeanShellFilesFromGit,
} from "./check-bash-retirement-inventory";

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

describe("buildInventoryReport", () => {
  test("accepts the retained shell allowlist", () => {
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL);

    expect(hasDrift(report)).toBe(false);
    expect(report.allowlistIntegrity.duplicateEntries).toEqual([]);
    expect(report.allowlistIntegrity.orderViolations).toEqual([]);
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
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("flags unsorted allowlist entries before classifying repo shell drift", () => {
    const [first, second, rest] = firstTwoExpectedRetained();
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL, [second, first, ...rest]);

    expect(hasDrift(report)).toBe(true);
    expect(report.allowlistIntegrity.duplicateEntries).toEqual([]);
    expect(report.allowlistIntegrity.orderViolations).toEqual([{ index: 1, previous: second, current: first }]);
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("matches the current tracked repo shell inventory", () => {
    const report = buildInventoryReport(trackedNonLeanShellFilesFromGit());

    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });
});

describe("renderReport", () => {
  test("renders an OK summary for a matching inventory", () => {
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL);

    expect(renderReport(report)).toContain(`OK: retained non-Lean shell surface matches ${RETAINED_SHELL_SCOPE}.`);
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
});
