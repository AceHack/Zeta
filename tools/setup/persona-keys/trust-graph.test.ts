import { describe, expect, it } from "bun:test";
import {
  identityVerdictConfluent,
  identityVerifiersDisagree,
  resolveTrust,
  revocationClosure,
  verdictWithoutScopeRule,
  type TrustGraph,
} from "./trust-graph.ts";

const BASE: TrustGraph = {
  roots: [
    { id: "org-lucent", kind: "org", principal: "lucent" },
    { id: "aaron-self", kind: "user-self", principal: "aaron" },
  ],
  crossSigns: [{ from: "org-lucent", to: "aaron-self" }],
};

/** User vouched for org, but org did NOT cross-sign back — org verifier cannot reach self-root. */
const NON_CONFLUENT: TrustGraph = {
  roots: BASE.roots,
  crossSigns: [{ from: "aaron-self", to: "org-lucent" }],
};

describe("trust-graph conflict resolution", () => {
  it("demonstrates non-confluence WITHOUT the scope rule (org vs self anchor disagree)", () => {
    expect(identityVerifiersDisagree(NON_CONFLUENT, "aaron")).toBe(true);
    expect(verdictWithoutScopeRule(NON_CONFLUENT, "aaron", "org-lucent")).toBe("untrusted");
    expect(verdictWithoutScopeRule(NON_CONFLUENT, "aaron", "aaron-self")).toBe("trusted");
  });

  it("scoped identity rule is confluent (self-root authoritative)", () => {
    expect(identityVerdictConfluent(NON_CONFLUENT, "aaron")).toBe(true);
    expect(resolveTrust(NON_CONFLUENT, "aaron", "identity")).toBe("trusted");
  });

  it("scoped authorization follows org root (requires org→self cross-sign)", () => {
    expect(resolveTrust(NON_CONFLUENT, "aaron", "authorization")).toBe("untrusted");
    expect(resolveTrust(BASE, "aaron", "authorization")).toBe("trusted");
  });

  it("org authorization denylist blocks org access even when cross-signed", () => {
    const graph: TrustGraph = {
      ...BASE,
      orgAuthorizationDenylist: ["aaron"],
    };
    expect(resolveTrust(graph, "aaron", "authorization")).toBe("untrusted");
    expect(resolveTrust(graph, "aaron", "identity")).toBe("trusted");
  });

  it("KRL revocation cascades through cross-sign closure", () => {
    const graph: TrustGraph = {
      ...BASE,
      revokedRootIds: ["org-lucent"],
    };
    const closure = revocationClosure(graph, "org-lucent");
    expect(closure.has("aaron-self")).toBe(true);
    expect(resolveTrust(graph, "aaron", "authorization")).toBe("revoked");
  });

  it("revoking user-self root blocks identity scope", () => {
    const graph: TrustGraph = {
      ...BASE,
      revokedRootIds: ["aaron-self"],
    };
    expect(resolveTrust(graph, "aaron", "identity")).toBe("revoked");
  });
});
