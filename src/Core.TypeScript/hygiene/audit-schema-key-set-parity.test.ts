// audit-schema-key-set-parity.test.ts
//
// Each test here is a FALSIFIER: it fails if the extractor or the comparison is
// wrong, not merely if it throws. The two that matter most are:
//
//   - "the natural mutant" — the live `fidelity` divergence, reproduced from
//     source text, so the check is pinned to the real defect it was built for.
//   - "a schema pass-through is not a schema declaration" — a regression test
//     for a real bug in this file's first draft, which resolved
//     `Schema = readout.Schema` against the enclosing file's `let Schema` and
//     invented nine divergences in `zeta.darkhall.room-ui.v1` that do not exist.

import { describe, expect, test } from "bun:test";

import {
  camelCase,
  compare,
  extractFSharp,
  extractTypeScript,
  fsharpConstants,
  maskLiteralsAndComments,
  matchBrace,
  resolveFSharpSchemaValue,
  type DeclaredException,
  type SchemaBinding,
} from "./audit-schema-key-set-parity";

const TS_TEMPERATURE = `
export const TEMPERATURE_READOUT_SCHEMA = "zeta.temperature.readout.v1";

export interface TemperatureReadout {
  readonly schema: typeof TEMPERATURE_READOUT_SCHEMA;
  readonly source: string;
  readonly temperaturePpm: number;
  readonly band: TemperatureBand;
  readonly heatPpm: number;
  readonly uncertaintyPpm: number;
  readonly pressurePpm: number;
  readonly attentionPpm: number;
  readonly fidelity: ChannelFidelity;
}
`;

const FS_TEMPERATURE = `
module HeatReadout =
    let TemperatureSchema = "zeta.temperature.readout.v1"

module TemperatureReadout =
    let ofPpm source heatPpm uncertaintyPpm pressurePpm attentionPpm =
        { Schema = HeatReadout.TemperatureSchema
          Source = source
          TemperaturePpm = temperature
          Band = TemperatureBand.token band
          HeatPpm = heat
          UncertaintyPpm = uncertainty
          PressurePpm = pressure
          AttentionPpm = attention }
`;

/** Assert exactly one item and hand it back non-optional. */
function only<T>(items: readonly T[]): T {
  expect(items).toHaveLength(1);

  const [first] = items;

  if (first === undefined) {
    throw new Error("expected exactly one item");
  }

  return first;
}

describe("camelCase", () => {
  test("lowers only the first character", () => {
    expect(camelCase("TemperaturePpm")).toBe("temperaturePpm");
    expect(camelCase("Schema")).toBe("schema");
    expect(camelCase("HeatPpm")).toBe("heatPpm");
    // Must NOT lowercase the whole name — that would collapse distinct keys.
    expect(camelCase("PeakFrequencyPpm")).toBe("peakFrequencyPpm");
  });
});

describe("maskLiteralsAndComments", () => {
  test("preserves length and every newline, so indices stay aligned", () => {
    const text = 'let a = "x{y}z" // brace } here\nlet b = 1\n';
    const masked = maskLiteralsAndComments(text);

    expect(masked.length).toBe(text.length);
    expect([...masked].filter((c) => c === "\n").length).toBe([...text].filter((c) => c === "\n").length);
  });

  test("a brace inside a string or comment cannot move the depth counter", () => {
    const text = 'const s = "}}}"; // }}}\nconst t = { a: 1 };';
    const masked = maskLiteralsAndComments(text);

    expect(masked).not.toContain("}}}");
    // The only surviving braces are the real object literal's.
    expect([...masked].filter((c) => c === "}").length).toBe(1);
  });

  test("F# block comments (* ... *) are masked", () => {
    const masked = maskLiteralsAndComments("(* { Schema = \"zeta.a.v1\" } *)\nlet x = 1");

    expect(masked).not.toContain("zeta.a.v1");
    expect(masked).not.toContain("{");
  });
});

