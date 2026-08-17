// The PAM `auth` chain, resolved and read for ATTRIBUTION — one parser, two hosts.
//
// This is the lift-out of `analyzeSudoAuthChain` from tools/setup/persona-keys/biometric.ts
// (081M06DSQ0Q087G0R000H91391). That function answers one question — "could anything OTHER
// than pam_tid.so have satisfied this transaction?" — and the answer is what licenses the
// word "biometric" in a readout. The zflash Linux flasher needs the SAME question asked of
// `pam_fprintd.so`, so the question is generalized here rather than copied.
//
// Copying would not merely have been duplication, it would have been WRONG: the macOS
// parser knows only OpenPAM's `auth include <service>` form. Debian and Ubuntu splice their
// sudo chain in with Linux-PAM's `@include common-auth`, which that parser skips silently —
// so run unchanged against /etc/pam.d/sudo on Ubuntu it sees an EMPTY chain, reports zero
// competing satisfiers, and concludes the fingerprint was the only possible factor. The
// exact false `biometric` claim the macOS fix was written to remove. The syntax difference
// is therefore a parameter (`syntax`), never an assumption.
//
// SEMANTICS, from `man pam.conf(5)` (OpenPAM, macOS 26.5) and `man pam.conf(5)` /
// `man pam.d(5)` (Linux-PAM):
//
//   sufficient — "If this module succeeds, the chain is broken and the result is success.
//                 If it fails, THE REST OF THE CHAIN STILL RUNS, but the final result will
//                 be failure unless a later module succeeds."
//
// So a chain containing the target module AND anything else cannot attribute a success to
// the target: the caller (`sudo`, `pkexec`) reports only its own exit status and never
// names the module that satisfied PAM.
//
// DELIBERATELY CONSERVATIVE, inherited from the macOS original: every non-target `auth`
// entry counts as a competing satisfier regardless of its control flag. `pam_deny.so`
// presumably cannot satisfy anything, but treating it as harmless would be an inference,
// and inference-in-place-of-observation was the defect this lineage exists to remove.
// Over-counting costs an honest `unattributed`; under-counting costs a false `biometric`.

/**
 * Which PAM dialect the policy files are written in. This controls ONLY how included
 * chains are recognised — the `auth` line grammar itself is common to both.
 *
 * - `openpam` — macOS/FreeBSD. Includes are `auth include <service>` (a function-class
 *   line). There is no `@include`.
 * - `linux-pam` — Linux. Has `auth include <service>` AND `auth substack <service>`, plus
 *   the file-level `@include <file>` directive which splices in EVERY class of the named
 *   file (Debian's `/etc/pam.d/sudo` is little more than `@include common-auth`).
 */
export type PamSyntax = "openpam" | "linux-pam";

export interface PamAuthChainOptions {
  /** PAM service name — the file basename under `pamDir`. Default `"sudo"`. */
  readonly service?: string;
  /** The module whose exclusivity is being tested, e.g. `"pam_tid.so"`, `"pam_fprintd.so"`.
   *  Matched on BASENAME, so a fully-qualified module path is recognised too. */
  readonly targetModule: string;
  /** Control flags under which the target counts as CONFIGURED. Default `["sufficient"]`:
   *  a target that cannot short-circuit the chain is not a gate, it is one more module. */
  readonly targetControlFlags?: readonly string[];
  /** Policy dialect. Default `"openpam"` — the macOS caller's behaviour, unchanged. */
  readonly syntax?: PamSyntax;
  /** Directory holding the per-service policy files. Default `"/etc/pam.d"`. */
  readonly pamDir?: string;
  /** Include-recursion bound. Default 8. Exceeding it is an UNRESOLVED include, not a pass. */
  readonly maxDepth?: number;
}

export interface PamAuthChainAnalysis {
  /** The target module appears in the resolved chain under an accepted control flag. */
  readonly targetConfigured: boolean;
  /** Every OTHER `auth` entry, as `"<control> <module>"` — each one a module that could
   *  have satisfied the transaction instead of the target, and therefore each one a reason
   *  a success cannot be attributed to the target. */
  readonly competingEntries: readonly string[];
  /** Include targets that could not be read, cycled, or exceeded `maxDepth`. An unreadable
   *  chain is an UNKNOWN chain, and unknown is never treated as empty. */
  readonly unresolvedIncludes: readonly string[];
  /** True ONLY when the target is configured and nothing else in the resolved chain could
   *  have satisfied it. This — not `targetConfigured` — is what licenses an attribution. */
  readonly targetIsOnlySatisfier: boolean;
}

/** One `auth` line, already stripped of comments and split into its fields. */
interface AuthEntry {
  readonly controlFlag: string;
  readonly moduleName: string;
}

/**
 * Join Linux-PAM line continuations (`\` at end of line) and drop comments.
 *
 * pam.conf(5): "anything to the right of a '#' sign" is a comment. Comment stripping runs
 * AFTER the join, matching the order PAM itself uses — a continuation whose first physical
 * line ends in `#` comments out the joined remainder, and treating the second line as a
 * fresh rule would invent an entry that PAM never sees.
 */
