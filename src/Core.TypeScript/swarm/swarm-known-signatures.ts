export type ReadTextFile = (filePath: string) => string;

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

/**
 * Read persisted causal-orbit signatures without separating existence from use.
 *
 * A missing file is the one expected first-run condition. Any other read or
 * parse error remains evidence and must reach the caller rather than becoming
 * an empty history.
 */
export function readKnownSignatures(
  readTextFile: ReadTextFile,
  filePath: string,
): string[] {
  try {
    const parsed: unknown = JSON.parse(readTextFile(filePath));
    if (!Array.isArray(parsed) || !parsed.every((entry) => typeof entry === "string")) {
      throw new Error(`known signatures file ${filePath} must contain a JSON string array`);
    }
    return parsed;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return [];
    throw error;
  }
}
