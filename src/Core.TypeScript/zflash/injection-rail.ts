/**
 * src/Core.TypeScript/zflash/injection-rail.ts
 *
 * 081KTWFYC9108QG0R001C8RDPK — boot crypto / workload identity, the DOOR half.
 *
 * WHAT THIS IS
 * ------------
 * `full-ai-cluster/INJECTION-POINTS.md` opens with a rail it calls
 * "constitutional":
 *
 *   > public identifier  -> USB ESP at flash time is allowed
 *   > secret material    -> cluster console at install time ONLY, never on the ESP
 *
 * Until this module, that rail existed **only as prose**. `FileBackedEspWrite`
 * in `lib.ts` has a closed union of six ESP destinations and no notion of what
 * class any of them carries, so nothing in the build could tell
 * `/zeta-hostname.txt` (a hostname) from `/zeta-join-token` (cluster
 * membership, in the clear, on a FAT filesystem). The rail was enforced by
 * whoever happened to read the markdown.
 *
 * This module makes the class a **type**, exhaustive over that same union, in
 * the shape #11485 set for `VendorTrustRoot`: the illegal state is
 * unrepresentable rather than runtime-checked. Adding a seventh ESP
 * destination without declaring its content class is a TypeScript error at
 * {@link ESP_DESTINATION_CONTENT_CLASS}, not a review miss.
 *
 * WHAT IT IS NOT
 * --------------
 * **No cryptography happens here, and no key material passes through here.**
 * Nothing is encrypted, sealed, bound, attested, or verified by this file. It
 * classifies *destinations* and *artifact kinds* and returns verdicts. In
 * particular `"encrypted-envelope"` below is a **declared** class, not a
 * measured one — this module never opens `/zeta-creds.enc` to check that it is
 * in fact an AES-256-GCM envelope. That check belongs to the tool that writes
 * it (`installer/zeta-creds-crypto.ts`).
 *
 * The work-item's review gate ("Nazar + Mateo review the surface BEFORE
 * implementation; no key handling lands without it") is the reason the scope
 * stops here: a policy that touches no bytes is not key handling, and the
 * parts that would handle bytes are named as open questions in
 * {@link WORKLOAD_IDENTITY_CUSTODY_DECISIONS} rather than decided.
 *
 * Anchors (Beacon):
 * - SPIFFE/SPIRE (Cloud Native Computing Foundation) — workload identity as
 *   SPIFFE ID + SVID + trust bundle, the shape `docs/research/2026-07-03-persona-cell-identity-treaty-*`
 *   Article 3 fixes for this repo and `tools/setup/persona-keys/ca.ts` names as
 *   the long-term target. The division of artifacts below is SPIFFE's, not ours.
 * - `docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-*`
 *   — the governance-class taxonomy and the no-silent-downgrade invariant that
 *   {@link WORKLOAD_IDENTITY_CUSTODY_DECISIONS} defers to.
 */

import { parseSpiffe, toSpiffe, type ActorRef } from "../identity/actor-ref.ts";
import type { PersonaId } from "../identity/generated-registry.ts";
import { VALID_HOSTNAME_REGEX, type FileBackedEspWrite } from "./lib.ts";

/** Every ESP destination `lib.ts` can currently plan. Alias, so drift is one edit. */
export type EspDestination = FileBackedEspWrite["destination"];

/**
 * The content classes the rail partitions by.
 *
 * The catalog's own table names two. A third is needed to state the truth
 * about `/zeta-creds.enc`, which the catalog permits on the ESP while calling
 * it secret material — the permission comes from it being an encrypted
 * envelope bound to an operator passphrase plus the USB UUID, not from it
 * being non-secret. Collapsing that into "secret material" would make the
 * catalog self-contradictory; collapsing it into "public identifier" would be
 * a lie about the plaintext. So it gets its own class.
 */
export type InjectionContentClass =
  /** Nothing is lost by a stranger reading it: a hostname, a public key, a role. */
  | "public-identifier"
  /** Grants something. Readable by anyone holding the medium. */
  | "secret-material"
  /**
   * Secret plaintext inside a declared envelope whose key is not on the medium.
   * DECLARED, never measured here — see the module header.
   */
  | "encrypted-envelope";

