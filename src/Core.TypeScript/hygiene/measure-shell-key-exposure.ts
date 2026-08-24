#!/usr/bin/env bun
/**
 * measure-shell-key-exposure.ts — measure, per retained shell script, what key
 * material it can reach and through which channel, so the `.sh` deprecation is
 * sequenced by EXPOSURE rather than by convenience.
 *
 * 081M00VNHB3087G0R001WHTKTH (umbrella). The companion note is
 * `docs/research/2026-08-14-shell-deprecation-sequenced-by-key-exposure-…md`,
 * whose §2.4 ranking was produced by *reading* the scripts. This file produces
 * an ordering MECHANICALLY, which is the point: a ranking nobody can re-derive
 * is an opinion, and an opinion cannot be regression-tested.
 *
 * WHY A LEXER AND NOT A GREP
 * ------------------------------------------------------------------------
 * The distinction that decides the whole ranking is invisible to a line regex:
 *
 *     printf '%s' "$SEED" | bun gen.ts        # printf is a SHELL BUILTIN
 *     security add-generic-password -w "$TOK" # security is /usr/bin/security
 *
 * Both put a secret-holding variable in an argument position. Only the second is
 * visible in `ps(1)`, because only the second `exec`s. A grep for `"$SECRET"`
 * prices them the same, and would rank `keyring.sh` — which goes to deliberate
 * lengths to keep the seed off argv — alongside scripts that genuinely leak. So
 * the measure tokenizes, tracks which variables provably hold secrets, and asks
 * whether a tainted word reaches the argv of a process that actually forks.
 *
 * TAINT ADMISSION — two strong routes, one weak one, kept apart on purpose
 * ------------------------------------------------------------------------
 *   PROVEN   `read -s NAME`                     — the flag exists for one reason
 *   PROVEN   `NAME=$(security find-… | pbpaste | op read | osascript …)`
 *   DECLARED `NAME` is *spelled* like a credential (`*_TOKEN`, `SECRET*`, …)
 *
 * Only PROVEN taint can raise a script to `broadcast`. DECLARED taint is
 * reported but never convicts, because the first thing it flagged in anger was
 * `gh secret set "$gh_secret"` — where the variable holds the secret's NAME, and
 * the value arrives on stdin from a file. Spelling is a hint, not a measurement.
 *
 * SHAPE — pure core, impure rim
 * ------------------------------------------------------------------------
 * `measureScriptExposure(path, text)` is pure: same text, same result, no
 * filesystem, no clock, no `git`. Everything touching disk lives in `main()`.
 * That is what makes it fixture-testable and what makes a mutation run mean
 * something — the falsifier is "plant an argv leak and the tier must rise; plant
 * a comment *about* argv leaks and it must not."
 *
 * WHAT IT CANNOT SEE (stated, because an unstated blind spot reads as coverage)
 * ------------------------------------------------------------------------
 *  - **Indirection through a child.** `bun gen.ts` may do anything; the measure
 *    stops at the process boundary. `security(1)` laundering the caller's code
 *    identity (the note's §3.1b) is invisible here by construction.
 *  - **Sourced files.** `source common/curl-fetch.sh` imports that file's
 *    functions into the caller. Each file is scored independently and taint is
 *    NOT propagated across a `source`; the edge is recorded instead.
 *  - **`eval` and dynamic command names.** `eval "$cmd"` / `"$TOOL" --flag`
 *    cannot be resolved statically. Recorded as `opaque-dispatch`.
 *  - **A credential the script only handles by PATH.** `install -m 0600
 *    "$JOIN_TOKEN_FILE" …` moves a real credential and is scored `on-disk`, not
 *    `argv`, because the value never enters the process.
 *  - **Runtime reachability.** This measures SCRIPT TEXT, not the machine. "Can
 *    reach" means "the text performs this operation", never "this credential
 *    exists" — see the note's §2.3.
 *
 * Beacon anchors:
 *  - Denning & Denning, *Certification of Programs for Secure Information Flow*
 *    (CACM 20(7), 1977) — the taint lattice this uses in miniature.
 *  - Goguen & Meseguer, *Security Policies and Security Models* (1982) —
 *    noninterference; `exported-credential` is the ambient channel it forbids.
 *  - Norm Hardy, *The Confused Deputy* (SIGOPS OSR 22(4), 1988) — why a secret
 *    in `security(1)`'s argv is a distinct hazard class from an in-process read.
 *  - POSIX.1-2017 §2.9.1 / §2.14 — the builtin-vs-external distinction that
 *    `ps(1)` visibility turns on.
 *
 * Usage:
 *   bun src/Core.TypeScript/hygiene/measure-shell-key-exposure.ts
 *   bun src/Core.TypeScript/hygiene/measure-shell-key-exposure.ts --json
 *   bun src/Core.TypeScript/hygiene/measure-shell-key-exposure.ts --markdown
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { EXPECTED_RETAINED_SHELL, repoRootFromGit } from "./check-bash-retirement-inventory";

// ───────────────────────────── types ─────────────────────────────

/** How far a value travels once the script touches it. Ordinal, low → high. */
export type Channel = "none" | "confined" | "on-disk" | "broadcast";

/** What class of material the script touches. Ordinal, low → high. */
export type Material = "none" | "execution-identity" | "stored-credential" | "root-key";

export type FindingKind =
  | "argv-secret"
  | "exported-credential"
  | "credential-env-file"
  | "keystore-write"
  | "keystore-read"
  | "keystore-delete"
  | "secret-store-remote"
  | "secure-interactive-read"
  | "clipboard-secret-read"
  | "root-key-generation"
  | "key-file-touch"
  | "execution-identity-write"
  | "privileged-operation"
  | "sourced-library-edge"
  | "opaque-dispatch";

