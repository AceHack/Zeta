#!/usr/bin/env bun
/**
 * federation-loop.ts — the runnable background process.
 *
 *   bun src/Core.TypeScript/federated-identity/federation-loop.ts
 *   bun src/Core.TypeScript/federated-identity/federation-loop.ts --phases 400 --interval-ms 50
 *
 * Three nodes (A, B, C) run IN ONE PROCESS, each with its own root, its own
 * federation policy, its own accepted-bundle map, its own revocation G-Set, and
 * its own verdict vault. They exchange facts over an in-memory queue.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 *
 *   - **No network listener of any kind.** Not localhost, not a unix socket.
 *     The "channel" is an array in this process's memory.
 *   - **No real SPIRE.** No SPIRE server or agent is contacted; the issuer is
 *     `local-issuer.ts`, which is SPIRE-*shaped*, not SPIRE.
 *   - **No hardware.** The HSM adapter is wired in and REFUSES; you will see the
 *     refusal in the transcript. That refusal is the honest state of the
 *     hardware path, not a simulation of success.
 *   - **No money.** The x402 exchange settles nothing. There is no chain, no
 *     testnet, and no code path that opens a socket.
 *   - **Ephemeral keys only.** Every key is generated in memory at startup and
 *     dies with the process. Nothing is read from or written to disk, a
 *     keychain, an agent, or an environment variable.
 *
 * ── TIME ─────────────────────────────────────────────────────────────────────
 * `phase` is a counter this loop increments. Wall clock appears exactly once, in
 * `--interval-ms`, and it decides only how fast the loop wakes — never whether a
 * credential is valid. That is the two-orders rule
 * (`.claude/rules/local-time-never-enters-the-shared-fold.md`) made visible: you
 * can set `--interval-ms 0` or `1000` and every verdict in the transcript is
 * byte-identical, because no decision function reads a clock.
 *
 * REGISTER: `toy` as a whole. It demonstrates that the pieces compose; a demo
 * that runs is not a security property.
 */

import {
  accepts,
  applyVerdict,
  bundleDigest,
  evaluateBundleOffer,
  type AcceptedBundles,
  type BundleVerdict,
  type FederationPolicy,
  type TrustBundle,
} from "./trust-bundle.ts";
import { createLocalIssuer, validatePeerSvid, type LocalIssuer, type SignedSvid } from "./local-issuer.ts";
import { createSoftwareWorkloadAttestor, validateSelectorRules } from "./workload-attestation.ts";
import { softwareEd25519Verifier, toyGenerateSigner, yubiHsmSignerRequiringCeremony } from "./software-adapters.ts";
import { ceremonyRequirementFor, type FederatedIdentityOperation } from "./ceremony-gate.ts";
import { planRotation, type RotationPolicy } from "./rotation.ts";
import {
  addRevocation,
  EMPTY_REVOCATIONS,
  isKeyRevoked,
  mergeRevocations,
  revocationSetDigest,
  revocationSigningBytes,
  type RevocationEntry,
  type RevocationGSet,
} from "./revocation.ts";
import {
  COMMON_SEED_S,
  toyEvaluateReconstruction,
  toyRespondToChallenge,
  type SeedChallenge,
} from "./seed-bootstrap.ts";
import {
  decorrelation,
  deriveActionableView,
  EMPTY_VAULT,
  loadVerdict,
  type RecordedVerdict,
  type VerdictVault,
} from "./verdict-vault.ts";
import {
  authorizePaymentLocally,
  resourceServerDecision,
  verifyPaymentAuthorization,
  type PaymentChallenge,
  type StandingBudget,
} from "./x402.ts";
import { ordinalCompare, type ObservedProcess, type Signer, type WorkloadAttestor } from "./ports.ts";

const V = softwareEd25519Verifier;

// ── one node ─────────────────────────────────────────────────────────────────

