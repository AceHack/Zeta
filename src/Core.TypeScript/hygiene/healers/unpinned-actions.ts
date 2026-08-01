/**
 * unpinned-actions healer — Tier 0 (zero intelligence).
 *
 * Detects: GitHub Actions `uses:` lines with tag refs (@v4, @v2) instead of
 *          full 40-char SHA pins (@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0).
 * Fixes: replaces the tag with the known SHA pin from a registry.
 *
 * WHY THIS MATTERS: the semgrep gate requires SHA-pinned actions (supply chain
 * security). Every workflow file we created in this session failed semgrep until
 * we pinned them. This healer automates that fix.
 *
 * Laws:
 * - Idempotence: already-pinned actions are untouched ✓
 * - Closure: pinning cannot introduce new findings ✓
 * - Convergence: one pass (each line is independent) ✓
 * - Totality: never throws (unknown actions are left unchanged = decline) ✓
 * - Exit: unknown action = left as-is (the healer declines on that line) ✓
 * - Bounded scope: one drift class (unpinned actions) ✓
 */

import type { Healer, Detector, Finding, FileTree } from "../healer-harness";

/** Known action SHA pins (the repo's standard versions). */
const KNOWN_PINS: ReadonlyMap<string, { sha: string; version: string }> = new Map([
  ["actions/checkout", { sha: "9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0", version: "v7.0.0" }],
  ["oven-sh/setup-bun", { sha: "0c5077e51419868618aeaa5fe8019c62421857d6", version: "v2.2.0" }],
  ["actions/cache", { sha: "55cc8345863c7cc4c66a329aec7e433d2d1c52a9", version: "v6.1.0" }],
]);

/** Regex: `uses: owner/repo@<not-a-sha>` (a SHA is exactly 40 hex chars) */
const UNPINNED_USES = /(\s*-?\s*uses:\s*)([\w-]+\/[\w.-]+)@(?![0-9a-f]{40}\b)(\S+)/;

export const unpinnedActionsDetector: Detector = {
  name: "unpinned-github-actions",
  detect(tree: FileTree): readonly Finding[] {
    const findings: Finding[] = [];
    for (const [path, content] of tree) {
      if (!path.endsWith(".yml") && !path.endsWith(".yaml")) continue;
      if (!path.includes(".github/workflows/")) continue;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i]!.match(UNPINNED_USES);
        if (match) {
          findings.push({
            path,
            rule: "UNPINNED-ACTION",
            detail: `${match[2]}@${match[3]} is not SHA-pinned (line ${i + 1})`,
          });
        }
      }
    }
    return findings;
  },
};

export const unpinnedActionsHealer: Healer = {
  name: "action-sha-pinner",
  heal(tree: FileTree): FileTree {
    const result = new Map(tree);
    for (const [path, content] of tree) {
      if (!path.endsWith(".yml") && !path.endsWith(".yaml")) continue;
      if (!path.includes(".github/workflows/")) continue;
      const lines = content.split("\n");
      let changed = false;
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i]!.match(UNPINNED_USES);
        if (match) {
          const action = match[2]!;
          const pin = KNOWN_PINS.get(action);
          if (pin) {
            lines[i] = `${match[1]}${action}@${pin.sha} # ${pin.version}`;
            changed = true;
          }
          // Unknown action: leave unchanged (EXIT — decline on this line)
        }
      }
      if (changed) result.set(path, lines.join("\n"));
    }
    return result;
  },
};
