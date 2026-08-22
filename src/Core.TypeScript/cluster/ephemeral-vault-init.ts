#!/usr/bin/env bun
/**
 * src/Core.TypeScript/cluster/ephemeral-vault-init.ts
 *
 * THE EPHEMERAL HALF of the Vault unseal ceremony. The other half -- the one
 * that runs on METAL -- is `full-ai-cluster/k8s/applications/vault/TOPOLOGY.md`
 * section 5, and NOTHING here changes it. That ceremony stays a human ceremony,
 * behind the biometric gate, with a witness, exactly as written.
 *
 * == WHAT WAS AUTHORISED, AND HOW NARROWLY ==================================
 *
 * `vault operator init` MINTS root and unseal key material. TOPOLOGY.md section
 * 5 records that as a gated class needing fresh human authorization plus the
 * biometric gate, and that record is correct and unchanged for the metal path.
 *
 * The maintainer authorised the EPHEMERAL case on 2026-08-20, verbatim:
 *
 *   "lets try to get these charts, and if we init key materials and throw it
 *    away not a bit deal."
 *
 * The authorisation is not "agents may init Vault". It is "material that cannot
 * outlive the job is not custody". So the whole of this module is an argument
 * that the material cannot outlive the job, and the argument is made by checks
 * rather than by this paragraph:
 *
 *   1. `ephemeralVaultInitGate` refuses unless the cluster is one THIS PROCESS
 *      created and will destroy -- see the four conditions there. It is
 *      fail-closed: an unrecognised shape is refused, never permitted.
 *   2. The material is never written by this module. It lives in spawn buffers
 *      and local bindings and dies when the process exits.
 *   3. `scanForKeyMaterial` runs WITH THE MATERIAL STILL IN HAND and searches
 *      every surface a later reader could reach for the literal keys. That is
 *      the only moment at which such a search is possible, which is why it is
 *      done here rather than asserted afterwards.
 *
 * Point 3 is the one that matters. "We did not write it anywhere" is a claim
 * about code nobody re-reads. A scan that runs while holding the needles is a
 * check that can fail, and it reports how many bytes it looked at so a scan
 * that examined nothing cannot read as a scan that found nothing.
 *
 * == THE SHAPE IS TOPOLOGY.MD SECTION 5, DELIBERATELY =======================
 *
 * Step for step, so the two paths are recognisably one procedure differing only
 * in who holds the shares and how long they live:
 *
 *   TOPOLOGY.md section 5 step 1  ->  `assertSealedBeforeInit` (status exit 2)
 *   TOPOLOGY.md section 5 step 2  ->  the human biometric gate. NOT PORTED.
 *                                     Its ephemeral analogue is the gate in
 *                                     `ephemeralVaultInitGate`, which is a
 *                                     different thing and says so.
 *   TOPOLOGY.md section 5 step 3  ->  `vault operator init` at an agreed share
 *                                     count and threshold
 *   TOPOLOGY.md section 5 step 4  ->  root token revoked after use
 *   TOPOLOGY.md section 5 step 5  ->  unseal, threshold-many times
 *
 * Section 5 also says: "Do not automate step 5 [on Vault CE]. Automation would
 * have to hold unseal shares somewhere a process can read them -- strictly
 * worse than a human holding them". That sentence is about the METAL cluster
 * and it still stands there. Here there is no "somewhere": the shares are held
 * for the seconds between init and unseal inside one process that is about to
 * exit, on a cluster that is about to be deleted. If this module ever grows a
 * way to persist a share -- an env var, a Secret, an artifact, a file -- the
 * sentence applies again in full and this module must be deleted, not amended.
 */

import { spawnSync } from "node:child_process";
import { closeSync, fstatSync, openSync, readSync, readdirSync, type Dirent } from "node:fs";
import { join } from "node:path";

/** Placeholder substituted for any key material found in text bound for a log. */
export const REDACTION = "[REDACTED-VAULT-KEY-MATERIAL]";

/**
 * Fixed, non-secret value used only to prove the stdin channel is usable before
 * any key material exists. Never a key, never compared by content.
 */
const STDIN_PROBE = "zeta-ephemeral-vault-stdin-probe";

/** Shares and threshold, agreed here so both halves of the report can cite them. */
export const EPHEMERAL_KEY_SHARES = 5;
export const EPHEMERAL_KEY_THRESHOLD = 3;