export interface Finding {
  readonly line: number;
  readonly kind: FindingKind;
  /** Evidence, from the script text. Never a value — shapes and names only. */
  readonly evidence: string;
  readonly channel: Channel;
  readonly material: Material;
}

export type ExposureTier =
  | "T5-root-key-broadcast"
  | "T4-root-key-confined"
  | "T3-credential-broadcast"
  | "T2-credential-confined"
  | "T1-execution-identity"
  | "T0-no-measured-key-contact";

export interface ScriptExposure {
  readonly path: string;
  readonly findings: readonly Finding[];
  /** Highest material class witnessed by a finding. */
  readonly material: Material;
  /** Widest channel witnessed by a KEY-BEARING finding. */
  readonly channel: Channel;
  /** Named ordinal tier; the sequencing key. */
  readonly tier: ExposureTier;
  /** Variables admitted by a PROVEN route (`read -s`, secret-source capture). */
  readonly provenSecretVariables: readonly string[];
  /** Variables admitted on SPELLING alone. Reported; never convicts. */
  readonly declaredSecretVariables: readonly string[];
}

export const TIER_ORDER: readonly ExposureTier[] = [
  "T5-root-key-broadcast",
  "T4-root-key-confined",
  "T3-credential-broadcast",
  "T2-credential-confined",
  "T1-execution-identity",
  "T0-no-measured-key-contact",
];

const CHANNEL_RANK: Readonly<Record<Channel, number>> = {
  none: 0,
  confined: 1,
  "on-disk": 2,
  broadcast: 3,
};

const MATERIAL_RANK: Readonly<Record<Material, number>> = {
  none: 0,
  "execution-identity": 1,
  "stored-credential": 2,
  "root-key": 3,
};

// ───────────────────────── lexical layer ─────────────────────────

/** Whether a word's characters can expand. `single` cannot. */
export type Quoting = "none" | "single" | "double";

export interface Word {
  readonly text: string;
  /** `single` suppresses expansion, so `'$SECRET'` is a literal, not a value. */
  readonly quoting: Quoting;
}

export interface ShellCommand {
  /** 1-based line on which the command STARTS. */
  readonly line: number;
  readonly words: readonly Word[];
  readonly heredocBodies: readonly string[];
  /** The source line the command starts on, for evidence. */
  readonly raw: string;
}

interface ScanState {
  readonly commands: ShellCommand[];
  /** Bodies of `$( … )` / backtick substitutions, with their start lines. */
  readonly substitutions: { readonly line: number; readonly body: string }[];
}

/**
 * Split shell source into commands. Deliberately a *lexer*, not a parser: it
 * resolves the five things a line regex gets wrong — quoting, comments,
 * here-documents, command separators, and multi-line `$( )` — and stops there.
 *
 * Command substitutions are lifted out and re-tokenized, so `X=$(sudo cat f)`
 * yields both the assignment and the inner `sudo cat`.
 */
