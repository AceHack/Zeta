// biometric.ts conformance — the SHARED operator-approval gate that ca.ts / machine.ts /
// publish.ts all run their sensitive ops through. EVERY test uses a FAKE door (no real Touch
// ID / Windows Hello, no `sudo`, no network). Proves: the platform detector; `requireBiometric`
// is FAIL-CLOSED when no door is injected (the "agent forgot to wire the gate" case) and
// delegates to the door otherwise; a result NEVER carries a secret.
// Run: bun test biometric.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import {
  analyzeSudoAuthChain,
  claimsBiometric,
  detectBiometricPlatform,
  establishedFactor,
  macTouchIdAuth,
  requireBiometric,
  sessionBiometric,
  type BiometricAuth,
  type BiometricResult,
  type SudoGateEffects,
  type ElevatorGate,
} from "./biometric.ts";

test("detectBiometricPlatform: darwin→touchid, win32→hello, else→unsupported", () => {
  expect(detectBiometricPlatform("darwin")).toBe("macos-touchid");
  expect(detectBiometricPlatform("win32")).toBe("windows-hello");
  expect(detectBiometricPlatform("linux")).toBe("unsupported");
});

test("requireBiometric: NO door provided -> ok:false, unsupported (FAIL-CLOSED by default)", async () => {
  const r = await requireBiometric(undefined, "Approve: anything");
  expect(r.ok).toBe(false);
  expect(r.platform).toBe("unsupported");
  expect(r.reason).toContain("fail-closed");
});

test("requireBiometric: delegates to the injected door + forwards the prompt", async () => {
  const prompts: string[] = [];
  const door: BiometricAuth = async (prompt) => {
    prompts.push(prompt);
    return { ok: true, platform: "macos-touchid" };
  };
  const r = await requireBiometric(door, "Approve: generate device key for mymac");
  expect(r.ok).toBe(true);
  expect(prompts).toEqual(["Approve: generate device key for mymac"]);
});

test("requireBiometric: a declining door yields ok:false (the gate honors the operator)", async () => {
  const door: BiometricAuth = async () => ({ ok: false, platform: "macos-touchid", reason: "declined" });
  const r = await requireBiometric(door, "Approve: sign cert");
  expect(r.ok).toBe(false);
  expect(r.reason).toBe("declined");
});

test("a BiometricResult NEVER carries a secret — it is approval-only", async () => {
  const door: BiometricAuth = async () => ({ ok: true, platform: "macos-touchid" });
  const r: BiometricResult = await requireBiometric(door, "Approve: x");
  // The shape has only ok / platform / reason — assert no key/seed-bearing field leaked in.
  const blob = JSON.stringify(r);
  expect(blob).not.toContain("ssh-ed25519");
  // Split so this test file contains no contiguous private-key header literal.
  expect(blob).not.toContain("PRIVATE" + " " + "KEY");
  expect(Object.keys(r).sort()).toEqual(["ok", "platform"]);
});

// ── sessionBiometric — the ONE-FINGERPRINT primitive ──────────────────────────────────────

test("sessionBiometric: prompts the underlying door AT MOST ONCE, replays the decision", async () => {
  let calls = 0;
  const underlying: BiometricAuth = async () => {
    calls += 1;
    return { ok: true, platform: "macos-touchid" };
  };
  const s = sessionBiometric(underlying);
  // Five sub-ops all approve through the SAME session door.
  for (let i = 0; i < 5; i++) {
    const r = await s.door(`Approve: op ${i}`);
    expect(r.ok).toBe(true);
  }
  expect(calls).toBe(1); // the HUMAN was asked exactly once
  expect(s.underlyingCalls()).toBe(1);
  expect(s.decision()?.ok).toBe(true);
});

