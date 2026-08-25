// audit-coauthor-identity-collides.test.ts — the falsifier for AH005.
//
// Every fixture below is a REAL string. The two class-1 trailers are copied byte-for-byte
// out of commits on `main` (ba35ba6040 and d6d8ec20e9), and the two class-1 shell lines are
// copied out of the installer sources as they stood before this PR fixed them. A check
// proven only against already-corrected code is the vacuity class; these are the control.
//
// Privacy: the two colliding local-parts belong to uninvolved private individuals. They
// appear here because the audit cannot be shown to catch the live defect without the live
// string, and nowhere else. Nothing is compiled about them and they are never @-mentioned.

import { describe, expect, test } from "bun:test";
import {
  auditText,
  isCommentLine,
  classifyEmail,
  DRIFT_CLASS,
  isScannable,
  renderHuman,
  runAudit,
  SCAN_ROOTS,
  SELF_EXEMPT,
} from "./audit-coauthor-identity-collides";

describe("classifyEmail — the plain-username noreply form (class 1)", () => {
  // Verified live: both local-parts resolve to real, long-standing accounts that have
  // nothing to do with this repository.
  test("the two forms actually on main are refused", () => {
    expect(classifyEmail("shadow@users.noreply.github.com")).toBe("collides-plain-noreply");
    expect(classifyEmail("dejan@users.noreply.github.com")).toBe("collides-plain-noreply");
  });

  test("refusal is case-insensitive — GitHub usernames are", () => {
    expect(classifyEmail("Shadow@Users.NoReply.GitHub.Com")).toBe("collides-plain-noreply");
  });

  test("an interpolated local part is still the plain form", () => {
    expect(classifyEmail("${MAINTAINER}@users.noreply.github.com")).toBe("collides-plain-noreply");
  });

  test("a plain form that happens to name a real collaborator is STILL refused", () => {
    // It resolves correctly today only by luck of the name; the shape is the defect.
    expect(classifyEmail("maximdolphin@users.noreply.github.com")).toBe("collides-plain-noreply");
  });
});

describe("classifyEmail — the safe forms must NOT be flagged", () => {
  test("the [bot] form cannot collide: a GitHub username cannot contain '['", () => {
    for (const e of [
      "otto[bot]@users.noreply.github.com",
      "alexa[bot]@users.noreply.github.com",
      "soraya[bot]@users.noreply.github.com",
      "society[bot]@users.noreply.github.com",
      "shadow[bot]@users.noreply.github.com",
      "zeta-pages-operator[bot]@users.noreply.github.com",
      "github-actions[bot]@users.noreply.github.com",
    ]) {
      expect(classifyEmail(e)).toBe("safe-bot-noreply");
    }
  });

  test("the id-verified form is safe, literal AND interpolated", () => {
    expect(classifyEmail("578953+acehack@users.noreply.github.com")).toBe("safe-id-noreply");
    // The installer fix builds the id at runtime; a digits-only test would reject the fix.
    expect(classifyEmail("${MAINTAINER_ID}+${MAINTAINER}@users.noreply.github.com")).toBe("safe-id-noreply");
    expect(classifyEmail("41898282+github-actions[bot]@users.noreply.github.com")).toBe("safe-id-noreply");
    expect(classifyEmail("49699333+dependabot[bot]@users.noreply.github.com")).toBe("safe-id-noreply");
  });

  test("third-party vendor mailboxes are real addresses and stay clean", () => {
    for (const e of [
      "noreply@anthropic.com",
      "noreply@openai.com",
      "noreply@kiro.dev",
      "noreply@x.ai",
      "noreply@google.com",
      "cursoragent@cursor.com",
      "acehack00@gmail.com",
    ]) {
      expect(classifyEmail(e)).toBe("ok");
    }
  });
});

describe("classifyEmail — fabricated namespaces (class 2, the LESSER issue)", () => {
  test("invented zeta namespaces are reported", () => {
    for (const e of [
      "dejan@zeta.agents",
      "shadow@zeta.agents",
      "otto@zeta.local",
      "noreply@zeta.local",
      "otto-cli@zeta.dev",
      "otto@zeta.factory",
      "lumen@travelers.zeta",
      "otto@lucent-financial-group.invalid",
    ]) {
      expect(classifyEmail(e)).toBe("fabricated-domain");
    }
  });

  test("class 2 is NOT class 1 — an unresolvable domain misattributes to nobody", () => {
    const one = auditText("x.md", "Co-authored-by: shadow <shadow@users.noreply.github.com>");
    const two = auditText("x.md", "Co-authored-by: shadow <shadow@zeta.agents>");
    expect(one.findings[0]?.klass).toBe(1);
    expect(two.findings[0]?.klass).toBe(2);
  });
});

