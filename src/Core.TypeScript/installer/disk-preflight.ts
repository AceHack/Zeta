/**
 * disk-preflight.ts -- the pre-format probe, the wipe-scope decision, and the
 * cancel-window plan for zeta-install.sh (design doc 2026-08-21 4.3/4.4).
 *
 * PURE: no I/O, no child processes, nothing destructive. The shell gathers
 * facts read-only (lsblk / blkid / a read-only mount) and this module decides.
 *
 * WHY THIS IS A SPEC AND NOT A CALLEE
 * -----------------------------------
 * Measured 2026-08-21: the installer ISO ships NO bun and NO nodejs
 * (usb-nixos-installer/nixos/installer/configuration.nix systemPackages), and
 * the repo is not cloned until AFTER the wipe (zeta-install.sh Step 6). So
 * nothing on the pre-wipe path can execute TypeScript. A module the shell
 * "calls" would be a golden vector nothing reads.
 *
 * What keeps this file honest instead: disk-preflight-shell-parity.test.ts
 * EXTRACTS the marked bash block out of zeta-install.sh, RUNS it against the
 * same fixtures this module is tested with, and compares. The shell is the
 * implementation; this module is the executable specification; the parity test
 * is the falsifier that fails when either side drifts.
 *
 * NOTHING HERE IS PROVEN UNTIL A NODE BOOTS. Hermetic decisions over synthetic
 * facts. No metal evidence exists.
 */

import {
  expectedBindingScenarioOutcome,
  type CredentialBindingFactorKind,
} from "./credential-binding-model.ts";

// -- Facts the shell can gather read-only ------------------------------------

/** One partition of a candidate disk, as enumerated read-only. */
export type PartitionFact = {
  readonly name: string;
  readonly fstype: string;
  readonly label: string;
  readonly partlabel: string;
  readonly sizeBytes: number;
  readonly fsUsedBytes: number | null;
};

/**
 * What a READ-ONLY mount of a candidate ESP found.
 * Never carries secret CONTENT; only presence flags and a factor NAME.
 */
export type EspFact = {
  readonly partition: string;
  readonly hasCredsBlob: boolean;
  readonly recordedBindingFactor: CredentialBindingFactorKind | null;
  readonly hasZetaEfiDir: boolean;
};

/** Everything known about one candidate disk before any destructive call. */
export type DiskFacts = {
  readonly device: string;
  readonly sizeBytes: number;
  readonly transport: string;
  readonly ptType: string;
  readonly volumeLabels: readonly string[];
  readonly partitions: readonly PartitionFact[];
  readonly esp: EspFact | null;
  readonly probeErrors: readonly string[];
};

export type DiskDisposition =
  | "installer-medium"
  | "prior-zeta-install"
  | "foreign-data"
  | "blank"
  | "indeterminate";

export type DiskClassification = {
  readonly device: string;
  readonly disposition: DiskDisposition;
  readonly evidence: readonly string[];
};

export const ZETA_INSTALLER_VOLUME_LABEL = "ZETA_INSTALL";
export const ZETA_ESP_LABEL = "boot";
export const ZETA_ROOT_LABEL = "nixos";
const ZETA_PARTLABELS = new Set(["ESP", "root", "longhorn1"]);

const ZETA_DATA_LABEL_RE = /^longhorn[0-9]+$/;

function isZetaOwnedPartition(p: PartitionFact): boolean {
  if (p.label === ZETA_ROOT_LABEL) return true;
  if (ZETA_DATA_LABEL_RE.test(p.label)) return true;
  if (p.label === ZETA_ESP_LABEL) {
    if (p.fstype === "vfat") return true;
  }
  if (ZETA_PARTLABELS.has(p.partlabel)) return true;
  return false;
}

function gib(bytes: number): string {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GiB";
}

/**
 * Classify one disk. Failure CLOSED: any probe error, or any partition we
 * cannot account for, keeps the disk out of the blank bucket.
 */
