import { describe, expect, test } from "bun:test";
import {
  bindings,
  casesMappedToTrue,
  classToSignalMap,
  signalToClassMap,
  kindContainsCallers,
  kindLiterals,
  pressureDecidingBindings,
  pressureTables,
  stripFSharpComments,
  tokenPredicates,
  run,
} from "./lint-heat-kind-classifier-agreement.ts";

/**
 * A minimal `Heat.fs` in the shape main ACTUALLY has after #10804 + 081M07Z23EX087G0R003N676FT:
 * `classifyKind` is the one ordered chain and the only consumer of the raw probes, ONE table
 * (`isPressureClass`, keyed on `KindClass`) names the pressure bit, and both routes derive —
 * `isPressureKind = classifyKind >> isPressureClass`, `isPressure = classOf >> isPressureClass`.
 *
 * The first draft of this lint fixtured the *pre*-#10804 shape (`ofKind` as the classifier) and
 * pinned that name, which is why it went red on a correct main. The fixture is the model; if it
 * is wrong the lint is wrong, so it is kept honest against the real file by the `run` cases.
 */
const HEAT_FIXED = `
[<RequireQualifiedAccess>]
module HeatSignature =

    let private kindContains (needle: string) (kind: string) : bool =
        not (String.IsNullOrEmpty kind) && kind.Contains(needle, StringComparison.OrdinalIgnoreCase)

    let isBackpressureKind (kind: string) : bool =
        kindContains "backpressure" kind

    let isDeniedKind (kind: string) : bool =
        kindContains "denied" kind || kindContains "reject" kind

    let isForgettingKind (kind: string) : bool =
        kindContains "forgotten" kind || kindContains "forget" kind || kindContains "prune" kind

    let isStorageErrorKind (kind: string) : bool =
        kindContains "storage" kind

    let isInvalidKind (kind: string) : bool =
        kindContains "invalid" kind

    let isExpiredKind (kind: string) : bool =
        kindContains "expired" kind || kindContains "ttl" kind

    let isStaleKind (kind: string) : bool =
        kindContains "stale" kind

    let classifyKind (kind: string) : KindClass =
        if isBackpressureKind kind then KindClass.Backpressure
        elif isDeniedKind kind then KindClass.Denied
        elif isForgettingKind kind then KindClass.Forgotten
        elif isStorageErrorKind kind then KindClass.StorageError
        elif isInvalidKind kind then KindClass.Invalid
        elif isExpiredKind kind then KindClass.Expired
        elif isStaleKind kind then KindClass.Stale
        else KindClass.Other

    let isPressureClass =
        function
        | KindClass.Backpressure
        | KindClass.Denied -> true
        | KindClass.Forgotten
        | KindClass.StorageError
        | KindClass.Invalid
        | KindClass.Expired
        | KindClass.Stale
        | KindClass.Other -> false

    let isPressureKind (kind: string) : bool = kind |> classifyKind |> isPressureClass

[<RequireQualifiedAccess>]
module HeatSignal =

    let ofKind (kind: string) : HeatSignal =
        match HeatSignature.classifyKind kind with
        | HeatSignature.KindClass.Backpressure -> HeatSignal.Backpressure
        | HeatSignature.KindClass.Denied -> HeatSignal.Denied
        | HeatSignature.KindClass.Forgotten -> HeatSignal.Forgotten
        | HeatSignature.KindClass.StorageError -> HeatSignal.StorageError
        | HeatSignature.KindClass.Invalid -> HeatSignal.Invalid
        | HeatSignature.KindClass.Expired -> HeatSignal.Expired
        | HeatSignature.KindClass.Stale -> HeatSignal.Stale
        | HeatSignature.KindClass.Other -> HeatSignal.Other kind

    let classOf =
        function
        | HeatSignal.Backpressure -> HeatSignature.KindClass.Backpressure
        | HeatSignal.Denied -> HeatSignature.KindClass.Denied
        | HeatSignal.Forgotten -> HeatSignature.KindClass.Forgotten
        | HeatSignal.StorageError -> HeatSignature.KindClass.StorageError
        | HeatSignal.Invalid -> HeatSignature.KindClass.Invalid
        | HeatSignal.Expired -> HeatSignature.KindClass.Expired
        | HeatSignal.Stale -> HeatSignature.KindClass.Stale
        | HeatSignal.Other _ -> HeatSignature.KindClass.Other

    let isPressure (signal: HeatSignal) : bool =
        signal |> classOf |> HeatSignature.isPressureClass
`;

