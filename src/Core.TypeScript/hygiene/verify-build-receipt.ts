#!/usr/bin/env bun
// verify-build-receipt.ts — the git binding for build receipts, and the only
// place in this feature that touches a filesystem or a process.
//
// Work-item 081KYYJEJ4X08QG0R003P8GXSY. Format + cryptography: `build-receipt.ts`.
//
// HOST-INDEPENDENT BY CONSTRUCTION: the only external program is `git`, and the
// only one for signing is `ssh-keygen`. No forge API is called, no network is
// touched, and nothing here knows what a pull request is. A peer with a clone
// and this file can check any receipt any other peer wrote — which is the whole
// claim of the work-item, so it is worth stating that it is checkable: `rg
// 'fetch\(|https://|gh api' src/Core.TypeScript/hygiene/verify-build-receipt.ts`
// returns nothing.
//
// Usage:
//   # verify the receipts in a commit message against that commit's actual tree
//   bun src/Core.TypeScript/hygiene/verify-build-receipt.ts verify [<commit-ish>]
//        [--repo <path>]         the clone to verify (default: this file's repo)
//        [--roster <path>]...    extra authorized_keys-style files (repeatable)
//        [--require-receipt]     absence of a receipt is a refusal, not a pass
//
//   # produce a receipt trailer for the CURRENT index tree, signed by an SSH key
//   bun src/Core.TypeScript/hygiene/verify-build-receipt.ts sign
//        --checks dotnet-build=pass,ts-lint=pass
//        --key ~/.ssh/id_ed25519          (or a .pub, to sign via ssh-agent)
//        [--tree <oid>]                   (default: `git write-tree`)
//
// Exit codes:
//   0  every receipt found verified (or none found and --require-receipt absent)
//   1  usage / environment error
//   2  a receipt was refused, receipts conflict, or --require-receipt found none

import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRoster, unarmor, type RosterEntry } from "../crypto/sshsig.ts";
import {
  BUILD_RECEIPT_NAMESPACE,
  RECEIPT_VERSION,
  RESULTS,
  detectReceiptConflicts,
  formatReceiptBlock,
  receiptSigningMessage,
  verifyCommitMessage,
  type CheckOutcome,
  type CheckResult,
  type VerifyResult,
} from "./build-receipt.ts";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..");
const CHECK_ROSTER_PATH = join(here, "build-receipt-checks.json");

/** The committed check vocabulary. A malformed roster is fatal, never an empty allow-set. */
export function loadCheckIds(path: string): ReadonlySet<string> {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { checks?: Record<string, unknown> };
  const checks = parsed.checks;
  if (checks === undefined || typeof checks !== "object") {
    throw new Error(`${path}: no "checks" object — refusing to verify against an empty vocabulary`);
  }
  return new Set(Object.keys(checks));
}

/**
 * Default signer roster: every committed `maintainers/<who>/ssh-pubkeys.txt`.
 *
 * These are the same public keys the SSH CA and git commit signing use — the
 * work-item's "same committed-anchor key" requirement, met by reading the anchor
 * that is already in the repo rather than minting a second key registry.
 *
 * `maintainers/zeta/ssh-ca.pub` is deliberately EXCLUDED. It is a certificate
 * authority key: its job is to sign other keys' certificates, and letting it also
 * sign build claims directly would collapse two authorities into one key for no
 * gain. Adding it back is a `--roster` away, which is the right amount of effort.
 */
export function defaultRosterPaths(repoRoot: string): readonly string[] {
  const base = join(repoRoot, "maintainers");
  if (!existsSync(base)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(base, entry.name, "ssh-pubkeys.txt");
    if (existsSync(candidate)) out.push(candidate);
  }
  return out.sort();
}

export function loadRoster(paths: readonly string[]): readonly RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const p of paths) out.push(...parseRoster(readFileSync(p, "utf8"), p));
  return out;
}