export function classifyDisk(facts: DiskFacts): DiskClassification {
  const evidence: string[] = [];

  // The refusal outranks every other reading, including probe failure.
  if (facts.volumeLabels.includes(ZETA_INSTALLER_VOLUME_LABEL)) {
    evidence.push("volume label " + ZETA_INSTALLER_VOLUME_LABEL + " : this is the Zeta installer medium");
    return { device: facts.device, disposition: "installer-medium", evidence };
  }

  const zetaParts = facts.partitions.filter(isZetaOwnedPartition);
  const foreignParts = facts.partitions.filter((p) => {
    if (isZetaOwnedPartition(p)) return false;
    if (p.fstype !== "") return true;
    if (p.label !== "") return true;
    return false;
  });

  if (facts.esp !== null) {
    if (facts.esp.hasCredsBlob) {
      const binding = facts.esp.recordedBindingFactor ?? "unrecorded";
      evidence.push(facts.esp.partition + ": zeta-creds.enc present (binding=" + binding + ")");
    }
    if (facts.esp.hasZetaEfiDir) {
      evidence.push(facts.esp.partition + ": EFI/ZETA directory present");
    }
  }

  for (const p of zetaParts) {
    evidence.push(p.name + ": " + (p.fstype || "raw") + " label=" + JSON.stringify(p.label) + " partlabel=" + JSON.stringify(p.partlabel) + "  [ZETA-STAMPED]");
  }
  for (const p of foreignParts) {
    const used = p.fsUsedBytes === null ? "used=unknown" : gib(p.fsUsedBytes) + " used";
    evidence.push(p.name + ": " + (p.fstype || "raw") + " label=" + JSON.stringify(p.label) + " " + used + "  [NOT OURS]");
  }
  for (const e of facts.probeErrors) {
    evidence.push("probe error: " + e);
  }

  let espIsZeta = false;
  if (facts.esp !== null) {
    if (facts.esp.hasCredsBlob) espIsZeta = true;
    if (facts.esp.hasZetaEfiDir) espIsZeta = true;
  }
  let looksLikeZeta = espIsZeta;
  if (zetaParts.some((p) => p.label === ZETA_ROOT_LABEL)) looksLikeZeta = true;
  if (zetaParts.some((p) => p.label === ZETA_ESP_LABEL)) {
    if (zetaParts.length >= 2) looksLikeZeta = true;
  }

  if (looksLikeZeta) {
    return { device: facts.device, disposition: "prior-zeta-install", evidence };
  }
  if (foreignParts.length > 0) {
    return { device: facts.device, disposition: "foreign-data", evidence };
  }
  if (facts.probeErrors.length > 0) {
    return { device: facts.device, disposition: "indeterminate", evidence };
  }
  const noTable = facts.ptType === "";
  const noParts = facts.partitions.length === 0;
  const noLabels = facts.volumeLabels.length === 0;
  if (noTable) {
    if (noParts) {
      if (noLabels) {
        evidence.push("no partition table, no filesystem, no label");
        return { device: facts.device, disposition: "blank", evidence };
      }
    }
  }
  evidence.push("partition table " + JSON.stringify(facts.ptType || "none") + " with " + String(facts.partitions.length) + " partition(s), none accounted for");
  return { device: facts.device, disposition: "indeterminate", evidence };
}

/** Human readable pre-format findings. One block per disk, evidence indented. */
export function formatPreflightReport(classifications: readonly DiskClassification[]): readonly string[] {
  const lines: string[] = [];
  lines.push("Pre-format probe: what is on these disks RIGHT NOW");
  for (const c of classifications) {
    lines.push("  " + c.device + ": " + c.disposition);
    for (const e of c.evidence) {
      lines.push("      " + e);
    }
    if (c.evidence.length === 0) {
      lines.push("      (no evidence recorded)");
    }
  }
  return lines;
}

/**
 * Default full window. Aaron 2026-06-09: ask to CANCEL for a minute before
 * format. 60s is his number and it is kept. The engineering claim is about the
 * DEFAULT (proceed) and the SCOPE, not about the duration.
 */
export const DEFAULT_CANCEL_WINDOW_SECS = 60;

/**
 * Short window, used ONLY when every in-scope disk classifies blank: no
 * partition table, no filesystem, no label, and no probe step failed. There is
 * nothing on those disks to consent to losing, so the full minute buys nothing
 * and costs headless throughput. Foreign data, a prior Zeta install, or a probe
 * that FAILED all get the full window.
 */
export const BLANK_DISK_CANCEL_WINDOW_SECS = 10;

export type CancelDefault = "proceed" | "abort";

export type BreakerInput = {
  readonly state: "closed" | "open" | "blind";
  readonly reason: string;
};

export type WipeScopeDecision = {
  readonly mode: "fresh-install" | "repair";
  readonly wipe: readonly string[];
  readonly refused: readonly { readonly device: string; readonly reason: string }[];
  readonly cancelWindowSecs: number;
  readonly cancelDefault: CancelDefault;
  readonly rationale: readonly string[];
};

