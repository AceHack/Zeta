#!/usr/bin/env bun
/**
 * B-0267 smallest safe slice: Branch Safety ruleset creator (dry-run skeleton).
 * Creates "Branch Safety" ruleset with deletion protection, no force-push, linear history.
 * Usage: bun tools/github/create-branch-safety-ruleset.ts --dry-run
 * Part of ruleset split from B-0155 / B-0265.
 */

const DRY_RUN = process.argv.includes("--dry-run");

export async function main(): Promise<number> {
  console.log("B-0267: Branch Safety ruleset (smallest slice, re-decomposed)");
  if (DRY_RUN) {
    console.log("DRY-RUN: would create ruleset 'Branch Safety' via gh api");
    console.log("Rules: deletion + non_fast_forward + required_linear_history");
    console.log("Target: all branches, enforce on main + develop");
    console.log("Focused check: dry-run path active, live mutation disabled (safe slice)");
    return 0;
  }
  // Live path not yet implemented — fail loudly to prevent silent CI no-op.
  console.error("ERROR: live mode not implemented. Run with --dry-run to preview.");
  return 1;
}

if (import.meta.main) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error("Script failed:", err);
      process.exit(1);
    });
}
