/**
 * credential.ts — point-of-use credential access. The declared, metered channel
 * that replaces the ambient `~/.config/zeta/secrets-env.sh` hoist.
 *
 * THE DEFECT THIS REPLACES
 * ------------------------------------------------------------------------
 * `op-token-setup.sh` wrote a file that `shellenv.sh` sourced from the user
 * profile, so an 852-byte 1Password service-account token sat in the
 * environment of every interactive shell and every process descended from one.
 *
 * An environment variable crosses `exec` REGARDLESS of the child's code
 * identity. That is what makes it the highest-exposure surface in the custody
 * stack and the one a signature cannot reach: a code signature, a keychain ACL,
 * an IMA appraisal and a TPM seal all bind a secret to a CALLER, and an
 * inherited variable has already escaped the question of who the caller is. A
 * perfectly signed, perfectly ACL'd binary exec'd from such a shell holds the
 * token before it makes its first keychain call.
 *
 * §13 noninterference (Goguen & Meseguer 1982) stated for credentials: entropy
 * enters only through declared, metered channels. `process.env` is neither.
 *
 * THE RULE THIS MODULE ENFORCES
 * ------------------------------------------------------------------------
 * Nothing here ever writes `process.env`. A credential is fetched at the moment
 * of use, handed to one callback or one child process, and dropped. The only
 * place a credential is permitted to reach an environment at all is
 * `spawnWithCredential`, which puts it in ONE child's env for ONE exec — a
 * blast radius of one process that dies with it, not a session-wide inheritance.
 * See `spawnWithCredential`'s note for why that site is genuinely unavoidable.
 */

import { readGenericPassword, describeStatus, type ReadVia } from "./keychain-macos.ts";

export class CredentialUnavailableError extends Error {
  readonly service: string;
  readonly status: number;
  constructor(service: string, status: number, reason: string) {
    super(`credential '${service}' unavailable: ${reason}`);
    this.name = "CredentialUnavailableError";
    this.service = service;
    this.status = status;
  }
}

export interface CredentialUse {
  /** Which path served the read. `deputy` means the caller's identity did not reach the keychain. */
  readonly via: ReadVia;
  /** Byte length of the credential. Safe to log. The value never is. */
  readonly length: number;
}

/**
 * Fetch at point of use, hand to `fn`, drop. The credential is never written to
 * `process.env`, never returned to the caller, and never logged.
 *
 * `fn` receives the secret; whatever `fn` does with it is `fn`'s blast radius.
 * That is deliberate: the channel is declared, so the crossing is visible at the
 * call site instead of being ambient.
 */
export async function withCredential<T>(
  service: string,
  fn: (secret: string, use: CredentialUse) => T | Promise<T>,
): Promise<T> {
  const r = readGenericPassword(service);
  if (!r.ok) throw new CredentialUnavailableError(service, r.status, r.reason);
  return await fn(r.secret, { via: r.via, length: r.secret.length });
}

/** Presence and length only — never the value. The shape safe for a health check. */
export function credentialPresence(service: string): { present: boolean; length: number; status: number; detail: string } {
  const r = readGenericPassword(service);
  return r.ok
    ? { present: true, length: r.secret.length, status: 0, detail: `served ${r.via}` }
    : { present: false, length: 0, status: r.status, detail: describeStatus(r.status) };
}

export interface SpawnWithCredentialOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  /** Extra non-secret environment for the child. */
  readonly extraEnv?: Readonly<Record<string, string>>;
}

/**
 * Build the child's environment from the parent's WITHOUT mutating the parent.
 *
 * Split out as a pure function so the property that matters — "the parent's
 * environment is not touched" — is testable without a credential present. A
 * guard whose positive case can only be exercised on a machine with the right
 * keychain item is a guard that never runs in CI.
 */
export function buildChildEnv(
  parentEnv: Readonly<Record<string, string | undefined>>,
  envVar: string,
  secret: string,
  extraEnv?: Readonly<Record<string, string>>,
): Record<string, string> {
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(parentEnv)) if (v !== undefined) childEnv[k] = v;
  for (const [k, v] of Object.entries(extraEnv ?? {})) childEnv[k] = v;
  childEnv[envVar] = secret;
  return childEnv;
}

export interface SpawnResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly via: ReadVia;
}

/**
 * THE ONE SITE WHERE A CREDENTIAL LEGITIMATELY REACHES AN ENVIRONMENT, AND WHY.
 *
 * The 1Password CLI (`op`) takes its service-account token from
 * `OP_SERVICE_ACCOUNT_TOKEN` in its own environment. That is `op`'s interface;
 * we do not control it, and there is no stdin or file-descriptor form of it.
 * So a credential must enter SOME environment for `op` to run at all.
 *
 * The distinction that makes this acceptable and the hoist not:
 *
 *   hoist       — the parent shell exports it; EVERY descendant inherits it,
 *                 for the life of the session, whether or not it needs it.
 *   this call   — the variable exists in ONE child's env, for ONE exec, chosen
 *                 explicitly at the call site, and is gone when the child exits.
 *                 The parent's `process.env` is never touched.
 *
 * That is the difference between an ambient channel and a declared one. It is a
 * blast radius of one process rather than one session, and — the part that
 * matters for custody — it is legible: `grep` finds every crossing.
 */
export async function spawnWithCredential(
  service: string,
  envVar: string,
  argv: readonly string[],
  options: SpawnWithCredentialOptions = {},
): Promise<SpawnResult> {
  if (argv.length === 0) throw new Error("spawnWithCredential: empty argv");
  const r = readGenericPassword(service);
  if (!r.ok) throw new CredentialUnavailableError(service, r.status, r.reason);

  const childEnv = buildChildEnv(process.env, envVar, r.secret, options.extraEnv);

  const proc = Bun.spawn({
    cmd: [...argv],
    env: childEnv,
    stdout: "pipe",
    stderr: "pipe",
    ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
  });
  const timeout = options.timeoutMs ?? 60_000;
  const timer = setTimeout(() => { proc.kill(); }, timeout);
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr, via: r.via };
  } finally {
    clearTimeout(timer);
  }
}