interface Node {
  readonly domain: string;
  readonly rootSigner: Signer;
  readonly issuer: LocalIssuer;
  policy: FederationPolicy;
  accepted: AcceptedBundles;
  revocations: RevocationGSet;
  vault: VerdictVault;
  ownBundle: TrustBundle;
  workloadSvid?: SignedSvid;
  readonly workloadKey: Signer;
  renewals: number;
}

function makeNode(domain: string, policy: Omit<FederationPolicy, "localTrustDomain">, phase: number): Node {
  const rootSigner = toyGenerateSigner(`${domain}#root-1`);
  const ownBundle: TrustBundle = {
    trustDomain: domain,
    sequence: 1,
    roots: [{ keyId: rootSigner.keyId, publicKey: rootSigner.publicKey(), notBeforePhase: 0, notAfterPhase: 100_000 }],
    issuedAtPhase: phase,
    continuity: null,
  };
  return {
    domain,
    rootSigner,
    issuer: createLocalIssuer({ trustDomain: domain, rootSigner }),
    policy: { localTrustDomain: domain, ...policy },
    accepted: new Map(),
    revocations: EMPTY_REVOCATIONS,
    vault: EMPTY_VAULT,
    ownBundle,
    workloadKey: toyGenerateSigner(`${domain}#workload-otto`),
    renewals: 0,
  };
}

// ── transcript ───────────────────────────────────────────────────────────────

/** Map a bundle verdict onto the vault's recorded-verdict vocabulary. */
function recordedVerdictOf(kind: BundleVerdict["kind"]): RecordedVerdict["verdict"] {
  if (kind === "accept") return "accept";
  if (kind === "conflict") return "conflict";
  return "reject";
}

const gated: FederatedIdentityOperation[] = [];
const unattended: FederatedIdentityOperation[] = [];

function say(phase: number, who: string, message: string): void {
  process.stdout.write(`[phase ${String(phase).padStart(4, "0")}] ${who.padEnd(16)} ${message}\n`);
}

function record(op: FederatedIdentityOperation, phase: number, who: string): "unattended" | "biometric-ceremony" {
  const c = ceremonyRequirementFor(op);
  (c.requirement === "unattended" ? unattended : gated).push(op);
  if (c.requirement === "biometric-ceremony") {
    say(phase, who, `GATED   ${op} — ${c.reason}`);
  }
  return c.requirement;
}

// ── the run ──────────────────────────────────────────────────────────────────

const BINARY_A = "1".repeat(64);
const OBSERVED_A: ObservedProcess = { pid: 4242, uid: 501, binarySha256: BINARY_A };

const ROTATION: RotationPolicy = { lifetimePhases: 60, renewAtFraction: 0.5, checkpointReservePhases: 12 };

interface PaymentCtx {
  readonly a: Node;
  readonly b: Node;
  readonly budget: StandingBudget;
  readonly settled: Set<string>;
}

/** Read a `--flag <number>` argument, or fall back. */
function numAfter(args: readonly string[], flag: string, fallback: number): number {
  const i = args.indexOf(flag);
  if (i < 0) return fallback;
  const n = Number(args[i + 1]);
  return Number.isFinite(n) ? n : fallback;
}

