/**
 * self-vendored-provisioning.ts — the ceremony model for a device WE provision, and its refusals.
 *
 * Work-item 081M00VJGAV087G0R00393F6X5 ("self-fabricated TKey: become our own vendor").
 *
 * ## What is implemented here, stated before anything else
 *
 * **Nothing in this file provisions, attests, seals, signs, burns, or verifies anything.** There is
 * no cryptography, no USB, no NVCM write, no network call, and no key of any kind. No TKey, no TP-1
 * programmer, and no fabricated board was available to the author; **every physical step below is
 * UNEXERCISED** and is marked as such in `PROVISIONING_IMPLEMENTATION_STATUS`, which a test forces
 * to enumerate the whole ceremony so a new step cannot be added without an honesty entry.
 *
 * What IS implemented is the part that needs no hardware and no undecided policy: **the order of the
 * ceremony, and the conditions under which it must refuse to proceed.** The refusals are the entire
 * value of the module — an ordering that accepts everything constrains nothing, and a provisioning
 * check that cannot fail asserts an identity nobody verified.
 *
 * ## Why the model can land before the hardware
 *
 * From the repo's own survey
 * (`docs/research/2026-08-14-open-source-hsm-and-fido-devices-we-can-fabricate-and-modify-plus-research-fpga-class.md`
 * §1, checked 2026-08-14), the load-bearing finding is that **integrity and authenticity separate**:
 *
 *     CDI = BLAKE2s(UDS ‖ USS ‖ BLAKE2s(app))
 *
 * The identity on the device is a *function of the code running on it* — arithmetic, no CA, no
 * network. Fabricating the board ourselves leaves that property untouched. What self-fabrication
 * costs is the answer to *"is this a genuine X and not a clone?"*, which structurally needs someone
 * other than you. Tillitis' own tool says the vendor is a **parameter**: a TKey provisioned by "your
 * IT department" is verified by *their* `tkey-verification`, not Tillitis'. So becoming our own
 * vendor does not delete the root — it **relocates it to us**.
 *
 * And Tillitis states its own tool's ceiling, quoted rather than softened:
 *
 * > "The verification of this identity does not prove that the TKey hasn't been tampered with, only
 * > that the identity of an app running on it is the same."
 *
 * ## What this module deliberately does NOT decide
 *
 * Three questions are **maintainer decisions** and are modelled as undecided values that FAIL
 * CLOSED, in the shape of `Wall.Whitebox` in `src/Core/DerivationProtocol.fs` — unknown is not
 * permissive:
 *
 * 1. **Who holds the vendor root** (`VendorRootCustody`, default `"undecided"`).
 * 2. **Whether the root is single or plural** — see `deferenceReading`, which reports the shape as a
 *    neutral fact and attaches no verdict.
 * 3. **By what mechanism a human approves a sensitive step.** This module requires a *named
 *    approver* for irreversible and authority-exercising steps, because those are already a gated
 *    class here; it does **not** name the mechanism. Biometric, passphrase, and in-person are all
 *    consistent with this code. Requiring attribution is inherited standing discipline; choosing the
 *    mechanism would be extending it.
 *
 * ## The topology question, asked out loud
 *
 * Per `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md`, the discriminator between an
 * **oracle** (a concentration you may route around — chosen) and a **hub** (one you must route
 * through — enforced) is **exit**, not degree. A self-vendored root is on the wrong side of that
 * line for one of the two questions, and `deferenceReading` reports exactly which:
 *
 * - **Integrity** — no authority is involved at all; a stranger recomputes the CDI relation
 *   themselves. Exit is total.
 * - **Authenticity** — with exactly one root, a verifier *must* defer to it. That is a **single
 *   mandatory trust authority**, and no amount of it being *our* root changes the shape. It is named
 *   here rather than argued away.
 *
 * ## Anchors (Beacon)
 *
 * - Tillitis TKey measured boot / `tkey-verification` vendor-as-parameter — via the repo survey above.
 * - Hirschman, *Exit, Voice, and Loyalty* (1970) — exit is what disciplines a concentration.
 * - Goguen & Meseguer (1982) noninterference — secrets cross only declared channels; here, the
 *   record type has no channel that can carry a UDS at all.
 */

import {
  declareSelfVendoredTrustRoot,
  type VendorTrustRoot,
  type VendorTrustRootResult,
} from "./vendor-trust-root";

// ─────────────────────────────────────────────────────────────────────────────
// The ceremony
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The ordered steps of provisioning a device we fabricate or flash ourselves. Order is the model;
 * skipping is refused.
 */
