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

function getSignalNumber(signal: string): number {
  const signals: Record<string, number> = {
    SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGILL: 4, SIGTRAP: 5,
    SIGABRT: 6, SIGFPE: 8, SIGKILL: 9, SIGUSR1: 10, SIGSEGV: 11,
    SIGUSR2: 12, SIGPIPE: 13, SIGALRM: 14, SIGTERM: 15
  };
  return signals[signal] ?? 0;
}

export function assertCommandSucceeded(result: CommandResult, _argv0: string, _args: readonly string[]): void {
  if (result.status === 0) return;
  const cmd = [_argv0, ..._args].join(" ");
  let errorMsg = `ERROR: command failed: ${cmd}\n`;
  if (result.status !== null) {
    errorMsg += `  exit code: ${result.status}\n`;
  }
  if (result.signal) {
    errorMsg += `  killed by signal: ${result.signal}\n`;
  }
  if (result.stderr) {
    errorMsg += `  stderr:\n${result.stderr.trim().split("\n").map(line => `    ${line}`).join("\n")}\n`;
  }
  process.stderr.write(errorMsg);
  process.exit(result.status ?? (result.signal ? 128 + getSignalNumber(result.signal) : 1));
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
  if (result.status !== 0) {
    if (result.stderr) {
      process.stderr.write(`ERROR: command failed: ${[argv0, ...args].join(" ")}\n${result.stderr}\n`);
    }
    return null;
  }
  return result.stdout;
}
