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

  export type ScryptOptions = { N?: number; r?: number; p?: number; maxmem?: number };
  export type CipherGcm = {
    setAAD(aad: Uint8Array): CipherGcm;
    update(data: Uint8Array): Uint8Array;
    final(): Uint8Array;
    getAuthTag(): Uint8Array;
  };
  export type DecipherGcm = {
    setAAD(aad: Uint8Array): DecipherGcm;
    setAuthTag(tag: Uint8Array): DecipherGcm;
    update(data: Uint8Array): Uint8Array;
    final(): Uint8Array;
  };

  export function randomBytes(size: number): Uint8Array;
  export function scryptSync(
    password: Uint8Array | string,
    salt: Uint8Array | string,
    keylen: number,
    options?: ScryptOptions,
  ): Uint8Array;
  export function hkdfSync(
    digest: "sha256",
    ikm: Uint8Array,
    salt: Uint8Array,
    info: Uint8Array,
    keylen: number,
  ): ArrayBuffer;
  export function createCipheriv(algorithm: "aes-256-gcm", key: Uint8Array, iv: Uint8Array): CipherGcm;
  export function createDecipheriv(algorithm: "aes-256-gcm", key: Uint8Array, iv: Uint8Array): DecipherGcm;
}

declare module "node:child_process" {
  export type ChildProcessStream = { on(event: "data", cb: (chunk: Uint8Array) => void): void } | null;
  export type SpawnOptions = { stdio?: readonly ("ignore" | "pipe")[] };
  export type SpawnedProcess = {
    pid?: number;
    stdout: ChildProcessStream;
    stderr: ChildProcessStream;
    on(event: "error", cb: (err: { code?: string; message: string }) => void): void;
    on(event: "spawn", cb: () => void): void;
    on(event: "close", cb: (code: number | null) => void): void;
    kill(signal?: string): boolean;
  };
  export function spawn(command: string, args: readonly string[], options?: SpawnOptions): SpawnedProcess;
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

declare module "node:http" {
  export type IncomingMessage = {
    method?: string;
    url?: string;
    on: (event: "data" | "end", cb: (chunk?: string) => void) => void;
  };
  export type ServerResponse = {
    writeHead: (status: number, headers?: Record<string, string>) => void;
    end: (body?: string) => void;
  };
  export type Server = {
    listen: (port: number, host: string, cb: () => void) => void;
    close: (cb?: () => void) => void;
    address: () => { port: number } | string | null;
  };
  export function createServer(handler: (req: IncomingMessage, res: ServerResponse) => void): Server;
}