function logicalLines(text: string): string[] {
  const joined: string[] = [];
  let pending = "";
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.endsWith("\\")) {
      pending += line.slice(0, -1);
      continue;
    }
    joined.push(pending + line);
    pending = "";
  }
  if (pending !== "") joined.push(pending);
  return joined.map((l) => (l.split("#")[0] ?? "").trim()).filter((l) => l !== "");
}

/**
 * Split a policy line into `[functionClass, controlFlag, modulePath]`.
 *
 * Handles Linux-PAM's bracketed control flag — `auth [success=1 default=ignore] pam_unix.so`
 * — which whitespace splitting would tear into `[success=1` / `default=ignore]`, putting
 * the wrong token in the module position. That misparse matters: Debian's `common-auth`
 * ships `pam_unix.so` under exactly that bracketed form, so a naive split would file the
 * password module under a garbage name and leave `pam_unix.so` unrecognised.
 *
 * Also strips Linux-PAM's leading `-` on the function class (`-auth optional pam_foo.so`
 * means "do not log if the module is missing"; it is still an auth entry).
 *
 * Returns null when the line is not a well-formed three-field rule.
 */
function splitPolicyLine(line: string): readonly [string, string, string] | null {
  const bracketed = /^(-?\S+)\s+(\[[^\]]*\])\s+(\S+)/.exec(line);
  if (bracketed) {
    const [, cls, control, mod] = bracketed;
    if (cls === undefined || control === undefined || mod === undefined) return null;
    return [cls.replace(/^-/, ""), control, mod];
  }
  const fields = line.split(/\s+/);
  const [cls, control, mod] = fields;
  if (cls === undefined || control === undefined || mod === undefined) return null;
  return [cls.replace(/^-/, ""), control, mod];
}

/**
 * Control flags that splice another service's chain in rather than naming a module.
 * `include` is common to both dialects; `substack` is Linux-PAM only — OpenPAM does not
 * define it, so honouring it there would resolve a chain the host never resolves.
 */
function includeFlags(syntax: PamSyntax): ReadonlySet<string> {
  return syntax === "linux-pam" ? new Set(["include", "substack"]) : new Set(["include"]);
}

/**
 * Resolve a PAM service's `auth` chain and report whether `targetModule` is the only thing
 * in it that could have satisfied a transaction.
 *
 * `read` is the injected door (manifesto §13 noninterference) — it THROWS when a file is
 * absent, so a test can describe any host's stack without touching /etc and without root.
 */
export function analyzePamAuthChain(
  read: (path: string) => string,
  options: PamAuthChainOptions,
): PamAuthChainAnalysis {
  const service = options.service ?? "sudo";
  const targetControlFlags = new Set(options.targetControlFlags ?? ["sufficient"]);
  const syntax: PamSyntax = options.syntax ?? "openpam";
  const pamDir = options.pamDir ?? "/etc/pam.d";
  const maxDepth = options.maxDepth ?? 8;
  const targetName = options.targetModule.split("/").pop() ?? options.targetModule;
  const spliceFlags = includeFlags(syntax);

  const competingEntries: string[] = [];
  const unresolvedIncludes: string[] = [];
  const seen = new Set<string>();
  // Held in a cell rather than a `let`: the only assignment happens inside `record`, two
  // closures deep, and control-flow analysis does not carry that back out to the return
  // expression — it would read the flag as still-literal `false`.
  const found = { target: false };

  const record = (entry: AuthEntry): void => {
    if (entry.moduleName === targetName) {
      if (targetControlFlags.has(entry.controlFlag)) found.target = true;
      return;
    }
    competingEntries.push(`${entry.controlFlag} ${entry.moduleName}`);
  };

  const walk = (svc: string, depth: number): void => {
    // Cycle + runaway guard: a policy that includes itself must terminate, not hang, and
    // the truncation is REPORTED — a chain we stopped reading is unknown, never empty.
    if (depth > maxDepth || seen.has(svc)) {
      unresolvedIncludes.push(svc);
      return;
    }
    seen.add(svc);
    let text: string;
    try {
      text = read(`${pamDir}/${svc}`);
    } catch {
      unresolvedIncludes.push(svc);
      return;
    }
    for (const line of logicalLines(text)) {
      // Linux-PAM `@include <file>`: splice in the named file's rules wholesale. It is a
      // file-level directive, not a function-class line, so it is matched before the
      // three-field grammar. OpenPAM has no such directive and must not honour one.
      if (syntax === "linux-pam" && line.startsWith("@include")) {
        const target = line.split(/\s+/)[1];
        if (target === undefined) {
          unresolvedIncludes.push(`${svc} (malformed @include)`);
          continue;
        }
        walk(target, depth + 1);
        continue;
      }
      const parsed = splitPolicyLine(line);
      if (parsed === null) continue;
      const [functionClass, controlFlag, modulePath] = parsed;
      if (functionClass !== "auth") continue;
      if (spliceFlags.has(controlFlag)) {
        walk(modulePath, depth + 1);
        continue;
      }
      // Compare on the basename so a full module path is recognised too.
      record({ controlFlag, moduleName: modulePath.split("/").pop() ?? modulePath });
    }
  };

  walk(service, 0);
  return {
    targetConfigured: found.target,
    competingEntries,
    unresolvedIncludes,
    targetIsOnlySatisfier:
      found.target && competingEntries.length === 0 && unresolvedIncludes.length === 0,
  };
}