describe("matchBrace", () => {
  test("finds the matching close across nesting", () => {
    const text = "{ a { b } c }";

    expect(matchBrace(text, 0)).toBe(text.length - 1);
  });

  test("returns -1 when unbalanced", () => {
    expect(matchBrace("{ a { b }", 0)).toBe(-1);
  });
});

describe("TypeScript extraction", () => {
  test("binds an interface to a schema id via `typeof CONST`", () => {
    const binding = only(extractTypeScript(TS_TEMPERATURE, "heat.ts"));

    expect(binding.schemaId).toBe("zeta.temperature.readout.v1");
    expect(binding.oracle).toBe("typescript");
    expect(binding.fields.map((f) => f.key)).toEqual([
      "attentionPpm",
      "band",
      "fidelity",
      "heatPpm",
      "pressurePpm",
      "schema",
      "source",
      "temperaturePpm",
      "uncertaintyPpm",
    ]);
  });

  test("marks `name?:` optional and `name:` required", () => {
    const binding = only(extractTypeScript(
      `export interface R {
         readonly schema: "zeta.a.v1";
         readonly required: number;
         readonly maybe?: number;
       }`,
      "a.ts",
    ));

    expect(binding.fields.find((f) => f.key === "required")?.optional).toBe(false);
    expect(binding.fields.find((f) => f.key === "maybe")?.optional).toBe(true);
  });

  test("resolves `extends` so inherited keys are not under-reported", () => {
    const binding = only(extractTypeScript(
      `export interface Base { readonly rows: number; }
       export interface R extends Base {
         readonly schema: "zeta.a.v1";
       }`,
      "a.ts",
    ));

    expect(binding.fields.map((f) => f.key)).toEqual(["rows", "schema"]);
  });

  test("drops the binding when a base interface cannot be resolved", () => {
    // Under-reporting a key set would produce a FALSE divergence in the other
    // direction. Refusing to compare is the safe failure.
    const bindings = extractTypeScript(
      `export interface R extends SomewhereElse {
         readonly schema: "zeta.a.v1";
       }`,
      "a.ts",
    );

    expect(bindings).toHaveLength(0);
  });

  test("ignores an interface with no schema member", () => {
    expect(extractTypeScript(`export interface R { readonly a: number; }`, "a.ts")).toHaveLength(0);
  });
});

describe("F# extraction", () => {
  test("takes the key set from an exhaustive record literal, camel-cased", () => {
    const binding = only(extractFSharp(FS_TEMPERATURE, "Heat.fs"));

    expect(binding.schemaId).toBe("zeta.temperature.readout.v1");
    expect(binding.oracle).toBe("fsharp");
    expect(binding.fields.map((f) => f.key)).toEqual([
      "attentionPpm",
      "band",
      "heatPpm",
      "pressurePpm",
      "schema",
      "source",
      "temperaturePpm",
      "uncertaintyPpm",
    ]);
  });

  test("skips `{ r with ... }` copy-updates, which are not exhaustive", () => {
    const bindings = extractFSharp(
      `let s = "zeta.a.v1"
       let f r = { r with Schema = s }`,
      "A.fs",
    );

    expect(bindings).toHaveLength(0);
  });

  test("REGRESSION: a schema pass-through is not a schema declaration", () => {
    // `Schema = readout.Schema` copies another value's schema. Resolving its
    // tail identifier against the file's `let Schema` bound four heat-shaped
    // records to zeta.darkhall.room-ui.v1 and invented nine divergences.
    const bindings = extractFSharp(
      `module T =
    let Schema = "zeta.darkhall.room-ui.v1"

    let coreTemperatureReadout (readout: TranscriptTemperatureReadout) =
        { Schema = readout.Schema
          Source = readout.Source
          TemperaturePpm = readout.TemperaturePpm }`,
      "DarkHallRoomTranscript.fs",
    );

    expect(bindings).toHaveLength(0);
  });

  test("a module-qualified constant DOES resolve", () => {
    const consts = fsharpConstants(`let TemperatureSchema = "zeta.temperature.readout.v1"`);

    expect(resolveFSharpSchemaValue("HeatReadout.TemperatureSchema", consts, new Map())).toBe(
      "zeta.temperature.readout.v1",
    );
    // ...and a value-qualified one does not.
    expect(resolveFSharpSchemaValue("readout.TemperatureSchema", consts, new Map())).toBeUndefined();
  });

  test("an ambiguous cross-file constant resolves to nothing rather than to a guess", () => {
    const globals = new Map([["Schema", new Set(["zeta.a.v1", "zeta.b.v1"])]]);

    expect(resolveFSharpSchemaValue("Schema", new Map(), globals)).toBeUndefined();
    expect(resolveFSharpSchemaValue("Schema", new Map(), new Map([["Schema", new Set(["zeta.a.v1"])]]))).toBe(
      "zeta.a.v1",
    );
  });
});

