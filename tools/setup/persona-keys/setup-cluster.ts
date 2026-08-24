// Zeta ONE-FINGERPRINT cluster setup + cross-cluster trust — the top-level "one command, one
// biometric" entry for standing up a NEW cluster's trust root, and for making clusters trust
// each other (workitem 081KVM1TK3Z08QG0R0002959G6 §"Trust distribution" + §"Pre-cluster
// bootstrap"). Aaron (2026-06-21): *"a 2nd one for new clusters; clusters also need to trust
// each other; all transitions to cert-manager/keyvault later."*
//
// WHAT IT IS — a THIN orchestrator over the already-shipped, already-verified ca.ts (`ensureCa`)
// plus a PURE renderer for the node-side trust set. It adds exactly two things and NO new
// key/biometric/seed logic:
//
//   1. ONE-FINGERPRINT SESSION APPROVAL — ONE up-front `requireBiometric` through a
//      `sessionBiometric` door (biometric.ts); the SAME session door is handed to `ensureCa`,
//      so generating the CA keypair takes ONE physical approval. FAIL-CLOSED: a declined
//      approval poisons the session and NO CA is generated.
//
//   2. TRUST-SET RENDERING — it RENDERS (never destructively activates) the value that
//      sshd's `TrustedUserCAKeys` points at: a `trusted-user-ca-keys.pub` file containing THIS
//      cluster's CA public key PLUS any PEER cluster CA public keys (cross-cluster trust). The
//      ssh-ca.nix module then references that ONE file. Multiple trusted CA pubkeys = clusters
//      trusting each other. We produce the file content + the nix snippet; the operator commits
//      + imports + `nixos-rebuild` (we never flip the switch).
//
// CROSS-CLUSTER TRUST (the model): `TrustedUserCAKeys` accepts a file with MANY CA public keys,
// one per line — sshd trusts a cert signed by ANY of them. So "cluster A trusts cluster B" = add
// B's CA PUBLIC key to A's trusted-user-ca-keys file. PUBLIC keys only ever cross; the CA
// PRIVATE key never leaves its origin host. Bidirectional trust = each side adds the other's CA
// pubkey. (Migration, no model change: this git-distributed multi-CA trust set → Vault SSH
// secrets engine custody + cert-manager issuance/rotation later — same trust shape.)
//
// SECURITY INVARIANTS (security-class — honesty over green):
//  - The session is ONE *human* approval, not zero: ensureCa still calls `requireBiometric` and
//    aborts on a declined/absent result. We never bypass the gate; we share ONE approval.
//  - NO CA-private / seed handling here — ALL delegated to ca.ts (its `genCa` door writes the
//    private key locally under umask 077 and returns ONLY the public key).
//  - PUBLIC keys only ever appear in the rendered trust set / committed artifacts. A peer CA
//    input is validated to look like an SSH PUBLIC key (and rejected if it looks private).
//  - `--dry-run` is inert: NO prompt, NO keygen, NO write — the plan (CA + rendered trust set)
//    is reported only. The session door is NEVER called on dry-run.
//
// Noninterference (manifesto §13): every ambient influence (biometric prompt, filesystem, the
// peer-pubkey inputs) enters ONLY through the injected effects / typed options.
//
// Anchors (Beacon): OpenSSH `sshd_config(5)` TrustedUserCAKeys (multi-CA trust file) /
// `ssh-keygen(1)` -s; OpenSSH PROTOCOL.certkeys. The "many CAs in one trust file = federation"
// pattern = SSH-CA cross-realm trust prior art (Facebook/Netflix BLESS-style fleets). ed25519
// CA keys — Bernstein et al. (Ed25519, 2011). Vault SSH secrets engine + cert-manager = the
// in-cluster migration target (same trust model, upgraded custody).

import { ensureCa, caPublicKeyPath, type CaEffects, type CaResult } from "./ca.ts";
import { requireBiometric, type BiometricResult, type SessionGate } from "./biometric.ts";

/** A peer cluster's trust input: a label + its CA PUBLIC key text (one SSH pubkey line). */
export interface PeerCa {
  /** A human label for the peer cluster (used as a comment in the trust file). */
  readonly name: string;
  /** The peer cluster's CA PUBLIC key text (e.g. "ssh-ed25519 AAAA… peer-ca"). PUBLIC only. */
  readonly publicKey: string;
}

