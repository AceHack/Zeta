/**
 * vendor-trust-root.test.ts — the falsifiers for "an attestation claim names its root".
 *
 * The load-bearing tests here are the REFUSALS. A constructor that accepts everything is not a
 * guard, and the defect being closed (081M00QP7FB087G0R00031BQ93) was exactly that: a bare
 * `string` root accepted `""`, `"unknown"` and `"r"` with no complaint.
 *
 * Note what these tests do NOT assert: that anything verified. There is no cryptography in the
 * module under test and none is claimed here.
 */
import { describe, test, expect } from "bun:test";
import {
  VENDOR_TRUST_ROOTS,
  declareSelfVendoredTrustRoot,
  declareVendorTrustRoot,
  describeVendorTrustRoot,
  parseVendorTrustRoot,
  rootAuthorityName,
  type VendorRootAuthority,
} from "./vendor-trust-root";

describe("the checked roster", () => {
  test("every entry names a vendor, a non-empty chain, and a distribution service", () => {
    const entries = Object.values(VENDOR_TRUST_ROOTS);
    expect(entries.length).toBe(5);
    for (const r of entries) {
      expect(r.vendorName.trim().length).toBeGreaterThan(0);
      expect(r.chainToRoot.length).toBeGreaterThan(0);
      for (const link of r.chainToRoot) expect(link.trim().length).toBeGreaterThan(0);
      expect(r.verificationService.trim().length).toBeGreaterThan(0);
      expect(r.onCheckedRoster).toBe(true);
    }
  });

  test("the roster key and the authority agree — a mislabelled root would be worse than none", () => {
    for (const [key, r] of Object.entries(VENDOR_TRUST_ROOTS)) {
      expect(r.authority).toBe(key as VendorRootAuthority);
    }
  });

  test("the root is the LAST chain element, matching the shipped ladder doc's table", () => {
    expect(rootAuthorityName(VENDOR_TRUST_ROOTS["amd-ark"])).toBe("ARK (AMD Root Key, self-signed)");
    expect(rootAuthorityName(VENDOR_TRUST_ROOTS["intel-sgx-root-ca"])).toBe("Intel SGX Root CA");
    expect(rootAuthorityName(VENDOR_TRUST_ROOTS["nvidia-device-identity-ca"])).toBe(
      "NVIDIA device-identity CA",
    );
    expect(rootAuthorityName(VENDOR_TRUST_ROOTS["tpm-manufacturer-ek-ca"])).toBe(
      "TPM manufacturer EK root CA",
    );
    expect(rootAuthorityName(VENDOR_TRUST_ROOTS["aws-nitro-enclaves-root-g1"])).toBe(
      "AWS_NitroEnclaves_Root-G1",
    );
  });

  test("AMD and Intel are NOT the same root — the multi-vendor diversity claim depends on it", () => {
    const amd = VENDOR_TRUST_ROOTS["amd-ark"];
    const intel = VENDOR_TRUST_ROOTS["intel-sgx-root-ca"];
    expect(rootAuthorityName(amd)).not.toBe(rootAuthorityName(intel));
    expect(amd.vendorName).not.toBe(intel.vendorName);
  });

  test("no roster entry carries a fingerprint — a remembered hash is a fabricated anchor", () => {
    for (const r of Object.values(VENDOR_TRUST_ROOTS)) {
      const text = `${r.vendorName} ${r.chainToRoot.join(" ")} ${r.verificationService}`;
      // 32+ hex chars in a row is what a digest looks like. None should appear.
      expect(/\b[0-9a-fA-F]{32,}\b/.test(text)).toBe(false);
    }
  });

  test("the roster is frozen — a consumer cannot repoint a root after the fact", () => {
    expect(Object.isFrozen(VENDOR_TRUST_ROOTS)).toBe(true);
    expect(Object.isFrozen(VENDOR_TRUST_ROOTS["amd-ark"])).toBe(true);
  });
});