export type WipeScopeInput = {
  readonly classifications: readonly DiskClassification[];
  readonly breaker: BreakerInput;
  readonly fullWindowSecs?: number;
  readonly blankWindowSecs?: number;
};

export function decideWipeScope(input: WipeScopeInput): WipeScopeDecision {
  const full = input.fullWindowSecs ?? DEFAULT_CANCEL_WINDOW_SECS;
  const blank = input.blankWindowSecs ?? BLANK_DISK_CANCEL_WINDOW_SECS;

  const wipe: string[] = [];
  const refused: { device: string; reason: string }[] = [];
  const rationale: string[] = [];

  for (const c of input.classifications) {
    if (c.disposition === "installer-medium") {
      refused.push({
        device: c.device,
        reason: "carries the " + ZETA_INSTALLER_VOLUME_LABEL + " volume label: refusing to wipe the medium we booted from",
      });
      continue;
    }
    wipe.push(c.device);
  }

  const inScope = input.classifications.filter((c) => c.disposition !== "installer-medium");
  const anyPrior = inScope.some((c) => c.disposition === "prior-zeta-install");
  let allBlank = inScope.length > 0;
  for (const c of inScope) {
    if (c.disposition !== "blank") allBlank = false;
  }

  let secs = allBlank ? blank : full;
  if (allBlank) {
    rationale.push("every in-scope disk probed BLANK: short window " + String(blank) + "s");
  } else {
    rationale.push("an in-scope disk carries data or failed to probe: full window " + String(full) + "s");
  }

  let cancelDefault: CancelDefault = "proceed";
  if (input.breaker.state === "open") {
    cancelDefault = "abort";
    secs = full;
    rationale.push("circuit breaker OPEN (" + input.breaker.reason + "): default flips to ABORT, window forced to " + String(full) + "s");
  } else if (input.breaker.state === "blind") {
    secs = full;
    rationale.push("circuit breaker BLIND (" + input.breaker.reason + "): cannot count attempts, window forced to " + String(full) + "s");
  }

  return {
    mode: anyPrior ? "repair" : "fresh-install",
    wipe,
    refused,
    cancelWindowSecs: secs,
    cancelDefault,
    rationale,
  };
}

export type CredsCarryForward =
  | { readonly action: "none"; readonly reason: string }
  | { readonly action: "refuse-dead-blob"; readonly reason: string }
  | { readonly action: "blocked-on-open-decision"; readonly reason: string; readonly decision: string };

/**
 * Whether a zeta-creds.enc found on a prior install ESP may be carried across
 * the reformat.
 *
 * Exactly ONE branch is decided here, and it is decided on evidence rather than
 * preference: a blob bound to usbUuid is PROVABLY undecryptable after the
 * reformat, because the KDF binds the ephemeral FAT UUID. See
 * credential-binding-model.ts expectedBindingScenarioOutcome. Carrying it
 * forward yields a dead file that LOOKS like a recovered credential. Refuse.
 *
 * Every other branch is BLOCKED on design doc 2026-08-21 section 5.2: the
 * stable rebind decision (TPM seal vs USB iSerial) is Aaron and is unanswered
 * as of 2026-08-21. This function deliberately does not pick. The ordering
 * preserve, format, repersist is only correct after that decision lands.
 */
export function credsCarryForwardDecision(esp: EspFact | null): CredsCarryForward {
  if (esp === null) {
    return { action: "none", reason: "no ESP probed" };
  }
  if (!esp.hasCredsBlob) {
    return { action: "none", reason: "no zeta-creds.enc on the probed ESP" };
  }
  const factor = esp.recordedBindingFactor;
  if (factor === null) {
    return {
      action: "refuse-dead-blob",
      reason: "zeta-creds.enc present with no recorded binding factor: cannot show it survives a reformat",
    };
  }
  const outcome = expectedBindingScenarioOutcome(factor, "reformat_same_stick");
  if (!outcome.decrypts) {
    return {
      action: "refuse-dead-blob",
      reason: "binding factor " + factor + " does not survive reformat_same_stick (" + outcome.reason + ")",
    };
  }
  return {
    action: "blocked-on-open-decision",
    reason: "binding factor " + factor + " survives reformat_same_stick (" + outcome.reason + "), but the DEFAULT binding is undecided",
    decision: "design doc 2026-08-21 section 5.2: TPM seal (node-bound) vs USB iSerial (stick-bound). R8 rebind. Aaron call, unanswered.",
  };
}
