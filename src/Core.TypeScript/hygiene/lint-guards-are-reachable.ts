#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/lint-guards-are-reachable.ts
//
// A guard that is PRESENT, TESTED, and UNREACHABLE FROM THE CALL SITE.
//
// That sentence names a defect class, not a bug. It fired four separate times
// in different subsystems on 2026-08-20/21, and twice more in zflash alone:
//
//   1. classifyDeviceState R1 -- detects "labelled ZETA_INSTALL but the head
//      digest disagrees". Needs two digest fields. The only production caller
//      passed neither; the sole supplier was the test file. A stick holding the
//      wrong bytes therefore classified as "provisioned" -- the exact misread
//      the rule was written to prevent. Green in tests, unreachable in life.
//   2. checkDeviceIdentity, first call -- its expectation fell back to the
//      observed value field by field, so with no --expect-* flag it compared a
//      value to itself, and the wrapper never passed --expect-*.
//
// Both are the same shape: the code exists, the tests are green, and NOTHING
// ON THE LIVE PATH CAN MAKE THE GUARD FIRE. A test suite cannot see this,
// because the test suite is precisely the caller that does supply the inputs.
// Only a check that reads the CALL SITES can.
//
// Two rules here, one per observed form:
//
//   A. DECLARED-INPUT REACHABILITY. A guard declares the inputs one of its
//      rules needs, in a marker beside the rule. This audit then requires that
//      some NON-TEST caller actually supplies them. No non-test caller at all
//      is also a failure -- a guard nothing calls is the purest form of this
//      class.
//
//   B. EXPECTATION DEFAULTED TO OBSERVATION. A binding whose name says it
//      holds an expectation must not fall back to a value whose name says it
//      holds an observation. That fallback turns "does the device match what
//      you asked for" into "does the device match itself", which is a check
//      that cannot fail, which is not a check.
//
// Anchor (Beacon): this is mutation testing s premise moved one level out.
// Mutation testing (Lipton/DeMillo/Sayward 1978) asks whether a test can fail
// when the code is wrong; this asks whether a guard can fire when the WORLD is
// wrong. A guard whose inputs are supplied only by its own test has survived
// every mutant for the same reason a tautology does.
//
// Everything except main() is pure over strings, so the audit is testable
// without a filesystem and its own refusals are falsifiable.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface GuardDeclaration {
  /** File the marker was found in -- where the rule lives. */
  readonly declaredIn: string;
  /** The exported function whose callers must supply the fields. */
  readonly fnName: string;
  /** Field names that must appear in some non-test call site argument. */
  readonly requiredFields: readonly string[];
  /** Free text after "--", carried into the finding so it reads as English. */
  readonly note: string;
}

export interface Finding {
  readonly rule: "A-unsupplied-guard-input" | "A-no-production-caller" | "B-expectation-defaults-to-observed";
  readonly file: string;
  readonly detail: string;
}

/** The marker, assembled rather than written, so this file is not its own declaration. */
export const GUARD_MARKER = "@" + "guard-input";

/**
 * Parse the markers a source file declares.
 *
 * Shape (as a comment, beside the rule it belongs to):
 *
 *   MARKER classifyDeviceState requires headDigestHex, expectedHeadDigestHex -- rule R1
 *
 * The declaration lives with the GUARD, never in a central list, for the same
 * reason the exemption roster in audit-proof-lineage-binaries.ts is derived
 * from the runner rather than hand-written: a list that lives somewhere else
 * drifts from the thing it describes, and a drifted list passes.
 */
export function parseGuardDeclarations(text: string, path: string): readonly GuardDeclaration[] {
  const out: GuardDeclaration[] = [];
  const re = new RegExp(GUARD_MARKER + String.raw`\s+([A-Za-z_$][\w$]*)\s+requires\s+([^\n]+)`, "g");
  let m: RegExpExecArray | null = re.exec(text);
  while (m !== null) {
    const fnName = m[1] ?? "";
    const rest = m[2] ?? "";
    const dash = rest.indexOf("--");
    const fieldPart = dash < 0 ? rest : rest.slice(0, dash);
    const note = dash < 0 ? "" : rest.slice(dash + 2).trim();
    const requiredFields = fieldPart
      .split(",")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    if (fnName.length > 0 && requiredFields.length > 0) {
      out.push({ declaredIn: path, fnName, requiredFields, note });
    }
    m = re.exec(text);
  }
  return out;
}

/**
 * Every argument list passed to fnName in this source, as raw text.
 *
 * Balanced-paren scan rather than a regex, because the argument is an object
 * literal spanning many lines and a regex would stop at the first ")" inside
 * it. Definitions (function fnName(...), export function fnName(...)) are
 * skipped: a signature is not a call site, and counting it would let a guard
 * satisfy its own requirement by declaring a parameter.
 */
