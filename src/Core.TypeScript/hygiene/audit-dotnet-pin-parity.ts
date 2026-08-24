#!/usr/bin/env bun
// audit-dotnet-pin-parity.ts — the .NET SDK version is declared ONCE.
//
// THE DEFECT THIS CLOSES (radar audit 2026-08-23, workitem 081M0Q9Y658087G0R002ZWZNSF):
// `global.json` said `10.0.302` with `rollForward: latestPatch`, and `.mise.toml` said
// `dotnet = "10.0.302"` EXACTLY. Two declarations of one fact, with nothing checking that
// they agree — so the tree could carry a `global.json` a reader trusts and a mise pin that
// silently decides. That is the vacuity class in pin form: a declaration that looks
// authoritative and is not consulted.
//
// THE RESOLUTION, stated so it is not re-litigated per bump:
//
//   `.mise.toml`'s `dotnet` pin is the SINGLE DECLARED SOURCE.
//
// Because mise is the only one of the two that ACQUIRES an SDK. `global.json`'s
// `rollForward` is a RESOLUTION policy over SDKs already on the machine — it has never
// downloaded one — so `latestPatch` was never the security-uptake mechanism it reads like.
// Nothing was "silently overridden": the property was not there to override.
//
// `global.json` is NOT demoted to a pointer, and that is deliberate. Under
// `.claude/rules/clone-at-tag-stays-sufficient.md` the tree must stay buildable from a
// clone at a tag with no package manager present, and `global.json` is the .NET-native
// contract that path reads. So it keeps a real, exact version — a RESTATEMENT, held equal
// by this check rather than by hope.
//
// `rollForward: latestPatch` also stays, for that same no-mise path: given an SDK set that
// already contains a newer patch in the band, taking it is right. It is tolerance, not an
// update mechanism, and the `//` note in `global.json` now says so where a reader looks.
//
// WHAT THIS CHECKS
//   1. `.mise.toml` declares exactly one `dotnet` pin, and it is an exact 3-part version.
//      (A range would reintroduce the ambiguity: mise would resolve it per-machine and the
//      restatement could not be checked against anything.)
//   2. `global.json`'s `sdk.version` is byte-equal to it.
//   3. Both sit in the same FEATURE BAND. A feature-band move (10.0.3xx -> 10.0.4xx) is the
//      change that moves the bundled Roslyn, and therefore the one that must carry the
//      `Microsoft.CodeAnalysis.*` and `FSharp.Core` pins with it. Named here so the coupling
//      is legible at the place the version is checked.
//
// It does NOT invoke `dotnet` — it is a text check, offline, and runs where no SDK exists.
// The complementary runtime check is `audit-codeanalysis-sdk-match.ts`, which reads the
// SDK's ACTUAL `csc -version`; the two answer different questions and neither replaces
// the other.
//
// Run:   bun src/Core.TypeScript/hygiene/audit-dotnet-pin-parity.ts
// Exit:  0 — the two declarations agree
//        1 — they disagree, or a declaration is missing/malformed

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The file the canonical value is read FROM. Never restate its value in this file. */
export const CANONICAL_PIN_FILE = ".mise.toml";
/** The file that RESTATES it for the no-package-manager path. */
export const RESTATEMENT_FILE = "global.json";

/**
 * The `dotnet` pin in a `.mise.toml` body.
 *
 * Anchored to line-start (multiline) so a `dotnet = ` appearing inside one of that file's
 * long `#` comment blocks is not mistaken for the declaration. The comment immediately
 * above the real pin discusses `dotnet-install.sh`; an unanchored match is exactly the
 * "decide by grep" failure this repo lints for elsewhere.
 */
export function parseMisePin(text: string): string[] {
  const re = /^[ \t]*dotnet[ \t]*=[ \t]*"([^"]+)"/gm;
  return [...text.matchAll(re)].flatMap((m) => (m[1] === undefined ? [] : [m[1]]));
}

