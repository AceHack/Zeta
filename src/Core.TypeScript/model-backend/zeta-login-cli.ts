#!/usr/bin/env bun
// zeta-login-cli.ts — one edge for every declared provider (account login first).
//
// `github-login-cli.ts` stays as the GIT_ASKPASS shim. This CLI is the roster
// consumer: list / status / login / token, JSON-out, no TTY prompts besides the
// one human device-code step. Unwired providers fail closed with the next slice
// named — a check with a bypass is not a check.

import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";

import type { AuthProvider } from "./auth-provider.ts";
import type { HttpTransport } from "./backend.ts";
import { fetchTransport } from "./fetch-transport.ts";
import { githubDeviceProvider } from "./github-auth.ts";
import { deviceLogin, defaultStoreDir, type LoginDeps } from "./login-runner.ts";
import { openAiCodexProvider } from "./openai-auth.ts";
import { importVendorSession } from "./import-vendor-session.ts";
import { preferredLogin, PROVIDER_ROSTER, resolveProvider, type ProviderEntry } from "./provider-roster.ts";
import { fileTokenStore, type StoreFs, type TokenStore } from "./token-store.ts";

export type CliIo = {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
};

export function nodeStoreFs(): StoreFs {
  return {
    readFile: (path: string) => readFile(path, "utf8"),
    writeFile: (path: string, contents: string) => writeFile(path, contents, { mode: 0o600 }),
    nowIso: () => new Date().toISOString(),
  };
}

/// The AuthProviders we can actually run. Codex shares openai's provider.
export function authProviderFor(entry: ProviderEntry): AuthProvider | null {
  if (entry.storeAs === "github") return githubDeviceProvider;
  if (entry.storeAs === "openai") return openAiCodexProvider;
  return null;
}

export type StatusRow = {
  readonly id: string;
  readonly displayName: string;
  readonly status: ProviderEntry["status"];
  readonly loginKind: ProviderEntry["loginKind"];
  readonly storeAs: string;
  readonly loggedIn: boolean;
  readonly execution: ProviderEntry["execution"];
};

export async function statusRows(store: TokenStore): Promise<readonly StatusRow[]> {
  const rows: StatusRow[] = [];
  for (const p of PROVIDER_ROSTER) {
    const stored = await store.load(p.storeAs);
    rows.push({
      id: p.id,
      displayName: p.displayName,
      status: p.status,
      loginKind: p.loginKind,
      storeAs: p.storeAs,
      loggedIn: stored !== null,
      execution: p.execution,
    });
  }
  return rows;
}

export async function runList(io: CliIo, json: boolean): Promise<number> {
  if (json) {
    io.out(JSON.stringify({ providers: PROVIDER_ROSTER }, null, 2));
    return 0;
  }
  for (const p of PROVIDER_ROSTER) {
    io.out(`${p.id}\t${p.status}\t${preferredLogin(p) ?? "-"}\t${p.displayName}`);
  }
  return 0;
}

export async function runStatus(store: TokenStore, io: CliIo, json: boolean): Promise<number> {
  const rows = await statusRows(store);
  if (json) {
    io.out(JSON.stringify({ status: rows }, null, 2));
    return 0;
  }
  for (const r of rows) {
    const session = r.loggedIn ? "logged-in" : "logged-out";
    io.out(`${r.id}\t${r.status}\t${session}`);
  }
  return 0;
}

export async function runApiKeyLogin(
  entry: ProviderEntry,
  store: TokenStore,
  io: CliIo,
  deps: { readonly fromFile: string | undefined; readonly readFile: (path: string) => Promise<string>; readonly now: () => string },
): Promise<number> {
  if (deps.fromFile === undefined || deps.fromFile.length === 0) {
    io.err(
      JSON.stringify({
        ok: false,
        error: "api-key-file-required",
        provider: entry.id,
        execution: entry.execution,
        hint: `harny login ${entry.id} --from-file <path-to-key>`,
      }),
    );
    return 2;
  }
  let raw: string;
  try {
    raw = (await deps.readFile(deps.fromFile)).trim();
  } catch {
    io.err(`${entry.id} login failed: cannot read --from-file`);
    return 1;
  }
  if (raw.length === 0) {
    io.err(`${entry.id} login failed: empty key file`);
    return 1;
  }
  await store.save({ provider: entry.storeAs, tokens: { accessToken: raw, refreshToken: "" }, lastRefresh: deps.now() });
  io.out(`Logged in — ${entry.id} account key stored (remote-only agent; no local Ace/Zeta tools).`);
  return 0;
}