export const PROVISIONING_STEPS = [
  /** An unlocked device (or a board we had made) is physically in hand. */
  "device-obtained",
  /** A Unique Device Secret is generated air-gapped. It never enters this substrate. */
  "uds-generated",
  /** The UDS is burned into FPGA NVCM. ONE-TIME PROGRAMMABLE — irreversible. */
  "uds-injected",
  /** The device's public identity, derived on-device from the CDI, is read out. */
  "device-identity-read",
  /** Our vendor root signs that identity. Exercises the root; needs custody decided. */
  "vendor-signed",
  /** The signature is appended to a transparency log. Append-only — irreversible. */
  "published",
] as const;

export type ProvisioningStep = (typeof PROVISIONING_STEPS)[number];

/**
 * Steps that are irreversible in the physical world or that exercise the vendor root. These require
 * a named human approver. The MECHANISM of approval is not decided here (see the header).
 */
const SENSITIVE_STEPS: ReadonlySet<ProvisioningStep> = new Set<ProvisioningStep>([
  "uds-injected",
  "vendor-signed",
  "published",
]);

/** Steps that cannot proceed while it is undecided who holds the vendor root. */
const CUSTODY_GATED_STEPS: ReadonlySet<ProvisioningStep> = new Set<ProvisioningStep>([
  "vendor-signed",
  "published",
]);

/**
 * Who holds the vendor signing root. **`"undecided"` is the default and it fails closed** — this is
 * a maintainer decision, and inventing an answer would be exactly the failure the sibling
 * secure-boot work refused ("a gate that refuses to invent key custody").
 *
 * The non-`undecided` members are the options as they have been *described* in the repo, listed so
 * the decision has a vocabulary. Listing an option is not selecting it.
 */
export type VendorRootCustody =
  | "undecided"
  | "single-operator-held"
  | "threshold-shares"
  | "hardware-token-held";

/**
 * Per-step honesty ledger. Every entry is `implemented: false` today; a test forces this record to
 * cover exactly `PROVISIONING_STEPS`, so a step added later cannot skip its entry.
 */
export const PROVISIONING_IMPLEMENTATION_STATUS: Readonly<
  Record<ProvisioningStep, { readonly implemented: false; readonly why: string }>
> = Object.freeze({
  "device-obtained": {
    implemented: false,
    why: "no TKey, no TP-1 programmer, and no fabricated board exist here; nothing was obtained",
  },
  "uds-generated": {
    implemented: false,
    why: "no entropy source is invoked and no air-gapped host exists; this module never sees a UDS",
  },
  "uds-injected": {
    implemented: false,
    why: "no NVCM write is performed; pynvcm is not invoked and no device is attached",
  },
  "device-identity-read": {
    implemented: false,
    why: "no USB transport, no CDI is computed, and no public identity is read from anything",
  },
  "vendor-signed": {
    implemented: false,
    why: "no signing key exists, no signature is produced, and custody is undecided by design",
  },
  published: {
    implemented: false,
    why: "no transparency-log client is wired; nothing is submitted to Sigsum or any other log",
  },
});

/**
 * A ceremony in progress. Immutable; `advance` returns a new state.
 *
 * Note what this record CANNOT hold: there is no field for a UDS, a CDI, or any private key. That is
 * the noninterference guard done structurally rather than by discipline — the secret has no declared
 * channel into this substrate, so it cannot travel one.
 */
export interface CeremonyState {
  readonly deviceId: string;
  readonly completed: readonly ProvisioningStep[];
  /**
   * An opaque caller-supplied commitment to the burned UDS — a digest the caller computed
   * ELSEWHERE. **Nothing here verifies that it is a digest of anything**, and it is never the UDS.
   * Its only job is to make a second, *different* burn of the same device detectable.
   */
  readonly udsCommitment: string | null;
  readonly custody: VendorRootCustody;
}

export type ProvisioningRefusal =
  | { readonly refused: "blank-device-id" }
  | { readonly refused: "step-out-of-order"; readonly expected: ProvisioningStep; readonly got: ProvisioningStep }
  | { readonly refused: "no-named-approver"; readonly step: ProvisioningStep }
  | { readonly refused: "vendor-root-custody-undecided"; readonly step: ProvisioningStep }
  | { readonly refused: "uds-commitment-missing" }
  | { readonly refused: "nvcm-already-burned"; readonly deviceId: string }
  | { readonly refused: "field-name-looks-like-key-material"; readonly field: string };

