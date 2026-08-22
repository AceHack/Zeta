/**
 * self-vendored-provisioning.test.ts — the falsifiers for the become-our-own-vendor ceremony model.
 *
 * The load-bearing tests are the REFUSALS. Nothing here asserts that a device was provisioned,
 * attested, sealed or signed, because nothing in the module under test does any of those things.
 * What is under test is whether the model *declines* the cases it must decline.
 */
import { describe, test, expect } from "bun:test";
import {
  PROVISIONING_STEPS,
  PROVISIONING_IMPLEMENTATION_STATUS,
  advance,
  beginCeremony,
  declareOurVendorRoot,
  deferenceReading,
  describeSelfVendoredAssurance,
  nextStep,
  refuseSecretShapedFields,
  type CeremonyState,
  type ProvisioningStep,
  type VendorRootCustody,
} from "./self-vendored-provisioning";
import { VENDOR_TRUST_ROOTS, describeVendorTrustRoot } from "./vendor-trust-root";

function open(custody: VendorRootCustody = "single-operator-held"): CeremonyState {
  const begun = beginCeremony("device-0001", custody);
  if (!begun.ok) throw new Error("fixture failed to open a ceremony");
  return begun.state;
}

/** Drive the ceremony forward through `upTo`, asserting each step is accepted. */
function runTo(state: CeremonyState, upTo: ProvisioningStep): CeremonyState {
  let current = state;
  for (const step of PROVISIONING_STEPS) {
    const result = advance(current, {
      step,
      approver: "maintainer",
      ...(step === "uds-injected" ? { udsCommitment: "commitment-a" } : {}),
    });
    if (!result.ok) throw new Error(`fixture refused at ${step}: ${result.why.refused}`);
    current = result.state;
    if (step === upTo) break;
  }
  return current;
}

describe("the honesty ledger", () => {
  test("every step is marked unexercised — no hardware was available to exercise any of them", () => {
    for (const step of PROVISIONING_STEPS) {
      const entry = PROVISIONING_IMPLEMENTATION_STATUS[step];
      expect(entry.implemented).toBe(false);
      expect(entry.why.trim().length).toBeGreaterThan(0);
    }
  });

  test("the ledger covers exactly the ceremony — a new step cannot skip its honesty entry", () => {
    expect(Object.keys(PROVISIONING_IMPLEMENTATION_STATUS).sort()).toEqual(
      [...PROVISIONING_STEPS].sort(),
    );
  });
});

describe("ordering refusals", () => {
  test("a blank device id is refused — an unnamed device is not a device", () => {
    const result = beginCeremony("   ", "single-operator-held");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why.refused).toBe("blank-device-id");
  });

  test("skipping straight to signing is refused", () => {
    const result = advance(open(), { step: "vendor-signed", approver: "maintainer" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.why.refused).toBe("step-out-of-order");
      if (result.why.refused === "step-out-of-order") {
        expect(result.why.expected).toBe("device-obtained");
        expect(result.why.got).toBe("vendor-signed");
      }
    }
  });

  test("burning a UDS before one is generated is refused", () => {
    const obtained = advance(open(), { step: "device-obtained", approver: null });
    expect(obtained.ok).toBe(true);
    if (!obtained.ok) return;
    const result = advance(obtained.state, {
      step: "uds-injected",
      approver: "maintainer",
      udsCommitment: "commitment-a",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why.refused).toBe("step-out-of-order");
  });

  test("nextStep walks the ceremony and ends at null", () => {
    expect(nextStep(open())).toBe("device-obtained");
    const finished = runTo(open(), "published");
    expect(nextStep(finished)).toBeNull();
  });
});