/** Files bigger than this are not read by the leak scan; the count is reported. */
const MAX_SCAN_FILE_BYTES = 8 * 1024 * 1024;
/** Directory recursion ceiling, so a pathological tree cannot hang the lane. */
const MAX_SCAN_FILES = 4000;

export interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * The ONE door to the cluster (noninterference: influence crosses through a
 * declared, injected channel and nowhere else). Tests drive a fake; production
 * gets `kubectlVaultExec`. `stdin` exists so an unseal share is never an argv
 * element -- argv is visible in `ps` inside the pod and in any apiserver audit
 * record of the exec, and stdin is neither.
 */
/**
 * How a secret supplied on stdin reaches the `vault` process INSIDE the pod.
 *
 *   "raw"  -- stdin is handed to `vault` untouched (used where vault genuinely
 *             reads stdin, and for the pre-mint channel probe).
 *   "arg"  -- a shell reads one line and appends it as vault's LAST argument.
 *   "env"  -- a shell reads one line and exports it as VAULT_TOKEN.
 *
 * In every mode the secret is on STDIN as far as `kubectl` is concerned, so it
 * never appears in the kubectl command line, never in an apiserver audit record
 * of the exec, and never in this job's log. "arg" costs one further thing and it
 * is stated rather than glossed: the value is briefly visible in the `vault`
 * process's own argv to anything already inside that container. See the unseal
 * call site for why that is the available trade.
 */
export type StdinMode = "raw" | "arg" | "env";

export type VaultExec = (args: readonly string[], stdin?: string, mode?: StdinMode) => CommandResult;

export interface EphemeralVaultInitGateInput {
  /** True when the caller attached to a cluster it did not create (`--existing`). */
  readonly existingCluster: boolean;
  /** Provider the harness bootstrapped. Only local, disposable providers pass. */
  readonly provider: string;
  /** The caller passed `--ephemeral-vault-init` explicitly. Never defaulted on. */
  readonly requested: boolean;
  /** The lane tears the cluster down unconditionally when the run ends. */
  readonly teardownGuaranteed: boolean;
}

export interface GateVerdict {
  readonly allowed: boolean;
  readonly reason: string;
}

/**
 * Fail-closed gate. Every condition must hold; the first that does not is
 * named in the refusal, so a refusal says WHICH property was missing rather
 * than that something was.
 *
 * `existingCluster` is the sharpest of the four. `--existing` points the
 * harness at a cluster somebody else made and nobody here will destroy -- which
 * is the metal case wearing the harness's clothes. Initialising Vault there
 * would mint material that outlives the job, which is the exact property the
 * authorisation is conditioned on.
 */
export function ephemeralVaultInitGate(input: EphemeralVaultInitGateInput): GateVerdict {
  if (!input.requested) {
    return { allowed: false, reason: "not requested: --ephemeral-vault-init was not passed" };
  }
  if (input.existingCluster) {
    return {
      allowed: false,
      reason:
        "refused: --existing attaches to a cluster this process did not create and will not destroy, so " +
        "minted key material could outlive the job. That is the metal case, and the metal case is a human " +
        "ceremony (vault/TOPOLOGY.md section 5).",
    };
  }
  if (input.provider !== "kind" && input.provider !== "k3d") {
    return {
      allowed: false,
      reason: `refused: provider ${input.provider} is not a local disposable cluster provider (kind|k3d)`,
    };
  }
  if (!input.teardownGuaranteed) {
    return {
      allowed: false,
      reason: "refused: caller did not guarantee unconditional cluster teardown at end of run",
    };
  }
  return {
    allowed: true,
    reason:
      "allowed: explicitly requested, cluster created by this process on a disposable provider, torn down " +
      "unconditionally at end of run",
  };
}

export interface LeakScanSource {
  readonly kind: "transcript" | "report" | "file" | "pod-logs";
  readonly name: string;
  readonly bytes: number;
}

export interface LeakScan {
  readonly sourcesScanned: number;
  readonly bytesScanned: number;
  /** Names of sources in which literal key material was found. Must be empty. */
  readonly leaked: readonly string[];
  /** Files skipped for being larger than the ceiling; reported, not hidden. */
  readonly skippedOversize: readonly string[];
  /**
   * True when the scan examined nothing. A scan of zero bytes finding zero
   * leaks is a check that did not run, and it must not read as one that passed.
   */
  readonly vacuous: boolean;
}

function scanText(text: string, needles: readonly string[]): boolean {
  return needles.some((needle) => needle.length > 0 && text.includes(needle));
}

