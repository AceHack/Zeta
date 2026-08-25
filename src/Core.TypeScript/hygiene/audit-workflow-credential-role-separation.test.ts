// audit-workflow-credential-role-separation.test.ts — falsifiers for AH003.
//
// The controlling fixtures are THE ACTUAL DEFECT, reproduced byte-for-byte from
// `.github/workflows/` as it stood on `main` at 43aaa4369d (2026-08-25) — both shapes,
// the 3-secret chain (15 sites) and the 2-secret chain (10 sites). A control that does
// not reconstruct the real defect proves the checker runs, not that it works.
//
// The audit was run against the unfixed tree before this test was written and exited 1
// on all 25 sites; these fixtures are the pinned, in-repo form of that control, so the
// evidence survives the tree being fixed.

import { describe, expect, it } from "bun:test";
import { auditWorkflow, main, renderHuman, runAudit } from "./audit-workflow-credential-role-separation";

/** Verbatim: agent-heartbeat.yml:1567 on unfixed main — the 3-secret shape. */
const THREE_SECRET_CHAIN = `
      - name: Flush to main (staging branch + checked squash-merge PR)
        env:
          AGENT: \${{ matrix.agent }}
          GH_TOKEN: \${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.ZETA_PR_ARCHIVE_TOKEN || secrets.GITHUB_TOKEN }}
          FALLBACK_GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: echo hi
`;

/** Verbatim: tick-metrics.yml:97 on unfixed main — the 2-secret shape, on a `with:`. */
const TWO_SECRET_CHAIN = `
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: true
          token: \${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.GITHUB_TOKEN }}
`;

describe("AH003 — a `||` chain that collapses three credential roles", () => {
  it("CATCHES the real 3-secret chain and names every secret in it", () => {
    const { findings } = auditWorkflow("agent-heartbeat.yml", THREE_SECRET_CHAIN);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.secrets).toEqual(["ZETA_TELEMETRY_FLUSH_TOKEN", "ZETA_PR_ARCHIVE_TOKEN", "GITHUB_TOKEN"]);
    expect(findings[0]?.file).toBe("agent-heartbeat.yml");
  });

  it("CATCHES the real 2-secret chain on a `with:` block, not just `env:`", () => {
    // `token:` under actions/checkout is a `with:` input, and it is the BRANCH-PUSH
    // credential. An audit that only looked at `env:` would miss 10 of the 25 sites.
    const { findings } = auditWorkflow("tick-metrics.yml", TWO_SECRET_CHAIN);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.secrets).toEqual(["ZETA_TELEMETRY_FLUSH_TOKEN", "GITHUB_TOKEN"]);
  });

  it("reports the line of the offending expression, not the file head", () => {
    const { findings } = auditWorkflow("f.yml", TWO_SECRET_CHAIN);
    const lines = TWO_SECRET_CHAIN.split("\n");
    const expected = lines.findIndex((l) => l.includes("token: ")) + 1;
    expect(findings[0]?.line).toBe(expected);
  });
});

