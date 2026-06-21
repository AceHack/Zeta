import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";
const SCRIPT = resolve(dirname(fileURLToPath(import.meta.url)), "pr-archive.ts");
function run(command, args, cwd, env) {
    return spawnSync(command, Array.from(args), {
        cwd,
        env: { ...process.env, ...env },
        encoding: "utf8",
        maxBuffer: 4 * 1024 * 1024,
    });
}
function writeFakeGh(binDir) {
    const ghPath = join(binDir, "gh");
    writeFileSync(ghPath, `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "api" && "$2" == "graphql" ]]; then
  cat <<'JSON'
{"data":{"repository":{"pullRequest":{"number":123,"title":"Archive Staging Proof","author":{"login":"codex"},"state":"MERGED","createdAt":"2026-05-27T00:00:00Z","mergedAt":"2026-05-27T00:01:00Z","closedAt":"2026-05-27T00:01:00Z","headRefName":"claim/archive-staging-proof","baseRefName":"main","body":"Preserve this discussion.","reviewThreads":{"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]},"reviews":{"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]},"comments":{"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]}}}}}
JSON
  exit 0
fi
echo "unexpected gh invocation: $*" >&2
exit 1
`);
    chmodSync(ghPath, 0o755);
}
describe("archive-pr", () => {
    test("stages the generated archive file", () => {
        const repo = mkdtempSync(join(tmpdir(), "zeta-archive-pr-test-"));
        const binDir = join(repo, "bin");
        mkdirSync(binDir);
        writeFakeGh(binDir);
        const gitInit = run("git", ["init"], repo);
        expect(gitInit.status).toBe(0);
        const env = {
            GH_REPO: "Lucent-Financial-Group/Zeta",
            PATH: `${binDir}:${process.env.PATH ?? ""}`,
        };
        const archived = run("bun", [SCRIPT, "123"], repo, env);
        expect(archived.stderr).toBe("");
        expect(archived.status).toBe(0);
        expect(archived.stdout).toContain("staged docs/pr-discussions/PR-0123-archive-staging-proof.md");
        const cached = run("git", ["diff", "--cached", "--name-only"], repo);
        expect(cached.status).toBe(0);
        expect(cached.stdout.trim()).toBe("docs/pr-discussions/PR-0123-archive-staging-proof.md");
    });
});