/**
 * The PRE-#10804 defect, verbatim in structure: `isPressureKind` decides pressure by its own
 * substring disjunction, beside the ordered chain. This is the thing the lint exists to refuse,
 * and every relaxation below is judged against it.
 */
const HEAT_TWO_CLASSIFIERS = HEAT_FIXED.replace(
  `    let isPressureKind (kind: string) : bool = kind |> classifyKind |> isPressureClass`,
  `    let isPressureKind (kind: string) : bool =
        isBackpressureKind kind || isDeniedKind kind`,
);

describe("stripFSharpComments", () => {
  test("a token named only in a comment is not a reference", () => {
    const stripped = stripFSharpComments(`// mentions isBackpressureKind in prose\nlet x = 1\n`);
    expect(stripped).not.toContain("isBackpressureKind");
    expect(stripped).toContain("let x = 1");
  });
});

describe("tokenPredicates", () => {
  test("parses the token sets out of the F# rather than restating them", () => {
    const predicates = tokenPredicates(HEAT_FIXED);
    expect(predicates.get("isForgettingKind")).toEqual(["forgotten", "forget", "prune"]);
    expect(predicates.get("isBackpressureKind")).toEqual(["backpressure"]);
    expect(predicates.get("isDeniedKind")).toEqual(["denied", "reject"]);
  });

  test("a token added to the F# flows through without editing the lint", () => {
    const withNewToken = HEAT_FIXED.replace(
      `kindContains "forgotten" kind`,
      `kindContains "evicted" kind || kindContains "forgotten" kind`,
    );
    expect(tokenPredicates(withNewToken).get("isForgettingKind")).toContain("evicted");
  });
});

describe("bindings", () => {
  test("finds the chain, the one table, both derived routes, and the correspondence", () => {
    const names = [...bindings(HEAT_FIXED).keys()];
    expect(names).toContain("classifyKind");
    expect(names).toContain("isPressureClass");
    expect(names).toContain("isPressureKind");
    expect(names).toContain("ofKind");
    expect(names).toContain("classOf");
    expect(names).toContain("isPressure");
  });
});

describe("pressureDecidingBindings", () => {
  test("post-#10804: EXACTLY ONE binding consumes the raw probes, and it is not called ofKind", () => {
    expect(pressureDecidingBindings(HEAT_FIXED)).toEqual(["classifyKind"]);
  });

  test("pre-#10804: the second classifier is visible", () => {
    expect(pressureDecidingBindings(HEAT_TWO_CLASSIFIERS)).toContain("isPressureKind");
    expect(pressureDecidingBindings(HEAT_TWO_CLASSIFIERS).length).toBe(2);
  });
});

describe("kindContainsCallers", () => {
  test("only the token predicates touch the substring primitive", () => {
    expect([...kindContainsCallers(HEAT_FIXED)].sort()).toEqual(
      [
        "isBackpressureKind",
        "isDeniedKind",
        "isExpiredKind",
        "isForgettingKind",
        "isInvalidKind",
        "isStaleKind",
        "isStorageErrorKind",
      ].sort(),
    );
  });
});

