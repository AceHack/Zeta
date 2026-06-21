// onboard.ts conformance — the key-onboarding ORCHESTRATOR that CHAINS machine.ts +
// publish.ts + github-trust.ts. EVERY test runs against FIXTURES injected for ALL THREE
// sub-modules — NEVER a real biometric prompt, NEVER a real `gh`, NEVER real keygen,
// NEVER a network call, NEVER a secret. Proves the orchestration contract:
//   * step ORDER: status -> (user-keyring) -> machine-key -> PUBLISH (only via publish.ts's
//     gate, recorded after the prior steps) -> trust-resolve;
//   * a MISSING user keyring yields an INSTRUCTION (the keyring.sh step), NOT a silent
//     seed-gen — and the orchestrator never derives/generates a seed;
//   * --dry-run is end-to-end inert: no biometric prompt, no gh write, no keygen, no fetch;
//   * the publish step goes THROUGH publish.ts (the gate is enforced there, never bypassed).
// Run: bun test onboard.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import type { MachineEffects } from "./machine.ts";
import type { BiometricResult, PublishEffects } from "./publish.ts";
import type { GithubTrustEffects } from "./github-trust.ts";
import type { CaEffects } from "./ca.ts";
import { keyringInstruction, onboard, formatOnboard, type OnboardEffects } from "./onboard.ts";

const PUB = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDwJVbQNiFzUCiOhc aaron@mymac (zeta-device)";

/** A spying triple-fixture: machine + publish + trust doors, with a shared call-ORDER log
 *  so a test can assert the chain (status read → machine ensure → biometric → gh add →
 *  trust fetch). No door does anything real — no keygen, no prompt, no gh, no network. */
function fixture(opts: {
  /** Files that "exist" (presence probes). Keyed by the EXACT path machine.ts builds. */
  existing?: ReadonlySet<string>;
  /** Pubkey text returned by readText (public only — never a secret in the fixture). */
  pubText?: string;
  /** The biometric outcome publish.ts will see (fake — no real Touch ID / Hello). */
  biometric?: BiometricResult;
  /** The biometric outcome the SHARED gate (machine-keygen + cert-sign) will see. Defaults
   *  to approve. Set ok:false to exercise the keygen/sign fail-closed paths via the chain. */
  sharedBiometric?: BiometricResult;
  /** GitHub `.keys` bodies per identity (public lines), for the trust resolve step. */
  ghKeys?: Record<string, string>;
  /** maintainers/ subdir names the trust resolver may source identities from. */
  maintainers?: readonly string[];
}): {
  fx: OnboardEffects;
  order: string[];
  ghAdds: { publicKey: string; title: string; keyType: string }[];
  biometricPrompts: string[];
  sharedPrompts: string[];
  genCalls: string[];
  fetchedUsers: string[];
} {
  const order: string[] = [];
  const ghAdds: { publicKey: string; title: string; keyType: string }[] = [];
  const biometricPrompts: string[] = [];
  const sharedPrompts: string[] = [];
  const genCalls: string[] = [];
  const fetchedUsers: string[] = [];
  const existing = opts.existing ?? new Set<string>();
  const pubText = opts.pubText ?? PUB + "\n";

  const machine: MachineEffects = {
    hostname: () => "mymac",
    exists: (p) => {
      order.push(`machine.exists:${p}`);
      return existing.has(p);
    },
    readText: () => pubText,
    writeText: () => {
      order.push("machine.writeText");
    },
    mkdirp: () => {
      order.push("machine.mkdirp");
    },
    genEd25519: (keyPath) => {
      // The ONLY keygen door — recorded so a test can assert dry-run NEVER calls it.
      genCalls.push(keyPath);
      order.push(`machine.genEd25519:${keyPath}`);
      return PUB + "\n";
    },
  };

  const publish: PublishEffects = {
    biometricAuth: async (prompt) => {
      biometricPrompts.push(prompt);
      order.push("publish.biometricAuth");
      return opts.biometric ?? { ok: true, platform: "macos-touchid" };
    },
    exists: (p) => {
      order.push(`publish.exists:${p}`);
      return existing.has(p);
    },
    readText: () => pubText,
    ghAddKey: async ({ publicKey, title, keyType }) => {
      ghAdds.push({ publicKey, title, keyType });
      order.push("publish.ghAddKey");
    },
  };

  const trust: GithubTrustEffects = {
    fetchKeys: async (user) => {
      fetchedUsers.push(user);
      order.push(`trust.fetchKeys:${user}`);
      return opts.ghKeys?.[user] ?? "";
    },
    fetchGpg: async () => "",
    readText: () => "",
    exists: (p) => existing.has(p),
    listDir: (p) => {
      order.push(`trust.listDir:${p}`);
      return opts.maintainers ?? [];
    },
  };

  // The SHARED biometric door — the ONE gate the agent-run keygen + cert-sign steps go
  // through (the operator's approval). Defaults to approve; tests can set ok:false to
  // exercise the chain's keygen/sign fail-closed paths. Records its own prompts.
  const biometricAuth = async (prompt: string): Promise<BiometricResult> => {
    sharedPrompts.push(prompt);
    order.push("shared.biometricAuth");
    return opts.sharedBiometric ?? { ok: true, platform: "macos-touchid" };
  };

  return {
    fx: { machine, publish, trust, biometricAuth },
    order,
    ghAdds,
    biometricPrompts,
    sharedPrompts,
    genCalls,
    fetchedUsers,
  };
}

