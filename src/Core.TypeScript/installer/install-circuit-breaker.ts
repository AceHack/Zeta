/**
 * install-circuit-breaker.ts -- R9. Bounded retries plus validate-before-wipe.
 *
 * R9, filed P0 on 2026-06-09 and open 74 days:
 *   reformat-with-broken-remembered => infinite destructive loop,
 *   needs a circuit-breaker + validate-before-wipe.
 *
 * Two separate refusals live here, and conflating them is how the loop stays
 * alive:
 *
 *  1. COUNT. A bounded retry counter, persisted on the boot USB ESP (the only
 *     non-volatile writable surface that is NOT about to be wiped). Past the
 *     bound the breaker OPENS.
 *  2. VALIDATE. Remembered identity recovered from a prior install is checked
 *     BEFORE it is trusted. Broken remembered state does not merely get
 *     ignored, it STOPS the wipe, because re-paving a recognised node whose
 *     identity we cannot read is exactly how HWR-2 happens: two registrations
 *     sharing one MAC.
 *
 * PURE: no I/O. The shell reads the ledger file and passes the text in.
 *
 * LOCAL TIME NOTE: the timestamps in this ledger are wall-clock and steer only
 * LOCAL action (does THIS node retry). They never enter a shared fold. See
 * .claude/rules/local-time-never-enters-the-shared-fold.md before reusing.
 *
 * NOTHING HERE IS PROVEN UNTIL A NODE BOOTS.
 */

export type AttemptOutcome = "started" | "ok" | "failed";

export type AttemptRecord = {
  readonly attempt: number;
  readonly startedAt: string;
  readonly outcome: AttemptOutcome;
  readonly stage: string;
};

export type LedgerValidation = {
  readonly trusted: boolean;
  readonly reasons: readonly string[];
  readonly records: readonly AttemptRecord[];
};

export const DEFAULT_MAX_DESTRUCTIVE_ATTEMPTS = 3;

const OUTCOMES = new Set(["started", "ok", "failed"]);

export type BreakerState = "closed" | "open" | "blind";

export type BreakerDecision = {
  readonly state: BreakerState;
  readonly consecutiveFailures: number;
  readonly maxAttempts: number;
  readonly reason: string;
};

export type BreakerInputs = {
  readonly validation: LedgerValidation;
  readonly maxAttempts?: number;
  /** False when the ledger surface could not be written; the breaker is BLIND. */
  readonly ledgerWritable: boolean;
};

/**
 * Decide the breaker state.
 *
 * OPEN is the refusal. It never means silently retry; the caller must present
 * the cancel window with the default flipped to ABORT (see
 * disk-preflight.decideWipeScope), so proceeding past an open breaker takes a
 * deliberate keypress.
 *
 * BLIND means we cannot count. A breaker that cannot count must not read as a
 * closed one, so BLIND forces the full cancel window even though it permits
 * the attempt.
 */
export function decideBreaker(inputs: BreakerInputs): BreakerDecision {
  const maxAttempts = inputs.maxAttempts ?? DEFAULT_MAX_DESTRUCTIVE_ATTEMPTS;
  if (!inputs.validation.trusted) {
    return {
      state: "open",
      consecutiveFailures: maxAttempts,
      maxAttempts,
      reason: "attempt ledger did not validate (" + inputs.validation.reasons.join("; ") + "): refusing to treat a corrupt counter as zero",
    };
  }
  let consecutiveFailures = 0;
  for (const r of inputs.validation.records) {
    if (r.outcome === "ok") {
      consecutiveFailures = 0;
      continue;
    }
    consecutiveFailures = consecutiveFailures + 1;
  }
  if (consecutiveFailures >= maxAttempts) {
    return {
      state: "open",
      consecutiveFailures,
      maxAttempts,
      reason: String(consecutiveFailures) + " consecutive destructive attempts without a completed install (bound " + String(maxAttempts) + ")",
    };
  }
  if (!inputs.ledgerWritable) {
    return {
      state: "blind",
      consecutiveFailures,
      maxAttempts,
      reason: "attempt ledger surface is not writable: this attempt cannot be counted",
    };
  }
  return {
    state: "closed",
    consecutiveFailures,
    maxAttempts,
    reason: String(consecutiveFailures) + " consecutive failure(s), bound " + String(maxAttempts),
  };
}