function git(args: readonly string[], cwd: string): string {
  const r = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(r.stderr || r.stdout || "").trim()}`);
  return r.stdout;
}

/** `--checks a=pass,b=fail` -> outcomes. Refuses anything outside the closed result set. */
export function parseChecksArg(raw: string): readonly CheckOutcome[] {
  const out: CheckOutcome[] = [];
  for (const piece of raw.split(",")) {
    const item = piece.trim();
    if (item.length === 0) continue;
    const eq = item.indexOf("=");
    if (eq <= 0) throw new Error(`--checks: '${item}' is not <id>=<result>`);
    const id = item.slice(0, eq);
    const result = item.slice(eq + 1);
    if (!RESULTS.includes(result)) throw new Error(`--checks: '${result}' not in ${RESULTS.join("|")}`);
    out.push({ id, result: result as CheckResult });
  }
  if (out.length === 0) throw new Error("--checks: at least one <id>=<result> is required");
  return out;
}

function describe(v: VerifyResult): string {
  if (v.ok) {
    const checks = v.claim.checks.map((c) => `${c.id}=${c.result}`).join(" ");
    return `VERIFIED  tree=${v.claim.tree.slice(0, 12)} signer=${v.claim.signer} (${v.signerSource})\n          ${checks}`;
  }
  return `REFUSED   ${v.reason}: ${v.detail}`;
}

function cmdVerify(argv: readonly string[]): number {
  let rev = "HEAD";
  // The repository being CHECKED is a parameter; the repository this file lives in
  // is only the default. A peer verifying someone else's clone is the designed
  // case, so it must not require copying this file into that clone.
  let repo = REPO_ROOT;
  const extraRosters: string[] = [];
  let requireReceipt = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--repo") {
      const p = argv[++i];
      if (p === undefined) {
        console.error("--repo needs a path");
        return 1;
      }
      repo = resolve(p);
    } else if (a === "--roster") {
      const p = argv[++i];
      if (p === undefined) {
        console.error("--roster needs a path");
        return 1;
      }
      extraRosters.push(p);
    } else if (a === "--require-receipt") {
      requireReceipt = true;
    } else if (a.startsWith("--")) {
      console.error(`unknown flag ${a}`);
      return 1;
    } else {
      rev = a;
    }
  }

  let message: string;
  let tree: string;
  try {
    message = git(["log", "-1", "--format=%B", rev], repo);
    tree = git(["rev-parse", `${rev}^{tree}`], repo).trim();
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    return 1;
  }

  // The roster comes from the repository UNDER VERIFICATION: who may sign for a
  // clone is that clone's committed statement, not this file's neighbourhood.
  const roster = loadRoster([...defaultRosterPaths(repo), ...extraRosters]);
  const allowedCheckIds = loadCheckIds(CHECK_ROSTER_PATH);
  const verdicts = verifyCommitMessage(message, { allowedCheckIds, roster, expectedTree: tree });

  console.log(`commit ${git(["rev-parse", rev], repo).trim()}`);
  console.log(`tree   ${tree}`);
  if (verdicts.length === 0) {
    // Absence is reported as absence. A verifier that treated "no receipt" as
    // "receipt ok" would be the check-that-cannot-fail this feature exists to
    // refuse, so the caller has to say which reading it wants.
    console.log("no build receipt in this commit message");
    return requireReceipt ? 2 : 0;
  }
  let bad = 0;
  for (const v of verdicts) {
    console.log(describe(v));
    if (!v.ok) bad++;
  }
  const conflicts = detectReceiptConflicts(verdicts);
  for (const c of conflicts) {
    const claims = c.claims.map((x) => `${x.signer.slice(0, 20)}…=${x.result}`).join(" vs ");
    console.log(`CONFLICT  ${c.checkId} on tree ${c.tree.slice(0, 12)}: ${claims}`);
  }
  return bad > 0 || conflicts.length > 0 ? 2 : 0;
}

function cmdSign(argv: readonly string[]): number {
  let checksRaw = "";
  let keyPath = "";
  let tree = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    const next = argv[i + 1];
    if (a === "--checks" && next !== undefined) {
      checksRaw = next;
      i++;
    } else if (a === "--key" && next !== undefined) {
      keyPath = next;
      i++;
    } else if (a === "--tree" && next !== undefined) {
      tree = next;
      i++;
    } else {
      console.error(`unknown or incomplete flag ${a}`);
      return 1;
    }
  }
  if (checksRaw === "" || keyPath === "") {
    console.error("sign: --checks <id=result,...> and --key <path> are required");
    return 1;
  }

  let checks: readonly CheckOutcome[];
  try {
    checks = parseChecksArg(checksRaw);
  } catch (e) {
    console.error(String(e instanceof Error ? e.message : e));
    return 1;
  }
  const allowedCheckIds = loadCheckIds(CHECK_ROSTER_PATH);
  const unknown = checks.filter((c) => !allowedCheckIds.has(c.id)).map((c) => c.id);
  if (unknown.length > 0) {
    console.error(`sign: unknown check id(s) ${unknown.join(", ")} — add them to build-receipt-checks.json first`);
    return 1;
  }

  // `git write-tree` writes the INDEX's tree: the exact content that `git commit`
  // is about to record. Signing the index rather than the working copy is what
  // makes the receipt apply to what actually lands.
  if (tree === "") {
    try {
      tree = git(["write-tree"], process.cwd()).trim();
    } catch (e) {
      console.error(String(e instanceof Error ? e.message : e));
      return 1;
    }
  }

  // The signer's own fingerprint is inside the signed bytes, so it must be known
  // before signing. `ssh-keygen -lf` on the public half gives exactly the form
  // the trailer carries.
  const pubPath = keyPath.endsWith(".pub") ? keyPath : `${keyPath}.pub`;
  const lf = spawnSync("ssh-keygen", ["-lf", pubPath], { encoding: "utf8" });
  if (lf.status !== 0) {
    console.error(`ssh-keygen -lf ${pubPath} failed: ${(lf.stderr || lf.stdout || "").trim()}`);
    return 1;
  }
  const fingerprint = (lf.stdout.split(/\s+/)[1] ?? "").trim();
  if (!fingerprint.startsWith("SHA256:")) {
    console.error(`could not read a SHA256 fingerprint from: ${lf.stdout.trim()}`);
    return 1;
  }

  const dir = mkdtempSync(join(tmpdir(), "zeta-receipt-"));
  const msgPath = join(dir, "receipt.msg");
  writeFileSync(msgPath, Buffer.from(receiptSigningMessage({ version: RECEIPT_VERSION, tree, checks, signer: fingerprint })));
  const signed = spawnSync("ssh-keygen", ["-Y", "sign", "-n", BUILD_RECEIPT_NAMESPACE, "-f", keyPath, msgPath], {
    encoding: "utf8",
  });
  if (signed.status !== 0) {
    console.error(`ssh-keygen -Y sign failed: ${(signed.stderr || signed.stdout || "").trim()}`);
    return 1;
  }
  const signature = unarmor(readFileSync(`${msgPath}.sig`, "utf8"));
  console.log(formatReceiptBlock({ version: RECEIPT_VERSION, tree, checks, signer: fingerprint, signature }));
  return 0;
}

export function main(argv: readonly string[]): number {
  const [cmd = "verify", ...rest] = argv;
  if (cmd === "verify") return cmdVerify(rest);
  if (cmd === "sign") return cmdSign(rest);
  console.error(`usage: verify-build-receipt.ts (verify [<commit-ish>] | sign --checks <..> --key <path>)`);
  return 1;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
