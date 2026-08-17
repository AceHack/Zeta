/**
 * vendor-trust-root.ts — an attestation claim must NAME the root it chains to.
 *
 * ## The defect this type removes
 *
 * "Attested" with no named root is not a checkable claim. A verifier cannot be pointed at it, a
 * reviewer cannot say which key would have to be compromised to forge it, and a reader cannot tell
 * a TPM-manufacturer EK from an AMD ARK. Before this module, `AttestedEvidence.trustRoot` in
 * `key-erasure-meter.ts` was a bare `string`, so `""`, `"   "`, `"unknown"`, `"r"` and
 * `"trust me bro"` were all type-correct roots and all read identically. That is the same class as
 * an unanchored coinage under `.claude/rules/anchor-to-human-prior-art.md`: an unnamed anchor is a
 * debt, not a credential.
 *
 * The shape here follows `Wall.Whitebox` / `whiteboxPermitted` in `src/Core/DerivationProtocol.fs`:
 * **unknown is not permissive.** There is no way to spell "attested, root unspecified".
 *
 * ## What is and is not proven (cryptographic precision)
 *
 * This module carries **no verifier and performs no cryptography**. It does not fetch a
 * certificate, parse a quote, check a signature, or walk a chain. What it does is make the
 * *identity of the root* a required, closed-roster part of the claim, so that:
 *
 * - **PROVEN by construction:** an attestation value in this substrate names a root authority, and
 *   names the certificate chain that root sits at the end of.
 * - **NOT PROVEN, and not claimed anywhere here:** that any such chain was ever built, that any
 *   signature verified, or that the named root actually issued anything. `chainToRoot` is a
 *   *description of the chain a verifier would have to walk*, not evidence that one was walked.
 *
 * Calling the `chainToRoot` field a "trust chain" would be an overclaim: nothing here chains. It is
 * the chain's **name**, recorded so the eventual verifier has an unambiguous target.
 *
 * ## The roster, and why the entries carry no fingerprints
 *
 * Entries are transcribed from the CHECKED table in
 * `docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md`
 * (§"Vendor roots cap every attestation claim"), whose four silicon rows plus the AWS row were
 * verified against vendor/standards documentation on 2026-08-14.
 *
 * Deliberately **no root-key hashes or fingerprints appear below.** A fingerprint written from
 * memory is a fabricated anchor — worse than none, because it looks checkable. Populating them
 * belongs with the verifier that would compare against them.
 *
 * That table's other half matters and is preserved in `verificationService`: the trust root is
 * **irreducible**, the vendor's verification *service* is **avoidable** (all five ecosystems
 * support offline verification). Recording both keeps a reader from concluding that avoiding the
 * service avoided the root. It does not.
 *
 * ## Anchors (Beacon)
 *
 * - AMD SEV-SNP: ARK -> ASK -> VCEK, per-chip per-TCB leaf; AMD KDS distributes certs.
 * - Intel TDX/SGX: quotes chain through PCK certs to the Intel SGX Root CA; PCS/PCCS distribute.
 * - NVIDIA Hopper/Blackwell: per-GPU identity key fused at production, cert from NVIDIA's device CA.
 * - TPM 2.0: the manufacturer's EK root CA (Infineon, Nuvoton, STMicro, ...) — TCG EK Credential Profile.
 * - AWS Nitro Enclaves: `AWS_NitroEnclaves_Root-G1`, an AWS Private CA key.
 *
 * All five cited from the repo's own CHECKED table above, not page-checked afresh here.
 */

/**
 * Brand. NOT exported, which is what seals the type: outside this module there is no way to write
 * an object literal that satisfies `VendorTrustRoot`, so the roster and `declareVendorTrustRoot`
 * are the only doors.
 *
 * Honest limit: a caller who writes `x as unknown as VendorTrustRoot` defeats this, as it defeats
 * every TypeScript brand. `parseVendorTrustRoot` is the guard for values arriving from JSON, where
 * the type system is not present at all.
 */