describe("AH003 — what it must NOT flag", () => {
  it("clears the FIXED site: one secret, one role", () => {
    const fixed = `
        env:
          GH_TOKEN: \${{ secrets.ZETA_PR_ARCHIVE_TOKEN }}
          FALLBACK_GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;
    expect(auditWorkflow("f.yml", fixed).findings).toHaveLength(0);
  });

  it("clears an `||` that selects on an EVENT rather than on a secret being empty", () => {
    // search-index-cadence.yml's real fix: the `pull_request` self-test never publishes,
    // so it takes the Actions identity. One `secrets.` reference; the choice is made on
    // the event, which is legible, not on a credential silently being empty.
    const eventSelected = `
          token: \${{ github.event_name == 'pull_request' && github.token || secrets.ZETA_TELEMETRY_FLUSH_TOKEN }}
`;
    expect(auditWorkflow("f.yml", eventSelected).findings).toHaveLength(0);
  });

  it("clears a workflow that DOCUMENTS the removed ladder in a comment", () => {
    // Load-bearing. Several fixed workflows quote the exact expression they no longer
    // use, so the history survives the fix. A check that cannot tell a description from a
    // use would make its own fix unlandable — and would then be disabled, not obeyed.
    const documented = `
        env:
          # The \`||\` chain removed from here read:
          #   \${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.ZETA_PR_ARCHIVE_TOKEN || secrets.GITHUB_TOKEN }}
          GH_TOKEN: \${{ secrets.ZETA_PR_ARCHIVE_TOKEN }}
`;
    expect(auditWorkflow("f.yml", documented).findings).toHaveLength(0);
  });

  it("does NOT exempt a chain merely because a comment sits on the SAME line", () => {
    // The carve-out above is scoped to lines whose FIRST token is `#`. A trailing comment
    // does not make the expression before it inert, and treating it as exempt would hand
    // anyone a one-character bypass.
    const trailing = `
          GH_TOKEN: \${{ secrets.A_TOKEN || secrets.B_TOKEN }}  # ladder
`;
    expect(auditWorkflow("f.yml", trailing).findings).toHaveLength(1);
  });

  it("does NOT exempt a chain inside a shell `echo` — GitHub interpolates before bash runs", () => {
    const inShell = `
        run: |
          echo "\${{ secrets.A_TOKEN || secrets.B_TOKEN }}"
`;
    expect(auditWorkflow("f.yml", inShell).findings).toHaveLength(1);
  });

  it("ignores expressions with no secret at all", () => {
    const noSecret = `
          FOO: \${{ github.event.inputs.note || '' }}
          BAR: \${{ github.token }}
`;
    const r = auditWorkflow("f.yml", noSecret);
    expect(r.findings).toHaveLength(0);
    expect(r.credentialExpressions).toBe(0);
  });

  it("counts single-secret expressions so the OK line cannot be vacuously green", () => {
    // A zero-finding result over zero credential expressions would mean the scan found
    // nothing to check. The denominator is reported for exactly that reason.
    const single = `
          GH_TOKEN: \${{ secrets.ZETA_PR_ARCHIVE_TOKEN }}
`;
    expect(auditWorkflow("f.yml", single).credentialExpressions).toBe(1);
  });
});

describe("AH003 — the live tree", () => {
  it("scans a non-trivial number of real credential expressions", () => {
    const r = runAudit();
    expect(r.workflowsScanned).toBeGreaterThan(50);
    // 93 on the fixed tree at the time of writing. The floor is what matters: if this
    // ever drops to 0 the audit has stopped finding credentials to judge, and green
    // would mean nothing.
    expect(r.credentialExpressions).toBeGreaterThan(50);
  });

  it("is GREEN on this repository — every credential expression names one secret", () => {
    const r = runAudit();
    expect(r.findings).toEqual([]);
    expect(main([])).toBe(0);
  });

  it("renders an actionable message that names the role table and every role", () => {
    const text = renderHuman({
      workflowsScanned: 1,
      credentialExpressions: 1,
      findings: [{ file: "f.yml", line: 3, secrets: ["A", "B"], expression: "${{ secrets.A || secrets.B }}" }],
    });
    expect(text).toContain("ROLE COLLAPSE");
    expect(text).toContain("ZETA_TELEMETRY_FLUSH_TOKEN");
    expect(text).toContain("ZETA_PR_ARCHIVE_TOKEN");
    expect(text).toContain("ZETA_SOCIETY_DISPATCH_TOKEN");
    expect(text).toContain("2026-08-17-society-heartbeat-token-boundary-and-gate-start-failure.md");
    expect(text).toContain("f.yml:3");
  });

  it("exits 2 — not 0 and not 1 — when the workflow directory is absent", () => {
    // exit 2 is "the check did not run". Collapsing it into 0 would be the failure this
    // whole change set is about: a check that did not run looking like one that passed.
    const prev = process.env["REPO_ROOT"];
    process.env["REPO_ROOT"] = "/nonexistent-zeta-root-for-ah003";
    try {
      expect(main([])).toBe(2);
    } finally {
      if (prev === undefined) delete process.env["REPO_ROOT"];
      else process.env["REPO_ROOT"] = prev;
    }
  });
});
