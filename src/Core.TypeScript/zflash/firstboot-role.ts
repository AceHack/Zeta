/**
 * src/Core.TypeScript/zflash/firstboot-role.ts
 *
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 5 — ROLE PROVISIONING.
 *
 * THE GAP THIS CLOSES
 * -------------------
 * A zflash-prepared boot image installed a second CONTROL PLANE, never a
 * joiner, and there was no mechanism that could have said otherwise. The
 * chain, verified 2026-08-17 rather than assumed:
 *
 *   - `planFileBackedZflashImage` (lib.ts) could emit exactly four ESP
 *     destinations: `/zeta-authorized-keys.pub`, `/zeta-hostname.txt`,
 *     `/zeta-creds.enc`, `/zeta-wifi-credentials.json`. None carries a role.
 *   - `zeta-first-boot.sh` sources `/etc/zeta-firstboot.conf` — a file baked
 *     into the ISO's read-only Nix store by
 *     `usb-nixos-installer/nixos/installer/configuration.nix`, which ships
 *     `HOST=control-plane` — and then execs `zeta-install "$HOST"`. Under
 *     automation the tty1 role prompt takes that timed default.
 *   - The installer ISO's own comment defers a per-flash `--role` to "v2".
 *
 * So the role was decided at ISO BUILD time and the flash could not move it.
 * This module is the missing carrier: a bash-sourceable firstboot config the
 * flash writes to the ESP, which `zeta-first-boot.sh` sources IN PREFERENCE
 * to the ISO's copy.
 *
 * PURE CORE. No I/O, no QEMU, no filesystem. Every function here is a total
 * function from a value to a value or a typed refusal, so the whole role
 * derivation is unit-testable with nothing booted (§7 DST — the config is a
 * pure function of the request, replayable byte-for-byte).
 *
 * THE INJECTION SURFACE IS REAL AND IS GUARDED TWICE
 * --------------------------------------------------
 * The emitted file is `.`-sourced by bash on a node that is about to
 * partition a disk. A value carrying `;` or `$(...)` would be executed, not
 * assigned. So every value is (a) checked against a conservative allowlist
 * and refused if it fails, and (b) emitted inside single quotes. Either guard
 * alone would do; both are here because the cost is nil and the failure is
 * a wiped disk running someone else's command.
 *
 * Anchors (Beacon): the shape is cloud-init's `#cloud-config` user-data
 * (Canonical, 2010–) and kickstart/preseed before it — role and join
 * parameters travel WITH the install medium rather than being typed at the
 * console. k3s's own join (Rancher/SUSE) is the join being provisioned for;
 * per Aaron 2026-08-13 ("k3s's join is the join, don't invent our own") this
 * module carries k3s's parameters and defines no handshake of its own.
 */

/** ESP destination for the firstboot config. Read by `zeta-first-boot.sh`. */
export const ZETA_FIRSTBOOT_CONF_ESP_DESTINATION = "/zeta-firstboot.conf";

/** ESP destination for k3s node-token material, when the operator supplies it. */
export const ZETA_JOIN_TOKEN_ESP_DESTINATION = "/zeta-join-token";

/**
 * Where a joiner's token must land on the INSTALLED system.
 *
 * Not a choice this module gets to make: `nixos/modules/k3s-agent.nix` sets
 * `services.k3s.tokenFile = lib.mkDefault "/var/lib/rancher/k3s/agent/token"`.
 * Pinned here so a drift on either side shows up as a failing test rather
 * than as a node that boots and quietly never joins.
 */
export const K3S_AGENT_TOKEN_INSTALLED_PATH = "/var/lib/rancher/k3s/agent/token";

/**
 * Where `zeta-install.sh` stages the join server URL for evaluation-time
 * pickup by `nixos/modules/injected-join-server.nix`. Mirrors the existing
 * `/etc/zeta/cluster-node-id` convention that `injected-hostname.nix` reads.
 */
export const ZETA_JOIN_SERVER_URL_INSTALLED_PATH = "/etc/zeta/cluster-join-server-url";