/** The conventional paths machine.ts builds (so fixtures can mark them present/absent). */
const REPO = "/repo";
const USER = "aaron";
const userKeyringPath = `${REPO}/maintainers/${USER}/keyring-public.json`;
const devicePrivatePath = "/home/aaron/.config/zeta/machine/id_ed25519";
const machinePubPath = `${REPO}/maintainers/${USER}/machines/mymac.pub`;
const HOME = "/home/aaron";

test("CHAIN ORDER: status -> machine ensure -> biometric -> ghAddKey -> trust fetch", async () => {
  const { fx, order, ghAdds, biometricPrompts } = fixture({
    existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]),
    ghKeys: { octocat: PUB },
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME, trustIdentities: ["octocat"] });

  // Five steps, in the contract order.
  expect(res.steps.map((s) => s.kind)).toEqual([
    "status",
    "user-keyring",
    "machine-key",
    "publish",
    "trust-resolve",
  ]);
  // The biometric prompt happened (gate invoked via publish.ts) and BEFORE the gh write.
  expect(biometricPrompts).toHaveLength(1);
  const idxBio = order.indexOf("publish.biometricAuth");
  const idxAdd = order.indexOf("publish.ghAddKey");
  expect(idxBio).toBeGreaterThanOrEqual(0);
  expect(idxAdd).toBeGreaterThan(idxBio); // gh write only AFTER the biometric
  // And the publish happened only after the machine-key presence read.
  const idxMachineProbe = order.findIndex((o) => o.startsWith("machine.exists:" + devicePrivatePath));
  expect(idxMachineProbe).toBeGreaterThanOrEqual(0);
  expect(idxBio).toBeGreaterThan(idxMachineProbe);
  // The trust fetch came last (after the publish gh write).
  const idxFetch = order.indexOf("trust.fetchKeys:octocat");
  expect(idxFetch).toBeGreaterThan(idxAdd);

  expect(ghAdds).toHaveLength(1);
  expect(ghAdds[0]?.publicKey).toContain("ssh-ed25519");
  expect(res.publish.action).toBe("published");
});