/** Options for a one-fingerprint cluster setup. `dryRun` is inert. `peers` are peer-cluster CA
 *  PUBLIC keys to add to this cluster's trust set (cross-cluster trust). */
export interface SetupClusterOptions {
  /** The CA identity (the maintainers/<ca>/ subdir; e.g. the cluster/org name). */
  readonly ca: string;
  readonly repoRoot: string;
  readonly home?: string;
  readonly dryRun?: boolean;
  /** Peer cluster CA PUBLIC keys to trust (cross-cluster trust). PUBLIC keys only. */
  readonly peers?: readonly PeerCa[];
}

/** A single line in the rendered `TrustedUserCAKeys` file — a CA pubkey + which cluster it is. */
export interface TrustedCaLine {
  /** "self" for this cluster's own CA, or the peer's name for a peer CA. */
  readonly source: string;
  /** The CA PUBLIC key text (one SSH pubkey line, no trailing newline). PUBLIC only. */
  readonly publicKey: string;
}

/** The rendered node-side trust set (the value `TrustedUserCAKeys` points at) + the nix snippet
 *  referencing it. PRODUCED, not activated — the operator commits + imports + rebuilds. */
export interface RenderedTrustSet {
  /** The lines (self CA + peer CAs) — the multi-CA trust set. */
  readonly lines: readonly TrustedCaLine[];
  /** The full `trusted-user-ca-keys.pub` file content (comment + one CA pubkey per line). */
  readonly trustedUserCaKeysFile: string;
  /** Where that file would be committed (next to the self CA pubkey, under maintainers/<ca>/). */
  readonly trustedUserCaKeysPath: string;
}

/** The result of a one-fingerprint cluster setup: the CA result + the rendered trust set + the
 *  one-approval audit fields. */
export interface SetupClusterResult {
  readonly dryRun: boolean;
  readonly ca: string;
  /** The CA generate/recognise result (delegated to ca.ts). */
  readonly caResult: CaResult;
  /** The rendered node-side trust set (self CA + peers) — PRODUCED, never activated. */
  readonly rendered: RenderedTrustSet;
  /** Times the underlying (human) biometric door fired. One-fingerprint ⇒ 0 (dry-run / CA
   *  already exists) or 1 (the single approval for a real CA keygen). NEVER > 1. */
  readonly biometricApprovals: number;
  /** The single session decision (undefined if nothing gated ran). No secret. */
  readonly approval?: BiometricResult;
}

/** Where the rendered multi-CA `TrustedUserCAKeys` file is committed (next to the self CA pub). */
export function trustedUserCaKeysPath(repoRoot: string, ca: string): string {
  // Sits beside maintainers/<ca>/ssh-ca.pub so ssh-ca.nix can reference one stable path.
  const selfPub = caPublicKeyPath(repoRoot, ca);
  const dir = selfPub.slice(0, selfPub.lastIndexOf("/"));
  return `${dir}/trusted-user-ca-keys.pub`;
}

/**
 * The FULL classification of an existing trust-set file. Rotation must write a SUPERSET of what it
 * read, and it can only do that if it can name everything it read — including lines it does not
 * recognise. A trust root silently dropped because its comment marker was unfamiliar is the same
 * defect as one dropped on purpose, and it is invisible in a diff of fingerprints nobody took.
 */
export interface ParsedTrustSet {
  /** THIS cluster's own CA public keys, in file order — one per rotation generation in the overlap. */
  readonly self: readonly string[];
  /** PEER cluster CAs (cross-cluster trust), by source name. */
  readonly peers: readonly PeerCa[];
  /** Public-key lines carrying NO recognised marker — hand-added roots, a future format, a marker
   *  typo. Never interpreted, never dropped: preserved verbatim so the superset property is total. */
  readonly unclassified: readonly string[];
}

/**
 * Parse a trust-set file into self / peer / unclassified public-key lines (PUBLIC text only).
 * Recognises setup-cluster's `# <source> cluster CA` markers and rotate's `# CA '<name>' #N`
 * self-overlap markers. Total over the file: every line that looks like a public key lands in
 * exactly one bucket.
 */
