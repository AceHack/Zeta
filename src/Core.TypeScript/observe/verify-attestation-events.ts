#!/usr/bin/env bun
/**
 * verify-attestation-events.ts — the filesystem binding for attestation records,
 * and the only place in this feature that touches a disk.
 *
 * Work-item 081M0BTG2M7087G0R0011X5ESW. Format + cryptography: `attestation-record.ts`.
 * Same split, for the same reason, as `hygiene/build-receipt.ts` /
 * `hygiene/verify-build-receipt.ts`: the pure half runs in a browser tab.
 *
 * HOST-INDEPENDENT: no forge API, no network, no `ssh-keygen` binary. A peer with a
 * clone can check any attestation any other peer wrote. Checkable:
 *   rg 'fetch\(|https://|gh api|spawnSync' src/Core.TypeScript/observe/verify-attestation-events.ts
 * returns nothing.
 *
 * NO PRIVATE KEY. This program reads public keys and events and prints verdicts. The
 * `message` subcommand exists precisely so that signing happens somewhere else, by
 * whoever holds the key, with the key never leaving their agent:
 *
 *   bun src/Core.TypeScript/observe/verify-attestation-events.ts message docs/observe-events/<id>.json \
 *     --signer SHA256:<fingerprint> > msg.bin
 *   ssh-keygen -Y sign -n zeta.attestation.v1 -f ~/.ssh/<key> msg.bin
 *   # then add to the event JSON, and re-run `verify`:
 *   #   "signature": { "version": "1", "signer": "SHA256:…", "sshsig": "<one line, armor stripped>" }
 *
 * Usage:
 *   bun .../verify-attestation-events.ts verify [--dir <path>] [--repo <path>]
 *        [--roster <path>]...      extra authorized_keys-style files, persona = file stem
 *        [--require-bound]         an UNBOUND record is a failure, not a report
 *   bun .../verify-attestation-events.ts message <event.json> --signer SHA256:<fp>
 *
 * Exit codes:
 *   0  no record was REFUSED (and, with --require-bound, none was unbound)
 *   1  usage / environment error
 *   2  a record was refused, or --require-bound found an unbound record
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRoster, type RosterEntry } from "../crypto/sshsig.ts";
import {
  ATTESTATION_NAMESPACE,
  attestationSigningBytes,
  verifyAttestationRecord,
  type AttestationRecord,
  type AttestationVerdict,
  type PersonaKeyRoster,
} from "./attestation-record.ts";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "..", "..", "..");
export const EVENT_DIR = "docs/observe-events";

// ═══ roster: which keys may speak as which persona ═════════════════════════

/**
 * Every committed `maintainers/**\/ssh-pubkeys.txt`, keyed by the PERSONA that owns it.
 *
 * The persona is the name of the directory holding the file, so
 * `maintainers/personas/otto/ssh-pubkeys.txt` binds keys to `otto` and
 * `maintainers/aaron/ssh-pubkeys.txt` binds keys to `aaron`. These are the same
 * public halves the SSH CA and git commit signing use; no second key registry is
 * minted.
 *
 * RECURSIVE, unlike `verify-build-receipt.ts` `defaultRosterPaths`, which scans one
 * level and therefore does not see `maintainers/personas/*` at all. A build receipt
 * names no persona so a flat trusted-key set answers its question; an attestation's
 * entire content is WHO witnessed whom, so it needs the name-keyed form.
 *
 * `maintainers/zeta/ssh-ca.pub` is deliberately NOT included: it is a certificate
 * authority key, and letting it also speak as a persona would collapse two
 * authorities into one key for no gain.
 */