describe("declareVendorTrustRoot REFUSES an unnamed root", () => {
  test("a blank vendor name is refused", () => {
    for (const vendorName of ["", "   ", "\t\n"]) {
      const r = declareVendorTrustRoot({ vendorName, chainToRoot: ["some-root"], verificationService: "s" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.why.refused).toBe("blank-vendor-name");
    }
  });

  test("an empty chain is refused — a root with no chain names nothing to terminate at", () => {
    const r = declareVendorTrustRoot({ vendorName: "SomeVendor", chainToRoot: [], verificationService: "s" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why.refused).toBe("empty-chain");
  });

  test("a blank chain element is refused, and the refusal says WHICH one", () => {
    const r = declareVendorTrustRoot({
      vendorName: "SomeVendor",
      chainToRoot: ["leaf", "  ", "root"],
      verificationService: "s",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.why.refused).toBe("blank-chain-element");
      if (r.why.refused === "blank-chain-element") expect(r.why.index).toBe(1);
    }
  });

  test("a genuinely named unlisted root is ACCEPTED but marked off-roster", () => {
    const r = declareVendorTrustRoot({
      vendorName: "Tillitis",
      chainToRoot: ["measured-app identity", "TKey UDS-derived device key"],
      verificationService: "none — device-local",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.root.authority).toBe("unlisted");
      expect(r.root.onCheckedRoster).toBe(false);
      expect(rootAuthorityName(r.root)).toBe("TKey UDS-derived device key");
    }
  });
});

describe("describeVendorTrustRoot keeps the ceiling attached to the claim", () => {
  test("a checked root reads as checked; an unlisted one says it is caller-declared", () => {
    expect(describeVendorTrustRoot(VENDOR_TRUST_ROOTS["amd-ark"])).toContain("checked roster");
    const r = declareVendorTrustRoot({
      vendorName: "SomeVendor",
      chainToRoot: ["a", "b"],
      verificationService: "s",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(describeVendorTrustRoot(r.root)).toContain("not on the checked roster");
    }
  });

  test("the description names the vendor and the full chain, leaf to root", () => {
    const d = describeVendorTrustRoot(VENDOR_TRUST_ROOTS["intel-sgx-root-ca"]);
    expect(d).toContain("Intel");
    expect(d).toContain("PCK certificate (rooted in CPU fuses) -> Intel SGX Root CA");
  });
});

describe("parseVendorTrustRoot is the JSON boundary guard (no brand out there)", () => {
  test("a known authority reconstructs from the roster, ignoring caller-supplied chain text", () => {
    const r = parseVendorTrustRoot({ authority: "amd-ark", vendorName: "Definitely Not AMD" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.root.vendorName).toBe("AMD");
      expect(r.root.onCheckedRoster).toBe(true);
    }
  });

  test("an unknown authority is refused — unknown is not permissive", () => {
    for (const authority of ["", "totally-legit-ca", "unknown"]) {
      const r = parseVendorTrustRoot({ authority });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.why.refused).toBe("unknown-authority");
    }
  });

  test("a non-object, null, or missing-authority value is refused", () => {
    for (const value of [null, undefined, 42, "amd-ark", {}, { authority: 7 }]) {
      expect(parseVendorTrustRoot(value).ok).toBe(false);
    }
  });

  test("an unlisted authority still has to name a vendor and a chain", () => {
    expect(parseVendorTrustRoot({ authority: "unlisted", vendorName: "", chainToRoot: ["r"] }).ok).toBe(false);
    expect(parseVendorTrustRoot({ authority: "unlisted", vendorName: "V", chainToRoot: [] }).ok).toBe(false);
    expect(parseVendorTrustRoot({ authority: "unlisted", vendorName: "V", chainToRoot: [""] }).ok).toBe(false);
    expect(parseVendorTrustRoot({ authority: "unlisted", vendorName: "V", chainToRoot: [1] }).ok).toBe(false);
    const good = parseVendorTrustRoot({
      authority: "unlisted",
      vendorName: "V",
      chainToRoot: ["leaf", "root"],
      verificationService: "s",
    });
    expect(good.ok).toBe(true);
  });

  test("a self-vendored authority survives the boundary as self-vendored, not as unlisted", () => {
    const r = parseVendorTrustRoot({
      authority: "self-vendored",
      vendorName: "Zeta (self-vendored)",
      chainToRoot: ["device identity", "our vendor root"],
      verificationService: "our own tkey-verification instance",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.root.authority).toBe("self-vendored");
  });

  test("a self-vendored authority still has to name a vendor and a chain", () => {
    expect(parseVendorTrustRoot({ authority: "self-vendored", vendorName: "", chainToRoot: ["r"] }).ok).toBe(false);
    expect(parseVendorTrustRoot({ authority: "self-vendored", vendorName: "V", chainToRoot: [] }).ok).toBe(false);
  });
});

describe("self-vendored is a SEPARATE case from unlisted (081M00VJGAV087G0R00393F6X5)", () => {
  const declared = declareSelfVendoredTrustRoot({
    vendorName: "Zeta (self-vendored)",
    chainToRoot: ["measured-app identity", "our vendor root"],
    verificationService: "our own tkey-verification instance",
  });

  test("a root we hold is not labelled as an unchecked third-party root", () => {
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    expect(declared.root.authority).toBe("self-vendored");
    expect(declared.root.onCheckedRoster).toBe(false);
  });

  test("its description says nobody else vouches — the whole reason the member exists", () => {
    expect(declared.ok).toBe(true);
    if (!declared.ok) return;
    const d = describeVendorTrustRoot(declared.root);
    expect(d).toContain("SELF-VENDORED");
    expect(d).toContain("no third party vouches");
    expect(d).not.toContain("caller-declared, not on the checked roster");
  });

  test("it inherits every naming refusal — a self-held root still has to be NAMED", () => {
    expect(declareSelfVendoredTrustRoot({ vendorName: " ", chainToRoot: ["r"], verificationService: "s" }).ok).toBe(false);
    expect(declareSelfVendoredTrustRoot({ vendorName: "V", chainToRoot: [], verificationService: "s" }).ok).toBe(false);
    expect(declareSelfVendoredTrustRoot({ vendorName: "V", chainToRoot: ["a", " "], verificationService: "s" }).ok).toBe(false);
  });

  test("it is NOT on the checked roster record — the roster is checked third-party roots only", () => {
    expect(Object.keys(VENDOR_TRUST_ROOTS)).not.toContain("self-vendored");
  });
});