describe("the approver refusal — an irreversible act must be attributable", () => {
  test("burning NVCM with no named approver is refused", () => {
    const ready = runTo(open(), "uds-generated");
    const result = advance(ready, { step: "uds-injected", approver: null, udsCommitment: "c" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.why.refused).toBe("no-named-approver");
      if (result.why.refused === "no-named-approver") expect(result.why.step).toBe("uds-injected");
    }
  });

  test("a whitespace approver is not a named approver", () => {
    const ready = runTo(open(), "uds-generated");
    const result = advance(ready, { step: "uds-injected", approver: "  ", udsCommitment: "c" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why.refused).toBe("no-named-approver");
  });

  test("a non-sensitive step does NOT require an approver — the gate is scoped, not blanket", () => {
    const result = advance(open(), { step: "device-obtained", approver: null });
    expect(result.ok).toBe(true);
  });
});

describe("the custody refusal — the model declines to invent who holds the root", () => {
  test("signing under undecided custody is refused", () => {
    const ready = runTo(open("undecided"), "device-identity-read");
    const result = advance(ready, { step: "vendor-signed", approver: "maintainer" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.why.refused).toBe("vendor-root-custody-undecided");
      if (result.why.refused === "vendor-root-custody-undecided") {
        expect(result.why.step).toBe("vendor-signed");
      }
    }
  });

  test("undecided custody does NOT block the pre-root steps — it fails closed only where it bites", () => {
    const state = runTo(open("undecided"), "device-identity-read");
    expect(state.completed).toContain("uds-injected");
  });

  test("a decided custody lets signing proceed — the gate is custody, not a permanent block", () => {
    const ready = runTo(open("threshold-shares"), "device-identity-read");
    const result = advance(ready, { step: "vendor-signed", approver: "maintainer" });
    expect(result.ok).toBe(true);
  });
});

describe("the one-time-programmable refusal", () => {
  test("a UDS burn with no commitment is refused", () => {
    const ready = runTo(open(), "uds-generated");
    const result = advance(ready, { step: "uds-injected", approver: "maintainer" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why.refused).toBe("uds-commitment-missing");
  });

  test("a blank commitment is not a commitment", () => {
    const ready = runTo(open(), "uds-generated");
    const result = advance(ready, { step: "uds-injected", approver: "maintainer", udsCommitment: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.why.refused).toBe("uds-commitment-missing");
  });

  test("re-burning the SAME commitment is idempotent — the record is a no-op", () => {
    const burned = runTo(open(), "uds-injected");
    const again = advance(burned, {
      step: "uds-injected",
      approver: "maintainer",
      udsCommitment: "commitment-a",
    });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.state).toEqual(burned);
  });

  test("re-burning a DIFFERENT commitment is refused — NVCM cannot be programmed twice", () => {
    const burned = runTo(open(), "uds-injected");
    const result = advance(burned, {
      step: "uds-injected",
      approver: "maintainer",
      udsCommitment: "commitment-b",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.why.refused).toBe("nvcm-already-burned");
      if (result.why.refused === "nvcm-already-burned") expect(result.why.deviceId).toBe("device-0001");
    }
  });
});

describe("the secret-shaped-field guard", () => {
  test("an ordinary provisioning record passes", () => {
    expect(
      refuseSecretShapedFields({ deviceId: "d1", devicePublicKey: "abc", appDigest: "def" }),
    ).toBeNull();
  });

  test.each([
    ["uds", { deviceId: "d1", uds: "00ff" }],
    ["udsHex", { deviceId: "d1", udsHex: "00ff" }],
    ["UDS_HEX", { deviceId: "d1", UDS_HEX: "00ff" }],
    ["ussSecret", { deviceId: "d1", ussSecret: "hunter2" }],
    ["cdi", { deviceId: "d1", cdi: "00ff" }],
    ["privateKey", { deviceId: "d1", privateKey: "00ff" }],
    ["seedBytes", { deviceId: "d1", seedBytes: "00ff" }],
    ["passphrase", { deviceId: "d1", passphrase: "x" }],
    ["mnemonic", { deviceId: "d1", mnemonic: "x" }],
  ])("a record carrying %s is refused", (field, record) => {
    const refusal = refuseSecretShapedFields(record);
    expect(refusal).not.toBeNull();
    expect(refusal?.refused).toBe("field-name-looks-like-key-material");
    if (refusal?.refused === "field-name-looks-like-key-material") {
      expect(refusal.field).toBe(field);
    }
  });

  test("the guard does NOT flag a public identity field — it would be useless if it flagged everything", () => {
    expect(refuseSecretShapedFields({ deviceIdentityPubKey: "abc", publicKey: "def" })).toBeNull();
  });
});

describe("the deference reading — a neutral fact, with the verdict left to the maintainer", () => {
  test("integrity needs no authority at all, so exit is total", () => {
    const reading = deferenceReading("integrity", []);
    expect(reading.shape).toBe("self-rooted-no-authority");
    expect(reading.exitAvailable).toBe(true);
    expect(reading.independentRootCount).toBe(0);
  });

  test("ONE root for authenticity is a single mandatory authority, and ours is no exception", () => {
    const declared = declareOurVendorRoot({
      vendorName: "Zeta (self-vendored)",
      chainToRoot: ["device identity", "our vendor root"],
      verificationService: "our own tkey-verification instance",
    });
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    const reading = deferenceReading("authenticity", [declared.root]);
    expect(reading.shape).toBe("single-mandatory-authority");
    expect(reading.exitAvailable).toBe(false);
  });

  test("two independently held roots restore exit", () => {
    const reading = deferenceReading("authenticity", [
      VENDOR_TRUST_ROOTS["amd-ark"],
      VENDOR_TRUST_ROOTS["intel-sgx-root-ca"],
    ]);
    expect(reading.shape).toBe("plural-authority-routable");
    expect(reading.exitAvailable).toBe(true);
    expect(reading.independentRootCount).toBe(2);
  });

  test("no root at all makes authenticity unanswerable, not merely unproven", () => {
    const reading = deferenceReading("authenticity", []);
    expect(reading.shape).toBe("unverifiable-no-root");
    expect(reading.exitAvailable).toBe(false);
  });
});

describe("what a self-vendored attestation is allowed to say", () => {
  test("a self-vendored root is NOT described as an unchecked third-party root", () => {
    const declared = declareOurVendorRoot({
      vendorName: "Zeta (self-vendored)",
      chainToRoot: ["device identity", "our vendor root"],
      verificationService: "our own tkey-verification instance",
    });
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    expect(declared.root.authority).toBe("self-vendored");
    const described = describeVendorTrustRoot(declared.root);
    expect(described).toContain("SELF-VENDORED");
    expect(described).not.toContain("caller-declared, not on the checked roster");
  });

  test("the assurance sentence never claims the device is genuine", () => {
    const declared = declareOurVendorRoot({
      vendorName: "Zeta (self-vendored)",
      chainToRoot: ["device identity", "our vendor root"],
      verificationService: "our own tkey-verification instance",
    });
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    const sentence = describeSelfVendoredAssurance(declared.root);
    expect(sentence.toLowerCase()).not.toContain("genuine");
    expect(sentence).toContain("no third party vouches");
    expect(sentence).toContain("not tampered with");
  });
});
