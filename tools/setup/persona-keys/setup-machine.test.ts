// setup-machine.ts conformance — the ONE-command, ONE-fingerprint machine setup. EVERY test
// runs against FIXTURES for all sub-modules — NEVER a real biometric prompt, NEVER real keygen,
// NEVER a real CA/cert, NEVER a network call, NEVER a secret. Proves the one-fingerprint
// contract (PURE-KEY MODEL: no GitHub publish — the user × machine binding is the CA cert):
//   * ONE human approval covers the WHOLE sequence (machine keygen + cert-sign) — the
//     underlying biometric door fires EXACTLY ONCE;
//   * FAIL-CLOSED — a DECLINED approval poisons the session: NOTHING runs (no key, no cert),
//     and the human is still prompted only once (no retry-past-refusal);
//   * AUTO-CERT — when a CA is configured the cert step runs under the SAME one approval; when
//     not, it is cleanly omitted;
//   * --dry-run is end-to-end inert: the human door is NEVER called; nothing generated/signed.
// Run: bun test setup-machine.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import type { MachineEffects } from "./machine.ts";
import type { GithubTrustEffects } from "./github-trust.ts";
import type { CaEffects } from "./ca.ts";
import { sessionBiometric, type BiometricAuth } from "./biometric.ts";
import type { OnboardEffects } from "./onboard.ts";
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
 *  as the CLI does — so the test exercises the real one-approval wiring. */
function fixture(opts: {
  sessionDoor: BiometricAuth;
  caConfigured?: boolean;
}): { fx: OnboardEffects; genCalls: () => number; signCalls: () => number } {
  let genCalls = 0;
  let signCalls = 0;

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
    exists: () => true, // CA private + device pubkey present → cert can be signed
    readText: () => "ssh-ed25519 AAAACA-pub ca\n",
    writeText: () => {},
    mkdirp: () => {},
    genCa: () => "ssh-ed25519 AAAACA-pub ca\n",
    signCert: () => {
      signCalls += 1;
      return { certPath: "/tmp/x-cert.pub", certText: CERT };
    },
  };

  const fx: OnboardEffects = {
    machine,
    trust,
    biometricAuth: opts.sessionDoor,
    ...(opts.caConfigured ? { ca } : {}),
  };
  return { fx, genCalls: () => genCalls, signCalls: () => signCalls };
}

const baseOpts = (over: Partial<SetupMachineOptions> = {}): SetupMachineOptions => ({
  user: "aaron",
  repoRoot: "/repo",
  home: "/home/aaron",
  caConfigured: false,
  ...over,
});

test("one fingerprint: the HUMAN biometric door fires EXACTLY ONCE for the whole run", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caConfigured: true });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: true }));

  // The single human approval covered keygen + cert-sign.
  expect(prompts().length).toBe(1);
  expect(res.biometricApprovals).toBe(1);
  expect(res.approval?.ok).toBe(true);
  // Both gated sub-ops actually ran under that one approval.
  expect(f.genCalls()).toBe(1); // machine keygen
  expect(f.signCalls()).toBe(1); // cert-sign
  expect(res.onboard.machine.action).toBe("generated");
  expect(res.onboard.cert?.action).toBe("signed");
});

test("FAIL-CLOSED: a DECLINED approval poisons the session — NOTHING runs, prompted once", async () => {
  const { door, prompts } = countingDoor(false, "declined by operator");
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caConfigured: true });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: true }));

  // The human was prompted exactly once (no retry-past-refusal), and it was a refusal.
  expect(prompts().length).toBe(1);
  expect(res.biometricApprovals).toBe(1);
  expect(res.approval?.ok).toBe(false);
  // NOTHING ran: no keygen, no cert.
  expect(f.genCalls()).toBe(0);
  expect(f.signCalls()).toBe(0);
  expect(res.onboard.machine.action).toBe("aborted-biometric");
});

test("auto-cert omitted cleanly when no CA is configured (no flag, no error)", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caConfigured: false });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: false }));

  expect(prompts().length).toBe(1); // still one approval (the keygen)
  expect(res.certRequested).toBe(false);
  expect(res.onboard.cert).toBeUndefined();
  expect(f.signCalls()).toBe(0);
  expect(res.onboard.machine.action).toBe("generated");
});

test("--dry-run is inert: the human door is NEVER called; nothing generated/signed", async () => {
  const { door, prompts } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caConfigured: true });

  const res = await setupMachine(f.fx, session, baseOpts({ caConfigured: true, dryRun: true }));

  expect(prompts().length).toBe(0); // NO prompt on dry-run
  expect(res.biometricApprovals).toBe(0);
  expect(f.genCalls()).toBe(0);
  expect(f.signCalls()).toBe(0);
  expect(res.onboard.dryRun).toBe(true);
  expect(formatSetupMachine(res)).toContain("DRY RUN");
});

test("formatSetupMachine reports the one-fingerprint count on a real run", async () => {
  const { door } = countingDoor(true);
  const session = sessionBiometric(door);
  const f = fixture({ sessionDoor: session.door, caConfigured: false });
  const res = await setupMachine(f.fx, session, baseOpts());
  expect(formatSetupMachine(res)).toContain("1 human approval(s)");
});
