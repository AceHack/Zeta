#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createNodeFileBackedZflashImageExecutor,
  createNodeFileBackedZflashInlineStagingDirectory,
} from "./zflash-file-backed-runtime";
import {
  composeAuthorizedKeysFileContent,
  executeFileBackedZflashImageExecutionPlan,
  planFileBackedZflashImage,
  planFileBackedZflashImageExecution,
  ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH,
} from "./zflash-lib";
import type {
  FileBackedZflashImageExecution,
  FileBackedZflashImageExecutionFeedback,
  FileBackedZflashImageExecutor,
  FileBackedZflashImagePlanInput,
} from "./zflash-lib";

export interface FileBackedZflashCliOptions {
  readonly isoPath: string;
  readonly outputImagePath: string;
  readonly espOffsetBytes: number;
  readonly pubkeyPath?: string;
  readonly testMode?: boolean;
  readonly hostname?: string;
  readonly credentialBlobPath?: string;
  readonly inlineStagingDirectory?: string;
}

export type FileBackedZflashCliParseResult =
  | { readonly kind: "help" }
  | { readonly kind: "run"; readonly options: FileBackedZflashCliOptions }
  | { readonly kind: "error"; readonly error: string };

export interface FileBackedZflashCliRunDeps {
  readonly createInlineStagingDirectory?: () => string;
  readonly executor?: FileBackedZflashImageExecutor;
}

export type FileBackedZflashCliRunResult =
  | {
      readonly ok: true;
      readonly value: FileBackedZflashImageExecution & {
        readonly inlineStagingDirectory?: string;
      };
    }
  | { readonly ok: false; readonly error: string };

const USAGE =
  "Usage: bun full-ai-cluster/tools/zflash-file-backed.ts --iso <installer.iso> --output <raw.img> --esp-offset-bytes <bytes> [ESP writes]\n" +
  "  --ssh-key <path>             write /zeta-authorized-keys.pub from a public key file\n" +
  "  --test                       QEMU/CI-only: union zeta-test-infra.pub with --ssh-key content\n" +
  "  --host <name>                write /zeta-hostname.txt with an RFC1123 hostname\n" +
  "  --credential-blob <path>     write /zeta-creds.enc from an encrypted credential blob\n" +
  "  --inline-staging-dir <path>  optional staging root for inline content files\n";

function resolveTestInfraPubkeyPath(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, "../../", ZETA_TEST_INFRA_PUBKEY_REPO_RELATIVE_PATH);
}

function resolveAuthorizedKeysContent(
  pubkeyPath: string | undefined,
  testMode: boolean,
): string | { readonly error: string } {
  if (pubkeyPath === undefined && !testMode) {
    return { error: "at least one of --ssh-key or --test is required for /zeta-authorized-keys.pub" };
  }
  const lines: string[] = [];
  if (pubkeyPath !== undefined) {
    if (!existsSync(pubkeyPath)) {
      return { error: `ssh pubkey not found: ${pubkeyPath}` };
    }
    lines.push(readFileSync(pubkeyPath, "utf8"));
  }
  if (testMode) {
    const testInfraPath = resolveTestInfraPubkeyPath();
    if (!existsSync(testInfraPath)) {
      return { error: `test-infra pubkey not found: ${testInfraPath}` };
    }
    lines.push(readFileSync(testInfraPath, "utf8"));
  }
  const composed = composeAuthorizedKeysFileContent(lines);
  if (!composed.ok) {
    return { error: composed.error };
  }
  return composed.value;
}

function requireValue(args: readonly string[], index: number, flag: string): string | { readonly error: string } {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("-")) {
    return { error: `${flag} requires a value` };
  }
  return value;
}

export function parseFileBackedZflashArgs(args: readonly string[]): FileBackedZflashCliParseResult {
  let isoPath: string | undefined;
  let outputImagePath: string | undefined;
  let espOffsetBytes: number | undefined;
  let pubkeyPath: string | undefined;
  let hostname: string | undefined;
  let credentialBlobPath: string | undefined;
  let inlineStagingDirectory: string | undefined;
  let testMode = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--test") {
      testMode = true;
      continue;
    }

    if (arg === "--iso" || arg === "--output" || arg === "--esp-offset-bytes" || arg === "--ssh-key" || arg === "--host" || arg === "--credential-blob" || arg === "--inline-staging-dir") {
      const value = requireValue(args, index, arg);
      if (typeof value !== "string") return { kind: "error", error: value.error };
      if (arg === "--iso") isoPath = value;
      else if (arg === "--output") outputImagePath = value;
      else if (arg === "--esp-offset-bytes") {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) {
          return { kind: "error", error: "--esp-offset-bytes must be a positive safe integer" };
        }
        espOffsetBytes = parsed;
      } else if (arg === "--ssh-key") pubkeyPath = value;
      else if (arg === "--host") hostname = value;
      else if (arg === "--credential-blob") credentialBlobPath = value;
      else inlineStagingDirectory = value;
      index++;
      continue;
    }

    return { kind: "error", error: `unknown argument: ${arg}` };
  }

  if (isoPath === undefined) return { kind: "error", error: "--iso is required" };
  if (outputImagePath === undefined) return { kind: "error", error: "--output is required" };
  if (espOffsetBytes === undefined) return { kind: "error", error: "--esp-offset-bytes is required" };

  return {
    kind: "run",
    options: {
      isoPath,
      outputImagePath,
      espOffsetBytes,
      ...(pubkeyPath === undefined ? {} : { pubkeyPath }),
      ...(testMode ? { testMode: true } : {}),
      ...(hostname === undefined ? {} : { hostname }),
      ...(credentialBlobPath === undefined ? {} : { credentialBlobPath }),
      ...(inlineStagingDirectory === undefined ? {} : { inlineStagingDirectory }),
    },
  };
}