test("MISSING user keyring -> INSTRUCTION (keyring.sh), NEVER a silent seed-gen", async () => {
  // user keyring absent; machine key present so we isolate the user-keyring behavior.
  const { fx, genCalls } = fixture({
    existing: new Set([devicePrivatePath, machinePubPath]),
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });

  const userStep = res.steps.find((s) => s.kind === "user-keyring");
  expect(userStep?.headline).toBe("instruction");
  expect(userStep?.pending).toBe(true);
  // The instruction names the keyring.sh generate|rotate step — the operator runs it.
  expect(userStep?.detail).toContain("keyring.sh generate aaron");
  expect(userStep?.detail).toContain("keyring.sh rotate");
  expect(userStep?.detail).toContain("seed custody is yours");
  // CRITICAL: the orchestrator did NOT generate a USER seed/keyring. The only keygen door
  // (genEd25519) is for the per-MACHINE device key — and here the machine key already
  // existed, so even that was a no-op. No seed-gen path exists in the orchestrator at all.
  expect(genCalls).toHaveLength(0);
});

test("CHAIN keygen gated: device key ABSENT + shared approve -> keygen runs after a shared prompt", async () => {
  // device key absent (→ keygen), machine pub present so publish reaches the gate too.
  const { fx, genCalls, sharedPrompts } = fixture({
    existing: new Set([userKeyringPath, machinePubPath]),
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });
  expect(res.machine.action).toBe("generated");
  expect(genCalls).toHaveLength(1); // keygen ran
  expect(sharedPrompts).toHaveLength(1); // ONLY after a shared biometric approval
  expect(sharedPrompts[0]).toContain("generate device key");
});

test("CHAIN FAIL-CLOSED (keygen): device ABSENT + shared DECLINE -> genEd25519 NEVER runs, blocked", async () => {
  const { fx, genCalls, sharedPrompts } = fixture({
    existing: new Set([userKeyringPath, machinePubPath]),
    sharedBiometric: { ok: false, platform: "macos-touchid", reason: "declined" },
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });
  expect(res.machine.action).toBe("aborted-biometric");
  expect(sharedPrompts).toHaveLength(1); // gate invoked
  expect(genCalls).toHaveLength(0); // but NO keygen — fail-closed
  const mStep = res.steps.find((s) => s.kind === "machine-key");
  expect(mStep?.headline).toBe("blocked");
});

test("--dry-run: NO biometric prompt, NO gh write, NO keygen, NO network", async () => {
  // user keyring + device key absent (→ would-create), but the machine pub IS present so
  // the publish step reaches would-publish — dry-run must still do NONE of it (no prompt,
  // no write, no keygen, no fetch). (publish.ts aborts pre-dry-run only when the pub is
  // absent; with it present, dry-run is the meaningful would-publish path.)
  const { fx, biometricPrompts, ghAdds, genCalls, fetchedUsers } = fixture({
    existing: new Set([machinePubPath]),
    ghKeys: { octocat: PUB },
  });
  const res = await onboard(fx, {
    user: USER,
    repoRoot: REPO,
    home: HOME,
    dryRun: true,
    trustIdentities: ["octocat"],
  });

  expect(res.dryRun).toBe(true);
  expect(biometricPrompts).toHaveLength(0); // no prompt
  expect(ghAdds).toHaveLength(0); // no GitHub write
  expect(genCalls).toHaveLength(0); // no keygen
  expect(fetchedUsers).toHaveLength(0); // no network fetch
  // The readout reports intent, not action.
  expect(res.machine.action).toBe("would-generate");
  expect(res.publish.action).toBe("would-publish");
  expect(res.trust.dryRun).toBe(true);
  const out = formatOnboard(res);
  expect(out).toContain("DRY RUN");
  expect(out).toContain("would");
});

test("FAIL-CLOSED via publish.ts: biometric declined -> NO gh write, step blocked", async () => {
  const { fx, ghAdds, biometricPrompts } = fixture({
    existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]),
    biometric: { ok: false, platform: "macos-touchid", reason: "declined" },
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });

  expect(biometricPrompts).toHaveLength(1); // gate invoked
  expect(ghAdds).toHaveLength(0); // but NO write — fail-closed (enforced by publish.ts)
  const pubStep = res.steps.find((s) => s.kind === "publish");
  expect(pubStep?.headline).toBe("blocked");
  expect(res.publish.action).toBe("aborted-biometric");
});

