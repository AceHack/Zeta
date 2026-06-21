// onboard.ts conformance — the key-onboarding ORCHESTRATOR that CHAINS machine.ts +
// github-trust.ts (+ OPTIONAL ca.ts). EVERY test runs against FIXTURES injected for ALL the
// sub-modules — NEVER a real biometric prompt, NEVER a real `gh`, NEVER real keygen, NEVER a
// network call, NEVER a secret. Proves the orchestration contract:
//   * step ORDER: status -> (user-keyring) -> machine-key -> trust-resolve [-> cert-sign];
//   * a MISSING user keyring yields an INSTRUCTION (the keyring.sh step), NOT a silent
//     seed-gen — and the orchestrator never derives/generates a seed;
//   * --dry-run is end-to-end inert: no biometric prompt, no keygen, no network;
//   * the machine key is PURE (registered at the USER-INDEPENDENT machines/<host>.pub) and the
//     (user × machine) pairing appears ONLY in the OPTIONAL CA cert (principal=<user>).
//
// PURE-KEY MODEL (Aaron 2026-06-21): there is NO GitHub-publish step — a MACHINE key is not a
// user's GitHub auth key, so the orchestrator never `gh ssh-key add`s it. (A user publishes
// their own keyring SSH key via publish-cli.ts.) The ONLY GitHub-touching step is the
// read-only trust resolve.
// Run: bun test onboard.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import type { MachineEffects } from "./machine.ts";
import type { BiometricResult } from "./biometric.ts";
import type { GithubTrustEffects } from "./github-trust.ts";
import type { CaEffects } from "./ca.ts";
import { keyringInstruction, onboard, formatOnboard, type OnboardEffects } from "./onboard.ts";

// A PURE machine pubkey — the comment is the MACHINE only, NO user@ (pure-key model).
const PUB = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDwJVbQNiFzUCiOhc mymac (zeta-machine)";

/** A spying double-fixture: machine + trust doors (+ a shared biometric gate), with a shared
 *  call-ORDER log so a test can assert the chain (status read → machine ensure → keygen →
 *  trust fetch). No door does anything real — no keygen, no prompt, no gh, no network. */