/**
 * NOT a content class — the explicit absence of one.
 *
 * WHY A STATE AND NOT A GUESS. The totality constraint below forces every ESP
 * destination to carry a value. When a new destination arrives whose class is a
 * *security judgement* rather than a reading of the bytes, the only two moves the
 * type system leaves are (a) pick a class anyway and (b) do not compile. Both are
 * wrong: (a) manufactures a decision nobody made and it is indistinguishable in the
 * diff from one that was reviewed; (b) makes the guard's own success — catching an
 * unclassified destination — look like breakage.
 *
 * So undecided is a first-class value. It fails CLOSED (refused on the ESP, the same
 * verdict as `secret-material`, and reported by {@link railFindingsForEspWrites}), it
 * is enumerable in {@link PENDING_CLASSIFICATIONS} with the question and the named
 * reviewers, and promoting it to a real class is a deliberate edit that shows up in a
 * diff — the same no-silent-downgrade shape {@link WORKLOAD_IDENTITY_CUSTODY_DECISIONS}
 * uses for custody. A destination sitting here is a decision that has NOT been taken;
 * it must never read as one that was.
 *
 * It is deliberately outside {@link InjectionContentClass} so that `evaluateRail`,
 * which answers a question about content classes, cannot be handed one of these.
 */
export type PendingClassification = "pending-security-review";

/**
 * Where a value can travel on its way into a fresh install.
 *
 * `usb-esp` is a FAT partition on a stick somebody can pocket: unencrypted,
 * readable on any machine, and readable *before* the node ever boots.
 */
export type TransitSurface = "usb-esp" | "cluster-console-operator-typed" | "post-install-secrets-manager";

/**
 * The rail, as a total map.
 *
 * `satisfies Record<EspDestination, ...>` is the load-bearing token in this
 * file: it makes the map exhaustive over the union in `lib.ts`, so a seventh
 * destination cannot be added without a class. That is condition 4 of
 * `.claude/rules/no-binary-in-proof-lineage.md` — a roster a check can
 * enumerate, rather than an allowlist that drifts from the thing it describes.
 *
 * IT HAS ALREADY FIRED ONCE, WHICH IS THE POINT. This module was written against a
 * six-destination union. While it sat unmerged the union grew to eight
 * (`/zeta-bind-uefi-keyfile`, `/zeta-qemu-creds-passphrase`), and the `satisfies`
 * clause turned that into a compile error rather than a silent gap — a destination
 * shipped for months with no class and nothing noticing is exactly the failure the
 * rail-as-prose had. One of the two is classified below by reading its bytes; the
 * other is a security judgement and sits in {@link PENDING_CLASSIFICATIONS}.
 */
export const ESP_DESTINATION_CONTENT_CLASS = Object.freeze({
  /** OpenSSH *public* keys. Publishing a public key costs nothing. */
  "/zeta-authorized-keys.pub": "public-identifier",
  /** An RFC1123 hostname. */
  "/zeta-hostname.txt": "public-identifier",
  /** AES-256-GCM envelope, scrypt+HKDF from operator passphrase and USB UUID. */
  "/zeta-creds.enc": "encrypted-envelope",
  /** `{"ssid":...,"password":...}` — the PSK, in the clear. See RAIL_DIVERGENCES. */
  "/zeta-wifi-credentials.json": "secret-material",
  /** Role, flake host attribute, join URL. All public identifiers. */
  "/zeta-firstboot.conf": "public-identifier",
  /** k3s node-token: cluster membership, in the clear. See ESP_RAIL_EXCEPTIONS. */
  "/zeta-join-token": "secret-material",
  /**
   * The literal bytes `"1\n"` — `lib.ts` `planFileBackedZflashImage` writes nothing
   * else to it. A boolean marker asking the guest installer to opt-in-bind the target
   * ESP keyfile. Reading it discloses nothing and grants nothing, so it is a public
   * identifier on the axis this rail measures.
   *
   * Named limit, so the classification is not read as wider than it is: this rail is
   * about the CONFIDENTIALITY of content in transit. A marker that changes installer
   * behaviour also has an INTEGRITY axis — anyone who can write the stick can set it —
   * and neither this module nor the catalog addresses ESP write-integrity at all. That
   * gap is real, it is not this classification's to close, and calling this file
   * `secret-material` would not close it either.
   */
  "/zeta-bind-uefi-keyfile": "public-identifier",
  /**
   * The literal bytes `"1\n"` — same shape as `/zeta-bind-uefi-keyfile`. Asks the
   * guest 6.95-picker to bake one deterministic gh-cli *test* token (the value
   * lives in the installer script + env, never on this file). Reading the marker
   * discloses nothing and grants nothing.
   */
  "/zeta-qemu-bake-test-cred": "public-identifier",
  /** SEE {@link PENDING_CLASSIFICATIONS}. Not classified; refused until reviewed. */
  "/zeta-qemu-creds-passphrase": "pending-security-review",
} satisfies Record<EspDestination, InjectionContentClass | PendingClassification>);

