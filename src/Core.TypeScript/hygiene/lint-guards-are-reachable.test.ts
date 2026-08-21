// src/Core.TypeScript/hygiene/lint-guards-are-reachable.test.ts
//
// Falsifiers for the audit that catches "present, tested, unreachable".
//
// The markers below are ASSEMBLED from GUARD_MARKER rather than written out,
// so this file is not itself a declaration when the audit walks the repo.

import { describe, expect, test } from "bun:test";

import {
  auditSources,
  checkDeclaredInputsAreSupplied,
  checkExpectationsNotDefaultedToObserved,
  extractCallArguments,
  GUARD_MARKER,
  isTestFile,
  parseGuardDeclarations,
  stripComments,
  type SourceFile,
} from "./lint-guards-are-reachable.ts";

const DECL =
  "// " + GUARD_MARKER + " classifyDeviceState requires headDigestHex, expectedHeadDigestHex -- rule R1\n";

const GUARD_FILE = (): SourceFile => ({
  path: "src/zflash/verify.ts",
  text: DECL + "export function classifyDeviceState(ev: Evidence) { return ev; }\n",
});

describe("parsing the marker", () => {
  test("fn name, fields and note all survive", () => {
    const d = parseGuardDeclarations(DECL, "verify.ts");
    expect(d).toHaveLength(1);
    expect(d[0]?.fnName).toBe("classifyDeviceState");
    expect([...(d[0]?.requiredFields ?? [])]).toEqual([
      "headDigestHex",
      "expectedHeadDigestHex",
    ]);
    expect(d[0]?.note).toBe("rule R1");
  });

  test("a marker with no fields is not a declaration", () => {
    expect(parseGuardDeclarations("// " + GUARD_MARKER + " foo requires  -- nothing\n", "x")).toHaveLength(0);
  });
});

describe("call-site extraction", () => {
  test("a multi-line object argument is captured whole, parens and all", () => {
    const src = "const c = classifyDeviceState({\n  a: f(1),\n  b: 2,\n});\n";
    const args = extractCallArguments(src, "classifyDeviceState");
    expect(args).toHaveLength(1);
    expect(args[0]).toContain("b: 2");
  });

  test("the DEFINITION is not a call site -- a guard cannot satisfy itself", () => {
    const src = "export function classifyDeviceState(ev: E) { return ev; }\n";
    expect(extractCallArguments(src, "classifyDeviceState")).toHaveLength(0);
  });

  test("a method call on another object is not this function", () => {
    const src = "other.classifyDeviceState({ headDigestHex: x });\n";
    expect(extractCallArguments(src, "classifyDeviceState")).toHaveLength(0);
  });
});