export function parseTrustSet(trustSetText: string): ParsedTrustSet {
  const self: string[] = [];
  const peers: PeerCa[] = [];
  const unclassified: string[] = [];
  let pendingSource: string | undefined;
  for (const raw of trustSetText.split("\n")) {
    const line = raw.trim();
    const sourceMark = /^#\s+(\S+)\s+cluster CA\s*$/.exec(line);
    if (sourceMark) {
      pendingSource = sourceMark[1];
      continue;
    }
    // Rotate-format self markers (`# CA 'foo' #1`) name THIS cluster's CA, not a peer.
    if (/^#\s+CA\s+'/.test(line)) {
      pendingSource = "self";
      continue;
    }
    if (line.startsWith("#") || line.length === 0) continue;
    if (looksLikePublicKey(line)) {
      if (pendingSource === "self") self.push(line);
      else if (pendingSource !== undefined) peers.push({ name: pendingSource, publicKey: line });
      else unclassified.push(line);
    }
    pendingSource = undefined;
  }
  return { self, peers, unclassified };
}

/**
 * Parse PEER cluster CA entries from an existing trust-set file (PUBLIC text only).
 * Recognises setup-cluster's `# <source> cluster CA` markers; ignores `self` and rotate's
 * `# CA '<name>' #N` self-overlap markers. Used so CA rotation preserves cross-cluster trust.
 */
export function parseTrustSetPeers(trustSetText: string): PeerCa[] {
  const peers: PeerCa[] = [];
  let pendingSource: string | undefined;
  for (const raw of trustSetText.split("\n")) {
    const line = raw.trim();
    const sourceMark = /^#\s+(\S+)\s+cluster CA\s*$/.exec(line);
    if (sourceMark) {
      pendingSource = sourceMark[1];
      continue;
    }
    // Rotate-format self markers (`# CA 'foo' #1`) — not peers.
    if (/^#\s+CA\s+'/.test(line)) {
      pendingSource = undefined;
      continue;
    }
    if (line.startsWith("#") || line.length === 0) continue;
    if (pendingSource !== undefined && pendingSource !== "self" && looksLikePublicKey(line)) {
      peers.push({ name: pendingSource, publicKey: line });
    }
    pendingSource = undefined;
  }
  return peers;
}

/** True iff the text looks like an SSH PUBLIC key line (ssh-ed25519 / ssh-rsa / ecdsa-…). */
export function looksLikePublicKey(text: string): boolean {
  return /^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp\d+|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp\d+@openssh\.com)\s+\S+/m.test(
    text.trim(),
  );
}

/** True iff the text looks like PRIVATE-key material (a defense-in-depth reject for peer input).
 *  Split header token at runtime so this SOURCE file contains no contiguous private-key literal. */
export function looksLikePrivateKey(text: string): boolean {
  const header = "PRIVATE" + " " + "KEY";
  return text.includes(header) || /^-----BEGIN (OPENSSH|RSA|EC|DSA) /m.test(text);
}

/** The marker written for a preserved-but-unrecognised trust root. Deliberately NOT of the form
 *  `# <name> cluster CA`, so a re-parse puts it back in the `unclassified` bucket rather than
 *  promoting it to a peer this cluster never agreed to. */
export const UNCLASSIFIED_SOURCE = "unclassified-preserved";

/**
 * RENDER the node-side multi-CA trust set: this cluster's CA public key(s) first, then each PEER
 * cluster's CA public key — the value sshd's `TrustedUserCAKeys` points at. PURE: no IO, no
 * keygen — just text. Rejects any peer input that does not look like an SSH PUBLIC key, or that
 * looks PRIVATE (fail-closed; a private key must never enter the trust set).
 *
 * `selfCaPublicKey` may be a single pubkey or an array (overlap-window CA rotation lists BOTH
 * old and new self pubs so existing certs still verify). De-duplicates while preserving order.
 *
 * The resulting file (one CA pubkey per line) is exactly what sshd reads: a cert signed by ANY
 * listed CA is accepted → clusters trust each other.
 */
