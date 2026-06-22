/**
 * Room egress policy — port of the Cilium L7 network policy from
 * `full-ai-cluster/k8s/applications/cilium/Application.yaml` (Merge1 §08).
 *
 * The flat `SandboxSpec.allowedEgress: string[]` becomes a structured policy:
 * L3/L4 host allow-list, optional L7 HTTP method/path rules per host, mTLS
 * requirement, and SPIFFE service-account allow-list. Pure + deterministic.
 */

export type EgressHttpRule = {
  readonly host: string;
  /** Allowed HTTP methods (empty = all methods). */
  readonly methods: readonly string[];
  /** Allowed path prefixes (empty = all paths). */
  readonly paths: readonly string[];
};

export type EgressPolicy = {
  /** Allowed hosts (L3/L4). */
  readonly hosts: readonly string[];
  /** Allowed HTTP rules per host (L7). */
  readonly httpRules?: readonly EgressHttpRule[];
  /** Require mTLS (Cilium service mesh). */
  readonly requireMtls: boolean;
  /** Allowed service accounts (SPIFFE-based). */
  readonly allowedServiceAccounts?: readonly string[];
};

/** L3/L4: is the host on the allow-list? */
export function isAllowedEgress(policy: EgressPolicy, host: string): boolean {
  return policy.hosts.includes(host);
}

/**
 * L7: is an HTTP `method`+`path` to `host` allowed? The host must pass L3/L4;
 * if an `httpRules` entry exists for the host, the method must be allowed (or
 * the rule's method list empty) and the path must match an allowed prefix (or
 * the rule's path list empty). With no rule for the host, L3/L4 governs.
 */
export function isAllowedHttpEgress(
  policy: EgressPolicy,
  host: string,
  method: string,
  path: string,
): boolean {
  if (!isAllowedEgress(policy, host)) return false;
  const rule = policy.httpRules?.find((r) => r.host === host);
  if (!rule) return true;
  const methodOk = rule.methods.length === 0 || rule.methods.includes(method);
  const pathOk = rule.paths.length === 0 || rule.paths.some((p) => path.startsWith(p));
  return methodOk && pathOk;
}

/** Is a SPIFFE service account allowed to receive egress under this policy? */
export function isAllowedServiceAccount(policy: EgressPolicy, spiffeId: string): boolean {
  if (!policy.allowedServiceAccounts || policy.allowedServiceAccounts.length === 0) return true;
  return policy.allowedServiceAccounts.includes(spiffeId);
}
