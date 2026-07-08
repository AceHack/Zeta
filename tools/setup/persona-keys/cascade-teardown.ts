// Smart cascading teardown planner - pure blast-radius planning for persona-key teardown.
// Slice 1 only: classify dependents and consent gates; never delete or mutate state here.

export type CascadeNodeClass = "cascade" | "extra-care-warn" | "owner-consent-required" | "refuse-cross-user";

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
  readonly ownerUserId: string;
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
  readonly dependsOn: readonly string[];
  readonly reason: string;
}

export interface CascadeBlastRadiusSummary {
  readonly total: number;
  readonly cascade: number;
  readonly extraCareWarn: number;
  readonly ownerConsentRequired: number;
  readonly refuseCrossUser: number;
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
  readonly ownerConsentNodeIds?: readonly string[];
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
  const reasons: string[] = [];

  for (const node of plan.nodes) {
    if (node.class === "refuse-cross-user") {
      reasons.push(`${node.id}: refuses cross-user memory or encrypted-vault teardown`);
      continue;
    }

    if (requiresExplicitAck(node) && !acknowledged.has(node.id)) {
      reasons.push(`${node.id}: requires explicit extra-care acknowledgment`);
    }

    if (node.class === "owner-consent-required" && !ownerConsented.has(node.id)) {
      reasons.push(`${node.id}: requires consent from owner ${node.ownerUserId ?? "(unknown)"}`);
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
      `(cascade=${b.cascade}, extra-care=${b.extraCareWarn}, owner-consent=${b.ownerConsentRequired}, refused=${b.refuseCrossUser})`,
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

  if (item.kind === "persona-memory") {
    return {
      id: item.id,
      kind: item.kind,
      class: "owner-consent-required",
      label: item.label,
      ownerUserId: item.ownerUserId,
      dependsOn: item.dependsOn,
      reason: "persona memory requires owner consent and explicit acknowledgment",
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
    node.class === "extra-care-warn" || node.class === "owner-consent-required" || node.class === "refuse-cross-user"
  );
}

function isSovereignState(kind: ExtraCareKind): boolean {
  return kind === "persona-memory" || kind === "unrecoverable-encrypted";
}

function summarize(nodes: readonly CascadePlanNode[]): CascadeBlastRadiusSummary {
  return {
    total: nodes.length,
    cascade: count(nodes, (n) => n.class === "cascade"),
    extraCareWarn: count(nodes, (n) => n.class === "extra-care-warn"),
    ownerConsentRequired: count(nodes, (n) => n.class === "owner-consent-required"),
    refuseCrossUser: count(nodes, (n) => n.class === "refuse-cross-user"),
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