describe("auditText — the live defect, verbatim", () => {
  test("the exact trailer from commit ba35ba6040 is caught and named", () => {
    const r = auditText(
      "fixture-commit-message.txt",
      [
        "fix(agent-heartbeat): data/ci-runs.jsonl add/add wedged all three lanes",
        "",
        "Co-authored-by: shadow <shadow@users.noreply.github.com>",
      ].join("\n"),
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.email).toBe("shadow@users.noreply.github.com");
    expect(r.findings[0]?.klass).toBe(1);
    expect(r.findings[0]?.line).toBe(3);
    expect(r.findings[0]?.origin).toBe("co-author-trailer");
  });

  test("the 404-body-concatenated address on commits bb581641 / 5144b5be is caught", () => {
    // `gh api`'s 404 body reached stdout, `pipefail` fired the `|| echo` fallback anyway,
    // and command substitution captured both. The result is still the plain noreply form.
    const live =
      'Co-authored-by: Addison Stainback <{"message":"Not Found","documentation_url":' +
      '"https://docs.github.com/rest/users/emails#list-email-addresses-for-the-authenticated-user"' +
      ',"status":"404"}Addisons820@users.noreply.github.com>';
    const r = auditText("fixture.txt", live);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.klass).toBe(1);
  });

  test("the exact trailer from commit d6d8ec20e9 is caught and named", () => {
    const r = auditText("fixture.txt", "Co-authored-by: Dejan <dejan@users.noreply.github.com>");
    expect(r.findings[0]?.email).toBe("dejan@users.noreply.github.com");
    expect(r.findings[0]?.klass).toBe(1);
  });

  test("the unfixed installer line (tools/installer/zeta-self-register.sh:584) is caught", () => {
    const preFix =
      'git -c user.name="${MAINTAINER}" -c user.email="${MAINTAINER}@users.noreply.github.com" \\\n' +
      '    commit -q -m "feat(node-register): ${HOST} self-registers"';
    const r = auditText("tools/installer/zeta-self-register.sh", preFix);
    expect(r.findings.some((f) => f.klass === 1)).toBe(true);
  });

  test("the unfixed USB-installer line, where the address is built into a variable, is caught", () => {
    // This one evaded the two positional patterns; the bare-domain extractor is why it does not now.
    const preFix =
      "        OP_EMAIL=$(gh api /user/emails --jq '.[] | select(.primary == true) | .email' 2>/dev/null \\\n" +
      '                   | head -1 || echo "${MAINTAINER}@users.noreply.github.com")\n' +
      '        git config user.email "$OP_EMAIL"';
    const r = auditText("full-ai-cluster/usb-nixos-installer/zeta-install.sh", preFix);
    expect(r.findings.some((f) => f.klass === 1)).toBe(true);
  });

  test("the PR template's angled placeholder name does not hide the address", () => {
    const r = auditText(".github/PULL_REQUEST_TEMPLATE.md", "Co-authored-by: <persona> <persona@zeta.agents>");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.email).toBe("persona@zeta.agents");
  });

  test("one address reached by two extractors is one finding, not two", () => {
    const r = auditText("x.sh", 'git config user.email "shadow@users.noreply.github.com"');
    expect(r.findings).toHaveLength(1);
  });
});

describe("auditText — the corrected forms produce nothing (the fix must actually clear it)", () => {
  test("the [bot] rewrite of every live offender is clean", () => {
    const fixed = [
      "Co-authored-by: shadow[bot] <shadow[bot]@users.noreply.github.com>",
      "Co-authored-by: dejan[bot] <dejan[bot]@users.noreply.github.com>",
      'git config user.email "${AGENT}[bot]@users.noreply.github.com"',
      "Co-authored-by: Claude Opus 5 <noreply@anthropic.com>",
    ].join("\n");
    expect(auditText("x.md", fixed).findings).toHaveLength(0);
  });

  test("but it still SAW them — a zero over zero inputs would be vacuous", () => {
    const fixed = "Co-authored-by: shadow[bot] <shadow[bot]@users.noreply.github.com>";
    expect(auditText("x.md", fixed).identities).toBeGreaterThan(0);
  });
});

