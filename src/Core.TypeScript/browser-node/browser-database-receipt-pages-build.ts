#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateProposalAuthorRegistry } from "../planning/proposal-verifier";
import {
  BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY,
  BROWSER_DATABASE_RECEIPT_PROPOSAL_ROOT,
} from "./browser-database-receipt-proposal";
import {
  BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH,
  BROWSER_DATABASE_RECEIPT_PAGES_INDEX_SCHEMA,
  BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT,
  type BrowserDatabaseReceiptPagesIndex,
} from "./browser-database-receipt-pages-contract";

export interface BrowserDatabaseReceiptPagesBuildLimits {
  readonly maxRecords: number;
  readonly maxAuthors: number;
  readonly maxRecordBytes: number;
  readonly maxIndexBytes: number;
}

export interface BrowserDatabaseReceiptPagesBuildOptions {
  readonly sourceDir: string;
  readonly outDir: string;
  readonly revision: string;
  readonly limits: BrowserDatabaseReceiptPagesBuildLimits;
}

export interface BrowserDatabaseReceiptPagesBuildSummary {
  readonly indexPath: string;
  readonly recordCount: number;
  readonly recordBytes: number;
}

export type BrowserDatabaseReceiptPagesBuildResult =
  | { readonly ok: true; readonly value: BrowserDatabaseReceiptPagesBuildSummary }
  | { readonly ok: false; readonly error: string };

export const DEFAULT_BROWSER_DATABASE_RECEIPT_PAGES_BUILD_LIMITS: BrowserDatabaseReceiptPagesBuildLimits =
  Object.freeze({
    maxRecords: 1024,
    maxAuthors: 128,
    maxRecordBytes: 64 * 1024,
    maxIndexBytes: 256 * 1024,
  });

const RECORD_FILE_PATTERN = /^[0-9a-f]{64}\.json$/;

function validLimits(limits: BrowserDatabaseReceiptPagesBuildLimits): boolean {
  return (
    Number.isSafeInteger(limits.maxRecords) &&
    limits.maxRecords >= 1 &&
    Number.isSafeInteger(limits.maxAuthors) &&
    limits.maxAuthors >= 1 &&
    Number.isSafeInteger(limits.maxRecordBytes) &&
    limits.maxRecordBytes >= 1 &&
    Number.isSafeInteger(limits.maxIndexBytes) &&
    limits.maxIndexBytes >= 1
  );
}

