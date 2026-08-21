#!/usr/bin/env bun
// lint-hsm-delegated-capability-escalation.ts — privilege must be monotone-DECREASING across
// YubiHSM 2 delegation. A roster where it is not is broken before any attacker shows up.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// WHAT THIS CHECKS, AND — LOUDLY — WHAT IT DOES NOT
// ─────────────────────────────────────────────────────────────────────────────────────────
//
//   CHECKED:     a DECLARED roster (JSON). Data in, findings out. Pure: no device, no
//                credential, no network, no clock. Runs on a laptop with nothing plugged in.
//
//   NOT CHECKED: the device. Nothing here reads a YubiHSM. A green result says "the roster
//                you intend to provision is monotone", never "the attached device is
//                configured this way". Reading real object metadata requires an
//                authenticated session, i.e. a credential, which an agent may not hold. So
//                the roster carries a mandatory `provisioningStatus` field and this lint
//                PRINTS IT on every run, including the clean one — because "lint passed"
//                and "device is safe" being confusable is precisely the vacuity failure
//                this repo keeps finding.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// THE CORE THEOREM (this is the point; a one-hop check misses it)
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// Yubico writes, of Delegated Capabilities:
//
//   "These define the maximum capabilities that can be assigned to any new object created in
//    a session opened with that key. In other words, a session cannot create an object that
//    has more permissions than the Authentication Key itself is delegated to grant. This
//    prevents a lower-privileged operator from creating keys with higher privileges than
//    their own."
//        — YubiHSM 2 User Guide §1.4, "Delegated Capabilities: Controlling What Others Can
//          Create"
//
// That last sentence holds only if "their own" means DELEGATED, not CAPABILITIES. The
// operator who creates an authentication key CHOOSES ITS PASSWORD, and can then open a
// session with it. Therefore:
//
//     effective(A) = capabilities(A) ∪ delegated(A),  whenever put-authentication-key
//                                                     ∈ capabilities(A)
//
// A roster that carefully keeps `export-wrapped` out of an agent key's CAPABILITIES while
// leaving it in that key's DELEGATED set has not reduced privilege. It has renamed it. That
// is the most likely real provisioning error, it is invisible to inspection, and it is what
// this lint computes.
//
// It does not stop at one hop, which is why this is a CLOSURE and not a comparison:
//
//   A: capabilities {put-wrap-key, import-wrapped}
//      delegated    {import-wrapped, sign-ecdsa, put-authentication-key}
//
//   A cannot mint an authentication key — put-authentication-key is not in its CAPABILITIES,
//   so a one-hop check reports clean. But:
//     hop 1  A mints wrap key W (put-wrap-key ∈ caps(A)); caps(W), delegated(W) ⊆ delegated(A)
//            ⇒ delegated(W) may contain put-authentication-key
//     hop 2  A imports an object under W (import-wrapped ∈ caps(A) and ∈ caps(W)); the
//            imported object's capabilities are bounded by delegated(W), NOT delegated(A)
//     hop 3  that object is an authentication key holding put-authentication-key.
//   A now controls a key strictly more capable than A. Three hops, no vulnerability.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// THE DEVICE RULES THIS ENCODES — every one quoted from a primary source, none invented
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// All quotes: YubiHSM 2 User Guide, https://docs.yubico.com/hardware/yubihsm-2/hsm-2-user-guide/
// machine-read from the shipped `webdocs.pdf` (revision dated 2026-08-12, fetched 2026-08-20).
//
//  R1  CAPABILITY BITS. "A Set of Capabilities is an 8-byte value. Each Capability is
//      identified by a specific bit" (§1.2.3). The bit-INDEX table below is transcribed from
//      `yh_capability[]` in Yubico/yubihsm-shell `lib/yubihsm.h` (master, fetched
//      2026-08-20) — the authoritative machine-readable form. Mask = 1n << BigInt(bit).
//      So `put-authentication-key` is bit 0x02, i.e. hex mask 0x0000000000000004.
//
//  R2  DOMAINS ON CREATE — monotone, device-enforced. "an object cannot be created with
//      access to Domains that the Authentication Key used to create it does not have access
//      to." (§3.6.) 16 domains; domain N is bit N-1 of a 16-bit mask (§1.2.4).
//
//  R3  CAPABILITIES + DELEGATED ON CREATE — monotone, device-enforced. "The new
//      Authentication Key capabilities and delegated capabilities must all be part of the
//      delegated capabilities of the Authentication Key used to open the session."
//      (§6.1.44 PUT AUTHENTICATION KEY; identical wording at §6.1.43 for the asymmetric
//      variant.) And for wrap keys: "Wrap Key capabilities and delegated capabilities must
//      all be part of the Authentication Key delegated capabilities." (§6.1.50 PUT WRAP KEY.)
//
//  R4  IMPORT WRAPPED — the one edge the documentation does NOT close. "The imported object
//      retains its metadata (Object ID, Domains, Capabilities, etc)". Its Required
//      Capabilities list is, in full: auth key has `import-wrapped`; wrap key has
//      `import-wrapped`; "Target object capabilities must all be part of the Wrap Key
//      delegated capabilities." (§6.1.38.)
//
//      Note what is ABSENT: any constraint binding the imported object's DOMAINS to the
//      session's authentication key, and any binding its capabilities to the SESSION key's
//      delegated set rather than the WRAP KEY's. Documentation silence is not permission —
//      the device may enforce a rule the manual omits. So this edge is modelled under two
//      NAMED semantics and its finding carries its own register. It is NOT reported as a
//      proven escalation.
//
//  R5  CHANGE AUTHENTICATION KEY IS NOT AN ESCALATION EDGE — checked, and it looked like one.
//      "Replace the Authentication Key used to establish the current Session. It is not
//      possible to modify any of the metadata connected to the Object such as Domains or
//      Capabilities." (§6.1.6.) It rekeys only the session's OWN key. A model that assumed
//      `change-authentication-key` takes over a peer's key would be wrong; recorded here so
//      nobody re-derives the false version.
//
//  R6  `delete-object` IS NOT A CAPABILITY. It is a COMMAND (§6.1.15 DELETE OBJECT) whose
//      required capability is per-type: "to delete an Asymmetric Key the Authentication Key
//      must have the delete-asymmetric-key capability." There is no `delete-object` entry in
//      `yh_capability[]`. A roster naming it is REFUSED, with the nine-member family named —
//      a silently-ignored capability name in a security roster is a permission you only
//      think you denied.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/lint-hsm-delegated-capability-escalation.ts
//   bun ... --enforce            exit 1 on findings
//   bun ... --json               machine-readable
//   bun ... --roster <path>      audit a different roster
//   bun ... --model documented|doc-silent-pessimistic|both     (default: both)
//
// Exit codes: 0 clean or detect-only · 1 findings AND --enforce · 2 roster unreadable or
//             structurally invalid (fail-closed: an unparseable security roster is never
//             "no findings") · 64 argument error.