export function discoverPersonaRosterPaths(repoRoot: string): readonly { persona: string; path: string }[] {
  const base = join(repoRoot, "maintainers");
  const out: { persona: string; path: string }[] = [];
  if (!existsSync(base)) return out;

  const walk = (dir: string, depth: number): void => {
    if (depth > 4) return; // a bound on work, not a policy — the tree is two deep today
    let entries: readonly string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    const keyFile = join(dir, "ssh-pubkeys.txt");
    if (existsSync(keyFile)) out.push({ persona: basename(dir), path: keyFile });
    for (const e of entries) {
      const child = join(dir, e);
      try {
        if (statSync(child).isDirectory()) walk(child, depth + 1);
      } catch {
        /* unreadable entry is not a roster entry */
      }
    }
  };
  walk(base, 0);
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

/**
 * Build the persona -> keys map. Fails CLOSED on an ambiguous persona name.
 *
 * Two directories claiming the same persona would make "which keys may speak as
 * `otto`" have two answers, and a verifier that picks one is a verifier that can be
 * steered by adding a directory. Throwing is the conservative reading.
 */
export function buildPersonaRoster(sources: readonly { persona: string; path: string }[]): PersonaKeyRoster {
  const map = new Map<string, readonly RosterEntry[]>();
  for (const { persona, path } of sources) {
    const entries = parseRoster(readFileSync(path, "utf8"), path);
    if (entries.length === 0) continue; // a file with no parseable key confers nothing
    const existing = map.get(persona);
    if (existing !== undefined) {
      throw new Error(
        `persona '${persona}' is claimed by two roster files (${existing[0]?.source ?? "?"} and ${path}) — ` +
          "refusing to guess which keys may speak as it",
      );
    }
    map.set(persona, entries);
  }
  return map;
}

// ═══ reading records ═══════════════════════════════════════════════════════

/** A parsed record plus where it came from. */
export interface LoadedRecord {
  readonly file: string;
  readonly record: AttestationRecord;
}

/**
 * Read the attestation records out of an event directory.
 *
 * Selection is by `kind === "attestation"` on the parsed content, never by filename:
 * this folder holds three naming schemes and lexical order is not time order
 * (`hygiene/audit-observe-event-filenames.ts`), so any filename-derived selection
 * here would silently attest the wrong subset — the exact defect that once made
 * `society` the only attestable peer.
 */
export function loadAttestationRecords(dir: string): readonly LoadedRecord[] {
  return selectAttestationRecords(loadEventJson(dir));
}

/** One parsed event file, before anything decides what kind of event it is. */
export interface LoadedEventJson {
  readonly file: string;
  readonly raw: unknown;
}

/**
 * Read and parse every `.json` in an event directory, once.
 *
 * Split out from `loadAttestationRecords` so a caller that needs TWO views of the corpus — the
 * attestations and the retractions that supersede them — pays for one disk pass instead of two.
 * The folder is ~2,550 files; a suite that scans it four times spends its budget on `JSON.parse`
 * rather than on assertions, and the tests that noticed did so by timing out.
 *
 * A file that will not parse is skipped rather than thrown on: this folder holds three naming
 * schemes and several unrelated file kinds, and `audit-observe-event-filenames.ts` owns shape.
 */
export function loadEventJson(dir: string): readonly LoadedEventJson[] {
  const out: LoadedEventJson[] = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    try {
      out.push({ file: f, raw: JSON.parse(readFileSync(join(dir, f), "utf8")) });
    } catch {
      continue; // not our file to judge; `audit-observe-event-filenames.ts` owns shape
    }
  }
  return out;
}

/**
 * Select the attestation records out of already-parsed event JSON.
 *
 * Selection is by `kind === "attestation"` on the parsed content, never by filename — unchanged
 * from when this logic lived inside `loadAttestationRecords`, and load-bearing for the same
 * reason: this folder holds three naming schemes and lexical order is not time order.
 */
export function selectAttestationRecords(entries: readonly LoadedEventJson[]): readonly LoadedRecord[] {
  const out: LoadedRecord[] = [];
  for (const { file, raw } of entries) {
    const rec = raw as Partial<AttestationRecord>;
    if (rec?.kind !== "attestation" || typeof rec.attestation !== "object" || rec.attestation === null) continue;
    out.push({ file, record: rec as AttestationRecord });
  }
  return out;
}

export interface VerifyReport {
  readonly bound: number;
  readonly unbound: number;
  readonly refused: number;
  readonly lines: readonly string[];
}

function describe(file: string, v: AttestationVerdict): string {
  switch (v.status) {
    case "bound":
      return `BOUND     ${file}  signer=${v.signer} (${v.signerSource})`;
    case "unbound":
      return `UNBOUND   ${file}  no signature — \`by\` is a self-claim, not an attribution`;
    case "refused":
      return `REFUSED   ${file}  ${v.reason}: ${v.detail}`;
  }
}

