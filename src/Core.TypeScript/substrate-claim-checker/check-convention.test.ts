import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkFile, findSupersessionClaims } from "./check-convention.ts";

function setupRepo(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "check-convention-"));
  mkdirSync(join(root, ".git"), { recursive: true });
  mkdirSync(join(root, "docs", "DECISIONS"), { recursive: true });
  return {
    root,
    cleanup: () => {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        // Best-effort temp cleanup.
      }
    },
  };
}

describe("findSupersessionClaims", () => {
  test("finds backtick ADR supersession targets", () => {
    const claims = findSupersessionClaims([
      "**Status:** Accepted. Supersedes ADR `docs/DECISIONS/old.md`.",
    ]);
    expect(claims).toHaveLength(1);
    expect(claims.at(0)?.target).toBe("docs/DECISIONS/old.md");
  });

  test("finds anchored backtick ADR supersession targets", () => {
    const claims = findSupersessionClaims([
      "**Status:** Accepted. Supersedes ADR `docs/DECISIONS/old.md#rationale`.",
      "**Status:** Accepted. Supersedes ADR `docs/DECISIONS/query.md?plain=1`.",
    ]);
    expect(claims).toHaveLength(2);
    expect(claims.at(0)?.target).toBe("docs/DECISIONS/old.md");
    expect(claims.at(1)?.target).toBe("docs/DECISIONS/query.md");
  });

  test("finds markdown link ADR supersession targets", () => {
    const claims = findSupersessionClaims([
      "Supersedes ADR [v1](old.md) after review.",
    ]);
    expect(claims).toHaveLength(1);
    expect(claims.at(0)?.target).toBe("old.md");
  });

  test("finds hard-wrapped markdown link ADR supersession targets", () => {
    const claims = findSupersessionClaims([
      "**Status:** Accepted. Supersedes ADR",
      "[v1](old.md) after review.",
    ]);
    expect(claims).toHaveLength(1);
    expect(claims.at(0)?.line).toBe(1);
    expect(claims.at(0)?.target).toBe("old.md");
  });

  test("reports hard-wrapped claims at the physical claim line", () => {
    const claims = findSupersessionClaims([
      "**Date:** 2026-05-10",
      "**Status:** Accepted. Supersedes ADR",
      "[v1](old.md) after review.",
    ]);
    expect(claims).toHaveLength(1);
    expect(claims.at(0)?.line).toBe(2);
    expect(claims.at(0)?.target).toBe("old.md");
  });

  test("finds hard-wrapped backtick ADR supersession targets", () => {
    const claims = findSupersessionClaims([
      "**Status:** Accepted. Supersedes ADR",
      "`docs/DECISIONS/old.md` after review.",
    ]);
    expect(claims).toHaveLength(1);
    expect(claims.at(0)?.line).toBe(1);
    expect(claims.at(0)?.target).toBe("docs/DECISIONS/old.md");
  });

  test("strips markdown link titles from supersession targets", () => {
    const claims = findSupersessionClaims([
      'Supersedes ADR [v1](old.md "historical record").',
    ]);
    expect(claims).toHaveLength(1);
    expect(claims.at(0)?.target).toBe("old.md");
  });

  test("ignores non-repo-local supersession targets", () => {
    const claims = findSupersessionClaims([
      "Supersedes ADR `https://example.test/docs/DECISIONS/old.md`.",
      "Supersedes ADR `file:///tmp/old.md`.",
      "Supersedes ADR `/tmp/old.md`.",
      "Supersedes ADR `C:\\zeta\\old.md`.",
      "Supersedes ADR `\\\\server\\share\\old.md`.",
    ]);
    expect(claims).toEqual([]);
  });

  test("finds hard-wrapped markdown link with blockquote prefix on continuation", () => {
    const claims = findSupersessionClaims([
      "**Status:** Accepted. Supersedes ADR",
      "> [v1](old.md) after review.",
    ]);
    expect(claims).toHaveLength(1);
    expect(claims.at(0)?.line).toBe(1);
    expect(claims.at(0)?.target).toBe("old.md");
  });

  test("ignores supersession text inside fenced code", () => {
    const claims = findSupersessionClaims([
      "```md",
      "Supersedes ADR `docs/DECISIONS/old.md`",
      "```",
    ]);
    expect(claims).toEqual([]);
  });

  test("finds backtick target with anchor suffix", () => {
    const claims = findSupersessionClaims([
      "Supersedes ADR `docs/DECISIONS/old.md#status`.",
    ]);
    expect(claims).toHaveLength(1);
    expect(claims.at(0)?.target).toBe("docs/DECISIONS/old.md");
  });

  test("finds backtick target with query suffix", () => {
    const claims = findSupersessionClaims([
      "Supersedes ADR `docs/DECISIONS/old.md?v=2`.",
    ]);
    expect(claims).toHaveLength(1);
    expect(claims.at(0)?.target).toBe("docs/DECISIONS/old.md");
  });
});