export function extractCallArguments(text: string, fnName: string): readonly string[] {
  const out: string[] = [];
  const needle = fnName + "(";
  let from = 0;
  for (;;) {
    const at = text.indexOf(needle, from);
    if (at < 0) break;
    from = at + needle.length;
    const before = text.slice(Math.max(0, at - 30), at);
    if (/[\w$.]$/.test(before)) continue;
    if (/\b(?:function|class)\s+$/.test(before)) continue;
    let depth = 1;
    let i = at + needle.length;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    if (depth === 0) out.push(text.slice(at + needle.length, i - 1));
  }
  return out;
}

/**
 * Blank out comments, keeping offsets and line structure.
 *
 * Necessary in both directions. A call written inside a comment is not a call
 * site, so counting it would let a guard look supplied when nothing supplies
 * it -- this audit failing OPEN is worse than not existing. And an ILLUSTRATION
 * of the defect, like the worked example in this very file, is not the defect;
 * without this the audit reports itself and the first thing anyone would do is
 * delete the example.
 *
 * Honest limit, stated rather than discovered later: regex literals are not
 * tracked, so a regex containing an unescaped // could swallow the rest of its
 * line. Strings and templates ARE tracked, which is what protects the common
 * case of a URL inside a string.
 */
export function stripComments(text: string): string {
  const out: string[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";
    if (ch === String.fromCharCode(34) || ch === "'" || ch === "`") {
      const quote = ch;
      out.push(ch);
      i++;
      while (i < n) {
        const c = text[i] ?? "";
        out.push(c === "\n" ? "\n" : c);
        i++;
        if (c === "\\") {
          if (i < n) {
            out.push(text[i] ?? "");
            i++;
          }
          continue;
        }
        if (c === quote) break;
      }
      continue;
    }
    if (ch === "/" && next === "/") {
      while (i < n && text[i] !== "\n") {
        out.push(" ");
        i++;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) {
        out.push(text[i] === "\n" ? "\n" : " ");
        i++;
      }
      out.push("  ");
      i += 2;
      continue;
    }
    out.push(ch);
    i++;
  }
  return out.join("");
}

export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

/** A test file is not a production caller. That distinction IS the audit. */
export function isTestFile(path: string): boolean {
  return /(?:\.test\.ts|\.spec\.ts|[\\/]test-harness[\\/])/.test(path);
}

/**
 * RULE A. For each declaration, some non-test caller must supply every field.
 *
 * "Some", not "every": a caller that legitimately has nothing to say about a
 * rule is not a defect. The defect is that NO live path can make the rule
 * fire, and one supplying caller is enough to disprove that.
 */
export function checkDeclaredInputsAreSupplied(
  declarations: readonly GuardDeclaration[],
  files: readonly SourceFile[],
): readonly Finding[] {
  const findings: Finding[] = [];
  const production = files.filter((f) => !isTestFile(f.path));
  for (const d of declarations) {
    const callers: { path: string; missing: string[] }[] = [];
    for (const f of production) {
      if (f.path === d.declaredIn) continue;
      for (const args of extractCallArguments(f.text, d.fnName)) {
        const missing = d.requiredFields.filter(
          (field) => !new RegExp(String.raw`\b` + field + String.raw`\b`).test(args),
        );
        callers.push({ path: f.path, missing });
      }
    }
    if (callers.length === 0) {
      findings.push({
        rule: "A-no-production-caller",
        file: d.declaredIn,
        detail:
          d.fnName +
          " declares required inputs (" +
          d.requiredFields.join(", ") +
          ") but NOTHING outside the tests calls it" +
          (d.note ? " [" + d.note + "]" : "") +
          ". A guard only its own test can reach cannot fire in production.",
      });
      continue;
    }
    if (callers.every((c) => c.missing.length > 0)) {
      const worst = callers[0];
      findings.push({
        rule: "A-unsupplied-guard-input",
        file: d.declaredIn,
        detail:
          d.fnName +
          " requires " +
          d.requiredFields.join(", ") +
          (d.note ? " [" + d.note + "]" : "") +
          ", and NO non-test caller supplies them. Call sites seen: " +
          callers
            .map((c) => c.path + " (missing " + c.missing.join(", ") + ")")
            .join("; ") +
          ". First: " +
          String(worst?.path ?? "?") +
          ". The rule is dead code on the live path.",
      });
    }
  }
  return findings;
}

