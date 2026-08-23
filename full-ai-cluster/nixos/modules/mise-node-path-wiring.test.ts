/**
 * full-ai-cluster/nixos/modules/mise-node-path-wiring.test.ts
 *
 * THE CALL SITE IS PART OF THE DESIGN, so it gets falsifiers too.
 *
 * Aaron, from his home directory on a host: `op` -> "command not found", while
 * the same shell inside the checkout resolved the pinned 2.34.1. Two host
 * classes, two different correct answers, and conflating them is the bug:
 *
 *   - DEVELOPER WORKSTATION -- project-scoped is CORRECT and deliberate. The
 *     pin travels with the project, exactly like a local `dotnet tool` manifest
 *     or node_modules/.bin. tools/setup/common/shellenv.sh is untouched, and
 *     this file must never grow a check that would push it toward global.
 *   - CLUSTER NODE -- project-scoped has nothing to scope to. A node
 *     bootstrapping shared secrets is a login shell in $HOME or a systemd unit,
 *     not a shell inside the checkout.
 *
 * What made this invisible is that `mise activate` WITHOUT `--shims` never puts
 * the shims dir on PATH, while common.nix's own comments asserted that it did.
 * Nothing could fail, so nothing did.
 *
 * The properties below only exist at the seam, and each was measured before it
 * was written:
 *
 *   1. the node profile puts mise's shims dir on PATH at all
 *   2. it ALSO sets MISE_GLOBAL_CONFIG_FILE -- shims alone are NOT enough.
 *      Measured, clean env, from ~:
 *        shims only                      -> "mise ERROR No version is set for shim: op"
 *        shims + MISE_GLOBAL_CONFIG_FILE -> 2.34.1
 *   3. that global config points at the node's OWN checkout, never a
 *      duplicated pin -- `mise use -g` or a nixpkgs `_1password-cli` would fork
 *      the version. Aaron already caught exactly that drift on this file for
 *      bun, so the guard is a regression test, not a hypothetical.
 *   4. shims are APPENDED, not prepended, so in-checkout resolution still hits
 *      the direct install paths (measured 100 x `op --version`: 1.47s direct vs
 *      5.98s via shim, ~4x)
 *   5. the interim-hub dependency stays LABELLED -- a dependency nobody marked
 *      temporary is one nobody removes
 *
 * Comments are stripped before every check, so a comment can never satisfy one.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const COMMON_NIX_PATH = fileURLToPath(new URL("./common.nix", import.meta.url));
const SHELLENV_PATH = fileURLToPath(new URL("../../../tools/setup/common/shellenv.sh", import.meta.url));
const MISE_TOML_PATH = fileURLToPath(new URL("../../../.mise.toml", import.meta.url));

const COMMON_NIX = readFileSync(COMMON_NIX_PATH, "utf8");
const SHELLENV = readFileSync(SHELLENV_PATH, "utf8");
const MISE_TOML = readFileSync(MISE_TOML_PATH, "utf8");

/**
 * Nix/shell text with comment lines removed, so prose can never satisfy a
 * check. common.nix carries a long rationale block; without this strip, every
 * assertion below would pass on the explanation alone.
 */
const stripComments = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");

const COMMON_NIX_CODE = stripComments(COMMON_NIX);

/** The profile.d snippet is the only surface a login shell on a node sources. */
const profileSnippet = (): string => {
  const start = COMMON_NIX_CODE.indexOf('environment.etc."profile.d/zeta-user-paths.sh".text');
  expect(start).toBeGreaterThan(-1);
  const end = COMMON_NIX_CODE.indexOf("boot.loader", start);
  expect(end).toBeGreaterThan(start);
  return COMMON_NIX_CODE.slice(start, end);
};