export function tokenizeShell(text: string, startLine = 1): readonly ShellCommand[] {
  const state: ScanState = { commands: [], substitutions: [] };
  scanShell(text, startLine, state);
  for (const substitution of state.substitutions) {
    state.commands.push(...tokenizeShell(substitution.body, substitution.line));
  }
  return state.commands.sort((left, right) => left.line - right.line);
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- a lexer is a state machine; splitting it hides the states
function scanShell(text: string, startLine: number, state: ScanState): void {
  const lines = text.split("\n");
  let index = 0;
  let line = startLine;

  let words: Word[] = [];
  let current = "";
  let quoting: "none" | "single" | "double" = "none";
  let started = false;
  let commandLine = startLine;
  let heredocBodies: string[] = [];
  let pendingHeredocs: string[] = [];
  let expectHeredocDelimiter = false;
  // Quoting is a property of the WHOLE word, and `quoting` above is only the
  // cursor's current state — it is back to "none" by the time the word closes.
  // A word counts as `single` (no expansion) only if every character came from
  // single quotes; any unquoted or double-quoted character makes it expandable.
  let sawSingle = false;
  let sawDouble = false;
  let sawBare = false;

  const rawOf = (which: number): string => lines[which - startLine]?.trim() ?? "";

  function wordQuoting(): "none" | "single" | "double" {
    if (sawSingle && !sawDouble && !sawBare) return "single";
    return sawDouble ? "double" : "none";
  }

  function pushWord(): void {
    if (!started) return;
    if (expectHeredocDelimiter) {
      pendingHeredocs.push(current.replace(/^-/, ""));
      expectHeredocDelimiter = false;
    } else {
      words.push({ text: current, quoting: wordQuoting() });
    }
    started = false;
    current = "";
    quoting = "none";
    sawSingle = false;
    sawDouble = false;
    sawBare = false;
  }

  function flushCommand(): void {
    pushWord();
    if (words.length > 0) {
      state.commands.push({ line: commandLine, words, heredocBodies, raw: rawOf(commandLine) });
    }
    words = [];
    heredocBodies = [];
    commandLine = line;
  }

  /** Consume a balanced `$( … )` starting at `index` (which points at `$`). */
  function consumeSubstitution(): void {
    const openLine = line;
    let depth = 0;
    let body = "";
    index += 1; // '$'
    while (index < text.length) {
      const char = text[index] ?? "";
      if (char === "\n") line += 1;
      if (char === "(") {
        depth += 1;
        index += 1;
        if (depth === 1) continue;
      } else if (char === ")") {
        depth -= 1;
        index += 1;
        if (depth === 0) break;
      } else {
        index += 1;
      }
      body += char;
    }
    state.substitutions.push({ line: openLine, body });
    current += `$(${body})`;
    started = true;
    sawBare = true; // a substitution always expands, whatever encloses it
  }

  while (index < text.length) {
    const char = text[index] ?? "";

    if (char === "\n") {
      pushWord();
      line += 1;
      index += 1;
      // A pending here-document swallows whole lines until its delimiter.
      while (pendingHeredocs.length > 0) {
        const delimiter = pendingHeredocs[0] ?? "";
        const body: string[] = [];
        while (index < text.length) {
          const eol = text.indexOf("\n", index);
          const stop = eol === -1 ? text.length : eol;
          const content = text.slice(index, stop);
          index = stop + 1;
          line += 1;
          if (content.trim() === delimiter) break;
          body.push(content);
        }
        heredocBodies = [...heredocBodies, body.join("\n")];
        pendingHeredocs = pendingHeredocs.slice(1);
      }
      flushCommand();
      continue;
    }

    if (quoting === "single") {
      if (char === "'") quoting = "none";
      else current += char;
      index += 1;
      continue;
    }
    if (quoting === "double") {
      if (char === "$" && text[index + 1] === "(") {
        consumeSubstitution();
        continue;
      }
      if (char === '"') quoting = "none";
      else if (char === "\\" && index + 1 < text.length) {
        current += text[index + 1] ?? "";
        index += 1;
      } else current += char;
      index += 1;
      continue;
    }

    if (char === "\\") {
      if (text[index + 1] === "\n") {
        line += 1;
        index += 2;
        continue; // line continuation: same logical command
      }
      current += text[index + 1] ?? "";
      started = true;
      index += 2;
      continue;
    }
    if (char === "$" && text[index + 1] === "(") {
      consumeSubstitution();
      continue;
    }
    if (char === "'") {
      quoting = "single";
      sawSingle = true;
      started = true;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoting = "double";
      sawDouble = true;
      started = true;
      index += 1;
      continue;
    }
    if (char === "#" && !started) {
      const eol = text.indexOf("\n", index);
      index = eol === -1 ? text.length : eol;
      continue;
    }
    if (char === "<" && text.startsWith("<<", index)) {
      pushWord();
      expectHeredocDelimiter = true;
      started = true;
      index += text.startsWith("<<-", index) ? 3 : 2;
      continue;
    }
    if (char === "<" || char === ">") {
      pushWord();
      // Skip the redirection target word; it is not an argument.
      index += 1;
      while (index < text.length && (text[index] === ">" || text[index] === "&")) index += 1;
      while (index < text.length && (text[index] === " " || text[index] === "\t")) index += 1;
      while (index < text.length && !/[\s;&|<>]/.test(text[index] ?? "")) index += 1;
      continue;
    }
    if (char === ";" || char === "&" || char === "|" || char === "(" || char === ")") {
      flushCommand();
      index += 1;
      continue;
    }
    if (char === " " || char === "\t") {
      pushWord();
      index += 1;
      continue;
    }
    current += char;
    started = true;
    sawBare = true;
    index += 1;
  }
  flushCommand();
}

/**
 * Shell functions defined in this file. A call to one of these does NOT fork, so
 * a secret in its argument list is not `ps`-visible — the same reason builtins
 * are exempt. Missing this turned `keyring.sh`'s own confirmation helper into a
 * phantom argv leak on the first run.
 */
export function collectFunctionNames(text: string): ReadonlySet<string> {
  const names = new Set<string>();
  const re = /^[ \t]*(?:function[ \t]+)?([A-Za-z_][\w:.-]*)[ \t]*\([ \t]*\)/gm;
  let match = re.exec(text);
  while (match !== null) {
    const name = match[1];
    if (name !== undefined) names.add(name);
    match = re.exec(text);
  }
  return names;
}

// ───────────────────── secret recognition tables ─────────────────

/**
 * POSIX + bash builtins and keywords. A builtin does not `exec`, so a secret in
 * its argument list never enters another process's view of the process table.
 * This is the single most load-bearing table in the file: shrinking it turns
 * `printf '%s' "$SEED"` into a false argv leak.
 */
export const SHELL_BUILTINS: ReadonlySet<string> = new Set([
  ":",
  ".",
  "[",
  "[[",
  "alias",
  "bg",
  "break",
  "builtin",
  "case",
  "cd",
  "continue",
  "declare",
  "do",
  "done",
  "echo",
  "elif",
  "else",
  "esac",
  "eval",
  "exec",
  "exit",
  "export",
  "false",
  "fi",
  "for",
  "function",
  "getopts",
  "hash",
  "history",
  "if",
  "in",
  "jobs",
  "let",
  "local",
  "printf",
  "pwd",
  "read",
  "readonly",
  "return",
  "set",
  "shift",
  "shopt",
  "source",
  "test",
  "then",
  "times",
  "trap",
  "true",
  "type",
  "typeset",
  "ulimit",
  "umask",
  "unalias",
  "unset",
  "until",
  "wait",
  "while",
]);

/** Variable names whose spelling declares the value is a credential. */
const SECRET_NAME_RE =
  /(?:^|_)(?:SECRET|SECRETS|TOKEN|PASSWORD|PASSWD|PASSPHRASE|APIKEY|CREDENTIAL|CREDENTIALS|PRIVKEY|BEARER)(?:$|_)|API_KEY|PRIVATE_KEY|ACCESS_KEY|AUTH_TOKEN/i;

/** Variable names that declare ROOT key material specifically. */
const ROOT_KEY_NAME_RE =
  /(?:^|_)(?:MNEMONIC|SEED|SEEDPHRASE|MASTERKEY)(?:$|_)|SEED_PHRASE|PRIVATE_KEY|PRIVKEY|MASTER_KEY/i;

/** Commands that mint fresh private-key material. */
const ROOT_KEY_GENERATORS: ReadonlySet<string> = new Set(["ssh-keygen", "age-keygen", "certtool", "wg"]);

/** Paths whose contents are PRIVATE KEY material. */
const ROOT_KEY_FILE_RE =
  /(?:\.ssh\/id_|\/id_(?:rsa|ecdsa|ed25519)|\.pem$|\.p12$|\.pfx$|\.age$|private[-_]?key|keyring[-_]?private|\.gnupg\/)/i;

/**
 * Paths carrying a STORED credential rather than a root key. Kept apart because
 * `zeta-creds.enc` (an encrypted account blob copied by path) and
 * `~/.ssh/id_ed25519` are not the same loss — one bucket for both ranked the
 * NixOS installer level with the BIP-39 seed handler, which is the convenience
 * ordering this measure exists to displace.
 */
const CREDENTIAL_FILE_RE = /(?:creds\.enc|agent\/token$|k3s\/.*token|secrets-env\.sh|\.netrc$|hosts\.yml$|\.npmrc$)/i;

/** Files that decide what other code executes on this machine. */
const EXECUTION_IDENTITY_RE =
  /(?:LaunchAgents|LaunchDaemons|\.plist$|systemd\/system|\.service$|\.zprofile|\.bash_profile|\.bashrc|\.zshrc|\/\.profile$|githooks|\.git\/hooks)/;

// zeta-elevator-not-argv: shell-parser vocabulary — names this scanner LOOKS FOR in other
// people's scripts. Nothing here is ever spawned.
const PRIVILEGED_COMMANDS: ReadonlySet<string> = new Set([
  "sudo", // zeta-elevator-not-argv: parser vocabulary, never spawned (see the comment above)
  "doas",
  "mkfs",
  "sgdisk",
  "parted",
  "nixos-install",
  "launchctl",
  "systemctl",
]);

interface ArgvSecretRule {
  /** External command whose argv is `ps`-visible. */
  readonly command: string;
  /** Optional subcommand that must match the first non-flag operand. */
  readonly subcommand?: string;
  /** Flags after which the NEXT word is the secret VALUE. */
  readonly valueFlags: readonly string[];
  readonly material: Material;
}

/**
 * Flags whose operand is the secret itself. Note `security
 * find-generic-password -w` takes NO operand (it means "print the password"),
 * while `security add-generic-password -w VALUE` does — the same flag letter,
 * opposite meaning. That is why the table is keyed by subcommand and not by flag
 * alone, and it is the concrete reason this is a parser and not a pattern list.
 */
export const ARGV_SECRET_RULES: readonly ArgvSecretRule[] = [
  { command: "security", subcommand: "add-generic-password", valueFlags: ["-w"], material: "stored-credential" },
  { command: "security", subcommand: "add-internet-password", valueFlags: ["-w"], material: "stored-credential" },
  { command: "gh", subcommand: "secret", valueFlags: ["-b", "--body"], material: "stored-credential" },
  { command: "secret-tool", subcommand: "store", valueFlags: ["--password"], material: "stored-credential" },
  { command: "curl", valueFlags: ["-u", "--user", "--oauth2-bearer"], material: "stored-credential" },
  { command: "openssl", valueFlags: ["-passin", "-passout", "-pass"], material: "root-key" },
  { command: "gpg", valueFlags: ["--passphrase"], material: "root-key" },
  { command: "ssh-keygen", valueFlags: ["-N", "-P"], material: "root-key" },
  { command: "mysql", valueFlags: ["--password"], material: "stored-credential" },
  { command: "psql", valueFlags: ["--password"], material: "stored-credential" },
];

interface KeystoreRule {
  readonly command: string;
  readonly subcommands: readonly string[];
  readonly kind: FindingKind;
  readonly channel: Channel;
}

const KEYSTORE_RULES: readonly KeystoreRule[] = [
  {
    command: "security",
    subcommands: ["add-generic-password", "add-internet-password"],
    kind: "keystore-write",
    channel: "on-disk",
  },
  {
    command: "security",
    subcommands: ["find-generic-password", "find-internet-password", "dump-keychain"],
    kind: "keystore-read",
    channel: "confined",
  },
  {
    command: "security",
    subcommands: ["delete-generic-password", "delete-internet-password"],
    kind: "keystore-delete",
    channel: "on-disk",
  },
  { command: "secret-tool", subcommands: ["store"], kind: "keystore-write", channel: "on-disk" },
  { command: "secret-tool", subcommands: ["lookup"], kind: "keystore-read", channel: "confined" },
  { command: "op", subcommands: ["read", "item", "signin", "run"], kind: "secret-store-remote", channel: "confined" },
  { command: "vault", subcommands: ["kv", "write", "read", "login"], kind: "secret-store-remote", channel: "on-disk" },
  { command: "gh", subcommands: ["secret"], kind: "secret-store-remote", channel: "on-disk" },
];

/** `read` flags that consume the following word (so it is not a variable name). */
const READ_FLAGS_WITH_OPERAND: ReadonlySet<string> = new Set(["-p", "-t", "-n", "-N", "-d", "-a", "-u", "-i"]);

/** Longest `read -n N` that is a keypress rather than a credential. */
const KEYPRESS_MAX_CHARS = 2;

/**
 * `read -s` means "do not echo", which is a credential prompt — EXCEPT when it
 * is bounded to one or two characters, where it is the menu-keypress idiom
 * (`read -n 1 -s CHOICE`). Measured on `zeta-first-boot.sh`, which had three of
 * these and was being ranked as a credential handler because of them.
 */
export function isKeypressRead(words: readonly Word[]): boolean {
  for (let index = 0; index < words.length; index += 1) {
    const flag = words[index]?.text ?? "";
    if (flag !== "-n" && flag !== "-N") continue;
    const operand = Number.parseInt(words[index + 1]?.text ?? "", 10);
    if (Number.isFinite(operand) && operand <= KEYPRESS_MAX_CHARS) return true;
  }
  return false;
}

// ───────────────────────── the pure measure ──────────────────────

/** Operands with `NAME=value` prefixes and `env`/`sudo`/`command` wrappers stripped. */
function effectiveWords(command: ShellCommand): readonly Word[] {
  let words = command.words.filter((word) => !/^[A-Za-z_]\w*=/.test(word.text));
  while (words.length > 1 && ["env", "sudo", "doas", "command", "exec", "time"].includes(words[0]?.text ?? "")) {
    words = words.slice(1);
  }
  return words;
}

function referencedVariables(word: Word): readonly string[] {
  if (word.quoting === "single") return []; // no expansion inside single quotes
  const names: string[] = [];
  const re = /\$\{?([A-Za-z_]\w*)\}?/g;
  let match = re.exec(word.text);
  while (match !== null) {
    const name = match[1];
    if (name !== undefined) names.push(name);
    match = re.exec(word.text);
  }
  return names;
}

/** A capture whose value is a credential the moment it is produced. */
export function isSecretSource(text: string): boolean {
  return (
    /security\s+find-(?:generic|internet)-password/.test(text) ||
    /\bop\s+(?:read|item\s+get)\b/.test(text) ||
    /\bsecret-tool\s+lookup\b/.test(text) ||
    /\bpbpaste\b/.test(text) ||
    /hidden\s+answer/.test(text) ||
    /\bvault\s+kv\s+get\b/.test(text) ||
    /--emit-mnemonic\b/.test(text)
  );
}

function truncate(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 110 ? `${flat.slice(0, 107)}...` : flat;
}

export interface Taint {
  /** Admitted by `read -s` or by capture from a secret source. Can convict. */
  readonly proven: ReadonlySet<string>;
  /** Admitted on spelling alone. Reported, never convicts. */
  readonly declared: ReadonlySet<string>;
  readonly rootKey: ReadonlySet<string>;
}

/** True when the command is a non-echoing credential prompt, not a keypress. */
function isSecretRead(words: readonly Word[]): boolean {
  return (
    words[0]?.text === "read" && words.slice(1).some((word) => /^-[a-zA-Z]*s/.test(word.text)) && !isKeypressRead(words)
  );
}

/** The variable names a `read -s` writes into, skipping flags and their operands. */
export function readTargets(words: readonly Word[]): readonly string[] {
  const targets: string[] = [];
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index]?.text ?? "";
    if (READ_FLAGS_WITH_OPERAND.has(word)) {
      index += 1;
      continue;
    }
    if (word.startsWith("-")) continue;
    targets.push(word);
  }
  return targets;
}

