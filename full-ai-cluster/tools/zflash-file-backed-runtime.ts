import { spawnSync as nodeSpawnSync } from "node:child_process";
import {
  mkdirSync as nodeMkdirSync,
  mkdtempSync as nodeMkdtempSync,
  writeFileSync as nodeWriteFileSync,
} from "node:fs";
import { tmpdir as nodeTmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  CommandPlan,
  FileBackedInlineFile,
  FileBackedZflashImageCommandResult,
  FileBackedZflashImageExecutor,
} from "./zflash-lib";

interface SpawnSyncLikeResult {
  readonly status: number | null;
  readonly stdout?: string | Buffer;
  readonly stderr?: string | Buffer;
  readonly signal?: string | null;
  readonly error?: Error;
}

interface SpawnSyncLikeOptions {
  readonly encoding: "utf8";
  readonly stdio: readonly ["ignore", "pipe", "pipe"];
}

export interface NodeFileBackedZflashImageExecutorEffects {
  readonly mkdirSync?: (path: string, options: { readonly recursive: true }) => void;
  readonly writeFileSync?: (
    path: string,
    content: string,
    options: { readonly encoding: "utf8" },
  ) => void;
  readonly spawnSync?: (
    command: string,
    args: readonly string[],
    options: SpawnSyncLikeOptions,
  ) => SpawnSyncLikeResult;
}

export interface NodeFileBackedZflashInlineStagingEffects {
  readonly mkdtempSync?: (prefix: string) => string;
  readonly tmpdir?: () => string;
}

function textFromSpawnOutput(output: string | Buffer | undefined): string {
  if (output === undefined) return "";
  return typeof output === "string" ? output : output.toString("utf8");
}

function stderrFromSpawnResult(result: SpawnSyncLikeResult): string {
  const parts = [textFromSpawnOutput(result.stderr)];
  if (result.signal !== undefined && result.signal !== null) {
    parts.push(`terminated by signal ${result.signal}`);
  }
  if (result.error !== undefined) {
    parts.push(result.error.message);
  }
  return parts.filter((part) => part.length > 0).join("\n");
}

export function createNodeFileBackedZflashImageExecutor(
  effects: NodeFileBackedZflashImageExecutorEffects = {},
): FileBackedZflashImageExecutor {
  const mkdirSync = effects.mkdirSync ?? nodeMkdirSync;
  const writeFileSync = effects.writeFileSync ?? nodeWriteFileSync;
  const spawnSync = effects.spawnSync ?? nodeSpawnSync;

  return {
    writeFile: (file: FileBackedInlineFile): void => {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.content, { encoding: "utf8" });
    },
    runCommand: (command: CommandPlan): FileBackedZflashImageCommandResult => {
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- zflash file-backed commands are planned constants; args are structured and never shell-expanded.
      const result = spawnSync(command.command, [...command.args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return {
        exitCode: result.status ?? null,
        stderr: stderrFromSpawnResult(result),
        stdout: textFromSpawnOutput(result.stdout),
      };
    },
  };
}

export function createNodeFileBackedZflashInlineStagingDirectory(
  effects: NodeFileBackedZflashInlineStagingEffects = {},
): string {
  const mkdtempSync = effects.mkdtempSync ?? nodeMkdtempSync;
  const tmpdir = effects.tmpdir ?? nodeTmpdir;
  return mkdtempSync(join(tmpdir(), "zflash-inline-"));
}
