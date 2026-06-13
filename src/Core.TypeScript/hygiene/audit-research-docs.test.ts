import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { auditResearchDocsInRoots } from "./audit-research-docs.ts";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-research-audit-"));
  mkdirSync(join(root, "docs", "research", "nested"), { recursive: true });
  mkdirSync(join(root, "memory", "persona"), { recursive: true });
  return root;
}

describe("auditResearchDocsInRoots", () => {
  test("classifies references, rationale markers, and markdown memory substrate", async () => {
    const root = fixture();
    try {
      writeFileSync(
        join(root, "docs", "research", "full.md"),
        "# full reference\n",
      );
      const absolutePath = join(root, "docs", "research", "absolute.md");
      writeFileSync(absolutePath, "# absolute reference\n");
      writeFileSync(
        join(root, "docs", "research", "colon.md"),
        "# colon reference\n",
      );
      writeFileSync(
        join(root, "docs", "research", "nested", "relative.md"),
        "# relative reference\n",
      );
      writeFileSync(
        join(root, "docs", "research", "relative-link.md"),
        "# relative markdown link reference\n",
      );
      writeFileSync(
        join(root, "docs", "research", "rationale.txt"),
        "explicit unindexed rationale: archived raw OCR source\n",
      );
      writeFileSync(
        join(root, "docs", "research", "non-md-memory-only.md"),
        "# non markdown memory mention only\n",
      );
      writeFileSync(
        join(root, "docs", "research", "boundary.md"),
        "# boundary reference\n",
      );
      writeFileSync(
        join(root, "docs", "research", "missing.jpg"),
        "image placeholder\n",
      );
      writeFileSync(
        join(root, "memory", "MEMORY.md"),
        [
          "docs/research/full.md",
          absolutePath.replaceAll("\\", "/"),
          "docs/research/colon.md: annotated reference",
          "nested/relative.md",
          "[relative](../docs/research/relative-link.md)",
          "docs/research/boundary.md.bak",
          "prefixdocs/research/boundary.md",
          "",
        ].join("\n"),
      );
      writeFileSync(
        join(root, "memory", "promotion-ledger.jsonl"),
        '{"path":"docs/research/non-md-memory-only.md"}\n',
      );
      writeFileSync(
        join(root, "memory", "persona", "CURRENT.md"),
        "Persona note without research refs.\n",
      );

      const result = await auditResearchDocsInRoots({
        repoRoot: root,
        researchDir: join(root, "docs", "research"),
        memoryDir: join(root, "memory"),
      });

      expect(result.researchFiles).toEqual([
        "docs/research/absolute.md",
        "docs/research/boundary.md",
        "docs/research/colon.md",
        "docs/research/full.md",
        "docs/research/missing.jpg",
        "docs/research/nested/relative.md",
        "docs/research/non-md-memory-only.md",
        "docs/research/rationale.txt",
        "docs/research/relative-link.md",
      ]);
      expect(result.memoryFiles).toEqual([
        "memory/MEMORY.md",
        "memory/persona/CURRENT.md",
      ]);
      expect(result.referenced).toEqual([
        "docs/research/absolute.md",
        "docs/research/colon.md",
        "docs/research/full.md",
        "docs/research/nested/relative.md",
        "docs/research/relative-link.md",
      ]);
      expect(result.explicitlyUnindexed).toEqual([
        "docs/research/rationale.txt",
      ]);
      expect(result.unreferenced).toEqual([
        "docs/research/boundary.md",
        "docs/research/missing.jpg",
        "docs/research/non-md-memory-only.md",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
