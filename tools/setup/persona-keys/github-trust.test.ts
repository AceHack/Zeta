// github-trust.ts conformance — the GitHub TEMP-TRUST-ROOT resolver. EVERY test runs
// against FIXTURES via the injected GithubTrustEffects — NEVER live network, NEVER CI
// egress, NEVER a secret. Proves: read-only fetch through the door, dedup/idempotency,
// --dry-run does no network, identity sourcing (arg/config/maintainers), the
// TEMP-TRUST-ROOT banner, and that NO private material can appear in the trust set.
// Run: bun test github-trust.test.ts   (from tools/setup/persona-keys)
import { test, expect } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  TEMP_TRUST_ROOT_BANNER,
  defaultAllowlistPath,
  formatStatus,
  isValidGithubUser,
  keyAlgo,
  parseAllowlistConfig,
  parseKeyLines,
  renderAuthorizedKeys,
  resolveIdentities,
  resolveTrustSet,
  type GithubTrustEffects,
} from "./github-trust.ts";

// A FIXTURE effects door: a static map of user -> .keys body. fetchKeys NEVER hits the
// network; it returns the fixture or throws "404" for unknown users. A network call
// counter proves --dry-run performs zero fetches.
function fixtureEffects(
  keys: Record<string, string>,
  opts?: { gpg?: Record<string, string>; fetchCount?: { n: number }; fsRoot?: string },
): GithubTrustEffects {
  const root = opts?.fsRoot;
  return {
    fetchKeys: async (user) => {
      if (opts?.fetchCount) opts.fetchCount.n += 1;
      const body = keys[user];
      if (body === undefined) throw new Error(`GET https://github.com/${user}.keys -> HTTP 404`);
      return body;
    },
    fetchGpg: async (user) => {
      if (opts?.fetchCount) opts.fetchCount.n += 1;
      return opts?.gpg?.[user] ?? "";
    },
    readText: (p) => readFileSync(p, "utf8"),
    exists: (p) => (root === undefined ? false : existsSync(p)),
    listDir: (p) =>
      root === undefined
        ? []
        : readdirSync(p, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name),
  };
}

const ED = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDwJVbQNiFzUCiOhc aaron@lucent.financial";
const RSA = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ octocat@github";

test("resolveTrustSet: fetches public keys through the door, annotates each by source", async () => {
  const fx = fixtureEffects({ aaron: ED + "\n", octocat: RSA + "\n" });
  const res = await resolveTrustSet(fx, { identities: ["aaron", "octocat"] });
  expect(res.dryRun).toBe(false);
  expect(res.trustSet).toHaveLength(2);
  expect(res.trustSet[0]?.source).toBe("aaron");
  expect(res.trustSet[0]?.algo).toBe("ssh-ed25519");
  expect(res.trustSet[1]?.source).toBe("octocat");
  expect(res.perIdentity.find((p) => p.user === "aaron")?.status).toBe("ok");
  expect(res.perIdentity.find((p) => p.user === "aaron")?.sshKeyCount).toBe(1);
});

test("--dry-run performs ZERO network calls and resolves an empty set", async () => {
  const fetchCount = { n: 0 };
  const fx = fixtureEffects({ aaron: ED + "\n" }, { fetchCount });
  const res = await resolveTrustSet(fx, { identities: ["aaron"], dryRun: true });
  expect(res.dryRun).toBe(true);
  expect(fetchCount.n).toBe(0); // NO network in dry-run
  expect(res.trustSet).toHaveLength(0);
  expect(formatStatus(res)).toContain("NO network");
  expect(formatStatus(res)).toContain(TEMP_TRUST_ROOT_BANNER);
});

test("idempotent: the same key published by two identities collapses to one entry", async () => {
  const fx = fixtureEffects({ aaron: ED + "\n", clone: ED + "\n" });
  const res = await resolveTrustSet(fx, { identities: ["aaron", "clone"] });
  expect(res.trustSet).toHaveLength(1); // de-duplicated by exact key line
  expect(res.trustSet[0]?.source).toBe("aaron"); // first source in identity order wins
});

test("a user with multiple keys, and blank/comment lines, parses cleanly", async () => {
  const body = `# my keys\n${ED}\n\n${RSA}\n`;
  const fx = fixtureEffects({ aaron: body });
  const res = await resolveTrustSet(fx, { identities: ["aaron"] });
  expect(res.trustSet).toHaveLength(2);
  expect(res.perIdentity[0]?.sshKeyCount).toBe(2);
});

test("a fetch error is captured per-identity, not thrown (honest partial readout)", async () => {
  const fx = fixtureEffects({ aaron: ED + "\n" }); // 'ghost' is absent -> 404
  const res = await resolveTrustSet(fx, { identities: ["aaron", "ghost"] });
  expect(res.trustSet).toHaveLength(1); // aaron still resolved
  const ghost = res.perIdentity.find((p) => p.user === "ghost");
  expect(ghost?.status).toBe("error");
  expect(ghost?.error).toContain("404");
});

