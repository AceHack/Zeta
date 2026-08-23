import { test, expect } from "bun:test";
import { extractPointers, extractZetaId, resolvePointer } from "./auto-vivify";

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