test("sessionBiometric FAIL-CLOSED: a declined first approval poisons the session (no retry-past-refusal)", async () => {
  let calls = 0;
  const underlying: BiometricAuth = async () => {
    calls += 1;
    return { ok: false, platform: "macos-touchid", reason: "declined" };
  };
  const s = sessionBiometric(underlying);
  const first = await s.door("Approve: first");
  expect(first.ok).toBe(false);
  // A later sub-op CANNOT force a fresh prompt to get past the refusal — it replays ok:false.
  const second = await s.door("Approve: sneaky retry with a different prompt");
  expect(second.ok).toBe(false);
  expect(calls).toBe(1); // still prompted only once — the refusal stands
  expect(s.underlyingCalls()).toBe(1);
});

test("sessionBiometric FAIL-CLOSED: no underlying door -> ok:false, prompted at most once", async () => {
  const s = sessionBiometric(undefined);
  const r1 = await s.door("Approve: x");
  const r2 = await s.door("Approve: y");
  expect(r1.ok).toBe(false);
  expect(r2.ok).toBe(false);
  expect(r1.platform).toBe("unsupported");
  expect(s.underlyingCalls()).toBe(1); // requireBiometric was consulted once, then cached
});

test("sessionBiometric: a never-called session is zero-approval (NOT a silent bypass)", () => {
  const underlying: BiometricAuth = async () => ({ ok: true, platform: "macos-touchid" });
  const s = sessionBiometric(underlying);
  // Nothing called the door — so nothing was approved (each gated op would fail-closed).
  expect(s.underlyingCalls()).toBe(0);
  expect(s.decision()).toBeUndefined();
});

// ── ATTRIBUTION: `sudo` exiting 0 does not name the module that satisfied PAM ─────────────
// Regression suite for 081M06DSQ0Q087G0R000H91391. Every test describes a HOST (its PAM
// policy files + the sudo exit status) through the injected `SudoGateEffects` door — no
// real `sudo` runs, no fingerprint is required, and the assertions can therefore be wrong.

/** The stock macOS 26.5 /etc/pam.d/sudo, copied verbatim from the host this was found on. */
const STOCK_SUDO_POLICY = `auth       sufficient     pam_tid.so
# sudo: auth account password session
auth       include        sudo_local
auth       sufficient     pam_smartcard.so
auth       required       pam_opendirectory.so
account    required       pam_permit.so
password   required       pam_deny.so
session    required       pam_permit.so
`;

/** A host whose sudo chain offers Touch ID and NOTHING else — the only shape that licenses
 *  the word "biometric". Note a real machine is not configured this way by default. */
const TID_ONLY_POLICY = `auth       sufficient     pam_tid.so
account    required       pam_permit.so
session    required       pam_permit.so
`;

interface FakeHost {
  readonly fx: SudoGateEffects;
  readonly calls: { invalidated: number; authenticated: number; notices: string[] };
}

function fakeHost(
  files: Record<string, string>,
  sudoStatus: number | null,
  // Default: a host whose elevator resolved cleanly, so the pre-existing cases below keep
  // testing what they were written to test. The refusal path gets its own cases.
  elevator: ElevatorGate = { ok: true, path: "/usr/bin/sudo" },
): FakeHost {
  const calls = { invalidated: 0, authenticated: 0, notices: [] as string[] };
  const fx: SudoGateEffects = {
    readFile: (p) => {
      const body = files[p];
      if (body === undefined) throw new Error(`ENOENT ${p}`);
      return body;
    },
    elevator: () => elevator,
    invalidateTimestamp: () => {
      calls.invalidated += 1;
    },
    authenticate: () => {
      calls.authenticated += 1;
      return sudoStatus;
    },
    notify: (line) => {
      calls.notices.push(line);
    },
  };
  return { fx, calls };
}

test("analyzeSudoAuthChain: the STOCK macOS stack has competing satisfiers — pam_tid is not alone", () => {
  // The real host: /etc/pam.d/sudo exists, /etc/pam.d/sudo_local does not (only the
  // .template ships), so the `include` is an unknown chain as well.
  const a = analyzeSudoAuthChain((p) => {
    if (p === "/etc/pam.d/sudo") return STOCK_SUDO_POLICY;
    throw new Error(`ENOENT ${p}`);
  });
  expect(a.touchIdConfigured).toBe(true);
  // pam_smartcard + pam_opendirectory are `auth` entries; the account/password/session
  // lines are NOT (a chain is per function-class — pam.conf(5)).
  expect(a.competingEntries).toEqual(["sufficient pam_smartcard.so", "required pam_opendirectory.so"]);
  expect(a.unresolvedIncludes).toEqual(["sudo_local"]);
  expect(a.touchIdIsOnlySatisfier).toBe(false);
});

