import { describe, expect, test } from "bun:test";

import {
  buildInventoryReport,
  EXPECTED_RETAINED_BASH,
  hasDrift,
  renderReport,
  RETAINED_BASH_SCOPE,
} from "./check-bash-retirement-inventory";

function splitExpectedRetained(): readonly [string, readonly string[]] {
  const [missing, ...rest] = EXPECTED_RETAINED_BASH;
  if (missing === undefined) throw new Error("expected retained bash allowlist must be non-empty");
  return [missing, rest];
}

describe("buildInventoryReport", () => {
  test("accepts the retained bash allowlist", () => {
    const report = buildInventoryReport(EXPECTED_RETAINED_BASH);

    expect(hasDrift(report)).toBe(false);
    expect(report.retained).toHaveLength(EXPECTED_RETAINED_BASH.length);
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("flags new post-install bash files as drift", () => {
    const report = buildInventoryReport([...EXPECTED_RETAINED_BASH, "tools/hygiene/new-post-install-wrapper.sh"]);

    expect(hasDrift(report)).toBe(true);
    expect(report.drift.unexpected).toEqual(["tools/hygiene/new-post-install-wrapper.sh"]);
    expect(report.drift.missingRetained).toEqual([]);
  });

  test("flags missing retained bash scripts", () => {
    const [missing, rest] = splitExpectedRetained();
    const report = buildInventoryReport(rest);

    expect(hasDrift(report)).toBe(true);
    expect(report.drift.unexpected).toEqual([]);
    expect(report.drift.missingRetained).toEqual([missing]);
  });
});

describe("renderReport", () => {
  test("renders an OK summary for a matching inventory", () => {
    const report = buildInventoryReport(EXPECTED_RETAINED_BASH);

    expect(renderReport(report)).toContain(
      `OK: retained non-Lean bash surface matches ${RETAINED_BASH_SCOPE} allowlist.`,
    );
  });

  test("renders drift sections", () => {
    const [missing, rest] = splitExpectedRetained();
    const report = buildInventoryReport([...rest, "tools/hygiene/new-post-install-wrapper.sh"]);
    const rendered = renderReport(report);

    expect(rendered).toContain("## Unexpected non-Lean bash files");
    expect(rendered).toContain("tools/hygiene/new-post-install-wrapper.sh");
    expect(rendered).toContain(`## Missing retained ${RETAINED_BASH_SCOPE} files`);
    expect(rendered).toContain(missing);
  });
});