/** Collect the variables that hold secret material. Pure. */
export function collectTaint(commands: readonly ShellCommand[]): Taint {
  const proven = new Set<string>();
  const declared = new Set<string>();
  const rootKey = new Set<string>();
  const note = (variable: string): void => {
    if (ROOT_KEY_NAME_RE.test(variable)) rootKey.add(variable);
  };

  for (const command of commands) {
    // Route 1 — `read -s NAME`.
    const words = effectiveWords(command);
    if (isSecretRead(words)) {
      for (const target of readTargets(words)) {
        proven.add(target);
        note(target);
      }
    }

    // Routes 2 and 3 — assignments, including `NAME=value` command prefixes.
    for (const assignment of assignmentsOf(command)) {
      if (assignment.captured) proven.add(assignment.variable);
      else if (assignment.spelled) declared.add(assignment.variable);
      if (assignment.captured || assignment.spelled) note(assignment.variable);
    }
  }
  return { proven, declared, rootKey };
}

interface Assignment {
  readonly variable: string;
  /** Value came from a keystore / clipboard / secure dialog — PROVEN. */
  readonly captured: boolean;
  /** Name is spelled like a credential — DECLARED, weaker. */
  readonly spelled: boolean;
}

function assignmentsOf(command: ShellCommand): readonly Assignment[] {
  const assignments: Assignment[] = [];
  const fromHeredoc = command.heredocBodies.some(isSecretSource);
  for (const word of command.words) {
    const match = /^([A-Za-z_]\w*)=([\S\s]*)$/.exec(word.text);
    if (match === null) continue;
    const [, variable = "", value = ""] = match;
    assignments.push({
      variable,
      captured: isSecretSource(value) || fromHeredoc,
      spelled: SECRET_NAME_RE.test(variable) || ROOT_KEY_NAME_RE.test(variable),
    });
  }
  return assignments;
}