function seedHandshake(verifier: Node, subject: Node, at: number, spentNonces: Set<string>): boolean {
  const challenge: SeedChallenge = {
    nonce: `${verifier.domain}->${subject.domain}@${String(at)}`,
    issuedAtPhase: at,
    expiresAtPhase: at + 50,
    derivation: "toy-lcg-orbit-v0",
    steps: 64,
  };
  const response = toyRespondToChallenge(challenge, COMMON_SEED_S, at);
  const verdict = toyEvaluateReconstruction({
    challenge,
    response,
    seed: COMMON_SEED_S,
    currentPhase: at,
    spentNonces,
  });
  spentNonces.add(challenge.nonce);
  const offerVerdict = evaluateBundleOffer({
    policy: verifier.policy,
    accepted: verifier.accepted,
    offered: subject.ownBundle,
    witnesses: [],
    currentPhase: at,
    verifier: V,
    seedProof: verdict,
  });
  if (offerVerdict.kind === "accept") {
    record(
      offerVerdict.via === "seed-reconstruction"
        ? "accept-new-trust-domain-under-seed-reconstruction"
        : "accept-new-trust-domain-under-witness-quorum",
      at,
      verifier.domain,
    );
    verifier.accepted = applyVerdict(verifier.accepted, offerVerdict);
    say(at, verifier.domain, `ACCEPT  ${subject.domain} via ${offerVerdict.via}`);
  } else if (offerVerdict.kind === "ceremony-required") {
    record(offerVerdict.operation, at, verifier.domain);
    say(at, verifier.domain, `PENDING ${subject.domain} — needs a human`);
  } else {
    say(
      at,
      verifier.domain,
      `REFUSE  ${subject.domain} — ${offerVerdict.kind === "refuse" ? offerVerdict.code : offerVerdict.kind}`,
    );
  }
  verifier.vault = loadVerdict(verifier.vault, {
    subject: subject.domain,
    observerTrustDomain: verifier.domain,
    verdict: recordedVerdictOf(offerVerdict.kind),
    reason: offerVerdict.reason,
    observedAtPhase: at,
    recordSource: "direct-offer",
  });
  return offerVerdict.kind === "accept";
}

function issueForA(a: Node, attestorA: WorkloadAttestor, at: number): void {
  const att = attestorA.attest(OBSERVED_A, at);
  if (!att.ok) {
    say(at, a.domain, `attest refused: ${att.error.kind}`);
    return;
  }
  const svid = a.issuer.issue({
    attested: att.value,
    subjectPublicKey: a.workloadKey.publicKey(),
    lifetimePhases: ROTATION.lifetimePhases,
    currentPhase: at,
  });
  if (!svid.ok) {
    say(at, a.domain, `issue refused: ${svid.error.kind}`);
    return;
  }
  record(a.workloadSvid === undefined ? "issue-leaf-svid" : "renew-leaf-svid", at, a.domain);
  if (a.workloadSvid !== undefined) a.renewals += 1;
  a.workloadSvid = svid.value;
  say(
    at,
    a.domain,
    `${a.renewals === 0 ? "ISSUE " : "RENEW "} ${svid.value.claim.spiffeId} valid [${String(svid.value.claim.issuedAtPhase)}, ${String(svid.value.claim.expiresAtPhase)})`,
  );
}

function attemptPayment(ctx: PaymentCtx, amount: string, at: number, facilitatorLies: boolean): void {
  const { a, b, budget, settled } = ctx;
  if (!a.workloadSvid) return;
  const challenge: PaymentChallenge = {
    scheme: "zeta-local-sig-v0",
    resource: "/inference",
    amount,
    asset: "USDC",
    payTo: `${b.domain}#treasury`,
    nonce: `pay-${String(at)}-${amount}`,
    expiresAtPhase: at + 20,
    ...(facilitatorLies ? { facilitator: "untrusted.example" } : {}),
  };
  const auth = authorizePaymentLocally({
    challenge,
    payerSpiffeId: a.workloadSvid.claim.spiffeId,
    signer: a.workloadKey,
    budget,
    currentPhase: at,
  });
  if (!auth.ok) {
    if (auth.error.kind === "exceeds-standing-budget") record(auth.error.ceremony, at, a.domain);
    say(at, "node-a", `X402    refused locally: ${auth.error.kind}`);
    return;
  }
  record("x402-authorize-within-standing-budget", at, a.domain);
  record("x402-verify-authorization", at, b.domain);
  const verdict = verifyPaymentAuthorization({
    authorization: auth.value,
    challenge,
    payerSvid: a.workloadSvid,
    accepted: b.accepted,
    verifier: V,
    currentPhase: at,
    spentNonces: settled,
  });
  const decision = resourceServerDecision({
    verdict,
    ...(facilitatorLies
      ? {
          facilitatorOpinion: {
            facilitator: "untrusted.example",
            claimsValid: !verdict.allowed,
            note: "deliberately wrong",
          },
        }
      : {}),
  });
  if (decision.settle) settled.add(challenge.nonce);
  say(at, "node-b", `X402    settle=${String(decision.settle)} — ${decision.reason}`);
}