/**
 * A secret-material ESP write that is shipped anyway, with its gap on the record.
 *
 * The point of a roster rather than a boolean: an exception that cannot be
 * enumerated becomes invisible, and an invisible exception is the rail with
 * extra steps. Every field here has to be answerable by a reviewer.
 */
export interface EspRailException {
  readonly destination: EspDestination;
  /** Why it ships despite the class. Never "it is fine". */
  readonly recordedGap: string;
  /** Where the gap is written down for a human. */
  readonly recordedIn: string;
  /**
   * `true` when the write happens only because an operator explicitly asked
   * for it. An implicit secret-on-ESP write is not an exception, it is a leak.
   */
  readonly neverImplicit: boolean;
}

/**
 * The one recorded exception. `/zeta-join-token` (#11477).
 *
 * `/zeta-wifi-credentials.json` is deliberately NOT here — see
 * {@link RAIL_DIVERGENCES}. Adding it would launder an undocumented divergence
 * into a documented exception, which is exactly the move this roster exists to
 * make visible.
 */
export const ESP_RAIL_EXCEPTIONS = Object.freeze({
  "/zeta-join-token": Object.freeze({
    destination: "/zeta-join-token",
    recordedGap:
      "a k3s node-token in the clear on a FAT ESP grants cluster membership to " +
      "anyone holding the stick; the long-term home is the encrypted cred-blob " +
      "path (081KSKBP80008QG0R003AX2A69), which already has the passphrase + UUID binding",
    recordedIn: "full-ai-cluster/INJECTION-POINTS.md section 6",
    neverImplicit: true,
  }),
} satisfies Partial<Record<EspDestination, EspRailException>>);

/**
 * A shipped path whose behaviour contradicts the catalog, with NO exception on
 * file. Distinct from an exception: an exception was decided, a divergence was
 * not noticed.
 *
 * Found while writing this module, and it is the reason the module is worth
 * having: `INJECTION-POINTS.md` section 4 classifies WiFi credentials as
 * "**Secret material** (NEVER on USB ESP)" and says they are typed at the
 * console into `nmtui`. `planFileBackedZflashImage` nonetheless writes
 * `/zeta-wifi-credentials.json` — the SSID and the PSK as plain JSON — onto the
 * ESP whenever `--wifi-ssid`/`--wifi-password`/`--wifi-credentials` is passed.
 * `composeWifiCredentialsFileContent` performs no encryption; it validates and
 * serialises.
 *
 * NOT changed here. Removing a shipped flag is a maintainer call and this
 * module has no authority to make it; the honest move is #11477's — record it
 * rather than ship it quietly, and let the rail report it.
 */
export const RAIL_DIVERGENCES = Object.freeze({
  "/zeta-wifi-credentials.json": Object.freeze({
    destination: "/zeta-wifi-credentials.json",
    catalogSays:
      "INJECTION-POINTS.md section 4: WiFi credentials are secret material, " +
      "console-only via nmtui at first boot, NEVER on USB ESP",
    codeDoes:
      "planFileBackedZflashImage writes {ssid,password} as plaintext JSON to the ESP " +
      "when --wifi-ssid/--wifi-password/--wifi-credentials is passed; " +
      "composeWifiCredentialsFileContent does not encrypt",
    disposition: "UNRESOLVED — needs a maintainer decision, not a silent fix",
  }),
} satisfies Partial<
  Record<
    EspDestination,
    {
      readonly destination: EspDestination;
      readonly catalogSays: string;
      readonly codeDoes: string;
      readonly disposition: string;
    }
  >
>);

