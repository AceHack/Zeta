/**
 * corporate/run-profile.ts — how an organization's runs are started, kept in its configuration.
 *
 * MEASURED on the Agentic Team: every run for three repositories was started by hand, from a
 * command line forty flags long that lived only in the operator's shell history. Nothing ran after a
 * merge request opened unless somebody typed it again - so comments waited, and "the organization
 * follows up its requests" was true only while a person was watching. A RUN PROFILE is that command,
 * stored with the organization it belongs to, so a watcher can start it when something happens.
 *
 * ── WHAT A PROFILE MAY HOLD ──────────────────────────────────────────────────
 * run-org's own flags, a few non-secret environment values the project's commands read (which tests
 * to run, where logs go), how often the watcher looks, and how long a run may take. NEVER a credential:
 * credentials are files read at call time (`--jira-auth-file` is a PATH), and an environment key that
 * names a secret is refused outright rather than stored in a registry that is copied and shown.
 */

import type { PracticeCheck } from "./practice";

export interface RunProfile {
  /** Which run this is - one per repository or body of work, e.g. `agentic-tpm`. */
  readonly name: string;
  /** run-org's arguments, exactly as it takes them. Must name the store it runs over. */
  readonly args: readonly string[];
  /** Non-secret environment for the run's commands (e.g. VERIFY_STEPS). */
  readonly env: Readonly<Record<string, string>>;
  /** How often the watcher looks for something new, in minutes. */
  readonly everyMinutes: number;
  /** How long one run may take before the watcher stops it, in minutes. */
  readonly maxRunMinutes: number;
  /** Why this organization runs this way. */
  readonly why: string;
}

const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
/** An environment key that NAMES a secret. Credentials are files, read at call time - never values stored here. */
const SECRET_KEY_RE = /(TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API_?KEY|PRIVATE_?KEY|AUTH)(?!_FILE$)/i;

/** The value that follows `flag` in a profile's arguments. */
export function profileArg(p: Pick<RunProfile, "args">, flag: string): string | undefined {
  const i = p.args.indexOf(flag);
  return i >= 0 ? p.args[i + 1] : undefined;
}

/** Every value that follows `flag`. */
export function profileArgs(p: Pick<RunProfile, "args">, flag: string): readonly string[] {
  const out: string[] = [];
  p.args.forEach((a, i) => {
    if (a === flag && p.args[i + 1] !== undefined) out.push(p.args[i + 1] as string);
  });
  return out;
}

/** Refuse a profile that cannot mean what it says. */
export function validateRunProfile(p: RunProfile, orgId?: string): PracticeCheck {
  if (!NAME_RE.test(p.name)) return { ok: false, reason: `'${p.name}' is not a usable profile name: lowercase letters, digits, '.', '_' or '-'` };
  if (!Array.isArray(p.args) || p.args.some((a) => typeof a !== "string")) return { ok: false, reason: `profile '${p.name}': args must be a list of strings` };
  const store = profileArg(p, "--store");
  if (store === undefined || store.trim() === "") {
    return { ok: false, reason: `profile '${p.name}' names no --store: a watcher has to know which record to read, and a run without one keeps nothing` };
  }
  if (orgId !== undefined && profileArg(p, "--org") !== orgId) {
    return { ok: false, reason: `profile '${p.name}' must run as its own organization: give --org ${orgId}` };
  }
  for (const [k, v] of Object.entries(p.env ?? {})) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(k)) return { ok: false, reason: `profile '${p.name}': '${k}' is not an environment variable name` };
    if (SECRET_KEY_RE.test(k)) {
      return { ok: false, reason: `profile '${p.name}': '${k}' names a secret - credentials are files read at call time (give a *_FILE path), never values stored in the registry` };
    }
    if (typeof v !== "string") return { ok: false, reason: `profile '${p.name}': '${k}' must be a string` };
  }
  if (!Number.isFinite(p.everyMinutes) || p.everyMinutes < 1 || p.everyMinutes > 1440) {
    return { ok: false, reason: `profile '${p.name}': everyMinutes must be between 1 and 1440` };
  }
  if (!Number.isFinite(p.maxRunMinutes) || p.maxRunMinutes < 5 || p.maxRunMinutes > 2880) {
    return { ok: false, reason: `profile '${p.name}': maxRunMinutes must be between 5 and 2880` };
  }
  if (typeof p.why !== "string" || p.why.trim() === "") return { ok: false, reason: `profile '${p.name}' has no reason: say why the organization runs this way` };
  return { ok: true };
}

export function validateRunProfiles(profiles: readonly RunProfile[], orgId?: string): PracticeCheck {
  const seen = new Set<string>();
  const stores = new Set<string>();
  for (const p of profiles) {
    const v = validateRunProfile(p, orgId);
    if (!v.ok) return v;
    if (seen.has(p.name)) return { ok: false, reason: `profile '${p.name}' is stated twice` };
    seen.add(p.name);
    const store = (profileArg(p, "--store") ?? "").split("\\").join("/").toLowerCase();
    if (stores.has(store)) return { ok: false, reason: `two profiles run over the same store (${store}) - they would take turns on one record` };
    stores.add(store);
  }
  return { ok: true };
}
