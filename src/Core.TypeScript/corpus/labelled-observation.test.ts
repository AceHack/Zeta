// labelled-observation.test.ts — the falsifiers.
//
// Two claims carry this module and both are the kind that pass vacuously if tested lazily.
//
//   1. "EXTENSIBLE — labels nobody thought of work without a schema change." A test that only
//      exercises labels the author invented proves nothing; the author knew about those. The
//      falsifier has to use a namespace/name that appears NOWHERE in the source.
//   2. "CONFLICTING LABELS COEXIST." A test that adds two agreeing labels and counts two would pass
//      on a last-write-wins implementation. The falsifier has to add CONTRADICTORY labels and
//      demand both survive.
//
// The third is a negative-space test: no API exists that resolves a disagreement. That is asserted
// against the module's own exports, because the guarantee is about what is ABSENT.

import { describe, expect, test } from "bun:test";
import {
  addLabels,
  contestedKeys,
  isContested,
  labelRefusalReason,
  labelsFor,
  labelsFromSignatureBlock,
  renderLabelKey,
  type CorpusRow,
  type Label,
} from "./labelled-observation.ts";
import * as MODULE from "./labelled-observation.ts";

const row = (labels: Label[] = []): CorpusRow => ({
  observation: {
    id: "sha256:abc",
    origin: { corpus: "pr-archive", ref: "15893" },
    content: "the exchange, whatever it was",
    provenance: null,
  },
  labels,
});

const label = (ns: string, name: string, value: string, by: string, at = 1): Label => ({
  key: { namespace: ns, name },
  value,
  assertedBy: by,
  at,
});

describe("conflicting labels COEXIST — the raw-vault property", () => {
  test("two asserters disagreeing both survive; neither is dropped", () => {
    // Last-write-wins, first-write-wins, and dedup-by-key implementations all fail here.
    const { row: r } = addLabels(row(), [
      label("review", "verdict", "approve", "kira"),
      label("review", "verdict", "reject", "viktor"),
    ]);
    const vs = labelsFor(r, { namespace: "review", name: "verdict" });
    expect(vs).toHaveLength(2);
    expect(vs.map((l) => l.value).sort()).toEqual(["approve", "reject"]);
    expect(vs.map((l) => l.assertedBy).sort()).toEqual(["kira", "viktor"]);
  });

  test("NO API resolves a disagreement — the guarantee is what is absent", () => {
    // A `resolvedLabel` / `winningLabel` / `consensus` helper would make collapse the path of least
    // resistance. Asserted against the real export list so adding one fails this test rather than
    // quietly becoming the way everyone reads the corpus.
    const exported = Object.keys(MODULE);
    for (const forbidden of ["resolvedLabel", "winningLabel", "consensus", "resolve", "collapse"]) {
      expect(exported).not.toContain(forbidden);
    }
  });

  test("a disagreement is FOUND, not rejected — contested rows are the valuable ones", () => {
    const { row: r } = addLabels(row(), [
      label("review", "verdict", "approve", "kira"),
      label("review", "verdict", "reject", "viktor"),
      label("perf", "register", "flaky", "naledi"),
    ]);
    expect(isContested(r, { namespace: "review", name: "verdict" })).toBe(true);
    expect(isContested(r, { namespace: "perf", name: "register" })).toBe(false);
    expect(contestedKeys(r)).toEqual(["review/verdict"]);
  });

  test("two asserters AGREEING is not contested, but both assertions are still kept", () => {
    // Agreement must not be compressed either — who agreed is itself data.
    const { row: r } = addLabels(row(), [
      label("review", "verdict", "approve", "kira"),
      label("review", "verdict", "approve", "viktor"),
    ]);
    expect(isContested(r, { namespace: "review", name: "verdict" })).toBe(false);
    expect(labelsFor(r, { namespace: "review", name: "verdict" })).toHaveLength(2);
  });
});

