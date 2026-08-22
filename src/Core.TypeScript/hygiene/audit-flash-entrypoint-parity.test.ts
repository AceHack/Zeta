// src/Core.TypeScript/hygiene/audit-flash-entrypoint-parity.test.ts
//
// Falsifiers for the parity audit, plus the audit run against the REAL arms.
//
// The last describe block is the one that matters: it reads the three shipped
// zflash arms off disk and asserts zero findings. That is the only assertion
// here that can go red because of a change somewhere else in the tree, which
// is what makes this file a guard on the arms rather than only on the audit.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  armFilenames,
  auditAll,
  auditArm,
  DESTRUCTIVE_TOKENS,
  GATE_FN,
  mainBody,
  stripComments,
} from "./audit-flash-entrypoint-parity.ts";

/** A minimal arm that satisfies every rule — the baseline each mutant departs from. */
const COMPLIANT = `
async function main(): Promise<void> {
  const integrity = await ${GATE_FN}(isoPath, realIsoIntegrityIo());
  if (!integrity.ok) bail(2, integrity.message);
  const child = spawn(ddProgram, ddRest, { stdio: "inherit" });
}
`;

describe("the roster is derived from the directory", () => {
  test("picks up flash-usb.ts and every flash-usb-<host>.ts", () => {
    expect(
      armFilenames([
        "flash-usb.ts",
        "flash-usb-linux.ts",
        "flash-usb-windows.ts",
        "flash-usb-linux.test.ts",
        "flash-and-inject.ts",
        "verify.ts",
        "iso-integrity.ts",
      ]),
    ).toEqual(["flash-usb-linux.ts", "flash-usb-windows.ts", "flash-usb.ts"]);
  });

  test("A FOURTH ARM IS AUDITED THE DAY IT APPEARS — nothing to add to a list", () => {
    expect(armFilenames(["flash-usb-freebsd.ts"])).toEqual(["flash-usb-freebsd.ts"]);
  });
});

describe("the audit refuses what it exists to refuse", () => {
  test("a compliant arm produces no findings", () => {
    expect(auditArm("compliant.ts", stripComments(COMPLIANT))).toEqual([]);
  });

  test("THE LIVE DEFECT: an arm with no gate at all is reported", () => {
    const noGate = `
async function main(): Promise<void> {
  const child = spawn(ddProgram, ddRest, { stdio: "inherit" });
}
`;
    const f = auditArm("linux.ts", stripComments(noGate));
    expect(f.map((x) => x.rule)).toEqual(["gate-absent"]);
    expect(f[0]?.detail).toContain("iso-integrity.ts");
  });

  test("a gate placed AFTER the write is reported", () => {
    const late = `
async function main(): Promise<void> {
  const child = spawn(ddProgram, ddRest, { stdio: "inherit" });
  const integrity = await ${GATE_FN}(isoPath, realIsoIntegrityIo());
  if (!integrity.ok) bail(2, integrity.message);
}
`;
    expect(auditArm("late.ts", stripComments(late)).map((x) => x.rule)).toEqual(["gate-after-write"]);
  });

  test("a gate whose verdict is computed and IGNORED is reported", () => {
    const ignored = `
async function main(): Promise<void> {
  const integrity = await ${GATE_FN}(isoPath, realIsoIntegrityIo());
  if (!integrity.ok) process.stdout.write("warning: " + integrity.message);
  const child = spawn(ddProgram, ddRest, { stdio: "inherit" });
}
`;
    expect(auditArm("warn.ts", stripComments(ignored)).map((x) => x.rule)).toEqual([
      "gate-refusal-not-wired",
    ]);
  });

  test("THE MUTANT THAT SURVIVED THE FIRST VERSION: a warning, with an unrelated bail nearby", () => {
    // This rule used to look for `bail(` anywhere in the 400 characters after
    // the call, and this shape defeated it. The arm downgrades the refusal to a
    // warning and then hits a completely different guard that does bail —
    // enough to satisfy a character window, and not enough to stop an
    // unverified ISO from reaching the device.
    const nearbyBail = `
async function main(): Promise<void> {
  const integrity = await ${GATE_FN}(isoPath, realIsoIntegrityIo());
  if (!integrity.ok) process.stdout.write("warning: " + integrity.message);
  else process.stdout.write(integrity.report);

  const lsblkPath = fx.which("lsblk");
  if (lsblkPath === null) bail(2, "lsblk is not on PATH (install util-linux)");
  const child = spawn(ddProgram, ddRest, { stdio: "inherit" });
}
`;
    expect(auditArm("nearby.ts", stripComments(nearbyBail)).map((x) => x.rule)).toEqual([
      "gate-refusal-not-wired",
    ]);
  });

  test("a BRACED failure branch that bails is accepted — the rule is structural, not stylistic", () => {
    const braced = `
async function main(): Promise<void> {
  const integrity = await ${GATE_FN}(isoPath, realIsoIntegrityIo());
  if (!integrity.ok) {
    process.stdout.write("refusing\\n");
    bail(2, integrity.message);
  }
  const child = spawn(ddProgram, ddRest, { stdio: "inherit" });
}
`;
    expect(auditArm("braced.ts", stripComments(braced))).toEqual([]);
  });

  test("a gate whose result is bound to NOTHING is reported — nothing can branch on it", () => {
    const unbound = `
async function main(): Promise<void> {
  await ${GATE_FN}(isoPath, realIsoIntegrityIo());
  const child = spawn(ddProgram, ddRest, { stdio: "inherit" });
}
`;
    expect(auditArm("unbound.ts", stripComments(unbound)).map((x) => x.rule)).toEqual([
      "gate-result-discarded",
    ]);
  });

  test("AN ARM THAT NEVER WRITES IS A FINDING, not a vacuous pass", () => {
    const noWrite = `
async function main(): Promise<void> {
  const integrity = await ${GATE_FN}(isoPath, realIsoIntegrityIo());
  if (!integrity.ok) bail(2, integrity.message);
}
`;
    expect(auditArm("nowrite.ts", stripComments(noWrite)).map((x) => x.rule)).toEqual([
      "no-destructive-operation",
    ]);
  });

  test("an entrypoint this audit cannot locate is a finding, never a silent skip", () => {
    expect(auditArm("weird.ts", stripComments("function go() {}")).map((x) => x.rule)).toEqual([
      "no-main",
    ]);
  });

  test("AN EMPTY ROSTER FAILS — an audit with nothing to audit is not a passing audit", () => {
    expect(auditAll([]).length).toBe(1);
  });
});

