import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseVault, readText, verifySessionFixes } from "./verify-session-fixes";

const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-session-fixes-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("readText", () => {
  test("distinguishes a present file from an absent file without a check-then-use window", () => {
    const root = tempRoot();
    const path = join(root, "value.txt");
    expect(readText(path)).toEqual({ kind: "missing" });
    writeFileSync(path, "value", "utf8");
    expect(readText(path)).toEqual({ kind: "present", text: "value" });
  });
});

describe("parseVault", () => {
  test("returns typed invalid feedback instead of throwing", () => {
    expect(parseVault("not-json").kind).toBe("invalid");
    expect(parseVault("{}")).toEqual({ kind: "invalid", detail: "vaults must be an array" });
  });

  test("defaults absent connectivity to an empty observation set", () => {
    expect(parseVault('{"vaults":[]}')).toEqual({ kind: "parsed", value: { vaults: [], connectivity: [] } });
  });
});

describe("verifySessionFixes", () => {
  test("accepts a complete healthy fixture", () => {
    const root = tempRoot();
    const data = join(root, "data");
    mkdirSync(data);
    writeFileSync(join(data, "ci-runs.jsonl"), '{"run":1}\n', "utf8");
    writeFileSync(join(data, "rs-blocks.jsonl"), '{"startPhase":1,"endPhase":3}\n', "utf8");
    writeFileSync(
      join(data, "vault-state.json"),
      JSON.stringify({
        vaults: [{ status: "live" }, { status: "live" }, { status: "live" }, { status: "cold" }, { status: "cold" }],
        connectivity: [{ connectivity: 1 }, { connectivity: 0.75 }],
      }),
      "utf8",
    );

    expect(verifySessionFixes(root)).toBe(0);
  });

  test("reports all four checks when the data directory is absent", () => {
    expect(verifySessionFixes(tempRoot())).toBe(4);
  });
});
