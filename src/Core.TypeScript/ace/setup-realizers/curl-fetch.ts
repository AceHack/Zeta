import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

let curlSupportsRetryAllErrors: boolean | undefined;

function curlHasRetryAllErrors(): boolean {
  if (curlSupportsRetryAllErrors !== undefined) return curlSupportsRetryAllErrors;
  const probe = spawnSync("curl", ["--help", "all"], { encoding: "utf8" });
  curlSupportsRetryAllErrors =
    probe.status === 0 && probe.stdout.includes("--retry-all-errors");
  return curlSupportsRetryAllErrors;
}

/** Mirror tools/setup/common/curl-fetch.sh curl_fetch (file output). */
export async function curlFetchToFile(outputPath: string, url: string): Promise<void> {
  const retryCount = process.env.ZETA_CURL_RETRY_COUNT ?? "12";
  const retryDelay = process.env.ZETA_CURL_RETRY_DELAY_SECONDS ?? "10";
  const retryMaxTime = process.env.ZETA_CURL_RETRY_MAX_TIME_SECONDS ?? "300";

  const args = [
    "-fsSL",
    "--retry",
    retryCount,
    "--retry-delay",
    retryDelay,
    "--retry-max-time",
    retryMaxTime,
  ];
  if (curlHasRetryAllErrors()) args.push("--retry-all-errors");
  args.push("-o", outputPath, url);

  const proc = Bun.spawn(["curl", ...args], { stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`curl fetch failed (${String(code)}): ${url}`);
  }
}

export function verifySha256File(filePath: string, expectedHex: string): void {
  const actual = createHash("sha256").update(readFileSync(filePath)).digest("hex");
  if (actual !== expectedHex.toLowerCase()) {
    throw new Error(`sha256 mismatch for ${filePath}: expected ${expectedHex}, got ${actual}`);
  }
}

export function resolveRepoRelativeDest(repoRoot: string, destRel: string): string {
  if (destRel.startsWith("~/")) {
    const home = process.env.HOME ?? process.env.USERPROFILE;
    if (!home) throw new Error("HOME unset; cannot resolve ~ path");
    return `${home}/${destRel.slice(2)}`;
  }
  if (destRel.startsWith("/")) return destRel;
  return `${repoRoot}/${destRel}`;
}