/**
 * Flake host attributes, checked against `full-ai-cluster/flake.nix`
 * `nixosConfigurations` on 2026-08-17 — `control-plane`, `worker-gpu`,
 * `worker-template` are the three that exist. `worker-template` and
 * `worker-gpu` both import `modules/k3s-agent.nix` (so they run an agent and
 * therefore a join observer); `control-plane` imports `k3s-server.nix`.
 */
export const DEFAULT_FIRST_CONTROL_PLANE_FLAKE_HOST = "control-plane";
export const DEFAULT_JOINER_FLAKE_HOST = "worker-template";

/**
 * A flake host attribute is passed as `zeta-install "$HOST"` and interpolated
 * into `nixos-install --flake /mnt/etc/zeta/full-ai-cluster#$HOST`. Lowercase
 * DNS-label shape: what every attribute in the flake actually uses.
 */
export const VALID_FLAKE_HOST_ATTRIBUTE_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Conservative allowlist for any value emitted into the bash-sourced file.
 * Deliberately excludes `$`, backtick, quotes, `;`, `&`, `|`, `<`, `>`,
 * whitespace and newlines — every character that could turn an assignment
 * into an execution or split one line into two.
 */
export const SHELL_SAFE_CONF_VALUE_REGEX = /^[A-Za-z0-9._:/@-]+$/;

/** Highest valid TCP port. */
const MAX_TCP_PORT = 65535;

/**
 * The role a flashed medium provisions.
 *
 * Two variants, because there are exactly two situations: this node founds
 * the cluster (`k3s server --cluster-init`) or it joins one that exists.
 * There is no "worker with no cluster to join" — that is a joiner missing its
 * endpoint, and it is refused below rather than defaulted into existence.
 */
export type ZetaFirstbootRole =
  | {
      readonly kind: "first-control-plane";
      /** Defaults to {@link DEFAULT_FIRST_CONTROL_PLANE_FLAKE_HOST}. */
      readonly flakeHost?: string;
    }
  | {
      readonly kind: "joiner";
      /** Defaults to {@link DEFAULT_JOINER_FLAKE_HOST}. */
      readonly flakeHost?: string;
      /** k3s `--server` URL of the existing control plane, e.g. `https://control-plane.local:6443`. */
      readonly serverUrl: string;
      /**
       * ESP-relative path of the k3s node-token, when it travels on the
       * medium. Omit when the token is provisioned by some other means; the
       * emitted config then carries no token path at all rather than naming a
       * file that will not be there.
       */
      readonly tokenEspPath?: string;
    };

/** Resolved, validated config — every default applied, every value checked. */
export interface ZetaFirstbootConfig {
  readonly role: "first-control-plane" | "joiner";
  readonly flakeHost: string;
  readonly joinServerUrl?: string;
  readonly joinTokenEspPath?: string;
}

export type ZetaFirstbootConfigResult =
  | { readonly ok: true; readonly value: ZetaFirstbootConfig }
  | { readonly ok: false; readonly error: string };

function refuse(error: string): { readonly ok: false; readonly error: string } {
  return { ok: false, error };
}

function checkShellSafe(label: string, value: string): string | null {
  if (!SHELL_SAFE_CONF_VALUE_REGEX.test(value)) {
    return (
      `${label} contains characters that are unsafe in a bash-sourced config: ${JSON.stringify(value)} ` +
      `(allowed: letters, digits, and . _ : / @ -)`
    );
  }
  return null;
}

/**
 * Validate a k3s server URL.
 *
 * `https` is required, not preferred: the node-token crosses this connection,
 * and k3s itself refuses a plain-http server address. Host-and-port only — a
 * path, query or fragment means the caller is passing something that is not a
 * k3s server address, and silently trimming it would hide that.
 */
