/**
 * Per-federation threat-model stub (USB-IDENTITY-THREAT-MODEL §3 / §8.1).
 *
 * Same question set as the traveler / cluster / federation table in §3.
 * A filled stub is the charter-time artifact; this module only validates
 * shape + Universal Exit Principle. No I/O. No live federation claims.
 */

export type FederationScaleAnswers = {
  readonly whoAmI: string;
  readonly whoCanJoin: string;
  readonly whoCanLeave: string;
  readonly whatIsSecret: string;
  readonly whatIsEnforceable: string;
};

export type FederationThreatModelStub = {
  readonly federationId: string;
  readonly displayName: string;
  readonly charterRef: string;
  readonly scaleAnswers: FederationScaleAnswers;
  readonly exitPaths: readonly string[];
  readonly custodyPolicy: string;
  readonly installerImplication: string;
};

export type FederationThreatModelCheck = {
  readonly ok: boolean;
  readonly errors: readonly string[];
};

const ID_RE = /^[a-z][a-z0-9-]{1,62}$/;

function missing(label: string, value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) {
    return `missing ${label}`;
  }
  return null;
}

/**
 * Fail closed: empty exit list or empty whoCanLeave is a fake federation
 * (USB-IDENTITY-THREAT-MODEL §5 spoofing — contracts without exits).
 */
export function validateFederationThreatModelStub(
  stub: FederationThreatModelStub,
): FederationThreatModelCheck {
  const errors: string[] = [];
  const idErr = missing("federationId", stub.federationId);
  if (idErr) {
    errors.push(idErr);
  } else if (!ID_RE.test(stub.federationId)) {
    errors.push("federationId must be a lowercase kebab slug");
  }
  for (const [label, value] of [
    ["displayName", stub.displayName],
    ["charterRef", stub.charterRef],
    ["scaleAnswers.whoAmI", stub.scaleAnswers.whoAmI],
    ["scaleAnswers.whoCanJoin", stub.scaleAnswers.whoCanJoin],
    ["scaleAnswers.whoCanLeave", stub.scaleAnswers.whoCanLeave],
    ["scaleAnswers.whatIsSecret", stub.scaleAnswers.whatIsSecret],
    ["scaleAnswers.whatIsEnforceable", stub.scaleAnswers.whatIsEnforceable],
    ["custodyPolicy", stub.custodyPolicy],
    ["installerImplication", stub.installerImplication],
  ] as const) {
    const err = missing(label, value);
    if (err) {
      errors.push(err);
    }
  }
  if (stub.exitPaths.length === 0) {
    errors.push("exitPaths must contain at least one path (Universal Exit Principle)");
  } else {
    for (const [i, path] of stub.exitPaths.entries()) {
      if (path.trim().length === 0) {
        errors.push(`exitPaths[${String(i)}] is empty`);
      }
    }
  }
  const leave = stub.scaleAnswers.whoCanLeave.trim().toLowerCase();
  if (leave === "never" || leave === "none" || leave === "no") {
    errors.push("scaleAnswers.whoCanLeave cannot forbid exit");
  }
  return { ok: errors.length === 0, errors };
}

/** Blank stub for a newly chartered federation — fill every field before merge. */
export function emptyFederationThreatModelStub(
  federationId: string,
  displayName: string,
): FederationThreatModelStub {
  return {
    federationId,
    displayName,
    charterRef: "",
    scaleAnswers: {
      whoAmI: "",
      whoCanJoin: "",
      whoCanLeave: "",
      whatIsSecret: "",
      whatIsEnforceable: "",
    },
    exitPaths: [],
    custodyPolicy: "",
    installerImplication: "",
  };
}

/**
 * Example fill of the stub using UI-canon Lodge naming. Not a live charter
 * and not installer-wired — proves the template is fillable.
 */
export const EXAMPLE_APERTURE_LODGE_STUB: FederationThreatModelStub = {
  federationId: "aperture-lodge",
  displayName: "The Aperture Lodge",
  charterRef: "docs/design/root-site-iris/HANDOFF.md",
  scaleAnswers: {
    whoAmI: "Contractual membership + degrees under the Lodge charter",
    whoCanJoin: "Constitution + merit; no weight gates",
    whoCanLeave: "Exit must exist and may cost; Universal Exit Principle",
    whatIsSecret: "Treasury, custody, sealed vaults — not cluster gossip",
    whatIsEnforceable: "Contracts only; cluster relationships stay unenforceable",
  },
  exitPaths: [
    "Member resignation recorded on the contract log",
    "Degree withdrawal without indefinite captivity",
  ],
  custodyPolicy: "Federation-policy mix; treasury HW custody is metal-gated",
  installerImplication:
    "USB bringup stays cluster-shaped until this charter is installer-wired; do not treat a GitHub PR as Lodge membership",
};
