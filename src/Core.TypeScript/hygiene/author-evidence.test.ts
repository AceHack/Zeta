// author-evidence.test.ts — the falsifiers for `.authorevidence` and its meter.
//
// EVERY test here is written to FAIL if the corresponding rule is removed. That is the
// standard this repo holds a check to, and it is not decorative: the failure this whole
// artifact is about is a check that looks like it ran and did not.
//
// A NOTE ON HOW THE CONTROL CHARACTERS IN THIS FILE ARE BUILT. They are constructed with
// `String.fromCharCode(0x1b)`, never written as a literal escape in source. Not style —
// while writing this artifact and its research doc, an escape typed in the source came out as
// the RAW BYTE twelve separate times across three files, every one of them in exactly the place
// an escape belonged. `String.fromCharCode` cannot do that, because there is no adjacent form
// for it to land on.

import { describe, expect, test } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  EFFORT_SCALE,
  WEIGHT_SCALE,
  AUTHOR_CLASSES,
  weightCeiling,
  weightRank,
  DETECTORS,
  detectC0ControlBytes,
  detectInvisibleCharacters,
  detectTrailingWhitespace,
  decodeEscapes,
  parseDeclarations,
  coherenceViolations,
  verdictVocabularyViolations,
  probeViolations,
  gateViolations,
  checkDeclarations,
  globToRegExp,
  matchesGlob,
  resolveAuthorClass,
  observationsFor,
  CONFIG_PATH,
  type Declaration,
} from "./author-evidence.ts";

const ESC = String.fromCharCode(0x1b);
const NUL = String.fromCharCode(0x00);
const ZWSP = String.fromCharCode(0x200b);
const enc = new TextEncoder();

const REPO_ROOT = resolve(import.meta.dir, "../../..");

