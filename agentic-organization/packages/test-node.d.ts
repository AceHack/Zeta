declare module "node:assert/strict" {
  export function deepEqual(actual: unknown, expected: unknown): void;
  export function equal(actual: unknown, expected: unknown, message?: string): void;
  export function ok(value: unknown, message?: string): asserts value;
  export function rejects(action: () => Promise<unknown>, expected?: (error: unknown) => boolean): Promise<void>;
  export function throws(action: () => void, expected?: RegExp): void;
}

declare module "node:crypto" {
  export type Hash = {
    update(data: string | Uint8Array): Hash;
    digest(encoding: "hex"): string;
  };

  export function createHash(algorithm: "sha1" | "sha256"): Hash;
}

declare module "node:test" {
  export type TestOptions = {
    skip?: boolean | string;
  };

  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void): void;
  export function test(name: string, options: TestOptions, fn: () => void | Promise<void>): void;
}

declare module "node:process" {
  export const env: Record<string, string | undefined>;
  export const execPath: string;
  export const argv: string[];
}

declare module "node:child_process" {
  export type ExecFileOptions = {
    cwd?: string;
    timeout?: number;
    killSignal?: string;
    maxBuffer?: number;
    env?: Record<string, string | undefined>;
    windowsHide?: boolean;
    encoding?: "utf8";
  };
  export function execFile(
    file: string,
    args: readonly string[],
    options: ExecFileOptions,
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ): void;
}

declare module "node:fs" {
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
}

declare module "node:os" {
  export function tmpdir(): string;
}

declare module "node:crypto" {
  export function randomUUID(): string;
}

declare module "node:fs/promises" {
  export type Dirent = {
    name: string;
    isDirectory: () => boolean;
    isFile: () => boolean;
  };

  export function readdir(path: string, options: { withFileTypes: true }): Promise<Dirent[]>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
}

declare module "node:path" {
  export const sep: string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}

declare module "node:url" {
  export function fileURLToPath(url: URL): string;
}
