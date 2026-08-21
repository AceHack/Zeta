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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { parseSha256Sums } from "../installer/multiboot/sha256sums.ts";
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

// =====================================================================
// SIDECAR MATERIALISATION -- what the auto-pull must fetch so the gate above
// has something to check.
// =====================================================================
//
// WHY THIS EXISTS. establishIsoIntegrity refuses an ISO with no manifest, and
// that refusal is correct. But zflash's own auto-pull
// (cli.ts autoDownloadFreshIsoIfNeeded) copied ONLY the `.iso` out of the CI
// download and then deleted the temp dir, so the bare `zflash` form that both
// metal runbooks recommend refused at its own gate. Measured on main
// (e15299e0) against real run 32461224707:
//
//   as shipped ....................... manifest-missing
//   sidecar copied verbatim .......... iso-not-in-manifest
//   sidecar filename field rewritten .. verified
//
// The middle line is the one that makes the rewrite load-bearing rather than
// cosmetic: the auto-pull renames the artifact to a run-stamped local name
// (`zeta-installer-25.11-ci<run>-<date>-<arch>.iso`) while CI publishes it as
// `nixos-minimal-<version>-<arch>-linux.iso`, and checkIsoAgainstManifest looks
// the file up by EXACT basename. A verbatim copy attests a filename that is no
// longer on disk.
//
// THE LINE THIS MODULE MUST NOT CROSS. The digest is transcribed from the
// PUBLISHER's manifest and never recomputed from the bytes we just downloaded.
// Hashing the downloaded file and writing that hash as its own "manifest" would
// produce a gate that passes unconditionally -- a check that cannot fail, which
// is worse than no check because it reads as one that ran. Only the FILENAME
// field is rewritten, and only after the publisher's manifest is confirmed to
// name the artifact we actually took.

/** Where a sidecar for `isoPath` may be found inside a CI download tree. */
export type SidecarSelection =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly reason: "no-manifest-in-download"; readonly searched: readonly string[] };

/**
 * Pick the manifest that covers `isoPath` out of the files in a download tree.
 *
 * Pure: takes the file list, returns a choice. `gh run download` places every
 * artifact in a directory NAMED after the artifact, so the ISO and its sidecar
 * land in SIBLING directories, not next to each other:
 *
 *   <dir>/nixos-minimal-…-x86_64-linux.iso/nixos-minimal-…-x86_64-linux.iso
 *   <dir>/nixos-minimal-…-x86_64-linux.iso.sha256/nixos-minimal-…-x86_64-linux.iso.sha256
 *   <dir>/zeta-installer-aarch64-iso/nixos-minimal-…-aarch64-linux.iso
 *   <dir>/zeta-installer-aarch64-iso.sha256/nixos-minimal-…-aarch64-linux.iso.sha256
 *
 * So matching must be on the sidecar's BASENAME anywhere in the tree, not on
 * "the file beside the ISO" -- that path is empty by construction here. Note
 * the aarch64 artifact DIRECTORY name does not match its contents, which is
 * exactly why the directory name is not consulted.
 *
 * A bare `SHA256SUMS` is accepted as a fallback, but only one covering the same
 * ISO; preference order is exact-sidecar first because a shared SHA256SUMS in a
 * multi-arch tree can name several images.
 */
export function selectManifestForIso(
  downloadedFiles: readonly string[],
  isoPath: string,
): SidecarSelection {
  const want = basename(isoPath) + ".sha256";
  const exact = downloadedFiles.find((f) => basename(f) === want);
  if (exact !== undefined) return { ok: true, path: exact };
  const sums = downloadedFiles.find((f) => basename(f) === "SHA256SUMS");
  if (sums !== undefined) return { ok: true, path: sums };
  return { ok: false, reason: "no-manifest-in-download", searched: [want, "SHA256SUMS"] };
}

export type ManifestRewrite =
  | { readonly ok: true; readonly text: string; readonly sha256: string }
  | {
      readonly ok: false;
      readonly reason: "manifest-unparseable" | "iso-not-in-manifest";
      readonly error: string;
    };

/**
 * Re-render the publisher's entry for `upstreamBasename` under `localBasename`.
 *
 * The digest is COPIED, never computed. The only edit is the filename field,
 * and it is made only after the publisher's manifest is confirmed to name the
 * upstream artifact -- if it does not, this refuses rather than inventing an
 * entry, because an entry we invented would attest nothing about what CI built.
 *
 * Output is GNU coreutils shape (`<hex>  <name>`), which parseSha256Sums reads
 * and `sha256sum -c` also accepts, so an operator can re-check by hand.
 */
