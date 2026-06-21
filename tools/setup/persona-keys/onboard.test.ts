import { test, expect } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { onboardUserAndMachine, localKeyringPath, type OnboardEffects } from "./onboard.ts";
import { userKeyringPublicPath, deviceKeyPath } from "./machine.ts";

function fakeOnboardEffects(opts: {
  hostname: string;
  answers: Record<string, string>;
  ghAuthed: boolean;
  ghUsername?: string;
  gitUsername?: string;
  gitEmail?: string;
  sshKeysRegistered?: string[];
  gpgKeysRegistered?: string[];
  askLog?: string[];
  ghLog?: string[];
}): OnboardEffects {
  const askLog = opts.askLog || [];
  const ghLog = opts.ghLog || [];
  
  return {
    machine: {
      hostname: () => opts.hostname,
      exists: (p) => existsSync(p),
      readText: (p) => readFileSync(p, "utf8"),
      writeText: (p, c) => writeFileSync(p, c),
      mkdirp: (p) => mkdirSync(p, { recursive: true }),
      genEd25519: (keyPath, comment) => {
        mkdirSync(dirname(keyPath), { recursive: true });
        writeFileSync(keyPath, "FAKE-PRIVATE-DEVICE-KEY\n", { mode: 0o600 });
        const pub = `ssh-ed25519 AAAAFAKEPUBKEY ${comment}\n`;
        writeFileSync(keyPath + ".pub", pub);
        return pub;
      },
    },
    ask: async (query) => {
      askLog.push(query);
      for (const [k, v] of Object.entries(opts.answers)) {
        if (query.toLowerCase().includes(k.toLowerCase())) return v;
      }
      return "";
    },
    askHidden: async (query) => {
      askLog.push(query);
      for (const [k, v] of Object.entries(opts.answers)) {
        if (query.toLowerCase().includes(k.toLowerCase())) return v;
      }
      return "";
    },
    ghAuthStatus: () => {
      const res: { ok: boolean; username?: string } = { ok: opts.ghAuthed };
      if (opts.ghUsername !== undefined) {
        res.username = opts.ghUsername;
      }
      return res;
    },
    ghAuthLogin: () => {
      ghLog.push("gh auth login");
      opts.ghAuthed = true;
      opts.ghUsername = "tester-gh";
      return true;
    },
    ghAuthSetupGit: () => {
      ghLog.push("gh auth setup-git");
      return true;
    },
    ghSshKeyList: () => {
      return (opts.sshKeysRegistered || []).join("\n");
    },
    ghSshKeyAdd: (keyPath, title) => {
      ghLog.push(`gh ssh-key add ${keyPath} --title ${title}`);
      const pubkey = readFileSync(keyPath, "utf8").trim();
      const cleanPub = pubkey.split(" ")[1] || pubkey;
      opts.sshKeysRegistered = opts.sshKeysRegistered || [];
      opts.sshKeysRegistered.push(cleanPub);
      return true;
    },
    ghGpgKeyList: () => {
      return (opts.gpgKeysRegistered || []).join("\n");
    },
    ghGpgKeyAdd: (keyPath, title) => {
      ghLog.push(`gh gpg-key add ${keyPath} --title ${title}`);
      opts.gpgKeysRegistered = opts.gpgKeysRegistered || [];
      opts.gpgKeysRegistered.push("A3E5D79B1100FF11"); // fake keyId
      return true;
    },
    getGitUser: () => {
      const res: { name?: string; email?: string } = {};
      if (opts.gitUsername !== undefined) {
        res.name = opts.gitUsername;
      }
      if (opts.gitEmail !== undefined) {
        res.email = opts.gitEmail;
      }
      return res;
    }
  };
}

