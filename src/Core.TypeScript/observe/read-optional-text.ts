import { readFileSync } from "node:fs";

export type TextReader = (path: string, encoding: BufferEncoding) => string;

/**
 * Read a file once and interpret only its actual ENOENT outcome as absence.
 *
 * Deliberately does not pre-check with existsSync: a pre-check is stale as soon
 * as it returns and can race a delete/replace before the read.
 */
export function readOptionalText(path: string, read: TextReader = readFileSync): string | null {
  try {
    return read(path, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
