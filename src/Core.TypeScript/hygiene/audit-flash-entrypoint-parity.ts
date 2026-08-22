#!/usr/bin/env bun
// src/Core.TypeScript/hygiene/audit-flash-entrypoint-parity.ts
//
// EVERY zflash host arm must reach the ISO integrity gate before it writes.
//
// THE DEFECT THIS EXISTS FOR, measured on main 2026-08-21
// (workitems/081M0HG7X7B087G0R002A05DAP): the manifest check lived in the
// macOS arm and only there. flash-usb-linux.ts and flash-usb-windows.ts wrote
// an image to a block device with no integrity verification of any kind. Three
// arms, one gate, two of them without it — and nothing said so, because a
// missing check is invisible: the tests of the arms that HAVE it stayed green,
// and the arms that lack it have nothing to test.
//
// That is the organising rule of this directory restated: a check that did not
// run must never look like a check that passed. An arm with no gate is the
// purest form — it does not even look like a check, it looks like a flash tool
// that works.
//
// WHY AN AUDIT RATHER THAN A TEST. A test can prove the gate refuses. It
// cannot prove an arm CALLS it, because the caller in a test is the test. Only
// something that reads the call sites can, which is the same premise as
// hygiene/lint-guards-are-reachable.ts — that lint asks whether a guard's
// inputs are ever supplied in production; this asks whether a guard is on
// every live path that needs it. (Anchor, Beacon: Lipton/DeMillo/Sayward 1978,
// mutation testing — can the check fail when the world is wrong?)
//
// THE ROSTER IS DERIVED, NOT WRITTEN DOWN. Arms are found by scanning the
// zflash directory, so a fourth host arm is audited the moment it exists. A
// hand-written list would drift from the directory and a drifted list passes —
// the same reason audit-proof-lineage-binaries.ts derives its exempt set from
// the byte-lock runner rather than from an allowlist.
//
// WHAT IS AND IS NOT CHECKED, stated so nobody reads more into a pass than is
// there. This is a SOURCE-LEVEL audit: it checks that the gate is called
// inside main(), that its failure branch exits, and that the call precedes
// every destructive operation in that function. It does not execute an arm and
// it cannot: two of the three only run on an OS this repo's CI does not flash
// from. It would not catch a gate reached only under an `if` that is never
// true. What it does catch is the entire observed defect class — an arm with
// no gate at all, and a gate placed after the write.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The gate every arm must reach. One name, so there is one thing to grep for. */
export const GATE_FN = "establishIsoIntegrity";

/**
 * Operations that touch the device, by the name each arm calls them by.
 *
 * Generic across arms rather than a per-arm map: a per-arm map is a
 * hand-written list, and a hand-written list is the thing this file's roster
 * discipline refuses. An arm whose main() contains NONE of these is itself a
 * finding — an ordering check with nothing to order against is vacuous, and a
 * vacuous check is exactly what this audit exists to refuse.
 */
export const DESTRUCTIVE_TOKENS: readonly string[] = [
  "spawn(",
  "ddArgs(",
  "copyImageToDevice(",
];

export type ParityRule =
  | "gate-absent"
  | "gate-result-discarded"
  | "gate-refusal-not-wired"
  | "gate-after-write"
  | "no-destructive-operation"
  | "no-main";

export interface ParityFinding {
  readonly rule: ParityRule;
  readonly arm: string;
  readonly detail: string;
}

/**
 * Blank out comments, preserving offsets so indices stay comparable.
 *
 * Load-bearing in both directions. A gate call written in a comment is not a
 * call — counting it would make this audit fail OPEN, which is worse than not
 * existing. And the prose above, which names the gate repeatedly, must not
 * satisfy the audit on this file's behalf.
 *
 * Honest limit, same as lint-guards-are-reachable.ts: regex literals are not
 * tracked, so an unescaped // inside one would swallow its line. Strings and
 * template literals ARE tracked.
 */