test("publish goes THROUGH publish.ts: no-key abort never prompts, never writes", async () => {
  // machine pub absent → publish.ts aborts BEFORE the prompt (publish.ts's own contract).
  const { fx, ghAdds, biometricPrompts } = fixture({
    existing: new Set([userKeyringPath, devicePrivatePath]), // note: no machinePubPath
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });

  expect(res.publish.action).toBe("aborted-no-key");
  expect(biometricPrompts).toHaveLength(0); // publish.ts aborts pre-prompt
  expect(ghAdds).toHaveLength(0);
  const pubStep = res.steps.find((s) => s.kind === "publish");
  expect(pubStep?.pending).toBe(true); // operator must run machine step first
});

test("idempotent: all present -> created NOTHING, machine key is a no-op", async () => {
  const { fx, genCalls } = fixture({
    existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]),
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });

  expect(res.machine.action).toBe("exists"); // no regeneration
  expect(genCalls).toHaveLength(0); // genEd25519 never called
  const userStep = res.steps.find((s) => s.kind === "user-keyring");
  expect(userStep?.headline).toBe("present");
});

test("trust-resolve delegates to github-trust: fetches the explicit identities", async () => {
  const { fx, fetchedUsers } = fixture({
    existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]),
    ghKeys: { octocat: PUB, torvalds: PUB },
  });
  const res = await onboard(fx, {
    user: USER,
    repoRoot: REPO,
    home: HOME,
    trustIdentities: ["octocat", "torvalds"],
  });
  expect(fetchedUsers.sort()).toEqual(["octocat", "torvalds"]);
  // PUB is identical for both → de-duped to 1 by github-trust (idempotent collapse).
  expect(res.trust.trustSet).toHaveLength(1);
});

test("keyringInstruction: names generate-then-rotate + seed-custody, no secret", () => {
  const inst = keyringInstruction("ophelia");
  expect(inst).toContain("keyring.sh generate ophelia");
  expect(inst).toContain("keyring.sh rotate");
  expect(inst).toContain("seed custody is yours");
  // It is an INSTRUCTION string only — it carries no key/seed material.
  expect(inst).not.toContain("ssh-ed25519");
});

test("formatOnboard: numbered readout + an operator-action list when pending exists", async () => {
  // user keyring missing → 1 pending (instruction); dry-run publish → another pending.
  const { fx } = fixture({ existing: new Set<string>() });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME, dryRun: true });
  const out = formatOnboard(res);
  expect(out).toContain("1. [status]");
  expect(out).toContain("2. [user-keyring]");
  expect(out).toContain("5. [trust-resolve]");
  expect(out).toContain("Operator action still required");
});

// ── OPTIONAL CA tie-in (part 5): reuse-only, gated, skips cleanly with no CA ──────────────
// The CA private path ca.ts builds from home=/home/aaron.
const caPrivatePath = `${HOME}/.config/zeta/ca/ssh_ca_ed25519`;

/** A spying fake CA door — records sign calls; signs only PUBLIC output (no secret). */
function fakeCa(existing: ReadonlySet<string>, opts?: { signCount?: { n: number } }): CaEffects {
  return {
    exists: (p) => existing.has(p),
    readText: () => PUB + "\n",
    writeText: () => {},
    mkdirp: () => {},
    genCa: () => "ssh-ed25519 AAAAFAKECAPUB ca\n",
    signCert: (req) => {
      if (opts?.signCount) opts.signCount.n += 1;
      const out = req.devicePubPath.endsWith(".pub")
        ? req.devicePubPath.slice(0, -4) + "-cert.pub"
        : req.devicePubPath + "-cert.pub";
      return { certPath: out, certText: `ssh-ed25519-cert-v01@openssh.com AAAAFAKECERT principal=${req.principal}\n` };
    },
  };
}

