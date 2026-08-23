/**
 * src/Core.TypeScript/ci/dockerfiles/windows-dockerfile-workspaces.test.ts
 *
 * The Windows install-test image COPYs an explicit, hand-maintained subset of
 * the repo. `install.ps1` then runs `bun install --frozen-lockfile` inside it,
 * and bun resolves the ROOT manifest's `workspaces` array against whatever the
 * build context actually contains. So the Dockerfile's COPY list is COUPLED to
 * package.json's `workspaces` -- and nothing checked that coupling.
 *
 * It broke exactly the way an unchecked coupling breaks. #14200/#14253/#14292
 * added the `src/apps/twitch-ai` workspace; #14303 correctly regenerated
 * bun.lock (main had been red for every PR); and this lane went red instead,
 * 435 seconds into a Windows container build, with:
 *
 *   error: Workspace not found "src/apps/twitch-ai"
 *
 * Nobody added a bad line. The COPY set just stopped being sufficient, silently,
 * because of a change in a different file. That is the failure this test exists
 * to convert into a lint-time message.
 *
 * The expected set is DERIVED from package.json rather than restated here -- a
 * hand-written second list would drift from the first and reproduce the bug one
 * level up.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT_PACKAGE_JSON_PATH = fileURLToPath(new URL("../../../../package.json", import.meta.url));
const WINDOWS_DOCKERFILE_PATH = fileURLToPath(new URL("./windows-install-ps1-test/Dockerfile", import.meta.url));

const rootPackageJson = JSON.parse(readFileSync(ROOT_PACKAGE_JSON_PATH, "utf8")) as {
  workspaces?: string[];
};
const declaredWorkspaces: string[] = rootPackageJson.workspaces ?? [];
const DOCKERFILE = readFileSync(WINDOWS_DOCKERFILE_PATH, "utf8");

/** COPY sources actually present in the Dockerfile, comments excluded. */
const copySources = (): string[] =>
  DOCKERFILE.split("\n")
    .filter((line) => /^\s*COPY\s/.test(line))
    .flatMap((line) => {
      const parts = line.trim().split(/\s+/).slice(1);
      // Last token is the destination; everything before it is a source.
      return parts.slice(0, -1);
    });

describe("windows install-test image: workspace manifests are COPYd", () => {
  test("the root manifest still declares workspaces (guards the guard)", () => {
    // If workspaces disappears entirely this test would pass vacuously below,
    // so assert the precondition it depends on.
    expect(Array.isArray(rootPackageJson.workspaces)).toBe(true);
    expect(declaredWorkspaces.length).toBeGreaterThan(0);
  });

  test("every declared workspace has a matching package.json COPY", () => {
    const sources = copySources();
    const missing = declaredWorkspaces.filter((workspace) => {
      // A workspace entry may be a literal path or a glob; a COPY of the
      // directory itself, or of its package.json, both satisfy the need.
      const literal = `${workspace}/package.json`;
      return !sources.some((source) => source === literal || source === workspace);
    });

    expect(
      missing,
      `package.json declares workspace(s) that the Windows Dockerfile never COPYs: ` +
        `${missing.join(", ")}. install.ps1 runs \`bun install --frozen-lockfile\` in that ` +
        `image, so bun will fail with 'Workspace not found "<path>"' after a multi-minute ` +
        `container build. Add: COPY <workspace>/package.json C:/workspace/<workspace>/package.json`,
    ).toEqual([]);
  });

  test("the lockfile the image installs from is copied too", () => {
    // --frozen-lockfile is meaningless without it, and its absence would make
    // the check above pass while the build still failed.
    const sources = copySources();
    expect(sources).toContain("bun.lock");
    expect(sources).toContain("package.json");
  });
});