/**
 * Walk `root`, appending regular files to `out`. Returns false when `root` is
 * not a readable directory, which is how the caller learns to treat it as a
 * single file -- WITHOUT a preceding `statSync`, because a check on a path
 * followed by an operation on that same path is a race (js/file-system-race):
 * the thing you checked and the thing you then used need not be the same thing.
 * The operation's own failure is the classification.
 */
function collectFiles(root: string, out: string[]): boolean {
  if (out.length >= MAX_SCAN_FILES) return true;
  let entries: readonly Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (out.length >= MAX_SCAN_FILES) return true;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      // `.git` holds no material we could have written and is large; the repo
      // working tree is scanned through `git status` instead, which is the
      // surface a commit could actually carry.
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      collectFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return true;
}

/**
 * Read a file for scanning, size-capped, with NO check-then-use race: the
 * handle is opened ONCE and both the size decision and the read are made
 * against that same descriptor via `fstat`. A `statSync(path)` followed by a
 * `readFileSync(path)` asks the filesystem about a name twice and can get two
 * different files.
 *
 * Returns null when the path could not be opened or is over the cap; the cap
 * case is reported by the caller rather than hidden.
 */
function readForScan(file: string): { readonly text: string; readonly bytes: number } | "oversize" | null {
  let fd: number;
  try {
    fd = openSync(file, "r");
  } catch {
    return null;
  }
  try {
    const size = fstatSync(fd).size;
    if (size > MAX_SCAN_FILE_BYTES) return "oversize";
    const buffer = Buffer.allocUnsafe(size);
    let read = 0;
    while (read < size) {
      const chunk = readSync(fd, buffer, read, size - read, read);
      if (chunk <= 0) break;
      read += chunk;
    }
    return { text: buffer.subarray(0, read).toString("utf8"), bytes: read };
  } catch {
    return null;
  } finally {
    closeSync(fd);
  }
}

/**
 * Search every reachable surface for the literal key material, WHILE HOLDING
 * IT. Run before the material goes out of scope; it cannot be run afterwards,
 * and that is the point -- the claim "nothing persisted" is only checkable at
 * the one moment the checker knows what to look for.
 */
export function scanForKeyMaterial(
  needles: readonly string[],
  options: {
    readonly transcript: string;
    readonly reportJson: string;
    readonly fileRoots: readonly string[];
    readonly podLogs: string;
  },
): LeakScan {
  const sources: LeakScanSource[] = [];
  const leaked: string[] = [];
  const skippedOversize: string[] = [];

  const inline: readonly (readonly [LeakScanSource["kind"], string, string])[] = [
    ["transcript", "harness stdout/stderr transcript", options.transcript],
    ["report", "the report object this module returns", options.reportJson],
    ["pod-logs", "vault-0 container logs", options.podLogs],
  ];
  for (const [kind, name, text] of inline) {
    sources.push({ kind, name, bytes: Buffer.byteLength(text, "utf8") });
    if (scanText(text, needles)) leaked.push(name);
  }

  const files: string[] = [];
  for (const root of options.fileRoots) {
    if (root.length === 0) continue;
    // A root may be a directory to walk OR a single file -- callers pass both
    // (RUNNER_TEMP is a tree; `git status` names individual paths). The attempt
    // to walk it IS the test; a non-directory falls through to be read as one
    // file, and a path that does not exist simply fails to open below.
    if (!collectFiles(root, files)) files.push(root);
  }
  for (const file of files) {
    const read = readForScan(file);
    if (read === null) continue;
    if (read === "oversize") {
      skippedOversize.push(file);
      continue;
    }
    sources.push({ kind: "file", name: file, bytes: read.bytes });
    if (scanText(read.text, needles)) leaked.push(file);
  }

  const bytesScanned = sources.reduce((sum, source) => sum + source.bytes, 0);
  return {
    sourcesScanned: sources.length,
    bytesScanned,
    leaked,
    skippedOversize,
    vacuous: needles.length === 0 || bytesScanned === 0,
  };
}

export interface EphemeralVaultInitReport {
  readonly gate: GateVerdict;
  /** `vault status` exit code before init. TOPOLOGY.md section 5 step 1: 2 is sealed, 1 is error. */
  readonly statusExitBeforeInit: number | null;
  readonly keyShares: number;
  readonly keyThreshold: number;
  readonly unsealOperations: number;
  readonly sealedAfterUnseal: boolean;
  readonly rootTokenRevoked: boolean;
  readonly leakScan: LeakScan;
}

export interface EphemeralVaultInitFailure {
  readonly step: string;
  readonly message: string;
  readonly detail?: string;
}