describe("RULE A -- a guard whose inputs nobody supplies", () => {
  test(
    "THE LIVE DEFECT, REPLAYED: the only production caller omits both digest " +
      "fields -> finding",
    () => {
      const files: SourceFile[] = [
        GUARD_FILE(),
        {
          path: "src/zflash/flash-usb.ts",
          text: "classifyDeviceState({ partitionScheme: s, partitions: p, totalSizeBytes: n });\n",
        },
      ];
      const f = auditSources(files);
      expect(f).toHaveLength(1);
      expect(f[0]?.rule).toBe("A-unsupplied-guard-input");
      expect(f[0]?.detail).toContain("headDigestHex");
    },
  );

  test("THE FIX, REPLAYED: the same caller supplying both fields -> clean", () => {
    const files: SourceFile[] = [
      GUARD_FILE(),
      {
        path: "src/zflash/flash-usb.ts",
        text:
          "classifyDeviceState({ partitionScheme: s, headDigestHex, expectedHeadDigestHex });\n",
      },
    ];
    expect(auditSources(files)).toHaveLength(0);
  });

  test("A TEST FILE IS NOT A SUPPLIER -- the whole point of the audit", () => {
    const files: SourceFile[] = [
      GUARD_FILE(),
      {
        path: "src/zflash/verify.test.ts",
        text: "classifyDeviceState({ headDigestHex: A, expectedHeadDigestHex: B });\n",
      },
    ];
    const f = auditSources(files);
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("A-no-production-caller");
  });

  test("a guard NOTHING calls is a finding, not a pass", () => {
    const f = auditSources([GUARD_FILE()]);
    expect(f[0]?.rule).toBe("A-no-production-caller");
  });

  test("ONE supplying caller is enough, even beside a caller that omits them", () => {
    const files: SourceFile[] = [
      GUARD_FILE(),
      { path: "src/a.ts", text: "classifyDeviceState({ partitionScheme: s });\n" },
      {
        path: "src/b.ts",
        text: "classifyDeviceState({ headDigestHex, expectedHeadDigestHex });\n",
      },
    ];
    expect(auditSources(files)).toHaveLength(0);
  });

  test("supplying only ONE of two required fields still fails", () => {
    const files: SourceFile[] = [
      GUARD_FILE(),
      { path: "src/a.ts", text: "classifyDeviceState({ headDigestHex });\n" },
    ];
    const f = checkDeclaredInputsAreSupplied(
      parseGuardDeclarations(files[0]!.text, files[0]!.path),
      files,
    );
    expect(f).toHaveLength(1);
    expect(f[0]?.detail).toContain("expectedHeadDigestHex");
  });

  test("a call inside a COMMENT does not count as a supplier (fails closed)", () => {
    const files: SourceFile[] = [
      GUARD_FILE(),
      {
        path: "src/a.ts",
        text: "// classifyDeviceState({ headDigestHex, expectedHeadDigestHex });\n",
      },
    ];
    expect(auditSources(files)).toHaveLength(1);
  });
});

describe("RULE B -- an expectation that defaults to the observation", () => {
  test("THE LIVE DEFECT, REPLAYED: field-by-field fallback to observed", () => {
    const src = [
      "const expectedIdentity: DeviceIdentity = {",
      "  devicePath: expectDevice ?? observedIdentity.devicePath,",
      "  busProtocol: observedIdentity.busProtocol,",
      "};",
    ].join("\n");
    const f = checkExpectationsNotDefaultedToObserved(src, "flash-usb.ts");
    expect(f).toHaveLength(1);
    expect(f[0]?.rule).toBe("B-expectation-defaults-to-observed");
    expect(f[0]?.detail).toContain("observedIdentity");
  });

  test("the || form is caught too, not just ??", () => {
    const src = "const expectSize = stated || observedSize;";
    expect(checkExpectationsNotDefaultedToObserved(src, "x.ts")).toHaveLength(1);
  });

  test("THE FIX, REPLAYED: a pin built only from stated values is clean", () => {
    const src = [
      "const statedPin: StatedTargetPin = {",
      "  devicePath: expectDevice,",
      "  sizeBytes: expectSize,",
      "};",
    ].join("\n");
    expect(checkExpectationsNotDefaultedToObserved(src, "x.ts")).toHaveLength(0);
  });

  test("comparing an expectation to an observation is FINE -- only defaulting is not", () => {
    const src = "const ok = checkStatedPin(statedPin, observedIdentity);";
    expect(checkExpectationsNotDefaultedToObserved(src, "x.ts")).toHaveLength(0);
  });
});

describe("comment stripping", () => {
  test("a URL inside a string survives -- strings are tracked", () => {
    const src = "const u = " + String.fromCharCode(34) + "https://x/y" + String.fromCharCode(34) + "; const v = 1;";
    expect(stripComments(src)).toContain("const v = 1");
  });

  test("a block comment is blanked but line count is preserved", () => {
    const src = "a;\n/* one\ntwo */\nb;";
    const out = stripComments(src);
    expect(out.split("\n")).toHaveLength(4);
    expect(out).not.toContain("one");
    expect(out).toContain("b;");
  });
});

describe("what counts as a test file", () => {
  test("the three shapes the repo actually uses", () => {
    expect(isTestFile("a/b.test.ts")).toBe(true);
    expect(isTestFile("a/b.spec.ts")).toBe(true);
    expect(isTestFile("src/Core.TypeScript/zflash/test-harness/x.ts")).toBe(true);
    expect(isTestFile("src/Core.TypeScript/zflash/flash-usb.ts")).toBe(false);
  });
});