test("onboard: idempotent when both user and machine keys are present", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-onboard-"));
  try {
    const user = "tester";
    const hostname = "test-host-1";
    
    // Setup pre-existing local user keyring
    const localKeyPath = localKeyringPath(user, tmp);
    mkdirSync(dirname(localKeyPath), { recursive: true });
    writeFileSync(localKeyPath, JSON.stringify({
      user,
      ssh: { public: "ssh-ed25519 AAAATESTERUSERPUBKEY tester@lucent.financial", fingerprint: "fp" },
      pgp: { keyId: "A3E5D79B1100FF11", public: "GPG-PUBKEY" }
    }));
    
    // Setup repo user keyring
    const repoPublic = userKeyringPublicPath(tmp, user);
    mkdirSync(dirname(repoPublic), { recursive: true });
    writeFileSync(repoPublic, JSON.stringify({ user }));
    
    // Setup pre-existing local machine key
    const localMacKey = deviceKeyPath(tmp);
    mkdirSync(dirname(localMacKey), { recursive: true });
    writeFileSync(localMacKey, "FAKE-PRIVATE");
    writeFileSync(localMacKey + ".pub", "ssh-ed25519 AAAAFAKEMACHINEKEY comment");
    
    // Setup repo machine key
    const repoMacPub = join(tmp, "maintainers", user, "machines", `${hostname}.pub`);
    mkdirSync(dirname(repoMacPub), { recursive: true });
    writeFileSync(repoMacPub, "ssh-ed25519 AAAAFAKEMACHINEKEY comment");
    
    const askLog: string[] = [];
    const ghLog: string[] = [];
    const fx = fakeOnboardEffects({
      hostname,
      answers: {},
      ghAuthed: true,
      ghUsername: "tester-gh",
      sshKeysRegistered: ["AAAATESTERUSERPUBKEY"],
      gpgKeysRegistered: ["A3E5D79B1100FF11"],
      askLog,
      ghLog
    });
    
    await onboardUserAndMachine(fx, { user, repoRoot: tmp, home: tmp, publish: true });
    
    // Should verify keys and require zero interactive prompts
    expect(askLog.length).toBe(0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("onboard: missing user keyring triggers interactive import", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-onboard-"));
  try {
    const user = "tester";
    const hostname = "test-host-2";
    
    // Fake seed phrase
    const goldenMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
    
    // Pre-exist repo keyring
    const repoPublic = userKeyringPublicPath(tmp, user);
    mkdirSync(dirname(repoPublic), { recursive: true });
    writeFileSync(repoPublic, JSON.stringify({ user }));
    
    // Machine key already exists
    const localMacKey = deviceKeyPath(tmp);
    mkdirSync(dirname(localMacKey), { recursive: true });
    writeFileSync(localMacKey, "FAKE-PRIVATE");
    writeFileSync(localMacKey + ".pub", "ssh-ed25519 AAAAFAKEMACHINEKEY comment");
    const repoMacPub = join(tmp, "maintainers", user, "machines", `${hostname}.pub`);
    mkdirSync(dirname(repoMacPub), { recursive: true });
    writeFileSync(repoMacPub, "ssh-ed25519 AAAAFAKEMACHINEKEY comment");
    
    const askLog: string[] = [];
    const fx = fakeOnboardEffects({
      hostname,
      answers: {
        "restore": "y",
        "paste seed": goldenMnemonic
      },
      ghAuthed: true,
      ghUsername: "tester-gh",
      askLog
    });
    
    await onboardUserAndMachine(fx, { user, repoRoot: tmp, home: tmp, publish: true });
    
    const localKeyPath = localKeyringPath(user, tmp);
    expect(existsSync(localKeyPath)).toBe(true);
    
    const keyring = JSON.parse(readFileSync(localKeyPath, "utf8"));
    expect(keyring.user).toBe(user);
    expect(keyring.mnemonic).toBe(goldenMnemonic);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("onboard: missing machine key generates key and publishes public half", async () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-onboard-"));
  try {
    const user = "tester";
    const hostname = "test-host-3";
    
    // Setup pre-existing user keyring
    const localKeyPath = localKeyringPath(user, tmp);
    mkdirSync(dirname(localKeyPath), { recursive: true });
    writeFileSync(localKeyPath, JSON.stringify({
      user,
      ssh: { public: "ssh-ed25519 AAAATESTERUSERPUBKEY tester@lucent.financial", fingerprint: "fp" },
      pgp: { keyId: "A3E5D79B1100FF11", public: "GPG-PUBKEY" }
    }));
    const repoPublic = userKeyringPublicPath(tmp, user);
    mkdirSync(dirname(repoPublic), { recursive: true });
    writeFileSync(repoPublic, JSON.stringify({ user }));
    
    const fx = fakeOnboardEffects({
      hostname,
      answers: {},
      ghAuthed: true,
      ghUsername: "tester-gh",
      sshKeysRegistered: ["AAAATESTERUSERPUBKEY"]
    });
    
    await onboardUserAndMachine(fx, { user, repoRoot: tmp, home: tmp, publish: true });
    
    const localMacKey = deviceKeyPath(tmp);
    expect(existsSync(localMacKey)).toBe(true);
    expect(existsSync(localMacKey + ".pub")).toBe(true);
    
    const repoMacPub = join(tmp, "maintainers", user, "machines", `${hostname}.pub`);
    expect(existsSync(repoMacPub)).toBe(true);
    expect(readFileSync(repoMacPub, "utf8")).toContain("ssh-ed25519 AAAAFAKEPUBKEY");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
