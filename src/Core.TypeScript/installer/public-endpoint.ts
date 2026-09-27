/**
 * src/Core.TypeScript/installer/public-endpoint.ts
 *
 * 081M3JG74G0087G0R001XJC837 — the two install-time settings that decide whether
 * this cluster has a PUBLIC TLS endpoint, and the TypeScript oracle the installer's
 * shell twin (the ZETA-PUBLIC-TLS block in zeta-install.sh) is compared against in
 * public-endpoint-shell-parity.test.ts.
 *
 * THE DEFECT THIS CLOSES
 * ----------------------
 * `k8s/applications/platform/clusterissuer.yaml` shipped `email: you@example.com
 * # ← CHANGE` in both Let's Encrypt issuers, and the Gateway / portal HTTPRoute
 * shipped `portal.example.com` / `portal.zeta.example.com`. Nobody changes a file
 * in a generic installer, so every install applied them. Measured on a real node:
 * the ACME server refuses the account (`invalidContact ... forbidden domain
 * "example.com"`), the ClusterIssuers never go Ready, and because they sat in the
 * `platform` Application's sync wave -1, ArgoCD waited on their health forever —
 * platform-controller, the portal, the Gateway, the HTTPRoute, the monitoring
 * objects and every Blueprint were never applied.
 *
 * THE SHAPE OF THE FIX
 * --------------------
 * The values are INSTALL-TIME CONFIGURATION, never a repo default:
 *
 *   1. `ZETA_ACME_EMAIL` / `ZETA_PUBLIC_DOMAIN` from the ESP `/zeta-firstboot.conf`
 *      (zflash `--acme-email` / `--public-domain`, validated here);
 *   2. otherwise asked at the START of the install, before any disk work;
 *   3. otherwise UNSET — no public TLS at all, and the platform still syncs.
 *
 * BOTH OR NEITHER. An email with no domain has nothing to certify and a domain
 * with no email cannot register an ACME account, so a half-pair is refused rather
 * than half-applied.
 *
 * Pure functions, no IO: unit-testable with nothing on disk.
 */

/** ESP-conf / environment names. The shell twin reads exactly these. */
export const ACME_EMAIL_ENV = "ZETA_ACME_EMAIL";
export const PUBLIC_DOMAIN_ENV = "ZETA_PUBLIC_DOMAIN";

/** The only hostname the platform publishes today, derived — never configured. */
export const PORTAL_HOST_LABEL = "portal";

export type DomainValidation = "empty" | "valid" | "invalid-format" | "reserved";
export type EmailValidation = "empty" | "valid" | "invalid-format" | "reserved-domain";

/**
 * Names that can never be a real public endpoint, so an ACME CA refuses them and
 * a Gateway listener carrying one can never receive traffic.
 *
 * RFC 2606 §2 reserves the TLDs `.test`, `.example`, `.invalid`, `.localhost`;
 * §3 reserves the second-level `example.com`, `example.net`, `example.org`.
 * RFC 6762 adds `.local` (mDNS, link-local only) — not in the request that carved
 * this, included because Let's Encrypt refuses it for the same reason.
 */
const RESERVED_TLDS: ReadonlySet<string> = new Set(["test", "example", "invalid", "localhost", "local"]);
const RESERVED_SECOND_LEVEL: ReadonlySet<string> = new Set(["example.com", "example.net", "example.org"]);

export function isReservedDomain(domain: string): boolean {
  const labels = domain.toLowerCase().split(".");
  const tld = labels[labels.length - 1] ?? "";
  if (RESERVED_TLDS.has(tld)) return true;
  const secondLevel = labels.slice(-2).join(".");
  return RESERVED_SECOND_LEVEL.has(secondLevel);
}

/**
 * A DNS name the portal hostname can be derived from: two or more LDH labels
 * (RFC 1123), each 1–63 chars, no leading/trailing hyphen, the last one starting
 * with a letter (no all-numeric TLD, so a bare IPv4 address is refused). Total
 * length is capped so that `portal.<domain>` still fits in 253.
 *
 * Case-insensitive; the caller lowercases before use.
 */