describe("labels nobody thought of work with no schema change", () => {
  test("a namespace and name that appear NOWHERE in this module are accepted", () => {
    // The extensibility claim. Deliberately absurd and domain-foreign: if the implementation had a
    // roster, an enum, or a switch, this fails.
    const invented = label("bathymetry", "sediment-grain-class", "coarse-silt", "some-future-agent");
    expect(labelRefusalReason(invented)).toBeNull();
    const { row: r, refused } = addLabels(row(), [invented]);
    expect(refused).toHaveLength(0);
    expect(labelsFor(r, { namespace: "bathymetry", name: "sediment-grain-class" })).toHaveLength(1);
  });

  test("the same type carries a non-code domain — `generic` means generic", () => {
    const r: CorpusRow = {
      observation: {
        id: "sha256:def",
        origin: { corpus: "field-notes", ref: "2026-08-27-transect-4" },
        content: "not code, not a prompt, not a diff",
        provenance: null,
      },
      labels: [],
    };
    const { refused } = addLabels(r, [label("ecology", "canopy-cover", "0.62", "observer-a")]);
    expect(refused).toHaveLength(0);
  });

  test("shape is still enforced — open label SPACE, closed label SHAPE", () => {
    expect(labelRefusalReason(label("Review", "verdict", "x", "a"))).toMatch(/kebab-case/);
    expect(labelRefusalReason(label("review", "Verdict", "x", "a"))).toMatch(/kebab-case/);
    expect(labelRefusalReason(label("review", "verdict", "", "a"))).toMatch(/value is empty/);
    expect(labelRefusalReason({ ...label("review", "verdict", "x", "a"), at: -1 })).toMatch(/not a non-negative tick/);
  });

  test("an UNATTRIBUTED label is refused — you cannot disagree with nobody", () => {
    // The one field that cannot be optional. Without an asserter, two conflicting values are noise
    // rather than a disagreement, and the corpus's distinguishing property evaporates.
    const why = labelRefusalReason(label("review", "verdict", "approve", ""));
    expect(why).toMatch(/no asserter/);
    const { row: r, refused } = addLabels(row(), [label("review", "verdict", "approve", "")]);
    expect(refused).toHaveLength(1);
    expect(r.labels).toHaveLength(0);
  });

  test("a refusal does not stop the batch — refusals are data, not throws", () => {
    const { row: r, refused } = addLabels(row(), [
      label("review", "verdict", "approve", ""),
      label("review", "verdict", "reject", "viktor"),
    ]);
    expect(refused).toHaveLength(1);
    expect(r.labels).toHaveLength(1);
  });
});

describe("AgencySignature is half of this already", () => {
  const BLOCK = {
    "Agency-Signature-Version": "1",
    Agent: "shadow",
    "Agent-Runtime": "Claude Code",
    "Agent-Model": "claude-opus-5",
    "Credential-Identity": "AceHack",
    "Credential-Mode": "shared",
    "Human-Review": "not-implied-by-credential",
    "Human-Review-Evidence": "none",
    "Action-Mode": "human-directed",
    Task: "none",
  };

  test("all ten keys map to labels with NOTHING dropped", () => {
    const labels = labelsFromSignatureBlock(BLOCK, "shadow", 7);
    expect(labels).toHaveLength(10);
    expect(labels.every((l) => l.key.namespace === "agency-signature")).toBe(true);
    expect(labels.map((l) => renderLabelKey(l.key))).toContain("agency-signature/credential-mode");
    expect(labels.find((l) => l.key.name === "credential-mode")?.value).toBe("shared");
  });

  test("an UNRECOGNISED signature key survives — the open-label property on real data", () => {
    // A future eleventh key must not need an edit here. This is claim (1) exercised against the
    // surface most likely to grow.
    const labels = labelsFromSignatureBlock({ ...BLOCK, "Tick-Source": "external-loop" }, "shadow", 7);
    expect(labels).toHaveLength(11);
    expect(labels.find((l) => l.key.name === "tick-source")?.value).toBe("external-loop");
  });

  test("two agents' conflicting blocks BOTH land — the honest-disagreement case", () => {
    // This is the case AgencySignature already handles by handing the PR back. In the corpus it must
    // survive as two assertions rather than one winner, or the record of the hand-back is lost.
    const mine = labelsFromSignatureBlock({ "Credential-Mode": "shared" }, "shadow", 7);
    const theirs = labelsFromSignatureBlock({ "Credential-Mode": "operator-delegated" }, "riven", 8);
    const { row: r } = addLabels(row(), [...mine, ...theirs]);
    expect(isContested(r, { namespace: "agency-signature", name: "credential-mode" })).toBe(true);
    expect(labelsFor(r, { namespace: "agency-signature", name: "credential-mode" })).toHaveLength(2);
  });
});

describe("no ambient influence", () => {
  test("ticks are supplied — folding the same rows twice is byte-identical", () => {
    const a = labelsFromSignatureBlock({ Agent: "shadow" }, "shadow", 3);
    const b = labelsFromSignatureBlock({ Agent: "shadow" }, "shadow", 3);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // No wall-clock ISO string anywhere in the output.
    expect(JSON.stringify(a)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  test("label key ordering is ordinal, not locale-dependent", () => {
    const labels = labelsFromSignatureBlock({ Zebra: "z", apple: "a", Banana: "b" }, "x", 1);
    expect(labels.map((l) => l.key.name)).toEqual(["apple", "banana", "zebra"]);
  });
});
