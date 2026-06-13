/**
 * Mechanical authorization check — tick-start integration (B-0308).
 *
 * Composes B-0306 extractor + B-0307 resolver. Prints two-layer DX:
 * Layer 1: raw structured JSON
 * Layer 2: labeled interpretation
 *
 * Usage: bun tools/authorization/check-authorization.ts [rootPath]
 * Exit code 0 always — this check surfaces information, never gates.
 */

import { resolve } from "node:path";
import { extractPaceInstructions } from "./pace-extractor.ts";
import {
  resolveAuthorization,
  type AuthorizationResult,
} from "./resolve-authorization.ts";

export interface CheckOutput {
  queriedAt: string;
  result: AuthorizationResult;
}

export async function checkAuthorization(
  rootPath: string,
): Promise<CheckOutput> {
  const instructions = await extractPaceInstructions(rootPath);
  const result = resolveAuthorization(instructions);
  return {
    queriedAt: new Date().toISOString(),
    result,
  };
}

export function formatInterpretation(output: CheckOutput): string {
  const { result } = output;
  if (result.operative === null) {
    return `[authorization] ${result.reason}`;
  }
  const ts = result.operative.timestamp ?? "undated";
  return `[authorization] operative: "${result.operative.raw}" (source: ${result.operative.source}, ${ts})`;
}

export function formatShardField(output: CheckOutput): string {
  const { result } = output;
  if (result.operative === null) {
    return "none — never-idle default";
  }
  const ts = result.operative.timestamp ?? "undated";
  return `${result.operative.source} ${ts}: "${result.operative.raw}"`;
}

if (import.meta.main) {
  const rootPath = resolve(process.argv[2] ?? ".");
  const output = await checkAuthorization(rootPath);

  console.log("--- Layer 1: raw structured output ---");
  console.log(JSON.stringify(output, null, 2));
  console.log("--- Layer 2: interpretation ---");
  console.log(formatInterpretation(output));
  console.log("--- Shard field value ---");
  console.log(formatShardField(output));
}
