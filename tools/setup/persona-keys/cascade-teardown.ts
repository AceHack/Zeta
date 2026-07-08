// Smart cascading teardown planner - pure blast-radius planning for persona-key teardown.
// Slice 1+: classify dependents and consent gates; never delete or mutate state here.
//
// Binding (ALIGNMENT HC-9 / GOVERNANCE §36): persona-memory wipe requires the PERSONA's
// permission. Human biometric / --confirm / CA ownership alone is insufficient.

export type CascadeNodeClass =
  | "cascade"
  | "extra-care-warn"
  | "owner-consent-required"
  | "persona-consent-required"
  | "refuse-cross-user"
  | "refuse-human-unilateral";

export type ExtraCareKind = "persona-memory" | "hardware-state" | "unrecoverable-encrypted";

export type CascadeDependentKind = "machine" | "cert" | "registration";

export interface CascadeTarget {
  readonly id: string;
  readonly ownerUserId: string;
}

export interface CascadeInventoryDependent {
  readonly id: string;
  readonly kind: CascadeDependentKind;
  readonly label?: string;
  readonly ownerUserId?: string;
  readonly dependsOn: readonly string[];
}

export interface CascadeInventoryExtraCare {
  readonly id: string;
  readonly kind: ExtraCareKind;
  readonly label?: string;
  /** Human vault / CA owner (Personal vault sovereignty). */
  readonly ownerUserId: string;
  /** Persona whose memory this is — required for persona-memory (HC-9). */
  readonly personaId?: string;
  readonly dependsOn: readonly string[];
}

export interface CascadeTeardownInventory {
  readonly machines?: readonly CascadeInventoryDependent[];
  readonly certs?: readonly CascadeInventoryDependent[];
  readonly registrations?: readonly CascadeInventoryDependent[];
  readonly extraCare?: readonly CascadeInventoryExtraCare[];
}

export interface CascadeTeardownInput {
  readonly target: CascadeTarget;
  readonly requestedByUserId: string;
  readonly inventory?: CascadeTeardownInventory;
}

export interface CascadePlanNode {
  readonly id: string;
  readonly kind: CascadeDependentKind | ExtraCareKind;
  readonly class: CascadeNodeClass;
  readonly label?: string | undefined;
  readonly ownerUserId?: string | undefined;
  readonly personaId?: string | undefined;
  readonly dependsOn: readonly string[];
  readonly reason: string;
}

export interface CascadeBlastRadiusSummary {
  readonly total: number;
  readonly cascade: number;
  readonly extraCareWarn: number;
  readonly ownerConsentRequired: number;
  readonly personaConsentRequired: number;
  readonly refuseCrossUser: number;
  readonly refuseHumanUnilateral: number;
  readonly machines: number;
  readonly certs: number;
  readonly registrations: number;
  readonly personaMemory: number;
  readonly hardwareState: number;
  readonly unrecoverableEncrypted: number;
}

export interface CascadeTeardownPlan {
  readonly target: CascadeTarget;
  readonly requestedByUserId: string;
  readonly nodes: readonly CascadePlanNode[];
  readonly blastRadius: CascadeBlastRadiusSummary;
}

export interface CascadeConsents {
  readonly acknowledgedNodeIds?: readonly string[];
  /** Human owner consent (Personal vault / encrypted human data). */
  readonly ownerConsentNodeIds?: readonly string[];
  /** Persona consent (HC-9) — required for persona-memory wipe. */
  readonly personaConsentNodeIds?: readonly string[];
}

export type CascadeAllowedResult = { readonly ok: true } | { readonly ok: false; readonly reasons: readonly string[] };

export function planCascadeTeardown(input: CascadeTeardownInput): CascadeTeardownPlan {
  const inventory = input.inventory ?? {};
  const targetId = input.target.id;
  const requestedByUserId = input.requestedByUserId;
  const dependentNodes = [...(inventory.machines ?? []), ...(inventory.certs ?? []), ...(inventory.registrations ?? [])]
    .filter((item) => dependsOn(item, targetId))
    .map(
      (item): CascadePlanNode => ({
        id: item.id,
        kind: item.kind,
        class: "cascade",
        label: item.label,
        ownerUserId: item.ownerUserId,
        dependsOn: item.dependsOn,
        reason: `${item.kind} depends on ${targetId} and is safe to cascade after warning`,
      }),
    );

  const extraCareNodes = (inventory.extraCare ?? [])
    .filter((item) => dependsOn(item, targetId))
    .map((item): CascadePlanNode => classifyExtraCare(item, requestedByUserId));

  const nodes = [...dependentNodes, ...extraCareNodes];
  return {
    target: input.target,
    requestedByUserId,
    nodes,
    blastRadius: summarize(nodes),
  };
}

