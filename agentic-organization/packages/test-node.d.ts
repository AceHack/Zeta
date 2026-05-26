declare module "node:assert/strict" {
  export function deepEqual(actual: unknown, expected: unknown): void;
  export function equal(actual: unknown, expected: unknown, message?: string): void;
  export function ok(value: unknown): asserts value;
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
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void): void;
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
