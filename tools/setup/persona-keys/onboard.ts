import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import * as readline from "node:readline/promises";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

import { deriveKeyring, freshMnemonic } from "./derive.ts";
import { validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import {
  deviceKeyPath,
  publishPubPath,
  userKeyringPublicPath,
  sanitizeHostname,
  ensureMachineKey,
  realEffects as realMachineEffects,
  type MachineEffects
} from "./machine.ts";

/** Injected effects interface for Onboarding (enables noninterference/testing). */
export interface OnboardEffects {
  readonly machine: MachineEffects;
  readonly ask: (query: string) => Promise<string>;
  readonly askHidden: (query: string) => Promise<string>;
  readonly ghAuthStatus: () => { ok: boolean; username?: string };
  readonly ghAuthLogin: () => boolean;
  readonly ghAuthSetupGit: () => boolean;
  readonly ghSshKeyList: () => string;
  readonly ghSshKeyAdd: (keyPath: string, title: string) => boolean;
  readonly ghGpgKeyList: () => string;
  readonly ghGpgKeyAdd: (keyPath: string, title: string) => boolean;
  readonly getGitUser: () => { name?: string; email?: string };
}

export interface OnboardOptions {
  readonly user: string;
  readonly repoRoot: string;
  readonly home: string;
  readonly publish?: boolean;
  readonly dryRun?: boolean;
}

export function localKeyringPath(user: string, home: string): string {
  return join(home, ".config", "zeta", `keyring-${user}.json`);
}

export async function onboardUserAndMachine(
  fx: OnboardEffects,
  opts: OnboardOptions
): Promise<void> {
  const userPublicPath = userKeyringPublicPath(opts.repoRoot, opts.user);
  const userPrivatePath = localKeyringPath(opts.user, opts.home);
  
  const userPublicExists = fx.machine.exists(userPublicPath);
  const userPrivateExists = fx.machine.exists(userPrivatePath);
  
  let userKeyringData: any = null;
  let choice = "";

  if (userPrivateExists) {
    try {
      const raw = fx.machine.readText(userPrivatePath);
      userKeyringData = JSON.parse(raw);
    } catch (e) {
      console.warn(`Warning: failed to read/parse local private keyring at ${userPrivatePath}:`, e);
    }
  }

  if (userPrivateExists && userPublicExists) {
    console.log(`User keyring for '${opts.user}' already exists locally and in repository.`);
  } else if (!userPrivateExists && userPublicExists) {
    console.log(`User keyring for '${opts.user}' exists in repository, but private keys are missing locally.`);
    const restoreChoice = await fx.ask(`Restore private keys by importing your existing seed phrase? [Y/n]: `);
    if (restoreChoice.trim().toLowerCase() !== "n") {
      const seed = await fx.askHidden(`Paste seed phrase for '${opts.user}' (hidden): `);
      const trimmedSeed = seed.trim();
      if (!validateMnemonic(trimmedSeed, wordlist)) {
        throw new Error("Invalid seed phrase. Cannot restore user keyring.");
      }
      const { full } = deriveKeyring(trimmedSeed, opts.user);
      userKeyringData = full;
      if (!opts.dryRun) {
        fx.machine.mkdirp(dirname(userPrivatePath));
        const prevUmask = process.umask(0o077);
        try {
          fx.machine.writeText(userPrivatePath, JSON.stringify(full, null, 2));
        } finally {
          process.umask(prevUmask);
        }
        console.log(`Successfully restored local private keys to ${userPrivatePath}`);
      } else {
        console.log(`[dry-run] Would write private keys to ${userPrivatePath}`);
      }
    } else {
      console.log("Restoration skipped. Note: you cannot push signed commits or authenticate without private keys.");
    }
  } else {
    // Both absent OR only private exists but public absent
    if (!userPrivateExists) {
      console.log(`User keyring for '${opts.user}' is missing.`);
      const onboardChoice = await fx.ask(`Create new persona keyring? [G]enerate a new seed / [I]mport an existing one / [S]kip: `);
      choice = onboardChoice.trim().toLowerCase();
      let seed = "";
      if (choice === "g") {
        seed = freshMnemonic();
        console.log("\n============================================================");
        console.log("  YOUR SEED PHRASE — write it on PAPER now (24 words):");
        console.log("============================================================");
        console.log(`  ${seed}`);
        console.log("\n  This is the ONLY thing that recovers ALL your keys + funds.");
        console.log("  * Stamp it on METAL (fireproof/waterproof) — or paper — in 2 safe places.");
        console.log("  * Do NOT photograph it, screenshot it, or paste it anywhere digital/online.");
        console.log("  * No one (not even Otto) can recover it for you if lost.");
        console.log("============================================================");
        
        let confirmed = false;
        while (!confirmed) {
          const ack = await fx.ask("  Type SAVED once it is written down: ");
          if (ack.trim() === "SAVED") {
            confirmed = true;
          } else {
            console.log("  Not confirmed (expected SAVED). Let's try again.");
          }
        }
      } else if (choice === "i") {
        const inp = await fx.askHidden(`Paste seed phrase for '${opts.user}' (hidden): `);
        seed = inp.trim();
        if (!validateMnemonic(seed, wordlist)) {
          throw new Error("Invalid seed phrase.");
        }
      } else {
        console.log("Skipping user keyring setup.");
      }

      if (seed) {
        const { full } = deriveKeyring(seed, opts.user);
        userKeyringData = full;
        if (!opts.dryRun) {
          fx.machine.mkdirp(dirname(userPrivatePath));
          const prevUmask = process.umask(0o077);
          try {
            fx.machine.writeText(userPrivatePath, JSON.stringify(full, null, 2));
          } finally {
            process.umask(prevUmask);
          }
          console.log(`Wrote local private keys to ${userPrivatePath}`);
        } else {
          console.log(`[dry-run] Would write private keys to ${userPrivatePath}`);
        }
      }
    }

    // Write public files to maintainers/<user>/
    if (userKeyringData && (opts.publish || opts.dryRun)) {
      const dest = join(opts.repoRoot, "maintainers", opts.user);
      if (!opts.dryRun) {
        fx.machine.mkdirp(dest);
        
        // Write ssh-pubkeys.txt
        const sshPub = userKeyringData.ssh.public.trim();
        fx.machine.writeText(join(dest, "ssh-pubkeys.txt"), `${sshPub}  ${opts.user}@lucent.financial\n`);
        
        // Write gpg-pubkey.asc
        fx.machine.writeText(join(dest, "gpg-pubkey.asc"), userKeyringData.pgp.public);
        
        // Write keyring-public.json
        const pubMetadata = {
          user: opts.user,
          status: !userPrivateExists && choice === "g" ? "bootstrap-test" : "self-custody",
          ssh_fingerprint: userKeyringData.ssh.fingerprint,
          pgp: {
            keyId: userKeyringData.pgp.keyId,
            fingerprint: userKeyringData.pgp.fingerprint
          },
          nostr_npub: userKeyringData.nostr.npub,
          eth: userKeyringData.eth.address,
          btc: userKeyringData.btc.address,
          sol: userKeyringData.sol.address,
          paths: {
            ssh: userKeyringData.ssh.path,
            pgp: userKeyringData.pgp.path,
            nostr: userKeyringData.nostr.path,
            eth: userKeyringData.eth.path,
            btc: userKeyringData.btc.path,
            sol: userKeyringData.sol.path
          },
          anchors: {
            github: null,
            fido_webauthn: null,
            note: "human anchor: GitHub (first trust root) + FIDO/WebAuthn/Windows Hello; recorded at rotate/anchor time"
          }
        };
        fx.machine.writeText(join(dest, "keyring-public.json"), JSON.stringify(pubMetadata, null, 2) + "\n");
        console.log(`Wrote public trust roots to ${dest}`);
      } else {
        console.log(`[dry-run] Would write public trust roots to ${dest}`);
      }
    }
  }

  // Machine Onboarding
  const hostname = sanitizeHostname(fx.machine.hostname());
  const devPrivatePath = deviceKeyPath(opts.home);
  const devPublicPath = publishPubPath(opts.repoRoot, opts.user, hostname);
  
  const machinePrivateExists = fx.machine.exists(devPrivatePath);
  const machinePublicExists = fx.machine.exists(devPublicPath);
  
  if (machinePrivateExists && machinePublicExists) {
    console.log(`Machine key for host '${hostname}' already exists locally and is published.`);
  } else {
    console.log(`Machine key for host '${hostname}' is missing or not published.`);
    if (!opts.dryRun) {
      const machineOpts: { user: string; repoRoot: string; home?: string; publish?: boolean } = {
        user: opts.user,
        repoRoot: opts.repoRoot,
        home: opts.home,
      };
      if (opts.publish !== undefined) {
        machineOpts.publish = opts.publish;
      }
      const r = ensureMachineKey(fx.machine, machineOpts);
      console.log(`Machine key setup: action=${r.action} hostname=${r.hostname}`);
      if (r.published) {
        console.log(`Published machine public key to ${devPublicPath}`);
      }
    } else {
      console.log(`[dry-run] Would ensure machine key at ${devPrivatePath} and publish to ${devPublicPath}`);
    }
  }

  // GitHub integration
  console.log("\nChecking GitHub configuration...");
  const auth = fx.ghAuthStatus();
  if (!auth.ok) {
    console.log("GitHub CLI is not authenticated.");
    const ghChoice = await fx.ask("Authenticate with GitHub now? [Y/n]: ");
    if (ghChoice.trim().toLowerCase() !== "n") {
      const success = fx.ghAuthLogin();
      if (!success) {
        console.warn("Warning: GitHub authentication failed or cancelled.");
      }
    }
  }

  const authSecond = fx.ghAuthStatus();
  if (authSecond.ok) {
    console.log(`Logged in to GitHub as @${authSecond.username}.`);
    
    const setupGitSuccess = fx.ghAuthSetupGit();
    if (setupGitSuccess) {
      console.log("Configured GitHub credential helper for Git.");
    }
    
    let userSshPub = "";
    if (userKeyringData) {
      userSshPub = userKeyringData.ssh.public.trim();
    } else {
      const sshPubPath = join(opts.repoRoot, "maintainers", opts.user, "ssh-pubkeys.txt");
      if (fx.machine.exists(sshPubPath)) {
        userSshPub = fx.machine.readText(sshPubPath).trim();
      }
    }

    if (userSshPub) {
      const sshKeys = fx.ghSshKeyList();
      const cleanPub = userSshPub.split(" ")[1];
      if (cleanPub && sshKeys.includes(cleanPub)) {
        console.log("SSH public key is already registered on GitHub.");
      } else {
        console.log("SSH public key is not registered on GitHub.");
        const addSshChoice = await fx.ask("Register user SSH public key on GitHub? [Y/n]: ");
        if (addSshChoice.trim().toLowerCase() !== "n") {
          const tempPath = join(opts.repoRoot, "maintainers", opts.user, "ssh-pubkeys.txt");
          if (!opts.dryRun && fx.machine.exists(tempPath)) {
            const added = fx.ghSshKeyAdd(tempPath, `zeta-ssh-${opts.user}`);
            if (added) console.log("Successfully added SSH key to GitHub.");
          } else if (opts.dryRun) {
            console.log(`[dry-run] Would add SSH public key to GitHub with title "zeta-ssh-${opts.user}"`);
          }
        }
      }
    }

    let userGpgPub = "";
    if (userKeyringData) {
      userGpgPub = userKeyringData.pgp.public.trim();
    } else {
      const gpgPubPath = join(opts.repoRoot, "maintainers", opts.user, "gpg-pubkey.asc");
      if (fx.machine.exists(gpgPubPath)) {
        userGpgPub = fx.machine.readText(gpgPubPath).trim();
      }
    }

    if (userGpgPub) {
      const gpgKeys = fx.ghGpgKeyList();
      // Match using the PGP key ID
      let keyId = "";
      if (userKeyringData) {
        keyId = userKeyringData.pgp.keyId.toUpperCase();
      } else {
        const pubJsonPath = join(opts.repoRoot, "maintainers", opts.user, "keyring-public.json");
        if (fx.machine.exists(pubJsonPath)) {
          try {
            const m = JSON.parse(fx.machine.readText(pubJsonPath));
            keyId = m.pgp?.keyId?.toUpperCase() || "";
          } catch { /* ignore */ }
        }
      }

      if (keyId && gpgKeys.toUpperCase().includes(keyId)) {
        console.log("GPG/PGP public signing key is already registered on GitHub.");
      } else {
        console.log("GPG/PGP public signing key is not registered on GitHub.");
        const addGpgChoice = await fx.ask("Register GPG signing key on GitHub? [Y/n]: ");
        if (addGpgChoice.trim().toLowerCase() !== "n") {
          const tempGpgPath = join(opts.repoRoot, "maintainers", opts.user, "gpg-pubkey.asc");
          if (!opts.dryRun && fx.machine.exists(tempGpgPath)) {
            const added = fx.ghGpgKeyAdd(tempGpgPath, `zeta-gpg-${opts.user}`);
            if (added) console.log("Successfully added GPG key to GitHub.");
          } else if (opts.dryRun) {
            console.log(`[dry-run] Would add GPG key to GitHub with title "zeta-gpg-${opts.user}"`);
          }
        }
      }
    }
  } else {
    console.log("GitHub integration skipped (not authenticated).");
  }

  console.log("\n============================================================");
  console.log("  ONBOARDING SUMMARY");
  console.log("============================================================");
  console.log(`  Persona User: ${opts.user}`);
  console.log(`  Dev Machine:  ${hostname}`);
  console.log(`  User Key:     ${userPrivateExists ? "Local Private present" : "Local Private MISSING"} · ${userPublicExists ? "Repo Public present" : "Repo Public MISSING"}`);
  console.log(`  Machine Key:  ${machinePrivateExists ? "Local Private present" : "Local Private MISSING"} · ${machinePublicExists ? "Repo Public present" : "Repo Public MISSING"}`);
  console.log(`  GitHub Auth:  ${authSecond.ok ? `Connected (@${authSecond.username})` : "Disconnected"}`);
  console.log("============================================================");
}

/** The REAL environment effects wrapper. */
export function realEffects(): OnboardEffects {
  return {
    machine: realMachineEffects(),
    ask: async (query) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const answer = await rl.question(query);
      rl.close();
      return answer;
    },
    askHidden: async (query) => {
      let muted = false;
      const mutableStdout = new Writable({
        write(chunk, encoding, callback) {
          if (!muted) {
            process.stdout.write(chunk, encoding);
          }
          callback();
        }
      });
      const rl = readline.createInterface({
        input: process.stdin,
        output: mutableStdout,
        terminal: true
      });
      const answerPromise = rl.question(query);
      muted = true;
      const answer = await answerPromise;
      muted = false;
      rl.close();
      process.stdout.write("\n");
      return answer;
    },
    ghAuthStatus: () => {
      try {
        const r = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
        const output = (r.stdout ?? "") + (r.stderr ?? "");
        const match = output.match(/Logged in to github\.com account ([a-zA-Z0-9-_]+)/) ||
                      output.match(/Logged in to github\.com as ([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          return { ok: true, username: match[1] };
        }
        return { ok: false };
      } catch {
        return { ok: false };
      }
    },
    ghAuthLogin: () => {
      const r = spawnSync("gh", ["auth", "login"], { stdio: "inherit" });
      return r.status === 0;
    },
    ghAuthSetupGit: () => {
      const r = spawnSync("gh", ["auth", "setup-git"], { stdio: "inherit" });
      return r.status === 0;
    },
    ghSshKeyList: () => {
      try {
        const r = spawnSync("gh", ["ssh-key", "list"], { encoding: "utf8" });
        return r.stdout ?? "";
      } catch {
        return "";
      }
    },
    ghSshKeyAdd: (keyPath, title) => {
      const r = spawnSync("gh", ["ssh-key", "add", keyPath, "--title", title], { stdio: "inherit" });
      return r.status === 0;
    },
    ghGpgKeyList: () => {
      try {
        const r = spawnSync("gh", ["gpg-key", "list"], { encoding: "utf8" });
        return r.stdout ?? "";
      } catch {
        return "";
      }
    },
    ghGpgKeyAdd: (keyPath, title) => {
      const r = spawnSync("gh", ["gpg-key", "add", keyPath, "--title", title], { stdio: "inherit" });
      return r.status === 0;
    },
    getGitUser: () => {
      try {
        const name = spawnSync("git", ["config", "user.name"], { encoding: "utf8" }).stdout?.trim();
        const email = spawnSync("git", ["config", "user.email"], { encoding: "utf8" }).stdout?.trim();
        return { name, email };
      } catch {
        return {};
      }
    }
  };
}

// Simple CLI runner
if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (n: string) => args.includes(n);
  const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  
  const fx = realEffects();
  
  // Resolve user
  let user = opt("--user");
  if (!user) {
    const gitInfo = fx.getGitUser();
    if (gitInfo.name) {
      // Lowercase, space to hyphen
      user = gitInfo.name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    } else {
      user = process.env.USER || "zeta";
    }
  }
  
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = opt("--repo-root") ?? resolve(here, "..", "..", "..");
  const home = opt("--home") ?? homedir();
  const publish = flag("--publish");
  const dryRun = flag("--dry-run");
  
  onboardUserAndMachine(fx, { user, repoRoot, home, publish, dryRun })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Onboarding failed:", err.message);
      process.exit(1);
    });
}