export async function runLogin(
  rawId: string,
  store: TokenStore,
  io: CliIo,
  deps?: Partial<LoginDeps> & {
    readonly providers?: (entry: ProviderEntry) => AuthProvider | null;
    readonly fromFile?: string;
    readonly readFile?: (path: string) => Promise<string>;
  },
): Promise<number> {
  const entry = resolveProvider(rawId);
  if (!entry) {
    io.err(`unknown provider: ${rawId}`);
    return 2;
  }
  if (entry.loginKind === "account-api-key") {
    return runApiKeyLogin(entry, store, io, {
      fromFile: deps?.fromFile,
      readFile: deps?.readFile ?? ((path) => readFile(path, "utf8")),
      now: deps?.now ?? (() => new Date().toISOString()),
    });
  }
  const resolve = deps?.providers ?? authProviderFor;
  const provider = resolve(entry);
  if (provider === null) {
    io.err(
      JSON.stringify({
        ok: false,
        error: "no-auth-provider",
        provider: entry.id,
        preferredFlow: preferredLogin(entry),
        try: entry.vendorCredPaths.length > 0 ? `zeta-login import ${entry.id}` : null,
        next: "081M100RH29087G0R0031HHGJ0",
      }),
    );
    return 1;
  }
  let outcome;
  try {
    outcome = await deviceLogin(provider, {
      transport: deps?.transport ?? fetchTransport(),
      store,
      onCode: (uri, code) => {
        io.out(`Open ${uri} and enter code: ${code}`);
        io.out("Waiting for approval…");
      },
      sleep: deps?.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      now: deps?.now ?? (() => new Date().toISOString()),
      ...(deps?.maxPolls !== undefined ? { maxPolls: deps.maxPolls } : {}),
    });
  } catch (e) {
    io.err(`${entry.id} login failed: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  if (!outcome.ok) {
    io.err(`${entry.id} login failed: ${outcome.error}`);
    return 1;
  }
  io.out(`Logged in — token stored for provider '${entry.storeAs}'.`);
  return 0;
}

export type ImportDeps = {
  readonly home: string;
  readonly readFile: (path: string) => Promise<string>;
  readonly now: () => string;
};

export async function runImport(rawId: string, store: TokenStore, io: CliIo, deps: ImportDeps): Promise<number> {
  const entry = resolveProvider(rawId);
  if (!entry) {
    io.err(`unknown provider: ${rawId}`);
    return 2;
  }
  const outcome = await importVendorSession(entry.vendorCredPaths, deps.home, deps.readFile);
  if (!outcome.ok) {
    io.err(
      JSON.stringify({
        ok: false,
        error: "vendor-session-missing",
        provider: entry.id,
        hint: entry.vendorCli === null ? outcome.error : `log in with \`${entry.vendorCli}\` then re-run import`,
        detail: outcome.error,
      }),
    );
    return 1;
  }
  await store.save({ provider: entry.storeAs, tokens: outcome.tokens, lastRefresh: deps.now() });
  io.out(`Imported ${entry.id} session from vendor CLI file into store '${entry.storeAs}'.`);
  return 0;
}

export async function runToken(rawId: string, store: TokenStore, io: CliIo): Promise<number> {
  const entry = resolveProvider(rawId);
  if (!entry) {
    io.err(`unknown provider: ${rawId}`);
    return 2;
  }
  const stored = await store.load(entry.storeAs);
  if (!stored) {
    io.err(`not logged in (no stored ${entry.storeAs} tokens — run login ${entry.id})`);
    return 1;
  }
  io.out(stored.tokens.accessToken);
  return 0;
}

function takeFlag(argv: readonly string[], flag: string): { readonly rest: readonly string[]; readonly present: boolean } {
  return { rest: argv.filter((a) => a !== flag), present: argv.includes(flag) };
}

function takeOption(argv: readonly string[], flag: string): { readonly rest: readonly string[]; readonly value: string | undefined } {
  const rest: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === flag) {
      value = argv[i + 1];
      i += 1;
      continue;
    }
    rest.push(argv[i]!);
  }
  return { rest, value };
}

export async function main(
  argv: readonly string[],
  store: TokenStore,
  io: CliIo,
  extra?: {
    readonly transport?: HttpTransport;
    readonly providers?: (entry: ProviderEntry) => AuthProvider | null;
    readonly importDeps?: ImportDeps;
    readonly readFile?: (path: string) => Promise<string>;
  },
): Promise<number> {
  const jsoned = takeFlag(argv, "--json");
  const fromFile = takeOption(jsoned.rest, "--from-file");
  const [cmd = "", ...rest] = fromFile.rest;
  switch (cmd) {
    case "list":
      return runList(io, jsoned.present);
    case "status":
      return runStatus(store, io, jsoned.present);
    case "login":
      if (rest[0] === undefined || rest[0].length === 0) {
        io.err("usage: zeta-login-cli.ts login <provider> [--from-file <path>]");
        return 2;
      }
      return runLogin(rest[0], store, io, {
        ...extra,
        ...(fromFile.value !== undefined ? { fromFile: fromFile.value } : {}),
        ...(extra?.readFile !== undefined ? { readFile: extra.readFile } : {}),
      });
    case "import":
      if (rest[0] === undefined || rest[0].length === 0) {
        io.err("usage: zeta-login-cli.ts import <provider>");
        return 2;
      }
      {
        const importDeps = extra?.importDeps ?? {
          home: homedir(),
          readFile: (path) => readFile(path, "utf8"),
          now: () => new Date().toISOString(),
        };
        return runImport(rest[0], store, io, importDeps);
      }
    case "token":
      if (rest[0] === undefined || rest[0].length === 0) {
        io.err("usage: zeta-login-cli.ts token <provider>");
        return 2;
      }
      return runToken(rest[0], store, io);
    default:
      io.err("usage: zeta-login-cli.ts <list|status|login <provider>|import <provider>|token <provider>> [--json]");
      return 2;
  }
}

const invokedDirectly =
  typeof process.argv[1] === "string" && /zeta-login-cli\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const dir = defaultStoreDir(homedir());
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const store = fileTokenStore(dir, nodeStoreFs());
  const io: CliIo = { out: (l) => console.log(l), err: (l) => console.error(l) };
  main(process.argv.slice(2), store, io)
    .then((code) => process.exit(code))
    .catch((e: unknown) => {
      console.error(`zeta-login-cli failed: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(1);
    });
}