interface MeasureContext {
  readonly taint: Taint;
  readonly functions: ReadonlySet<string>;
}

/** A PROVEN-tainted variable reaching the argv of a forking process. */
function taintedArgvFinding(
  command: ShellCommand,
  head: string,
  operands: readonly Word[],
  context: MeasureContext,
): Finding | undefined {
  for (const word of operands) {
    const hit = referencedVariables(word).find((name) => context.taint.proven.has(name));
    if (hit === undefined) continue;
    return {
      line: command.line,
      kind: "argv-secret",
      evidence: `${head} … $${hit} (ps-visible)`,
      channel: "broadcast",
      material: context.taint.rootKey.has(hit) ? "root-key" : "stored-credential",
    };
  }
  return undefined;
}

/** A flag whose operand the tool itself declares to BE the secret. */
function declaredFlagArgvFindings(command: ShellCommand, head: string, operands: readonly Word[]): readonly Finding[] {
  const subcommand = operands.find((word) => !word.text.startsWith("-"))?.text;
  const findings: Finding[] = [];
  for (const rule of ARGV_SECRET_RULES) {
    if (rule.command !== head) continue;
    if (rule.subcommand !== undefined && rule.subcommand !== subcommand) continue;
    const label = rule.subcommand === undefined ? head : `${head} ${rule.subcommand}`;
    for (let index = 0; index < operands.length; index += 1) {
      const flag = operands[index]?.text ?? "";
      // A trailing flag has no operand — `security find-generic-password -w`
      // means "print it", not "here it is".
      if (!rule.valueFlags.includes(flag) || operands[index + 1] === undefined) continue;
      findings.push({
        line: command.line,
        kind: "argv-secret",
        evidence: `${label} ${flag} <value in argv>`,
        channel: "broadcast",
        material: rule.material,
      });
    }
  }
  return findings;
}