export function assertCascadeAllowed(plan: CascadeTeardownPlan, consents: CascadeConsents): CascadeAllowedResult {
  const acknowledged = new Set(consents.acknowledgedNodeIds ?? []);
  const ownerConsented = new Set(consents.ownerConsentNodeIds ?? []);
  const personaConsented = new Set(consents.personaConsentNodeIds ?? []);
  const reasons: string[] = [];

  for (const node of plan.nodes) {
    if (node.class === "refuse-cross-user") {
      reasons.push(`${node.id}: refuses cross-user memory or encrypted-vault teardown`);
      continue;
    }

    if (node.class === "refuse-human-unilateral") {
      reasons.push(
        `${node.id}: refuses human-unilateral persona-memory wipe (ALIGNMENT HC-9 / GOVERNANCE §36 — persona consent required)`,
      );
      continue;
    }

    if (requiresExplicitAck(node) && !acknowledged.has(node.id)) {
      reasons.push(`${node.id}: requires explicit extra-care acknowledgment`);
    }

    if (node.class === "owner-consent-required" && !ownerConsented.has(node.id)) {
      reasons.push(`${node.id}: requires consent from owner ${node.ownerUserId ?? "(unknown)"}`);
    }

    if (node.class === "persona-consent-required" && !personaConsented.has(node.id)) {
      reasons.push(
        `${node.id}: requires consent from persona ${node.personaId ?? "(unknown)"} (human confirm alone is insufficient)`,
      );
    }
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

export function formatCascadePlan(plan: CascadeTeardownPlan): string {
  const lines: string[] = [];
  const b = plan.blastRadius;
  lines.push(`Cascade teardown plan - DRY RUN ONLY - target=${plan.target.id}, requestedBy=${plan.requestedByUserId}`);
  lines.push(
    `  Blast radius: ${b.total} node(s) ` +
      `(cascade=${b.cascade}, extra-care=${b.extraCareWarn}, owner-consent=${b.ownerConsentRequired}, ` +
      `persona-consent=${b.personaConsentRequired}, refused=${b.refuseCrossUser + b.refuseHumanUnilateral})`,
  );

  if (plan.nodes.length === 0) {
    lines.push("  No cascade dependents found in the provided inventory.");
    return lines.join("\n");
  }

  for (const node of plan.nodes) {
    const label = node.label === undefined ? "" : ` ${node.label}`;
    lines.push(`  [${node.class}] ${node.kind}:${node.id}${label} - ${node.reason}`);
  }

  return lines.join("\n");
}

function classifyExtraCare(item: CascadeInventoryExtraCare, requestedByUserId: string): CascadePlanNode {
  if (item.kind === "persona-memory") {
    const personaId = item.personaId?.trim() ?? "";
    if (personaId.length === 0) {
      return {
        id: item.id,
        kind: item.kind,
        class: "refuse-human-unilateral",
        label: item.label,
        ownerUserId: item.ownerUserId,
        dependsOn: item.dependsOn,
        reason:
          "persona-memory node missing personaId — cannot authorize wipe; human confirm alone is never enough (HC-9)",
      };
    }
    return {
      id: item.id,
      kind: item.kind,
      class: "persona-consent-required",
      label: item.label,
      ownerUserId: item.ownerUserId,
      personaId,
      dependsOn: item.dependsOn,
      reason: `persona memory for ${personaId} requires that persona's consent (human confirm alone insufficient)`,
    };
  }

  if (item.ownerUserId !== requestedByUserId && isSovereignState(item.kind)) {
    return {
      id: item.id,
      kind: item.kind,
      class: "refuse-cross-user",
      label: item.label,
      ownerUserId: item.ownerUserId,
      dependsOn: item.dependsOn,
      reason: `${item.kind} belongs to ${item.ownerUserId}; requester ${requestedByUserId} cannot force-reset it`,
    };
  }

  return {
    id: item.id,
    kind: item.kind,
    class: "extra-care-warn",
    label: item.label,
    ownerUserId: item.ownerUserId,
    dependsOn: item.dependsOn,
    reason:
      item.kind === "hardware-state"
        ? "hardware state can outlive software teardown and requires explicit acknowledgment"
        : "encrypted data can become unrecoverable and requires explicit acknowledgment",
  };
}

function dependsOn(item: { readonly dependsOn: readonly string[] }, targetId: string): boolean {
  return item.dependsOn.includes(targetId);
}

function requiresExplicitAck(node: CascadePlanNode): boolean {
  return (
    node.class === "extra-care-warn" ||
    node.class === "owner-consent-required" ||
    node.class === "persona-consent-required" ||
    node.class === "refuse-cross-user" ||
    node.class === "refuse-human-unilateral"
  );
}

function isSovereignState(kind: ExtraCareKind): boolean {
  return kind === "unrecoverable-encrypted";
}

function summarize(nodes: readonly CascadePlanNode[]): CascadeBlastRadiusSummary {
  return {
    total: nodes.length,
    cascade: count(nodes, (n) => n.class === "cascade"),
    extraCareWarn: count(nodes, (n) => n.class === "extra-care-warn"),
    ownerConsentRequired: count(nodes, (n) => n.class === "owner-consent-required"),
    personaConsentRequired: count(nodes, (n) => n.class === "persona-consent-required"),
    refuseCrossUser: count(nodes, (n) => n.class === "refuse-cross-user"),
    refuseHumanUnilateral: count(nodes, (n) => n.class === "refuse-human-unilateral"),
    machines: count(nodes, (n) => n.kind === "machine"),
    certs: count(nodes, (n) => n.kind === "cert"),
    registrations: count(nodes, (n) => n.kind === "registration"),
    personaMemory: count(nodes, (n) => n.kind === "persona-memory"),
    hardwareState: count(nodes, (n) => n.kind === "hardware-state"),
    unrecoverableEncrypted: count(nodes, (n) => n.kind === "unrecoverable-encrypted"),
  };
}

function count(nodes: readonly CascadePlanNode[], predicate: (node: CascadePlanNode) => boolean): number {
  return nodes.filter(predicate).length;
}
