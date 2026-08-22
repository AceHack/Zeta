/**
 * credential.test.ts — the "never exports" property, proven without a credential.
 *
 * The reason this file exists at all is that the defect it guards against
 * (081M00VMWTB087G0R0026XSWT6) was invisible for two months precisely because
 * nothing asserted it. The tests below therefore assert the NEGATIVE — that the
 * parent environment is untouched — which is the property an ambient hoist
 * violates and a point-of-use fetch preserves.
 */

import { describe, expect, test } from "bun:test";
import { buildChildEnv } from "./credential.ts";
import {
  describeStatus,
  exitCodeForStatus,
  errSecAuthFailed,
  errSecInteractionNotAllowed,
  errSecItemNotFound,
  inProcessAvailable,
  probeGenericPassword,
  readGenericPassword,
} from "./keychain-macos.ts";

describe("buildChildEnv — the credential reaches ONE child, never the parent", () => {
  test("the credential is in the child env", () => {
    const child = buildChildEnv({ PATH: "/bin" }, "OP_SERVICE_ACCOUNT_TOKEN", "ops_fake");
    expect(child["OP_SERVICE_ACCOUNT_TOKEN"]).toBe("ops_fake");
  });

  test("the parent env object is NOT mutated — this is the whole point", () => {
    const parent: Record<string, string | undefined> = { PATH: "/bin" };
    buildChildEnv(parent, "OP_SERVICE_ACCOUNT_TOKEN", "ops_fake");
    expect(Object.keys(parent)).toEqual(["PATH"]);
    expect(parent["OP_SERVICE_ACCOUNT_TOKEN"]).toBeUndefined();
  });

  test("the real process.env is NOT mutated", () => {
    const before = Object.prototype.hasOwnProperty.call(process.env, "ZETA_TEST_CRED");
    buildChildEnv(process.env, "ZETA_TEST_CRED", "ops_fake");
    expect(Object.prototype.hasOwnProperty.call(process.env, "ZETA_TEST_CRED")).toBe(before);
  });

  test("undefined parent entries are dropped, extraEnv is merged, credential wins", () => {
    const child = buildChildEnv({ A: "1", B: undefined }, "TOK", "s", { C: "3", TOK: "overridden" });
    expect(child).toEqual({ A: "1", C: "3", TOK: "s" });
  });
});

describe("OSStatus decoding — the arithmetic that already produced a wrong conclusion", () => {
  // An earlier survey read `security(1)` exit 44 as errSecInteractionNotAllowed
  // and concluded a trusted binary had been DENIED. 44 is errSecItemNotFound:
  // the item was in a keychain that was not on the search list. The conclusion
  // happened to be right for other reasons; the evidence was not.
  test("exit 44 is errSecItemNotFound, NOT errSecInteractionNotAllowed", () => {
    expect(exitCodeForStatus(errSecItemNotFound)).toBe(44);
    expect(exitCodeForStatus(errSecInteractionNotAllowed)).toBe(36);
    expect(exitCodeForStatus(errSecAuthFailed)).toBe(51);
  });

  test("every status this module distinguishes has a human-readable name", () => {
    expect(describeStatus(0)).toBe("errSecSuccess");
    expect(describeStatus(errSecItemNotFound)).toContain("errSecItemNotFound");
    expect(describeStatus(errSecAuthFailed)).toContain("errSecAuthFailed");
    expect(describeStatus(-1)).toBe("OSStatus -1");
  });
});

const onDarwin = process.platform === "darwin";
const darwinTest = onDarwin ? test : test.skip;

describe("in-process Security.framework path (darwin only)", () => {
  darwinTest("binds", () => {
    expect(inProcessAvailable()).toBe(true);
  });

  darwinTest("an absent item is errSecItemNotFound and does NOT spawn the deputy", () => {
    // Cannot prompt, cannot leak: the name does not exist. This is the control
    // that makes any OTHER status an authorization result rather than a broken
    // query — the same query shape reaches the keychain and is answered.
    const r = readGenericPassword("zeta-absent-service-name-for-tests", { allowDeputyFallback: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(errSecItemNotFound);
      expect(r.via).toBe("in-process");
    }
  });

  darwinTest("probe reports presence and length only — never a value", () => {
    const p = probeGenericPassword("zeta-absent-service-name-for-tests");
    expect(p).toEqual({ present: false, length: 0, status: errSecItemNotFound, via: "in-process" });
    expect(Object.keys(p).sort()).toEqual(["length", "present", "status", "via"]);
  });
});

describe("non-darwin behaviour", () => {
  test("the module loads and answers on any platform", () => {
    const r = readGenericPassword("zeta-absent-service-name-for-tests");
    expect(typeof r.ok).toBe("boolean");
  });
});