/**
 * Remembered identity recovered read-only from a prior install.
 *
 * Field names track what zeta-install.sh actually writes under /etc/zeta:
 *   cluster-node-id                 -> hostname
 *   cluster-segment-mac             -> segmentMac
 *   cluster-segment-address         -> nodeCidr
 *   cluster-control-plane-address   -> controlPlaneIp
 *   usb-uuid                        -> usbUuid
 *
 * MEASURED GAP: there is no ZetaId written at install time anywhere in the
 * tree. cluster-node-id is the closest existing stable key, so it is what
 * repair mode recovers. Naming that gap is part of the finding.
 *
 * initial-hashedpassword lives in the same directory and is deliberately NOT
 * modelled here. Repair mode must never read it.
 */
export type RememberedIdentity = {
  readonly hostname: string;
  readonly segmentMac: string;
  readonly nodeCidr: string;
  readonly controlPlaneIp: string;
  readonly usbUuid: string;
};

export type IdentityValidation = {
  readonly trusted: boolean;
  readonly identity: RememberedIdentity | null;
  readonly reasons: readonly string[];
};

const HOSTNAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const MAC_RE = /^[0-9a-f]{2}(:[0-9a-f]{2}){5}$/;
const CIDR_RE = /^[0-9]{1,3}(\.[0-9]{1,3}){3}\/[0-9]{1,2}$/;
const IPV4_RE = /^[0-9]{1,3}(\.[0-9]{1,3}){3}$/;

/**
 * Validate remembered identity BEFORE trusting it.
 *
 * The all-three-or-none discipline the installer already applies to the cluster
 * segment trio (zeta-install.sh: a node given an address but no MAC would
 * configure some arbitrary NIC) is enforced here too, because a half-recovered
 * identity is the state that produces a duplicate registration.
 */
export function validateRememberedIdentity(fields: Readonly<Record<string, string>>): IdentityValidation {
  const reasons: string[] = [];
  const hostname = (fields["cluster-node-id"] ?? "").trim();
  const segmentMac = (fields["cluster-segment-mac"] ?? "").trim().toLowerCase();
  const nodeCidr = (fields["cluster-segment-address"] ?? "").trim();
  const controlPlaneIp = (fields["cluster-control-plane-address"] ?? "").trim();
  const usbUuid = (fields["usb-uuid"] ?? "").trim();

  if (hostname === "") {
    reasons.push("cluster-node-id is absent: a recognised prior install with no recoverable hostname");
  } else if (!HOSTNAME_RE.test(hostname)) {
    reasons.push("cluster-node-id does not match the hostname shape");
  }

  const trio = [segmentMac, nodeCidr, controlPlaneIp];
  const present = trio.filter((v) => v !== "").length;
  if (present !== 0) {
    if (present !== 3) {
      reasons.push("cluster segment trio is partial: all three or none");
    }
    if (segmentMac !== "") {
      if (!MAC_RE.test(segmentMac)) reasons.push("cluster-segment-mac does not match the MAC shape");
    }
    if (nodeCidr !== "") {
      if (!CIDR_RE.test(nodeCidr)) reasons.push("cluster-segment-address does not match the CIDR shape");
    }
    if (controlPlaneIp !== "") {
      if (!IPV4_RE.test(controlPlaneIp)) reasons.push("cluster-control-plane-address does not match the IPv4 shape");
    }
  }

  if (reasons.length > 0) {
    return { trusted: false, identity: null, reasons };
  }
  return {
    trusted: true,
    identity: { hostname, segmentMac, nodeCidr, controlPlaneIp, usbUuid },
    reasons: ["remembered identity validated for " + hostname],
  };
}

export type RepairAction = "fresh-install" | "repair-reuse-identity" | "refuse-wipe";

export type RepairPlan = {
  readonly action: RepairAction;
  readonly identity: RememberedIdentity | null;
  readonly reason: string;
  /** Suppresses a second registration for a MAC that is already registered. */
  readonly reuseHostname: string | null;
  readonly reuseSegmentMac: string | null;
};