export function rewriteManifestForLocalName(
  manifestText: string,
  upstreamBasename: string,
  localBasename: string,
): ManifestRewrite {
  const entries = parseSha256Sums(manifestText);
  if (entries.length === 0) {
    return {
      ok: false,
      reason: "manifest-unparseable",
      error: "the CI manifest has no parseable sha256 entries",
    };
  }
  const entry = entries.find((e) => e.filename === upstreamBasename);
  if (entry === undefined) {
    return {
      ok: false,
      reason: "iso-not-in-manifest",
      error:
        "the CI manifest does not mention " +
        upstreamBasename +
        " -- it lists: " +
        entries.map((e) => e.filename).join(", "),
    };
  }
  return { ok: true, text: entry.sha256 + "  " + localBasename + "\n", sha256: entry.sha256 };
}

/** The two effects sidecar materialisation needs, injected so both failure branches are testable. */
export interface SidecarIo {
  readonly exists: (path: string) => boolean;
  readonly readText: (path: string) => string;
  readonly writeText: (path: string, text: string) => void;
}

export type SidecarOutcome =
  | { readonly ok: true; readonly sidecarPath: string; readonly sha256: string; readonly report: string }
  | {
      readonly ok: false;
      readonly reason:
        | "no-manifest-in-download"
        | "manifest-unreadable"
        | "manifest-unparseable"
        | "iso-not-in-manifest"
        | "sidecar-unwritable";
      readonly message: string;
    };

/**
 * Put the publisher's digest for a freshly-pulled ISO beside its local copy.
 *
 * Called by the auto-pull straight after it copies the ISO. On refusal the
 * caller does NOT get to proceed quietly: the ISO simply stays unverifiable and
 * establishIsoIntegrity stops the write later with its own message. That is the
 * intended shape -- this function's job is to SUPPLY what the gate needs, never
 * to relax what the gate demands.
 *
 * Idempotent: an existing sidecar with the right content is left alone, so a
 * re-run over an already-populated ~/Downloads does no writes.
 */
export function materializeIsoSidecar(
  io: SidecarIo,
  args: {
    readonly downloadedFiles: readonly string[];
    /** The ISO as CI published it, inside the download tree. */
    readonly isoSrcPath: string;
    /** The ISO as it now sits in ~/Downloads, under its run-stamped name. */
    readonly isoDestPath: string;
  },
): SidecarOutcome {
  const selection = selectManifestForIso(args.downloadedFiles, args.isoSrcPath);
  if (!selection.ok) {
    return {
      ok: false,
      reason: "no-manifest-in-download",
      message:
        "the CI download contains no manifest for " +
        basename(args.isoSrcPath) +
        " (looked for " +
        selection.searched.join(" or ") +
        " anywhere in the download tree)",
    };
  }

  let manifestText: string;
  try {
    manifestText = io.readText(selection.path);
  } catch (err: unknown) {
    return {
      ok: false,
      reason: "manifest-unreadable",
      message:
        "found the CI manifest at " +
        selection.path +
        " but could not read it: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }

  const rewritten = rewriteManifestForLocalName(
    manifestText,
    basename(args.isoSrcPath),
    basename(args.isoDestPath),
  );
  if (!rewritten.ok) {
    return { ok: false, reason: rewritten.reason, message: rewritten.error };
  }

  const sidecarPath = args.isoDestPath + ".sha256";
  if (io.exists(sidecarPath) && io.readText(sidecarPath) === rewritten.text) {
    return {
      ok: true,
      sidecarPath,
      sha256: rewritten.sha256,
      report: "sidecar already present at " + sidecarPath,
    };
  }
  try {
    io.writeText(sidecarPath, rewritten.text);
  } catch (err: unknown) {
    return {
      ok: false,
      reason: "sidecar-unwritable",
      message:
        "could not write " +
        sidecarPath +
        ": " +
        (err instanceof Error ? err.message : String(err)),
    };
  }
  return {
    ok: true,
    sidecarPath,
    sha256: rewritten.sha256,
    report:
      "wrote " +
      sidecarPath +
      " from the CI manifest " +
      selection.path +
      "\n  sha256 " +
      rewritten.sha256 +
      " (transcribed from CI, not recomputed locally)",
  };
}

/** The real filesystem, wired once. */
export function realSidecarIo(): SidecarIo {
  return {
    exists: (p) => existsSync(p),
    readText: (p) => readFileSync(p, "utf8"),
    writeText: (p, t) => writeFileSync(p, t, "utf8"),
  };
}
