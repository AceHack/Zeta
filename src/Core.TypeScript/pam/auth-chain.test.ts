/**
 * src/Core.TypeScript/pam/auth-chain.test.ts
 *
 * Runs on ANY OS (bun test). Every host's PAM stack is DESCRIBED through the injected
 * `read` door — no /etc is touched, no root is needed, no fingerprint is presented.
 *
 * The load-bearing case is `linux-pam @include`: read with the OpenPAM dialect, Debian's
 * /etc/pam.d/sudo resolves to an EMPTY chain and reports the target as the only possible
 * satisfier. That is a false attribution, and it is the reason this parser is shared
 * rather than copied.
 */
import { describe, expect, test } from "bun:test";
import { analyzePamAuthChain } from "./auth-chain.ts";

/** Build a `read` door over a described filesystem; absent paths THROW, as PAM's would. */
function fs(files: Readonly<Record<string, string>>): (path: string) => string {
  return (path) => {
    const text = files[path];
    if (text === undefined) throw new Error(`ENOENT: ${path}`);
    return text;
  };
}

const STOCK_MACOS_SUDO = [
  "auth       sufficient     pam_tid.so",
  "auth       include        sudo_local",
  "auth       sufficient     pam_smartcard.so",
  "auth       required       pam_opendirectory.so",
  "account    required       pam_permit.so",
].join("\n");

/** Debian/Ubuntu: sudo is little more than `@include common-auth`. */
const DEBIAN_SUDO = ["#%PAM-1.0", "", "@include common-auth", "@include common-account"].join("\n");

const DEBIAN_COMMON_AUTH_WITH_FPRINTD = [
  "auth\t[success=2 default=ignore]\tpam_fprintd.so max_tries=3",
  "auth\t[success=1 default=ignore]\tpam_unix.so nullok",
  "auth\trequisite\t\t\tpam_deny.so",
  "auth\trequired\t\t\tpam_permit.so",
].join("\n");

describe("openpam dialect (macOS) — the behaviour analyzeSudoAuthChain always had", () => {
  test("the stock stack has competing satisfiers, so pam_tid is not alone", () => {
    const a = analyzePamAuthChain(
      fs({ "/etc/pam.d/sudo": STOCK_MACOS_SUDO, "/etc/pam.d/sudo_local": "" }),
      { targetModule: "pam_tid.so" },
    );
    expect(a.targetConfigured).toBe(true);
    expect(a.targetIsOnlySatisfier).toBe(false);
    expect(a.competingEntries).toContain("sufficient pam_smartcard.so");
    expect(a.competingEntries).toContain("required pam_opendirectory.so");
  });

  test("a target-ONLY chain is the one shape that licenses the attribution", () => {
    const a = analyzePamAuthChain(fs({ "/etc/pam.d/sudo": "auth sufficient pam_tid.so\n" }), {
      targetModule: "pam_tid.so",
    });
    expect(a.targetIsOnlySatisfier).toBe(true);
  });

  test("an UNREADABLE include is unknown, never empty", () => {
    const a = analyzePamAuthChain(
      fs({ "/etc/pam.d/sudo": "auth sufficient pam_tid.so\nauth include sudo_local\n" }),
      { targetModule: "pam_tid.so" },
    );
    expect(a.unresolvedIncludes).toEqual(["sudo_local"]);
    expect(a.targetIsOnlySatisfier).toBe(false);
  });

  test("a self-including policy terminates instead of hanging", () => {
    const a = analyzePamAuthChain(() => "auth sufficient pam_tid.so\nauth include sudo\n", {
      targetModule: "pam_tid.so",
    });
    expect(a.unresolvedIncludes).toEqual(["sudo"]);
  });

  test("`substack` is Linux-PAM only — under OpenPAM it is a module entry, not a splice", () => {
    const read = fs({
      "/etc/pam.d/sudo": "auth sufficient pam_tid.so\nauth substack other\n",
      "/etc/pam.d/other": "auth required pam_unix.so\n",
    });
    const openpam = analyzePamAuthChain(read, { targetModule: "pam_tid.so" });
    expect(openpam.competingEntries).toEqual(["substack other"]);
    expect(openpam.unresolvedIncludes).toEqual([]);

    const linux = analyzePamAuthChain(read, { targetModule: "pam_tid.so", syntax: "linux-pam" });
    expect(linux.competingEntries).toEqual(["required pam_unix.so"]);
  });

  test("`@include` is NOT honoured under OpenPAM (the host does not define it)", () => {
    const a = analyzePamAuthChain(
      fs({
        "/etc/pam.d/sudo": "auth sufficient pam_tid.so\n@include common-auth\n",
        "/etc/pam.d/common-auth": "auth required pam_unix.so\n",
      }),
      { targetModule: "pam_tid.so" },
    );
    expect(a.competingEntries).toEqual([]);
    expect(a.targetIsOnlySatisfier).toBe(true);
  });
});