/** A minimal well-formed declaration; individual tests break exactly one field. */
function decl(overrides: Partial<Declaration> = {}): Declaration {
  return {
    glob: "*.ts",
    signal: "c0-control-bytes",
    canonical: "the escape",
    deviation: "the raw byte",
    detect: "c0-control-bytes",
    gate: "none",
    consequence: "grep reads the file as binary and every text audit skips it silently",
    reversible: true,
    effort: { human: "moderate", llm: "zero", generator: "zero", unknown: "zero" },
    weight: { human: "weak", llm: "none", generator: "none", unknown: "none" },
    probeDeviation: `${ESC}[0m`,
    probeCanonical: "\\u001b[0m",
    line: 1,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
describe("REFUSAL 1 — weight may not exceed what effort supports", () => {
  test("the shipped shape is coherent", () => {
    expect(coherenceViolations(decl())).toEqual([]);
  });

  // THE CENTRAL FALSIFIER. Remove the ceiling rule and this passes, which is the whole
  // thesis reintroduced: zero-cost artifact read as strong evidence about its author.
  test("zero effort + strong weight is REFUSED", () => {
    const v = coherenceViolations(
      decl({ weight: { human: "weak", llm: "strong", generator: "none", unknown: "none" } }),
    );
    expect(v.length).toBe(1);
    expect(v[0]?.kind).toBe("coherence");
    expect(v[0]?.message).toContain("weight.llm = strong");
  });

  test("EVERY class is checked, not just llm — each one alone trips it", () => {
    for (const cls of AUTHOR_CLASSES) {
      const weight = { human: "none", llm: "none", generator: "none", unknown: "none" } as Record<
        (typeof AUTHOR_CLASSES)[number],
        (typeof WEIGHT_SCALE)[number]
      >;
      weight[cls] = "strong";
      const effort = { human: "zero", llm: "zero", generator: "zero", unknown: "zero" } as Record<
        (typeof AUTHOR_CLASSES)[number],
        (typeof EFFORT_SCALE)[number]
      >;
      const v = coherenceViolations(decl({ effort, weight }));
      expect(v.length).toBeGreaterThan(0);
    }
  });

  test("weight.unknown must be none even when SOME effort is declared for it", () => {
    const v = coherenceViolations(
      decl({
        effort: { human: "moderate", llm: "zero", generator: "zero", unknown: "high" },
        weight: { human: "weak", llm: "none", generator: "none", unknown: "moderate" },
      }),
    );
    // The ceiling alone would permit `moderate` under `high`. The unknown-class rule is a
    // SEPARATE refusal and must fire on its own.
    expect(v.some((x) => x.message.includes("must be none"))).toBe(true);
  });

  test("the ceiling is the identity on ranks, and every rank pair is checked", () => {
    for (let i = 0; i < EFFORT_SCALE.length; i += 1) {
      const e = EFFORT_SCALE[i];
      if (e === undefined) continue;
      expect(weightRank(weightCeiling(e))).toBe(i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("REFUSAL 2 — no intent vocabulary in the neutral field", () => {
  test("a mechanical consequence passes", () => {
    expect(verdictVocabularyViolations(decl())).toEqual([]);
  });

  test("`suspicious` in consequence is REFUSED", () => {
    const v = verdictVocabularyViolations(decl({ consequence: "a suspicious byte appears here" }));
    expect(v.length).toBe(1);
    expect(v[0]?.kind).toBe("vocabulary");
  });

  test("a multi-word intent phrase is REFUSED across whitespace", () => {
    const v = verdictVocabularyViolations(decl({ consequence: "written by a bad   actor" }));
    expect(v.length).toBe(1);
  });

  test("mechanism words that merely SOUND alarming are permitted", () => {
    // `hidden`, `binary`, `skipped`, `parse` describe what happens. If these tripped the
    // check nobody could write a true consequence, and the check would be turned off.
    const v = verdictVocabularyViolations(
      decl({ consequence: "the byte is hidden from review, the file parses as binary, the audit is skipped" }),
    );
    expect(v).toEqual([]);
  });

  test("substrings do not false-positive (`attackers` vs a word containing it)", () => {
    expect(verdictVocabularyViolations(decl({ consequence: "the value is unattackable-sounding" }))).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("REFUSAL 3 — probes prove the detector separates its own cases", () => {
  test("the shipped probes separate", () => {
    expect(probeViolations(decl())).toEqual([]);
  });

  test("a detector that does not fire on probe-deviation is REFUSED", () => {
    const v = probeViolations(decl({ probeDeviation: "no control bytes here at all" }));
    expect(v.length).toBe(1);
    expect(v[0]?.message).toContain("does not fire on probe-deviation");
  });

  test("a detector that fires on probe-canonical is REFUSED", () => {
    const v = probeViolations(decl({ probeCanonical: `also ${ESC} here` }));
    expect(v.length).toBe(1);
    expect(v[0]?.message).toContain("fires on probe-canonical");
  });

  test("an unknown detector id is REFUSED (a declaration cannot name a detector that is not there)", () => {
    const v = probeViolations(decl({ detect: "vibes" }));
    expect(v.length).toBe(1);
    expect(v[0]?.kind).toBe("detector");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("gates — a declaration may not claim a composition it does not have", () => {
  test("`none` is permitted and means ungated, which is a fact and not a failure", () => {
    expect(gateViolations(decl({ gate: "none" }), () => false)).toEqual([]);
  });

  test("a gate path that does not exist is REFUSED", () => {
    const v = gateViolations(decl({ gate: "src/does/not/exist.ts" }), () => false);
    expect(v.length).toBe(1);
    expect(v[0]?.kind).toBe("gate");
  });

  test("an existing gate passes", () => {
    expect(gateViolations(decl({ gate: "src/exists.ts" }), (p) => p === "src/exists.ts")).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("detectors", () => {
  test("c0: fires on ESC, NUL and DEL; silent on tab, LF, CR and plain text", () => {
    expect(detectC0ControlBytes(enc.encode(`a${ESC}b`)).length).toBe(1);
    expect(detectC0ControlBytes(enc.encode(`a${NUL}b`)).length).toBe(1);
    expect(detectC0ControlBytes(enc.encode(`a${String.fromCharCode(0x7f)}b`)).length).toBe(1);
    expect(detectC0ControlBytes(enc.encode("a\tb\r\nc\n"))).toEqual([]);
    expect(detectC0ControlBytes(enc.encode("plain"))).toEqual([]);
  });

  test("c0: line numbers count over RAW BYTES and survive a multi-byte character before the site", () => {
    // A decode-then-index detector gets this wrong, which is why the implementation counts
    // 0x0A over bytes. "é" is two bytes; the site must still be reported on line 2.
    const sites = detectC0ControlBytes(enc.encode(`é\nx${ESC}y\n`));
    expect(sites.length).toBe(1);
    expect(sites[0]?.line).toBe(2);
    expect(sites[0]?.detail).toBe("0x1B");
  });

  test("c0: several bytes on one line are reported once, with all of them named", () => {
    const sites = detectC0ControlBytes(enc.encode(`${ESC}${NUL}`));
    expect(sites.length).toBe(1);
    expect(sites[0]?.detail).toBe("0x1B 0x00");
  });

  test("invisible: fires on ZWSP and on a bidi override; silent on ordinary text", () => {
    expect(detectInvisibleCharacters(enc.encode(`@${ZWSP}name`)).length).toBe(1);
    expect(detectInvisibleCharacters(enc.encode(`x${String.fromCharCode(0x202e)}y`)).length).toBe(1);
    expect(detectInvisibleCharacters(enc.encode("@name"))).toEqual([]);
  });

  test("invisible: a NON-Latin but VISIBLE character is not flagged", () => {
    // The detector is about characters that occupy no space, never about which script a
    // character belongs to. Flagging по or 日本語 would make it a different, worse tool.
    expect(detectInvisibleCharacters(enc.encode("по 日本語"))).toEqual([]);
  });

  test("trailing-whitespace: fires on a line ending in space or tab; silent on a blank line", () => {
    expect(detectTrailingWhitespace(enc.encode("const x = 1;  ")).length).toBe(1);
    expect(detectTrailingWhitespace(enc.encode("const x = 1;\t")).length).toBe(1);
    expect(detectTrailingWhitespace(enc.encode("const x = 1;"))).toEqual([]);
    expect(detectTrailingWhitespace(enc.encode("a\n   \nb"))).toEqual([]);
  });

  test("trailing-whitespace: a CRLF line is NOT a finding (the CR is the line ending, not trailing space)", () => {
    expect(detectTrailingWhitespace(enc.encode("const x = 1;\r\n"))).toEqual([]);
  });

  test("the three detectors are genuinely different — none is a duplicate of another", () => {
    const inputs = [`a${ESC}b`, `a${ZWSP}b`, "a "];
    const fingerprints = Object.keys(DETECTORS)
      .sort()
      .map((k) => inputs.map((i) => (DETECTORS[k]?.(enc.encode(i)).length ?? 0) > 0).join(""));
    expect(new Set(fingerprints).size).toBe(fingerprints.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("escape decoding — the file is text and stays text", () => {
  test("\\uXXXX becomes the character; the backslash form survives doubling", () => {
    expect(decodeEscapes("\\u001b").charCodeAt(0)).toBe(0x1b);
    expect(decodeEscapes("\\\\u001b")).toBe("\\u001b");
    expect(decodeEscapes("\\u0020").charCodeAt(0)).toBe(0x20);
  });

  test("a malformed escape throws rather than silently producing something else", () => {
    expect(() => decodeEscapes("\\uZZZZ")).toThrow();
    expect(() => decodeEscapes("\\q")).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("globs", () => {
  test("a glob without a slash matches by BASENAME, the .editorconfig rule", () => {
    expect(matchesGlob("*.ts", "src/deep/a.ts")).toBe(true);
    expect(matchesGlob("*.ts", "a.ts")).toBe(true);
    expect(matchesGlob("*.ts", "src/a.fs")).toBe(false);
  });

  test("a glob WITH a slash anchors to the whole path", () => {
    expect(matchesGlob("src/**/*.ts", "src/deep/a.ts")).toBe(true);
    expect(matchesGlob("src/**/*.ts", "tools/deep/a.ts")).toBe(false);
  });

  test("brace alternation", () => {
    expect(matchesGlob("*.{ts,fs}", "x/a.fs")).toBe(true);
    expect(matchesGlob("*.{ts,fs}", "x/a.rs")).toBe(false);
  });

  test("a dot in the glob is literal, not `any character`", () => {
    expect(globToRegExp("*.ts").test("axts")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("author class resolution — the replacement signal, and its floor", () => {
  const block = (over: Record<string, string> = {}): string => {
    const keys: Record<string, string> = {
      "Agency-Signature-Version": "1",
      Agent: "shadow",
      "Agent-Runtime": "Claude Code",
      "Agent-Model": "Claude Opus 5",
      "Credential-Identity": "AceHack via gh",
      "Credential-Mode": "shared",
      "Human-Review": "not-implied-by-credential",
      "Human-Review-Evidence": "none",
      "Action-Mode": "autonomous-fail-safe",
      Task: "081M26GHVJE087G0R0005GPCCQ",
      ...over,
    };
    return `a commit subject\n\n${Object.entries(keys)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")}\n`;
  };

  test("an Agent-Model naming a model resolves to llm", () => {
    expect(resolveAuthorClass(block()).authorClass).toBe("llm");
  });

  test("an Agent-Model naming a toolchain resolves to generator, not llm", () => {
    const r = resolveAuthorClass(block({ "Agent-Model": "bun + git + gh CLI" }));
    expect(r.authorClass).toBe("generator");
    expect(r.basis).toContain("toolchain");
  });

  test("Credential-Mode: human-only resolves to human", () => {
    expect(resolveAuthorClass(block({ "Credential-Mode": "human-only" })).authorClass).toBe("human");
  });

  // THE FLOOR. Absence must never become `human`, because `human` is the only class whose
  // effort is nonzero — inventing it is exactly the inference the artifact exists to stop.
  test("a commit with NO signature block resolves to unknown, never human", () => {
    const r = resolveAuthorClass("just a subject line\n");
    expect(r.authorClass).toBe("unknown");
    expect(r.agentModel).toBe(null);
  });

  test("a block present but naming no model resolves to unknown, not llm", () => {
    const noModel = block()
      .split("\n")
      .filter((l) => !l.startsWith("Agent-Model:"))
      .join("\n");
    // Removing a required key breaks the block shape, so this asserts the honest floor
    // whichever way the block parser reads it: the answer is `unknown` either way.
    expect(resolveAuthorClass(noModel).authorClass).toBe("unknown");
  });

  test("the git Author header is deliberately NOT read — a shared credential names no person", () => {
    const r = resolveAuthorClass(block({ "Credential-Identity": "AceHack via gh" }));
    expect(r.authorClass).toBe("llm");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("observations carry weight, and no verdict", () => {
  test("an LLM-authored raw ESC yields weight none and says intent is unobservable", () => {
    const obs = observationsFor("src/a.ts", enc.encode(`const reset = "${ESC}[0m";`), [decl()], {
      authorClass: "llm",
      commit: "abc",
      agent: "shadow",
      agentModel: "Claude Opus 5",
      credentialMode: "shared",
      basis: "test",
    });
    expect(obs.length).toBe(1);
    expect(obs[0]?.weight).toBe("none");
    expect(obs[0]?.intentUnobservable).toBe(true);
  });

  test("the SAME artifact under a human author yields a nonzero weight — the asymmetry, executed", () => {
    const bytes = enc.encode(`const reset = "${ESC}[0m";`);
    const asHuman = observationsFor("src/a.ts", bytes, [decl()], {
      authorClass: "human",
      commit: "abc",
      agent: null,
      agentModel: null,
      credentialMode: "human-only",
      basis: "test",
    });
    expect(asHuman[0]?.weight).toBe("weak");
    expect(asHuman[0]?.intentUnobservable).toBe(false);
  });

  test("an observation has no field in which a verdict could be written", () => {
    const obs = observationsFor("src/a.ts", enc.encode(`x${ESC}`), [decl()], {
      authorClass: "llm",
      commit: "",
      agent: null,
      agentModel: null,
      credentialMode: null,
      basis: "t",
    });
    const keys = Object.keys(obs[0] ?? {});
    for (const banned of ["verdict", "suspicious", "malicious", "score", "risk", "severity"]) {
      expect(keys).not.toContain(banned);
    }
  });

  test("a declaration whose glob does not match produces nothing", () => {
    const obs = observationsFor("src/a.fs", enc.encode(`x${ESC}`), [decl({ glob: "*.ts" })], {
      authorClass: "llm",
      commit: "",
      agent: null,
      agentModel: null,
      credentialMode: null,
      basis: "t",
    });
    expect(obs).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("the parser refuses malformed declarations rather than ignoring them", () => {
  const preamble = "root = true\nversion = 1\n";

  test("a typo'd field is REFUSED, not silently dropped", () => {
    const r = parseDeclarations(`${preamble}[*.ts]\nsig.cannonical = x\n`);
    expect(r.errors.some((e) => e.message.includes("unknown field"))).toBe(true);
  });

  test("an unknown author class is REFUSED", () => {
    const r = parseDeclarations(`${preamble}[*.ts]\nsig.effort.robot = zero\n`);
    expect(r.errors.some((e) => e.message.includes("unknown author class"))).toBe(true);
  });

  test("a missing weight for one class is REFUSED — a partial declaration is not a declaration", () => {
    const body = [
      "[*.ts]",
      "sig.canonical = a",
      "sig.deviation = b",
      "sig.detect = c0-control-bytes",
      "sig.gate = none",
      "sig.consequence = c",
      "sig.reversible = yes",
      "sig.probe-deviation = x",
      "sig.probe-canonical = y",
      "sig.effort.human = zero",
      "sig.effort.llm = zero",
      "sig.effort.generator = zero",
      "sig.effort.unknown = zero",
      "sig.weight.human = none",
      "sig.weight.llm = none",
      "sig.weight.generator = none",
    ].join("\n");
    const r = parseDeclarations(`${preamble}${body}\n`);
    expect(r.errors.some((e) => e.message.includes("missing weight.unknown"))).toBe(true);
    expect(r.declarations.length).toBe(0);
  });

  test("a missing version preamble is REFUSED", () => {
    expect(parseDeclarations("[*.ts]\n").errors.some((e) => e.message.includes("version"))).toBe(true);
  });

  test("an out-of-scale value is REFUSED", () => {
    const r = parseDeclarations(`${preamble}[*.ts]\nsig.weight.llm = terrifying\n`);
    expect(r.errors.some((e) => e.message.includes("weight must be one of"))).toBe(true);
  });

  test("a duplicated field is REFUSED rather than last-one-wins", () => {
    const r = parseDeclarations(`${preamble}[*.ts]\nsig.gate = none\nsig.gate = other\n`);
    expect(r.errors.some((e) => e.message.includes("duplicate field"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
describe("THE SHIPPED FILE — the checks above are worth nothing if the real one is empty", () => {
  const raw = readFileSync(resolve(REPO_ROOT, CONFIG_PATH), "utf8");
  const parsed = parseDeclarations(raw);

  test("it parses with zero errors", () => {
    expect(parsed.errors).toEqual([]);
  });

  test("it passes every refusal against the real filesystem", () => {
    const violations = checkDeclarations(parsed.declarations, (p) => existsSync(resolve(REPO_ROOT, p)));
    expect(violations).toEqual([]);
  });

  test("it is NOT VACUOUS — at least three signals, and at least one really gated", () => {
    const signals = new Set(parsed.declarations.map((d) => d.signal));
    expect(signals.size).toBeGreaterThanOrEqual(3);
    const gated = parsed.declarations.filter((d) => d.gate !== "none");
    expect(gated.length).toBeGreaterThanOrEqual(1);
    for (const g of gated) expect(existsSync(resolve(REPO_ROOT, g.gate))).toBe(true);
  });

  test("its globs reach the files that actually carry the deviation TODAY", () => {
    // A declaration whose glob matches nothing in the tree is coverage on paper. These two
    // paths were measured 2026-09-10 as carrying raw 0x1B and U+200B respectively.
    const c0 = parsed.declarations.find((d) => d.signal === "c0-control-bytes");
    expect(c0).toBeDefined();
    expect(matchesGlob(c0?.glob ?? "", "src/Core/SwarmBoardAnsi.fs")).toBe(true);
    const inv = parsed.declarations.find((d) => d.signal === "invisible-characters");
    expect(inv).toBeDefined();
    expect(
      matchesGlob(inv?.glob ?? "", "docs/history/pr-reviews/PR-1-deps-bump-fsunit-xunit-from-7-1-0-to-7-1-1.md"),
    ).toBe(true);
  });

  test("every declared weight for a zero-effort class is none — the thesis, read off the shipped file", () => {
    for (const d of parsed.declarations) {
      for (const cls of AUTHOR_CLASSES) {
        if (d.effort[cls] === "zero") expect(d.weight[cls]).toBe("none");
      }
    }
  });

  test("the declaration file contains none of the forms it declares against", () => {
    // Ten raw control/invisible characters were emitted into these two files while they
    // were being written, each time where an escape was intended. This test is why they
    // are not still there.
    const bytes = readFileSync(resolve(REPO_ROOT, CONFIG_PATH));
    expect(detectC0ControlBytes(bytes)).toEqual([]);
    expect(detectInvisibleCharacters(bytes)).toEqual([]);
    const meter = readFileSync(resolve(REPO_ROOT, "src/Core.TypeScript/hygiene/author-evidence.ts"));
    expect(detectC0ControlBytes(meter)).toEqual([]);
    expect(detectInvisibleCharacters(meter)).toEqual([]);
  });
});