describe("the audit cannot be satisfied by a comment", () => {
  test("FAILS OPEN OTHERWISE: a gate call inside a comment does not count as a call", () => {
    const commented = `
async function main(): Promise<void> {
  // we should call ${GATE_FN}(isoPath, io) here one day
  /* ${GATE_FN}(isoPath, io); bail(2, "x"); */
  const child = spawn(ddProgram, ddRest, { stdio: "inherit" });
}
`;
    expect(auditArm("commented.ts", stripComments(commented)).map((x) => x.rule)).toEqual([
      "gate-absent",
    ]);
  });

  test("stripComments keeps offsets, so index comparisons stay meaningful", () => {
    const src = "abc // xx\ndef";
    expect(stripComments(src).length).toBe(src.length);
    expect(stripComments(src).indexOf("def")).toBe(src.indexOf("def"));
  });

  test("a token inside a STRING is left alone — strings are code, comments are not", () => {
    expect(stripComments('const s = "a // b";').includes("a // b")).toBe(true);
  });

  test("mainBody starts at the declaration, so pre-main definitions never count", () => {
    const src = `export function ddArgs() {}\nasync function main() { ${GATE_FN}(a); }`;
    const body = mainBody(src);
    expect(body).not.toBeNull();
    expect(body?.startsWith("async function main")).toBe(true);
    expect(body?.includes("export function ddArgs")).toBe(false);
  });
});

describe("THE REAL ARMS — this is the assertion the fix has to keep true", () => {
  const dir = join(import.meta.dir, "..", "zflash");
  const arms = armFilenames(readdirSync(dir));

  test("all three shipped host arms exist and are on the roster", () => {
    expect(arms).toEqual(["flash-usb-linux.ts", "flash-usb-windows.ts", "flash-usb.ts"]);
  });

  test("every shipped arm reaches the ISO integrity gate before it writes", () => {
    const findings = auditAll(
      arms.map((arm) => ({ arm, text: readFileSync(join(dir, arm), "utf8") })),
    );
    expect(findings.map((f) => f.arm + ": " + f.rule)).toEqual([]);
  });

  test("each arm's destructive operation is one this audit knows how to see", () => {
    for (const arm of arms) {
      const body = mainBody(stripComments(readFileSync(join(dir, arm), "utf8"))) ?? "";
      expect(DESTRUCTIVE_TOKENS.some((t) => body.includes(t))).toBe(true);
    }
  });
});
