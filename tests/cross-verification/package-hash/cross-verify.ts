// Ace package_hash content-identity cross-verification oracle (TS).
// Reads vectors.json, computes packageHash + the intermediate canonical-JSON for each
// fixture package, writes ts-output.json, and ASSERTS each against the fixture's
// expected_canonical_json + expected_package_hash (exit non-zero on any mismatch —
// assert-don't-skip). The expected values are the cross-language contract: a future
// F#/C#/Rust Ace must reproduce them. Run from this directory: `bun cross-verify.ts`.
import { packageHash } from "../../../tools/ace/package-hash.ts";
import { canonicalBytes } from "../../../tools/ace/canonical.ts";
import type { AcePackage } from "../../../tools/ace/store.ts";

interface Vec {
  id: string;
  package: AcePackage;
  expected_canonical_json: string;
  expected_package_hash: string;
}

const dec = new TextDecoder();
const vectors = (JSON.parse(await Bun.file("vectors.json").text()) as { vectors: Vec[] }).vectors;

const results: Record<string, { canonical_json: string; package_hash: string }> = {};
let mismatches = 0;

for (const v of vectors) {
  const { signature, ...rest } = v.package.manifest;
  void signature;
  const canonical = dec.decode(canonicalBytes({ manifest: rest, files: v.package.files }));
  const hash = packageHash(v.package);
  results[v.id] = { canonical_json: canonical, package_hash: hash };
  if (canonical !== v.expected_canonical_json) {
    mismatches++;
    console.error(`canonical MISMATCH ${v.id}:\n  got=${canonical}\n  exp=${v.expected_canonical_json}`);
  }
  if (hash !== v.expected_package_hash) {
    mismatches++;
    console.error(`package_hash MISMATCH ${v.id}: got=${hash} exp=${v.expected_package_hash}`);
  }
}

await Bun.write("ts-output.json", JSON.stringify(results, null, 2) + "\n");
console.log(`package_hash cross-verify: ${vectors.length} vectors, ${mismatches} mismatches.`);
if (mismatches > 0) process.exit(1);