function encodeIndex(index: BrowserDatabaseReceiptPagesIndex): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(index, null, 2)}\n`);
}

/** Publish accepted receipt files as one deterministic, revision-bound Pages projection. */
export function buildBrowserDatabaseReceiptPages(
  options: BrowserDatabaseReceiptPagesBuildOptions,
): BrowserDatabaseReceiptPagesBuildResult {
  if (
    options.sourceDir.length === 0 ||
    options.outDir.length === 0 ||
    !/^[0-9a-f]{40}$/.test(options.revision) ||
    !validLimits(options.limits)
  ) {
    return {
      ok: false,
      error:
        "The receipt Pages build requires source/output paths, a lowercase commit SHA, and positive finite limits.",
    };
  }

  const sourceRoot = resolve(options.sourceDir);
  const outRoot = resolve(options.outDir);
  const acceptedRoot = join(sourceRoot, ...BROWSER_DATABASE_RECEIPT_PROPOSAL_ROOT.split("/"));
  const registryPath = join(sourceRoot, "docs", "security", "proposal-author-registry.json");
  const records: { readonly name: string; readonly payload: Uint8Array }[] = [];
  try {
    const registry = validateProposalAuthorRegistry(JSON.parse(readFileSync(registryPath, "utf8")) as unknown);
    if (!registry.ok) return { ok: false, error: registry.message };
    const authors = registry.value.authors
      .filter((author) => registry.value.revoked[author.credentialId] === undefined)
      .map((author) => ({
        credentialId: author.credentialId,
        origin: author.origin,
        rpId: author.rpId,
      }))
      .sort((left, right) =>
        left.credentialId < right.credentialId ? -1 : left.credentialId > right.credentialId ? 1 : 0,
      );
    if (authors.length > options.limits.maxAuthors) {
      return {
        ok: false,
        error: `The proposal-author registry carries ${authors.length.toString()} active authors; its Pages budget is ${options.limits.maxAuthors.toString()}.`,
      };
    }
    if (existsSync(acceptedRoot)) {
      const entries = readdirSync(acceptedRoot, { withFileTypes: true }).sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      );
      if (entries.length > options.limits.maxRecords) {
        return {
          ok: false,
          error: `The receipt Pages build found ${entries.length.toString()} records; its no-truncation budget is ${options.limits.maxRecords.toString()}.`,
        };
      }
      for (const entry of entries) {
        if (!entry.isFile() || !RECORD_FILE_PATTERN.test(entry.name)) {
          return { ok: false, error: `The accepted receipt directory contains a non-canonical entry: ${entry.name}.` };
        }
        const payload = readFileSync(join(acceptedRoot, entry.name));
        if (payload.byteLength > options.limits.maxRecordBytes) {
          return {
            ok: false,
            error: `Accepted receipt ${entry.name} needs ${payload.byteLength.toString()} bytes; its Pages budget is ${options.limits.maxRecordBytes.toString()}.`,
          };
        }
        records.push({ name: entry.name, payload });
      }
    }

    const index: BrowserDatabaseReceiptPagesIndex = {
      schema: BROWSER_DATABASE_RECEIPT_PAGES_INDEX_SCHEMA,
      repository: BROWSER_DATABASE_RECEIPT_PROPOSAL_REPOSITORY,
      ref: "main",
      revision: options.revision,
      proposalAuthority: {
        registrySequence: registry.value.sequence,
        authors,
      },
      records: records.map((record) => ({
        targetPath: `${BROWSER_DATABASE_RECEIPT_PROPOSAL_ROOT}/${record.name}`,
        byteLength: record.payload.byteLength,
      })),
    };
    const indexPayload = encodeIndex(index);
    if (indexPayload.byteLength > options.limits.maxIndexBytes) {
      return {
        ok: false,
        error: `The receipt Pages index needs ${indexPayload.byteLength.toString()} bytes; its budget is ${options.limits.maxIndexBytes.toString()}.`,
      };
    }

    const recordOutDir = join(outRoot, ...BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT.split("/"));
    mkdirSync(recordOutDir, { recursive: true });
    for (const record of records) writeFileSync(join(recordOutDir, record.name), record.payload);
    const indexPath = join(outRoot, ...BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH.split("/"));
    writeFileSync(indexPath, indexPayload);
    return {
      ok: true,
      value: {
        indexPath,
        recordCount: records.length,
        recordBytes: records.reduce((total, record) => total + record.payload.byteLength, 0),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

interface CliOptions {
  readonly sourceDir: string;
  readonly outDir: string;
  readonly revision?: string;
}

function parseCli(argv: readonly string[]): CliOptions | { readonly error: string } {
  let sourceDir = resolve(import.meta.dir, "..", "..", "..");
  let outDir: string | undefined;
  let revision: string | undefined;
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (value === undefined) return { error: `Missing value for ${name ?? "argument"}.` };
    if (name === "--source-dir") sourceDir = value;
    else if (name === "--out-dir") outDir = value;
    else if (name === "--revision") revision = value;
    else return { error: `Unknown argument: ${name ?? ""}.` };
  }
  return outDir === undefined
    ? { error: "Usage: browser-database-receipt-pages-build.ts --out-dir <path>." }
    : {
        sourceDir,
        outDir,
        ...(revision === undefined ? {} : { revision }),
      };
}

function checkedOutRevision(sourceDir: string): string | null {
  const fromEnvironment = process.env.GITHUB_SHA;
  if (fromEnvironment !== undefined && /^[0-9a-f]{40}$/.test(fromEnvironment)) return fromEnvironment;
  const result = Bun.spawnSync(["git", "rev-parse", "HEAD"], { cwd: sourceDir });
  if (result.exitCode !== 0) return null;
  const revision = new TextDecoder().decode(result.stdout).trim();
  return /^[0-9a-f]{40}$/.test(revision) ? revision : null;
}

async function main(argv: readonly string[]): Promise<number> {
  const parsed = parseCli(argv);
  if ("error" in parsed) {
    process.stderr.write(`${parsed.error}\n`);
    return 1;
  }
  const revision = parsed.revision ?? checkedOutRevision(parsed.sourceDir);
  if (revision === null) {
    process.stderr.write("Could not resolve the checked-out commit revision.\n");
    return 1;
  }
  const result = buildBrowserDatabaseReceiptPages({
    sourceDir: parsed.sourceDir,
    outDir: parsed.outDir,
    revision,
    limits: DEFAULT_BROWSER_DATABASE_RECEIPT_PAGES_BUILD_LIMITS,
  });
  if (!result.ok) {
    process.stderr.write(`${result.error}\n`);
    return 1;
  }
  process.stdout.write(
    `wrote ${result.value.indexPath} with ${result.value.recordCount.toString()} accepted receipt records\n`,
  );
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
