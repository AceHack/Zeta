import { spawnSync } from "node:child_process";
export class SpawnProcessRunner {
    run(argv0, args, options = {}) {
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
export function assertCommandSucceeded(result, _argv0, _args) {
    if (result.status === 0)
        return;
    process.stderr.write(`ERROR: command failed: ${[_argv0, ..._args].join(" ")}\n`);
    process.exit(result.status ?? 1);
}
export function runOrExit(runner, argv0, args, options) {
    const result = runner.run(argv0, args, options);
    assertCommandSucceeded(result, argv0, args);
    return result;
}
export function runOptional(runner, argv0, args) {
    return runner.run(argv0, args, { stdio: "inherit" }).status === 0;
}
export function commandSucceeded(runner, argv0, args) {
    return runner.run(argv0, args, { stdio: "ignore" }).status === 0;
}
export function captureOrNull(runner, argv0, args) {
    const result = runner.run(argv0, args);
    if (result.status !== 0)
        return null;
    return result.stdout;
}
