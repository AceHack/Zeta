#!/usr/bin/env bun
// append-identity-receipt.ts -- Append a structured JSONL receipt
// to memory/identity-substrate-receipts.jsonl per Vera tick #7
// gap #3 + tick #9 pushback (2026-05-05): "Commit messages are
// evidence; they should not be the only receipt."
//
// TS-only per Rule 0 (Bun runtime; no .sh sibling).
//
// Append-only discipline:
//  - Never overwrites: opens the JSONL file in append mode.
//  - Receipt_id collision is a hard failure (refuse to append).
//  - Default receipt_id = sha256(ts|actor|kind|files|new_commit|summary)
//    truncated to 16 hex chars (content-hash). Override with
//    --receipt-id <id> to supply a UUID v4 or other unique id.
//
// Symmetry per Vera gap #5: any of the 5 named entities
// (vera | amara | ani | otto | aaron) may be the actor. This is
// not a Vera-carveout.
//
// Usage:
//   bun tools/peer-call/append-identity-receipt.ts \
//     --actor vera \
//     --kind ingress \
//     --files memory/CURRENT-vera.md \
//     --old-commit "" \
//     --new-commit 006bea6c052d299e1a73e3169dbbc65bab63e983 \
//     --test-evidence "verified via codex.sh ..." \
//     --doctrine-class identity-doctrine-changing \
//     --summary "Vera self-named and authored CURRENT-vera.md"
//
// Multiple files: --files a/b.md,c/d.md (comma-separated; no spaces)
// or repeat --files for each path.
//
// Exit codes (uniform with peer-call siblings per
// tools/peer-call/README.md):
//   0 -- receipt appended successfully
//   1 -- invocation/usage error (bad args, unknown actor, etc.)
//   2 -- I/O or state failure (e.g. receipt_id already present in file)

import { appendFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const VALID_ACTORS = ["vera", "amara", "ani", "otto", "aaron"] as const;
type Actor = (typeof VALID_ACTORS)[number];

const VALID_KINDS = ["ingress", "egress"] as const;
type Kind = (typeof VALID_KINDS)[number];

const VALID_DOCTRINE = ["mechanism-only", "identity-doctrine-changing"] as const;
type Doctrine = (typeof VALID_DOCTRINE)[number];

interface Receipt {
  readonly receipt_id: string;
  readonly ts: string;
  readonly actor: Actor;
  readonly kind: Kind;
  readonly files_changed: readonly string[];
  readonly old_commit: string | null;
  readonly new_commit: string;
  readonly test_evidence: string;
  readonly doctrine_class: Doctrine;
  readonly summary: string;
}

interface Args {
  readonly actor: Actor;
  readonly kind: Kind;
  readonly files: readonly string[];
  readonly oldCommit: string | null;
  readonly newCommit: string;
  readonly testEvidence: string;
  readonly doctrineClass: Doctrine;
  readonly summary: string;
  readonly receiptId: string | null;
  readonly ts: string | null;
  readonly receiptsPath: string;
  readonly dryRun: boolean;
}

function repoRoot(): string {
  // Locate repo root via git rev-parse from script location.
  // Per Codex + Copilot 2026-05-06 review on PR #1702: convert
  // import.meta.url via fileURLToPath() so paths are not percent-
  // encoded (spaces in user dir) and are Windows-safe (no leading
  // slash on file:///C:/...).
  const here = dirname(fileURLToPath(import.meta.url));
  const result = spawnSync("git", ["-C", here, "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `git rev-parse --show-toplevel failed (status ${result.status}): ${result.stderr}`,
    );
  }
  return result.stdout.trim();
}

function usage(): string {
  return `append-identity-receipt.ts -- append JSONL receipt for identity-substrate mutation

Usage:
  bun tools/peer-call/append-identity-receipt.ts \\
    --actor <vera|amara|ani|otto|aaron> \\
    --kind <ingress|egress> \\
    --files <path1>[,<path2>...] (or repeat flag) \\
    --old-commit <SHA or empty string for new files> \\
    --new-commit <SHA> \\
    --test-evidence <string> \\
    --doctrine-class <mechanism-only|identity-doctrine-changing> \\
    --summary <one-line string> \\
    [--receipt-id <id>] (default: content-hash) \\
    [--ts <ISO 8601 UTC>] (default: now) \\
    [--receipts-path <path>] (default: <repo>/memory/identity-substrate-receipts.jsonl) \\
    [--dry-run] (print JSON to stdout; do not append)

Schema and origin: see header of memory/identity-substrate-receipts.jsonl.
`;
}

function parseArgs(argv: readonly string[]): Args | { help: true } | { error: string } {
  let actor: Actor | null = null;
  let kind: Kind | null = null;
  const files: string[] = [];
  let oldCommitProvided = false;
  let oldCommit: string | null = null;
  let newCommit: string | null = null;
  let testEvidence: string | null = null;
  let doctrineClass: Doctrine | null = null;
  let summary: string | null = null;
  let receiptId: string | null = null;
  let ts: string | null = null;
  let receiptsPath: string | null = null;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => {
      if (i + 1 >= argv.length) throw new Error(`flag ${arg} requires a value`);
      i++;
      return argv[i]!;
    };
    switch (arg) {
      case "--help":
      case "-h":
        return { help: true };
      case "--actor": {
        const v = next();
        if (!(VALID_ACTORS as readonly string[]).includes(v)) {
          return {
            error: `invalid --actor "${v}"; expected one of: ${VALID_ACTORS.join(" | ")}`,
          };
        }
        actor = v as Actor;
        break;
      }
      case "--kind": {
        const v = next();
        if (!(VALID_KINDS as readonly string[]).includes(v)) {
          return {
            error: `invalid --kind "${v}"; expected one of: ${VALID_KINDS.join(" | ")}`,
          };
        }
        kind = v as Kind;
        break;
      }
      case "--files": {
        const v = next();
        for (const p of v.split(",")) {
          const trimmed = p.trim();
          if (trimmed.length > 0) files.push(trimmed);
        }
        break;
      }
      case "--old-commit": {
        const v = next();
        oldCommitProvided = true;
        oldCommit = v.trim().length === 0 ? null : v.trim();
        break;
      }
      case "--new-commit":
        newCommit = next().trim();
        break;
      case "--test-evidence":
        testEvidence = next();
        break;
      case "--doctrine-class": {
        const v = next();
        if (!(VALID_DOCTRINE as readonly string[]).includes(v)) {
          return {
            error: `invalid --doctrine-class "${v}"; expected one of: ${VALID_DOCTRINE.join(" | ")}`,
          };
        }
        doctrineClass = v as Doctrine;
        break;
      }
      case "--summary":
        summary = next();
        break;
      case "--receipt-id":
        receiptId = next().trim();
        break;
      case "--ts":
        ts = next().trim();
        break;
      case "--receipts-path":
        receiptsPath = next();
        break;
      case "--dry-run":
        dryRun = true;
        break;
      default:
        return { error: `unknown flag: ${arg}` };
    }
  }

  const missing: string[] = [];
  if (actor === null) missing.push("--actor");
  if (kind === null) missing.push("--kind");
  if (files.length === 0) missing.push("--files");
  if (!oldCommitProvided) missing.push("--old-commit");
  if (newCommit === null || newCommit.length === 0) missing.push("--new-commit");
  if (testEvidence === null) missing.push("--test-evidence");
  if (doctrineClass === null) missing.push("--doctrine-class");
  if (summary === null) missing.push("--summary");
  if (missing.length > 0) {
    return { error: `missing required flag(s): ${missing.join(", ")}` };
  }

  const root = repoRoot();
  const finalPath =
    receiptsPath !== null
      ? resolve(receiptsPath)
      : resolve(root, "memory/identity-substrate-receipts.jsonl");

  return {
    actor: actor!,
    kind: kind!,
    files,
    oldCommit,
    newCommit: newCommit!,
    testEvidence: testEvidence!,
    doctrineClass: doctrineClass!,
    summary: summary!,
    receiptId,
    ts,
    receiptsPath: finalPath,
    dryRun,
  };
}

