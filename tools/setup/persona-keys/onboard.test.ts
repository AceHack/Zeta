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
  /** GitHub `.keys` bodies per identity (public lines), for the trust resolve step. */
  ghKeys?: Record<string, string>;
  /** maintainers/ subdir names the trust resolver may source identities from. */
  maintainers?: readonly string[];
}): {
  fx: OnboardEffects;
  order: string[];
  ghAdds: { publicKey: string; title: string; keyType: string }[];
  biometricPrompts: string[];
  genCalls: string[];
  fetchedUsers: string[];
} {
  const order: string[] = [];
  const ghAdds: { publicKey: string; title: string; keyType: string }[] = [];
  const biometricPrompts: string[] = [];
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

  return { fx: { machine, publish, trust }, order, ghAdds, biometricPrompts, genCalls, fetchedUsers };
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
