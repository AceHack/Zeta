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

import { resolveClusterSegmentAssignment } from "./cluster-address";
import { classifyJoinEndpoint, renderEndpointAdvice } from "../cluster/join-endpoint-san-coverage.ts";

/** ESP destination for the firstboot config. Read by `zeta-first-boot.sh`. */
export const ZETA_FIRSTBOOT_CONF_ESP_DESTINATION = "/zeta-firstboot.conf";

/** ESP destination for k3s node-token material, when the operator supplies it. */
export const ZETA_JOIN_TOKEN_ESP_DESTINATION = "/zeta-join-token";

/**
 * 081KSNY2Z0008QG0R0008PN7RQ `joining-node-address-assignment`: the addressing
 * half. A role told a node WHAT it is; without this it still had no address on
 * the shared segment and no way to resolve the name in its own `--server` URL.
 * Derivation is in `cluster-address.ts`; this module only carries the result.
 */

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
/**
 * Static addressing for the shared cluster segment, when the medium carries it.
 *
 * Optional on both variants: a node flashed for a LAN that already has DHCP and
 * DNS needs none of this, and forcing an address on it would be worse than the
 * gap. Omitted, no addressing lines are emitted at all and the guest's existing
 * NetworkManager/DHCP behaviour is untouched.
 */
export interface ZetaFirstbootClusterSegment {
  /** MAC of the segment NIC — the only stable handle on a two-NIC guest. */
  readonly segmentNicMac: string;
  /** Host index within the /24. Defaults per role; see `cluster-address.ts`. */
  readonly hostIndex?: number;
}