import { readFileSync } from "node:fs";

import {
  auditRoster,
  domainList,
  domainMask,
  validateRoster,
  type EscalationModel,
  type Finding,
  type Roster,
  type Severity,
} from "./hsm-authkey-model.ts";

export const DEFAULT_ROSTER = "src/Core.TypeScript/hygiene/hsm-authkey-roster.json";

const SEV_ORDER: ReadonlyMap<Severity, number> = new Map([
  ["high", 0],
  ["medium", 1],
  ["informational", 2],
]);

export function formatReport(roster: Roster, findings: readonly Finding[]): string {
  const spread = roster.partition.reduce((m, p) => m | domainMask(p.domains), 0);
  const lines: string[] = [
    "hsm delegated-capability escalation lint - device: " + roster.device,
    "ROSTER STATUS: " +
      roster.provisioningStatus +
      " - this lint reads a DECLARATION, never the device. No session was opened; no credential was handled.",
    String(roster.keys.length) +
      " key(s), " +
      String(roster.partition.length) +
      " principal(s) across domains " +
      domainList(spread).join(", "),
  ];
  if (findings.length === 0) {
    lines.push("");
    lines.push("no findings: privilege is monotone-decreasing across every declared delegation chain,");
    lines.push("under BOTH the documented and the doc-silent-pessimistic device models.");
    return lines.join("\n");
  }
  const sorted = Array.from(findings).sort(
    (a, b) => (SEV_ORDER.get(a.severity) ?? 9) - (SEV_ORDER.get(b.severity) ?? 9) || ordinalCompare(a.key, b.key),
  );
  lines.push("");
  lines.push(String(sorted.length) + " finding(s):");
  for (const f of sorted) {
    lines.push("");
    lines.push(
      "  [" +
        f.severity.toUpperCase() +
        "] " +
        f.rule +
        " - " +
        f.key +
        "  principal=" +
        f.principal +
        "  register=" +
        f.register,
    );
    lines.push("    " + f.message);
  }
  return lines.join("\n");
}