export type ProvisioningResult =
  | { readonly ok: true; readonly state: CeremonyState }
  | { readonly ok: false; readonly why: ProvisioningRefusal };

function isBlank(s: string): boolean {
  return s.trim().length === 0;
}

/** Open a ceremony. Custody is carried from the start so the gate is visible before any burn. */
export function beginCeremony(deviceId: string, custody: VendorRootCustody): ProvisioningResult {
  if (isBlank(deviceId)) return { ok: false, why: { refused: "blank-device-id" } };
  return {
    ok: true,
    state: Object.freeze({ deviceId, completed: [], udsCommitment: null, custody }),
  };
}

/** The step that must come next, or `null` when the ceremony is complete. */
export function nextStep(state: CeremonyState): ProvisioningStep | null {
  return PROVISIONING_STEPS[state.completed.length] ?? null;
}

export interface AdvanceRequest {
  readonly step: ProvisioningStep;
  /**
   * The human accountable for this step. `null` is refused for sensitive steps. This module does not
   * say how the human was authenticated — only that an irreversible act must be attributable.
   */
  readonly approver: string | null;
  /** Required for `uds-injected`. Opaque; see `CeremonyState.udsCommitment`. */
  readonly udsCommitment?: string;
}

/**
 * Advance the ceremony, or refuse with a reason.
 *
 * **Idempotency (discipline #6), stated precisely because the physical world is not idempotent.**
 * Re-applying a step already completed is a no-op and returns the same state — the *record* is
 * idempotent. But NVCM is one-time programmable, so re-applying `uds-injected` with a *different*
 * commitment is refused as `nvcm-already-burned`: the record cannot represent a second burn of the
 * same device, because the device cannot perform one.
 */