export function renderTrustSet(
  repoRoot: string,
  ca: string,
  selfCaPublicKey: string | readonly string[],
  peers: readonly PeerCa[],
  /** Public-key lines that carried no recognised marker when the file was read. Preserved verbatim
   *  so a re-render is a SUPERSET of what was parsed; validated like a peer (PUBLIC-only). */
  unclassified: readonly string[] = [],
): RenderedTrustSet {
  const lines: TrustedCaLine[] = [];
  const selfKeys = (typeof selfCaPublicKey === "string" ? [selfCaPublicKey] : selfCaPublicKey)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  const seenSelf = new Set<string>();
  for (const self of selfKeys) {
    if (seenSelf.has(self)) continue;
    seenSelf.add(self);
    lines.push({ source: "self", publicKey: self });
  }
  for (const peer of peers) {
    const pk = peer.publicKey.trim();
    if (looksLikePrivateKey(pk)) {
      throw new Error(
        `peer '${peer.name}': refused — input looks like PRIVATE-key material (trust set is PUBLIC-only)`,
      );
    }
    if (!looksLikePublicKey(pk)) {
      throw new Error(
        `peer '${peer.name}': input does not look like an SSH PUBLIC key (expected 'ssh-ed25519 …' / 'ssh-rsa …')`,
      );
    }
    lines.push({ source: peer.name, publicKey: pk });
  }
  const seenAll = new Set(lines.map((l) => l.publicKey));
  for (const raw of unclassified) {
    const pk = raw.trim();
    if (pk.length === 0 || seenAll.has(pk)) continue;
    if (looksLikePrivateKey(pk)) {
      throw new Error("unclassified line: refused — input looks like PRIVATE-key material (trust set is PUBLIC-only)");
    }
    if (!looksLikePublicKey(pk)) {
      throw new Error("unclassified line: input does not look like an SSH PUBLIC key");
    }
    seenAll.add(pk);
    lines.push({ source: UNCLASSIFIED_SOURCE, publicKey: pk });
  }

  const body = lines
    .map((l) =>
      l.source === UNCLASSIFIED_SOURCE
        ? // NOT rendered as `# <name> cluster CA`: a re-parse must put this back in `unclassified`,
          // never promote an unrecognised line to a PEER this cluster never agreed to.
          `# unclassified trust root (preserved verbatim by rotate; marker unrecognised)\n${l.publicKey}`
        : `# ${l.source} cluster CA\n${l.publicKey}`,
    )
    .join("\n");
  const header =
    "# Zeta TrustedUserCAKeys — multi-CA trust set (one CA public key per line).\n" +
    "# sshd accepts a device cert signed by ANY CA listed here → cross-cluster trust.\n" +
    "# PUBLIC keys only; rendered by setup-cluster (PRODUCED, not activated). Commit + import\n" +
    "# via ssh-ca.nix, then nixos-rebuild. Migration target: Vault SSH + cert-manager.\n";
  const file = lines.length > 0 ? `${header}${body}\n` : header;

  return {
    lines,
    trustedUserCaKeysFile: file,
    trustedUserCaKeysPath: trustedUserCaKeysPath(repoRoot, ca),
  };
}

/**
 * Run the one-fingerprint cluster setup: ONE biometric approval up front (through the injected
 * session gate), then generate this cluster's CA (delegated to ca.ts `ensureCa`, commit-pub),
 * and RENDER the multi-CA trust set (self CA + any peer CAs). The trust set is PRODUCED — the
 * operator commits + imports it; we never destructively activate node config.
 *
 * On `--dry-run`: NO approval is triggered and ca.ts generates NOTHING; the rendered trust set
 * uses a placeholder for the (not-yet-generated) self CA so the plan is still legible.
 *
 * PURE over the injected effects + session — deterministic + testable against fakes.
 */