/**
 * The R4 decision, with the R9 refusal attached.
 *
 * Aaron 2026-05-25: the USB basically says, hey, am I already running on this?
 * I am? Let me make sure I recover any hardware IDs and stuff and just reinstall
 * the image.
 *
 * Three outcomes, and the third is the one that was missing:
 *
 *  fresh-install          no prior Zeta install recognised.
 *  repair-reuse-identity  recognised AND the remembered identity validated, so
 *                         the re-paved node rejoins as itself.
 *  refuse-wipe            recognised and the remembered identity did NOT
 *                         validate. Wiping now would mint a SECOND registration
 *                         for a MAC that is already registered, which is HWR-2
 *                         (two registrations, one MAC) held open in
 *                         src/Core.TypeScript/inventory/reconcile-surfaces.ts.
 *                         So the wipe stops instead.
 */
export function planRepair(input: {
  readonly priorInstallRecognised: boolean;
  readonly identityValidation: IdentityValidation;
}): RepairPlan {
  if (!input.priorInstallRecognised) {
    return {
      action: "fresh-install",
      identity: null,
      reason: "no prior Zeta install recognised on any in-scope disk",
      reuseHostname: null,
      reuseSegmentMac: null,
    };
  }
  const v = input.identityValidation;
  if (!v.trusted) {
    return {
      action: "refuse-wipe",
      identity: null,
      reason: "prior Zeta install recognised but its remembered identity did not validate (" + v.reasons.join("; ") + "): re-paving now would register a duplicate for a MAC already in the roster (HWR-2)",
      reuseHostname: null,
      reuseSegmentMac: null,
    };
  }
  const id = v.identity;
  if (id === null) {
    return {
      action: "refuse-wipe",
      identity: null,
      reason: "identity validation reported trusted with no identity: refusing rather than guessing",
      reuseHostname: null,
      reuseSegmentMac: null,
    };
  }
  return {
    action: "repair-reuse-identity",
    identity: id,
    reason: "prior Zeta install recognised and identity validated: rejoining as " + id.hostname,
    reuseHostname: id.hostname,
    reuseSegmentMac: id.segmentMac === "" ? null : id.segmentMac,
  };
}

/**
 * The attempt ledger is LINE ORIENTED TEXT, not JSON, so that the bash gate on
 * the installer ISO and this parser can be the same parser rather than two that
 * drift. One record per line:
 *
 *   attempt|startedAt|outcome|stage
 *
 * Blank lines are skipped. UNTRUSTED on any defect: wrong field count, a
 * non-numeric attempt, attempts not contiguous from 1, or an outcome outside
 * started/ok/failed.
 *
 * An untrusted ledger is NOT an empty one, and treating it as empty is exactly
 * the bug R9 names: a corrupt counter reads as zero and retries forever.
 */
export function validateAttemptLedger(raw: string): LedgerValidation {
  const reasons: string[] = [];
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l !== "");
  if (lines.length === 0) {
    return { trusted: true, reasons: ["ledger absent or empty: first destructive attempt"], records: [] };
  }
  const records: AttemptRecord[] = [];
  let expected = 1;
  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length !== 4) {
      reasons.push("ledger line does not have 4 pipe separated fields");
      break;
    }
    const attemptRaw = parts[0] ?? "";
    const startedAt = parts[1] ?? "";
    const outcome = parts[2] ?? "";
    const stage = parts[3] ?? "";
    if (!/^[0-9]+$/.test(attemptRaw)) {
      reasons.push("ledger attempt field is not a non-negative integer");
      break;
    }
    const attempt = Number(attemptRaw);
    if (attempt !== expected) {
      reasons.push("ledger attempt numbers are not contiguous from 1");
      break;
    }
    if (startedAt === "") {
      reasons.push("ledger startedAt field is empty");
      break;
    }
    if (!OUTCOMES.has(outcome)) {
      reasons.push("ledger outcome field is not one of started, ok, failed");
      break;
    }
    records.push({ attempt, startedAt, outcome: outcome as AttemptOutcome, stage });
    expected = expected + 1;
  }
  if (reasons.length > 0) {
    return { trusted: false, reasons, records: [] };
  }
  return { trusted: true, reasons: ["ledger parsed: " + String(records.length) + " attempt(s)"], records };
}