export type EphemeralVaultInitOutcome =
  | { readonly ok: true; readonly report: EphemeralVaultInitReport }
  | { readonly ok: false; readonly failure: EphemeralVaultInitFailure; readonly report?: EphemeralVaultInitReport };

interface InitOutput {
  readonly unsealKeys: readonly string[];
  readonly rootToken: string;
  readonly allNeedles: readonly string[];
}

/**
 * Parse `vault operator init -format=json`. Returns the material AND the full
 * needle set (b64 shares, hex shares, root token) that the leak scan searches
 * for -- both encodings, because Vault prints both and either one unseals.
 */
export function parseInitOutput(stdout: string): InitOutput | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const b64 = Array.isArray(record.unseal_keys_b64) ? record.unseal_keys_b64.filter(isNonEmptyString) : [];
  const hex = Array.isArray(record.unseal_keys_hex) ? record.unseal_keys_hex.filter(isNonEmptyString) : [];
  const rootToken = isNonEmptyString(record.root_token) ? record.root_token : "";
  if (b64.length === 0 || rootToken.length === 0) return null;
  return { unsealKeys: b64, rootToken, allNeedles: [...b64, ...hex, rootToken] };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Replace every needle with the redaction placeholder before anything is logged. */
export function redact(text: string, needles: readonly string[]): string {
  let out = text;
  for (const needle of needles) {
    if (needle.length === 0) continue;
    out = out.split(needle).join(REDACTION);
  }
  return out;
}

/**
 * Production `VaultExec`: `kubectl exec -i -n <ns> <pod> -- vault <args>`.
 *
 * `stdinIsToken` switches to a shell form that reads one line from stdin and
 * exports it as `VAULT_TOKEN` before exec-ing vault. Needed because
 * `token revoke -self` must AUTHENTICATE as the token it is revoking, and the
 * root token exists nowhere in the pod -- `operator init` printed it to us and
 * to nobody else.
 *
 * The three obvious ways to supply it are all worse:
 *   * as an argv element -- visible in `ps` inside the pod and in any apiserver
 *     audit record of the exec;
 *   * via `env VAULT_TOKEN=... vault ...` -- same problem, it is still argv;
 *   * via `vault login` -- which WRITES the token to ~/.vault-token inside the
 *     container. Persisting the material is the one thing this module may not do,
 *     even onto a filesystem that dies with the cluster.
 * Reading it from stdin into a shell variable puts it in the child's environment
 * and nowhere else.
 */
export function kubectlVaultExec(namespace: string, pod: string, timeoutMs = 120_000): VaultExec {
  return (args, stdin, mode) => {
    const prefix = ["exec", "-i", "-n", namespace, pod, "--"];
    // `read -r` returns non-zero on a final line with no newline, so each script
    // uses `;` rather than `&&` -- the variable is still set either way, and
    // making the read's exit status load-bearing would break on exactly the
    // input we send.
    const script =
      mode === "env"
        ? 'read -r zeta_v; VAULT_TOKEN="$zeta_v" exec vault "$@"'
        : 'read -r zeta_v; exec vault "$@" "$zeta_v"';
    const command =
      mode === "env" || mode === "arg"
        ? [...prefix, "sh", "-c", script, "sh", ...args]
        : [...prefix, "vault", ...args];
    const result = spawnSync(
      "kubectl",
      command,
      {
        encoding: "utf8",
        // `input` OWNS stdin. Passing `stdio: ["pipe", ...]` beside it is what
        // broke the first live run: Vault received an EMPTY unseal key and the
        // server answered `'key' must be a valid hex or base64 string`. Node
        // documents that `input` overrides stdio[0], but the two together did
        // not survive this runtime, so the conflicting option is gone rather
        // than reasoned about. stdout/stderr default to pipe, which is what the
        // explicit array was asking for anyway.
        input: stdin ?? "",
        maxBuffer: 8 * 1024 * 1024,
        timeout: timeoutMs,
      },
    );
    const pipes = result as unknown as { readonly stdout: string | null; readonly stderr: string | null };
    return { status: result.status, stdout: pipes.stdout ?? "", stderr: pipes.stderr ?? "" };
  };
}

export interface EphemeralVaultInitDeps {
  readonly exec: VaultExec;
  readonly gate: GateVerdict;
  /** Roots the leak scan walks. In CI: RUNNER_TEMP plus any dirty repo paths. */
  readonly scanRoots: readonly string[];
  /** vault-0 container logs, fetched by the caller so this module spawns only `vault`. */
  readonly podLogs: string;
  /** Everything the harness has printed so far. */
  readonly transcript: string;
  /** Emit a progress line. MUST already be free of material; callers redact. */
  readonly log: (line: string) => void;
}