export function validatePublicDomain(raw: string): DomainValidation {
  if (raw === "") return "empty";
  const maxLength = 253 - (PORTAL_HOST_LABEL.length + 1);
  if (raw.length > maxLength) return "invalid-format";
  if (!/^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(raw)) {
    return "invalid-format";
  }
  return isReservedDomain(raw) ? "reserved" : "valid";
}

/**
 * An ACME contact address. Deliberately NARROWER than RFC 5322: the local part is
 * `[A-Za-z0-9._%+-]+`, so no quote, space, `$` or backtick can ever reach the
 * shell-sourced ESP conf or the rendered manifest. The domain part must pass
 * `validatePublicDomain` shape, and a reserved domain is its own verdict because
 * it is exactly the live failure (`forbidden domain "example.com"`).
 */
export function validateAcmeEmail(raw: string): EmailValidation {
  if (raw === "") return "empty";
  const m = /^([A-Za-z0-9._%+-]{1,64})@(.+)$/.exec(raw);
  if (m === null) return "invalid-format";
  const domain = m[2] ?? "";
  const d = validatePublicDomain(domain);
  if (d === "reserved") return "reserved-domain";
  if (d !== "valid") return "invalid-format";
  return "valid";
}

export interface PublicEndpoint {
  readonly acmeEmail: string;
  readonly publicDomain: string;
}

export type PublicEndpointPlan =
  | { readonly ok: true; readonly value: PublicEndpoint | null }
  | { readonly ok: false; readonly error: string };

/** `portal.<domain>` — the single place the portal hostname is derived. */
export function portalHostname(publicDomain: string): string {
  return `${PORTAL_HOST_LABEL}.${publicDomain.toLowerCase()}`;
}

/**
 * Validate an optional pair (e.g. zflash flags). Neither → `null` (UNSET, a valid
 * state). Exactly one → refused. Invalid or reserved → refused, naming why.
 */
export function planPublicEndpoint(input: {
  readonly acmeEmail?: string;
  readonly publicDomain?: string;
}): PublicEndpointPlan {
  const email = input.acmeEmail;
  const domain = input.publicDomain;
  if (email === undefined && domain === undefined) return { ok: true, value: null };
  if (email === undefined || domain === undefined) {
    return {
      ok: false,
      error:
        "--acme-email and --public-domain go together: an ACME account with no domain certifies nothing, " +
        "and a domain with no ACME contact cannot register an account",
    };
  }
  const e = validateAcmeEmail(email);
  if (e !== "valid") {
    return {
      ok: false,
      error:
        e === "reserved-domain"
          ? `--acme-email ${JSON.stringify(email)} uses a reserved (RFC 2606 / RFC 6762) domain; the ACME CA refuses it`
          : `--acme-email ${JSON.stringify(email)} is not an address of the form local@domain.tld`,
    };
  }
  const d = validatePublicDomain(domain);
  if (d !== "valid") {
    return {
      ok: false,
      error:
        d === "reserved"
          ? `--public-domain ${JSON.stringify(domain)} is a reserved (RFC 2606 / RFC 6762) name and can never be a public endpoint`
          : `--public-domain ${JSON.stringify(domain)} is not a DNS name (two or more labels, e.g. yourdomain.net)`,
    };
  }
  return { ok: true, value: { acmeEmail: email, publicDomain: domain.toLowerCase() } };
}

/**
 * The lines appended to the ESP `/zeta-firstboot.conf`. Single-quoted; the
 * validators above admit no `'`, so there is nothing to escape.
 */
export function renderPublicEndpointConfLines(pe: PublicEndpoint): string {
  return `${ACME_EMAIL_ENV}='${pe.acmeEmail}'\n${PUBLIC_DOMAIN_ENV}='${pe.publicDomain}'\n`;
}
