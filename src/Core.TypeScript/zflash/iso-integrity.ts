// src/Core.TypeScript/zflash/iso-integrity.ts
//
// The pre-write ISO integrity gate — ONE definition, called by every host arm.
//
// WHY THIS FILE EXISTS. Until 081M0HG7X7B087G0R002A05DAP the gate lived inline
// in the macOS arm and NOWHERE ELSE. Measured on main 2026-08-21:
//
//   grep -nE 'manifest|sha256' flash-usb.ts          -> 5 hits
//   grep -nE 'manifest|sha256' flash-usb-linux.ts    -> 0
//   grep -nE 'manifest|sha256' flash-usb-windows.ts  -> 0
//
// So on Linux and Windows zflash wrote an image to a block device with no
// integrity verification at all. That is a live gap, not a drift hazard.
//
// The obvious repair — paste the macOS block into the other two arms — is the
// defect that ./size-bounds.ts was extracted to end: four numbers defined
// twelve times under comments asserting they agreed. So the block is extracted
// here instead and the arms call it. Be precise about what that buys, because
// the failure being repaired is a comment that promised more than it checked:
// one definition means two hosts cannot disagree about what verification MEANS.
// It does not by itself mean every arm calls it — that is a separate property,
// and it is checked by hygiene/audit-flash-entrypoint-parity.ts on the gate
// floor, not asserted here.
//
// LAYERING. The verdict logic stays in ./verify.ts (checkIsoAgainstManifest,
// pure, already tested). This module adds only the part that must touch the
// world: where to look for a manifest, reading it, and hashing the ISO. Those
// three effects arrive through an injected IsoIntegrityIo, so every branch
// below — including both I/O failure branches — is testable with no ISO, no
// manifest and no device attached.
//
// FAIL CLOSED, NO OPT-OUT. Missing manifest, unparseable manifest, ISO absent
// from the manifest, digest mismatch, unreadable manifest, unreadable ISO —
// all six are REFUSALS. "No manifest found" is never "verified": that is the
// precise case the gate exists for, and it is also the cheapest one for an
// attacker to arrange, since it needs only the deletion of a file.

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { sha256FileHex } from "../installer/multiboot/resolve-artifacts.ts";
import { checkIsoAgainstManifest, type IsoRefusalReason } from "./verify.ts";

/**
 * The three effects the gate needs from the world.
 *
 * Injected rather than imported so the refusal branches are reachable in a
 * test — a guard whose failure path can only be produced by a real corrupt
 * ISO is a guard nobody has ever seen fire.
 */
export interface IsoIntegrityIo {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
  readonly sha256File: (path: string) => Promise<string>;
}

/** Refusal reasons: verify.ts's four, plus the two I/O failures only this layer can see. */
export type IsoGateRefusal = IsoRefusalReason | "manifest-unreadable" | "iso-unreadable";

export type IsoIntegrityOutcome =
  | {
      readonly ok: true;
      readonly manifestPath: string;
      readonly sha256: string;
      /** Ready to print. The arms differ in how they log, not in what they establish. */
      readonly report: string;
    }
  | {
      readonly ok: false;
      readonly reason: IsoGateRefusal;
      /** Ready to hand to the arm's bail(): says what was expected and where. */
      readonly message: string;
    };

/**
 * Where a manifest for this ISO may live, in the order they are consulted.
 *
 * Pure and exported so the refusal message and the search agree by
 * construction — a message that lists paths the code did not actually try is
 * the same class of lie as a comment asserting an unchecked invariant.
 *
 * De-duplicated: for an ordinary path the sidecar candidate and the
 * dir-joined candidate are the same string, and printing it twice in a refusal
 * makes the operator think two distinct places were searched.
 */
export function isoManifestCandidates(isoPath: string): readonly string[] {
  const isoDir = dirname(isoPath);
  const isoBase = basename(isoPath);
  const raw = [isoPath + ".sha256", join(isoDir, isoBase + ".sha256"), join(isoDir, "SHA256SUMS")];
  return [...new Set(raw)];
}

function refusalMessage(
  isoPath: string,
  reason: IsoGateRefusal,
  detail: string,
  digestLine: string,
): string {
  const isoDir = dirname(isoPath);
  const isoBase = basename(isoPath);
  return (
    "ISO INTEGRITY NOT ESTABLISHED (" +
    reason +
    ")\n  " +
    detail +
    "\n  looked for a manifest at:\n    " +
    isoManifestCandidates(isoPath).join("\n    ") +
    "\n  computed sha256: " +
    digestLine +
    "\n  To proceed, put the publisher's SHA256SUMS — or a " +
    isoBase +
    ".sha256 sidecar —\n  next to the ISO in " +
    isoDir +
    ", obtained from the same place the ISO was.\n" +
    "  No device has been touched."
  );
}

/**
 * Establish this ISO's integrity, or produce the refusal that stops the write.
 *
 * Every host arm calls this BEFORE it enumerates devices, so a refusal costs
 * the operator nothing and touches nothing.
 *
 * @guard-input establishIsoIntegrity requires isoPath -- the fail-closed ISO manifest gate; an arm that never calls it writes unverified bytes to a block device
 */
export async function establishIsoIntegrity(
  isoPath: string,
  io: IsoIntegrityIo,
): Promise<IsoIntegrityOutcome> {
  const isoBase = basename(isoPath);
  const candidates = isoManifestCandidates(isoPath);

  const manifestPath = candidates.find((p) => io.exists(p)) ?? null;

  // An unreadable manifest is NOT a missing one. Both refuse, but a permission
  // error reported as "no manifest found" sends the operator to download a
  // file they already have.
  let manifestText: string | null = null;
  if (manifestPath !== null) {
    try {
      manifestText = io.readText(manifestPath);
    } catch (err: unknown) {
      return {
        ok: false,
        reason: "manifest-unreadable",
        message: refusalMessage(
          isoPath,
          "manifest-unreadable",
          "found " + manifestPath + " but could not read it: " +
            (err instanceof Error ? err.message : String(err)),
          "not computed — the manifest was unreadable, so nothing was hashed",
        ),
      };
    }
  }

  let digest: string;
  try {
    digest = await io.sha256File(isoPath);
  } catch (err: unknown) {
    return {
      ok: false,
      reason: "iso-unreadable",
      message: refusalMessage(
        isoPath,
        "iso-unreadable",
        "could not hash " + isoPath + ": " + (err instanceof Error ? err.message : String(err)),
        "not computed — the ISO could not be read",
      ),
    };
  }

  const verdict = checkIsoAgainstManifest(manifestText, isoBase, digest);
  if (!verdict.ok) {
    return {
      ok: false,
      reason: verdict.reason,
      message: refusalMessage(isoPath, verdict.reason, verdict.error, digest),
    };
  }

  return {
    ok: true,
    manifestPath: String(manifestPath),
    sha256: verdict.sha256,
    report: "ISO verified against " + String(manifestPath) + "\n  sha256 " + verdict.sha256 + "\n",
  };
}

/**
 * The real filesystem, wired once, so no arm hand-rolls its own three effects.
 */
export function realIsoIntegrityIo(): IsoIntegrityIo {
  return {
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    sha256File: sha256FileHex,
  };
}