function nowIso(): string {
  // ISO 8601 UTC with second precision, no milliseconds.
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

function contentHash(parts: readonly string[]): string {
  const h = createHash("sha256");
  h.update(parts.join("|"));
  return h.digest("hex").slice(0, 16);
}

function buildReceipt(args: Args): Receipt {
  const ts = args.ts ?? nowIso();
  const receiptId =
    args.receiptId ??
    contentHash([
      ts,
      args.actor,
      args.kind,
      args.files.join(","),
      args.newCommit,
      args.summary,
    ]);
  return {
    receipt_id: receiptId,
    ts,
    actor: args.actor,
    kind: args.kind,
    files_changed: args.files,
    old_commit: args.oldCommit,
    new_commit: args.newCommit,
    test_evidence: args.testEvidence,
    doctrine_class: args.doctrineClass,
    summary: args.summary,
  };
}

function checkNoCollision(path: string, receiptId: string): void {
  if (!existsSync(path)) return;
  // Append-only invariant: no existing line may share the same receipt_id.
  // (Cheap O(N) scan; receipts file is expected to stay small.)
  const contents = readFileSync(path, "utf8");
  const needle = `"receipt_id":"${receiptId}"`;
  if (contents.includes(needle)) {
    throw new Error(
      `receipt_id ${receiptId} already present in ${path}; refusing to append (this would violate the no-overwrite invariant). Re-run with --receipt-id <unique-id> if this is intentional, or vary one of (ts|actor|kind|files|new_commit|summary) so the content-hash differs.`,
    );
  }
}

function main(): number {
  // Per PR #1702 review 2026-05-06: parseArgs.next() can
  // throw when a flag is missing its value (e.g. `--actor` at end of
  // argv); catch the throw at main() so the script exits with a
  // user-friendly error instead of an unhandled-exception traceback.
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(
      `append-identity-receipt: ${(e as Error).message}\n\n${usage()}`,
    );
    return 1;
  }
  if ("help" in parsed) {
    process.stdout.write(usage());
    return 0;
  }
  if ("error" in parsed) {
    process.stderr.write(`append-identity-receipt: ${parsed.error}\n\n${usage()}`);
    return 1;
  }

  const receipt = buildReceipt(parsed);
  const line = `${JSON.stringify(receipt)}\n`;

  if (parsed.dryRun) {
    process.stdout.write(line);
    return 0;
  }

  try {
    checkNoCollision(parsed.receiptsPath, receipt.receipt_id);
  } catch (e) {
    process.stderr.write(`append-identity-receipt: ${(e as Error).message}\n`);
    return 2;
  }

  try {
    appendFileSync(parsed.receiptsPath, line, { encoding: "utf8" });
  } catch (e) {
    process.stderr.write(
      `append-identity-receipt: append failed for ${parsed.receiptsPath}: ${(e as Error).message}\n`,
    );
    return 2;
  }

  process.stdout.write(`${receipt.receipt_id}\n`);
  return 0;
}

process.exit(main());