function argvFindings(
  command: ShellCommand,
  head: string,
  operands: readonly Word[],
  context: MeasureContext,
): readonly Finding[] {
  const tainted = taintedArgvFinding(command, head, operands, context);
  const declared = declaredFlagArgvFindings(command, head, operands);
  return tainted === undefined ? declared : [tainted, ...declared];
}

/**
 * `env NAME="$SECRET" cmd` versus `NAME="$SECRET" cmd` — the difference is the
 * whole rule, and no line regex has it.
 *
 * A bare `NAME=value cmd` prefix is handled by the SHELL: it sets the variable in
 * the child's environment and the assignment never becomes an argument. That is
 * the one-child, one-exec shape `spawnWithCredential` blesses — confined.
 *
 * `env NAME=value cmd` runs `/usr/bin/env`, so `NAME=value` IS argv, and the
 * secret is in `ps` for the lifetime of the process. Measured live at
 * `tools/setup/common/mise.sh:149`, which the first version of this file scored
 * `T0-no-measured-key-contact` because `effectiveWords` strips both forms
 * identically. That miss is why this function exists.
 */
/** Which material class a path names, if any. `undefined` = not a key file. */
export function keyFileMaterial(text: string): Material | undefined {
  if (ROOT_KEY_FILE_RE.test(text)) return "root-key";
  if (CREDENTIAL_FILE_RE.test(text)) return "stored-credential";
  return undefined;
}

// zeta-elevator-not-argv: shell-parser vocabulary — wrapper names to strip while parsing
// someone else's script. Nothing here is ever spawned.
const ENV_WRAPPERS: ReadonlySet<string> = new Set(["sudo", "doas", "command", "exec", "time", "retry"]);
const ENV_FLAGS_WITH_OPERAND: ReadonlySet<string> = new Set([
  "-u",
  "--unset",
  "-C",
  "--chdir",
  "-S",
  "--split-string",
  "--argv0",
]);

/**
 * `env` must be in COMMAND position for its operands to be argv. It still is
 * when wrapped by `sudo`/`command` or by a locally-defined forwarding function —
 * `install_with_retry env -u … mise install` at `mise.sh:149` is the live case,
 * and requiring position 0 missed it. A local function that does NOT forward its
 * arguments makes this a false positive; that is the stated cost of not
 * resolving function bodies.
 */
function envIsInCommandPosition(words: readonly Word[], envIndex: number, context: MeasureContext): boolean {
  return words
    .slice(0, envIndex)
    .every(
      (word) => ENV_WRAPPERS.has(word.text) || context.functions.has(word.text) || /^[A-Za-z_]\w*=/.test(word.text),
    );
}

function envPrefixFindings(command: ShellCommand, context: MeasureContext): readonly Finding[] {
  const words = command.words;
  const envIndex = words.findIndex((word) => word.text === "env");
  if (envIndex === -1 || !envIsInCommandPosition(words, envIndex, context)) return [];

  const findings: Finding[] = [];
  const tail = words.slice(envIndex + 1);
  for (let index = 0; index < tail.length; index += 1) {
    const word = tail[index];
    if (word === undefined) break;
    if (word.text.startsWith("-")) {
      if (ENV_FLAGS_WITH_OPERAND.has(word.text)) index += 1;
      continue; // env's own flags precede the assignments
    }
    const match = /^([A-Za-z_]\w*)=([\S\s]*)$/.exec(word.text);
    if (match === null) break; // the command word; assignments are behind us
    const [, variable = "", value = ""] = match;
    const secretRef = referencedVariables({ text: value, quoting: word.quoting }).find(
      (name) => context.taint.proven.has(name) || SECRET_NAME_RE.test(name) || ROOT_KEY_NAME_RE.test(name),
    );
    if (secretRef === undefined) continue;
    findings.push({
      line: command.line,
      kind: "argv-secret",
      evidence: `env ${variable}="$${secretRef}" … (ps-visible; a bare NAME= prefix would not be)`,
      channel: "broadcast",
      material: ROOT_KEY_NAME_RE.test(secretRef) ? "root-key" : "stored-credential",
    });
  }
  return findings;
}