describe("classToSignalMap / signalToClassMap / casesMappedToTrue / pressureTables", () => {
  test("the KindClass -> HeatSignal correspondence is read off ofKind", () => {
    const map = classToSignalMap(HEAT_FIXED);
    expect(map.get("Backpressure")).toBe("Backpressure");
    expect(map.get("Denied")).toBe("Denied");
    expect(map.size).toBe(8);
  });

  test("the HeatSignal -> KindClass correspondence is read off classOf, payload binder and all", () => {
    const map = signalToClassMap(HEAT_FIXED);
    expect(map.get("Backpressure")).toBe("Backpressure");
    expect(map.get("Denied")).toBe("Denied");
    // `| HeatSignal.Other _ -> HeatSignature.KindClass.Other` — the binder must not defeat the parse.
    expect(map.get("Other")).toBe("Other");
    expect(map.size).toBe(8);
  });

  test("neither direction's regex swallows the other's arms", () => {
    // ofKind and classOf sit in the same file and mirror each other; a regex that matched both
    // would report a bijection no matter how either was wired.
    const ofKindOnly = `| HeatSignature.KindClass.Denied -> HeatSignal.Denied`;
    expect(signalToClassMap(ofKindOnly).size).toBe(0);
    const classOfOnly = `| HeatSignal.Denied -> HeatSignature.KindClass.Denied`;
    expect(classToSignalMap(classOfOnly).size).toBe(0);
  });

  test("or-patterns grouped before a single arrow are all collected", () => {
    const cases = casesMappedToTrue(
      `\n        function\n        | HeatSignal.Backpressure\n        | HeatSignal.Denied -> true\n        | HeatSignal.Other _ -> false\n`,
      "HeatSignal",
    );
    expect(cases).toEqual(["Backpressure", "Denied"]);
  });

  test("the one pressure table is discovered by SHAPE, so a rename cannot hide it", () => {
    const renamed = HEAT_FIXED.replace("let isPressureClass", "let deferralBit");
    expect([...pressureTables(renamed, "KindClass").keys()]).toEqual(["deferralBit"]);
  });

  test("post-derive there is NO HeatSignal-keyed pressure table at all", () => {
    // 081M07Z23EX. `isPressure` is a composition now; nothing enumerates the bit over HeatSignal.
    expect([...pressureTables(HEAT_FIXED, "HeatSignal").keys()]).toEqual([]);
  });
});

