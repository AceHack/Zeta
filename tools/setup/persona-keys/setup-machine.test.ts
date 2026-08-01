// setup-machine.ts conformance — the ONE-command, ONE-fingerprint machine setup. EVERY test
// runs against FIXTURES for all sub-modules — NEVER a real biometric prompt, NEVER real keygen,
// NEVER a real CA/cert, NEVER a network call, NEVER a secret. Proves the one-fingerprint
// contract (PURE-KEY MODEL: no GitHub publish — the user × machine binding is the CA cert):
//   * ONE human approval covers the WHOLE sequence (machine keygen + realize-CA + cert-sign) —
//     the underlying biometric door fires EXACTLY ONCE;
//   * FAIL-CLOSED — a DECLINED approval poisons the session: NOTHING runs (no CA, no key, no
//     cert), and the human is still prompted only once (no retry-past-refusal);
//   * AUTO-CERT + REALIZE-CA-WHEN-MISSING — when a CA is configured the cert is signed against
//     it (CA NOT re-created, idempotent); when NO local CA exists, setup REALIZES one (under the
//     SAME one approval) then signs; when NO CA door is wired at all, the cert is cleanly omitted;
//   * --dry-run is end-to-end inert: the human door is NEVER called; nothing realized/generated/
//     signed; the plan shows "would realize a new local CA".
// Run: bun test setup-machine.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import type { MachineEffects } from "./machine.ts";
import type { GithubTrustEffects } from "./github-trust.ts";
import type { CaEffects } from "./ca.ts";
import { sessionBiometric, type BiometricAuth } from "./biometric.ts";
import type { OnboardEffects } from "./onboard.ts";
import { resolveCaDisposition } from "./ca.ts";
import { setupMachine, formatSetupMachine, type SetupMachineOptions } from "./setup-machine.ts";

const PUB = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDwJVbQNiFzUCiOhc mymac (zeta-machine)";
const CERT = "ssh-ed25519-cert-v01@openssh.com AAAAI" + "cert-public-text aaron@mymac";

/** A counting underlying biometric door — records every HUMAN-facing prompt so a test can
 *  assert it fired exactly once (the one-fingerprint property). Returns `ok` per the fixture. */
function countingDoor(ok: boolean, reason?: string): { door: BiometricAuth; prompts: () => string[] } {
  const prompts: string[] = [];
  const door: BiometricAuth = async (prompt: string) => {
    prompts.push(prompt);
    return ok
      ? { ok: true, platform: "macos-touchid" }
      : { ok: false, platform: "macos-touchid", ...(reason !== undefined ? { reason } : {}) };
  };
  return { door, prompts: () => prompts };
}

/** Build the full OnboardEffects with the SESSION door woven into every gated effect, exactly
 *  as the CLI does — so the test exercises the real one-approval wiring.
 *
 *  The CA fake is STATEFUL so the realize-CA-when-missing path is honest: `caPreExists` seeds
 *  whether the CA private key is present BEFORE the run. `ca.exists` returns true for the device
 *  pubkey always (so a cert can sign) and for the CA private key only once it pre-existed OR was
 *  realized (genCa flips it on) — so ensureCa's idempotent `exists` no-op and signMachineCert's
 *  fail-closed `no-ca` check both behave like the real fs. `caGenCalls` counts realizations;
 *  `wireCa` controls whether the CA DOOR is present at all (no door ⇒ legacy clean skip). */