declare const vendorTrustRootBrand: unique symbol;

/**
 * The roster of attestation root authorities. A closed union: an authority not on this list cannot
 * be spelled, which is the point — `"unlisted"` is the one way to name a root we have not checked,
 * and it still requires the root to be *named* (see `declareVendorTrustRoot`).
 *
 * `"self-vendored"` is a SEPARATE member and the distinction is load-bearing, not cosmetic. Before
 * it existed, a root **we hold ourselves** (a self-fabricated device we provisioned — work-item
 * 081M00VJGAV087G0R00393F6X5) came back from `declareVendorTrustRoot` as `"unlisted"` with
 * `onCheckedRoster: false`, and rendered as *"caller-declared, not on the checked roster"*. That
 * sentence is true and misleading: it reads as **third-party provenance we have not verified**,
 * when in fact there is **no third party at all**. Those are opposite epistemic situations —
 * `"unlisted"` means someone else vouches and we did not check them; `"self-vendored"` means
 * nobody else vouches. Collapsing them lets a self-signature read as an external credential.
 */
export type VendorRootAuthority =
  | "amd-ark"
  | "intel-sgx-root-ca"
  | "nvidia-device-identity-ca"
  | "tpm-manufacturer-ek-ca"
  | "aws-nitro-enclaves-root-g1"
  | "unlisted"
  | "self-vendored";

/**
 * A NAMED attestation root. Every field is required and no field may be blank; there is no member
 * meaning "unspecified".
 */
export interface VendorTrustRoot {
  readonly [vendorTrustRootBrand]: true;
  /** Which root authority. Closed roster. */
  readonly authority: VendorRootAuthority;
  /** The organisation holding the root key, in human-readable form. Never blank. */
  readonly vendorName: string;
  /**
   * The certificate chain, **leaf first, root last**, by name. The last element IS the root.
   * Non-empty by type (`[string, ...string[]]`).
   *
   * This is the chain's NAME, not a chain. Nothing in this module walks or verifies it.
   */
  readonly chainToRoot: readonly [string, ...string[]];
  /**
   * The vendor service that distributes the collateral. The **avoidable** half — all five
   * ecosystems support offline verification. Avoiding it does not avoid `chainToRoot`'s last
   * element.
   */
  readonly verificationService: string;
  /**
   * `true` for the five entries transcribed from the repo's CHECKED table; `false` for a root
   * declared by a caller via `declareVendorTrustRoot`. A caller-declared root is *named* — which is
   * all this module claims — but it is not one we checked.
   */
  readonly onCheckedRoster: boolean;
}

function root(
  authority: VendorRootAuthority,
  vendorName: string,
  chainToRoot: readonly [string, ...string[]],
  verificationService: string,
  onCheckedRoster: boolean,
): VendorTrustRoot {
  // The brand is PHANTOM: `declare const ...: unique symbol` has no runtime value, so the field is
  // never actually set and never serialises. It exists only to stop an object literal written
  // outside this module from satisfying `VendorTrustRoot`. This cast is the single mint site.
  return Object.freeze({
    authority,
    vendorName,
    chainToRoot,
    verificationService,
    onCheckedRoster,
  }) as unknown as VendorTrustRoot;
}

/**
 * The five checked roots. Frozen, so a consumer cannot mutate the roster into naming something
 * else after the fact.
 */