function fixture(opts: {
  /** Files that "exist" (presence probes). Keyed by the EXACT path machine.ts builds. */
  existing?: ReadonlySet<string>;
  /** Pubkey text returned by readText (public only — never a secret in the fixture). */
  pubText?: string;
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
  sharedPrompts: string[];
  genCalls: string[];
  genComments: string[];
  fetchedUsers: string[];
} {
  const order: string[] = [];
  const sharedPrompts: string[] = [];
  const genCalls: string[] = [];
  const genComments: string[] = [];
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
    genEd25519: (keyPath, comment) => {
      // The ONLY keygen door — recorded so a test can assert dry-run NEVER calls it, and that
      // the key label (comment) is the PURE machine label (no user@).
      genCalls.push(keyPath);
      genComments.push(comment);
      order.push(`machine.genEd25519:${keyPath}`);
      return `ssh-ed25519 AAAAFAKE ${comment}\n`;
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
    fx: { machine, trust, biometricAuth },
    order,
    sharedPrompts,
    genCalls,
    genComments,
    fetchedUsers,
  };
}

/** The conventional paths machine.ts builds (so fixtures can mark them present/absent).
 *  PURE-KEY MODEL: the machine pubkey registry is USER-INDEPENDENT — machines/<host>.pub. */
const REPO = "/repo";
const USER = "aaron";
const userKeyringPath = `${REPO}/maintainers/${USER}/keyring-public.json`;
const devicePrivatePath = "/home/aaron/.config/zeta/machine/id_ed25519";
const machinePubPath = `${REPO}/machines/mymac.pub`;
const HOME = "/home/aaron";

test("CHAIN ORDER: status -> machine ensure -> (no publish) -> trust fetch", async () => {
  const { fx, order, fetchedUsers } = fixture({
    existing: new Set([userKeyringPath, devicePrivatePath, machinePubPath]),
    ghKeys: { octocat: PUB },
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME, trustIdentities: ["octocat"] });

  // Four steps, in the contract order — NO publish step (pure-key model).
  expect(res.steps.map((s) => s.kind)).toEqual(["status", "user-keyring", "machine-key", "trust-resolve"]);
  // The machine-key presence read happened before the trust fetch.
  const idxMachineProbe = order.findIndex((o) => o.startsWith("machine.exists:" + devicePrivatePath));
  const idxFetch = order.indexOf("trust.fetchKeys:octocat");
  expect(idxMachineProbe).toBeGreaterThanOrEqual(0);
  expect(idxFetch).toBeGreaterThan(idxMachineProbe);
  expect(fetchedUsers).toEqual(["octocat"]);
});

test("PURE machine key: registered at machines/<host>.pub (user-independent), label has NO user@", async () => {
  // device key absent → keygen runs; assert the registry path + the pure label.
  const { fx, genComments } = fixture({
    existing: new Set([userKeyringPath]),
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });
  expect(res.machine.action).toBe("generated");
  // the registry path is the user-independent machines/<host>.pub, NOT maintainers/<user>/
  expect(res.machine.devicePublicPath).toBe(machinePubPath);
  expect(res.machine.devicePublicPath.includes("maintainers")).toBe(false);
  // the key label is the MACHINE only — no user@ anywhere (the keygen comment proves it)
  expect(res.machine.keyLabel).toBe("mymac (zeta-machine)");
  expect(genComments).toHaveLength(1);
  expect(genComments[0]).toBe("mymac (zeta-machine)");
  expect(genComments[0]).not.toContain("@");
  expect(genComments[0]).not.toContain(USER); // the user NEVER enters the key label
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
  const { fx, genCalls, sharedPrompts } = fixture({
    existing: new Set([userKeyringPath]),
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });
  expect(res.machine.action).toBe("generated");
  expect(genCalls).toHaveLength(1); // keygen ran
  expect(sharedPrompts).toHaveLength(1); // ONLY after a shared biometric approval
  expect(sharedPrompts[0]).toContain("generate machine key");
});

test("CHAIN FAIL-CLOSED (keygen): device ABSENT + shared DECLINE -> genEd25519 NEVER runs, blocked", async () => {
  const { fx, genCalls, sharedPrompts } = fixture({
    existing: new Set([userKeyringPath]),
    sharedBiometric: { ok: false, platform: "macos-touchid", reason: "declined" },
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME });
  expect(res.machine.action).toBe("aborted-biometric");
  expect(sharedPrompts).toHaveLength(1); // gate invoked
  expect(genCalls).toHaveLength(0); // but NO keygen — fail-closed
  const mStep = res.steps.find((s) => s.kind === "machine-key");
  expect(mStep?.headline).toBe("blocked");
});

test("--dry-run: NO biometric prompt, NO keygen, NO network", async () => {
  const { fx, sharedPrompts, genCalls, fetchedUsers } = fixture({
    existing: new Set<string>(),
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
  expect(sharedPrompts).toHaveLength(0); // no prompt
  expect(genCalls).toHaveLength(0); // no keygen
  expect(fetchedUsers).toHaveLength(0); // no network fetch
  // The readout reports intent, not action.
  expect(res.machine.action).toBe("would-generate");
  expect(res.trust.dryRun).toBe(true);
  const out = formatOnboard(res);
  expect(out).toContain("DRY RUN");
  expect(out).toContain("would");
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

test("NO GitHub write in the flow: the machine key never crosses a gh door (pure-key model)", async () => {
  // device key absent → keygen runs + registers to machines/<host>.pub. There is no publish
  // step and no gh door at all in OnboardEffects — the only network touch is trust resolve.
  const { fx, fetchedUsers } = fixture({
    existing: new Set([userKeyringPath]),
    ghKeys: { octocat: PUB },
  });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME, trustIdentities: ["octocat"] });
  // No "publish" step kind exists; the machine key was registered, not uploaded.
  expect(res.steps.map((s) => s.kind)).not.toContain("publish");
  expect(res.machine.devicePublicPath).toBe(machinePubPath);
  // Trust resolve is the ONLY network step (read-only .keys fetch).
  expect(fetchedUsers).toEqual(["octocat"]);
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
  // user keyring missing → 1 pending (instruction).
  const { fx } = fixture({ existing: new Set<string>() });
  const res = await onboard(fx, { user: USER, repoRoot: REPO, home: HOME, dryRun: true });
  const out = formatOnboard(res);
  expect(out).toContain("1. [status]");
  expect(out).toContain("2. [user-keyring]");
  expect(out).toContain("4. [trust-resolve]");
  expect(out).toContain("Operator action still required");
});

// ── OPTIONAL CA tie-in: reuse-only, gated, skips cleanly with no CA ───────────────────────
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

test("CA tie-in: CA + device key present -> cert-sign signs the PURE machine key over machines/<host>.pub (principal=user)", async () => {
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
  expect(res.cert?.principal).toBe(USER); // THE BINDING: the cert names the USER (only place it appears)
  expect(res.cert?.devicePubPath).toBe(machinePubPath); // signed over the user-independent machine key
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
