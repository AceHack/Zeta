/**
 * Tier-0 healers certification test — all three healers from our session's failures.
 */

import { describe, test, expect } from "bun:test";
import { certify, tree, type Fixture } from "../healer-harness";
import { staleJsHealer, staleJsDetector } from "./stale-js";
import { unpinnedActionsHealer, unpinnedActionsDetector } from "./unpinned-actions";
import { exactOptionalHealer, exactOptionalDetector } from "./exact-optional-spread";

describe("stale-js healer — removes .js when sibling .ts exists", () => {
  const fixtures: Fixture[] = [
    { name: "stale js", tree: tree({ "src/lib.ts": "export const x = 1;", "src/lib.js": "exports.x = 1;" }) },
    { name: "js only (no ts)", tree: tree({ "src/lib.js": "exports.x = 1;" }) },
    { name: "ts only", tree: tree({ "src/lib.ts": "export const x = 1;" }) },
    { name: "empty", tree: tree({}) },
  ];

  test("certified (idempotence, closure, convergence)", () => {
    const v = certify(staleJsHealer, [staleJsDetector], fixtures);
    expect(v.pass).toBe(true);
  });

  test("removes .js when .ts sibling exists", () => {
    const input = tree({ "src/a.ts": "ts", "src/a.js": "js" });
    const healed = staleJsHealer.heal(input);
    expect(healed.has("src/a.js")).toBe(false);
    expect(healed.has("src/a.ts")).toBe(true);
  });

  test("leaves .js alone when no .ts sibling", () => {
    const input = tree({ "src/vendor.js": "vendor code" });
    const healed = staleJsHealer.heal(input);
    expect(healed.has("src/vendor.js")).toBe(true);
  });
});

describe("unpinned-actions healer — SHA-pins known actions", () => {
  const fixtures: Fixture[] = [
    {
      name: "unpinned checkout",
      tree: tree({ ".github/workflows/ci.yml": "    steps:\n      - uses: actions/checkout@v4\n" }),
    },
    {
      name: "already pinned",
      tree: tree({ ".github/workflows/ci.yml": "    steps:\n      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0\n" }),
    },
    {
      name: "unknown action (decline)",
      tree: tree({ ".github/workflows/ci.yml": "    steps:\n      - uses: unknown/action@v1\n" }),
    },
    { name: "empty", tree: tree({}) },
  ];

  test("certified (idempotence, closure, convergence)", () => {
    const v = certify(unpinnedActionsHealer, [unpinnedActionsDetector], fixtures);
    expect(v.pass).toBe(true);
  });

  test("pins actions/checkout@v4 to the full SHA", () => {
    const input = tree({ ".github/workflows/ci.yml": "jobs:\n  build:\n    steps:\n      - uses: actions/checkout@v4\n" });
    const healed = unpinnedActionsHealer.heal(input);
    const content = healed.get(".github/workflows/ci.yml")!;
    expect(content).toContain("9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0");
    expect(content).not.toContain("@v4");
  });

  test("leaves unknown actions unchanged (decline)", () => {
    const input = tree({ ".github/workflows/ci.yml": "      - uses: unknown/action@v1\n" });
    const healed = unpinnedActionsHealer.heal(input);
    expect(healed.get(".github/workflows/ci.yml")).toContain("unknown/action@v1");
  });
});

describe("exact-optional-spread healer — fixes TS2375 pattern", () => {
  const fixtures: Fixture[] = [
    {
      name: "ternary with undefined",
      tree: tree({ "src/a.ts": "const obj = {\n  key: x ? x : undefined,\n};\n" }),
    },
    {
      name: "already spread (no-op)",
      tree: tree({ "src/b.ts": "const obj = {\n  ...(x ? { key: x } : {}),\n};\n" }),
    },
    { name: "empty", tree: tree({}) },
  ];

  test("certified (idempotence, closure, convergence)", () => {
    const v = certify(exactOptionalHealer, [exactOptionalDetector], fixtures);
    expect(v.pass).toBe(true);
  });

  test("wraps ternary-undefined into spread pattern", () => {
    const input = tree({ "src/a.ts": "const obj = {\n  key: x ? x : undefined,\n};\n" });
    const healed = exactOptionalHealer.heal(input);
    const content = healed.get("src/a.ts")!;
    expect(content).toContain("...(x ? { key: x } : {})");
    expect(content).not.toContain(": undefined");
  });

  test("leaves already-spread patterns unchanged", () => {
    const input = tree({ "src/b.ts": "const obj = {\n  ...(x ? { key: x } : {}),\n};\n" });
    const healed = exactOptionalHealer.heal(input);
    expect(healed.get("src/b.ts")).toBe(input.get("src/b.ts"));
  });
});
