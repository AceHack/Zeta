import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCreateRepoRequest, buildGhApiInvocation, buildGhRunnerEnv, buildSeedBlobRequest, buildSeedCommitRequest, buildSeedRefUpdateRequest, buildGetTreeRequest, buildSeedTreeRequest, computeSeedTree, diffSeedTree, executeGhApiRequest, gitBlobSha, parseCreateRepoResponse, parseGitTreeResponse, parseSeedBlobResponse, parseSeedCommitResponse, parseSeedRefUpdateResponse, parseSeedManifest, parseSeedTreeResponse, resolveSeedFiles, seedCommitMessage, } from "./seed-test-repo.js";
describe("parseSeedManifest", () => {
    test("extracts include and exclude entries from fenced yaml", () => {
        const manifest = parseSeedManifest([
            "intro",
            "```yaml",
            "include:",
            "  - openspec/specs/**/spec.md",
            "  - src/Core/README.md          # if exists",
            "",
            "exclude:",
            "  - AGENTS.md",
            "  - docs/**  # except bootstrap-razor/ itself",
            "```",
            "outro",
        ].join("\n"));
        expect(manifest).toEqual({
            include: ["openspec/specs/**/spec.md", "src/Core/README.md"],
            exclude: ["AGENTS.md", "docs/**"],
        });
    });
});
describe("resolveSeedFiles", () => {
    const manifest = {
        include: ["openspec/specs/**/spec.md", "tools/tla/specs/*.tla", "src/Core/README.md"],
        exclude: ["src/**/*.fs", "docs/**"],
    };
    test("keeps include-matched paths and drops non-matches", () => {
        const candidates = [
            "openspec/specs/foo/spec.md",
            "tools/tla/specs/Bar.tla",
            "src/Core/README.md",
            "tools/hygiene/audit.ts", // matches no include
        ];
        expect(resolveSeedFiles(candidates, manifest)).toEqual([
            "openspec/specs/foo/spec.md",
            "src/Core/README.md",
            "tools/tla/specs/Bar.tla",
        ]);
    });
    test("a path matching no include pattern never appears", () => {
        const candidates = [
            "src/Core/README.md", // included, not excluded → kept
            "src/Core/Engine.fs", // matches no include → dropped
        ];
        expect(resolveSeedFiles(candidates, manifest)).toEqual(["src/Core/README.md"]);
    });
    test("exclude wins over include (include ∧ ¬exclude)", () => {
        const overlap = {
            include: ["src/**/*.md"],
            exclude: ["src/Core/**"],
        };
        const candidates = ["src/Core/README.md", "src/Other/README.md"];
        expect(resolveSeedFiles(candidates, overlap)).toEqual(["src/Other/README.md"]);
    });
    test("result is sorted", () => {
        const candidates = ["tools/tla/specs/Z.tla", "tools/tla/specs/A.tla"];
        expect(resolveSeedFiles(candidates, manifest)).toEqual(["tools/tla/specs/A.tla", "tools/tla/specs/Z.tla"]);
    });
    test("empty candidate list resolves to empty set", () => {
        expect(resolveSeedFiles([], manifest)).toEqual([]);
    });
});
describe("gitBlobSha", () => {
    // Canonical `git hash-object` values: `git hash-object --stdin < /dev/null`
    // and `printf 'hello\n' | git hash-object --stdin`. Hardcoding them proves the
    // implementation matches git's own blob identity (which GitHub's API returns).
    test("empty content matches git's empty-blob SHA", () => {
        expect(gitBlobSha(new Uint8Array(0))).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    });
    test("'hello\\n' matches git hash-object", () => {
        expect(gitBlobSha(Buffer.from("hello\n", "utf8"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
    });
    test("uses raw byte length, not character count, for multi-byte content", () => {
        // "é" is 2 bytes in UTF-8; the header must read `blob 2\0`, not `blob 1\0`.
        // `printf 'é' | git hash-object --stdin` → this SHA.
        expect(gitBlobSha(Buffer.from("é", "utf8"))).toBe("4b04fff51468d8ab5201ab02b725dc477bc7cb45");
    });
});
describe("buildCreateRepoRequest", () => {
    test("authorized org → POST /orgs/<org>/repos with the repo name", () => {
        expect(buildCreateRepoRequest("Lucent-Financial-Group", "zeta-recreation-experiment")).toEqual({
            path: "orgs/Lucent-Financial-Group/repos",
            body: {
                name: "zeta-recreation-experiment",
                private: true,
                auto_init: false,
                description: "B-0193 bootstrap-razor recreation test repo (seeded by tools/bootstrap-razor/seed-test-repo.ts)",
            },
        });
    });
    test("AceHack is also authorized", () => {
        const req = buildCreateRepoRequest("AceHack", "r");
        if (typeof req === "string")
            throw new Error(`expected a request, got refusal: ${req}`);
        expect(req.path).toBe("orgs/AceHack/repos");
    });
    test("ServiceTitan is refused (authorization scope: LFG or AceHack only)", () => {
        const result = buildCreateRepoRequest("ServiceTitan", "r");
        expect(typeof result).toBe("string");
        expect(result).toContain("ServiceTitan");
        expect(result).toContain("unauthorized");
    });
    test("any other org is refused (default-deny, not an allowlist gap)", () => {
        // A look-alike org that is NOT in AUTHORIZED_ORGS must be refused too — the guard
        // is an allowlist, so the refusal does not depend on naming ServiceTitan specifically.
        expect(typeof buildCreateRepoRequest("Lucent-Financial", "r")).toBe("string");
        expect(typeof buildCreateRepoRequest("acehack", "r")).toBe("string"); // case-sensitive slug
    });
    test("auto_init is always false (keeps the repo empty for the seed's root commit)", () => {
        const req = buildCreateRepoRequest("AceHack", "r");
        if (typeof req === "string")
            throw new Error(req);
        // false here is load-bearing: an auto-initialized README would break
        // buildSeedCommitRequest(parentSha=null)→parents:[] and show as extraneous.
        expect(req.body.auto_init).toBe(false);
    });
    test("private defaults to true but is overridable", () => {
        const def = buildCreateRepoRequest("AceHack", "r");
        const pub = buildCreateRepoRequest("AceHack", "r", { private: false });
        if (typeof def === "string" || typeof pub === "string")
            throw new Error("expected requests");
        expect(def.body.private).toBe(true);
        expect(pub.body.private).toBe(false);
    });
    test("description is overridable", () => {
        const req = buildCreateRepoRequest("AceHack", "r", { description: "custom" });
        if (typeof req === "string")
            throw new Error(req);
        expect(req.body.description).toBe("custom");
    });
});
describe("parseCreateRepoResponse", () => {
    // A trimmed-but-realistic POST /orgs/{org}/repos (201) repository object: the four
    // fields the seeder reads, plus extra fields it ignores (proves it reads selectively).
    const created = {
        id: 123456,
        node_id: "R_kgDO",
        full_name: "Lucent-Financial-Group/zeta-recreation-experiment",
        private: true,
        html_url: "https://github.com/Lucent-Financial-Group/zeta-recreation-experiment",
        clone_url: "https://github.com/Lucent-Financial-Group/zeta-recreation-experiment.git",
        ssh_url: "git@github.com:Lucent-Financial-Group/zeta-recreation-experiment.git",
        default_branch: "main",
    };
    test("extracts the four seeder-relevant fields, ignoring the rest", () => {
        expect(parseCreateRepoResponse(created)).toEqual({
            fullName: "Lucent-Financial-Group/zeta-recreation-experiment",
            htmlUrl: "https://github.com/Lucent-Financial-Group/zeta-recreation-experiment",
            cloneUrl: "https://github.com/Lucent-Financial-Group/zeta-recreation-experiment.git",
            defaultBranch: "main",
        });
    });
    test("htmlUrl is what the seeder prints for the experiment runner (AC 4)", () => {
        const info = parseCreateRepoResponse(created);
        if (typeof info === "string")
            throw new Error(`expected info, got refusal: ${info}`);
        expect(info.htmlUrl).toBe("https://github.com/Lucent-Financial-Group/zeta-recreation-experiment");
    });
    test("a non-default branch flows verbatim into defaultBranch (ref-update target)", () => {
        const info = parseCreateRepoResponse({ ...created, default_branch: "trunk" });
        if (typeof info === "string")
            throw new Error(info);
        // The final buildSeedRefUpdateRequest targets this branch; it must not be hard-coded to "main".
        expect(info.defaultBranch).toBe("trunk");
    });
    test("non-object responses are refused (null, array, scalar)", () => {
        expect(typeof parseCreateRepoResponse(null)).toBe("string");
        expect(typeof parseCreateRepoResponse([created])).toBe("string");
        expect(typeof parseCreateRepoResponse("ok")).toBe("string");
        expect(typeof parseCreateRepoResponse(42)).toBe("string");
    });
    test("missing string full_name is refused", () => {
        const { full_name, ...rest } = created;
        expect(parseCreateRepoResponse(rest)).toContain("full_name");
    });
    test("missing string html_url is refused (the runner would have nothing to clone)", () => {
        const { html_url, ...rest } = created;
        expect(parseCreateRepoResponse(rest)).toContain("html_url");
    });
    test("missing string clone_url is refused", () => {
        const { clone_url, ...rest } = created;
        expect(parseCreateRepoResponse(rest)).toContain("clone_url");
    });
    test("missing string default_branch is refused (ref update would mis-target)", () => {
        const { default_branch, ...rest } = created;
        expect(parseCreateRepoResponse(rest)).toContain("default_branch");
    });
    test("a non-string field of the right name is still refused", () => {
        expect(typeof parseCreateRepoResponse({ ...created, html_url: 12345 })).toBe("string");
    });
    test("an idempotent re-run's GET /repos/{owner}/{repo} parses identically (same object shape)", () => {
        // GET /repos/{owner}/{repo} returns the same repository object as the create call,
        // so the idempotency path reuses this parser without a second shape.
        const fetched = parseCreateRepoResponse(created);
        const made = parseCreateRepoResponse(created);
        expect(fetched).toEqual(made);
    });
});
describe("buildGhApiInvocation", () => {
    test("GET request uses gh api with no stdin", () => {
        expect(buildGhApiInvocation(buildGetTreeRequest("o", "r", "treeSha"))).toEqual({
            command: "gh",
            args: ["api", "-X", "GET", "repos/o/r/git/trees/treeSha?recursive=1"],
            stdin: null,
        });
    });
    test("POST request serializes the JSON body through stdin", () => {
        const request = buildCreateRepoRequest("AceHack", "zeta-recreation-experiment", {
            private: false,
            description: "seed",
        });
        if (typeof request === "string")
            throw new Error(request);
        expect(buildGhApiInvocation(request)).toEqual({
            command: "gh",
            args: ["api", "-X", "POST", "orgs/AceHack/repos", "--input", "-"],
            stdin: `${JSON.stringify(request.body)}\n`,
        });
    });
    test("PATCH ref update preserves method, path, and force:false body", () => {
        const request = buildSeedRefUpdateRequest("AceHack", "seed", "main", "commitSha", true);
        expect(buildGhApiInvocation(request)).toEqual({
            command: "gh",
            args: ["api", "-X", "PATCH", "repos/AceHack/seed/git/refs/heads/main", "--input", "-"],
            stdin: `${JSON.stringify({ sha: "commitSha", force: false })}\n`,
        });
    });
});
describe("buildGhRunnerEnv", () => {
    test("preserves caller PATH and appends HOME bun bin", () => {
        expect(buildGhRunnerEnv({ PATH: "/custom/bin:/usr/bin", HOME: "/tmp/zeta-home" }).PATH).toBe("/custom/bin:/usr/bin:/tmp/zeta-home/.bun/bin");
    });
    test("does not invent a machine-specific HOME fallback", () => {
        expect(buildGhRunnerEnv({ PATH: "/usr/bin" }).PATH).toBe("/usr/bin");
    });
    test("deduplicates the appended bun bin path", () => {
        expect(buildGhRunnerEnv({ PATH: "/usr/bin:/tmp/zeta-home/.bun/bin", HOME: "/tmp/zeta-home" }).PATH).toBe("/usr/bin:/tmp/zeta-home/.bun/bin");
    });
});
describe("executeGhApiRequest", () => {
    function fakeRunner(result, calls) {
        return {
            run(command, args, stdin) {
                calls.push({ command, args, stdin });
                return { status: result.status, stdout: result.stdout, stderr: result.stderr ?? "" };
            },
        };
    }
    test("runs gh api and parses the response with the matching pure parser", () => {
        const request = buildCreateRepoRequest("AceHack", "zeta-recreation-experiment");
        if (typeof request === "string")
            throw new Error(request);
        const calls = [];
        const result = executeGhApiRequest(request, parseCreateRepoResponse, fakeRunner({
            status: 0,
            stdout: JSON.stringify({
                full_name: "AceHack/zeta-recreation-experiment",
                html_url: "https://github.com/AceHack/zeta-recreation-experiment",
                clone_url: "https://github.com/AceHack/zeta-recreation-experiment.git",
                default_branch: "main",
            }),
        }, calls));
        expect(result).toEqual({
            fullName: "AceHack/zeta-recreation-experiment",
            htmlUrl: "https://github.com/AceHack/zeta-recreation-experiment",
            cloneUrl: "https://github.com/AceHack/zeta-recreation-experiment.git",
            defaultBranch: "main",
        });
        expect(calls).toEqual([
            {
                command: "gh",
                args: ["api", "-X", "POST", "orgs/AceHack/repos", "--input", "-"],
                stdin: `${JSON.stringify(request.body)}\n`,
            },
        ]);
    });
    test("returns a command failure as an error string, not a parsed response", () => {
        const request = buildGetTreeRequest("o", "r", "treeSha");
        const result = executeGhApiRequest(request, parseGitTreeResponse, fakeRunner({ status: 1, stdout: "", stderr: "HTTP 404: Not Found" }, []));
        expect(typeof result).toBe("string");
        expect(result).toContain("HTTP 404");
    });
    test("returns invalid JSON as an error string before calling the parser", () => {
        const request = buildGetTreeRequest("o", "r", "treeSha");
        const result = executeGhApiRequest(request, () => {
            throw new Error("parser should not run");
        }, fakeRunner({ status: 0, stdout: "not json" }, []));
        expect(typeof result).toBe("string");
        expect(result).toContain("invalid JSON");
    });
});
describe("buildSeedBlobRequest", () => {
    // Canonical base64 values: `printf 'hello\n' | base64` → "aGVsbG8K";
    // `printf 'é' | base64` → "w6k=". Hardcoding them pins the wire bytes the
    // `POST /git/blobs` body carries.
    test("empty content → empty base64 string", () => {
        expect(buildSeedBlobRequest(new Uint8Array(0))).toEqual({ content: "", encoding: "base64" });
    });
    test("'hello\\n' matches base64 of its bytes", () => {
        expect(buildSeedBlobRequest(Buffer.from("hello\n", "utf8"))).toEqual({
            content: "aGVsbG8K",
            encoding: "base64",
        });
    });
    test("multi-byte UTF-8 content base64-encodes by raw bytes", () => {
        // "é" is the 2 bytes C3 A9; base64 of those bytes is "w6k=".
        expect(buildSeedBlobRequest(Buffer.from("é", "utf8")).content).toBe("w6k=");
    });
    test("non-UTF-8 binary bytes survive losslessly (why base64, not utf-8)", () => {
        // 0xFF is not valid UTF-8; a `utf-8` upload would corrupt it. base64 round-trips.
        const bytes = new Uint8Array([0x00, 0xff, 0x10]);
        const { content, encoding } = buildSeedBlobRequest(bytes);
        expect(encoding).toBe("base64");
        expect(content).toBe("AP8Q");
        expect(new Uint8Array(Buffer.from(content, "base64"))).toEqual(bytes);
    });
    test("encoding is always the base64 literal", () => {
        expect(buildSeedBlobRequest(Buffer.from("x", "utf8")).encoding).toBe("base64");
    });
});
describe("parseSeedBlobResponse", () => {
    // A trimmed-but-realistic POST /repos/{owner}/{repo}/git/blobs (201) response: the one
    // field the seeder reads (sha), plus the `url` it ignores (proves selective reading).
    // SHA is the content-addressable identity gitBlobSha predicts for the same bytes.
    const created = {
        url: "https://api.github.com/repos/Lucent-Financial-Group/zeta-recreation-experiment/git/blobs/3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15",
        sha: "3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15",
    };
    test("extracts the sha, ignoring the url", () => {
        expect(parseSeedBlobResponse(created)).toEqual({ sha: "3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15" });
    });
    test("the sha is what buildSeedTreeRequest's entries reference", () => {
        const info = parseSeedBlobResponse(created);
        if (typeof info === "string")
            throw new Error(`expected info, got refusal: ${info}`);
        // Each tree entry carries the uploaded blob's SHA; this parser is where it comes from.
        expect(info.sha).toBe("3a0f86fb8db8eea7ccbb9a95f325ddbedfb25e15");
    });
    test("success is a {sha} object, not a bare string (disambiguates the error channel)", () => {
        // A bare-string success would collide with the error-string return; the object wrapper
        // makes `typeof result === "string"` mean "error" unambiguously.
        expect(typeof parseSeedBlobResponse(created)).toBe("object");
    });
    test("non-object responses are refused (null, array, scalar)", () => {
        expect(typeof parseSeedBlobResponse(null)).toBe("string");
        expect(typeof parseSeedBlobResponse([created])).toBe("string");
        expect(typeof parseSeedBlobResponse("3a0f86f")).toBe("string");
        expect(typeof parseSeedBlobResponse(42)).toBe("string");
    });
    test("missing string sha is refused (tree entry would reference nothing)", () => {
        const { sha, ...rest } = created;
        expect(parseSeedBlobResponse(rest)).toContain("sha");
    });
    test("a non-string sha of the right name is still refused", () => {
        expect(typeof parseSeedBlobResponse({ ...created, sha: 12345 })).toBe("string");
    });
    test("type-checks only — any string sha is accepted verbatim (no SHA-format validation)", () => {
        // Same restraint as parseCreateRepoResponse (which never format-checks its URLs):
        // a malformed SHA surfaces as a 422 at the tree-create call, not here.
        expect(parseSeedBlobResponse({ sha: "not-a-real-sha" })).toEqual({ sha: "not-a-real-sha" });
    });
});
describe("computeSeedTree", () => {
    test("pairs each resolved path with the git blob SHA of its bytes, canonically sorted by path", () => {
        const root = mkdtempSync(join(tmpdir(), "b0343-seed-tree-"));
        writeFileSync(join(root, "a.txt"), "hello\n");
        writeFileSync(join(root, "b.txt"), "");
        // Intentionally UNSORTED input: the documented contract is that output is
        // canonically sorted by path regardless of caller order. Asserting against
        // sorted output means this test fails if `computeSeedTree` ever reverts to
        // preserving input order.
        expect(computeSeedTree(["b.txt", "a.txt"], root)).toEqual([
            { path: "a.txt", sha: "ce013625030ba8dba906f756967f9e9ca394464a" },
            { path: "b.txt", sha: "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391" },
        ]);
    });
    test("empty resolved set produces empty tree", () => {
        expect(computeSeedTree([], tmpdir())).toEqual([]);
    });
});
describe("diffSeedTree", () => {
    const a = { path: "a.txt", sha: "aaa" };
    const b = { path: "b.txt", sha: "bbb" };
    const c = { path: "c.txt", sha: "ccc" };
    test("empty target → every desired path is a create, not idempotent", () => {
        expect(diffSeedTree([b, a], [])).toEqual({
            entries: [
                { path: "a.txt", action: "create", desiredSha: "aaa", existingSha: null },
                { path: "b.txt", action: "create", desiredSha: "bbb", existingSha: null },
            ],
            extraneous: [],
            idempotent: false,
        });
    });
    test("identical target → all unchanged and idempotent", () => {
        expect(diffSeedTree([a, b], [a, b])).toEqual({
            entries: [
                { path: "a.txt", action: "unchanged", desiredSha: "aaa", existingSha: "aaa" },
                { path: "b.txt", action: "unchanged", desiredSha: "bbb", existingSha: "bbb" },
            ],
            extraneous: [],
            idempotent: true,
        });
    });
    test("differing blob SHA → update, not idempotent", () => {
        const diff = diffSeedTree([a], [{ path: "a.txt", sha: "OLD" }]);
        expect(diff.entries).toEqual([{ path: "a.txt", action: "update", desiredSha: "aaa", existingSha: "OLD" }]);
        expect(diff.idempotent).toBe(false);
    });
    test("extraneous target file is reported but does NOT break idempotency", () => {
        // Target has the desired file (matching) plus an extra file (e.g. auto-README).
        const diff = diffSeedTree([a], [a, c]);
        expect(diff.entries).toEqual([{ path: "a.txt", action: "unchanged", desiredSha: "aaa", existingSha: "aaa" }]);
        expect(diff.extraneous).toEqual([c]);
        expect(diff.idempotent).toBe(true);
    });
    test("mixed create/update/unchanged → not idempotent, entries path-sorted", () => {
        // desired: a (matches), b (differs → update), c (absent → create); given unsorted.
        const diff = diffSeedTree([c, b, a], [a, { path: "b.txt", sha: "OLD" }]);
        expect(diff.entries).toEqual([
            { path: "a.txt", action: "unchanged", desiredSha: "aaa", existingSha: "aaa" },
            { path: "b.txt", action: "update", desiredSha: "bbb", existingSha: "OLD" },
            { path: "c.txt", action: "create", desiredSha: "ccc", existingSha: null },
        ]);
        expect(diff.idempotent).toBe(false);
    });
    test("empty desired and empty target → vacuously idempotent", () => {
        expect(diffSeedTree([], [])).toEqual({ entries: [], extraneous: [], idempotent: true });
    });
});
describe("buildGetTreeRequest", () => {
    test("constructs the recursive git-trees read path", () => {
        expect(buildGetTreeRequest("Lucent-Financial-Group", "zeta-recreation-experiment", "deadbeef")).toEqual({
            path: "repos/Lucent-Financial-Group/zeta-recreation-experiment/git/trees/deadbeef?recursive=1",
        });
    });
    test("recursive=1 is always present (load-bearing — full-tree blob listing, not top-level only)", () => {
        // Without recursive=1 GitHub returns only top-level entries, so a nested blob
        // would be absent and mis-diff as a spurious create. The builder pins it.
        expect(buildGetTreeRequest("o", "r", "t").path).toContain("?recursive=1");
    });
    test("owner / repo / tree SHA flow verbatim into the path", () => {
        const sha = "aa218f56b14c9653891f9e74264a383fa43fefbd";
        expect(buildGetTreeRequest("o", "r", sha).path).toBe(`repos/o/r/git/trees/${sha}?recursive=1`);
    });
    test("path has no leading slash (gh api convention, matches the other builders)", () => {
        // Sibling builders use bare `orgs/...` / `repos/...` paths for `gh api`; a leading
        // slash would break the relative-path form. Pin it so this read request agrees.
        expect(buildGetTreeRequest("o", "r", "t").path.startsWith("/")).toBe(false);
    });
    test("the built read path's response is what parseGitTreeResponse consumes (read-side pair)", () => {
        // This request fetches the tree; parseGitTreeResponse parses the response. Assert the
        // pair lines up: a response shaped per this endpoint parses into the diff's basis.
        const req = buildGetTreeRequest("o", "r", "rootTreeSha");
        expect(req.path).toContain("git/trees/rootTreeSha");
        const existing = parseGitTreeResponse({
            truncated: false,
            tree: [{ path: "a.txt", type: "blob", sha: "aaa" }],
        });
        if (typeof existing === "string")
            throw new Error(existing);
        expect(existing).toEqual([{ path: "a.txt", sha: "aaa" }]);
    });
});
describe("parseGitTreeResponse", () => {
    // Shape mirrors GitHub's GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1.
    test("keeps blobs as {path, sha}, drops tree + commit entries, sorts by path", () => {
        const response = {
            sha: "root",
            truncated: false,
            tree: [
                { path: "z.txt", mode: "100644", type: "blob", sha: "zzz", size: 3, url: "..." },
                { path: "sub", mode: "040000", type: "tree", sha: "treeSha", url: "..." },
                { path: "a.txt", mode: "100644", type: "blob", sha: "aaa", size: 1, url: "..." },
                { path: "vendored", mode: "160000", type: "commit", sha: "submoduleSha" },
            ],
        };
        expect(parseGitTreeResponse(response)).toEqual([
            { path: "a.txt", sha: "aaa" },
            { path: "z.txt", sha: "zzz" },
        ]);
    });
    test("the parsed blob set feeds diffSeedTree directly (end-to-end bridge)", () => {
        const existing = parseGitTreeResponse({
            truncated: false,
            tree: [{ path: "a.txt", type: "blob", sha: "aaa" }],
        });
        // Narrow off the error branch so the diff call type-checks.
        if (typeof existing === "string")
            throw new Error(existing);
        expect(diffSeedTree([{ path: "a.txt", sha: "aaa" }], existing).idempotent).toBe(true);
    });
    test("empty tree → empty blob set", () => {
        expect(parseGitTreeResponse({ truncated: false, tree: [] })).toEqual([]);
    });
    test("truncated response is rejected (unsafe idempotency basis)", () => {
        const result = parseGitTreeResponse({
            truncated: true,
            tree: [{ path: "a.txt", type: "blob", sha: "aaa" }],
        });
        expect(typeof result).toBe("string");
        expect(result).toContain("truncated");
    });
    test("non-object response is rejected", () => {
        expect(typeof parseGitTreeResponse(null)).toBe("string");
        expect(typeof parseGitTreeResponse("oops")).toBe("string");
    });
    test("missing tree array is rejected", () => {
        expect(typeof parseGitTreeResponse({ truncated: false })).toBe("string");
    });
    test("tree entry missing string path/type/sha is rejected", () => {
        const result = parseGitTreeResponse({
            truncated: false,
            tree: [{ path: "a.txt", type: "blob" }], // no sha
        });
        expect(typeof result).toBe("string");
    });
});
describe("buildSeedTreeRequest", () => {
    const a = { path: "a.txt", sha: "aaa" };
    const b = { path: "b.txt", sha: "bbb" };
    test("create + update become 100644 blob entries carrying the DESIRED sha", () => {
        // desired: a (matches → unchanged, dropped), b (differs → update), c (absent → create)
        const diff = diffSeedTree([a, b, { path: "c.txt", sha: "ccc" }], [a, { path: "b.txt", sha: "OLD" }]);
        expect(buildSeedTreeRequest(diff)).toEqual([
            // b.txt update carries desiredSha "bbb", NOT the existing "OLD"
            { path: "b.txt", mode: "100644", type: "blob", sha: "bbb" },
            { path: "c.txt", mode: "100644", type: "blob", sha: "ccc" },
        ]);
    });
    test("idempotent diff → empty write plan (no tree to submit)", () => {
        expect(buildSeedTreeRequest(diffSeedTree([a, b], [a, b]))).toEqual([]);
    });
    test("fresh (empty) repo → every desired path is a create entry", () => {
        expect(buildSeedTreeRequest(diffSeedTree([b, a], []))).toEqual([
            { path: "a.txt", mode: "100644", type: "blob", sha: "aaa" },
            { path: "b.txt", mode: "100644", type: "blob", sha: "bbb" },
        ]);
    });
    test("output stays path-sorted (inherits diffSeedTree's canonical order)", () => {
        const plan = buildSeedTreeRequest(diffSeedTree([
            { path: "z.txt", sha: "zzz" },
            { path: "a.txt", sha: "aaa" },
        ], []));
        expect(plan.map((e) => e.path)).toEqual(["a.txt", "z.txt"]);
    });
    test("extraneous target files never enter the write plan (seed is add/update only)", () => {
        // Target has the desired file (matching) plus an extra auto-README.
        const diff = diffSeedTree([a], [a, { path: "README.md", sha: "readme" }]);
        expect(diff.extraneous).toEqual([{ path: "README.md", sha: "readme" }]);
        expect(buildSeedTreeRequest(diff)).toEqual([]); // a.txt unchanged, README extraneous → nothing to write
    });
});
describe("parseSeedTreeResponse", () => {
    // A trimmed-but-realistic POST /repos/{owner}/{repo}/git/trees (201) response: the one
    // field the seeder reads (sha = the NEW tree's SHA), plus the `url` and `tree` it ignores
    // (proves selective reading). truncated:false is the normal create path.
    const created = {
        url: "https://api.github.com/repos/Lucent-Financial-Group/zeta-recreation-experiment/git/trees/cd8274d15fa3ae2ab983129fb037999f264ba9a7",
        sha: "cd8274d15fa3ae2ab983129fb037999f264ba9a7",
        tree: [{ path: "a.txt", mode: "100644", type: "blob", sha: "aaa" }],
        truncated: false,
    };
    test("extracts the new tree sha, ignoring url + tree", () => {
        expect(parseSeedTreeResponse(created)).toEqual({ sha: "cd8274d15fa3ae2ab983129fb037999f264ba9a7" });
    });
    test("the sha is what buildSeedCommitRequest's treeSha argument takes", () => {
        const info = parseSeedTreeResponse(created);
        if (typeof info === "string")
            throw new Error(`expected info, got refusal: ${info}`);
        // The commit step threads this SHA forward: buildSeedCommitRequest(info.sha, parentSha, n).
        expect(buildSeedCommitRequest(info.sha, null, 1).tree).toBe("cd8274d15fa3ae2ab983129fb037999f264ba9a7");
    });
    test("success is a {sha} object, not a bare string (disambiguates the error channel)", () => {
        expect(typeof parseSeedTreeResponse(created)).toBe("object");
    });
    test("non-object responses are refused (null, array, scalar)", () => {
        expect(typeof parseSeedTreeResponse(null)).toBe("string");
        expect(typeof parseSeedTreeResponse([created])).toBe("string");
        expect(typeof parseSeedTreeResponse("cd8274d")).toBe("string");
        expect(typeof parseSeedTreeResponse(42)).toBe("string");
    });
    test("truncated:true is refused — created tree is incomplete, commit would miss seed files", () => {
        // Opposite rationale to parseGitTreeResponse's truncated refusal: there a truncated READ
        // would mis-diff; here a truncated WRITE means the seed itself is short.
        expect(parseSeedTreeResponse({ ...created, truncated: true })).toContain("truncated");
    });
    test("truncated:false (and absent truncated) pass — only the literal true refuses", () => {
        expect(parseSeedTreeResponse({ ...created, truncated: false })).toEqual({
            sha: "cd8274d15fa3ae2ab983129fb037999f264ba9a7",
        });
        const { truncated, ...noTruncated } = created;
        expect(parseSeedTreeResponse(noTruncated)).toEqual({
            sha: "cd8274d15fa3ae2ab983129fb037999f264ba9a7",
        });
    });
    test("missing string sha is refused (commit step has no tree to reference)", () => {
        const { sha, ...rest } = created;
        expect(parseSeedTreeResponse(rest)).toContain("sha");
    });
    test("a non-string sha of the right name is still refused", () => {
        expect(typeof parseSeedTreeResponse({ ...created, sha: 12345 })).toBe("string");
    });
    test("type-checks only — any string sha is accepted verbatim (no SHA-format validation)", () => {
        // Same restraint as parseSeedBlobResponse: a malformed SHA surfaces as a 422 at the
        // commit-create call, not here.
        expect(parseSeedTreeResponse({ sha: "not-a-real-sha" })).toEqual({ sha: "not-a-real-sha" });
    });
});
describe("seedCommitMessage", () => {
    test("subject names the file count, body cites the manifest + B-0193/B-0343 lineage", () => {
        const message = seedCommitMessage(7);
        const [subject, ...rest] = message.split("\n");
        expect(subject).toBe("chore(B-0343): seed bootstrap-razor recreation test repo (7 files)");
        const body = rest.join("\n");
        expect(body).toContain("docs/bootstrap-razor/SEED-MANIFEST.md");
        expect(body).toContain("B-0193");
        expect(body).toContain("B-0343");
    });
    test("pluralizes the count noun (1 file vs N files)", () => {
        expect(seedCommitMessage(1)).toContain("(1 file)");
        expect(seedCommitMessage(2)).toContain("(2 files)");
    });
    test("subject and body are separated by a blank line (git convention)", () => {
        // git treats the first blank-line-delimited block as the subject; assert the
        // second line is empty so tools that render subject/body split correctly.
        expect(seedCommitMessage(3).split("\n")[1]).toBe("");
    });
});
describe("buildSeedCommitRequest", () => {
    test("existing ref → parent SHA wrapped in a one-element array", () => {
        expect(buildSeedCommitRequest("treeSha", "parentSha", 2)).toEqual({
            message: seedCommitMessage(2),
            tree: "treeSha",
            parents: ["parentSha"],
        });
    });
    test("brand-new repo (null parent) → empty parents array (root commit)", () => {
        const request = buildSeedCommitRequest("treeSha", null, 5);
        expect(request.parents).toEqual([]);
        expect(request.tree).toBe("treeSha");
    });
    test("carries the provenance message for the given file count", () => {
        expect(buildSeedCommitRequest("t", "p", 1).message).toBe(seedCommitMessage(1));
    });
});
describe("parseSeedCommitResponse", () => {
    // A trimmed-but-realistic POST /repos/{owner}/{repo}/git/commits (201) response: the one
    // field the seeder reads (top-level sha = the NEW commit's SHA), plus the nested tree.sha,
    // parents, and message it ignores (proves selective reading + that it does NOT read tree.sha).
    const created = {
        sha: "7638417db6d59f3c431d3e1f261cc637155684cd",
        url: "https://api.github.com/repos/Lucent-Financial-Group/zeta-recreation-experiment/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd",
        message: "chore(B-0343): seed bootstrap-razor recreation test repo (3 files)",
        tree: { sha: "827efc6d56897b048c772eb4087f854f46256132", url: "https://api.github.com/..." },
        parents: [{ sha: "cd8274d15fa3ae2ab983129fb037999f264ba9a7", url: "https://api.github.com/..." }],
    };
    test("extracts the new commit sha, ignoring tree/parents/message", () => {
        expect(parseSeedCommitResponse(created)).toEqual({ sha: "7638417db6d59f3c431d3e1f261cc637155684cd" });
    });
    test("reads top-level commit sha, NOT the nested tree.sha", () => {
        // The ref must point at the COMMIT; pointing it at tree.sha would yield a ref to a
        // non-commit object. Assert the result is the commit SHA, distinct from tree.sha.
        expect(parseSeedCommitResponse(created)).toEqual({ sha: "7638417db6d59f3c431d3e1f261cc637155684cd" });
        expect(parseSeedCommitResponse(created)).not.toEqual({ sha: "827efc6d56897b048c772eb4087f854f46256132" });
    });
    test("the sha is what buildSeedRefUpdateRequest's commitSha argument takes", () => {
        const info = parseSeedCommitResponse(created);
        if (typeof info === "string")
            throw new Error(`expected info, got refusal: ${info}`);
        // The ref step threads this SHA forward: buildSeedRefUpdateRequest(owner, repo, branch, info.sha, exists).
        expect(buildSeedRefUpdateRequest("LFG", "r", "main", info.sha, false).body.sha).toBe("7638417db6d59f3c431d3e1f261cc637155684cd");
    });
    test("success is a {sha} object, not a bare string (disambiguates the error channel)", () => {
        expect(typeof parseSeedCommitResponse(created)).toBe("object");
    });
    test("non-object responses are refused (null, array, scalar)", () => {
        expect(typeof parseSeedCommitResponse(null)).toBe("string");
        expect(typeof parseSeedCommitResponse([created])).toBe("string");
        expect(typeof parseSeedCommitResponse("7638417")).toBe("string");
        expect(typeof parseSeedCommitResponse(42)).toBe("string");
    });
    test("missing string sha is refused (ref step has no commit to reference)", () => {
        const { sha, ...rest } = created;
        expect(parseSeedCommitResponse(rest)).toContain("sha");
    });
    test("a non-string sha of the right name is still refused", () => {
        expect(typeof parseSeedCommitResponse({ ...created, sha: 12345 })).toBe("string");
    });
    test("no truncated refusal — commits API returns no truncated field", () => {
        // Unlike parseSeedTreeResponse, a commit references exactly one tree, so there is
        // nothing to truncate; a stray truncated:true must NOT be treated as a refusal.
        expect(parseSeedCommitResponse({ ...created, truncated: true })).toEqual({
            sha: "7638417db6d59f3c431d3e1f261cc637155684cd",
        });
    });
    test("type-checks only — any string sha is accepted verbatim (no SHA-format validation)", () => {
        // Same restraint as parseSeedTreeResponse: a malformed SHA surfaces as a 422 at the
        // ref-update call, not here.
        expect(parseSeedCommitResponse({ sha: "not-a-real-sha" })).toEqual({ sha: "not-a-real-sha" });
    });
});
describe("buildSeedRefUpdateRequest", () => {
    test("new ref → POST /git/refs with FULL refs/heads/<branch> body", () => {
        expect(buildSeedRefUpdateRequest("LFG", "seed-repo", "main", "deadbeef", false)).toEqual({
            method: "POST",
            path: "repos/LFG/seed-repo/git/refs",
            body: { ref: "refs/heads/main", sha: "deadbeef" },
        });
    });
    test("existing ref → PATCH with SHORT heads/<branch> suffix and force:false", () => {
        expect(buildSeedRefUpdateRequest("LFG", "seed-repo", "main", "deadbeef", true)).toEqual({
            method: "PATCH",
            path: "repos/LFG/seed-repo/git/refs/heads/main",
            body: { sha: "deadbeef", force: false },
        });
    });
    test("PATCH path uses SHORT heads/ form, never the double refs/heads/heads/ 404 trap", () => {
        // The git/refs/ path already carries the refs/ prefix; the suffix must be the
        // short `heads/<branch>` form. A `refs/heads/<branch>` suffix yields a 404.
        const patch = buildSeedRefUpdateRequest("LFG", "r", "feat/x", "sha", true);
        expect(patch.path).toBe("repos/LFG/r/git/refs/heads/feat/x");
        expect(patch.path).not.toContain("refs/heads/heads/");
    });
    test("POST body uses FULL refs/heads/ form (short form yields a 422)", () => {
        const post = buildSeedRefUpdateRequest("LFG", "r", "feat/x", "sha", false);
        if (post.method !== "POST")
            throw new Error("expected POST for a new ref");
        expect(post.body.ref).toBe("refs/heads/feat/x");
    });
    test("force is always false — seed only fast-forwards, never clobbers", () => {
        const patch = buildSeedRefUpdateRequest("o", "r", "main", "s", true);
        if (patch.method !== "PATCH")
            throw new Error("expected PATCH for an existing ref");
        expect(patch.body.force).toBe(false);
    });
    test("commit SHA flows verbatim into both endpoint shapes", () => {
        const sha = "aa218f56b14c9653891f9e74264a383fa43fefbd";
        const created = buildSeedRefUpdateRequest("o", "r", "main", sha, false);
        const updated = buildSeedRefUpdateRequest("o", "r", "main", sha, true);
        expect(created.body.sha).toBe(sha);
        expect(updated.body.sha).toBe(sha);
    });
});
describe("parseSeedRefUpdateResponse", () => {
    // A trimmed-but-realistic create/update ref response: the full ref plus the nested
    // target object GitHub returns for both POST /git/refs and PATCH /git/refs/heads/<branch>.
    const updated = {
        ref: "refs/heads/main",
        node_id: "REF_kwDO",
        url: "https://api.github.com/repos/Lucent-Financial-Group/zeta-recreation-experiment/git/refs/heads/main",
        object: {
            type: "commit",
            sha: "7638417db6d59f3c431d3e1f261cc637155684cd",
            url: "https://api.github.com/repos/Lucent-Financial-Group/zeta-recreation-experiment/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd",
        },
    };
    test("extracts full ref and nested object.sha, ignoring url/node_id/type", () => {
        expect(parseSeedRefUpdateResponse(updated)).toEqual({
            ref: "refs/heads/main",
            sha: "7638417db6d59f3c431d3e1f261cc637155684cd",
        });
    });
    test("reads nested object.sha, not a top-level sha field", () => {
        const response = { ...updated, sha: "top-level-sha-is-not-the-ref-target" };
        expect(parseSeedRefUpdateResponse(response)).toEqual({
            ref: "refs/heads/main",
            sha: "7638417db6d59f3c431d3e1f261cc637155684cd",
        });
    });
    test("success is an object, not a bare string (disambiguates the error channel)", () => {
        expect(typeof parseSeedRefUpdateResponse(updated)).toBe("object");
    });
    test("non-object responses are refused (null, array, scalar)", () => {
        expect(typeof parseSeedRefUpdateResponse(null)).toBe("string");
        expect(typeof parseSeedRefUpdateResponse([updated])).toBe("string");
        expect(typeof parseSeedRefUpdateResponse("refs/heads/main")).toBe("string");
        expect(typeof parseSeedRefUpdateResponse(42)).toBe("string");
    });
    test("missing string ref is refused (final report would not know the branch)", () => {
        const { ref, ...rest } = updated;
        expect(parseSeedRefUpdateResponse(rest)).toContain("ref");
    });
    test("missing object is refused (target object carries the commit SHA)", () => {
        const { object, ...rest } = updated;
        expect(parseSeedRefUpdateResponse(rest)).toContain("object");
        expect(parseSeedRefUpdateResponse({ ...updated, object: null })).toContain("object");
        expect(parseSeedRefUpdateResponse({ ...updated, object: [] })).toContain("object");
    });
    test("missing string object.sha is refused", () => {
        const { sha, ...objectWithoutSha } = updated.object;
        expect(parseSeedRefUpdateResponse({ ...updated, object: objectWithoutSha })).toContain("object.sha");
        expect(parseSeedRefUpdateResponse({ ...updated, object: { ...updated.object, sha: 12345 } })).toContain("object.sha");
    });
    test("type-checks only — object.type and SHA format are not validated here", () => {
        expect(parseSeedRefUpdateResponse({ ...updated, object: { type: "tag", sha: "not-a-real-sha" } })).toEqual({
            ref: "refs/heads/main",
            sha: "not-a-real-sha",
        });
    });
});