export function verifyAll(records: readonly LoadedRecord[], roster: PersonaKeyRoster): VerifyReport {
  let bound = 0;
  let unbound = 0;
  let refused = 0;
  const lines: string[] = [];
  for (const { file, record } of records) {
    const v = verifyAttestationRecord(record, { roster });
    if (v.status === "bound") bound++;
    else if (v.status === "unbound") unbound++;
    else refused++;
    // Bound records are the boring case; printing every one buries the two that matter.
    if (v.status !== "bound") lines.push(describe(file, v));
  }
  return { bound, unbound, refused, lines };
}

// ═══ CLI ═══════════════════════════════════════════════════════════════════

function flagValue(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function cmdVerify(argv: readonly string[]): number {
  const repo = flagValue(argv, "--repo") ?? REPO_ROOT;
  const dir = flagValue(argv, "--dir") ?? join(repo, EVENT_DIR);
  const requireBound = argv.includes("--require-bound");

  const sources = [...discoverPersonaRosterPaths(repo)];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--roster") continue;
    const p = argv[i + 1];
    if (p === undefined) {
      console.error("--roster needs a path");
      return 1;
    }
    // An explicit roster file is keyed by its own stem, so `--roster /tmp/otto.txt`
    // grants keys to `otto` and nothing else. There is deliberately no flag that
    // grants a key to every persona.
    sources.push({ persona: basename(p).replace(/\.[^.]+$/, ""), path: p });
  }

  let roster: PersonaKeyRoster;
  try {
    roster = buildPersonaRoster(sources);
  } catch (err) {
    console.error(`[attestations] ${(err as Error).message}`);
    return 1;
  }

  let records: readonly LoadedRecord[];
  try {
    records = loadAttestationRecords(dir);
  } catch (err) {
    console.error(`[attestations] cannot read ${dir}: ${(err as Error).message}`);
    return 1;
  }

  const report = verifyAll(records, roster);
  for (const line of report.lines) console.log(line);

  console.log(
    `[attestations] ${records.length} record(s) in ${dir}; ` +
      `${report.bound} bound, ${report.unbound} unbound, ${report.refused} refused; ` +
      `roster covers ${roster.size} persona(s)`,
  );

  // "Nothing failed" and "nothing was checked" must not print the same sentence.
  if (records.length === 0) {
    console.error("[attestations] no attestation records found — a check that inspects nothing is not a passing check");
    return 1;
  }
  if (report.refused > 0) return 2;
  if (requireBound && report.unbound > 0) {
    console.error(`[attestations] --require-bound: ${report.unbound} record(s) carry no signature`);
    return 2;
  }
  return 0;
}

function cmdMessage(argv: readonly string[]): number {
  const file = argv.find((a) => !a.startsWith("--") && a !== flagValue(argv, "--signer"));
  const signer = flagValue(argv, "--signer");
  if (file === undefined || signer === undefined) {
    console.error("usage: message <event.json> --signer SHA256:<fingerprint>");
    return 1;
  }
  let record: AttestationRecord;
  try {
    record = JSON.parse(readFileSync(file, "utf8")) as AttestationRecord;
  } catch (err) {
    console.error(`cannot read ${file}: ${(err as Error).message}`);
    return 1;
  }
  const a = record.attestation;
  // The signer fingerprint is INSIDE the signed bytes, which is why it is a required
  // argument rather than something filled in afterwards: a signature that did not
  // commit to the identity claiming it could be re-attributed in the JSON.
  const bytes = attestationSigningBytes({
    id: record.id,
    attestor: a.attestor,
    attested: a.attested,
    claim: a.claim,
    windowStart: a.windowStart,
    windowEnd: a.windowEnd,
    eventCount: a.eventCount,
    attestedDigest: a.attestedDigest,
    ...(a.simultaneousParticipants !== undefined ? { simultaneousParticipants: a.simultaneousParticipants } : {}),
    signer,
  });
  process.stdout.write(bytes);
  console.error(`# ${bytes.length} bytes — sign with: ssh-keygen -Y sign -n ${ATTESTATION_NAMESPACE} -f <key> <file>`);
  return 0;
}

function main(): void {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === "message") process.exit(cmdMessage(argv.slice(1)));
  else if (cmd === "verify" || cmd === undefined) process.exit(cmdVerify(argv.slice(cmd === undefined ? 0 : 1)));
  else {
    console.error(`unknown command '${cmd}' — expected 'verify' or 'message'`);
    process.exit(1);
  }
}

if (import.meta.main) main();