/**
 * A destination whose content class is a security judgement nobody has made yet.
 *
 * Shaped like {@link CustodyDecision} on purpose — same `decided: false` invariant,
 * same "surfaced, never answered" contract. The difference is only what it blocks:
 * a custody decision blocks a design, this blocks a classification.
 *
 * `options` is the part that makes the entry actionable rather than a shrug. A
 * reviewer should be able to decide from this roster alone without re-deriving the
 * problem, and every option here is one the rail can actually express.
 */
export interface PendingClassificationEntry {
  readonly destination: EspDestination;
  /** What is on the medium, factually. No verdict in this field. */
  readonly whatItCarries: string;
  /** The question a reviewer has to answer. */
  readonly question: string;
  /** Each option, and what choosing it would mean mechanically. */
  readonly options: readonly { readonly choice: string; readonly consequence: string }[];
  readonly whoDecides: string;
  readonly decided: false;
}

/**
 * `/zeta-qemu-creds-passphrase` — undecided, and deliberately so.
 *
 * The work-item this module belongs to (081KTWFYC9108QG0R001C8RDPK) carries the gate
 * *"Nazar (ops) + Mateo (research) review the surface BEFORE implementation; no key
 * handling lands without it."* Classifying the other seven destinations is reading
 * bytes. Classifying this one is a judgement about a real weakening of the credential
 * envelope, so it is left for the named reviewers rather than taken in a rescue pass.
 */
export const PENDING_CLASSIFICATIONS = Object.freeze({
  "/zeta-qemu-creds-passphrase": Object.freeze({
    destination: "/zeta-qemu-creds-passphrase",
    whatItCarries:
      "the plaintext passphrase for /zeta-creds.enc, written by " +
      "planFileBackedZflashImage when --qemu-creds-passphrase-file is passed, and read " +
      "back off the boot USB ESP by installer/uefi-keyfile-esp.ts " +
      "(QEMU_CREDS_PASSPHRASE_IMAGE_PATH) so a non-interactive QEMU run can bind the blob",
    question:
      "What content class does the passphrase for an on-medium encrypted envelope take " +
      "when it ships on THAT SAME MEDIUM? The envelope's own 'encrypted-envelope' class " +
      "is justified by the key not being on the stick (see /zeta-creds.enc); this file is " +
      "that key. Whether a QEMU-only, non-production flag makes that acceptable, and " +
      "whether the rail should model 'test-only' at all, is the security call.",
    options: Object.freeze([
      Object.freeze({
        choice: "secret-material, with an entry in ESP_RAIL_EXCEPTIONS",
        consequence:
          "ships as today, refused-then-rescued by a NAMED exception; the flash path " +
          "prints 'SECRET MATERIAL IN PLAINTEXT ON THE ESP' whenever the flag is used. " +
          "Requires deciding neverImplicit (it IS operator-flag-gated today) and writing " +
          "the recordedGap. Note this would also downgrade /zeta-creds.enc in practice " +
          "whenever both are baked together, which no roster currently states.",
      }),
      Object.freeze({
        choice: "secret-material, with an entry in RAIL_DIVERGENCES and no exception",
        consequence:
          "ships as today and is REFUSED loudly on every use, recorded as a divergence " +
          "the catalog has not resolved — the disposition the wifi PSK already has.",
      }),
      Object.freeze({
        choice: "a new class the rail does not yet have (e.g. test-fixture-only)",
        consequence:
          "the largest change: it widens InjectionContentClass, and a class whose " +
          "membership is decided by INTENT rather than by content is one a future caller " +
          "can talk its way into. Would need its own falsifier for that.",
      }),
      Object.freeze({
        choice: "stop writing it — move the passphrase off the ESP entirely",
        consequence:
          "a behaviour change to a shipped CI lane (QEMU_UEFI_KEYFILE_PICKER), i.e. a " +
          "maintainer call, not a classification. Out of scope for this module either way.",
      }),
    ]),
    whoDecides: "Nazar (ops) + Mateo (research), per 081KTWFYC9108QG0R001C8RDPK's review gate",
    decided: false,
  }),
} satisfies Partial<Record<EspDestination, PendingClassificationEntry>>);

/** The verdict for one (content class, transit surface) pair. */
export type RailVerdict =
  | { readonly permitted: "by-class"; readonly contentClass: InjectionContentClass }
  | { readonly permitted: "by-recorded-exception"; readonly exception: EspRailException }
  | {
      readonly permitted: false;
      readonly contentClass: InjectionContentClass | PendingClassification;
      readonly why: string;
    };