export const VENDOR_TRUST_ROOTS = Object.freeze({
  "amd-ark": root(
    "amd-ark",
    "AMD",
    ["VCEK (per-chip, per-TCB)", "ASK", "ARK (AMD Root Key, self-signed)"],
    "AMD KDS (kdsintf.amd.com); VCEK derivation is deterministic, so certs cache and verification runs offline",
    true,
  ),
  "intel-sgx-root-ca": root(
    "intel-sgx-root-ca",
    "Intel",
    ["TDX/SGX quote", "PCK certificate (rooted in CPU fuses)", "Intel SGX Root CA"],
    "Intel PCS; PCCS caches collateral locally",
    true,
  ),
  "nvidia-device-identity-ca": root(
    "nvidia-device-identity-ca",
    "NVIDIA",
    ["per-GPU identity key (fused at production)", "NVIDIA device-identity CA"],
    "NRAS is the default path, not the only one; local/offline verification is supported at the cost of revocation staleness",
    true,
  ),
  "tpm-manufacturer-ek-ca": root(
    "tpm-manufacturer-ek-ca",
    "TPM manufacturer (Infineon, Nuvoton, STMicro, ...)",
    ["Endorsement Key certificate", "TPM manufacturer EK root CA"],
    "EK certs read from TPM NV indices or the manufacturer's hosting server; manufacturer roots published for offline validation",
    true,
  ),
  "aws-nitro-enclaves-root-g1": root(
    "aws-nitro-enclaves-root-g1",
    "Amazon Web Services",
    ["COSE/CBOR attestation document", "AWS Nitro Attestation PKI intermediates", "AWS_NitroEnclaves_Root-G1"],
    "Root cert published for download; attestation documents carry their own CA bundle, so verification is offline",
    true,
  ),
} satisfies Record<Exclude<VendorRootAuthority, "unlisted" | "self-vendored">, VendorTrustRoot>);

/** Why a proposed root was refused. Refusal is the falsifier for this whole module. */
export type VendorTrustRootRefusal =
  | { readonly refused: "blank-vendor-name" }
  | { readonly refused: "empty-chain" }
  | { readonly refused: "blank-chain-element"; readonly index: number }
  | { readonly refused: "unknown-authority"; readonly authority: string };

export type VendorTrustRootResult =
  | { readonly ok: true; readonly root: VendorTrustRoot }
  | { readonly ok: false; readonly why: VendorTrustRootRefusal };

function isBlank(s: string): boolean {
  return s.trim().length === 0;
}

/**
 * Declare a root that is not on the checked roster. Returns a refusal rather than throwing.
 *
 * This is the escape hatch for a root the industry has and this repo has not checked — and it is
 * deliberately NOT an escape hatch for an unnamed one. A blank vendor name, an empty chain, or a
 * blank chain element is refused. The result carries `onCheckedRoster: false` so a reader can tell
 * "named and checked here" from "named by the caller".
 *
 * `chainToRoot` is leaf-first; its LAST element is the root and is what a verifier would terminate
 * at. Nothing here verifies it.
 */
export function declareVendorTrustRoot(input: {
  readonly vendorName: string;
  readonly chainToRoot: readonly string[];
  readonly verificationService: string;
}): VendorTrustRootResult {
  if (isBlank(input.vendorName)) return { ok: false, why: { refused: "blank-vendor-name" } };
  const head = input.chainToRoot[0];
  if (head === undefined) return { ok: false, why: { refused: "empty-chain" } };
  for (let i = 0; i < input.chainToRoot.length; i++) {
    const element = input.chainToRoot[i];
    if (element === undefined || isBlank(element)) {
      return { ok: false, why: { refused: "blank-chain-element", index: i } };
    }
  }
  const chain: readonly [string, ...string[]] = [head, ...input.chainToRoot.slice(1)];
  return {
    ok: true,
    root: root("unlisted", input.vendorName, chain, input.verificationService, false),
  };
}

/**
 * Declare the root for a device **we** provisioned — a self-fabricated device whose UDS we
 * generated, so no manufacturer CA exists anywhere in its lineage.
 *
 * The same refusals as `declareVendorTrustRoot` apply (a self-held root still has to be NAMED; an
 * anonymous self-signature is the worst of both). What differs is only the resulting `authority`,
 * and therefore what `describeVendorTrustRoot` will say about it.
 *
 * **This function creates no key, signs nothing, and provisions nothing.** It records the name of a
 * root, exactly as its sibling does. Whether such a root should exist at all, and who would hold
 * it, are decisions outside this module — see `self-vendored-provisioning.ts`, which refuses to
 * advance a ceremony while custody is undecided rather than picking a holder.
 */