test("analyzeSudoAuthChain: a tid-ONLY chain is the one shape where the biometric is attributable", () => {
  const a = analyzeSudoAuthChain((p) => {
    if (p === "/etc/pam.d/sudo") return TID_ONLY_POLICY;
    throw new Error(`ENOENT ${p}`);
  });
  expect(a.touchIdConfigured).toBe(true);
  expect(a.competingEntries).toEqual([]);
  expect(a.unresolvedIncludes).toEqual([]);
  expect(a.touchIdIsOnlySatisfier).toBe(true);
});

test("analyzeSudoAuthChain: an UNREADABLE include is unknown, never empty (fail-closed on attribution)", () => {
  const withInclude = `auth sufficient pam_tid.so
auth include sudo_local
`;
  const a = analyzeSudoAuthChain((p) => {
    if (p === "/etc/pam.d/sudo") return withInclude;
    throw new Error(`ENOENT ${p}`); // sudo_local absent — exactly the stock host's state
  });
  expect(a.touchIdConfigured).toBe(true);
  expect(a.competingEntries).toEqual([]); // nothing readable competes…
  expect(a.unresolvedIncludes).toEqual(["sudo_local"]); // …but the chain is not known
  expect(a.touchIdIsOnlySatisfier).toBe(false); // so the biometric is NOT attributable
});

test("analyzeSudoAuthChain: a RESOLVED include splices the other chain in (pam.conf(5))", () => {
  const a = analyzeSudoAuthChain((p) => {
    if (p === "/etc/pam.d/sudo") return "auth sufficient pam_tid.so\nauth include sudo_local\n";
    if (p === "/etc/pam.d/sudo_local") return "auth sufficient pam_smartcard.so\n";
    throw new Error(`ENOENT ${p}`);
  });
  expect(a.competingEntries).toEqual(["sufficient pam_smartcard.so"]);
  expect(a.unresolvedIncludes).toEqual([]);
  expect(a.touchIdIsOnlySatisfier).toBe(false);
});

test("analyzeSudoAuthChain: a self-including policy terminates instead of hanging", () => {
  const a = analyzeSudoAuthChain(() => "auth sufficient pam_tid.so\nauth include sudo\n");
  expect(a.touchIdIsOnlySatisfier).toBe(false);
  expect(a.unresolvedIncludes).toEqual(["sudo"]);
});

test("analyzeSudoAuthChain: comments are stripped — a commented-out module is not a satisfier", () => {
  // pam.conf(5): "anything to the right of a '#' sign" is a comment — with or without a
  // space before it. The no-space form is what discriminates: unstripped, the module name
  // reads as `pam_x.so#disabled-2026-08` and the entry is misreported.
  const a = analyzeSudoAuthChain(
    () =>
      "auth sufficient pam_tid.so\n" +
      "# auth sufficient pam_smartcard.so\n" +
      "auth required pam_x.so#disabled-2026-08\n",
  );
  expect(a.competingEntries).toEqual(["required pam_x.so"]);
});

test("analyzeSudoAuthChain: pam_tid under a NON-sufficient control flag is not counted", () => {
  // Deliberately conservative, and deliberately a FALSE NEGATIVE rather than a false
  // positive: only `auth sufficient pam_tid.so` counts, which is exactly the precondition
  // the gate has always enforced. A `required` pam_tid chain would arguably be a stronger
  // biometric guarantee; claiming it here would be reasoning past what was measured, so
  // the gate fails closed and the operator configures the documented form.
  const a = analyzeSudoAuthChain(() => "auth required pam_tid.so\n");
  expect(a.touchIdConfigured).toBe(false);
  expect(a.touchIdIsOnlySatisfier).toBe(false);
});

