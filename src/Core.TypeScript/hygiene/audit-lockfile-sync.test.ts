import { describe, expect, test } from "bun:test";
import { DRIFT_CLASS, classify, renderFinding } from "./audit-lockfile-sync";

describe("classify — desync vs merely broken", () => {
  test("exit 0 is in sync", () => {
    expect(classify(0, "Checked 377 installs across 372 packages (no changes)").kind).toBe(
      "in-sync",
    );
  });

  test("bun's frozen-lockfile message is the ONLY desync signal", () => {
    const v = classify(1, "error: lockfile had changes, but lockfile is frozen");
    expect(v.kind).toBe("desync");
  });

  test("a network failure is INDETERMINATE, never desync", () => {
    // Reporting a blip as dependency drift would pollute the ledger and invite a
    // healer to 'fix' a lockfile that was never wrong.
    const v = classify(1, "error: failed to resolve registry.npmjs.org: connection refused");
    expect(v.kind).toBe("indeterminate");
    if (v.kind === "indeterminate") expect(v.detail).toContain("failed to resolve");
  });

  test("a missing binary is INDETERMINATE", () => {
    expect(classify(127, "bun: command not found").kind).toBe("indeterminate");
  });

  test("indeterminate surfaces bun's first error line, not a generic message", () => {
    const v = classify(1, "some noise\n  error: EACCES permission denied\nmore noise");
    expect(v.kind).toBe("indeterminate");
    if (v.kind === "indeterminate") expect(v.detail).toBe("error: EACCES permission denied");
  });

  test("matching is case-insensitive and tolerates surrounding output", () => {
    const v = classify(1, "bun install v1.3.14\nError: Lockfile had changes, but lockfile is frozen\n");
    expect(v.kind).toBe("desync");
  });
});

describe("renderFinding — the drift-ledger contract", () => {
  test("emits `<tracked-path>:<line> CLASS/subclass message`", () => {
    const line = renderFinding({ kind: "desync", detail: "deps changed" });
    expect(line.startsWith(`package.json:1 ${DRIFT_CLASS}/lockfile-desync `)).toBe(true);
  });

  test("the path is git-tracked so it survives the sweep's --tracked guard", () => {
    // An untracked path is dropped by drift-sweep and the finding vanishes silently.
    expect(renderFinding({ kind: "desync", detail: "x" }).split(":")[0]).toBe("package.json");
  });

  test("names the heal, since the whole point is a zero-intelligence fix", () => {
    expect(renderFinding({ kind: "desync", detail: "x" })).toContain("bun install");
  });

  test("emits nothing when in sync or indeterminate", () => {
    expect(renderFinding({ kind: "in-sync" })).toBe("");
    expect(renderFinding({ kind: "indeterminate", detail: "x" })).toBe("");
  });
});
