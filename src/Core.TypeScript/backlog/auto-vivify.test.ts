import { test, expect } from "bun:test";
import { extractPointers, extractZetaId, resolvePointer, stubTargetPath } from "./auto-vivify";

test("extractPointers finds wikilinks, markdown links, and backticks correctly", () => {
  const text = `
    Some text with [[grey]] and [[same/grey-gray]].
    A wikilink with anchor [[some-node#section-1]] and label [[some-node|My Label]].
    A markdown link [my link](db/shapes) and [external](https://google.com).
    A backtick path \`db/routing/README.md\` and \`normal-code\`.
  `;

  const ptrs = extractPointers(text);
  const cleans = ptrs.map((p) => p.clean);

  expect(cleans).toContain("grey");
  expect(cleans).toContain("same/grey-gray");
  expect(cleans).toContain("some-node");
  expect(cleans).toContain("db/shapes");
  expect(cleans).toContain("db/routing/README.md");
  expect(cleans).not.toContain("https://google.com");
  expect(cleans).not.toContain("normal-code");
});

test("extractPointers ignores absolute filesystem paths (node runtime paths, not repo pointers)", () => {
  const text = `
    NixOS resolves the module to \`/run/current-system/sw/lib/pkcs11/yubihsm_pkcs11.so\`,
    while the repo copy lives at \`db/routing/README.md\`.
  `;

  const cleans = extractPointers(text).map((p) => p.clean);

  expect(cleans).not.toContain("/run/current-system/sw/lib/pkcs11/yubihsm_pkcs11.so");
  expect(cleans).toContain("db/routing/README.md");
});

test("extractPointers does not double-count a backtick filename that is a markdown-link label", () => {
  // A workitem cites a design doc as ``[`foo.md`](../docs/research/foo.md)``. The markdown
  // link target is authoritative; the backtick label filename on its own would resolve to a
  // different (nonexistent) directory and register as a phantom dangling reference.
  const text =
    "Design: [`2026-09-03-oracles.md`](../docs/research/2026-09-03-oracles.md) is the source.";

  const ptrs = extractPointers(text);
  const backtickCleans = ptrs.filter((p) => p.kind === "backtick").map((p) => p.clean);
  const mdlinkCleans = ptrs.filter((p) => p.kind === "mdlink").map((p) => p.clean);

  // The bare label filename must NOT appear as an independent backtick pointer.
  expect(backtickCleans).not.toContain("2026-09-03-oracles.md");
  // The authoritative markdown-link target IS captured.
  expect(mdlinkCleans).toContain("../docs/research/2026-09-03-oracles.md");
});

test("extractPointers still captures a standalone backtick path outside any link label", () => {
  const text = "The healer lives at `src/Core.TypeScript/hygiene/healers/zetafs-virtual-path.ts` today.";
  const cleans = extractPointers(text).map((p) => p.clean);
  expect(cleans).toContain("src/Core.TypeScript/hygiene/healers/zetafs-virtual-path.ts");
});

test("extractPointers separates QEC parameter notation from ordinary wikilinks", () => {
  const text = "The [[16,6,4]] code composes with [[same/grey-gray]] and [[grey]].";
  const cleans = extractPointers(text).map((pointer) => pointer.clean);

  expect(cleans).toEqual(["same/grey-gray", "grey"]);
});

test("extractZetaId parses valid Crockford ZetaId", () => {
  const validId = "081KTQX7W6Q08QG0R000XA3220";
  expect(extractZetaId(validId)).toBe(validId);
  expect(extractZetaId(`workitems/${validId}-slug.md`)).toBe(validId);
  expect(extractZetaId("invalid-id-here")).toBeNull();
});

test("resolvePointer correctly identifies type and candidate paths", () => {
  // Test sameness resolution
  const sameRes = resolvePointer("same/grey-gray", "db/same/README.md");
  expect(sameRes).not.toBeNull();
  expect(sameRes!.type).toBe("sameness");
  expect(sameRes!.resolvedPath).toContain("_-gray-grey-_.md"); // Alphabetical sorting of grey/gray -> gray-grey

  // Test standard existing file
  const existsRes = resolvePointer("db/same/README.md", "db/same/README.md");
  expect(existsRes).not.toBeNull();
  expect(existsRes!.exists).toBe(true);

  // Test non-existent standard db node
  const nonExistsRes = resolvePointer("db/routing/non-existent-node", "db/same/README.md");
  expect(nonExistsRes).not.toBeNull();
  expect(nonExistsRes!.exists).toBe(false);
  expect(nonExistsRes!.type).toBe("db-dir"); // Defaults to directory/README structure since no extension
});

test("resolvePointer accepts legacy docs/backlog ZetaId rows as existing references", () => {
  const res = resolvePointer("081KSGS9H0008QG0R003A37Z65", "workitems/example.md");

  expect(res).not.toBeNull();
  expect(res!.exists).toBe(true);
  expect(res!.resolvedPath).toContain("docs/backlog/P1/081KSGS9H0008QG0R003A37Z65-");
});

// ─────────────────────────────────────────────────────────────────────────────
// A `db-dir` STUB GOES INSIDE THE DIRECTORY. The bug this pins produced ELEVEN markdown files
// wearing source extensions -- `db/backlog/dora-metrics.ts`, `db/redis/Application.yaml`,
// `db/src/Core.Git/GitDeltaLog.fs` and eight more -- because the write put `getStubContent`'s
// directory-form output (`# name/`, trailing slash) at the directory's own path.
//
// CodeQL read the three `.ts` ones as JavaScript: 41 open `js/syntax-error` alerts from three
// 3-line files. And it is a REPEAT -- PR #8814 fixed the same shape on 2026-06-21.
//
// These tests exist because reverting the fix left all 8 prior tests green. A fix whose
// mutation survives its own suite is not a fixed defect, it is an unwitnessed claim.

test("a db-dir stub is written to <dir>/README.md, never to the directory's own path", () => {
  expect(stubTargetPath("/repo/db/backlog/dora-metrics.ts", "db-dir")).toBe(
    "/repo/db/backlog/dora-metrics.ts/README.md",
  );
  // Extensionless targets are the ordinary db-dir case and take the same path.
  expect(stubTargetPath("/repo/db/name", "db-dir")).toBe("/repo/db/name/README.md");
});

test("a db-file stub is written AT its path — .md targets must not grow a README", () => {
  expect(stubTargetPath("/repo/db/routing/README.md", "db-file")).toBe("/repo/db/routing/README.md");
  expect(stubTargetPath("/repo/db/shapes/grey.md", "db-file")).toBe("/repo/db/shapes/grey.md");
});

// The failure mode in one assertion: every extension that actually occurred in the 11.
test("no source extension can receive markdown content directly", () => {
  for (const ext of [".ts", ".sh", ".yaml", ".fs"]) {
    const p = `/repo/db/thing${ext}`;
    expect(stubTargetPath(p, "db-dir")).toBe(`${p}/README.md`);
    expect(stubTargetPath(p, "db-dir")).not.toBe(p);
  }
});