test("no-keys: a user who published nothing reports status=no-keys", async () => {
  const fx = fixtureEffects({ aaron: "\n# nothing\n" });
  const res = await resolveTrustSet(fx, { identities: ["aaron"] });
  expect(res.trustSet).toHaveLength(0);
  expect(res.perIdentity[0]?.status).toBe("no-keys");
});

test("includeGpg: fetches the public armored block when asked", async () => {
  const armored = "-----BEGIN PGP PUBLIC KEY BLOCK-----\nFAKE\n-----END PGP PUBLIC KEY BLOCK-----";
  const fx = fixtureEffects({ aaron: ED + "\n" }, { gpg: { aaron: armored } });
  const res = await resolveTrustSet(fx, { identities: ["aaron"], includeGpg: true });
  expect(res.gpgBlocks).toHaveLength(1);
  expect(res.gpgBlocks[0]?.armored).toContain("PGP PUBLIC KEY");
  expect(res.perIdentity[0]?.gpgCount).toBe(1);
});

test("renderAuthorizedKeys: emits the banner + source annotations, NO private material", async () => {
  const fx = fixtureEffects({ aaron: ED + "\n" });
  const res = await resolveTrustSet(fx, { identities: ["aaron"] });
  const text = renderAuthorizedKeys(res);
  expect(text).toContain(TEMP_TRUST_ROOT_BANNER);
  expect(text).toContain("# source: gh:aaron");
  expect(text).toContain("ssh-ed25519");
  expect(text).not.toMatch(/PRIVATE KEY/); // public-only by construction
});

test("isValidGithubUser: accepts valid handles, rejects path/URL-injection attempts", () => {
  expect(isValidGithubUser("aaron")).toBe(true);
  expect(isValidGithubUser("octo-cat")).toBe(true);
  expect(isValidGithubUser("a".repeat(39))).toBe(true);
  expect(isValidGithubUser("a".repeat(40))).toBe(false);
  expect(isValidGithubUser("-leading")).toBe(false);
  expect(isValidGithubUser("trailing-")).toBe(false);
  expect(isValidGithubUser("has space")).toBe(false);
  expect(isValidGithubUser("../etc/passwd")).toBe(false);
  expect(isValidGithubUser("a/b")).toBe(false);
});

test("parseKeyLines + keyAlgo: trims, drops blanks/comments, reads the algo token", () => {
  expect(parseKeyLines(`  ${ED}  \n\n# c\n${RSA}`)).toEqual([ED, RSA]);
  expect(keyAlgo(ED)).toBe("ssh-ed25519");
  expect(keyAlgo(RSA)).toBe("ssh-rsa");
});

test("parseAllowlistConfig: tolerates {identities:[...]} and bare [...]; ignores non-strings", () => {
  expect(parseAllowlistConfig(`{"identities":["a","b"]}`)).toEqual(["a", "b"]);
  expect(parseAllowlistConfig(`["x","y"]`)).toEqual(["x", "y"]);
  expect(parseAllowlistConfig(`{"identities":["a",1,null,"b"]}`)).toEqual(["a", "b"]);
});

test("resolveIdentities: explicit --user arg wins, validated + deduped + sorted", () => {
  const fx = fixtureEffects({});
  const r = resolveIdentities(fx, { repoRoot: "/nope", identities: ["zed", "aaron", "aaron", "bad name"] });
  expect(r.sourceKind).toBe("arg");
  expect(r.identities).toEqual(["aaron", "zed"]); // sorted, deduped
  expect(r.rejected).toContain("bad name");
});

test("resolveIdentities: sources from an allowlist config file when present (fs fixture)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ghtrust-"));
  try {
    mkdirSync(join(tmp, "maintainers"), { recursive: true });
    writeFileSync(defaultAllowlistPath(tmp), `{"identities":["octocat","aaron"]}`);
    const fx = fixtureEffects({}, { fsRoot: tmp });
    const r = resolveIdentities(fx, { repoRoot: tmp });
    expect(r.sourceKind).toBe("config");
    expect(r.identities).toEqual(["aaron", "octocat"]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("resolveIdentities: falls back to maintainers/ dir names when no arg/config (fs fixture)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "zeta-ghtrust-"));
  try {
    for (const u of ["aaron", "octocat"]) {
      mkdirSync(join(tmp, "maintainers", u), { recursive: true });
      writeFileSync(join(tmp, "maintainers", u, "keyring-public.json"), `{"user":"${u}"}`);
    }
    // a dir WITHOUT a keyring/pubkeys file is NOT a trusted identity
    mkdirSync(join(tmp, "maintainers", "empty-dir"), { recursive: true });
    const fx = fixtureEffects({}, { fsRoot: tmp });
    const r = resolveIdentities(fx, { repoRoot: tmp });
    expect(r.sourceKind).toBe("maintainers");
    expect(r.identities).toEqual(["aaron", "octocat"]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