test("analyzeSudoAuthChain: an ABSENT policy file reports no Touch ID (not a silent pass)", () => {
  const a = analyzeSudoAuthChain(() => {
    throw new Error("ENOENT");
  });
  expect(a.touchIdConfigured).toBe(false);
  expect(a.touchIdIsOnlySatisfier).toBe(false);
});

test("THE BUG: on the stock stack a successful sudo is ok:true but factor UNATTRIBUTED", () => {
  const { fx, calls } = fakeHost({ "/etc/pam.d/sudo": STOCK_SUDO_POLICY }, 0);
  const r = macTouchIdAuth("Approve: sign persona cert", fx);
  expect(r.ok).toBe(true); // the approval is real and is NOT weakened
  expect(r.factor).toBe("unattributed"); // …but it is not attributable to a fingerprint
  expect(claimsBiometric(r)).toBe(false); // ← the assertion the old code would fail
  // The competing module is NAMED, so an operator can see what to harden.
  expect(r.reason).toContain("pam_smartcard.so");
  expect(r.reason).toContain("pam_opendirectory.so");
  expect(calls.invalidated).toBe(1); // still no timestamp reuse
  expect(calls.authenticated).toBe(1);
});

test("a smart card, not a finger, is the sharpest instance — the FROST lane plugs one in", () => {
  // A host with a reader attached and Touch ID declined still exits 0 through pam_smartcard.
  const { fx } = fakeHost({ "/etc/pam.d/sudo": STOCK_SUDO_POLICY }, 0);
  const r = macTouchIdAuth("Approve: FROST share seal", fx);
  // Nothing here can tell the two apart — which is precisely why the claim must not be made.
  expect(claimsBiometric(r)).toBe(false);
  expect(establishedFactor(r)).toBe("unattributed");
});

test("a tid-ONLY chain DOES license the biometric claim (the guard is not vacuously false)", () => {
  const { fx } = fakeHost({ "/etc/pam.d/sudo": TID_ONLY_POLICY }, 0);
  const r = macTouchIdAuth("Approve: sign persona cert", fx);
  expect(r.ok).toBe(true);
  expect(r.factor).toBe("biometric");
  expect(claimsBiometric(r)).toBe(true);
  expect(r.reason).toBeUndefined();
});

test("no pam_tid ⇒ sudo is NEVER RUN (fail-closed before the password path opens)", () => {
  const { fx, calls } = fakeHost({ "/etc/pam.d/sudo": "auth required pam_opendirectory.so\n" }, 0);
  const r = macTouchIdAuth("Approve: x", fx);
  expect(r.ok).toBe(false);
  expect(r.factor).toBe("none");
  expect(claimsBiometric(r)).toBe(false);
  expect(calls.authenticated).toBe(0); // the transaction never happened
  expect(calls.invalidated).toBe(0);
});

test("a declined / failed sudo is ok:false with factor none, on every chain shape", () => {
  for (const policy of [STOCK_SUDO_POLICY, TID_ONLY_POLICY]) {
    const { fx } = fakeHost({ "/etc/pam.d/sudo": policy }, 1);
    const r = macTouchIdAuth("Approve: x", fx);
    expect(r.ok).toBe(false);
    expect(r.factor).toBe("none");
    expect(claimsBiometric(r)).toBe(false);
  }
});

test("a sudo killed by a signal (status null) is a failure, not a pass", () => {
  const { fx } = fakeHost({ "/etc/pam.d/sudo": TID_ONLY_POLICY }, null);
  const r = macTouchIdAuth("Approve: x", fx);
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("signal");
});

// ── THE PATH-SHIM P1 (docs/BUGS.md, 2026-08-24) ─────────────────────────────────────────
// The gate used to establish approval as `spawnSync("sudo", ["-p","","true"]).status === 0`
// with `sudo` resolved through `PATH`. A file named `sudo` earlier on `PATH`, executing
// nothing and exiting 0, returned `ok:true` with no Touch ID prompt and no human. It needed
// no root and left NO GIT DIFF, so review, AgencySignature and byte-lock could not see it.
// These are the falsifiers: each one goes red if the elevator check is removed.