function bindingOf(
  oracle: SchemaBinding["oracle"],
  schemaId: string,
  fields: readonly (string | [string, boolean])[],
): SchemaBinding {
  return {
    schemaId,
    oracle,
    typeName: "T",
    file: `${oracle}.src`,
    line: 1,
    fields: fields.map((f) => (typeof f === "string" ? { key: f, optional: false } : { key: f[0], optional: f[1] })),
  };
}

describe("compare", () => {
  test("THE NATURAL MUTANT: a required field in one oracle only is breaking", () => {
    const report = compare(
      [...extractTypeScript(TS_TEMPERATURE, "heat.ts"), ...extractFSharp(FS_TEMPERATURE, "Heat.fs")],
      [],
    );

    expect(report.comparedSchemas).toEqual(["zeta.temperature.readout.v1"]);
    expect(only(report.breaking)).toMatchObject({
      schemaId: "zeta.temperature.readout.v1",
      key: "fidelity",
      presentIn: "typescript",
      absentFrom: "fsharp",
      severity: "breaking",
    });
  });

  test("an OPTIONAL field in one oracle only is a compatible extension", () => {
    const report = compare(
      [
        bindingOf("typescript", "zeta.a.v1", ["schema", ["extra", true]]),
        bindingOf("fsharp", "zeta.a.v1", ["schema"]),
      ],
      [],
    );

    expect(report.breaking).toHaveLength(0);
    expect(report.compatible).toHaveLength(1);
    expect(only(report.compatible).severity).toBe("compatible");
  });

  test("VERSION BUMP is the escape hatch: v1 and v2 are never compared", () => {
    const report = compare(
      [
        bindingOf("typescript", "zeta.a.v2", ["schema", "extra"]),
        bindingOf("fsharp", "zeta.a.v1", ["schema"]),
      ],
      [],
    );

    expect(report.breaking).toHaveLength(0);
    expect(report.comparedSchemas).toEqual([]);
    expect(report.singleOracleSchemas).toEqual(["zeta.a.v1", "zeta.a.v2"]);
  });

  test("divergence WITHIN a version is still caught after a sibling bump exists", () => {
    const report = compare(
      [
        bindingOf("typescript", "zeta.a.v2", ["schema"]),
        bindingOf("fsharp", "zeta.a.v2", ["schema"]),
        bindingOf("typescript", "zeta.a.v1", ["schema", "extra"]),
        bindingOf("fsharp", "zeta.a.v1", ["schema"]),
      ],
      [],
    );

    expect(report.breaking).toHaveLength(1);
    expect(only(report.breaking).schemaId).toBe("zeta.a.v1");
  });

  test("a schema bound in only one oracle is reported, never failed", () => {
    const report = compare([bindingOf("typescript", "zeta.only.v1", ["schema", "a"])], []);

    expect(report.breaking).toHaveLength(0);
    expect(report.comparedSchemas).toEqual([]);
    expect(report.singleOracleSchemas).toEqual(["zeta.only.v1"]);
  });

  test("both directions: an F#-only key is breaking too", () => {
    const report = compare(
      [bindingOf("typescript", "zeta.a.v1", ["schema"]), bindingOf("fsharp", "zeta.a.v1", ["schema", "onlyInFs"])],
      [],
    );

    expect(only(report.breaking)).toMatchObject({ presentIn: "fsharp", absentFrom: "typescript", key: "onlyInFs" });
  });

  test("a declared exception is accepted and moves out of `breaking`", () => {
    const declared: DeclaredException = {
      schema: "zeta.a.v1",
      key: "extra",
      presentIn: "typescript",
      absentFrom: "fsharp",
      reason: "owned elsewhere",
      workitem: "081M010WYE5087G0R003J89QVF",
    };

    const report = compare(
      [bindingOf("typescript", "zeta.a.v1", ["schema", "extra"]), bindingOf("fsharp", "zeta.a.v1", ["schema"])],
      [declared],
    );

    expect(report.breaking).toHaveLength(0);
    expect(report.declaredAccepted).toHaveLength(1);
    expect(report.staleExceptions).toHaveLength(0);
  });

  test("an exception is scoped: it does not mute a DIFFERENT key or schema", () => {
    const declared: DeclaredException = {
      schema: "zeta.a.v1",
      key: "extra",
      presentIn: "typescript",
      absentFrom: "fsharp",
      reason: "owned elsewhere",
      workitem: "W",
    };

    const report = compare(
      [bindingOf("typescript", "zeta.a.v1", ["schema", "other"]), bindingOf("fsharp", "zeta.a.v1", ["schema"])],
      [declared],
    );

    expect(report.breaking).toHaveLength(1);
    expect(only(report.breaking).key).toBe("other");
  });

  test("a STALE exception fails: the file cannot rot into a blanket mute", () => {
    const declared: DeclaredException = {
      schema: "zeta.a.v1",
      key: "long-since-fixed",
      presentIn: "typescript",
      absentFrom: "fsharp",
      reason: "fixed",
      workitem: "W",
    };

    const report = compare(
      [bindingOf("typescript", "zeta.a.v1", ["schema"]), bindingOf("fsharp", "zeta.a.v1", ["schema"])],
      [declared],
    );

    expect(report.breaking).toHaveLength(0);
    expect(report.staleExceptions).toHaveLength(1);
    expect(only(report.staleExceptions).key).toBe("long-since-fixed");
  });

  test("identical key sets produce nothing at all", () => {
    const report = compare(
      [
        bindingOf("typescript", "zeta.a.v1", ["schema", "a", "b"]),
        bindingOf("fsharp", "zeta.a.v1", ["schema", "a", "b"]),
      ],
      [],
    );

    expect(report.breaking).toHaveLength(0);
    expect(report.compatible).toHaveLength(0);
    expect(report.comparedSchemas).toEqual(["zeta.a.v1"]);
  });

  test("a key required at ANY site in an oracle counts as required", () => {
    const report = compare(
      [
        bindingOf("typescript", "zeta.a.v1", ["schema", ["extra", true]]),
        bindingOf("typescript", "zeta.a.v1", ["schema", "extra"]),
        bindingOf("fsharp", "zeta.a.v1", ["schema"]),
      ],
      [],
    );

    expect(report.breaking).toHaveLength(1);
  });
});

describe("the mechanism does not fire on a mere mention", () => {
  test("zeta.multisig.v1 shape: a signing domain and a negative assertion are not bindings", () => {
    // F# declares it as a signing-domain constant with no record; TypeScript's
    // only mention asserts a DIFFERENT domain is deliberately not equal to it.
    // A string-intersection check would have paired these.
    const fs = extractFSharp(`module M =\n    let SigningDomain = "zeta.multisig.v1"`, "M.fs");
    const ts = extractTypeScript(
      `export const PHASE_STAMP_DOMAIN = "zeta.phase-stamp.v1";
       // DELIBERATELY different from "zeta.multisig.v1".`,
      "s.ts",
    );

    expect(fs).toHaveLength(0);
    expect(ts).toHaveLength(0);
    expect(compare([...fs, ...ts], []).comparedSchemas).toEqual([]);
  });
});