describe("run", () => {
  /** A read function over an in-memory corpus, defaulting every unnamed source to empty. */
  const reader = (files: Record<string, string>) => (p: string) => files[p] ?? "";

  // 30 single-token kinds, enough to clear the aggregate floor, plus one hit for every route.
  const bulkKinds = Array.from({ length: 28 }, (_, i) => `{ "kind": "bulk.stale-${i}" }`).join("\n");
  const cleanCorpus = {
    "src/Core/Heat.fs": HEAT_FIXED,
    "src/Core/SoftEmu.fs": `HeatSignature.ofMass source "soft-emu.prune" 1 1.0 detail`,
    "src/Core/SchedulerShedHeat.fs": [
      `    let BackpressureKind = "backpressure"`,
      `            HeatSignature.ofMass`,
      `                CellSchedulerSource`,
      `                "forgotten"`,
    ].join("\n"),
    "src/Core/WSetHeat.fs": [
      `              WSetFunction = "consolidate"`,
      `                  Kind = "wset." + operationProfile.WSetFunction + ".forgotten"`,
    ].join("\n"),
    "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json": bulkKinds,
  };

  test("a clean corpus passes, and names the classifier it discovered", () => {
    const { failures, kindsInspected, classifier } = run(reader(cleanCorpus));
    expect(failures).toEqual([]);
    expect(kindsInspected).toBeGreaterThanOrEqual(30);
    expect(classifier).toBe("classifyKind");
  });

  test("THE STALE-MODEL REGRESSION — the classifier is discovered, not named", () => {
    // This is the failure that stalled PR #10735: main renamed the chain and the lint, which
    // pinned `ofKind`, went red on correct code. Renaming it again must stay green.
    const renamed = HEAT_FIXED.replaceAll("classifyKind", "resolveKindClass");
    const { failures, classifier } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": renamed }));
    expect(failures).toEqual([]);
    expect(classifier).toBe("resolveKindClass");
  });

  test("PART A — a dual-token kind fails", () => {
    const { failures } = run(
      reader({
        ...cleanCorpus,
        "src/Core/SoftEmu.fs": `HeatSignature.ofMass source "soft-emu.prune-backpressure" 1 1.0 d`,
      }),
    );
    expect(failures.some((f) => f.part === "A")).toBe(true);
    expect(failures.find((f) => f.part === "A")?.message).toContain("prune-backpressure");
  });

  test("PART B1 — THE ORIGINAL DEFECT: two bindings decide pressure from the raw probes", () => {
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": HEAT_TWO_CLASSIFIERS }));
    const b = failures.filter((f) => f.part === "B");
    expect(b.length).toBeGreaterThan(0);
    expect(b.some((f) => f.message.includes("2 bindings") && f.message.includes("isPressureKind"))).toBe(true);
  });

  test("PART B1 — losing the single classifier is a failure, not a silent pass", () => {
    const noChain = HEAT_FIXED.replace(
      /        if isBackpressureKind kind then KindClass\.Backpressure\n        elif isDeniedKind kind then KindClass\.Denied\n/,
      "",
    );
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": noChain }));
    expect(failures.some((f) => f.part === "B" && f.message.includes("no binding"))).toBe(true);
  });

  test("PART B2 — a classifier that inlines kindContains, bypassing the named probes", () => {
    const inlined = HEAT_FIXED.replace(
      "    let classifyKind",
      `    let underPressure (kind: string) : bool =
        kindContains "backpressure" kind || kindContains "denied" kind

    let classifyKind`,
    );
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": inlined }));
    expect(failures.some((f) => f.part === "B" && f.message.includes("underPressure"))).toBe(true);
  });

  test("PART B2b — the same inline classifier NAMED LIKE A PROBE, which B2 alone waves through", () => {
    const disguised = HEAT_FIXED.replace(
      "    let classifyKind",
      `    let isUnderPressureKind (kind: string) : bool =
        kindContains "backpressure" kind || kindContains "denied" kind

    let classifyKind`,
    );
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": disguised }));
    // B2 is satisfied — it parses as a token predicate. B2b is what catches it.
    expect(failures.some((f) => f.part === "B" && f.message.includes("never read by the single classifier"))).toBe(
      true,
    );
  });

  test("PART B3a — THE MEMBERSHIP SPLIT COMING BACK: a second table keyed on HeatSignal", () => {
    // Exactly the shape 081M07Z23EX removed. Before the derive this was the *expected* shape and
    // B3 only asked whether the two tables agreed; now its existence is the failure, because a
    // table that agrees today is a table that can be edited out of agreement tomorrow.
    const reintroduced = HEAT_FIXED.replace(
      `    let isPressure (signal: HeatSignal) : bool =
        signal |> classOf |> HeatSignature.isPressureClass`,
      `    let isPressure =
        function
        | HeatSignal.Backpressure
        | HeatSignal.Denied -> true
        | HeatSignal.Forgotten
        | HeatSignal.StorageError
        | HeatSignal.Invalid
        | HeatSignal.Expired
        | HeatSignal.Stale
        | HeatSignal.Other _ -> false`,
    );
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": reintroduced }));
    expect(
      failures.some((f) => f.part === "B" && f.message.includes("enumerates pressure over HeatSignal")),
    ).toBe(true);
  });

  test("PART B3a — the membership split it would have hidden: agreeing tables ALSO fail now", () => {
    // The honest version of the same point. The reintroduced table above is in perfect agreement
    // with `isPressureClass`; the old B3 would have passed it. One table or none is the rule.
    const agreeing = HEAT_FIXED.replace(
      `    let isPressure (signal: HeatSignal) : bool =
        signal |> classOf |> HeatSignature.isPressureClass`,
      `    let isPressure =
        function
        | HeatSignal.Backpressure
        | HeatSignal.Denied -> true
        | HeatSignal.Other _ -> false`,
    );
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": agreeing }));
    const split = failures.find((f) => f.part === "B" && f.message.includes("enumerates pressure over HeatSignal"));
    expect(split).toBeDefined();
    expect(split?.message).toContain("'isPressure'");
    // …and it is the ONLY complaint: the tables genuinely agree, so nothing else has anything
    // to say about them. That is the whole point — agreement is no longer a defence.
    expect(failures.filter((f) => f.part === "B").length).toBe(1);
    expect(failures.filter((f) => f.part === "floor").length).toBe(0);
  });

  test("PART B3a — a SECOND KindClass-keyed table is a floor failure, not a silent pass", () => {
    const second = HEAT_FIXED.replace(
      "    let classifyKind",
      `    let alsoPressureClass =
        function
        | KindClass.Backpressure -> true
        | KindClass.Other -> false

    let classifyKind`,
    );
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": second }));
    expect(failures.some((f) => f.part === "floor" && f.message.includes("PART B3"))).toBe(true);
  });

  test("PART B3b — a MISWIRED ofKind arm, which no name-pin could ever see", () => {
    const miswired = HEAT_FIXED.replace(
      "| HeatSignature.KindClass.Denied -> HeatSignal.Denied",
      "| HeatSignature.KindClass.Denied -> HeatSignal.Forgotten",
    );
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": miswired }));
    expect(failures.some((f) => f.part === "B" && f.message.includes("NOT a bijection"))).toBe(true);
  });

  test("PART B3b — a MISWIRED classOf arm: the residual the derive CREATED", () => {
    // This is the honest cost of 081M07Z23EX. `classOf` is exhaustive whatever it maps to, so
    // this compiles and `isPressure HeatSignal.Denied` quietly becomes false — a room under
    // genuine backpressure reading cold, which is the fail-dangerous direction #10804 fixed.
    const miswired = HEAT_FIXED.replace(
      "| HeatSignal.Denied -> HeatSignature.KindClass.Denied",
      "| HeatSignal.Denied -> HeatSignature.KindClass.Forgotten",
    );
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": miswired }));
    expect(failures.some((f) => f.part === "B" && f.message.includes("NOT a bijection"))).toBe(true);
  });

  test("PART B3b — a miswire among NON-pressure arms, which the old pressure-set compare missed", () => {
    // Strictly-stronger evidence: the pre-derive B3 compared pressure SETS, so swapping Stale and
    // Expired was invisible to it. The bijection check sees every arm.
    const swapped = HEAT_FIXED.replace(
      "| HeatSignal.Stale -> HeatSignature.KindClass.Stale",
      "| HeatSignal.Stale -> HeatSignature.KindClass.Expired",
    );
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": swapped }));
    expect(failures.some((f) => f.part === "B" && f.message.includes("NOT a bijection"))).toBe(true);
  });

  test("PART B3b — losing classOf entirely is a floor failure, not a silent pass", () => {
    const noClassOf = HEAT_FIXED.replace(/    let classOf =[\s\S]*?\n\n/, "");
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": noClassOf }));
    expect(failures.some((f) => f.part === "floor" && f.message.includes("PART B3b"))).toBe(true);
  });

  test("FLOOR — an empty corpus fails instead of reporting clean", () => {
    // The whole point of the floor. Every source reads empty, so there is nothing to disagree
    // with — and a guard that calls that "OK" is the blind instrument.
    const { failures } = run(reader({ "src/Core/Heat.fs": HEAT_FIXED }));
    expect(failures.some((f) => f.part === "floor")).toBe(true);
  });

  test("FLOOR — one dark extraction route fails even when the aggregate floor is met", () => {
    // Measured regression: at an aggregate-only floor this case exited 0 (33 kinds -> 30).
    const treatyOnly = {
      "src/Core/Heat.fs": HEAT_FIXED,
      "src/Core.QSharp.ReferenceOracle/heat-signals-treaty.json": Array.from(
        { length: 40 },
        (_, i) => `{ "kind": "bulk.stale-${i}" }`,
      ).join("\n"),
    };
    const { failures, kindsInspected } = run(reader(treatyOnly));
    expect(kindsInspected).toBeGreaterThanOrEqual(30);
    expect(failures.some((f) => f.part === "floor" && f.message.includes("gone dark"))).toBe(true);
  });

  test("FLOOR — a restructured Heat.fs that defeats token parsing fails", () => {
    const { failures } = run(reader({ ...cleanCorpus, "src/Core/Heat.fs": "module HeatSignal =\n" }));
    expect(failures.some((f) => f.part === "floor")).toBe(true);
  });
});

