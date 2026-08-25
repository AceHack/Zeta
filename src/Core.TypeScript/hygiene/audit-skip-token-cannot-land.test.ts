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

// ===========================================================================================
// THE ECHO-BUILT MESSAGE — the hole that made AH002 vacuous for the one live offender
// ===========================================================================================
//
// The `echo` exemption was written so a workflow could DOCUMENT the ban without tripping the
// check. It also exempted the standard idiom for BUILDING a commit message:
//
//     { echo "subject [skip ci]"; echo; echo "body"; } | git commit --file=-
//
// so the check could not see the message it exists to read. The fixture below is
// `zetadb-scheduled-node.yml` as it stood on `main` at a6bfe4f14 (2026-08-25), reduced to the
// two load-bearing lines. Under the pre-fix detector it produced ZERO findings; that lane was
// the only skip-token-plus-push-at-main lane on `main` at the time, so AH002's green was
// entirely vacuous.
//
// Both directions are pinned. Deleting the narrowing turns THE_ECHO_BUILT_DEFECT green again;
// widening it to "any echo counts" turns the documentation tests above red. The check has to
// live between them, and these tests are the two walls.
const THE_ECHO_BUILT_DEFECT = `
      - name: Commit checkpoint if changed
        run: |
          git add data/zetadb/checkpoint.json
          {
            echo "db(zetadb): fold scheduled journal [skip ci]"
            echo
            echo "The scheduled executor folded newly admitted events."
          } | git commit --file=-
          for attempt in 1 2 3 4 5; do
            git pull --rebase origin main
            if git push origin HEAD:main; then
              break
            fi
          done
`;

describe("AH002 — a skip token built by `echo` is still a skip token", () => {
  it("CATCHES the real zetadb-scheduled-node defect (regression: it did not)", () => {
    const found = auditWorkflow("zetadb-scheduled-node.yml", THE_ECHO_BUILT_DEFECT);
    expect(found).toHaveLength(1);
    expect(found[0]?.snippet).toBe("if git push origin HEAD:main; then");
  });

  it("is decided by the SINK, not by the spelling of the message line", () => {
    // The falsifier for the fix being cosmetic. Pre-fix, changing this one `echo` to
    // `printf` flipped the verdict from clean to caught — a check whose answer depends on
    // which builtin writes the same bytes is not reading the message, it is reading the
    // syntax. Post-fix the two spellings must agree.
    const printfSpelling = THE_ECHO_BUILT_DEFECT.replace(
      'echo "db(zetadb): fold scheduled journal [skip ci]"',
      'printf "db(zetadb): fold scheduled journal [skip ci]"',
    );
    expect(printfSpelling).not.toBe(THE_ECHO_BUILT_DEFECT);
    expect(auditWorkflow("t.yml", printfSpelling)).toEqual(auditWorkflow("t.yml", THE_ECHO_BUILT_DEFECT));
  });

  it("recognises `-F -` as well as `--file=-`", () => {
    const dashF = THE_ECHO_BUILT_DEFECT.replace("git commit --file=-", "git commit -F -");
    expect(auditWorkflow("t.yml", dashF).length).toBeGreaterThan(0);
  });

  it("recognises the sink through `git -c` options", () => {
    const withC = THE_ECHO_BUILT_DEFECT.replace("git commit --file=-", "git -c core.editor=true commit --file=-");
    expect(auditWorkflow("t.yml", withC).length).toBeGreaterThan(0);
  });

  it("still exempts an echo in a block with NO stdin message sink", () => {
    // The narrowing must not become "any echo counts". A lane that commits with `-m` and
    // merely NARRATES the token in an echo is not building a skip-token commit.
    const narrates = `
      - name: Flush
        run: |
          echo "NOTE: a [skip ci] token here would stop gate reporting"
          git commit -m "chore: telemetry frame"
          git push origin HEAD:main
`;
    expect(auditWorkflow("narrates.yml", narrates)).toHaveLength(0);
  });

  it("does not let a COMMENT mentioning the sink arm the block", () => {
    // `# … | git commit --file=-` inside a comment is documentation, not a sink. If a
    // comment could arm the block, documenting the idiom would flip an innocent lane red —
    // the same punish-the-documentation failure the comment tests above guard against.
    const commentedSink = `
      - name: Flush
        run: |
          # The old shape was: { echo "x [skip ci]"; } | git commit --file=-
          echo "subject [skip ci] is refused by flush-via-staging"
          git commit -m "chore: telemetry frame"
          git push origin HEAD:main
`;
    expect(auditWorkflow("commented.yml", commentedSink)).toHaveLength(0);
  });

  it("names its own limits rather than implying full coverage", () => {
    // HONEST LIMIT, pinned so it cannot rot into an unstated claim. A heredoc and a
    // command-substituted `-m` are two other ways to build a message that this detector
    // does NOT recognise. Neither occurs in this repo today. If one ever does, THIS test is
    // the one to change — and changing it is the deliberate act of admitting new coverage,
    // rather than discovering the gap the way the echo hole was discovered.
    const heredoc = `
      - name: Commit
        run: |
          git commit --file=- <<EOF
          chore: thing [skip ci]
          EOF
          git push origin HEAD:main
`;
    expect(auditWorkflow("heredoc.yml", heredoc)).toHaveLength(1);

    const substituted = `
      - name: Commit
        run: |
          git commit -m "$(build_message)"
          git push origin HEAD:main
`;
    // Not caught — the token is not in the block's text at all. Stated, not claimed away.
    expect(auditWorkflow("subst.yml", substituted)).toHaveLength(0);
  });
});