export function validateJoinServerUrl(serverUrl: string): string | null {
  const trimmed = serverUrl.trim();
  if (trimmed.length === 0) {
    return "join server URL is required for a joiner";
  }
  if (trimmed.startsWith("http://")) {
    return `join server URL must be https (the node-token crosses it): ${trimmed}`;
  }
  if (!trimmed.startsWith("https://")) {
    return `join server URL must start with https://: ${trimmed}`;
  }
  const unsafe = checkShellSafe("join server URL", trimmed);
  if (unsafe !== null) {
    return unsafe;
  }
  const authority = trimmed.slice("https://".length);
  if (authority.length === 0) {
    return `join server URL has no host: ${trimmed}`;
  }
  if (authority.includes("/")) {
    return `join server URL must be host[:port] with no path: ${trimmed}`;
  }
  if (authority.includes("@")) {
    return `join server URL must not carry userinfo: ${trimmed}`;
  }
  const colon = authority.lastIndexOf(":");
  if (colon < 0) {
    return null;
  }
  const host = authority.slice(0, colon);
  const port = authority.slice(colon + 1);
  if (host.length === 0) {
    return `join server URL has no host: ${trimmed}`;
  }
  if (!/^[0-9]+$/.test(port)) {
    return `join server URL port must be numeric: ${trimmed}`;
  }
  const parsed = Number(port);
  if (parsed < 1 || parsed > MAX_TCP_PORT) {
    return `join server URL port must be 1..${String(MAX_TCP_PORT)}: ${trimmed}`;
  }
  return null;
}

/** Validate an ESP-relative token path: absolute, no traversal, shell-safe. */
export function validateTokenEspPath(tokenEspPath: string): string | null {
  const trimmed = tokenEspPath.trim();
  if (trimmed.length === 0) {
    return "token ESP path must be non-empty when provided";
  }
  if (!trimmed.startsWith("/")) {
    return `token ESP path must be absolute (ESP-relative, leading /): ${trimmed}`;
  }
  if (trimmed.split("/").includes("..")) {
    return `token ESP path must not contain a .. segment: ${trimmed}`;
  }
  return checkShellSafe("token ESP path", trimmed);
}

/**
 * Apply defaults and validate. Total: every rejection is a typed refusal, so
 * a bad role can never reach the ESP as a silently-corrected one.
 */
export function resolveFirstbootConfig(role: ZetaFirstbootRole): ZetaFirstbootConfigResult {
  const requestedHost = role.flakeHost?.trim();
  const flakeHost =
    requestedHost === undefined || requestedHost.length === 0
      ? role.kind === "first-control-plane"
        ? DEFAULT_FIRST_CONTROL_PLANE_FLAKE_HOST
        : DEFAULT_JOINER_FLAKE_HOST
      : requestedHost;

  if (!VALID_FLAKE_HOST_ATTRIBUTE_REGEX.test(flakeHost)) {
    return refuse(
      `flake host attribute is not a valid lowercase DNS label: ${JSON.stringify(flakeHost)} ` +
        `(expected e.g. control-plane, worker-gpu, worker-template)`,
    );
  }

  if (role.kind === "first-control-plane") {
    return { ok: true, value: { role: "first-control-plane", flakeHost } };
  }

  const serverUrl = role.serverUrl.trim();
  const serverUrlError = validateJoinServerUrl(serverUrl);
  if (serverUrlError !== null) {
    return refuse(serverUrlError);
  }

  const tokenEspPath = role.tokenEspPath?.trim();
  if (tokenEspPath === undefined || tokenEspPath.length === 0) {
    return { ok: true, value: { role: "joiner", flakeHost, joinServerUrl: serverUrl } };
  }
  const tokenError = validateTokenEspPath(tokenEspPath);
  if (tokenError !== null) {
    return refuse(tokenError);
  }
  return { ok: true, value: { role: "joiner", flakeHost, joinServerUrl: serverUrl, joinTokenEspPath: tokenEspPath } };
}

/** Flat, stringly-typed flags as a CLI collects them. */
export interface FirstbootRoleFlags {
  readonly role?: string;
  readonly flakeHost?: string;
  readonly joinServerUrl?: string;
  readonly joinTokenSourcePath?: string;
}

export type FirstbootRoleFlagsResult =
  | { readonly ok: true; readonly value: ZetaFirstbootRole | undefined }
  | { readonly ok: false; readonly error: string };

/**
 * Lift CLI flags to a {@link ZetaFirstbootRole}.
 *
 * Pure, so the flag combinations are unit-testable without a CLI. The
 * refusals are the interesting half: `--join-server-url` on a control plane
 * and `--join-token` without `--role joiner` are both accepted-and-ignored by
 * a permissive parser, which is exactly how an operator ends up believing a
 * node was provisioned to join when nothing on the medium says so.
 */
