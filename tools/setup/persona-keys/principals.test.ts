// principals.ts conformance — per-machine authorized-principals data + AuthorizedPrincipalsFile
// rendering (the AUTHORIZATION half of the identity↔authorization split). ALL tests run against
// a THROWAWAY temp dir; NO secrets are involved (the data is USERNAMES only). NO key-shaped
// literal appears in this file — the private-key guard string is SPLIT (PRIV_MARKER).
// Run: bun test principals.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  principalsDataPath,
  normalizePrincipals,
  parsePrincipals,
  loadPrincipals,
  renderAuthorizedPrincipals,
  renderHostAuthorizedPrincipals,
} from "./principals.ts";

// The private-key marker, assembled at runtime so NO key-shaped literal is in this file.
const PRIV_MARKER = "PRIVATE" + " " + "KEY";

function writeData(repoRoot: string, obj: unknown): void {
  const p = principalsDataPath(repoRoot);
  mkdirSync(p.slice(0, p.lastIndexOf("/")), { recursive: true });
  writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

test("normalizePrincipals: trims, drops blanks, de-dups, sorts ORDINAL (byte-stable)", () => {
  expect(normalizePrincipals(["addison", "aaron", "aaron", "  ", " max "])).toEqual([
    "aaron",
    "addison",
    "max",
  ]);
});

test("renderAuthorizedPrincipals: one username per line, trailing newline; lists the right users", () => {
  const body = renderAuthorizedPrincipals(["addison", "aaron"]);
  expect(body).toBe("aaron\naddison\n"); // ordinal-sorted
  expect(body.split("\n").filter((l) => l.length > 0)).toEqual(["aaron", "addison"]);
});

test("renderAuthorizedPrincipals: INERT when absent — empty list -> empty string (authorizes NObody)", () => {
  expect(renderAuthorizedPrincipals([])).toBe("");
});

test("parse/load: a host -> usernames map round-trips; the matrix is the single source", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-principals-"));
  try {
    // The spec matrix: A=aaron, D=aaron+addison, G=all three.
    writeData(tmp, { A: ["aaron"], D: ["addison", "aaron"], G: ["max", "aaron", "addison"] });
    const map = loadPrincipals(tmp);
    expect(map["A"]).toEqual(["aaron"]);
    expect(map["D"]).toEqual(["aaron", "addison"]); // normalized + sorted
    expect(map["G"]).toEqual(["aaron", "addison", "max"]);
    // Per-host render lists exactly that host's users.
    expect(renderHostAuthorizedPrincipals(map, "D")).toBe("aaron\naddison\n");
    expect(renderHostAuthorizedPrincipals(map, "A")).toBe("aaron\n");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("INERT when data file absent: loadPrincipals -> empty map; unknown host -> empty render", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-principals-"));
  try {
    expect(loadPrincipals(tmp)).toEqual({}); // no file -> empty map (no throw, no behavior)
    const map = loadPrincipals(tmp);
    expect(renderHostAuthorizedPrincipals(map, "anything")).toBe(""); // absent host -> inert
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("fail-INERT on garbage / non-array entries: never fail-open (no spurious authorization)", () => {
  expect(parsePrincipals("not json {")).toEqual({}); // invalid JSON -> empty
  expect(parsePrincipals("[1,2,3]")).toEqual({}); // array, not an object -> empty
  expect(parsePrincipals("null")).toEqual({});
  // Non-string entries are dropped, not guessed; a host that nets zero is omitted.
  expect(parsePrincipals(JSON.stringify({ H: [1, "aaron", null], Z: [] }))).toEqual({ H: ["aaron"] });
});

test("usernames only — the data carries NO key material (no private marker ever)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-principals-"));
  try {
    writeData(tmp, { D: ["aaron", "addison"] });
    const map = loadPrincipals(tmp);
    const blob = JSON.stringify(map) + renderHostAuthorizedPrincipals(map, "D");
    expect(blob).not.toMatch(new RegExp(PRIV_MARKER));
    expect(blob).not.toMatch(new RegExp("BEGIN .*" + PRIV_MARKER));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