/** One rotation tick for a node. Renewal is the normal case, not an error path. */
function rotationStep(a: Node, attestorA: WorkloadAttestor, phase: number): void {
  const svid = a.workloadSvid;
  if (svid === undefined) return;
  const plan = planRotation({ claim: svid.claim, policy: ROTATION, currentPhase: phase, renewalAttemptsFailed: 0 });
  if (plan.band === "renewing" || plan.band === "draining") {
    say(phase, "node-a", `ROTATE  band=${plan.band} disposition=${plan.workDisposition}`);
    issueForA(a, attestorA, phase);
    return;
  }
  if (plan.band === "expired") say(phase, "node-a", `FAILCLOSED ${plan.reason}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const totalPhases = numAfter(args, "--phases", 260);
  const intervalMs = numAfter(args, "--interval-ms", 0);

  let phase = 100;

  // A accepts strangers that can reconstruct the common seed — unattended.
  const a = makeNode(
    "node-a.zeta.local",
    {
      admissibleDomains: ["node-b.zeta.local", "node-c.zeta.local"],
      firstContact: "seed-reconstruction",
      witnessQuorum: 2,
      recognizedWitnesses: [],
      maxBundleAgePhases: 400,
      maxRootLifetimePhases: 200_000,
    },
    phase,
  );

  // B accepts A the same way, but does NOT admit C at all. This is the
  // asymmetry: A will accept C, B never will, and both are correct.
  const b = makeNode(
    "node-b.zeta.local",
    {
      admissibleDomains: ["node-a.zeta.local"],
      firstContact: "seed-reconstruction",
      witnessQuorum: 2,
      recognizedWitnesses: [],
      maxBundleAgePhases: 400,
      maxRootLifetimePhases: 200_000,
    },
    phase,
  );

  // C requires a human for first contact — a third legitimate local policy.
  const c = makeNode(
    "node-c.zeta.local",
    {
      admissibleDomains: ["node-a.zeta.local", "node-b.zeta.local"],
      firstContact: "operator-ceremony",
      witnessQuorum: 2,
      recognizedWitnesses: [],
      maxBundleAgePhases: 400,
      maxRootLifetimePhases: 200_000,
    },
    phase,
  );

  say(phase, "loop", "three nodes, three roots, three DIFFERENT local policies. No shared state exists between them.");
  for (const n of [a, b, c]) {
    record("generate-node-root-key", phase, n.domain);
    say(
      phase,
      n.domain,
      `root ${n.rootSigner.keyId} (ephemeral, in-process, exposureBoundary=${n.rootSigner.exposureBoundary})`,
    );
  }

  // ── 1. first contact by seed reconstruction ────────────────────────────────
  phase += 1;
  const spentNonces = new Set<string>();
  seedHandshake(a, b, phase, spentNonces);
  seedHandshake(b, a, phase, spentNonces);
  seedHandshake(a, c, phase, spentNonces);
  seedHandshake(b, c, phase, spentNonces); // refused: C is not in B's admissible set
  seedHandshake(c, a, phase, spentNonces); // pending: C's policy wants a human

  phase += 1;
  say(
    phase,
    "loop",
    `ASYMMETRY  accepts(A,C)=${String(accepts(a.accepted, c.domain))}  accepts(B,C)=${String(accepts(b.accepted, c.domain))}  accepts(C,A)=${String(accepts(c.accepted, a.domain))}`,
  );
  say(phase, "loop", "all three are correct simultaneously. Nothing reconciles them and nothing should.");

  // A and B exchange their verdicts about C as FACTS. Neither adopts the
  // other's conclusion; both retain the disagreement.
  const bAboutC = b.vault.find((r) => r.subject === c.domain);
  if (bAboutC) a.vault = loadVerdict(a.vault, { ...bAboutC, recordSource: "gossip-from-b" });
  const d = decorrelation(a.vault, c.domain);
  say(phase, "node-a", `RAW VAULT  ${d.reason}`);
  const view = deriveActionableView({
    vault: a.vault,
    subject: c.domain,
    actingObserver: a.domain,
    policy: { kind: "own-verdict-only" },
  });
  say(
    phase,
    "node-a",
    `DERIVED    act=${String(view.act)} (dissent from ${view.dissentingObservers.join(", ") || "nobody"}, retained not overridden)`,
  );

  // ── 2. workload attestation + issuance ─────────────────────────────────────
  const rules = validateSelectorRules([{ spiffePath: "/agent/otto", requireUid: 501, requireBinarySha256: BINARY_A }]);
  if (!rules.ok) throw new Error("selector rules invalid");
  const attestorA = createSoftwareWorkloadAttestor(rules.value);

  phase += 1;
  issueForA(a, attestorA, phase);

  // ── 3. B verifies A's workload — the federation payoff ─────────────────────
  phase += 1;
  if (a.workloadSvid) {
    record("verify-peer-svid", phase, b.domain);
    const verdict = validatePeerSvid({
      accepted: b.accepted,
      signed: a.workloadSvid,
      currentPhase: phase,
      verifier: V,
    });
    say(phase, b.domain, `VERIFY  ${verdict.allowed ? "OK" : "NO"} — ${verdict.reason}`);
    const cVerdict = validatePeerSvid({
      accepted: c.accepted,
      signed: a.workloadSvid,
      currentPhase: phase,
      verifier: V,
    });
    say(phase, c.domain, `VERIFY  ${cVerdict.allowed ? "OK" : "NO"} — ${cVerdict.reason}`);
  }

  // ── 4. the hardware path, refusing honestly ────────────────────────────────
  phase += 1;
  const hsm = yubiHsmSignerRequiringCeremony({
    keyId: "yubihsm#3",
    hsmDomain: 3,
    algorithm: "ecdsa-sha256-p256",
    publicKey: "public-half-only",
  });
  const hsmAttempt = hsm.sign(new TextEncoder().encode("anything"));
  say(phase, "node-a", hsmAttempt.ok ? "HSM     sign -> signed" : `HSM     sign -> REFUSED (${hsmAttempt.error.kind})`);
  record("open-authenticated-hsm-session", phase, a.domain);

  // ── 5. root rotation is GATED; leaf rotation is not ────────────────────────
  phase += 1;
  record("rotate-node-root-key", phase, a.domain);
  say(
    phase,
    "node-a",
    "so the root is NOT rotated by this loop. A continuity-carrying rotation would be accepted unattended by peers — the gate is on producing it, not on accepting it.",
  );

  // ── 6. revocation as a G-Set, merged pairwise ──────────────────────────────
  phase += 1;
  const rev: RevocationEntry = (() => {
    const base = {
      trustDomain: a.domain,
      revokedKeyId: `${a.domain}#workload-legacy`,
      revokedFromPhase: phase,
      signedByKeyId: a.rootSigner.keyId,
      recordSource: "self",
    };
    const sig = a.rootSigner.sign(revocationSigningBytes({ ...base, signature: "" }));
    if (!sig.ok) throw new Error("revocation signing failed");
    return { ...base, signature: sig.value };
  })();
  a.revocations = addRevocation(a.revocations, rev);
  b.revocations = mergeRevocations(b.revocations, a.revocations);
  c.revocations = mergeRevocations(mergeRevocations(c.revocations, b.revocations), a.revocations); // different order, same result
  record("merge-peer-revocation-set", phase, b.domain);
  say(
    phase,
    "loop",
    `REVOKE  G-Set digests A=${revocationSetDigest(a.revocations).slice(0, 16)} B=${revocationSetDigest(b.revocations).slice(0, 16)} C=${revocationSetDigest(c.revocations).slice(0, 16)} (converged: ${String(revocationSetDigest(a.revocations) === revocationSetDigest(c.revocations))})`,
  );
  const bCheck = isKeyRevoked({
    revocations: b.revocations,
    accepted: b.accepted,
    trustDomain: a.domain,
    keyId: rev.revokedKeyId,
    currentPhase: phase,
    verifier: V,
  });
  const cCheck = isKeyRevoked({
    revocations: c.revocations,
    accepted: c.accepted,
    trustDomain: a.domain,
    keyId: rev.revokedKeyId,
    currentPhase: phase,
    verifier: V,
  });
  say(phase, "node-b", `REVCHK  revoked=${String(bCheck.revoked)} — ${bCheck.reason}`);
  say(phase, "node-c", `REVCHK  revoked=${String(cCheck.revoked)} — ${cCheck.reason}`);

  // ── 7. x402 ────────────────────────────────────────────────────────────────
  phase += 1;
  const budget: StandingBudget = { asset: "USDC", perPaymentMax: "0.50", totalMax: "5.00", spentSoFar: "0.00" };
  const settled = new Set<string>();
  const payCtx: PaymentCtx = { a, b, budget, settled };
  attemptPayment(payCtx, "0.25", phase, false);
  phase += 1;
  attemptPayment(payCtx, "0.25", phase, true); // facilitator lies; B overrides it
  phase += 1;
  attemptPayment(payCtx, "4.00", phase, false); // over per-payment ceiling → ceremony class

  // ── 8. the unattended rotation loop ────────────────────────────────────────
  say(
    phase,
    "loop",
    `entering the unattended rotation loop until phase ${String(totalPhases)}; interval ${String(intervalMs)}ms steers only wake-up, never a verdict`,
  );
  const end = totalPhases;
  while (phase < end) {
    phase += 1;
    rotationStep(a, attestorA, phase);
    if (intervalMs > 0) await new Promise((r) => setTimeout(r, intervalMs));
  }

  printSummary({ a, b, c, endPhase: end });
}