export function firstbootRoleFromFlags(flags: FirstbootRoleFlags): FirstbootRoleFlagsResult {
  const role = flags.role?.trim();
  const flakeHost = flags.flakeHost?.trim();
  const joinServerUrl = flags.joinServerUrl?.trim();
  const joinTokenSourcePath = flags.joinTokenSourcePath?.trim();
  const hasServerUrl = joinServerUrl !== undefined && joinServerUrl.length > 0;
  const hasToken = joinTokenSourcePath !== undefined && joinTokenSourcePath.length > 0;
  const hasFlakeHost = flakeHost !== undefined && flakeHost.length > 0;

  if (role === undefined || role.length === 0) {
    if (hasServerUrl) {
      return refuse("--join-server-url requires --role joiner");
    }
    if (hasToken) {
      return refuse("--join-token requires --role joiner");
    }
    if (hasFlakeHost) {
      return refuse("--flake-host requires --role");
    }
    return { ok: true, value: undefined };
  }

  if (role === "first-control-plane") {
    if (hasServerUrl) {
      return refuse("--join-server-url is meaningless for --role first-control-plane (it founds the cluster)");
    }
    if (hasToken) {
      return refuse("--join-token is meaningless for --role first-control-plane (it mints the token)");
    }
    return { ok: true, value: { kind: "first-control-plane", ...(hasFlakeHost ? { flakeHost } : {}) } };
  }

  if (role === "joiner") {
    if (!hasServerUrl) {
      return refuse("--role joiner requires --join-server-url (a joiner with no endpoint joins nothing)");
    }
    return {
      ok: true,
      value: {
        kind: "joiner",
        serverUrl: joinServerUrl,
        ...(hasFlakeHost ? { flakeHost } : {}),
        ...(hasToken ? { tokenEspPath: ZETA_JOIN_TOKEN_ESP_DESTINATION } : {}),
      },
    };
  }

  return refuse(`--role must be first-control-plane or joiner, got ${JSON.stringify(role)}`);
}

/** Single-quote a value for bash. Safe because the allowlist excludes `'`. */
function shellQuote(value: string): string {
  return `'${value}'`;
}

/**
 * Render the bash-sourceable firstboot config.
 *
 * Key order is fixed by this function, not by object iteration, so the output
 * is byte-identical for equal inputs across runs and runtimes — the config is
 * a candidate for a golden vector and must not depend on property order.
 *
 * `HOST` is the variable name because that is what `zeta-first-boot.sh`
 * already reads (`HOST="${HOST:-control-plane}"`, then `zeta-install "$HOST"`).
 * Renaming it here would produce a file the guest sources and ignores.
 */
export function composeFirstbootConfFileContent(config: ZetaFirstbootConfig): string {
  const lines: string[] = [
    "# zeta-firstboot.conf — written to the boot ESP by zflash at flash time.",
    "# Sourced as bash by zeta-first-boot.sh IN PREFERENCE to the ISO's",
    "# /etc/zeta-firstboot.conf, so the role travels with the flash rather than",
    "# with the ISO build. Generated; do not edit by hand.",
    `ZETA_ROLE=${shellQuote(config.role)}`,
    `HOST=${shellQuote(config.flakeHost)}`,
  ];
  if (config.joinServerUrl !== undefined) {
    lines.push(`ZETA_JOIN_SERVER_URL=${shellQuote(config.joinServerUrl)}`);
  }
  if (config.joinTokenEspPath !== undefined) {
    lines.push(`ZETA_JOIN_TOKEN_ESP_PATH=${shellQuote(config.joinTokenEspPath)}`);
  }
  return `${lines.join("\n")}\n`;
}

export type FirstbootConfFileContentResult =
  | { readonly ok: true; readonly value: string; readonly config: ZetaFirstbootConfig }
  | { readonly ok: false; readonly error: string };

/** resolve ∘ compose — the one call a planner needs. */
export function planFirstbootConfFileContent(role: ZetaFirstbootRole): FirstbootConfFileContentResult {
  const resolved = resolveFirstbootConfig(role);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }
  return { ok: true, value: composeFirstbootConfFileContent(resolved.value), config: resolved.value };
}