export type ZetaFirstbootRole =
  | {
      readonly kind: "first-control-plane";
      /** Defaults to {@link DEFAULT_FIRST_CONTROL_PLANE_FLAKE_HOST}. */
      readonly flakeHost?: string;
      /** Static segment addressing; omitted, the node keeps DHCP. */
      readonly clusterSegment?: ZetaFirstbootClusterSegment;
    }
  | {
      readonly kind: "joiner";
      /** Defaults to {@link DEFAULT_JOINER_FLAKE_HOST}. */
      readonly flakeHost?: string;
      /** Static segment addressing; omitted, the node keeps DHCP. */
      readonly clusterSegment?: ZetaFirstbootClusterSegment;
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
  /** This node's address on the cluster segment, e.g. `10.88.0.2/24`. */
  readonly clusterNodeAddressCidr?: string;
  /** MAC of the NIC the address above belongs to. */
  readonly clusterSegmentMac?: string;
  /** The founder's segment address, for the `/etc/hosts` entry. */
  readonly clusterControlPlaneAddress?: string;
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
 * `https` is required because k3s itself refuses a plain-http server address:
 * `pkg/clientaccess/token.go` `setServer` returns
 * `"only https:// URLs are supported, invalid scheme: …"`. Host-and-port only —
 * a path, query or fragment means the caller is passing something that is not a
 * k3s server address, and silently trimming it would hide that.
 *
 * CORRECTED 2026-08-21. This docstring used to say `https` was required because
 * "the node-token crosses this connection", implying TLS is what protects it.
 * Read upstream: it is not. On a self-signed cluster the agent's very first
 * request is made with a client that verifies NOTHING —
 * `pkg/clientaccess/token.go` declares
 *
 *     insecureClient = &http.Client{ Transport: &http.Transport{
 *         TLSClientConfig: &tls.Config{ InsecureSkipVerify: true } } }
 *
 * and `getCACerts` uses exactly that client to download `/cacerts`. What makes
 * the bootstrap safe is not the scheme; it is the CA hash carried in the token.
 * See {@link validateJoinTokenMaterial}, which is the guard that keeps that
 * true.
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

/**
 * ADVISORY on whether the founder's certificate can cover a join endpoint.
 *
 * WHAT THIS CATCHES. Everything in `validateJoinServerUrl` checks SHAPE — https, no path, no
 * userinfo, numeric port. `zeta-install.sh` does the same, more loosely, with one regex. A DNS name
 * outside the founder's SAN set passes every one of those, gets staged to
 * `/etc/zeta/cluster-join-server-url`, and then fails at the TLS handshake — AFTER the disk has
 * been partitioned. That is the live case for joining a second machine, and finding out late costs
 * a re-flash.
 *
 * This runs on the OPERATOR'S WORKSTATION at flash time, before any hardware is touched. It turns a
 * post-partition mystery into a pre-flash sentence.
 *
 * IT ADVISES; IT DOES NOT REFUSE — and that is a correction, not caution. The first version of this
 * wiring refused `not-covered` on the reasoning that `k3s-server.nix:83` hardcodes exactly
 * `--tls-san=control-plane`, so any other DNS name structurally cannot be covered. That reasoning
 * is sound about the certificate and WRONG as a gate: `control-plane.local` appears 14 times in
 * this module's own tests — as often as `control-plane` — and in `cluster-address.ts` and the
 * zflash test harness. It is a path the repo actually uses, so refusing it would have broken ten
 * existing tests and blocked real flashes on a string check.
 *
 * Whether `control-plane.local` genuinely survives the handshake is a real open question the
 * classifier raises and this function deliberately does not answer. Surfacing it is useful;
 * deciding it by refusing a flash is not.
 */
/**
 * The non-refusing half: advice for an endpoint that MIGHT be covered.
 *
 * Returns text for a caller to print, or `null` when the endpoint is the designed path
 * (`control-plane`) and there is nothing to say. Separate from `validateJoinServerUrl` because that
 * function's contract is error-or-null and a warning is neither — folding a "probably fine" into an
 * error would refuse working setups, and dropping it would lose the one case an operator can
 * actually check.
 */
export function joinEndpointAdvisory(serverUrl: string): string | null {
  const verdict = classifyJoinEndpoint(serverUrl.trim());
  if (verdict.coverage === "covered-by-explicit-san") return null;
  // Structurally-uncovered endpoints get advice too — nothing refuses them, so if this stayed
  // silent the loudest case would be the one nobody hears.
  return renderEndpointAdvice(serverUrl.trim());
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
 * The only k3s token shape that authenticates the server it is sent to.
 *
 * `K10` + 64 lowercase hex (a SHA-256 digest) + `::` + credentials. Upstream:
 * `pkg/clientaccess/token.go` — `tokenPrefix = "K10"`,
 * `caHashLength = sha256.Size * 2`, and `FormatTokenBytes` returns
 * `tokenPrefix + digest + "::" + creds`.
 *
 * Lowercase is not a stylistic tightening: the digest is produced by
 * `hex.EncodeToString`, which emits lowercase, and `validateCACerts` compares
 * the two hashes with `==` on the raw strings. An uppercase hash would parse,
 * pass the length check, and then never match — a join that fails for a reason
 * that reads nothing like "your token is mis-cased".
 */
export const K3S_NODE_TOKEN_WITH_CA_HASH = /^K10[0-9a-f]{64}::.+$/u;

/**
 * Refuse join-token material that carries no CA hash.
 *
 * WHY THIS IS FAIL-CLOSED AND NOT PEDANTRY. Read the k3s agent bootstrap
 * (`pkg/clientaccess/token.go`) in order:
 *
 *  1. `parseToken` — a token with no `K10` prefix is NOT rejected. It is
 *     rewritten to `K10:::<password>`, so `info.caHash` becomes the empty
 *     string and everything downstream proceeds.
 *  2. `getCACerts` — the cluster CA bundle is downloaded from `/cacerts` using
 *     `insecureClient`, whose `tls.Config` sets `InsecureSkipVerify: true`.
 *     No certificate chain and no hostname is checked on that request.
 *  3. `validateCAHash` — with `len(caHash) == 0 && len(CACerts) > 0` it does
 *     not fail. It emits `logrus.Warn("Cluster CA certificate is not trusted
 *     by the host CA bundle, but the token does not include a CA hash. Use the
 *     full token from the server's node-token file …")` and returns nil.
 *
 * So a prefix-less token means the joiner accepts whatever CA answers first on
 * the segment and then presents its cluster credential to it. `https://` in the
 * server URL does not help — step 2 is the step that ignores TLS. The single
 * thing standing between a flashed joiner and handing the cluster token to a
 * MITM is the `K10<hash>::` prefix, which is why its absence is refused here
 * rather than warned about.
 *
 * REFUSING COSTS A CORRECT OPERATOR NOTHING. The documented source for this
 * material is the founder's `/var/lib/rancher/k3s/server/node-token`
 * (`full-ai-cluster/INJECTION-POINTS.md` §6). Upstream, `node-token` is a
 * symlink to `<data-dir>/token` (`pkg/server/server.go`, "backwards
 * compatibility"), and both are written by `handlers.WriteToken` →
 * `clientaccess.FormatToken`, which always prepends the hash. Every token k3s
 * itself produces passes this check; the ones that fail are hand-picked shared
 * secrets (`K3S_TOKEN=hunter2`), which is precisely the case that silently
 * degrades.
 *
 * Pure: takes the file's CONTENT, returns a refusal string or null. The read
 * lives in `file-backed.ts` so this stays unit-testable with no filesystem.
 */
export function validateJoinTokenMaterial(tokenContent: string): string | null {
  const trimmed = tokenContent.trim();
  if (trimmed.length === 0) {
    return "join token file is empty; a joiner with no credential joins nothing";
  }
  if (trimmed.includes("\n")) {
    return (
      "join token file must hold exactly one token line, got " +
      `${String(trimmed.split("\n").length)} lines ` +
      "(k3s writes node-token as a single line; several lines means the wrong file was passed)"
    );
  }
  if (!K3S_NODE_TOKEN_WITH_CA_HASH.test(trimmed)) {
    return (
      "join token does not carry a cluster CA hash (expected K10<64 lowercase hex>::<creds>). " +
      "k3s does NOT reject such a token — pkg/clientaccess/token.go parseToken rewrites it to " +
      "K10:::<password>, getCACerts then downloads the CA over a client with " +
      "InsecureSkipVerify:true, and validateCAHash only logs a warning. The joiner would trust " +
      "whatever CA answered and hand it the cluster credential. Use the founder's " +
      "/var/lib/rancher/k3s/server/node-token verbatim."
    );
  }
  return null;
}

/** The three addressing fields, or none of them. Never a partial set. */
interface ClusterSegmentFields {
  readonly clusterNodeAddressCidr?: string;
  readonly clusterSegmentMac?: string;
  readonly clusterControlPlaneAddress?: string;
}

type OptionalClusterSegmentResult =
  | { readonly ok: true; readonly fields: ClusterSegmentFields }
  | { readonly ok: false; readonly error: string };

/**
 * Resolve the optional static addressing.
 *
 * All three fields or none: a config carrying an address but no MAC would be
 * applied to whichever NIC the consumer guessed, and a config carrying a MAC
 * but no control-plane address would leave a joiner able to speak on the
 * segment and unable to name what it is joining. Partial addressing is worse
 * than none, so it is not representable in the output.
 */
function resolveOptionalClusterSegment(role: ZetaFirstbootRole): OptionalClusterSegmentResult {
  if (role.clusterSegment === undefined) {
    return { ok: true, fields: {} };
  }
  const assignment = resolveClusterSegmentAssignment({
    role: role.kind,
    segmentNic: { mac: role.clusterSegment.segmentNicMac },
    ...(role.clusterSegment.hostIndex === undefined ? {} : { hostIndex: role.clusterSegment.hostIndex }),
  });
  if (!assignment.ok) {
    return { ok: false, error: assignment.error };
  }
  // Re-checked against the bash allowlist even though `cluster-address.ts`
  // composed them: this is the last guard before the value is `.`-sourced by
  // a root shell, and "a trusted producer" is not a property the ESP has.
  for (const [label, value] of [
    ["cluster node address", assignment.value.nodeAddressCidr],
    ["cluster segment MAC", assignment.value.segmentMac],
    ["cluster control-plane address", assignment.value.controlPlaneAddress],
  ] as const) {
    const unsafe = checkShellSafe(label, value);
    if (unsafe !== null) {
      return { ok: false, error: unsafe };
    }
  }
  return {
    ok: true,
    fields: {
      clusterNodeAddressCidr: assignment.value.nodeAddressCidr,
      clusterSegmentMac: assignment.value.segmentMac,
      clusterControlPlaneAddress: assignment.value.controlPlaneAddress,
    },
  };
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

  // Addressing is resolved BEFORE the role split so both variants get the same
  // refusals from the same code path — a founder with a bad MAC and a joiner
  // with a bad MAC must fail identically, or the two halves of one segment are
  // validated to two different standards.
  const segment = resolveOptionalClusterSegment(role);
  if (!segment.ok) {
    return refuse(segment.error);
  }

  if (role.kind === "first-control-plane") {
    return { ok: true, value: { role: "first-control-plane", flakeHost, ...segment.fields } };
  }

  const serverUrl = role.serverUrl.trim();
  const serverUrlError = validateJoinServerUrl(serverUrl);
  if (serverUrlError !== null) {
    return refuse(serverUrlError);
  }

  const tokenEspPath = role.tokenEspPath?.trim();
  if (tokenEspPath === undefined || tokenEspPath.length === 0) {
    return { ok: true, value: { role: "joiner", flakeHost, joinServerUrl: serverUrl, ...segment.fields } };
  }
  const tokenError = validateTokenEspPath(tokenEspPath);
  if (tokenError !== null) {
    return refuse(tokenError);
  }
  return {
    ok: true,
    value: { role: "joiner", flakeHost, joinServerUrl: serverUrl, joinTokenEspPath: tokenEspPath, ...segment.fields },
  };
}

/** Flat, stringly-typed flags as a CLI collects them. */
export interface FirstbootRoleFlags {
  readonly role?: string;
  readonly flakeHost?: string;
  readonly joinServerUrl?: string;
  readonly joinTokenSourcePath?: string;
  /** `--cluster-segment-mac` — opts the medium into static segment addressing. */
  readonly clusterSegmentMac?: string;
  /** `--cluster-host-index` — explicit allocation for a second/third joiner. */
  readonly clusterHostIndex?: string;
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
  const clusterSegmentMac = flags.clusterSegmentMac?.trim();
  const clusterHostIndexRaw = flags.clusterHostIndex?.trim();
  const hasServerUrl = joinServerUrl !== undefined && joinServerUrl.length > 0;
  const hasToken = joinTokenSourcePath !== undefined && joinTokenSourcePath.length > 0;
  const hasFlakeHost = flakeHost !== undefined && flakeHost.length > 0;
  const hasSegmentMac = clusterSegmentMac !== undefined && clusterSegmentMac.length > 0;
  const hasHostIndex = clusterHostIndexRaw !== undefined && clusterHostIndexRaw.length > 0;

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
    if (hasSegmentMac || hasHostIndex) {
      return refuse("--cluster-segment-mac / --cluster-host-index require --role");
    }
    return { ok: true, value: undefined };
  }

  // A host index with no MAC is the partial-addressing shape again, arriving
  // through the flag surface: it names WHICH address without naming WHICH NIC,
  // so it is refused here rather than silently ignored.
  if (hasHostIndex && !hasSegmentMac) {
    return refuse("--cluster-host-index requires --cluster-segment-mac (an address needs a NIC to live on)");
  }
  let clusterSegment: ZetaFirstbootClusterSegment | undefined;
  if (hasSegmentMac) {
    if (hasHostIndex && !/^[0-9]+$/.test(clusterHostIndexRaw)) {
      return refuse(`--cluster-host-index must be a non-negative integer, got ${JSON.stringify(clusterHostIndexRaw)}`);
    }
    clusterSegment = {
      segmentNicMac: clusterSegmentMac,
      ...(hasHostIndex ? { hostIndex: Number(clusterHostIndexRaw) } : {}),
    };
  }

  if (role === "first-control-plane") {
    if (hasServerUrl) {
      return refuse("--join-server-url is meaningless for --role first-control-plane (it founds the cluster)");
    }
    if (hasToken) {
      return refuse("--join-token is meaningless for --role first-control-plane (it mints the token)");
    }
    return {
      ok: true,
      value: {
        kind: "first-control-plane",
        ...(hasFlakeHost ? { flakeHost } : {}),
        ...(clusterSegment === undefined ? {} : { clusterSegment }),
      },
    };
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
        ...(clusterSegment === undefined ? {} : { clusterSegment }),
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
  // Addressing, when the medium carries it. Emitted last and as a block, so a
  // reader can see at a glance whether a node was flashed with static
  // addressing or left on DHCP.
  if (config.clusterNodeAddressCidr !== undefined) {
    lines.push(`ZETA_CLUSTER_NODE_CIDR=${shellQuote(config.clusterNodeAddressCidr)}`);
  }
  if (config.clusterSegmentMac !== undefined) {
    lines.push(`ZETA_CLUSTER_SEGMENT_MAC=${shellQuote(config.clusterSegmentMac)}`);
  }
  if (config.clusterControlPlaneAddress !== undefined) {
    lines.push(`ZETA_CLUSTER_CONTROL_PLANE_IP=${shellQuote(config.clusterControlPlaneAddress)}`);
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