/**
 * Ordinal, never linguistic. `.claude/rules/culture-invariant-by-default.md`: a report whose
 * finding order depends on the machine locale is a report two reviewers cannot diff.
 */
function ordinalCompare(a: string, b: string): number {
  if (a === b) return 0;
  return a <= b ? -1 : 1;
}

interface Args {
  readonly rosterPath: string;
  readonly models: readonly EscalationModel[];
  readonly enforce: boolean;
  readonly asJson: boolean;
}

export function parseArgs(argv: readonly string[]): Args | number {
  let rosterPath = DEFAULT_ROSTER;
  let models: readonly EscalationModel[] = ["documented", "doc-silent-pessimistic"];
  let enforce = false;
  let asJson = false;

  for (let i = 0; i !== argv.length; i += 1) {
    const a = argv[i];
    if (a === "--enforce") enforce = true;
    else if (a === "--json") asJson = true;
    else if (a === "--roster") {
      const v = argv[i + 1];
      if (v === undefined) return 64;
      rosterPath = v;
      i += 1;
    } else if (a === "--model") {
      const v = argv[i + 1];
      if (v === "documented" || v === "doc-silent-pessimistic") models = [v];
      else if (v === "both") models = ["documented", "doc-silent-pessimistic"];
      else return 64;
      i += 1;
    } else return 64;
  }
  return { rosterPath, models, enforce, asJson };
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  if (typeof args === "number") {
    process.stderr.write(
      "usage: lint-hsm-delegated-capability-escalation [--enforce] [--json] [--roster PATH] [--model documented|doc-silent-pessimistic|both]\n",
    );
    return args;
  }

  let roster: Roster;
  try {
    roster = JSON.parse(readFileSync(args.rosterPath, "utf8")) as Roster;
  } catch (e) {
    process.stderr.write("cannot read roster " + args.rosterPath + ": " + String(e) + "\n");
    process.stderr.write("An unreadable security roster is NOT no-findings. Failing closed.\n");
    return 2;
  }

  const errs = validateRoster(roster);
  if (errs.length !== 0) {
    process.stderr.write(
      "roster " + args.rosterPath + " is structurally invalid - " + String(errs.length) + " error(s):\n",
    );
    for (const e of errs) process.stderr.write("  " + e.kind + ": " + e.detail + "\n");
    process.stderr.write("Failing closed: a roster that cannot be parsed into the device own model proves nothing.\n");
    return 2;
  }

  const findings = auditRoster(roster, args.models);
  if (args.asJson) {
    const payload = {
      roster: args.rosterPath,
      provisioningStatus: roster.provisioningStatus,
      models: args.models,
      findings,
    };
    process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
  } else {
    process.stdout.write(formatReport(roster, findings) + "\n");
  }
  return findings.length !== 0 && args.enforce ? 1 : 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