/** The end-of-run report. Extracted so `main` stays readable. */
function printSummary(args: { readonly a: Node; readonly b: Node; readonly c: Node; readonly endPhase: number }): void {
  const { a, b, c, endPhase } = args;
  const uniq = (xs: readonly string[]): string[] => [...new Set(xs)].sort(ordinalCompare);
  process.stdout.write("\n─── summary ───────────────────────────────────────────────────────────\n");
  process.stdout.write(`unattended leaf renewals over ${String(endPhase - 100)} phases : ${String(a.renewals)}\n`);
  process.stdout.write(
    `bundle digests  A=${bundleDigest(a.ownBundle).slice(0, 12)} B=${bundleDigest(b.ownBundle).slice(0, 12)} C=${bundleDigest(c.ownBundle).slice(0, 12)}\n`,
  );
  process.stdout.write(`A accepts: ${[...a.accepted.keys()].join(", ") || "(none)"}\n`);
  process.stdout.write(`B accepts: ${[...b.accepted.keys()].join(", ") || "(none)"}\n`);
  process.stdout.write(`C accepts: ${[...c.accepted.keys()].join(", ") || "(none)"}   <- asymmetric, and correct\n`);
  process.stdout.write(`\nUNATTENDED operations performed:\n  ${uniq(unattended).join("\n  ")}\n`);
  process.stdout.write(
    `\nGATED operations that STOPPED here and need Aaron's biometric ceremony:\n  ${uniq(gated).join("\n  ")}\n`,
  );
  process.stdout.write("\nnothing above touched a network, a disk, a keychain, or a credential.\n");
  process.stdout.write(
    "the GATED list is what a real deployment would hand to Aaron; this process performed none of it.\n",
  );
}

if (import.meta.main) {
  await main();
}