function fixture(opts: {
  sessionDoor: BiometricAuth;
  caPreExists?: boolean;
  wireCa?: boolean;
}): {
  fx: OnboardEffects;
  genCalls: () => number;
  signCalls: () => number;
  caGenCalls: () => number;
} {
  let genCalls = 0;
  let signCalls = 0;
  let caGenCalls = 0;
  let caPresent = opts.caPreExists === true;
  const wireCa = opts.wireCa !== false; // default: CA door wired (matches the real CLI)

  const machine: MachineEffects = {
    hostname: () => "mymac",
    exists: () => false, // nothing exists yet (fresh box) → keygen path
    readText: () => PUB + "\n",
    writeText: () => {},
    mkdirp: () => {},
    genEd25519: () => {
      genCalls += 1;
      return PUB + "\n";
    },
  };
  const trust: GithubTrustEffects = {
    exists: () => false,
    readText: () => "",
    listDir: () => [],
    fetchKeys: async () => "",
    fetchGpg: async () => "",
  };
  const ca: CaEffects = {
    // CA private key present only once realized/pre-existing; the device pubkey (any other path)
    // is treated as present so the cert can be signed once a CA exists.
    exists: (path: string) => (path.endsWith("ssh_ca_ed25519") ? caPresent : true),
    readText: () => "ssh-ed25519 AAAACA-pub ca\n",
    writeText: () => {},
    mkdirp: () => {},
    genCa: () => {
      caGenCalls += 1;
      caPresent = true; // realized: the CA private key now exists (idempotent on re-run)
      return "ssh-ed25519 AAAACA-pub ca\n";
    },
    signCert: () => {
      signCalls += 1;
      return { certPath: "/tmp/x-cert.pub", certText: CERT };
    },
  };

  const fx: OnboardEffects = {
    machine,
    trust,
    biometricAuth: opts.sessionDoor,
    ...(wireCa ? { ca } : {}),
  };
  return {
    fx,
    genCalls: () => genCalls,
    signCalls: () => signCalls,
    caGenCalls: () => caGenCalls,
  };
}

const baseOpts = (over: Partial<SetupMachineOptions> = {}): SetupMachineOptions => ({
  user: "aaron",
  repoRoot: "/repo",
  home: "/home/aaron",
  caConfigured: false,
  ...over,
});

test("CA present: ONE human approval covers keygen + cert-sign; CA NOT re-created (idempotent)", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caPreExists: true });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: true }));

  // The single human approval covered keygen + cert-sign.
  expect(prompts().length).toBe(1);
  expect(res.biometricApprovals).toBe(1);
  expect(res.approval?.ok).toBe(true);
  // Both gated sub-ops actually ran under that one approval.
  expect(f.genCalls()).toBe(1); // machine keygen
  expect(f.signCalls()).toBe(1); // cert-sign
  // IDEMPOTENT: a pre-existing CA is NOT realized again (no genCa, no caRealized record).
  expect(f.caGenCalls()).toBe(0);
  expect(res.caRealized).toBeUndefined();
  expect(res.onboard.machine.action).toBe("generated");
  expect(res.onboard.cert?.action).toBe("signed");
});

test("REALIZE-CA-WHEN-MISSING: no local CA ⇒ CA realized + machine key + cert, ALL under ONE approval", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caPreExists: false });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: false }));

  // The HUMAN door fired EXACTLY ONCE for the whole sequence (keygen + realize-CA + cert-sign).
  expect(prompts().length).toBe(1);
  expect(res.biometricApprovals).toBe(1);
  expect(res.approval?.ok).toBe(true);
  // The CA was realized (not skipped), and the cert was signed against it.
  expect(f.caGenCalls()).toBe(1); // CA realized
  expect(res.caRealized?.action).toBe("generated");
  expect(f.genCalls()).toBe(1); // machine keygen
  expect(f.signCalls()).toBe(1); // cert-sign now runs (was a skip before)
  expect(res.certRequested).toBe(true);
  expect(res.onboard.machine.action).toBe("generated");
  expect(res.onboard.cert?.action).toBe("signed");
  // The readout names the realize + the deferred join case.
  const out = formatSetupMachine(res);
  expect(out).toContain("realized a new local CA");
  expect(out).toContain("JOINING an existing");
});

test("FAIL-CLOSED: a DECLINED approval poisons the session — NOTHING realized/generated/signed, prompted once", async () => {
  const { door, prompts } = countingDoor(false, "declined by operator");
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caPreExists: false });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: false }));

  // The human was prompted exactly once (no retry-past-refusal), and it was a refusal.
  expect(prompts().length).toBe(1);
  expect(res.biometricApprovals).toBe(1);
  expect(res.approval?.ok).toBe(false);
  // NOTHING ran: no CA realized, no keygen, no cert.
  expect(f.caGenCalls()).toBe(0);
  expect(f.genCalls()).toBe(0);
  expect(f.signCalls()).toBe(0);
  expect(res.caRealized?.action).toBe("aborted-biometric");
  expect(res.onboard.machine.action).toBe("aborted-biometric");
});

