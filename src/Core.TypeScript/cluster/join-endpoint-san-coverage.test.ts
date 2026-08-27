// join-endpoint-san-coverage.test.ts — the falsifiers.
//
// The finding this pins, stated once: `zeta-install.sh`'s endpoint validation is a SHAPE check,
// and the language it accepts is strictly broader than the set of endpoints the founder's
// certificate covers. `https://zeta-cp-1.local:6443` passes the regex and is covered by nothing.
// It is not a corner case — it is the first thing an operator types who has a hostname for the box.
//
// Two properties carry the weight:
//
//   1. **The gap is DEMONSTRATED against the installer's own regex**, read out of
//      `zeta-install.sh` rather than copied into a comment. If someone tightens the installer, the
//      drift test fails; if someone widens it, the gap test still holds. Neither can move silently.
//   2. **Every verdict is reachable, and `covered` is not the default.** A classifier that returns
//      `covered` for everything it does not recognise is the vacuity class wearing a helpful face —
//      it would bless exactly the endpoints nobody thought about.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  classifyJoinEndpoint,
  EXPLICIT_TLS_SAN,
  INSTALLER_ENDPOINT_PATTERN,
  isStructurallyUncovered,
  K3S_API_PORT,
  renderEndpointAdvice,
} from "./join-endpoint-san-coverage.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");
const INSTALLER = join(REPO_ROOT, "full-ai-cluster/usb-nixos-installer/zeta-install.sh");

describe("THE GAP — the installer accepts more than the certificate covers", () => {
  const installer = readFileSync(INSTALLER, "utf8");

  test("the installer's pattern is still the one this file models (drift guard)", () => {
    // Read the literal out of the shell, so the model cannot rot away from the thing it models.
    expect(installer).toContain("^https://[A-Za-z0-9._:-]+$");
  });

  test("a hostname that is NOT control-plane passes the installer and is covered by nothing", () => {
    const endpoint = "https://zeta-cp-1.local:6443";
    // Both halves, in one test, because the gap IS the conjunction.
    expect(INSTALLER_ENDPOINT_PATTERN.test(endpoint)).toBe(true);
    expect(classifyJoinEndpoint(endpoint).coverage).toBe("not-covered");
  });

  test("the advice names the real cause — resolution is not coverage", () => {
    const advice = renderEndpointAdvice("https://zeta-cp-1.local:6443");
    expect(advice).toMatch(/TLS verifies the name presented, not the address reached/);
    expect(advice).toMatch(/ping succeeds and the join fails/);
  });

  test("the advice offers all three real fixes, not just the designed one", () => {
    const advice = renderEndpointAdvice("https://zeta-cp-1.local:6443");
    expect(advice).toContain(`https://${EXPLICIT_TLS_SAN}:${String(K3S_API_PORT)}`);
    expect(advice).toMatch(/IP literal/);
    expect(advice).toMatch(/--tls-san=zeta-cp-1\.local on the FOUNDER/);
  });
});

describe("every verdict is reachable, and covered is never the default", () => {
  test("the designed path", () => {
    expect(classifyJoinEndpoint("https://control-plane:6443").coverage).toBe("covered-by-explicit-san");
  });

  test("case is not significant for the name", () => {
    expect(classifyJoinEndpoint("https://Control-Plane:6443").coverage).toBe("covered-by-explicit-san");
  });

  test("an IP literal is covered-IF-node-ip, never plain covered", () => {
    // The distinction is the whole honesty of the classifier: this file cannot see interfaces, so
    // it must not promise what only the founder's cert can settle.
    const v = classifyJoinEndpoint("https://192.168.4.152:6443");
    expect(v.coverage).toBe("covered-if-node-ip");
    expect(v.why).toMatch(/multi-NIC|node IP it SELECTED/);
    expect(isStructurallyUncovered(v)).toBe(false);
  });

  test("loopback is SAN'd and is still the wrong answer", () => {
    for (const e of ["https://127.0.0.1:6443", "https://localhost:6443"]) {
      const v = classifyJoinEndpoint(e);
      expect(v.coverage).toBe("loopback-not-a-join-target");
      // The dangerous reading: TLS would SUCCEED here, so the failure does not look like a failure.
      expect(v.why).toMatch(/founds its own cluster/);
    }
  });

  test("a subdomain of control-plane is NOT control-plane — the SAN is a literal, not a suffix", () => {
    expect(classifyJoinEndpoint("https://control-plane.zeta.local:6443").coverage).toBe("not-covered");
    expect(classifyJoinEndpoint("https://my-control-plane:6443").coverage).toBe("not-covered");
  });

  test("shapes the installer would refuse are malformed, not silently blessed", () => {
    for (const e of ["http://control-plane:6443", "control-plane:6443", "https://cp/path", "https://"]) {
      expect(classifyJoinEndpoint(e).coverage).toBe("malformed");
    }
  });

  test("an unparseable authority inside a shape-valid string is malformed", () => {
    // `https://:6443` matches the installer regex and has no host. A split-on-colon parser
    // produces an empty host and would fall through to `not-covered`, which reads as a real
    // classification of a real name — it is neither.
    expect(classifyJoinEndpoint("https://:6443").coverage).toBe("malformed");
    expect(classifyJoinEndpoint("https://cp:0").coverage).toBe("malformed");
    expect(classifyJoinEndpoint("https://cp:99999").coverage).toBe("malformed");
  });
});