function formatCommand(command: { readonly command: string; readonly args: readonly string[] }): string {
  return [command.command, ...command.args].join(" ");
}

function describeExecutionFeedback(error: FileBackedZflashImageExecutionFeedback): string {
  if (error.kind === "inline-file-write-failed") {
    return `failed to write inline file ${error.file.destination} at ${error.file.path}: ${error.reason}`;
  }
  if (error.kind === "executor-threw") {
    return `executor threw while running ${error.step.kind}: ${error.reason}`;
  }
  const output = error.stderr.length > 0 ? error.stderr : error.stdout;
  return `command failed (${formatCommand(error.command)}) with exit ${error.exitCode ?? "unknown"}: ${output || "no output"}`;
}

export function runFileBackedZflashCli(
  options: FileBackedZflashCliOptions,
  deps: FileBackedZflashCliRunDeps = {},
): FileBackedZflashCliRunResult {
  let authorizedKeysContent: string | undefined;
  if (options.testMode === true) {
    const authorizedKeys = resolveAuthorizedKeysContent(options.pubkeyPath, true);
    if (typeof authorizedKeys !== "string") {
      return { ok: false, error: authorizedKeys.error };
    }
    authorizedKeysContent = authorizedKeys;
  }

  const planInput: FileBackedZflashImagePlanInput = {
    isoPath: options.isoPath,
    outputImagePath: options.outputImagePath,
    espOffsetBytes: options.espOffsetBytes,
    ...(authorizedKeysContent === undefined ? {} : { authorizedKeysContent }),
    ...(authorizedKeysContent === undefined && options.pubkeyPath !== undefined
      ? { pubkeyPath: options.pubkeyPath }
      : {}),
    ...(options.hostname === undefined ? {} : { hostname: options.hostname }),
    ...(options.credentialBlobPath === undefined ? {} : { credentialBlobPath: options.credentialBlobPath }),
  };
  const planned = planFileBackedZflashImage(planInput);
  if (!planned.ok) return { ok: false, error: planned.error };

  const needsInlineStaging = planned.value.espWrites.some((write) => write.content !== undefined);
  const inlineStagingDirectory = needsInlineStaging
    ? options.inlineStagingDirectory ?? (deps.createInlineStagingDirectory ?? createNodeFileBackedZflashInlineStagingDirectory)()
    : options.inlineStagingDirectory;
  const executionPlan = planFileBackedZflashImageExecution({
    plan: planned.value,
    ...(inlineStagingDirectory === undefined ? {} : { inlineStagingDirectory }),
  });
  if (!executionPlan.ok) return { ok: false, error: executionPlan.error };

  const executed = executeFileBackedZflashImageExecutionPlan(
    executionPlan.value,
    deps.executor ?? createNodeFileBackedZflashImageExecutor(),
  );
  if (!executed.ok) return { ok: false, error: describeExecutionFeedback(executed.error) };

  return {
    ok: true,
    value: {
      ...executed.value,
      ...(inlineStagingDirectory === undefined ? {} : { inlineStagingDirectory }),
    },
  };
}

function main(): void {
  const parsed = parseFileBackedZflashArgs(process.argv.slice(2));
  if (parsed.kind === "help") {
    process.stdout.write(USAGE);
    process.exit(0);
  }
  if (parsed.kind === "error") {
    process.stderr.write(`zflash-file-backed: ${parsed.error}\n${USAGE}`);
    process.exit(2);
  }

  const result = runFileBackedZflashCli(parsed.options);
  if (!result.ok) {
    process.stderr.write(`zflash-file-backed: ${result.error}\n`);
    process.exit(1);
  }

  process.stdout.write(`ZFLASH_QEMU_RETENTION_BOOT_IMAGE=${result.value.retentionBootImageEnvironment.ZFLASH_QEMU_RETENTION_BOOT_IMAGE}\n`);
  if (result.value.inlineStagingDirectory !== undefined) {
    process.stdout.write(`ZFLASH_INLINE_STAGING_DIR=${result.value.inlineStagingDirectory}\n`);
  }
}

if (import.meta.main) main();