export function declareSelfVendoredTrustRoot(input: {
  readonly vendorName: string;
  readonly chainToRoot: readonly string[];
  readonly verificationService: string;
}): VendorTrustRootResult {
  const declared = declareVendorTrustRoot(input);
  if (!declared.ok) return declared;
  return {
    ok: true,
    root: root("self-vendored", input.vendorName, declared.root.chainToRoot, input.verificationService, false),
  };
}

/** The name a verifier would have to terminate at: the LAST element of the chain. */
export function rootAuthorityName(trustRoot: VendorTrustRoot): string {
  return trustRoot.chainToRoot[trustRoot.chainToRoot.length - 1] ?? trustRoot.vendorName;
}

/**
 * One line naming what an attestation against this root would and would not establish. Used in
 * evidence readings so the ceiling travels with the claim: the strongest available statement is
 * *"<vendor> says this is genuine <vendor> silicon running this measurement"*, never
 * *"this node is genuine"*.
 */
export function describeVendorTrustRoot(trustRoot: VendorTrustRoot): string {
  const provenance = trustRoot.onCheckedRoster
    ? "checked roster"
    : trustRoot.authority === "self-vendored"
      ? "SELF-VENDORED: we hold this root, so no third party vouches for it and only parties who " +
        "already trust us can verify against it"
      : "caller-declared, not on the checked roster";
  return (
    `root '${rootAuthorityName(trustRoot)}' held by ${trustRoot.vendorName} ` +
    `(authority '${trustRoot.authority}', ${provenance}); ` +
    `chain named leaf-to-root: ${trustRoot.chainToRoot.join(" -> ")}; ` +
    `collateral via ${trustRoot.verificationService}`
  );
}

/**
 * The boundary guard for values crossing from JSON, where the brand does not exist. Reconstructs
 * from the roster by authority, or re-validates an unlisted declaration. Returns a refusal for
 * anything that does not name a root.
 */
export function parseVendorTrustRoot(value: unknown): VendorTrustRootResult {
  if (typeof value !== "object" || value === null) {
    return { ok: false, why: { refused: "unknown-authority", authority: String(value) } };
  }
  const candidate = value as {
    authority?: unknown;
    vendorName?: unknown;
    chainToRoot?: unknown;
    verificationService?: unknown;
  };
  const authority = candidate.authority;
  if (typeof authority !== "string") {
    return { ok: false, why: { refused: "unknown-authority", authority: String(authority) } };
  }
  if (authority !== "unlisted" && authority !== "self-vendored" && authority in VENDOR_TRUST_ROOTS) {
    const key = authority as Exclude<VendorRootAuthority, "unlisted" | "self-vendored">;
    return { ok: true, root: VENDOR_TRUST_ROOTS[key] };
  }
  if (authority !== "unlisted" && authority !== "self-vendored") {
    return { ok: false, why: { refused: "unknown-authority", authority } };
  }
  const vendorName = candidate.vendorName;
  const chain = candidate.chainToRoot;
  const service = candidate.verificationService;
  if (typeof vendorName !== "string") return { ok: false, why: { refused: "blank-vendor-name" } };
  if (!Array.isArray(chain)) return { ok: false, why: { refused: "empty-chain" } };
  const chainStrings: string[] = [];
  for (let i = 0; i < chain.length; i++) {
    const element: unknown = chain[i];
    if (typeof element !== "string") return { ok: false, why: { refused: "blank-chain-element", index: i } };
    chainStrings.push(element);
  }
  // Route by the authority that was READ, not by a default. Sending a `self-vendored` record
  // through `declareVendorTrustRoot` would silently re-label it `unlisted` on the way in — the
  // exact conflation this member exists to remove, reintroduced at the boundary where the type
  // system is absent.
  const declare = authority === "self-vendored" ? declareSelfVendoredTrustRoot : declareVendorTrustRoot;
  return declare({
    vendorName,
    chainToRoot: chainStrings,
    verificationService: typeof service === "string" ? service : "",
  });
}
