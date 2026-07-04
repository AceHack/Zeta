import { describe, expect, test } from "bun:test";
import { ZETA_TOOLS, isClosedSurface, domainOf, type ResponsesToolDecl } from "./zeta-tools.ts";

// THE CLOSED TOOL SURFACE (shadow*, Aaron 2026-07-04: "our tools are only our file system and
// database … not random bash/CLI"). Slice 1 of tool-calls-the-zeta-way. Proofs:
//   1. The surface is CLOSED: every tool is fs.* or db.* — no bash/exec/http/open registry.
//   2. The surface IS the fs+db vocabulary (DagFs ops + zetadb append/query), nothing more.
//   3. domainOf classifies fs./db. and rejects anything outside; a smuggled tool fails the invariant.
//   4. Every declaration is a well-formed Responses function tool (type/name/params).

describe("ZETA_TOOLS — the closed fs+db surface", () => {
  test("the surface is closed: every tool is fs.* or db.*", () => {
    expect(isClosedSurface(ZETA_TOOLS)).toBe(true);
    for (const t of ZETA_TOOLS) expect(domainOf(t.name)).not.toBeNull();
  });

  test("the surface IS exactly the DagFs + zetadb vocabulary", () => {
    const names = ZETA_TOOLS.map((t) => t.name).sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(["db.append", "db.query", "fs.editEverywhere", "fs.editLocal", "fs.link", "fs.resolve", "fs.unlink"]);
  });

  test("there is no shell / exec / http / open-registry tool", () => {
    const forbidden = /bash|shell|exec|spawn|http|fetch|eval|process|command/i;
    for (const t of ZETA_TOOLS) expect(t.name).not.toMatch(forbidden);
  });

  test("domainOf rejects anything outside the surface — a smuggled tool fails the invariant", () => {
    expect(domainOf("bash.run")).toBeNull();
    expect(domainOf("http.get")).toBeNull();
    expect(domainOf("fs.resolve")).toBe("fs");
    expect(domainOf("db.append")).toBe("db");
    const smuggled: ResponsesToolDecl[] = [...ZETA_TOOLS, { type: "function", name: "bash.run", description: "x", parameters: { type: "object", properties: {}, required: [], additionalProperties: false } }];
    expect(isClosedSurface(smuggled)).toBe(false); // the invariant catches the escape
  });

  test("every declaration is a well-formed Responses function tool", () => {
    for (const t of ZETA_TOOLS) {
      expect(t.type).toBe("function");
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.parameters.type).toBe("object");
      expect(t.parameters.additionalProperties).toBe(false);
      for (const req of t.parameters.required) expect(t.parameters.properties[req]).toBeDefined();
    }
  });
});