describe("linux-pam dialect — the dialect gap that would have produced a false claim", () => {
  test("THE GAP: Debian's sudo read as OpenPAM resolves to an empty chain and over-claims", () => {
    const read = fs({
      "/etc/pam.d/sudo": ["#%PAM-1.0", "@include common-auth"].join("\n"),
      "/etc/pam.d/common-auth": DEBIAN_COMMON_AUTH_WITH_FPRINTD,
    });

    // Wrong dialect: `@include` is skipped, the chain looks empty, and because
    // pam_fprintd was never seen the target is not configured either — an equally
    // wrong answer in the other direction. Either way the parse is fiction.
    const wrong = analyzePamAuthChain(read, { targetModule: "pam_fprintd.so" });
    expect(wrong.competingEntries).toEqual([]);
    expect(wrong.targetConfigured).toBe(false);

    // Right dialect: the chain is spliced in and pam_unix.so is visible as a competing
    // satisfier, so a successful sudo cannot be attributed to the fingerprint.
    const right = analyzePamAuthChain(read, {
      targetModule: "pam_fprintd.so",
      syntax: "linux-pam",
      targetControlFlags: ["[success=2 default=ignore]"],
    });
    expect(right.targetConfigured).toBe(true);
    expect(right.competingEntries).toContain("[success=1 default=ignore] pam_unix.so");
    expect(right.targetIsOnlySatisfier).toBe(false);
  });

  test("a bracketed control flag keeps the MODULE in the module position", () => {
    const a = analyzePamAuthChain(
      fs({ "/etc/pam.d/sudo": "auth [success=1 default=ignore] pam_unix.so nullok\n" }),
      { targetModule: "pam_fprintd.so", syntax: "linux-pam" },
    );
    // A naive whitespace split files this as `[success=1 default=ignore]` — the password
    // module would go unrecognised under a garbage name.
    expect(a.competingEntries).toEqual(["[success=1 default=ignore] pam_unix.so"]);
  });

  test("the leading `-` on a function class is stripped (still an auth entry)", () => {
    const a = analyzePamAuthChain(fs({ "/etc/pam.d/sudo": "-auth optional pam_foo.so\n" }), {
      targetModule: "pam_fprintd.so",
      syntax: "linux-pam",
    });
    expect(a.competingEntries).toEqual(["optional pam_foo.so"]);
  });

  test("line continuations are joined before the rule is read", () => {
    const a = analyzePamAuthChain(
      fs({ "/etc/pam.d/sudo": "auth \\\n  required \\\n  pam_unix.so\n" }),
      { targetModule: "pam_fprintd.so", syntax: "linux-pam" },
    );
    expect(a.competingEntries).toEqual(["required pam_unix.so"]);
  });

  test("a comment opened on the first physical line swallows the continuation", () => {
    // PAM joins continuations first, then strips from `#`. Reading the second physical
    // line as a fresh rule would invent an entry the host never evaluates.
    const a = analyzePamAuthChain(
      fs({ "/etc/pam.d/sudo": "# auth sufficient \\\n pam_fprintd.so\n" }),
      { targetModule: "pam_fprintd.so", syntax: "linux-pam" },
    );
    expect(a.targetConfigured).toBe(false);
    expect(a.competingEntries).toEqual([]);
  });

  test("a malformed @include is unresolved, not ignored", () => {
    const a = analyzePamAuthChain(fs({ "/etc/pam.d/sudo": "@include\n" }), {
      targetModule: "pam_fprintd.so",
      syntax: "linux-pam",
    });
    expect(a.unresolvedIncludes).toEqual(["sudo (malformed @include)"]);
    expect(a.targetIsOnlySatisfier).toBe(false);
  });

  test("Debian's sudo with an unreadable common-auth is unknown, never a clean chain", () => {
    const a = analyzePamAuthChain(fs({ "/etc/pam.d/sudo": DEBIAN_SUDO }), {
      targetModule: "pam_fprintd.so",
      syntax: "linux-pam",
    });
    expect(a.unresolvedIncludes).toEqual(["common-auth", "common-account"]);
    expect(a.targetIsOnlySatisfier).toBe(false);
  });
});