describe("cluster node: mise-pinned tools resolve outside the checkout", () => {
  test("1. the node login profile puts mise's shims dir on PATH", () => {
    const snippet = profileSnippet();
    expect(snippet).toContain(".local/share/mise/shims");
    expect(snippet).toMatch(/export PATH=/);
  });

  test("2. it also sets MISE_GLOBAL_CONFIG_FILE -- shims alone error out", () => {
    // Without this, a shim outside a project dispatches to mise, mise finds no
    // config declaring the tool, and `op` fails with "No version is set for
    // shim: op". Measured. The shim resolving is not the shim working.
    expect(profileSnippet()).toContain("MISE_GLOBAL_CONFIG_FILE");
  });

  test("3. the global config points at the node's own checkout, not a second pin", () => {
    const snippet = profileSnippet();
    // `_zeta_repo` is common.nix's own probe for /etc/zeta or $HOME/Zeta -- the
    // node's Zeta clone. Sourcing the pin from there keeps .mise.toml the single
    // source of truth.
    expect(snippet).toMatch(/MISE_GLOBAL_CONFIG_FILE="\$_zeta_repo\/\.mise\.toml"/);
    // The drift alternatives must never appear.
    expect(snippet).not.toContain("mise use -g");
    expect(snippet).not.toContain("mise use --global");
  });

  test("3b. no nix surface declares its own 1password/op package (that would fork the pin)", () => {
    expect(MISE_TOML).toContain('"1password-cli" = "2.34.1"');
    // nixpkgs' attr is `_1password-cli`. If a future edit adds it to
    // systemPackages, the node's `op` silently stops being the pinned one.
    expect(COMMON_NIX_CODE).not.toContain("_1password");
  });

  test("4. shims are APPENDED, so in-checkout resolution keeps the direct fast path", () => {
    const snippet = profileSnippet();
    expect(snippet).toContain('export PATH="$PATH:$HOME/.local/share/mise/shims"');
    // Prepending would route every in-repo call through the shim (~4x slower,
    // measured) and defeat the reason activation is pure-PATH in the first place.
    expect(snippet).not.toContain('export PATH="$HOME/.local/share/mise/shims:$PATH"');
  });

  test("5. the interim appointed-hub dependency stays labelled with its work-item", () => {
    // This one asserts on the COMMENT deliberately -- the label IS the artifact.
    expect(COMMON_NIX).toContain("INTERIM");
    expect(COMMON_NIX).toContain("081M0QS0ET7087G0R000YBRKNT");
  });

  test("6. the node login profile trusts .mise.toml by default BEFORE activate", () => {
    // `mise trust --all` in the recovery arm is HOME-local and only runs when
    // the bun shim is absent. Activate still reads .mise.toml and refuses an
    // untrusted file (QEMU 6.95-picker, 2026-08-23). The env-var contract is
    // the durable default; it must precede `mise activate`.
    const snippet = profileSnippet();
    expect(snippet).toMatch(/export MISE_TRUSTED_CONFIG_PATHS="\$_zeta_repo"/);
    const trustIdx = snippet.indexOf("MISE_TRUSTED_CONFIG_PATHS");
    const activateIdx = snippet.indexOf("mise activate");
    expect(trustIdx).toBeGreaterThan(-1);
    expect(activateIdx).toBeGreaterThan(trustIdx);
  });
});

describe("the workstation half must stay project-scoped", () => {
  test("shellenv.sh does not flip to --shims and does not globalise the shims dir", () => {
    // Aaron: "it's like local scoped dotnet or npm ... that works great we don't
    // need to global". This test exists so a future reader of the node fix above
    // does not "make it consistent" by applying it to workstations too.
    const code = stripComments(SHELLENV);
    expect(code).toContain("mise activate zsh");
    expect(code).not.toContain("mise activate zsh --shims");
    expect(code).not.toContain("mise activate bash --shims");

    // Scope matters, and a first draft of this test got it wrong: shellenv.sh
    // DOES name the shims dir, but only inside the `if [ -n "$GITHUB_ENV" ]`
    // block that appends to $GITHUB_PATH. That is CI, where every step runs at
    // the repo root and there is no interactive shell -- it is not the
    // workstation-global case this guard is about. So the assertion is scoped
    // to the generator block that writes ~/.config/zeta/shellenv.sh, which is
    // the only part a developer's login shell ever sources.
    const emittedStart = code.indexOf("{\n  echo \"# Zeta managed shellenv");
    expect(emittedStart).toBeGreaterThan(-1);
    const emittedEnd = code.indexOf('} > "$ZETA_ENV_FILE"', emittedStart);
    expect(emittedEnd).toBeGreaterThan(emittedStart);
    const emitted = code.slice(emittedStart, emittedEnd);
    expect(emitted).not.toContain("mise/shims");
    expect(emitted).not.toContain("MISE_GLOBAL_CONFIG_FILE");
  });

  test("shellenv.sh trusts this checkout's .mise.toml before mise activate", () => {
    // Trust is not globalisation. Project-scoped resolution stays; the pin
    // still travels with the checkout. Without the export, `mise activate`
    // refuses an untrusted .mise.toml in a fresh HOME (install.sh already
    // exports this for the install process; shellenv persists it).
    const code = stripComments(SHELLENV);
    const emittedStart = code.indexOf("{\n  echo \"# Zeta managed shellenv");
    expect(emittedStart).toBeGreaterThan(-1);
    const emittedEnd = code.indexOf('} > "$ZETA_ENV_FILE"', emittedStart);
    expect(emittedEnd).toBeGreaterThan(emittedStart);
    const emitted = code.slice(emittedStart, emittedEnd);
    expect(emitted).toContain("MISE_TRUSTED_CONFIG_PATHS");
    const trustIdx = emitted.indexOf("MISE_TRUSTED_CONFIG_PATHS");
    const activateIdx = emitted.indexOf("mise activate");
    expect(trustIdx).toBeGreaterThan(-1);
    expect(activateIdx).toBeGreaterThan(trustIdx);
  });
});

const FIRST_SESSION_PATH = fileURLToPath(
  new URL("./zeta-first-session.nix", import.meta.url),
);
const FIRST_SESSION = readFileSync(FIRST_SESSION_PATH, "utf8");
const FIRST_SESSION_CODE = stripComments(FIRST_SESSION);

describe("first-session also trusts .mise.toml by default", () => {
  test("the hook exports MISE_TRUSTED_CONFIG_PATHS before mise install", () => {
    expect(FIRST_SESSION_CODE).toContain("MISE_TRUSTED_CONFIG_PATHS");
    const trustIdx = FIRST_SESSION_CODE.indexOf("MISE_TRUSTED_CONFIG_PATHS");
    const installIdx = FIRST_SESSION_CODE.indexOf("mise install");
    expect(trustIdx).toBeGreaterThan(-1);
    expect(installIdx).toBeGreaterThan(trustIdx);
  });
});