describe("comment lines — documenting the ban must not trip the ban", () => {
  test("a shell/YAML # comment and a TS // comment are not generators", () => {
    expect(isCommentLine("x.sh", "        #   Co-authored-by: <shadow@users.noreply.github.com>")).toBe(true);
    expect(isCommentLine("x.yml", "  # user.email shadow@users.noreply.github.com")).toBe(true);
    expect(isCommentLine("x.ts", "// shadow@users.noreply.github.com is the bad form")).toBe(true);
    expect(isCommentLine("x.ts", " * shadow@users.noreply.github.com")).toBe(true);
  });

  test("but executable lines in those same files still are", () => {
    expect(isCommentLine("x.sh", 'git config user.email "shadow@users.noreply.github.com"')).toBe(false);
    const r = auditText(
      "x.sh",
      [
        "# documented ban: shadow@users.noreply.github.com must never be used",
        'git config user.email "dejan@users.noreply.github.com"',
      ].join("\n"),
    );
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]?.line).toBe(2);
  });

  test("markdown gets NO comment carve-out — a bullet showing the form IS the generator", () => {
    expect(isCommentLine("x.md", "# Heading with shadow@users.noreply.github.com")).toBe(false);
    expect(auditText("x.md", "- Co-authored-by: shadow <shadow@users.noreply.github.com>").findings).toHaveLength(1);
  });
});

describe("scope — stated limits, pinned", () => {
  test("the self-exemption is exactly one file and it is this audit", () => {
    expect(SELF_EXEMPT).toEqual(["src/Core.TypeScript/hygiene/audit-coauthor-identity-collides.ts"]);
    expect(isScannable(SELF_EXEMPT[0] as string)).toBe(false);
  });

  test("test fixtures are out of scope; ordinary sources are in", () => {
    expect(isScannable("src/Core.TypeScript/hygiene/audit-coauthor-identity-collides.test.ts")).toBe(false);
    expect(isScannable("src/Core.TypeScript/anything.spec.ts")).toBe(false);
    expect(isScannable("src/Core.TypeScript/planning/agent-proposal.ts")).toBe(true);
    expect(isScannable(".github/workflows/gate.yml")).toBe(true);
    expect(isScannable("docs/notes.png")).toBe(false);
  });

  test("history is NOT a scan root — this is the decision that keeps the check greenable", () => {
    for (const r of SCAN_ROOTS) {
      expect(r.startsWith("docs/history")).toBe(false);
      expect(r.startsWith("workitems")).toBe(false);
      expect(r.startsWith("memory")).toBe(false);
      expect(r).not.toBe(".git");
    }
  });
});

describe("reporting", () => {
  test("the two classes are rendered apart, never summed into one number", () => {
    const r = runAudit([]);
    const synthetic = {
      ...r,
      findings: [
        {
          file: "a",
          line: 1,
          email: "shadow@users.noreply.github.com",
          verdict: "collides-plain-noreply" as const,
          klass: 1 as const,
          origin: "co-author-trailer" as const,
          snippet: "a",
        },
        {
          file: "b",
          line: 2,
          email: "x@zeta.agents",
          verdict: "fabricated-domain" as const,
          klass: 2 as const,
          origin: "co-author-trailer" as const,
          snippet: "b",
        },
      ],
    };
    const out = renderHuman(synthetic);
    expect(out).toContain("CLASS 1");
    expect(out).toContain("CLASS 2");
    expect(out).toContain("HARMFUL");
    expect(out).toContain("LESSER");
  });

  test("drift class is AH005 and is free of AH001..AH004", () => {
    expect(DRIFT_CLASS).toBe("AH005");
  });
});

describe("integration — the repository itself, after the fix", () => {
  test("no generator in the tree emits a colliding or fabricated identity", () => {
    const r = runAudit();
    expect(r.findings.map((f) => `${f.file}:${f.line} ${f.email}`)).toEqual([]);
  }, 180_000);

  test("and it actually read the tree — files and identities are non-zero", () => {
    const r = runAudit();
    expect(r.filesScanned).toBeGreaterThan(100);
    expect(r.identitiesSeen).toBeGreaterThan(20);
  }, 180_000);
});