/**
 * Measure one script. PURE: `(path, text) -> ScriptExposure`, no I/O.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- one pass, one rule family per block; splitting hides the pass
export function measureScriptExposure(path: string, text: string): ScriptExposure {
  const commands = tokenizeShell(text);
  const taint = collectTaint(commands);
  const functions = collectFunctionNames(text);
  const context: MeasureContext = { taint, functions };
  const findings: Finding[] = [];

  for (const command of commands) {
    const words = effectiveWords(command);
    const head = words[0]?.text;
    if (head === undefined || head === "") continue;
    const operands = words.slice(1);
    const forks = !SHELL_BUILTINS.has(head) && !functions.has(head);
    const subcommand = operands.find((word) => !word.text.startsWith("-"))?.text;

    if (forks) findings.push(...argvFindings(command, head, operands, context));
    findings.push(...envPrefixFindings(command, context));

    for (const rule of KEYSTORE_RULES) {
      if (rule.command !== head) continue;
      if (subcommand === undefined || !rule.subcommands.includes(subcommand)) continue;
      findings.push({
        line: command.line,
        kind: rule.kind,
        evidence: truncate(command.raw),
        channel: rule.channel,
        material: "stored-credential",
      });
    }

    if (head === "read" && operands.some((word) => /^-[a-zA-Z]*s/.test(word.text)) && !isKeypressRead(words)) {
      const target = operands.find((word) => !word.text.startsWith("-") && taint.proven.has(word.text))?.text ?? "";
      findings.push({
        line: command.line,
        kind: "secure-interactive-read",
        evidence: `read -s ${target}`,
        channel: "confined",
        material: taint.rootKey.has(target) ? "root-key" : "stored-credential",
      });
    }
    const secureDialog = head === "osascript" && command.heredocBodies.some((body) => body.includes("hidden answer"));
    if (head === "pbpaste" || secureDialog) {
      findings.push({
        line: command.line,
        kind: "clipboard-secret-read",
        evidence: `${head} (secure capture)`,
        channel: "confined",
        material: "stored-credential",
      });
    }
    if (ROOT_KEY_GENERATORS.has(head)) {
      findings.push({
        line: command.line,
        kind: "root-key-generation",
        evidence: truncate(command.raw),
        channel: "on-disk",
        material: "root-key",
      });
    }

    if (head === "export") {
      for (const word of operands) {
        const variable = /^([A-Za-z_]\w*)=/.exec(word.text)?.[1];
        if (variable === undefined) continue;
        if (!SECRET_NAME_RE.test(variable) && !ROOT_KEY_NAME_RE.test(variable)) continue;
        findings.push({
          line: command.line,
          kind: "exported-credential",
          evidence: `export ${variable}=… (crosses exec)`,
          channel: "broadcast",
          material: ROOT_KEY_NAME_RE.test(variable) ? "root-key" : "stored-credential",
        });
      }
    }
    // A script that PRINTS an `export SECRET=` line is generating an env file.
    if (["echo", "printf", "cat"].includes(head)) {
      const emitted = [...operands.map((word) => word.text), ...command.heredocBodies];
      for (const chunk of emitted) {
        const exported = /\bexport\s+([A-Za-z_]\w*)/.exec(chunk)?.[1];
        if (exported === undefined) continue;
        if (!SECRET_NAME_RE.test(exported) && !ROOT_KEY_NAME_RE.test(exported)) continue;
        findings.push({
          line: command.line,
          kind: "credential-env-file",
          evidence: `emits: export ${exported}=…`,
          channel: "broadcast",
          material: "stored-credential",
        });
        break;
      }
    }

    for (const word of words) {
      const fileMaterial = keyFileMaterial(word.text);
      if (fileMaterial === undefined) continue;
      findings.push({
        line: command.line,
        kind: "key-file-touch",
        evidence: `${head} … ${truncate(word.text)}`,
        channel: "on-disk",
        material: fileMaterial,
      });
      break;
    }
    for (const word of operands) {
      if (!EXECUTION_IDENTITY_RE.test(word.text)) continue;
      findings.push({
        line: command.line,
        kind: "execution-identity-write",
        evidence: `${head} … ${truncate(word.text)}`,
        channel: "on-disk",
        material: "execution-identity",
      });
      break;
    }
    if (PRIVILEGED_COMMANDS.has(command.words[0]?.text ?? "") || PRIVILEGED_COMMANDS.has(head)) {
      findings.push({
        line: command.line,
        kind: "privileged-operation",
        evidence: truncate(command.raw),
        channel: "none",
        material: "execution-identity",
      });
    }

    // The blind spots, recorded rather than silently missed.
    if ((head === "source" || head === ".") && (operands[0]?.text ?? "") !== "") {
      findings.push({
        line: command.line,
        kind: "sourced-library-edge",
        evidence: `source ${truncate(operands[0]?.text ?? "")}`,
        channel: "none",
        material: "none",
      });
    }
    if (head === "eval" || /^\$\{?[A-Za-z_]/.test(head)) {
      findings.push({
        line: command.line,
        kind: "opaque-dispatch",
        evidence: truncate(command.raw),
        channel: "none",
        material: "none",
      });
    }
  }

  // Two rules can witness the same leak on the same line (a proven-tainted word
  // AND a declared secret flag on `security … -w "$TOKEN"`). One line, one
  // finding — otherwise the tie-breaker counts a leak twice.
  const byKey = new Map<string, Finding>();
  for (const finding of findings) {
    const key = `${String(finding.line)}:${finding.kind}`;
    if (!byKey.has(key)) byKey.set(key, finding);
  }
  const deduped = [...byKey.values()];
  const keyBearing = deduped.filter((finding) => MATERIAL_RANK[finding.material] > 0);
  const material = keyBearing.reduce<Material>(
    (best, finding) => (MATERIAL_RANK[finding.material] > MATERIAL_RANK[best] ? finding.material : best),
    "none",
  );
  const channel = keyBearing.reduce<Channel>(
    (best, finding) => (CHANNEL_RANK[finding.channel] > CHANNEL_RANK[best] ? finding.channel : best),
    "none",
  );

  return {
    path,
    findings: deduped.toSorted((left, right) => left.line - right.line || (left.kind < right.kind ? -1 : left.kind > right.kind ? 1 : 0)),
    material,
    channel,
    tier: tierOf(material, channel),
    provenSecretVariables: [...taint.proven].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    declaredSecretVariables: [...taint.declared].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
  };
}

/**
 * The one place POLICY lives. Facts (findings) are separable from the ordering
 * they are read under — detection is dual-use; the oracle decides. Swap this
 * function and the sequence changes without any measurement changing.
 */
