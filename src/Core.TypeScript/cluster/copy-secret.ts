#!/usr/bin/env bun
/**
 * copy-secret.ts -- copy named keys of one Secret into a Secret in another namespace, without ever printing them.
 *
 *   bun src/Core.TypeScript/cluster/copy-secret.ts --from gitlab/gitlab-windows-runner-token --to windows-vms/win11-ci-runner-token
 *   bun src/Core.TypeScript/cluster/copy-secret.ts --from <ns>/<name> --to <ns>/<name> --key runner-token   (the default key)
 *
 * WHY. KubeVirt can only attach a Secret from the VM's own namespace, and the Windows runner's `glrt-` token is
 * minted by a Job in `gitlab` (examples/gitlab-windows-runner-token.yaml). So the token has to exist in
 * `windows-vms` too. Doing that with `kubectl get ... -o jsonpath | kubectl create secret --from-literal=...`
 * puts the token on a command line; this reads it from one kubectl's stdout and hands it to the other's stdin,
 * in memory only. Nothing about the value is printed -- not the value, not a prefix, not a hash.
 *
 * WHAT IT REFUSES (exit 2): the same source and destination, a missing or EMPTY key (the minting Job
 * pre-creates the Secret empty, so a copy made before it finished would silently deliver nothing), a source
 * that is not an Opaque Secret. Idempotent: re-running replaces the destination's key with the source's.
 * Exit codes: 0 copied, 1 kubectl failed, 2 refusal / usage.
 */

import { spawnSync } from "node:child_process";
import { stringify as stringifyYaml } from "yaml";

export interface Ref {
  readonly namespace: string;
  readonly name: string;
}

export function parseRef(text: string | undefined): Ref | null {
  if (text === undefined) return null;
  const m = /^([a-z0-9]([-a-z0-9]*[a-z0-9])?)\/([a-z0-9]([-a-z0-9.]*[a-z0-9])?)$/.exec(text);
  return m === null ? null : { namespace: m[1]!, name: m[3]! };
}

/** The destination Secret's manifest, from the source's `kubectl get -o json`. Pure; throws a refusal. */
export function buildCopy(sourceJson: string, to: Ref, keys: readonly string[]): { manifest: string; bytes: number } {
  const source = JSON.parse(sourceJson) as { kind?: string; type?: string; data?: Record<string, string> };
  if (source.kind !== "Secret") throw new Error("refused: the source is not a Secret");
  if (source.type !== undefined && source.type !== "Opaque") throw new Error(`refused: the source is type ${source.type}, only Opaque Secrets are copied`);
  const data: Record<string, string> = {};
  let bytes = 0;
  for (const key of keys) {
    const value = source.data?.[key];
    if (value === undefined || value === "") throw new Error(`refused: the source has no non-empty key ${key} (is the minting Job finished?)`);
    data[key] = value;
    bytes += Buffer.from(value, "base64").length;
  }
  return {
    bytes,
    manifest: stringifyYaml({ apiVersion: "v1", kind: "Secret", metadata: { name: to.name, namespace: to.namespace }, type: "Opaque", data }),
  };
}

function kubectl(args: string[], input?: string): { code: number; out: string; err: string } {
  const r = spawnSync("kubectl", args, { input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return { code: r.status ?? 1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function main(argv: string[]): number {
  let from: Ref | null = null;
  let to: Ref | null = null;
  const keys: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--from") from = parseRef(argv[++i]);
    else if (a === "--to") to = parseRef(argv[++i]);
    else if (a === "--key") keys.push(argv[++i] ?? "");
    else {
      console.error(`unknown argument ${a}`);
      return 2;
    }
  }
  if (from === null || to === null) {
    console.error("usage: bun copy-secret.ts --from <namespace>/<secret> --to <namespace>/<secret> [--key <key>]...");
    return 2;
  }
  if (from.namespace === to.namespace && from.name === to.name) {
    console.error("refused: source and destination are the same Secret");
    return 2;
  }
  const wanted = keys.length > 0 ? keys : ["runner-token"];
  if (wanted.some((k) => !/^[-._a-zA-Z0-9]+$/.test(k))) {
    console.error("refused: a key name is not a valid Secret key");
    return 2;
  }
  const got = kubectl(["-n", from.namespace, "get", "secret", from.name, "-o", "json"]);
  if (got.code !== 0) {
    console.error(`kubectl could not read ${from.namespace}/${from.name}: ${got.err.trim()}`);
    return 1;
  }
  let built: { manifest: string; bytes: number };
  try {
    built = buildCopy(got.out, to, wanted);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  }
  const applied = kubectl(["apply", "-f", "-"], built.manifest);
  if (applied.code !== 0) {
    // kubectl's error text can quote the manifest it was sent; never forward it.
    console.error(`kubectl apply into ${to.namespace}/${to.name} failed (exit ${applied.code}); output withheld because it can quote the Secret`);
    return 1;
  }
  console.log(`copied ${wanted.join(", ")} (${built.bytes} bytes) from ${from.namespace}/${from.name} to ${to.namespace}/${to.name}`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