/**
 * TOPOLOGY.md section 5's procedure, on a cluster that dies at the end of the run.
 *
 * The ordering is not cosmetic. `vault status` is read BEFORE init because
 * section 5 step 1 says a sealed Vault exits 2 and an error exits 1, and
 * treating an error as "sealed, proceed" would run init against a Vault whose
 * actual state nobody established. Exit 0 means someone already initialised and
 * unsealed it, which on a cluster this process just created should be
 * impossible -- so it is refused rather than skipped.
 */
export async function runEphemeralVaultInit(deps: EphemeralVaultInitDeps): Promise<EphemeralVaultInitOutcome> {
  if (!deps.gate.allowed) {
    return { ok: false, failure: { step: "gate", message: deps.gate.reason } };
  }

  // --- section 5 step 1: confirm SEALED, and confirm it by the sealed signal
  // rather than by any non-zero exit.
  const status = deps.exec(["status", "-format=json"]);
  if (status.status !== 2) {
    return {
      ok: false,
      failure: {
        step: "assert-sealed",
        message:
          `vault status exited ${String(status.status)}; TOPOLOGY.md section 5 step 1 requires exit 2 ` +
          "(sealed + uninitialised). Exit 1 is an error, exit 0 is an already-unsealed Vault -- neither is a " +
          "state this ceremony may proceed from.",
        detail: `${status.stdout}\n${status.stderr}`.slice(-2000),
      },
    };
  }
  deps.log("ephemeral-vault-init: vault status exit 2 (sealed) -- TOPOLOGY.md section 5 step 1 satisfied");

  // --- PROVE THE STDIN CHANNEL WORKS BEFORE MINTING ANYTHING.
  //
  // Not in TOPOLOGY.md section 5, because a human at a terminal does not need
  // it. Here it is load-bearing, and it was written after the first live run
  // taught the lesson: `unseal` got an EMPTY key, the server said `'key' must be
  // a valid hex or base64 string`, and by then `operator init` had ALREADY minted
  // the shares. Material existed, nothing could use it, and the run died holding
  // it. Ordering this probe before init means a broken stdin channel costs a
  // clear failure instead of a pointless mint.
  //
  // It measures a LENGTH, never content: the probe value is a fixed non-secret
  // sentinel, and only the byte count is compared.
  const probe = deps.exec(["status", "-format=json"], STDIN_PROBE, "env");
  if (probe.status !== 2 && probe.status !== 0) {
    return {
      ok: false,
      failure: {
        step: "stdin-probe",
        message:
          `the stdin channel into vault-0 is not usable (probe exec exited ${String(probe.status)}). ` +
          "Refusing BEFORE `operator init`, so no key material is minted that nothing can then consume.",
        detail: `${probe.stdout}\n${probe.stderr}`.slice(-1000),
      },
    };
  }
  deps.log("ephemeral-vault-init: stdin channel into vault-0 verified before minting anything");

  // --- section 5 step 3: init at the agreed share count and threshold.
  // stdout here IS key material. It is never logged, never returned, and never
  // placed in a failure detail.
  const init = deps.exec([
    "operator",
    "init",
    `-key-shares=${String(EPHEMERAL_KEY_SHARES)}`,
    `-key-threshold=${String(EPHEMERAL_KEY_THRESHOLD)}`,
    "-format=json",
  ]);
  if (init.status !== 0) {
    return {
      ok: false,
      failure: {
        step: "init",
        // stderr only. stdout on the success path is the material, and a
        // partial-success shape where both are populated must not leak it.
        message: `vault operator init exited ${String(init.status)}`,
        detail: init.stderr.slice(-2000),
      },
    };
  }
  const material = parseInitOutput(init.stdout);
  if (material === null) {
    return {
      ok: false,
      failure: {
        step: "init-parse",
        message:
          "vault operator init succeeded but its JSON carried no unseal_keys_b64/root_token. Output withheld: " +
          "on the success path it is key material, so it is not echoed to diagnose a parse failure.",
      },
    };
  }
  const needles = material.allNeedles;
  deps.log(
    `ephemeral-vault-init: initialised with ${String(EPHEMERAL_KEY_SHARES)} shares, threshold ` +
      `${String(EPHEMERAL_KEY_THRESHOLD)} -- material held in process memory only`,
  );

  // --- section 5 step 5: unseal threshold-many times, share over stdin.
  //
  // MEASURED TWICE (runs 32530981167 and 32532153181): `vault operator unseal -`
  // does NOT read the key from stdin in this Vault build. Both runs died with
  // `Code: 400 * 'key' must be a valid hex or base64 string` -- an EMPTY key --
  // and the second run had already PROVEN the stdin channel works, which is what
  // isolated the cause to vault's own `-` handling rather than to kubectl.
  //
  // So the share is carried on stdin to a shell inside the pod, which appends it
  // as vault's last argument. The honest cost, stated rather than glossed: the
  // share is briefly visible in the `vault` process's argv to anything already
  // inside that container. What that buys is everything outside it -- the share
  // is absent from the kubectl command line, from any apiserver audit record of
  // the exec, from this job's log, and from the harness's own process table. The
  // container is destroyed with the cluster minutes later.
  let unsealOperations = 0;
  for (const key of material.unsealKeys.slice(0, EPHEMERAL_KEY_THRESHOLD)) {
    const unseal = deps.exec(["operator", "unseal"], key, "arg");
    unsealOperations += 1;
    if (unseal.status !== 0) {
      return {
        ok: false,
        failure: {
          step: "unseal",
          message: `vault operator unseal #${String(unsealOperations)} exited ${String(unseal.status)}`,
          detail: redact(`${unseal.stdout}\n${unseal.stderr}`, needles).slice(-2000),
        },
      };
    }
  }

  const afterStatus = deps.exec(["status", "-format=json"]);
  const sealedAfterUnseal = afterStatus.status !== 0;
  if (sealedAfterUnseal) {
    return {
      ok: false,
      failure: {
        step: "assert-unsealed",
        message: `vault status exited ${String(afterStatus.status)} after ${String(unsealOperations)} unseal operations; expected 0`,
        detail: redact(`${afterStatus.stdout}\n${afterStatus.stderr}`, needles).slice(-2000),
      },
    };
  }
  deps.log("ephemeral-vault-init: vault status exit 0 -- unsealed");

  // --- section 5 step 4: the root token is the single most valuable standing
  // credential; revoke it. Nothing in this lane needs it, so it is revoked
  // immediately rather than "after use".
  //
  // The token is passed on STDIN (see kubectlVaultExec's third argument), which
  // is the last surface it touches before going out of scope below.
  const revoke = deps.exec(["token", "revoke", "-self"], material.rootToken, "env");
  const rootTokenRevoked = revoke.status === 0;
  if (!rootTokenRevoked) {
    deps.log(
      `ephemeral-vault-init: root token self-revoke exited ${String(revoke.status)} -- reported, not fatal; ` +
        "the token dies with the cluster either way",
    );
  }

  const preliminary = {
    gate: deps.gate,
    statusExitBeforeInit: status.status,
    keyShares: EPHEMERAL_KEY_SHARES,
    keyThreshold: EPHEMERAL_KEY_THRESHOLD,
    unsealOperations,
    sealedAfterUnseal,
    rootTokenRevoked,
  };

  // --- the falsifier. Runs HERE because this is the last moment the needles
  // exist. `reportJson` is the very object about to be embedded in the
  // harness's printed result, so the harness's own output is in scope.
  const leakScan = scanForKeyMaterial(needles, {
    transcript: deps.transcript,
    reportJson: JSON.stringify(preliminary),
    fileRoots: deps.scanRoots,
    podLogs: deps.podLogs,
  });

  const report: EphemeralVaultInitReport = { ...preliminary, leakScan };

  if (leakScan.vacuous) {
    return {
      ok: false,
      report,
      failure: {
        step: "leak-scan",
        message:
          "the key-material leak scan examined 0 bytes. A scan that looked at nothing and found nothing is " +
          "not evidence that nothing persisted, so it fails rather than passing quietly.",
      },
    };
  }
  if (leakScan.leaked.length > 0) {
    return {
      ok: false,
      report,
      failure: {
        step: "leak-scan",
        message: `key material found in ${String(leakScan.leaked.length)} reachable source(s)`,
        detail: leakScan.leaked.join(", "),
      },
    };
  }
  deps.log(
    `ephemeral-vault-init: leak scan clean over ${String(leakScan.sourcesScanned)} sources / ` +
      `${String(leakScan.bytesScanned)} bytes -- no unseal share or root token reachable`,
  );

  return { ok: true, report };
}