describe("the port is reported, never silently accepted", () => {
  test("a non-API port is called out", () => {
    expect(renderEndpointAdvice("https://control-plane:9345")).toMatch(/is not the k3s API port 6443/);
  });

  test("a missing port is called out", () => {
    const v = classifyJoinEndpoint("https://control-plane");
    expect(v.port).toBeNull();
    expect(renderEndpointAdvice("https://control-plane")).toMatch(/no port/);
  });

  test("the API port is not called out", () => {
    expect(renderEndpointAdvice("https://control-plane:6443")).not.toMatch(/NOTE:/);
  });
});

describe("IPv6 — and a finding the classifier surfaced on its own", () => {
  // The installer's pattern is `^https://[A-Za-z0-9._:-]+$`. It has no `[` and no `]`. So the
  // BRACKETED form — the only form that can carry an IPv6 host and a port unambiguously (RFC 3986
  // §3.2.2) — cannot be staged at all, and the UNBRACKETED form cannot carry a port. Between them
  // that means: **an IPv6 join endpoint with a port is inexpressible through zeta-install.sh.**
  //
  // Found by writing the test wrong. The first version of these cases asserted brackets would be
  // classified as an IP literal; they came back `malformed`, and the classifier was right. Recorded
  // rather than patched away, because "the installer cannot express this" is a fact about the
  // installer, not about this file.

  test("the bracketed form is REFUSED by the installer's own pattern", () => {
    expect(INSTALLER_ENDPOINT_PATTERN.test("https://[fd00::1]:6443")).toBe(false);
    expect(classifyJoinEndpoint("https://[fd00::1]:6443").coverage).toBe("malformed");
  });

  test("the unbracketed form is accepted, and cannot carry a port", () => {
    const v = classifyJoinEndpoint("https://fd00::1");
    // Split-on-colon would call this host `fd00` — a plausible-looking DNS name that does not
    // exist, classified `not-covered` for entirely the wrong reason. Parsing keeps it honest.
    expect(v.host).toBe("fd00::1");
    expect(v.port).toBeNull();
    expect(v.coverage).toBe("covered-if-node-ip");
  });

  test("so an IPv6 endpoint WITH a port is inexpressible — both forms fail, differently", () => {
    expect(classifyJoinEndpoint("https://[fd00::1]:6443").coverage).toBe("malformed");
    expect(classifyJoinEndpoint("https://fd00::1").port).toBeNull();
  });

  test("the bracket parser still works for callers that are not the installer", () => {
    // `splitHostPort` handles brackets correctly; it is the installer's pattern that rejects them.
    // Keeping the parser correct means widening the pattern is a one-line change, not a rewrite.
    expect(classifyJoinEndpoint("https://fd00::1").host).toBe("fd00::1");
  });
});

describe("what this file refuses to claim", () => {
  test("no verdict asserts an endpoint WILL work", () => {
    // Read as a property of the vocabulary: there is no `verified` and no bare `covered`. The
    // strongest verdict available names the mechanism that would cover it, so a reader cannot
    // mistake "not ruled out here" for "checked against a certificate".
    const verdicts = [
      "https://control-plane:6443",
      "https://192.168.4.152:6443",
      "https://zeta-cp-1.local:6443",
    ].map((e) => classifyJoinEndpoint(e).coverage);
    expect(verdicts).not.toContain("verified");
    expect(verdicts).not.toContain("covered");
  });
});