/**
 * RULE B. An expectation must not default to the observation it will be
 * compared against.
 *
 * Detects, inside a binding whose name starts with "expect":
 *   x ?? observedThing        x || observedThing        k: observedThing
 *
 * The live instance, deleted in the same change that added this audit:
 *
 *   const expectedIdentity: DeviceIdentity = {
 *     devicePath: expectDevice ?? observedIdentity.devicePath,   // <- vacuous
 *     busProtocol: observedIdentity.busProtocol,                 // <- vacuous
 *   };
 *
 * With no flag passed, every field equalled itself, checkDeviceIdentity could
 * not fail, and the tool printed a WARNING about being unpinned instead of
 * refusing. The wrapper never passed the flag, so that was the only path.
 *
 * Deliberately name-driven. The audit cannot know which value is a
 * measurement, so it trusts the vocabulary the code chose for itself -- and
 * code that names one thing "expected" and another "observed" has already said
 * they must not be the same thing.
 */
export function checkExpectationsNotDefaultedToObserved(
  text: string,
  path: string,
): readonly Finding[] {
  const findings: Finding[] = [];
  const binding = /\b(?:const|let|var)\s+(expect[A-Za-z0-9_$]*)\b/g;
  let m: RegExpExecArray | null = binding.exec(text);
  while (m !== null) {
    const name = m[1] ?? "";
    const start = m.index;
    let depth = 0;
    let end = start;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === "{" || ch === "(" || ch === "[") depth++;
      else if (ch === "}" || ch === ")" || ch === "]") depth--;
      else if (ch === ";" && depth <= 0) {
        end = i;
        break;
      }
      end = i;
    }
    const stmt = text.slice(start, end + 1);
    const hit = stmt.match(/(?:\?\?|\|\||:)\s*(observed[A-Za-z0-9_$]*)/);
    if (hit) {
      findings.push({
        rule: "B-expectation-defaults-to-observed",
        file: path,
        detail:
          name +
          " falls back to " +
          String(hit[1]) +
          ". An expectation defaulted to the observation makes the comparison" +
          " observed-vs-itself, which cannot fail. State it, or refuse when it" +
          " was not stated.",
      });
    }
    m = binding.exec(text);
  }
  return findings;
}

export function auditSources(files: readonly SourceFile[]): readonly Finding[] {
  // Declarations are read from the RAW text -- they live in comments by
  // design, beside the rule they describe. Everything else reads the stripped
  // text, so neither a commented-out call nor a worked example counts.
  // ...and only from PRODUCTION files: a guard declared inside a test file
  // would be a requirement the tests impose on themselves, which is the shape
  // this whole audit exists to refuse.
  const declarations = files
    .filter((f) => !isTestFile(f.path))
    .flatMap((f) => [...parseGuardDeclarations(f.text, f.path)]);
  const stripped = files.map((f) => ({ path: f.path, text: stripComments(f.text) }));
  const findings: Finding[] = [...checkDeclaredInputsAreSupplied(declarations, stripped)];
  for (const f of stripped) {
    if (isTestFile(f.path)) continue;
    findings.push(...checkExpectationsNotDefaultedToObserved(f.text, f.path));
  }
  return findings;
}

// =====================================================================
// I/O EDGE
// =====================================================================

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "bin",
  "obj",
  "prior-art",
  "references",
]);

export function collectTypeScriptFiles(root: string): readonly string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p);
      else if (name.endsWith(".ts") && !name.endsWith(".d.ts")) out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

export function main(argv: readonly string[]): number {
  const enforce = argv.includes("--enforce");
  const asJson = argv.includes("--json");
  const roots = argv.filter((a) => !a.startsWith("--"));
  const searchRoots = roots.length > 0 ? roots : ["src/Core.TypeScript", "tools"];
  const files: SourceFile[] = [];
  for (const root of searchRoots) {
    for (const p of collectTypeScriptFiles(root)) {
      try {
        files.push({ path: p, text: readFileSync(p, "utf8") });
      } catch {
        /* unreadable file is not a finding */
      }
    }
  }
  const findings = auditSources(files);
  if (asJson) {
    process.stdout.write(JSON.stringify({ scanned: files.length, findings }, null, 2) + "\n");
  } else {
    process.stdout.write(
      "lint-guards-are-reachable: scanned " +
        String(files.length) +
        " TypeScript files under " +
        searchRoots.join(", ") +
        "\n",
    );
    for (const f of findings) {
      process.stdout.write("  [" + f.rule + "] " + f.file + "\n    " + f.detail + "\n");
    }
    process.stdout.write(
      findings.length === 0
        ? "  no unreachable guards found\n"
        : "  " + String(findings.length) + " finding(s)\n",
    );
  }
  // Detect-only unless --enforce, per hygiene/AUDIT-LIFECYCLE.md step 3.
  // NOT WIRED INTO CI YET. Stated plainly because an audit nobody runs is the
  // very defect this audit exists to catch, one level up: wiring the gate job
  // is the devops lane (.github/workflows/), not this file.
  return enforce && findings.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