export function tierOf(material: Material, channel: Channel): ExposureTier {
  const broadcast = CHANNEL_RANK[channel] >= CHANNEL_RANK.broadcast;
  if (material === "root-key") return broadcast ? "T5-root-key-broadcast" : "T4-root-key-confined";
  if (material === "stored-credential") return broadcast ? "T3-credential-broadcast" : "T2-credential-confined";
  if (material === "execution-identity") return "T1-execution-identity";
  return "T0-no-measured-key-contact";
}

/** Distinct key-bearing finding KINDS. Counting occurrences would let 40 `sudo` calls outweigh 3 keystore writes. */
export function distinctKeyKinds(exposure: ScriptExposure): number {
  return new Set(
    exposure.findings.filter((finding) => MATERIAL_RANK[finding.material] > 0).map((finding) => finding.kind),
  ).size;
}

/**
 * Total order over measured scripts. Deterministic and stated: tier, then
 * material, then channel, then distinct key-bearing kinds, then ordinal path.
 * No tie is broken by judgement.
 */
export function rankExposures(exposures: readonly ScriptExposure[]): readonly ScriptExposure[] {
  return [...exposures].sort((left, right) => {
    const byTier = TIER_ORDER.indexOf(left.tier) - TIER_ORDER.indexOf(right.tier);
    if (byTier !== 0) return byTier;
    const byMaterial = MATERIAL_RANK[right.material] - MATERIAL_RANK[left.material];
    if (byMaterial !== 0) return byMaterial;
    const byChannel = CHANNEL_RANK[right.channel] - CHANNEL_RANK[left.channel];
    if (byChannel !== 0) return byChannel;
    const byKinds = distinctKeyKinds(right) - distinctKeyKinds(left);
    if (byKinds !== 0) return byKinds;
    return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
  });
}

// ───────────────────────────── rendering ─────────────────────────

/** Group repeated kinds so 40 `sudo` lines do not bury 3 keystore writes. */
function summarizeKinds(exposure: ScriptExposure): readonly string[] {
  const byKind = new Map<FindingKind, number[]>();
  for (const finding of exposure.findings) {
    if (MATERIAL_RANK[finding.material] === 0) continue;
    byKind.set(finding.kind, [...(byKind.get(finding.kind) ?? []), finding.line]);
  }
  return [...byKind.entries()].map(([kind, lines]) => {
    const shown = lines.slice(0, 4).map(String).join(",");
    const more = lines.length > 4 ? `,+${String(lines.length - 4)}` : "";
    return `${kind}@${shown}${more}`;
  });
}

export function renderMarkdown(ranked: readonly ScriptExposure[]): string {
  const lines: string[] = [];
  lines.push("| # | script | tier | material | channel | witnesses (kind@lines) |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  ranked.forEach((exposure, index) => {
    const witnesses = summarizeKinds(exposure).map((witness) => `\`${witness}\``);
    const witnessCell = witnesses.length === 0 ? "—" : witnesses.join(" ");
    const cells = [
      String(index + 1),
      `\`${exposure.path}\``,
      exposure.tier,
      exposure.material,
      exposure.channel,
      witnessCell,
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  });
  return `${lines.join("\n")}\n`;
}

export function renderReport(ranked: readonly ScriptExposure[]): string {
  const lines: string[] = [];
  lines.push("# Shell key-exposure measurement");
  lines.push("");
  lines.push(`measured_scripts: ${String(ranked.length)}`);
  for (const tier of TIER_ORDER) {
    lines.push(`${tier}: ${String(ranked.filter((exposure) => exposure.tier === tier).length)}`);
  }
  lines.push("");
  for (const exposure of ranked) {
    const witnesses = summarizeKinds(exposure);
    lines.push(`${exposure.tier}  ${exposure.path}`);
    if (witnesses.length > 0) lines.push(`    ${witnesses.join("  ")}`);
    if (exposure.provenSecretVariables.length > 0) {
      lines.push(`    proven-secret vars: ${exposure.provenSecretVariables.join(", ")}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

// ─────────────────────────────── CLI ─────────────────────────────

export function main(argv: readonly string[] = process.argv.slice(2)): 0 | 1 | 2 {
  const json = argv.includes("--json");
  const markdown = argv.includes("--markdown");
  const unknown = argv.find((arg) => arg !== "--json" && arg !== "--markdown");
  if (unknown !== undefined) {
    process.stderr.write(`unknown arg: ${unknown}\n`);
    return 2;
  }

  let repoRoot: string;
  try {
    repoRoot = repoRootFromGit();
  } catch (err) {
    process.stderr.write(`ERROR: ${(err as Error).message}\n`);
    return 2;
  }

  const exposures = EXPECTED_RETAINED_SHELL.map((path) =>
    measureScriptExposure(path, readFileSync(join(repoRoot, path), "utf8")),
  );
  const ranked = rankExposures(exposures);

  if (json) process.stdout.write(`${JSON.stringify(ranked, null, 2)}\n`);
  else if (markdown) process.stdout.write(renderMarkdown(ranked));
  else process.stdout.write(renderReport(ranked));
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
