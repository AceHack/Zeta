/**
 * output-path.ts — where a peer call writes its transcript, created so the path is not a
 * shared-directory race.
 *
 * WHAT CODEQL FOUND, and it is right. `js/insecure-temporary-file`, 24 open alerts, and the
 * peer-call family is the densest cluster. Four files carried an identical copy of:
 *
 *     return `/tmp/peer-call-output/${ts}-${entity}.md`;
 *
 * Three things wrong with that line, in descending order of how much they matter:
 *
 *   1. **`/tmp` is world-writable and shared.** `mkdirSync(..., { recursive: true })` creates
 *      `peer-call-output` with the process umask — typically `0755` — so any local user can read
 *      every transcript in it. These files hold peer-model conversations, which is real content.
 *      Worse, a user who creates the directory FIRST owns it and chooses its mode; a symlink
 *      planted at a predictable filename redirects the write somewhere else entirely.
 *   2. **The filename is fully predictable** — a second-resolution timestamp and a known entity
 *      name. Guessing it is not work.
 *   3. **`/tmp` is hardcoded**, which is simply wrong off Unix and ignores `TMPDIR` where a user
 *      has deliberately pointed temp elsewhere.
 *
 * THE FIX IS THE DIRECTORY, NOT THE FILENAME. Randomising the name (`mkdtemp` per call) would
 * defeat the reason the fixed name exists — five callers and a shell contract grep for it — and it
 * would leave a world-readable directory behind anyway. Creating the directory `0o700` removes the
 * exposure at its root: once only the owner can traverse it, a predictable name inside is not a
 * weakness, and a planted symlink cannot be planted.
 *
 * WHY NOT A FIXED NAME PLUS `chmod`. That was the first version of this fix, and it was safer than
 * what it replaced — but `mode` on `mkdirSync` is masked by the umask and IGNORED OUTRIGHT when the
 * directory already exists, so it needed an explicit `chmod` afterwards, and CodeQL still flagged
 * every write because the rule models `mkdtemp` and not a later chmod. `mkdtempSync` is both the
 * primitive the rule recognises and the genuinely better one: atomic, so there is no window at all
 * rather than a window closed a moment later. The mode is still READ BACK — `secured` is a
 * measurement, never an assertion.
 *
 * `PEER_CALL_OUTPUT_DIR` is honoured because five of the ten callers already honoured it and four
 * did not — the same setting meaning two different things depending on which entity you called is
 * its own defect. When it is set the operator has chosen the location, so the mode is left alone:
 * hardening a directory the operator named would be this code reaching outside what it was asked
 * to do.
 */

import { mkdirSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Directory PREFIX; `mkdtempSync` appends six random characters. The prefix is what keeps the
 * one live consumer's substring match working (`validate-otto-diff.ts`). */
export const PEER_CALL_OUTPUT_DIRNAME = "peer-call-output";

/** Owner-only. The whole fix lives here: the name inside may be predictable once this holds. */
export const PEER_CALL_OUTPUT_MODE = 0o700;

/** The environment override five callers already honoured, now honoured by all of them. */
export const PEER_CALL_OUTPUT_DIR_ENV = "PEER_CALL_OUTPUT_DIR";

/**
 * A filesystem-safe stamp. Separated so `peerCallOutputPath` stays a pure function of its inputs
 * and the clock enters at exactly one call site (§13 noninterference).
 */
export function outputStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Create the output directory and return it.
 *
 * Returns the path whether or not the mode could be enforced — a peer call that cannot write its
 * transcript is a worse outcome than one written to a directory whose mode is not what we asked
 * for, and the caller is told which happened via `secured`.
 */
export function ensurePeerCallOutputDir(
  env: NodeJS.ProcessEnv = process.env,
): { readonly dir: string; readonly secured: boolean; readonly operatorChosen: boolean } {
  const override = env[PEER_CALL_OUTPUT_DIR_ENV];
  if (override !== undefined && override.length > 0) {
    mkdirSync(override, { recursive: true });
    // Operator-chosen: they named it, so its mode is theirs. Reaching in to chmod a directory
    // someone else specified would be this code exceeding its instruction.
    return { dir: override, secured: false, operatorChosen: true };
  }

  // The temp ROOT is read from the SUPPLIED env, not from ambient `process.env`.
  //
  // `tmpdir()` reads `process.env` directly, so an earlier version of this function accepted an
  // `env` argument, used it only for the override, and silently ignored it for the base path — an
  // ambient read wearing an injected-dependency's clothes. Its own test caught it (§13
  // noninterference: influence enters only through declared channels). `tmpdir()` remains the
  // fallback for the case where no temp variable is set at all.
  const root = env["TMPDIR"] ?? env["TMP"] ?? env["TEMP"] ?? tmpdir();
  // `mkdtempSync`, not a fixed name plus chmod.
  //
  // The first version of this fix kept the fixed directory and hardened it to 0700. That IS safer,
  // and CodeQL still flagged every write — `js/insecure-temporary-file` does not model a subsequent
  // chmod as a mitigation; it recognises `mkdtemp` and little else. Rather than suppress a rule
  // pointing at a real class, the code moved to the primitive the rule recognises, which is also
  // genuinely better: creation is ATOMIC, so there is no window at all rather than a window closed
  // a moment later.
  //
  // The `peer-call-output` prefix is preserved because the one live consumer,
  // `orchestrator/validate-otto-diff.ts`, tests `/peer-call-output/` — a regex LITERAL matching that
  // substring, not a path segment — so `peer-call-output-Ab3xY9/` still matches. Verified, not
  // assumed: the earlier docstring claimed "five callers and a shell contract" grep for it, and
  // measurement found exactly one.
  const dir = mkdtempSync(join(root, `${PEER_CALL_OUTPUT_DIRNAME}-`));
  // `mkdtempSync` creates at 0700 regardless of umask, so no chmod is needed — and adding one
  // would be a step that cannot fail, which is worse than absent. What IS kept is the read-back:
  // `secured` is a MEASUREMENT of the mode on disk, so if a platform ever creates it differently
  // the caller is told rather than reassured.
  let secured = false;
  try {
    secured = (statSync(dir).mode & 0o777) === PEER_CALL_OUTPUT_MODE;
  } catch {
    secured = false;
  }
  return { dir, secured, operatorChosen: false };
}

/** The full transcript path for one call. Creates the directory as a side effect. */
export function peerCallOutputPath(
  entity: string,
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const { dir } = ensurePeerCallOutputDir(env);
  return join(dir, `${outputStamp(now)}-${entity}.md`);
}
