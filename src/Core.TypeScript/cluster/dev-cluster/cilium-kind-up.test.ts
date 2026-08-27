// src/Core.TypeScript/cluster/dev-cluster/cilium-kind-up.test.ts
//
// The falsifier for the pod-IPAM predicate in `cilium-kind-up.ts`.
//
// WHY A UNIT TEST FOR TWO SMALL FUNCTIONS. The live check runs inside the
// `live kind Cilium CNI` lane, which is a five-minute kind bring-up plus a
// Helm install. A parser bug in it therefore costs five minutes to observe and
// cannot be observed at all on a machine without Docker — which is how
// `"10.143.0.62 /32"` reached `main` and turned that lane red with a stack
// trace instead of a verdict (5e196ea244, run 33025994843). These are pure
// functions over strings; their falsifier belongs here, in the bun sweep.
//
// Each case below FAILS on the code as it stood at 5e196ea244. That is the
// point of writing them: a test that passes both before and after a fix has
// not measured the fix.

import { describe, expect, test } from "bun:test";
import { podIpField, podIpInPool } from "./cilium-kind-up.ts";

// The exact shape `kubectl -o jsonpath=...{.metadata.name}={.status.podIP}{' '}{.spec.hostNetwork}`
// emits. The trailing space is not a typo — it is the separator, and the field
// after it is empty on every pod that does not set `hostNetwork`.
const UNSET_HOSTNETWORK_ROW = "coredns-7d764666f9-gljg8=10.143.0.113 ";
const EXPLICIT_FALSE_ROW = "coredns-7d764666f9-p7mxh=10.143.0.168 false";

describe("podIpField — the jsonpath tail is two fields, not one", () => {
  test("an unset hostNetwork leaves a TRAILING SPACE that is not part of the address", () => {
    // `split("=")[1]` alone yields "10.143.0.113 ", which is what produced
    // `not a dotted-quad CIDR: "10.143.0.113 /32"` on main.
    expect(podIpField(UNSET_HOSTNETWORK_ROW)).toBe("10.143.0.113");
  });

  test("an explicit hostNetwork=false leaves a whole second WORD", () => {
    expect(podIpField(EXPLICIT_FALSE_ROW)).toBe("10.143.0.168");
  });

  test("a Pending pod has no address, and that is an empty field rather than a crash", () => {
    expect(podIpField("coredns-abc= ")).toBe("");
    expect(podIpField("coredns-abc=")).toBe("");
  });

  test("a row with no '=' at all yields the empty field", () => {
    expect(podIpField("garbage")).toBe("");
  });
});

describe("podIpInPool — address arithmetic, and total on junk", () => {
  const POOL = "10.143.0.0/17";

  test("the rows that made the lane crash are IN the derived pool", () => {
    expect(podIpInPool(podIpField(UNSET_HOSTNETWORK_ROW), POOL)).toBe(true);
    expect(podIpInPool(podIpField(EXPLICIT_FALSE_ROW), POOL)).toBe(true);
  });

  test("a /17 is not a text boundary: 10.143.128.x shares the prefix and is OUTSIDE", () => {
    expect(podIpInPool("10.143.127.255", POOL)).toBe(true);
    expect(podIpInPool("10.143.128.0", POOL)).toBe(false);
    expect(podIpInPool("10.143.200.1", POOL)).toBe(false);
  });

  test("the pre-derivation pod CIDR and kind's own default are both outside", () => {
    // 10.42.0.0/16 was the hardcoded constant this check used to carry;
    // 10.244.0.0/16 is kind's default CNI range, i.e. the "Cilium is not the
    // CNI" case the check exists to catch.
    expect(podIpInPool("10.42.0.5", POOL)).toBe(false);
    expect(podIpInPool("10.244.0.7", POOL)).toBe(false);
  });

  test("a non-address field is FALSE, never a throw — fail-closed, so the check still fails", () => {
    // Each of these threw out of `cidrBounds` before the fix.
    expect(podIpInPool("", POOL)).toBe(false);
    expect(podIpInPool("10.143.0.62 ", POOL)).toBe(false);
    expect(podIpInPool("10.143.0.62 false", POOL)).toBe(false);
    expect(podIpInPool("not-an-ip", POOL)).toBe(false);
  });

  test("RANGE counts as 'not an address' too — a shape-only guard would not be the claim made", () => {
    // A `/^\d{1,3}(\.\d{1,3}){3}$/` guard accepts these and `cidrBounds` then
    // throws `CIDR out of range` — a different throw through the very hole the
    // guard exists to close. The docstring promises FALSE, so the guard checks
    // shape AND range.
    expect(podIpInPool("999.1.1.1", POOL)).toBe(false);
    expect(podIpInPool("10.143.0.256", POOL)).toBe(false);
    expect(podIpInPool("10.143.0", POOL)).toBe(false);
    expect(podIpInPool("10.143.0.1.1", POOL)).toBe(false);
    // ...and the in-range boundary is still accepted, so this is not just a
    // guard that rejects everything.
    expect(podIpInPool("10.143.0.255", POOL)).toBe(true);
  });

  test("the pool itself is still validated — a malformed CIDR is a programmer error and throws", () => {
    // The tolerance above is for the OBSERVED value, never for the DECLARED
    // one. A pod CIDR that is not a CIDR means the values file is wrong, and
    // swallowing that would make the whole check pass against nothing.
    expect(() => podIpInPool("10.143.0.1", "not-a-cidr")).toThrow(/not a dotted-quad CIDR/);
  });
});
