#!/usr/bin/env bun
// refresh-ollama-pin.ts — bump .github/ollama-pin.json to a chosen (default: latest) release.
//
//   bun src/Core.TypeScript/ace/refresh-ollama-pin.ts                # latest
//   bun src/Core.TypeScript/ace/refresh-ollama-pin.ts --tag v0.32.13 # a specific release
//
// THE POINT IS THE CROSS-CHECK, not the convenience. The digest is taken from TWO independent
// sources and the pin is NOT written if they disagree:
//   (1) the release's own sha256sum.txt — produced by upstream's build
//   (2) the GitHub API asset `digest`   — computed by GitHub over the stored bytes
// Downloading the artifact and pinning its hash would be a check that cannot fail: it
// certifies whatever you happened to be served, which is the thing in question.
//
// THIS DOES NOT PROVE THE PIN WORKS. It only records it. Proving it is a real runner's job —
// verify-ollama-pin.yml, which runs automatically on any PR touching the pin. Merging a bumped
// pin without that run is shipping an unverified change to the lane that keeps the society
// ticking (tick-must-never-stop; a lapse cost 12 hours once).
//
// `_doc` and `aceGaps` in the pin file are preserved verbatim; only `entry` and `artifact`
// are rewritten.

import { join } from "node:path";

const ASSET = "ollama-linux-amd64.tar.zst";
const RELEASES = "https://api.github.com/repos/ollama/ollama/releases";

interface ReleaseAsset {
  readonly name: string;
  readonly size: number;
  readonly digest?: string | null;
}
interface Release {
  readonly tag_name: string;
  readonly published_at: string;
  readonly assets: readonly ReleaseAsset[];
}

export interface CrossCheck {
  readonly ok: boolean;
  readonly reason?: string;
  readonly digest?: string;
}

/**
 * The refusal, isolated so it is readable and testable: two sources, and a disagreement is a
 * STOP rather than a pick-one.
 */
export function crossCheckDigests(fromSumsFile: string | null, fromApi: string | null): CrossCheck {
  if (fromSumsFile === null || fromSumsFile.length === 0)
    return { ok: false, reason: `sha256sum.txt has no line for ${ASSET} — there is no second source; do not pin blind` };
  if (fromApi === null || fromApi.length === 0)
    return { ok: false, reason: "GitHub reported no asset digest — cross-check impossible; do not pin blind" };
  if (fromSumsFile !== fromApi)
    return {
      ok: false,
      reason: `DIGEST DISAGREEMENT:\n  sha256sum.txt : ${fromSumsFile}\n  GitHub API    : ${fromApi}\nTwo sources that should agree do not. Do NOT pin. Investigate.`,
    };
  return { ok: true, digest: fromSumsFile };
}

/** Pull the digest for `asset` out of a `sha256sum.txt` body (`<hex>  ./<asset>`). */
export function digestFromSumsFile(body: string, asset: string): string | null {
  for (const line of body.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && (parts[1] === `./${asset}` || parts[1] === asset)) return parts[0] ?? null;
  }
  return null;
}

async function main(argv: readonly string[]): Promise<number> {
  let tag: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--tag") {
      const v = argv[++i];
      if (v === undefined) {
        console.error("refresh-ollama-pin: --tag needs a value");
        return 1;
      }
      tag = v;
    } else {
      console.error(`refresh-ollama-pin: unknown arg: ${String(argv[i])}`);
      return 1;
    }
  }

  const relUrl = tag === null ? `${RELEASES}/latest` : `${RELEASES}/tags/${tag}`;
  const relRes = await fetch(relUrl, { headers: { accept: "application/vnd.github+json" } });
  if (!relRes.ok) {
    console.error(`refresh-ollama-pin: ${relUrl} -> HTTP ${relRes.status}`);
    return 1;
  }
  const rel = (await relRes.json()) as Release;
  const asset = rel.assets.find((a) => a.name === ASSET);
  if (asset === undefined) {
    console.error(`refresh-ollama-pin: release ${rel.tag_name} has no asset ${ASSET}`);
    return 1;
  }

  const sumsUrl = `https://github.com/ollama/ollama/releases/download/${rel.tag_name}/sha256sum.txt`;
  const sumsRes = await fetch(sumsUrl, { redirect: "follow" });
  const sums = sumsRes.ok ? await sumsRes.text() : "";

  const check = crossCheckDigests(
    digestFromSumsFile(sums, ASSET),
    (asset.digest ?? "").replace(/^sha256:/, "") || null,
  );
  if (!check.ok || check.digest === undefined) {
    console.error(`refresh-ollama-pin: ${check.reason ?? "cross-check failed"}`);
    return 1;
  }

  const pinPath = join(process.cwd(), ".github", "ollama-pin.json");
  const pin = (await Bun.file(pinPath).json()) as Record<string, Record<string, unknown>>;

  const entry = pin["entry"];
  const artifact = pin["artifact"];
  if (entry === undefined || artifact === undefined) {
    console.error(`refresh-ollama-pin: ${pinPath} is missing entry/artifact`);
    return 1;
  }

  entry["version"] = rel.tag_name.replace(/^v/, "");
  entry["contentAddress"] = `sha256:${check.digest}`;
  entry["lastUpdated"] = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;

  artifact["tag"] = rel.tag_name;
  artifact["asset"] = ASSET;
  artifact["url"] = `https://github.com/ollama/ollama/releases/download/${rel.tag_name}/${ASSET}`;
  artifact["sizeBytes"] = asset.size;
  artifact["publishedAt"] = rel.published_at;

  // 2-space JSON, trailing newline, non-ASCII left intact: `_doc` is prose with em dashes,
  // and escaping it would defeat the point of keeping the verification substrate readable
  // in a diff (.claude/rules/no-binary-in-proof-lineage.md).
  await Bun.write(pinPath, `${JSON.stringify(pin, null, 2)}\n`);

  console.log(`pinned ${rel.tag_name} ${ASSET}`);
  console.log(`  sha256 ${check.digest}  (agreed by sha256sum.txt and the GitHub API digest)`);
  console.log("");
  console.log("NOT YET VERIFIED. Push a branch and open a PR — verify-ollama-pin.yml runs on it.");
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