/**
 * Does this content class travel on this surface?
 *
 * Deliberately NOT keyed by destination, so the rule is a statement about
 * classes and a caller cannot special-case a filename past it.
 */
export function evaluateRail(contentClass: InjectionContentClass, surface: TransitSurface): RailVerdict {
  if (surface !== "usb-esp") {
    // The console is operator-typed and the secrets manager holds secrets by
    // design; both are where the catalog sends secret material.
    return { permitted: "by-class", contentClass };
  }
  if (contentClass === "public-identifier" || contentClass === "encrypted-envelope") {
    return { permitted: "by-class", contentClass };
  }
  return {
    permitted: false,
    contentClass,
    why:
      "secret material must not transit an unencrypted USB ESP: the medium is " +
      "readable by anyone holding it, before the node ever boots " +
      "(INJECTION-POINTS.md constitutional rail)",
  };
}

/**
 * The rail applied to a concrete planned ESP write.
 *
 * Order matters and is the honest order: the class decides first, and only a
 * *named* exception can rescue a refusal. A destination with no class cannot
 * reach here, because the map above is exhaustive.
 */
export function evaluateEspWrite(destination: EspDestination): RailVerdict {
  const contentClass = ESP_DESTINATION_CONTENT_CLASS[destination];
  // UNDECIDED FAILS CLOSED, AND BEFORE THE EXCEPTION LOOKUP. An entry in
  // ESP_RAIL_EXCEPTIONS is a decision about a KNOWN class; it must not be able to
  // rescue a destination whose class has never been decided, because that would let
  // a review gate be satisfied by a roster entry the reviewers never saw.
  if (contentClass === "pending-security-review") {
    const pending = PENDING_CLASSIFICATIONS[destination as keyof typeof PENDING_CLASSIFICATIONS] as
      | PendingClassificationEntry
      | undefined;
    return {
      permitted: false,
      contentClass,
      why:
        "content class UNDECIDED — no reviewer has classified this destination, so the " +
        "rail cannot say whether it may ride the medium and refuses rather than guessing. " +
        (pending === undefined
          ? "It is also absent from PENDING_CLASSIFICATIONS, which is itself a defect."
          : `Awaiting ${pending.whoDecides}. ${pending.question}`),
    };
  }
  const verdict = evaluateRail(contentClass, "usb-esp");
  if (verdict.permitted !== false) {
    return verdict;
  }
  const exception: EspRailException | undefined = (
    ESP_RAIL_EXCEPTIONS as Partial<Record<EspDestination, EspRailException>>
  )[destination];
  if (exception !== undefined) {
    return { permitted: "by-recorded-exception", exception };
  }
  return verdict;
}

/** One line a human reads at flash time. Refusals lead with the word. */
export function describeEspWriteVerdict(destination: EspDestination): string {
  const verdict = evaluateEspWrite(destination);
  if (verdict.permitted === "by-class") {
    return `${destination}: ${verdict.contentClass} — permitted on the ESP by the constitutional rail`;
  }
  if (verdict.permitted === "by-recorded-exception") {
    return (
      `${destination}: SECRET MATERIAL IN PLAINTEXT ON THE ESP — shipped under a recorded ` +
      `exception (${verdict.exception.recordedIn}). ${verdict.exception.recordedGap}`
    );
  }
  if (verdict.contentClass === "pending-security-review") {
    return `${destination}: REFUSED BY THE RAIL — CONTENT CLASS NOT YET REVIEWED. ${verdict.why}`;
  }
  return `${destination}: REFUSED BY THE RAIL — ${verdict.why}`;
}

/**
 * Every planned write the rail has something to say about: secret-class (exception or
 * not) and unclassified.
 *
 * This is the function a flash path calls: it does not decide whether to
 * proceed, it makes sure nobody proceeds unknowingly. Unclassified belongs here for
 * the same reason secret-class does — an operator flashing a destination nobody has
 * reviewed should learn that at flash time, not from a roster they will never read.
 */
export function railFindingsForEspWrites(destinations: readonly EspDestination[]): readonly string[] {
  return destinations
    .filter((destination) => {
      const contentClass = ESP_DESTINATION_CONTENT_CLASS[destination];
      return contentClass === "secret-material" || contentClass === "pending-security-review";
    })
    .map(describeEspWriteVerdict);
}