describe("kindLiterals", () => {
  test("extracts inline, multiline, literal-binding, and treaty kinds by named route", () => {
    const fs = [
      `HeatSignature.ofMass source "room-boundary.door-denied" 1 1.0 detail`,
      `            HeatSignature.ofMass`,
      `                CellSchedulerSource`,
      `                "forgotten-multiline"`,
      `    let BackpressureKind = "backpressure"`,
    ].join("\n");
    const found = kindLiterals("src/Core/Sample.fs", fs);
    expect(found.get("fsharp-emitter-inline")).toContain("room-boundary.door-denied");
    expect(found.get("fsharp-emitter-multiline")).toContain("forgotten-multiline");
    expect(found.get("fsharp-kind-literal")).toContain("backpressure");

    const treaty = kindLiterals("treaty.json", `{ "kind": "soft-emu.prune" }`);
    expect(treaty.get("treaty-kind-field")).toContain("soft-emu.prune");
  });

  test("expands the composed wset kind over its closed function set", () => {
    const wset = [
      `              WSetFunction = "consolidate"`,
      `                  Kind = "wset." + operationProfile.WSetFunction + ".forgotten"`,
    ].join("\n");
    expect(kindLiterals("src/Core/WSetHeat.fs", wset).get("wset-composed")).toEqual(["wset.consolidate.forgotten"]);
  });
});