describe("shared invariants", () => {
  test("an ABSENT policy file reports nothing configured (not a silent pass)", () => {
    const a = analyzePamAuthChain(
      () => {
        throw new Error("ENOENT");
      },
      { targetModule: "pam_fprintd.so", syntax: "linux-pam" },
    );
    expect(a.targetConfigured).toBe(false);
    expect(a.targetIsOnlySatisfier).toBe(false);
    expect(a.unresolvedIncludes).toEqual(["sudo"]);
  });

  test("the target under a NON-accepted control flag is not counted as configured", () => {
    const a = analyzePamAuthChain(fs({ "/etc/pam.d/sudo": "auth required pam_tid.so\n" }), {
      targetModule: "pam_tid.so",
    });
    expect(a.targetConfigured).toBe(false);
    // Nor is it laundered into the competing list under its own name.
    expect(a.competingEntries).toEqual([]);
    expect(a.targetIsOnlySatisfier).toBe(false);
  });

  test("a fully-qualified module path is matched on its basename", () => {
    const a = analyzePamAuthChain(
      fs({ "/etc/pam.d/sudo": "auth sufficient /usr/lib/security/pam_fprintd.so\n" }),
      { targetModule: "pam_fprintd.so", syntax: "linux-pam" },
    );
    expect(a.targetConfigured).toBe(true);
    expect(a.targetIsOnlySatisfier).toBe(true);
  });

  test("`maxDepth` truncation is REPORTED as unresolved, not silently accepted", () => {
    // Each service includes the next, so no cycle guard fires — only the depth bound.
    const read = (path: string): string => {
      const svc = path.split("/").pop() ?? "";
      return `auth include ${svc}x\n`;
    };
    const a = analyzePamAuthChain(read, { targetModule: "pam_tid.so", maxDepth: 3 });
    expect(a.unresolvedIncludes.length).toBe(1);
    expect(a.targetIsOnlySatisfier).toBe(false);
  });

  test("`pamDir` is injectable, so a test never depends on /etc existing", () => {
    const a = analyzePamAuthChain(fs({ "/fake/pam.d/sudo": "auth sufficient pam_tid.so\n" }), {
      targetModule: "pam_tid.so",
      pamDir: "/fake/pam.d",
    });
    expect(a.targetIsOnlySatisfier).toBe(true);
  });

  test("non-auth classes are ignored — an account/session module is not a satisfier", () => {
    const a = analyzePamAuthChain(
      fs({
        "/etc/pam.d/sudo": [
          "auth sufficient pam_fprintd.so",
          "account required pam_unix.so",
          "session required pam_limits.so",
          "password required pam_deny.so",
        ].join("\n"),
      }),
      { targetModule: "pam_fprintd.so", syntax: "linux-pam" },
    );
    expect(a.competingEntries).toEqual([]);
    expect(a.targetIsOnlySatisfier).toBe(true);
  });
});
