import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSetupManifest } from "../setup-manifest.ts";

export interface RealizeContext {
  readonly repoRoot: string;
  readonly dryRun: boolean;
  readonly actions: string[];
  readonly log: (message: string) => void;
  readonly warn: (message: string) => void;
}

export interface RealizeResult {
  readonly mechanism: string;
  readonly skipped: boolean;
  readonly actions: readonly string[];
}

export type SetupRealizer = (ctx: RealizeContext) => Promise<RealizeResult>;

export function defaultRepoRoot(): string {
  return join(import.meta.dir, "..", "..", "..");
}

export function readManifestFile(repoRoot: string, manifestRel: string): string | null {
  const path = join(repoRoot, manifestRel);
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function toolNameFromSpec(spec: string): string {
  return spec.split(/[ <>=!~]/)[0] ?? spec;
}

export function commandOnPath(bin: string): boolean {
  return Bun.which(bin) !== null;
}

export async function runCommand(
  ctx: RealizeContext,
  label: string,
  argv: readonly string[],
  opts?: { readonly bestEffort?: boolean },
): Promise<boolean> {
  ctx.log(label);
  ctx.actions.push(ctx.dryRun ? `dry-run: ${argv.join(" ")}` : argv.join(" "));
  if (ctx.dryRun) return true;

  const proc = Bun.spawn([...argv], { stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) {
    const message = `${argv.join(" ")} exited ${String(code)}`;
    if (opts?.bestEffort) {
      ctx.warn(message);
      return false;
    }
    throw new Error(message);
  }
  return true;
}

export function createContext(args: {
  readonly repoRoot?: string;
  readonly dryRun?: boolean;
}): RealizeContext {
  return {
    repoRoot: args.repoRoot ?? defaultRepoRoot(),
    dryRun: args.dryRun ?? false,
    actions: [],
    log: (message) => process.stdout.write(`${message}\n`),
    warn: (message) => process.stderr.write(`${message}\n`),
  };
}

export function parseSimpleManifest(text: string): readonly string[] {
  return parseSetupManifest(text).map((entry) => entry.spec);
}

export function finishResult(mechanism: string, ctx: RealizeContext, skipped: boolean): RealizeResult {
  return { mechanism, skipped, actions: [...ctx.actions] };
}