test("CA tie-in OFF by default: no cert-sign step, no cert result", async () => {
  const { fx } = fixture({ existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]) });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });
  expect(res.steps.map((s) => s.kind)).not.toContain("cert-sign");
  expect(res.cert).toBeUndefined();
});

test("CA tie-in: --sign-with-ca but NO CA door provided -> step omitted (clean skip)", async () => {
  const { fx } = fixture({ existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]) });
  // signWithCa requested but fx.ca absent -> the step must not run.
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME, signWithCa: true });
  expect(res.steps.map((s) => s.kind)).not.toContain("cert-sign");
  expect(res.cert).toBeUndefined();
});

test("CA tie-in: CA door present but no CA private key -> cert-sign SKIPPED (no-ca), never signs", async () => {
  const signCount = { n: 0 };
  const { fx } = fixture({ existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]) });
  // CA private key absent → ca.ts returns no-ca; freshly-flashed box presents a bare key.
  const fxWithCa: OnboardEffects = { ...fx, ca: fakeCa(new Set([machinePubPath]), { signCount }) };
  const res = await onboard(fxWithCa, { user: USER, repoRoot: REPO, home: HOME, signWithCa: true });
  const certStep = res.steps.find((s) => s.kind === "cert-sign");
  expect(certStep?.headline).toBe("skipped");
  expect(res.cert?.action).toBe("no-ca");
  expect(signCount.n).toBe(0); // never signed
});

test("CA tie-in: CA + device key present -> cert-sign signs the device key (principal=user)", async () => {
  const signCount = { n: 0 };
  const { fx } = fixture({ existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]) });
  const fxWithCa: OnboardEffects = {
    ...fx,
    ca: fakeCa(new Set([caPrivatePath, machinePubPath]), { signCount }),
  };
  const res = await onboard(fxWithCa, { user: USER, repoRoot: REPO, home: HOME, signWithCa: true });
  const certStep = res.steps.find((s) => s.kind === "cert-sign");
  expect(certStep?.headline).toBe("signed");
  expect(res.cert?.action).toBe("signed");
  expect(res.cert?.principal).toBe(USER); // cert binds the USER
  expect(signCount.n).toBe(1);
  // the cert text is public (a cert) — no private marker.
  expect(res.cert?.certText).not.toContain("PRIVATE" + " " + "KEY");
});

test("CA tie-in FAIL-CLOSED: CA + device present but shared DECLINE -> signCert NEVER runs, blocked", async () => {
  const signCount = { n: 0 };
  const { fx } = fixture({
    existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]),
    sharedBiometric: { ok: false, platform: "macos-touchid", reason: "declined" },
  });
  const fxWithCa: OnboardEffects = {
    ...fx,
    ca: fakeCa(new Set([caPrivatePath, machinePubPath]), { signCount }),
  };
  const res = await onboard(fxWithCa, { user: USER, repoRoot: REPO, home: HOME, signWithCa: true });
  const certStep = res.steps.find((s) => s.kind === "cert-sign");
  expect(certStep?.headline).toBe("blocked");
  expect(res.cert?.action).toBe("aborted-biometric");
  expect(signCount.n).toBe(0); // NO sign — fail-closed
});

test("CA tie-in: --dry-run does NOT sign (would-sign), even with CA + device present", async () => {
  const signCount = { n: 0 };
  const { fx } = fixture({ existing: new Set([machinePubPath]) });
  const fxWithCa: OnboardEffects = {
    ...fx,
    ca: fakeCa(new Set([caPrivatePath, machinePubPath]), { signCount }),
  };
  const res = await onboard(fxWithCa, { user: USER, repoRoot: REPO, home: HOME, dryRun: true, signWithCa: true });
  expect(res.cert?.action).toBe("would-sign");
  expect(signCount.n).toBe(0); // dry-run signs NOTHING
});
