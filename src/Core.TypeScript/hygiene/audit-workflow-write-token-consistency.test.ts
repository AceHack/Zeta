// Falsifiers for audit-workflow-write-token-consistency.ts.
//
// The audit exists because ONE step disagreeing with its neighbours about which credential to
// use silently stopped ~97% of merged PRs from ever being archived. These tests pin the
// judgement itself, on the LITERAL pre-fix and post-fix text, so the check cannot rot into
// something that passes on the content it was written to catch.

import { describe, expect, test } from "bun:test";
import {
  ghTokenExpr,
  isForgeWrite,
  judgeStep,
  parseSteps,
  patSecretsIn,
  stripComments,
} from "./audit-workflow-write-token-consistency";

const PATS = ["ZETA_PR_ARCHIVE_TOKEN", "ZETA_TELEMETRY_FLUSH_TOKEN"];

/** Verbatim shape of the defect, as it stood on main until 2026-08-25. */
const PRE_FIX = `      - name: Auto-merge clean PRs (agent-to-agent value transfer)
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          AGENT: \${{ matrix.agent }}
        run: |
          for PR in $CANDIDATES; do
            if gh pr merge "$PR" --squash --auto --delete-branch 2>&1; then
              echo armed
            fi
          done
`;

/** The repaired shape: PAT first, GITHUB_TOKEN kept as an explicit, loud fallback. */
const POST_FIX = `      - name: Auto-merge clean PRs (agent-to-agent value transfer)
        env:
          GH_TOKEN: \${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.ZETA_PR_ARCHIVE_TOKEN || secrets.GITHUB_TOKEN }}
          FALLBACK_GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          AGENT: \${{ matrix.agent }}
        run: |
          MERGE_OUT=$(gh pr merge "$PR" --squash --auto --delete-branch 2>&1)
`;

describe("the defect it was written to catch", () => {
  test("PRE-FIX content is a finding", () => {
    const [step] = parseSteps(PRE_FIX);
    expect(judgeStep(step!, PATS)).toBe("gh pr merge (arms or performs a merge)");
  });

  test("POST-FIX content is clean", () => {
    const [step] = parseSteps(POST_FIX);
    expect(judgeStep(step!, PATS)).toBeNull();
  });

  // The whole repair depends on this distinction. FALLBACK_GH_TOKEN is deliberately a bare
  // GITHUB_TOKEN — it is the measured degradation path for a PAT that lacks
  // enablePullRequestAutoMerge. An audit that flagged it would forbid the fix.
  test("a bare GITHUB_TOKEN in FALLBACK_GH_TOKEN alone does not trip it", () => {
    expect(POST_FIX).toContain("FALLBACK_GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
    const [step] = parseSteps(POST_FIX);
    expect(judgeStep(step!, PATS)).toBeNull();
  });
});

describe("scope — condition 3 keeps this a consistency check, not a policy", () => {
  // accelerator-move-next.yml uses GITHUB_TOKEN *because* of the no-re-trigger property and
  // documents it. A repo-wide "always use a PAT" rule would be wrong there.
  test("no PAT anywhere in the file means no finding", () => {
    const [step] = parseSteps(PRE_FIX);
    expect(judgeStep(step!, [])).toBeNull();
  });

  test("a step that sets no GH_TOKEN is out of scope", () => {
    const noEnv = `      - name: push it
        run: |
          gh pr create --fill
`;
    const [step] = parseSteps(noEnv);
    expect(ghTokenExpr(step!.body)).toBeNull();
    expect(judgeStep(step!, PATS)).toBeNull();
  });

  test("a read-only step with a bare token is not a finding", () => {
    const readOnly = `      - name: Verify required tooling
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          gh auth status
`;
    const [step] = parseSteps(readOnly);
    expect(isForgeWrite(step!)).toBe(false);
    expect(judgeStep(step!, PATS)).toBeNull();
  });
});

describe("write-op recognition", () => {
  // Most PRs in this repo are NOT opened by `gh pr create`; they are opened by
  // flush-via-staging.ts using the step's GH_TOKEN. Matching only the gh CLI would leave the
  // largest PR-producing population unchecked — compliance that constrains nothing.
  test("flush-via-staging.ts flush counts as a forge write", () => {
    const flush = `      - name: Flush to main via staging branch + PR
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          bun src/Core.TypeScript/forge-host/github/flush-via-staging.ts flush --lane x
`;
    const [step] = parseSteps(flush);
    expect(judgeStep(step!, PATS)).toBe("flush-via-staging.ts flush (pushes a branch, opens a PR)");
  });

  test("`prepare` is local-only and is not a forge write", () => {
    const prep = `      - name: Prepare staging working tree
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: bun src/Core.TypeScript/forge-host/github/flush-via-staging.ts prepare --lane x
`;
    expect(isForgeWrite(parseSteps(prep)[0]!)).toBe(false);
  });

  test("a mutating gh api call counts; a plain read does not", () => {
    const mut = `      - name: x
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: gh api -X PATCH repos/o/r/pulls/1
`;
    const read = `      - name: y
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: gh api "repos/{owner}/{repo}/pulls?state=open"
`;
    expect(judgeStep(parseSteps(mut)[0]!, PATS)).toBe("gh api with a mutating method");
    expect(judgeStep(parseSteps(read)[0]!, PATS)).toBeNull();
  });

  // These workflows carry very long comment blocks that discuss `gh pr create` in prose. A
  // scanner that read those as code would fire on files it had no business failing.
  test("a write op mentioned only in a full-line comment is not code", () => {
    const commented = `      - name: z
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          # This step used to run \`gh pr create\` and that is why it broke.
          echo hi
`;
    expect(stripComments(commented)).not.toContain("gh pr create");
    expect(judgeStep(parseSteps(commented)[0]!, PATS)).toBeNull();
  });
});

describe("mechanics", () => {
  test("patSecretsIn finds PATs and never counts GITHUB_TOKEN as one", () => {
    expect(patSecretsIn("${{ secrets.ZETA_PR_ARCHIVE_TOKEN || secrets.GITHUB_TOKEN }}")).toEqual([
      "ZETA_PR_ARCHIVE_TOKEN",
    ]);
    expect(patSecretsIn("${{ secrets.GITHUB_TOKEN }}")).toEqual([]);
  });

  test("parseSteps splits on `- name:` and stops at the next step", () => {
    const steps = parseSteps(`${PRE_FIX}      - name: Next thing\n        run: echo hi\n`);
    expect(steps).toHaveLength(2);
    expect(steps[0]!.name).toBe("Auto-merge clean PRs (agent-to-agent value transfer)");
    expect(steps[0]!.body).not.toContain("Next thing");
    expect(steps[1]!.name).toBe("Next thing");
  });

  test("the real agent-heartbeat.yml is clean — the audit runs against live content", () => {
    const text = require("node:fs").readFileSync(".github/workflows/agent-heartbeat.yml", "utf8");
    const pats = patSecretsIn(text);
    expect(pats.length).toBeGreaterThan(0);
    const steps = parseSteps(text);
    expect(steps.filter(isForgeWrite).length).toBeGreaterThan(0);
    expect(steps.map((s) => judgeStep(s, pats)).filter((v) => v !== null)).toEqual([]);
  });
});