export function stripComments(text: string): string {
  const out: string[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";
    if (ch === '"' || ch === "'" || ch === "`") {
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

/**
 * The arms, derived from the directory listing.
 *
 * `flash-usb.ts` plus `flash-usb-<host>.ts`. Test files and helper modules
 * (`flash-and-inject.ts`) are not entrypoints and are not arms.
 */
export function armFilenames(entries: readonly string[]): readonly string[] {
  return entries
    .filter((f) => /^flash-usb(?:-[a-z0-9]+)?\.ts$/.test(f))
    .filter((f) => !f.endsWith(".test.ts"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The body of `main`, from its declaration to end of file. */
export function mainBody(strippedText: string): string | null {
  const at = strippedText.search(/\basync\s+function\s+main\s*\(/);
  if (at < 0) return null;
  return strippedText.slice(at);
}

/**
 * The name the gate's verdict was bound to, e.g. `integrity`.
 *
 * Read from the declaration the call sits in, so the failure-branch rule below
 * follows the code's own vocabulary instead of assuming a name.
 */
export function bindingOfGateResult(body: string, gateAt: number): string | null {
  const lineStart = body.lastIndexOf("\n", gateAt) + 1;
  const decl = body.slice(lineStart, gateAt);
  const m = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:await\s+)?$/.exec(decl);
  return m?.[1] ?? null;
}

/**
 * The body of the `if (!<binding>.ok) …` branch — statement or braced block.
 *
 * Balanced scan rather than a fixed character window. A window is what let the
 * warning-downgrade mutant survive: it does not distinguish "this branch
 * exits" from "some later, unrelated line exits".
 */
export function failureBranchBody(body: string, binding: string, from: number): string | null {
  const re = new RegExp(String.raw`!\s*` + binding + String.raw`\s*\.\s*ok\b`, "g");
  re.lastIndex = from;
  const m = re.exec(body);
  if (m === null) return null;
  let i = m.index + m[0].length;
  // Step over the rest of the if-condition.
  while (i < body.length && body[i] !== ")") i++;
  i++;
  while (i < body.length && /\s/.test(body[i] ?? "")) i++;
  if (body[i] === "{") {
    let depth = 0;
    const start = i;
    while (i < body.length) {
      if (body[i] === "{") depth++;
      else if (body[i] === "}") {
        depth--;
        if (depth === 0) return body.slice(start, i + 1);
      }
      i++;
    }
    return body.slice(start);
  }
  const end = body.indexOf(";", i);
  return end < 0 ? body.slice(i) : body.slice(i, end + 1);
}

/**
 * The whole rule set, over one arm's already-stripped source.
 *
 * Pure over a string, so the audit's own refusals are falsifiable without a
 * filesystem — an audit whose failure path nobody can produce is the defect it
 * is auditing for.
 */
export function auditArm(arm: string, strippedText: string): readonly ParityFinding[] {
  const body = mainBody(strippedText);
  if (body === null) {
    return [
      {
        rule: "no-main",
        arm,
        detail:
          "no `async function main(` found. This audit locates the live path by that " +
          "declaration; an arm that names its entrypoint otherwise is unaudited, which is " +
          "not a state this file will report as a pass.",
      },
    ];
  }

  const findings: ParityFinding[] = [];
  const gateAt = body.indexOf(GATE_FN + "(");
  if (gateAt < 0) {
    findings.push({
      rule: "gate-absent",
      arm,
      detail:
        "main() never calls " +
        GATE_FN +
        "(). This arm writes an image to a block device without establishing that the " +
        "ISO is the one it claims to be. Import it from zflash/iso-integrity.ts and call " +
        "it before any device is enumerated — do not re-implement it per host.",
    });
    return findings;
  }

  // The refusal must EXIT, and the exit must be THIS gate's failure branch.
  //
  // The first version of this rule looked for a `bail(` anywhere in the 400
  // characters after the call — and it SURVIVED the mutation that downgraded
  // the Linux arm's refusal to a warning, because the next unrelated guard's
  // `bail(` was inside the window. That is this repo's own defect class caught
  // in the check written to catch it: a rule that passes for a reason unrelated
  // to what it claims to establish. The rule below is structural instead — it
  // reads the gate's OWN failure branch and requires the exit inside it.
  const binding = bindingOfGateResult(body, gateAt);
  if (binding === null) {
    findings.push({
      rule: "gate-result-discarded",
      arm,
      detail:
        GATE_FN +
        "'s result is not bound to anything, so nothing can branch on it. A verdict nobody " +
        "reads is not a gate.",
    });
    return findings;
  }
  const branch = failureBranchBody(body, binding, gateAt);
  if (branch === null || !branch.includes("bail(")) {
    findings.push({
      rule: "gate-refusal-not-wired",
      arm,
      detail:
        GATE_FN +
        " is called and bound to `" +
        binding +
        "`, but its failure branch does not bail(). " +
        (branch === null
          ? "No `!" + binding + ".ok` branch was found at all."
          : "The branch runs: " + branch.trim().slice(0, 120)) +
        " A verdict nobody acts on is not a gate — an ISO that failed verification would " +
        "still be written.",
    });
  }

  const writeAts = DESTRUCTIVE_TOKENS.map((t) => body.indexOf(t)).filter((i) => i >= 0);
  if (writeAts.length === 0) {
    findings.push({
      rule: "no-destructive-operation",
      arm,
      detail:
        "main() contains none of " +
        DESTRUCTIVE_TOKENS.join(" ") +
        ", so the ordering rule below has nothing to order against and would pass " +
        "vacuously. Either this arm no longer writes (and is not an arm), or it writes " +
        "by a name this audit does not know — add it to DESTRUCTIVE_TOKENS.",
    });
    return findings;
  }

  const firstWriteAt = Math.min(...writeAts);
  if (gateAt > firstWriteAt) {
    findings.push({
      rule: "gate-after-write",
      arm,
      detail:
        GATE_FN +
        " is called AFTER the first destructive operation in main(). Verifying an ISO " +
        "once its bytes are already on the stick establishes nothing that matters.",
    });
  }

  return findings;
}

export interface ArmSource {
  readonly arm: string;
  readonly text: string;
}

export function auditAll(arms: readonly ArmSource[]): readonly ParityFinding[] {
  if (arms.length === 0) {
    return [
      {
        rule: "gate-absent",
        arm: "(none)",
        detail:
          "no zflash host arms were found at all. The roster is derived from the " +
          "directory listing, so an empty roster means the scan is looking in the wrong " +
          "place — and an audit that finds nothing to audit must not report success.",
      },
    ];
  }
  return arms.flatMap((a) => auditArm(a.arm, stripComments(a.text)));
}

function main(): void {
  const dir = join(import.meta.dir, "..", "zflash");
  const arms = armFilenames(readdirSync(dir)).map((arm) => ({
    arm: join("src/Core.TypeScript/zflash", arm),
    text: readFileSync(join(dir, arm), "utf8"),
  }));

  const findings = auditAll(arms);
  if (findings.length === 0) {
    process.stdout.write(
      "flash-entrypoint parity OK — " +
        String(arms.length) +
        " arm(s), each reaching " +
        GATE_FN +
        " before any write: " +
        arms.map((a) => a.arm).join(", ") +
        "\n",
    );
    return;
  }

  process.stderr.write("flash-entrypoint parity VIOLATED\n\n");
  for (const f of findings) {
    process.stderr.write("  [" + f.rule + "] " + f.arm + "\n    " + f.detail + "\n\n");
  }
  process.exit(1);
}

if (import.meta.main) main();