/** `sdk.version` out of a global.json body. Parsed as JSON — not grepped. */
export function parseGlobalJsonSdk(text: string): { version?: string; rollForward?: string } {
  const doc = JSON.parse(text) as { sdk?: { version?: string; rollForward?: string } };
  return doc.sdk ?? {};
}

/** An exact three-part version, no range operators, no wildcards. */
export function isExactVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(v);
}

/** `10.0.303` -> `10.0.3xx`. The band a `latestPatch` roll may move inside. */
export function featureBand(v: string): string | null {
  const m = /^(\d+)\.(\d+)\.(\d)\d\d$/.exec(v);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  return `${m[1]}.${m[2]}.${m[3]}xx`;
}

export interface Finding {
  readonly ok: boolean;
  readonly message: string;
}

/** Pure core, so the failures below are testable without touching the filesystem. */
export function checkPins(miseText: string, globalJsonText: string): Finding[] {
  const out: Finding[] = [];
  const pins = parseMisePin(miseText);

  if (pins.length !== 1 || pins[0] === undefined) {
    out.push({
      ok: false,
      message:
        `${CANONICAL_PIN_FILE}: expected exactly ONE \`dotnet = "…"\` declaration, found ${String(pins.length)}. ` +
        `The canonical source cannot be ambiguous.`,
    });
    return out;
  }
  const canonical: string = pins[0];

  if (!isExactVersion(canonical)) {
    out.push({
      ok: false,
      message:
        `${CANONICAL_PIN_FILE}: \`dotnet = "${canonical}"\` is not an exact X.Y.Z version. ` +
        `A range resolves per-machine, so the ${RESTATEMENT_FILE} restatement could not be checked against it, ` +
        `and installs stop being deterministic (§7 DST).`,
    });
    return out;
  }

  let sdk: { version?: string; rollForward?: string };
  try {
    sdk = parseGlobalJsonSdk(globalJsonText);
  } catch (e) {
    out.push({ ok: false, message: `${RESTATEMENT_FILE}: not parseable as JSON — ${String(e)}` });
    return out;
  }

  if (!sdk.version) {
    out.push({ ok: false, message: `${RESTATEMENT_FILE}: no \`sdk.version\`.` });
    return out;
  }

  if (sdk.version !== canonical) {
    out.push({
      ok: false,
      message:
        `PIN DISAGREEMENT: ${CANONICAL_PIN_FILE} declares \`${canonical}\`, ${RESTATEMENT_FILE} restates ` +
        `\`${sdk.version}\`. ${CANONICAL_PIN_FILE} is the single declared source — move ${RESTATEMENT_FILE} to match it.`,
    });
    return out;
  }

  const band = featureBand(canonical);
  out.push({
    ok: true,
    message:
      `✓ .NET SDK declared once: ${canonical}` +
      (band ? ` (feature band ${band})` : "") +
      `, restated identically in ${RESTATEMENT_FILE}` +
      (sdk.rollForward ? ` with rollForward=${sdk.rollForward}` : "") +
      `.`,
  });

  if (band) {
    out.push({
      ok: true,
      message:
        `  note: a move OUT of ${band} is a feature-band change — it moves the SDK's bundled Roslyn, so ` +
        `\`Microsoft.CodeAnalysis.*\` and \`FSharp.Core\` must move in the SAME commit ` +
        `(see the dependabot \`ignore:\` entries and audit-codeanalysis-sdk-match.ts).`,
    });
  }

  return out;
}

function main() {
  const root = process.cwd();
  const findings = checkPins(
    readFileSync(join(root, CANONICAL_PIN_FILE), "utf8"),
    readFileSync(join(root, RESTATEMENT_FILE), "utf8"),
  );
  let failed = false;
  for (const f of findings) {
    if (f.ok) console.log(`[dotnet-pin-parity] ${f.message}`);
    else {
      console.error(`[dotnet-pin-parity] ✗ ${f.message}`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
}

if (import.meta.main) main();