test("P1: an UNRESOLVABLE elevator refuses the gate — and spawns NOTHING", () => {
  const { fx, calls } = fakeHost({ "/etc/pam.d/sudo": TID_ONLY_POLICY }, 0, {
    ok: false,
    reason: "no usable 'sudo' found at an allowlisted absolute path",
  });
  const r = macTouchIdAuth("Approve: sign persona cert", fx);
  expect(r.ok).toBe(false);
  expect(r.factor).toBe("none");
  expect(r.reason).toContain("refused to run");
  // The sharp part: a status-0 shim cannot help, because nothing is ever spawned.
  expect(calls.authenticated).toBe(0);
  expect(calls.invalidated).toBe(0);
});

test("P1: the elevator is checked BEFORE the PAM chain — an unreadable /etc cannot mask it", () => {
  // No policy files at all: `readFile` throws. The elevator refusal must still be the
  // reason reported, which pins the ordering rather than trusting it.
  const { fx } = fakeHost({}, 0, { ok: false, reason: "elevator gone" });
  const r = macTouchIdAuth("Approve: x", fx);
  expect(r.ok).toBe(false);
  expect(r.reason).toContain("elevator gone");
});

test("P1: a resolved elevator still has to satisfy PAM — resolution is not approval", () => {
  const { fx } = fakeHost({ "/etc/pam.d/sudo": TID_ONLY_POLICY }, 1, {
    ok: true,
    path: "/usr/bin/sudo",
  });
  const r = macTouchIdAuth("Approve: x", fx);
  expect(r.ok).toBe(false);
  expect(r.factor).toBe("none");
});

test("P1: the refusal reason names WHY, so an operator can act on it", () => {
  const { fx } = fakeHost({ "/etc/pam.d/sudo": TID_ONLY_POLICY }, 0, {
    ok: false,
    reason: "no usable 'sudo' … /usr/bin/sudo (not root-owned (uid 501))",
  });
  const r = macTouchIdAuth("Approve: x", fx);
  expect(r.reason).toContain("not root-owned");
});

test("macTouchIdAuth NEVER carries a secret and adds no key-bearing field", () => {
  const { fx } = fakeHost({ "/etc/pam.d/sudo": TID_ONLY_POLICY }, 0);
  const r = macTouchIdAuth("Approve: x", fx);
  expect(Object.keys(r).sort()).toEqual(["factor", "ok", "platform"]);
  const blob = JSON.stringify(r);
  expect(blob).not.toContain("ssh-ed25519");
  expect(blob).not.toContain("PRIVATE" + " " + "KEY");
});

// ── establishedFactor / claimsBiometric — the refusal-to-round-up ─────────────────────────

test("establishedFactor: an ok:true result that DECLARES NO FACTOR reads as unattributed", () => {
  // This is the shape every existing caller and test fixture produces. It must never be
  // rounded up to "biometric" — an undeclared factor is exactly the unmeasured claim.
  const r: BiometricResult = { ok: true, platform: "macos-touchid" };
  expect(establishedFactor(r)).toBe("unattributed");
  expect(claimsBiometric(r)).toBe(false);
});

test("establishedFactor: platform macos-touchid alone NEVER licenses the biometric claim", () => {
  expect(claimsBiometric({ ok: true, platform: "macos-touchid", factor: "unattributed" })).toBe(false);
  expect(claimsBiometric({ ok: true, platform: "macos-touchid", factor: "none" })).toBe(false);
  expect(claimsBiometric({ ok: true, platform: "macos-touchid", factor: "biometric" })).toBe(true);
});

test("establishedFactor: ok:false is 'none' even when a factor is declared (no lift past a refusal)", () => {
  const r: BiometricResult = { ok: false, platform: "macos-touchid", factor: "biometric", reason: "declined" };
  expect(establishedFactor(r)).toBe("none");
  expect(claimsBiometric(r)).toBe(false);
});
