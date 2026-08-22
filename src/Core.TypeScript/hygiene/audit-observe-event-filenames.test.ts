/**
 * audit-observe-event-filenames.test.ts
 *
 * The audit's own falsifier. The case that matters is `rejects a hex-encoded JSON
 * name`: that input is 32 lowercase hex characters, so it passes every shape check the
 * repo had on 2026-08-14, and an audit that let it through would be decorative.
 */
import { describe, expect, test } from "bun:test";

import { SOCIETY_BNN_FILENAME } from "../planning/society-bnn";

import {
  COMPANION_NAMES,
  FROZEN_LEGACY_NAMES,
  SCAN_FLOOR,
  auditFilename,
  auditFilenames,
} from "./audit-observe-event-filenames";

describe("auditFilename — accepts the known schemes", () => {
  test("accepts a real ZetaId name (v1 in the version field)", () => {
    // Built by `deriveAttestationId`, so this is a name the producer actually emits.
    const id = "0808f7dd1f95c000000000000000000a";
    expect(auditFilename(`${id}.json`)).toBeNull();
  });

  test("accepts the society scheme and its index", () => {
    expect(auditFilename("society-msmaqqb7.json")).toBeNull();
    expect(auditFilename("society-index.json")).toBeNull();
  });

  test("accepts the dot-prefixed replay-state buffers", () => {
    expect(auditFilename(".rs-buffer-otto.json")).toBeNull();
    expect(auditFilename(".rs-buffer-alexa.json")).toBeNull();
  });

  test("accepts the three frozen legacy names, and only those three", () => {
    for (const n of FROZEN_LEGACY_NAMES) expect(auditFilename(n)).toBeNull();
    // A fourth name of the same shape is NOT covered by the allowlist.
    expect(auditFilename("7b226174746573746f72223a22626f62.json")).not.toBeNull();
  });
});

describe("auditFilename — rejects", () => {
  test("rejects a hex-encoded JSON name (THE case: 32 hex, passes every naive check)", () => {
    const finding = auditFilename("7b226e6577223a2274686973206973206e".slice(0, 32) + ".json");
    expect(finding).not.toBeNull();
    expect(finding!.problem).toContain("version");
  });

  test("names the ASCII it decodes to, so the diagnosis is in the message", () => {
    const finding = auditFilename("7b226174746573746f72223a22626f62.json");
    // The message JSON-quotes the decoded text, so match the quoted form.
    expect(finding!.problem).toContain(JSON.stringify('{"attestor":"bob'));
  });

  test("rejects a novel scheme with no distinguishing prefix", () => {
    expect(auditFilename("tick-2026-08-14.json")).not.toBeNull();
    expect(auditFilename("attestation-otto-1.json")).not.toBeNull();
  });

  test("rejects a non-json file", () => {
    const finding = auditFilename("notes.txt");
    expect(finding).not.toBeNull();
    expect(finding!.problem).toContain("only events");
  });

  test("rejects uppercase hex — the canonical form is lowercase", () => {
    expect(auditFilename("0808F7DD1F95C000000000000000000A.json")).not.toBeNull();
  });
});

describe("auditFilenames — corpus assertions", () => {
  test("reports every bad name, not just the first", () => {
    const r = auditFilenames([
      "society-abc.json",
      "7b226174746573746f72223a22626f62.json",
      "tick-1.json",
    ]);
    expect(r.findings.length).toBe(2);
    expect(r.scanned).toBe(3);
  });

  test("notices a frozen legacy file that has gone missing", () => {
    const r = auditFilenames(["society-abc.json"]);
    expect(r.missingFrozen.length).toBe(FROZEN_LEGACY_NAMES.length);
  });

  test("reports no missing-frozen when all three are present", () => {
    const r = auditFilenames([...FROZEN_LEGACY_NAMES]);
    expect(r.missingFrozen).toEqual([]);
  });

  test("the scan floor is a real number, not zero", () => {
    // A floor of 0 would make the floor check unfailable — the defect this pattern exists
    // to prevent. Stated as a test so lowering it to nothing is a deliberate, visible act.
    expect(SCAN_FLOOR).toBeGreaterThan(100);
  });
});

describe("companion files are allowed by NAME, and the names are held to their producers", () => {
  // `bnn-state.json` reached main via #10708 and turned `lint (structural hygiene)` red
  // for every open PR, because the gate that would have caught it on the society lane had
  // itself been parked for days (#11227). Allowing it is right — it is a rollup, not an
  // event — but an allowlist that drifts from its producer is how an exception quietly
  // becomes a hole, so the link is asserted rather than commented.

  test("the bnn companion entry IS the producer's exported constant", () => {
    // Rename `SOCIETY_BNN_FILENAME` and this fails here, loudly, instead of the audit
    // silently allowing a filename nothing writes any more while rejecting the new one.
    expect(COMPANION_NAMES.has(SOCIETY_BNN_FILENAME)).toBe(true);
  });

  test("each companion is accepted", () => {
    for (const name of COMPANION_NAMES) {
      expect(auditFilename(name)).toBeNull();
    }
  });

  test("the allowlist is a CLOSED list of names, not a `*-state.json` pattern", () => {
    // The load-bearing assertion. Had the fix widened the shape instead of naming the
    // file, this would pass with a null — and the audit would have stopped catching the
    // class it exists for. A lookalike must still be refused.
    const finding = auditFilename("bnn-state-2.json");
    expect(finding).not.toBeNull();
    expect(finding?.problem).toContain("matches no known scheme");

    expect(auditFilename("other-state.json")).not.toBeNull();
  });
});