export function advance(state: CeremonyState, request: AdvanceRequest): ProvisioningResult {
  const { step, approver } = request;

  if (state.completed.includes(step)) {
    if (step === "uds-injected") {
      const again = request.udsCommitment;
      if (again !== undefined && again !== state.udsCommitment) {
        return { ok: false, why: { refused: "nvcm-already-burned", deviceId: state.deviceId } };
      }
    }
    return { ok: true, state };
  }

  const expected = nextStep(state);
  if (expected === null || expected !== step) {
    return {
      ok: false,
      why: { refused: "step-out-of-order", expected: expected ?? PROVISIONING_STEPS[0], got: step },
    };
  }

  if (SENSITIVE_STEPS.has(step) && (approver === null || isBlank(approver))) {
    return { ok: false, why: { refused: "no-named-approver", step } };
  }

  if (CUSTODY_GATED_STEPS.has(step) && state.custody === "undecided") {
    return { ok: false, why: { refused: "vendor-root-custody-undecided", step } };
  }

  let udsCommitment = state.udsCommitment;
  if (step === "uds-injected") {
    const commitment = request.udsCommitment;
    if (commitment === undefined || isBlank(commitment)) {
      return { ok: false, why: { refused: "uds-commitment-missing" } };
    }
    udsCommitment = commitment;
  }

  return {
    ok: true,
    state: Object.freeze({
      deviceId: state.deviceId,
      completed: Object.freeze([...state.completed, step]),
      udsCommitment,
      custody: state.custody,
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The secret-shaped-field guard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Field-name fragments that must never appear on a provisioning record crossing into this
 * substrate. Matched as substrings of the lowercased, non-alphanumeric-stripped field name, so
 * `udsHex`, `UDS_HEX` and `uds` are all caught.
 */
const KEY_MATERIAL_NAME_FRAGMENTS: readonly string[] = [
  "uds",
  "uss",
  "cdi",
  "secret",
  "privatekey",
  "mnemonic",
  "passphrase",
  "seed",
];

function normaliseFieldName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Refuse a provisioning record that carries a field NAMED like key material.
 *
 * **Its honest ceiling, stated because #11477 set the standard of logging the gap rather than
 * shipping it quietly:** this is a name-shaped heuristic over one record at one boundary. It does
 * NOT prove a UDS was never printed, never logged, never written to a file, and never left the
 * air-gapped host. A provisioning script can still leak by every route this never sees. What it
 * does buy is that the one path *into this substrate* refuses the obvious carrier, and that the
 * refusal is a test rather than a comment.
 *
 * The residual gap — no end-to-end proof that key material stayed off disk — is unclosed and is
 * named as unclosed.
 */
export function refuseSecretShapedFields(record: object): ProvisioningRefusal | null {
  for (const field of Object.keys(record)) {
    const normalised = normaliseFieldName(field);
    for (const fragment of KEY_MATERIAL_NAME_FRAGMENTS) {
      if (normalised.includes(fragment)) {
        return { refused: "field-name-looks-like-key-material", field };
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// What a third party can conclude — and the topology reading
// ─────────────────────────────────────────────────────────────────────────────

export type AssuranceQuestion = "integrity" | "authenticity";

export type DeferenceShape =
  /** No authority is involved; the verifier recomputes it themselves. Exit is total. */
  | "self-rooted-no-authority"
  /** Two or more independently held roots vouch; a verifier may choose among them. */
  | "plural-authority-routable"
  /** Exactly one root can answer. A verifier MUST defer to it. */
  | "single-mandatory-authority"
  /** No root can answer at all; the question is simply unanswerable. */
  | "unverifiable-no-root";

export interface DeferenceReading {
  readonly question: AssuranceQuestion;
  readonly independentRootCount: number;
  readonly exitAvailable: boolean;
  readonly shape: DeferenceShape;
  readonly note: string;
}

/**
 * Report — as a neutral fact, with no verdict attached — the deference shape of a provisioning
 * design. Whether a `single-mandatory-authority` is acceptable for our own devices is a maintainer
 * decision; this function refuses to make it, in the shape of
 * `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` (the mechanism names the fact, the
 * caller's oracle attaches the meaning).
 *
 * `roots` is the set of INDEPENDENTLY HELD roots that could vouch for authenticity. Two names held
 * by the same party are one root for this purpose, and nothing here can check that — the caller
 * asserts independence.
 */
export function deferenceReading(
  question: AssuranceQuestion,
  roots: readonly VendorTrustRoot[],
): DeferenceReading {
  if (question === "integrity") {
    return {
      question,
      independentRootCount: 0,
      exitAvailable: true,
      shape: "self-rooted-no-authority",
      note:
        "integrity needs no authority: the device identity is a function of the code running on it " +
        "(CDI = BLAKE2s(UDS || USS || BLAKE2s(app))), so a verifier recomputes it without deferring " +
        "to anyone. Self-fabrication does not weaken this.",
    };
  }
  const count = roots.length;
  if (count === 0) {
    return {
      question,
      independentRootCount: 0,
      exitAvailable: false,
      shape: "unverifiable-no-root",
      note: "no root can vouch, so authenticity is not merely unproven — it is unanswerable.",
    };
  }
  if (count === 1) {
    return {
      question,
      independentRootCount: 1,
      exitAvailable: false,
      shape: "single-mandatory-authority",
      note:
        "exactly one root can answer, so a verifier must route through it. Under the exit test " +
        "(Hirschman 1970) that is a hub, not an oracle — and it stays a hub when the root is ours. " +
        "Whether to accept that, or to require plural independently-held roots, is a maintainer " +
        "decision this function does not make.",
    };
  }
  return {
    question,
    independentRootCount: count,
    exitAvailable: true,
    shape: "plural-authority-routable",
    note:
      "more than one independently held root can answer, so deference is chosen rather than " +
      "enforced — the k-redundant shape manifesto §11 asks for, measurable in the graph.",
  };
}

/**
 * The strongest sentence an attestation against a self-vendored root supports — and, in the same
 * breath, what it does not support. Never says "genuine".
 */
export function describeSelfVendoredAssurance(trustRoot: VendorTrustRoot): string {
  return (
    `'${trustRoot.vendorName}' asserts that a device it provisioned is running a given application, ` +
    `signed under a root '${trustRoot.vendorName}' holds itself. ` +
    `A party that does not already trust '${trustRoot.vendorName}' can conclude NOTHING about ` +
    `authenticity from this — no third party vouches, and there is no other root to ask. ` +
    `Integrity is separate and stronger: any party can check that the device identity is a function ` +
    `of the code running on it, with no authority in the loop. ` +
    `Neither establishes that the device was not tampered with — only that the identity of an app ` +
    `running on it is the same.`
  );
}

/**
 * Declare the root we would provision under. Thin wrapper over `declareSelfVendoredTrustRoot` that
 * exists so callers in this ceremony reach for the self-vendored constructor rather than the
 * generic one — the two mean opposite things about who vouches.
 *
 * Creates no key and signs nothing; it names a root, which is a precondition for chaining and is
 * not chaining.
 */
export function declareOurVendorRoot(input: {
  readonly vendorName: string;
  readonly chainToRoot: readonly string[];
  readonly verificationService: string;
}): VendorTrustRootResult {
  return declareSelfVendoredTrustRoot(input);
}