describe("checkFile", () => {
  test("flags missing reciprocal superseded-by marker", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(oldAdr, "# ADR old\n\n**Status:** Accepted.\n");
      writeFileSync(
        newAdr,
        [
          "# ADR new",
          "",
          "**Status:** Accepted. Supersedes ADR `docs/DECISIONS/old.md`.",
          "",
        ].join("\n"),
      );

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings.at(0)?.target).toBe("docs/DECISIONS/old.md");
    } finally {
      fx.cleanup();
    }
  });

  test("accepts reciprocal top-of-file marker naming superseding ADR", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(
        oldAdr,
        [
          "# ADR old",
          "",
          "> **Superseded by** [`docs/DECISIONS/new.md`](new.md).",
          "",
        ].join("\n"),
      );
      writeFileSync(
        newAdr,
        [
          "# ADR new",
          "",
          "**Status:** Accepted. Supersedes ADR `docs/DECISIONS/old.md`.",
          "",
        ].join("\n"),
      );

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("accepts hard-wrapped reciprocal top-of-file marker", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(
        oldAdr,
        [
          "# ADR old",
          "",
          "> **Superseded by**",
          "> [`docs/DECISIONS/new.md`](new.md).",
          "",
        ].join("\n"),
      );
      writeFileSync(
        newAdr,
        [
          "# ADR new",
          "",
          "**Status:** Accepted. Supersedes ADR `docs/DECISIONS/old.md`.",
          "",
        ].join("\n"),
      );

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("finds supersession claim when link continuation uses blockquote prefix", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(oldAdr, "# ADR old\n");
      writeFileSync(
        newAdr,
        [
          "**Status:** Accepted. Supersedes ADR",
          "> [v1](docs/DECISIONS/old.md) after review.",
          "",
        ].join("\n"),
      );

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings.at(0)?.target).toBe("docs/DECISIONS/old.md");
    } finally {
      fx.cleanup();
    }
  });

  test("flags reciprocal marker that names the wrong ADR", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(
        oldAdr,
        "> **Superseded by** [`other.md`](other.md).\n",
      );
      writeFileSync(newAdr, "Supersedes ADR [v1](old.md).\n");

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings.at(0)?.reason).toContain("does not name new.md");
    } finally {
      fx.cleanup();
    }
  });

  test("flags reciprocal marker that only contains the ADR basename as a substring", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(
        oldAdr,
        "> **Superseded by** [`renew.md`](renew.md) and `new.md.bak`.\n",
      );
      writeFileSync(newAdr, "Supersedes ADR [v1](old.md).\n");

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings.at(0)?.reason).toContain("does not name new.md");
    } finally {
      fx.cleanup();
    }
  });

  test("skips unresolved targets for existence checker", () => {
    const fx = setupRepo();
    try {
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(newAdr, "Supersedes ADR `docs/DECISIONS/missing.md`.\n");
      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("does not read absolute supersession targets outside the repo", () => {
    const fx = setupRepo();
    const outside = join(dirname(fx.root), "check-convention-outside-old.md");
    try {
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(outside, "# outside ADR\n");
      writeFileSync(newAdr, `Supersedes ADR \`${outside}\`.\n`);

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toEqual([]);
    } finally {
      try {
        rmSync(outside, { force: true });
      } catch {
        // Best-effort temp cleanup.
      }
      fx.cleanup();
    }
  });

  test("does not accept prose continuation after superseded-by line as a marker", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      // old.md: "superseded by" appears in prose; the NEXT line contains the ADR name as prose too
      writeFileSync(
        oldAdr,
        [
          "# ADR old",
          "",
          "This approach was superseded by",
          "new.md conventions adopted later.",
        ].join("\n"),
      );
      writeFileSync(
        newAdr,
        "Supersedes ADR `docs/DECISIONS/old.md`.\n",
      );

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      // prose continuation must not satisfy the reciprocal marker — finding expected
      expect(result.findings).toHaveLength(1);
    } finally {
      fx.cleanup();
    }
  });

  test("does not treat non-marker superseded-by prose as a reciprocal marker", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(
        oldAdr,
        [
          "# ADR old",
          "",
          "**Status:** Superseded by a later decision.",
          "`new.md` appears on the next paragraph line.",
          "",
        ].join("\n"),
      );
      writeFileSync(newAdr, "Supersedes ADR [v1](old.md).\n");

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings.at(0)?.reason).toContain("not reciprocated");
    } finally {
      fx.cleanup();
    }
  });

  test("does not append unrelated non-blockquote lines to a wrapped marker", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(
        oldAdr,
        [
          "# ADR old",
          "",
          "> **Superseded by**",
          "`new.md` appears in unrelated prose.",
          "",
        ].join("\n"),
      );
      writeFileSync(newAdr, "Supersedes ADR [v1](old.md).\n");

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      expect(result.findings).toHaveLength(1);
      expect(result.findings.at(0)?.reason).toContain("does not name new.md");
    } finally {
      fx.cleanup();
    }
  });

  test("does not false-positive on superseded-by text inside fenced code in marker scan", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      // old.md has "superseded by" only inside a fenced code block — no real prose marker
      writeFileSync(
        oldAdr,
        [
          "# ADR old",
          "",
          "```md",
          "Superseded by new.md",
          "```",
          "",
          "**Status:** Accepted.",
        ].join("\n"),
      );
      writeFileSync(
        newAdr,
        "**Status:** Accepted. Supersedes ADR `docs/DECISIONS/old.md`.\n",
      );

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      // fenced "superseded by" must not count — finding expected
      expect(result.findings).toHaveLength(1);
      expect(result.findings.at(0)?.target).toBe("docs/DECISIONS/old.md");
    } finally {
      fx.cleanup();
    }
  });

  test("does not treat status-line prose naming the superseding file as a reciprocal marker", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      // old.md: "superseded by new.md" appears inline in a Status sentence (not a marker form)
      writeFileSync(
        oldAdr,
        [
          "# ADR old",
          "",
          "**Status:** Superseded by new.md.",
          "",
        ].join("\n"),
      );
      writeFileSync(newAdr, "Supersedes ADR [v1](old.md).\n");

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      // prose Status-line naming the file must not satisfy the reciprocal marker — finding expected
      expect(result.findings).toHaveLength(1);
      expect(result.findings.at(0)?.reason).toContain("not reciprocated");
    } finally {
      fx.cleanup();
    }
  });

  test("does not treat superseded-by text in tilde-fenced block as a reciprocal marker", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      // old.md: canonical marker form is inside a tilde fence — must not count
      writeFileSync(
        oldAdr,
        [
          "# ADR old",
          "",
          "~~~md",
          "> **Superseded by** [`new.md`](new.md).",
          "~~~",
          "",
          "**Status:** Accepted.",
        ].join("\n"),
      );
      writeFileSync(
        newAdr,
        "**Status:** Accepted. Supersedes ADR `docs/DECISIONS/old.md`.\n",
      );

      const result = checkFile(newAdr);
      expect(result.ok).toBe(true);
      // tilde-fenced "superseded by" must not count — finding expected
      expect(result.findings).toHaveLength(1);
      expect(result.findings.at(0)?.target).toBe("docs/DECISIONS/old.md");
    } finally {
      fx.cleanup();
    }
  });

  test("returns ok=false and emits target-read errors when referenced ADR cannot be read", () => {
    const fx = setupRepo();
    try {
      const oldAdr = join(fx.root, "docs", "DECISIONS", "old.md");
      const newAdr = join(fx.root, "docs", "DECISIONS", "new.md");
      writeFileSync(oldAdr, "# ADR old\n");
      writeFileSync(newAdr, "Supersedes ADR [v1](old.md).\n");
      // Remove old.md after it's been stat'd (simulate a read failure by removing before checkFile runs)
      // Instead, write a directory where the file is expected to be
      rmSync(oldAdr, { force: true });
      mkdirSync(oldAdr); // EISDIR — readFile will return ok: false

      const result = checkFile(newAdr);
      expect(result.ok).toBe(false);
    } finally {
      fx.cleanup();
    }
  });

  test("returns ok=false for missing input file", () => {
    const result = checkFile("/no/such/path/check-convention-test.md");
    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([]);
  });
});