test("no CA DOOR at all ⇒ legacy clean skip: cert omitted, NOTHING realized", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, wireCa: false });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: false }));

  expect(prompts().length).toBe(1); // still one approval (the keygen)
  expect(res.certRequested).toBe(false);
  expect(res.caRealized).toBeUndefined();
  expect(res.onboard.cert).toBeUndefined();
  expect(f.caGenCalls()).toBe(0);
  expect(f.signCalls()).toBe(0);
  expect(res.onboard.machine.action).toBe("generated");
});

test("--dry-run is inert: human door NEVER called; nothing realized/generated/signed; plan shows would-realize", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caPreExists: false });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: false, dryRun: true }));

  expect(prompts().length).toBe(0); // NO prompt on dry-run
  expect(res.biometricApprovals).toBe(0);
  expect(f.caGenCalls()).toBe(0);
  expect(f.genCalls()).toBe(0);
  expect(f.signCalls()).toBe(0);
  expect(res.onboard.dryRun).toBe(true);
  expect(res.caRealized?.action).toBe("would-generate");
  const out = formatSetupMachine(res);
  expect(out).toContain("DRY RUN");
  expect(out).toContain("would realize a new local CA");
});

test("formatSetupMachine reports the one-fingerprint count on a real run", async () => {
  const { door } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caPreExists: true });
  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: true }));
  expect(formatSetupMachine(res)).toContain("1 human approval(s)");
});

// ── CLUSTER-MEMBERSHIP ROUTING (the previously-deferred JOIN case) ────────────────────────
// "no local CA ⇒ realize one" is WRONG for a host joining a cluster whose CA lives elsewhere:
// it mints a SECOND CA and SPLITS the trust root. With a `caDisposition` of "route" nothing is
// realized and nothing is signed here — the cert is routed to the CA holder. (Aaron 2026-06-21.)

test("JOIN-CLUSTER routes: trust root elsewhere, no local CA → NO 2nd CA fabricated, cert routed", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const disp = resolveCaDisposition({
    localCaPrivateExists: false,
    committedTrustRoots: ["zeta"],
    home: "/home/aaron",
  });
  expect(disp.disposition).toBe("route");
  // On route the real CLI wires NO CA door — mirror that here.
  const f = fixture({ sessionDoor: session.door, caPreExists: false, wireCa: false });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: false, caDisposition: disp }));

  // The machine key is still realized under the one approval, but NO CA and NO cert here.
  expect(prompts().length).toBe(1);
  expect(f.genCalls()).toBe(1); // machine key still realized
  expect(f.caGenCalls()).toBe(0); // NO second CA fabricated
  expect(f.signCalls()).toBe(0); // cert routed, not signed here
  expect(res.caRealized).toBeUndefined();
  expect(res.certRequested).toBe(false);
  expect(res.caRouted?.trustRoots).toEqual(["zeta"]);
  expect(res.caRouted?.instruction).toContain("on the CA holder");
  const out = formatSetupMachine(res);
  expect(out).toContain("NOT realized here");
  expect(out).toContain("SPLIT the trust root");
});

test("JOIN-CLUSTER route: even WITH a CA door wired, route realizes/signs NOTHING (fail-safe)", async () => {
  const { door } = countingDoor(true);
  const session = sessionBiometric(door);
  const disp = resolveCaDisposition({
    localCaPrivateExists: false,
    committedTrustRoots: ["zeta", "acme"],
    home: "/home/aaron",
  });
  // Belt-and-braces: a caller that wires the CA door anyway must STILL not fabricate or sign.
  const f = fixture({ sessionDoor: session.door, caPreExists: false, wireCa: true });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: false, caDisposition: disp }));

  expect(f.caGenCalls()).toBe(0);
  expect(f.signCalls()).toBe(0);
  expect(res.caRouted?.trustRoots).toEqual(["zeta", "acme"]);
});

test("no caDisposition supplied → legacy present/realize behaviour is unchanged (realize)", async () => {
  const { door } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caPreExists: false });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: false }));

  expect(f.caGenCalls()).toBe(1); // still realizes, exactly as before
  expect(res.caRealized?.action).toBe("generated");
  expect(res.caRouted).toBeUndefined();
});