export async function setupCluster(
  fx: CaEffects,
  session: SessionGate,
  opts: SetupClusterOptions,
): Promise<SetupClusterResult> {
  const dryRun = opts.dryRun === true;
  const peers = opts.peers ?? [];

  // ── ONE-FINGERPRINT APPROVAL (up front) ─────────────────────────────────────────────────
  // On a real run trigger the SINGLE human approval through the session door; ensureCa is wired
  // to the SAME door so it replays this one decision (no second prompt). FAIL-CLOSED: a declined
  // approval poisons the session → ensureCa aborts → no CA. On dry-run we do NOT prompt.
  if (!dryRun) {
    await requireBiometric(session.door, `Approve Zeta cluster setup: generate CA for ${opts.ca}`);
  }

  const caResult = await ensureCa(fx, {
    ca: opts.ca,
    repoRoot: opts.repoRoot,
    commitPub: true,
    dryRun,
    biometricAuth: session.door,
    ...(opts.home !== undefined ? { home: opts.home } : {}),
  });

  // The self CA pubkey for the trust set: the real one when generated/exists, a placeholder on
  // dry-run or when an aborted/declined run produced none (so the rendered plan stays legible).
  const selfPub =
    caResult.caPublicKey ?? (dryRun ? "ssh-ed25519 <self-CA-public-key-after-generation>" : "");
  const rendered = renderTrustSet(opts.repoRoot, opts.ca, selfPub, peers);

  const decision = session.decision();
  return {
    dryRun,
    ca: opts.ca,
    caResult,
    rendered,
    biometricApprovals: session.underlyingCalls(),
    ...(decision !== undefined ? { approval: decision } : {}),
  };
}

/** Render the nix snippet that points `TrustedUserCAKeys` at the rendered trust-set file — the
 *  config the operator imports (additive + inert until imported). PUBLIC paths only. */
export function renderSshCaNixSnippet(trustedFileRepoRelative: string): string {
  return [
    "# Generated by setup-cluster — point sshd at the multi-CA trust set (cross-cluster trust).",
    "# ADDITIVE + INERT until you import this in a node config and `nixos-rebuild switch`.",
    "{ lib, ... }:",
    "let",
    `  trustedUserCaKeys = ../../../${trustedFileRepoRelative};`,
    "  present = builtins.pathExists trustedUserCaKeys;",
    "in {",
    "  config = lib.mkIf present {",
    "    services.openssh.extraConfig = lib.mkAfter ''",
    "      TrustedUserCAKeys ${trustedUserCaKeys}",
    "    '';",
    "  };",
    "}",
  ].join("\n");
}

/** Render the operator-facing readout: the CA result + the rendered multi-CA trust set + the
 *  one-fingerprint confirmation + next steps. Public only — no secrets ever appear. */
export function formatSetupCluster(res: SetupClusterResult): string {
  const lines: string[] = [];
  lines.push(
    res.dryRun
      ? `Zeta setup-cluster — DRY RUN (one command; nothing prompted, generated, or written)`
      : `Zeta setup-cluster — ca=${res.ca} (one fingerprint)`,
  );
  // CA step
  const a = res.caResult.action;
  lines.push(
    `  1. [ca] ${a}` +
      (a === "aborted-biometric"
        ? ` — biometric ${res.caResult.biometric?.reason ?? "not approved"} (NO CA generated, fail-closed)`
        : ""),
  );
  lines.push(`       CA private key (local only): ${res.caResult.caPrivatePath}`);
  if (res.caResult.committedPub) {
    lines.push(`       wrote CA PUBLIC key -> ${res.caResult.caPublicPath} (NOT committed; you commit it)`);
  } else if (res.dryRun) {
    lines.push(`       [dry-run] would write CA PUBLIC key -> ${res.caResult.caPublicPath}`);
  }
  // Trust set
  lines.push(`  2. [trust-set] rendered ${res.rendered.lines.length} CA(s): ` +
    `${res.rendered.lines.map((l) => l.source).join(", ") || "(none)"}`);
  lines.push(`       -> ${res.rendered.trustedUserCaKeysPath} (PRODUCED, not activated)`);
  lines.push("");
  lines.push(
    res.dryRun
      ? "Biometric: not invoked (dry-run). On a real run: ONE approval generates the CA."
      : `Biometric: ${res.biometricApprovals} human approval(s) for the whole run (one-fingerprint).`,
  );
  lines.push("Next steps (operator):");
  lines.push(`  - commit the CA public key + the trusted-user-ca-keys file`);
  lines.push(`  - point ssh-ca.nix's caPubFile at trusted-user-ca-keys.pub, import it, nixos-rebuild`);
  lines.push(`  - to trust a peer cluster: re-run with --trust-peer <peer-ca.pub> (PUBLIC key only)`);
  return lines.join("\n");
}
