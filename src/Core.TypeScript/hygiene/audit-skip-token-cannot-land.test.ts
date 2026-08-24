// audit-skip-token-cannot-land.test.ts — falsifiers for AH002.
//
// The controlling fixture is THE ACTUAL DEFECT, reproduced byte-for-byte from
// `lockfile-healer.yml` as it stood on `main` at 5223ce912 (2026-08-24). A control that
// does not reconstruct the real defect proves the checker runs, not that it works — and
// a checker whose test cannot fail is the thing this whole audit exists to refuse.

import { describe, expect, it } from "bun:test";
import { auditWorkflow } from "./audit-skip-token-cannot-land";

/** Verbatim from the broken lane: skip token in the message, bare push at main. */
const THE_REAL_DEFECT = `
      - name: Commit and push
        if: steps.detect.outputs.code == '1'
        run: |
          git config user.name "github-actions[bot]"
          git add bun.lock
          git commit -m "fix(deps): regenerate bun.lock (LD001 auto-heal) [skip ci]

          Healed automatically: bun.lock only."
          git pull --rebase --autostash origin main
          git push origin HEAD:main
`;

describe("AH002 — a lane whose push can never land", () => {
  it("CATCHES the real lockfile-healer defect", () => {
    const found = auditWorkflow("lockfile-healer.yml", THE_REAL_DEFECT);
    expect(found).toHaveLength(1);
    expect(found[0]?.snippet).toBe("git push origin HEAD:main");
  });

  it("is NOT satisfied by the rebase that satisfies AH001", () => {
    // The real defect above already contains `git pull --rebase`. AH001 passes on it;
    // AH002 must not. This is the whole reason the two checks are separate — if this
    // test ever passes with zero findings, AH002 has collapsed into AH001.
    expect(THE_REAL_DEFECT).toContain("git pull --rebase");
    expect(auditWorkflow("f.yml", THE_REAL_DEFECT).length).toBeGreaterThan(0);
  });

  it("clears the FIXED lane — flush-via-staging, no token in the message", () => {
    const fixed = `
      - name: Flush the heal to main via staging branch + PR
        # No "[skip ci]" in the message: the flush commit is the PR head, and a skip
        # token there would stop \`gate\` reporting and hang the PR forever.
        run: |
          git config user.name "github-actions[bot]"
          bun src/Core.TypeScript/forge-host/github/flush-via-staging.ts flush \\
            --lane lockfile-healer --paths bun.lock \\
            --message "fix(deps): regenerate bun.lock (LD001 auto-heal)"
`;
    expect(auditWorkflow("fixed.yml", fixed)).toHaveLength(0);
  });

  it("does not flag a workflow that DOCUMENTS the ban in a comment", () => {
    // Both fixed lanes explain the rule in prose. If explaining it tripped the check,
    // the only way to pass would be to delete the explanation — so the check would
    // punish exactly the documentation that prevents the next occurrence.
    const documented = `
      - name: Flush
        run: |
          # This lane used to commit "[skip ci]" and git push origin HEAD:main.
          # That is refused deterministically; do not "simplify" it back.
          git commit -m "chore: telemetry"
          bun flush-via-staging.ts flush --lane drift-sweep
`;
    expect(auditWorkflow("documented.yml", documented)).toHaveLength(0);
  });

  it("does not flag the sanctioned heartbeat route", () => {
    const sanctioned = `
      - name: Park on the staging ref
        run: |
          git commit -m "chore(telemetry): tick [skip ci]"
          git push origin HEAD:refs/heads/heartbeat/tick-metrics
`;
    expect(auditWorkflow("heartbeat.yml", sanctioned)).toHaveLength(0);
  });

  it("catches the other skip-token spellings GitHub honours", () => {
    for (const token of ["[ci skip]", "[skip actions]", "[actions skip]"]) {
      const src = `
      - name: Commit
        run: |
          git commit -m "chore: thing ${token}"
          git push origin main
`;
      expect(auditWorkflow("t.yml", src).length).toBeGreaterThan(0);
    }
  });

  it("does not flag a lane that pushes without creating a commit", () => {
    const pushOnly = `
      - name: Push an existing ref
        run: |
          echo "moving [skip ci] tags"
          git push origin main
`;
    expect(auditWorkflow("pushonly.yml", pushOnly)).toHaveLength(0);
  });
});