// ───────────────────────── workload identity at the door ─────────────────────

/**
 * The three artifacts a SPIFFE workload identity is made of.
 *
 * This split is SPIFFE's, and it is the whole answer to "can a workload
 * identity key be injected at flash time": two of the three are public
 * identifiers and ride the medium happily; the third is the one people mean
 * when they say "the key", and under SPIFFE it is not transported at all — the
 * workload generates it and only a certificate signing request leaves.
 */
export type WorkloadIdentityArtifact =
  /** The URI. Names the workload; grants nothing. */
  | "spiffe-id"
  /** The trust domain's CA public keys — what a node needs to verify anyone. */
  | "trust-bundle"
  /** The private half of the SVID. */
  | "svid-private-key";

export const WORKLOAD_IDENTITY_ARTIFACT_CONTENT_CLASS = Object.freeze({
  "spiffe-id": "public-identifier",
  "trust-bundle": "public-identifier",
  "svid-private-key": "secret-material",
} satisfies Record<WorkloadIdentityArtifact, InjectionContentClass>);

/**
 * A custody question this module refuses to answer.
 *
 * Every entry is `decided: false` and a test asserts it, so deciding one is a
 * deliberate edit that shows up in a diff — the no-silent-downgrade shape from
 * the L0-L6 ladder, applied to the decisions themselves rather than to a key.
 */
export interface CustodyDecision {
  readonly question: string;
  readonly whoDecides: string;
  readonly decided: false;
}

export const WORKLOAD_IDENTITY_CUSTODY_DECISIONS: readonly CustodyDecision[] = Object.freeze([
  Object.freeze({
    question:
      "Where is a node's SVID private key sealed at rest — TPM 2.0, a Secure Enclave, " +
      "a software keystore, or nothing? (The 2026-08-14 hardware probe found no TPM and " +
      "no usable seal tier on the Mac Studio; the x86 cluster nodes are unprobed.)",
    whoDecides: "maintainer, with Nazar (ops)",
    decided: false,
  }),
  Object.freeze({
    question:
      "Is the node's identity TPM-bound — i.e. does the key survive a disk move to " +
      "different hardware? Binding and sealing are separate choices and either can be made " +
      "without the other.",
    whoDecides: "maintainer, with Nazar (ops)",
    decided: false,
  }),
  Object.freeze({
    question:
      "Who authorizes issuance at first boot? SPIRE's node attestation answers 'which node " +
      "is this' from a vendor-rooted claim; nothing in this repo yet answers 'and may it " +
      "have an identity in this trust domain'.",
    whoDecides: "maintainer, with Mateo (research)",
    decided: false,
  }),
  Object.freeze({
    question:
      "Which governance class does a node workload key take — self-sovereign, " +
      "shared-capability, or delegated-operational? The 2026-08-14 ladder fixes the taxonomy " +
      "and explicitly leaves the per-key assignment to ratification.",
    whoDecides: "maintainer, at ratification",
    decided: false,
  }),
]);

export type WorkloadSpiffeIdResult =
  | { readonly ok: true; readonly spiffeId: string }
  | { readonly ok: false; readonly error: string };

export interface NodeWorkloadIdentityInput {
  readonly persona: PersonaId;
  /** The cell surface. A node coordinate without a surface is not a valid cell. */
  readonly surface: string;
  readonly instance?: string;
  /** The hostname zflash injects as `/zeta-hostname.txt`. */
  readonly nodeHostname: string;
}

/**
 * Derive the treaty-canonical SPIFFE ID for a workload on a flashed node.
 *
 * The composition is the useful part and it is not invented: the hostname is
 * *already* injected at flash time as `/zeta-hostname.txt`, and the identity
 * treaty's Article 3 form ends in `@<node>`. The flash-time public identifier
 * is the node coordinate of the identity the workload will later hold.
 *
 * Derivation is `toSpiffe` followed by `parseSpiffe` — the round trip is the
 * validation. `toSpiffe` concatenates and checks nothing, so trusting it alone
 * would emit URIs that this repo's own parser rejects.
 *
 * The forcing case that makes the round trip non-decorative:
 * `VALID_HOSTNAME_REGEX` accepts uppercase (`Node-A` is RFC1123-valid and
 * zflash writes it), while the actor-ref segment charset is
 * `/^[a-z0-9][a-z0-9._-]*$/` — lowercase only. So a hostname that flashes
 * cleanly can be an unusable SPIFFE node coordinate, and the refusal has to say
 * so rather than emitting a URI nothing can parse.
 */
