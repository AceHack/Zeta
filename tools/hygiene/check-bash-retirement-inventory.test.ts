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

describe("buildInventoryReport", () => {
  test("accepts the retained shell allowlist", () => {
    const report = buildInventoryReport(EXPECTED_RETAINED_SHELL);

    expect(hasDrift(report)).toBe(false);
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
});
