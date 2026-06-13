import { spawnSync } from "node:child_process";
import type { CommandResult, ProcessRunner } from "../ports.ts";

export class SpawnProcessRunner implements ProcessRunner {
  run(
    argv0: string,
    args: readonly string[],
    options: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      timeoutMs?: number;
      stdin?: string;
      stdio?: "inherit" | "pipe" | "ignore";
    } = {},
  ): CommandResult {
    const stdio = options.stdin !== undefined ? "pipe" : (options.stdio ?? "pipe");
    const result = spawnSync(argv0, [...args], {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      timeout: options.timeoutMs,
      input: options.stdin,
      encoding: stdio === "pipe" ? "utf8" : undefined,
      stdio,
    });
    return {
      status: result.status,
      stdout: typeof result.stdout === "string" ? result.stdout : "",
      stderr: typeof result.stderr === "string" ? result.stderr : "",
      signal: result.signal,
    };
  }
}

export function assertCommandSucceeded(result: CommandResult, argv0: string, args: readonly string[]): void {
  if (result.status === 0) return;
  process.exit(result.status === null ? 1 : result.status);
}

export function runOrExit(
  runner: ProcessRunner,
  argv0: string,
  args: readonly string[],
  options?: Parameters<ProcessRunner["run"]>[2],
): CommandResult {
  const result = runner.run(argv0, args, options);
  assertCommandSucceeded(result, argv0, args);
  return result;
}

export function runOptional(runner: ProcessRunner, argv0: string, args: readonly string[]): boolean {
  return runner.run(argv0, args, { stdio: "inherit" }).status === 0;
}

export function commandSucceeded(runner: ProcessRunner, argv0: string, args: readonly string[]): boolean {
  return runner.run(argv0, args, { stdio: "ignore" }).status === 0;
}

export function captureOrNull(runner: ProcessRunner, argv0: string, args: readonly string[]): string | null {
  const result = runner.run(argv0, args);
  if (result.status !== 0) return null;
  return result.stdout;
}