export function deriveNodeWorkloadSpiffeId(input: NodeWorkloadIdentityInput): WorkloadSpiffeIdResult {
  const nodeHostname = input.nodeHostname.trim();
  if (nodeHostname.length === 0) {
    return { ok: false, error: "node hostname is required to derive a node-scoped SPIFFE ID" };
  }
  if (!VALID_HOSTNAME_REGEX.test(nodeHostname)) {
    return { ok: false, error: `node hostname is not RFC1123-valid: ${nodeHostname}` };
  }
  const surface = input.surface.trim();
  if (surface.length === 0) {
    return {
      ok: false,
      error: "cell surface is required: the identity grammar rejects a node coordinate with no surface",
    };
  }
  const instance = input.instance?.trim();
  const actor: ActorRef = {
    persona: input.persona,
    cell: {
      surface,
      ...(instance === undefined || instance.length === 0 ? {} : { instance }),
      node: nodeHostname,
    },
  };
  const spiffeId = toSpiffe(actor);
  try {
    parseSpiffe(spiffeId);
  } catch (cause) {
    return {
      ok: false,
      error:
        `derived SPIFFE ID does not round-trip through this repo's own parser: ${spiffeId} ` +
        `(${cause instanceof Error ? cause.message : String(cause)}). ` +
        `An RFC1123 hostname may be uppercase; an actor-ref node segment may not.`,
    };
  }
  return { ok: true, spiffeId };
}

export interface WorkloadIdentityFlashPlan {
  readonly spiffeId: string;
  /** Artifact kinds the rail permits on the flash medium. */
  readonly espPermittedArtifacts: readonly WorkloadIdentityArtifact[];
  /** Artifact kinds the rail refuses on the flash medium, with the reason. */
  readonly espRefusedArtifacts: readonly {
    readonly artifact: WorkloadIdentityArtifact;
    readonly why: string;
  }[];
  /** Named, undecided. This module surfaces them; it does not answer them. */
  readonly custodyDecisions: readonly CustodyDecision[];
}

export type WorkloadIdentityFlashPlanResult =
  | { readonly ok: true; readonly value: WorkloadIdentityFlashPlan }
  | { readonly ok: false; readonly error: string };

/**
 * What of a workload identity may ride the flash medium, and what may not.
 *
 * Returns a plan, not an action: nothing here writes, encrypts, or generates.
 * The refusal of `svid-private-key` is the substantive output and it has two
 * independent reasons, either of which alone would be enough — the rail
 * (secret material, unencrypted medium) and SPIFFE's own design (the private
 * key is generated at the workload and never transported).
 */
export function planWorkloadIdentityFlashInjection(input: NodeWorkloadIdentityInput): WorkloadIdentityFlashPlanResult {
  const derived = deriveNodeWorkloadSpiffeId(input);
  if (!derived.ok) {
    return { ok: false, error: derived.error };
  }
  const permitted: WorkloadIdentityArtifact[] = [];
  const refused: { artifact: WorkloadIdentityArtifact; why: string }[] = [];
  const artifacts: readonly WorkloadIdentityArtifact[] = ["spiffe-id", "trust-bundle", "svid-private-key"];
  for (const artifact of artifacts) {
    const contentClass = WORKLOAD_IDENTITY_ARTIFACT_CONTENT_CLASS[artifact];
    const verdict = evaluateRail(contentClass, "usb-esp");
    if (verdict.permitted === "by-class") {
      permitted.push(artifact);
    } else if (verdict.permitted === false) {
      refused.push({
        artifact,
        why:
          `${verdict.why}. Independently, SPIFFE does not transport this artifact at all: ` +
          `the workload generates its own private key and only a CSR leaves it.`,
      });
    }
  }
  return {
    ok: true,
    value: {
      spiffeId: derived.spiffeId,
      espPermittedArtifacts: permitted,
      espRefusedArtifacts: refused,
      custodyDecisions: WORKLOAD_IDENTITY_CUSTODY_DECISIONS,
    },
  };
}
