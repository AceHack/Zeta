import type { AvailableOption, DeterministicRule, Menu16Slot, SlotAuthorizationDecision } from "./observe.ts";

export const ControlPlaneScopeKind = {
  Organization: "organization",
  Tenant: "tenant",
  Hat: "hat",
  Provider: "provider",
} as const;

export type ControlPlaneScopeKind = (typeof ControlPlaneScopeKind)[keyof typeof ControlPlaneScopeKind];

export const ControlPlaneFlagKind = {
  Estop: "estop",
  Freeze: "freeze",
  BudgetFreeze: "budget_freeze",
  ProviderFreeze: "provider_freeze",
  SimulatorRequired: "simulator_required",
} as const;

export type ControlPlaneFlagKind = (typeof ControlPlaneFlagKind)[keyof typeof ControlPlaneFlagKind];

export type ControlPlaneScope =
  | { kind: typeof ControlPlaneScopeKind.Organization }
  | { kind: typeof ControlPlaneScopeKind.Tenant; tenantId: string }
  | { kind: typeof ControlPlaneScopeKind.Hat; hatId: string }
  | { kind: typeof ControlPlaneScopeKind.Provider; providerId: string };

export type ControlPlaneFlag = {
  controlPlaneFlagId: string;
  organizationId: string;
  scope: ControlPlaneScope;
  flag: ControlPlaneFlagKind;
  reason: string;
  setByHatId: string;
  setAt: string;
  expiresAt?: string | undefined;
};

export type ControlPlaneBoundary =
  | "observe"
  | "act"
  | "command_dispatch"
  | "mcp_dispatch"
  | "org_event_append"
  | "release_application"
  | "reaction_plan_execution"
  | "optimizer_rollout"
  | "cadence_tick_start";

export type ControlPlaneUsage = {
  tokenCost?: number | undefined;
  toolCallCost?: number | undefined;
  modelCallCost?: number | undefined;
  externalProviderCallCost?: number | undefined;
  releaseActionCost?: number | undefined;
  secretScopes?: readonly string[] | undefined;
};

export type ControlPlaneBudgetKind =
  | "tokens"
  | "tools"
  | "model_calls"
  | "external_provider_calls"
  | "release_actions";

export type ControlPlaneBudgetCeiling = {
  kind: ControlPlaneBudgetKind;
  limit: number;
  used: number;
  requested?: number | undefined;
};

export const ControlPlaneRateLimitKind = {
  Tokens: "tokens",
  Tools: "tools",
  ModelCalls: "model_calls",
  ExternalProviderCalls: "external_provider_calls",
  ReleaseActions: "release_actions",
} as const;

export type ControlPlaneRateLimitKind =
  (typeof ControlPlaneRateLimitKind)[keyof typeof ControlPlaneRateLimitKind];

export type ControlPlaneRateLimit = {
  rateLimitId: string;
  organizationId: string;
  scope: ControlPlaneScope;
  kind: ControlPlaneRateLimitKind;
  window: { startedAt: string; endsAt: string };
  limit: number;
  used: number;
  requested?: number | undefined;
};

export type ControlPlaneDenialReason =
  | "estop"
  | "organization_freeze"
  | "tenant_freeze"
  | "hat_freeze"
  | "provider_freeze"
  | "budget_ceiling"
  | "rate_limit_exceeded"
  | "secret_scope_unavailable"
  | "simulator_required";

export type ControlPlaneAudit = {
  exempted: boolean;
  matchedFlagIds: readonly string[];
  matchedRateLimitIds: readonly string[];
  reasonCodes: readonly ControlPlaneDenialReason[];
};

export type ControlPlaneAccessDecision =
  | { status: "allowed"; audit: ControlPlaneAudit }
  | { status: "denied"; reasonCodes: readonly ControlPlaneDenialReason[]; message: string; audit: ControlPlaneAudit };

export type EvaluateControlPlaneAccessInput = {
  organizationId: string;
  actorHatId?: string | undefined;
  tenantId?: string | undefined;
  providerId?: string | undefined;
  boundary: ControlPlaneBoundary;
  actionType: string;
  evaluatedAt: string;
  flags: readonly ControlPlaneFlag[];
  budgets?: readonly ControlPlaneBudgetCeiling[] | undefined;
  rateLimits?: readonly ControlPlaneRateLimit[] | undefined;
  usage?: ControlPlaneUsage | undefined;
  availableSecretScopes?: readonly string[] | undefined;
  isControlPlaneExempt?: boolean | undefined;
};

export function evaluateControlPlaneAccess(input: EvaluateControlPlaneAccessInput): ControlPlaneAccessDecision {
  const matchedFlags = activeMatchingFlags(input);
  const matchedRateLimits = exhaustedMatchingRateLimits(input);
  const flagReasons = collectFlagReasons(input, matchedFlags);
  const budgetReasons = budgetCeilingExceeded(input.budgets ?? [], input.usage) ? ["budget_ceiling" as const] : [];
  const rateLimitReasons = matchedRateLimits.length > 0 ? ["rate_limit_exceeded" as const] : [];
  const secretReasons = missingSecretScopes(input.usage, input.availableSecretScopes)
    ? ["secret_scope_unavailable" as const]
    : [];
  const reasonCodes = orderedUniqueReasons([
    ...flagReasons.map((entry) => entry.reason),
    ...budgetReasons,
    ...rateLimitReasons,
    ...secretReasons,
  ]);
  const audit = {
    exempted: input.isControlPlaneExempt === true,
    matchedFlagIds: matchedFlags.map((flag) => flag.controlPlaneFlagId),
    matchedRateLimitIds: matchedRateLimits.map((limit) => limit.rateLimitId),
    reasonCodes,
  } satisfies ControlPlaneAudit;

  if (input.isControlPlaneExempt === true || reasonCodes.length === 0) {
    return { status: "allowed", audit };
  }

  return {
    status: "denied",
    reasonCodes,
    message: createControlPlaneDenialMessage(input, reasonCodes, matchedFlags),
    audit,
  };
}

export type CreateControlPlaneDeterministicRuleInput = Omit<
  EvaluateControlPlaneAccessInput,
  "actionType" | "usage"
> & {
  usageForOption?: ((option: AvailableOption) => ControlPlaneUsage | undefined) | undefined;
};

export function createControlPlaneDeterministicRule(
  input: CreateControlPlaneDeterministicRuleInput,
): DeterministicRule {
  return {
    name: "control-plane",
    veto: (option, snapshot) => {
      const decision = evaluateControlPlaneAccess({
        ...input,
        organizationId: input.organizationId,
        actorHatId: input.actorHatId ?? ("hatId" in snapshot ? String(snapshot.hatId) : undefined),
        actionType: option.actionType,
        usage: input.usageForOption?.(option),
      });

      return decision.status === "denied" ? decision.message : undefined;
    },
  };
}

export type CreateControlPlaneSlotAuthorizerInput = Omit<EvaluateControlPlaneAccessInput, "actionType" | "usage"> & {
  usageForSlot?: ((slot: Menu16Slot) => ControlPlaneUsage | undefined) | undefined;
};

export function createControlPlaneSlotAuthorizer(
  input: CreateControlPlaneSlotAuthorizerInput,
): (slot: Menu16Slot) => Promise<SlotAuthorizationDecision> {
  return async (slot) => {
    const decision = evaluateControlPlaneAccess({
      ...input,
      actionType: slot.action?.actionType ?? slot.label,
      usage: mergeControlPlaneUsage(input.usageForSlot?.(slot), controlPlaneUsageForSlot(slot)),
    });

    return decision.status === "allowed"
      ? { status: "allowed" }
      : { status: "denied", reason: "control_plane_denied", message: decision.message };
  };
}

function mergeControlPlaneUsage(
  callerUsage: ControlPlaneUsage | undefined,
  slotUsage: ControlPlaneUsage | undefined,
): ControlPlaneUsage | undefined {
  if (callerUsage === undefined) return slotUsage;
  if (slotUsage === undefined) return callerUsage;
  return {
    ...slotUsage,
    ...callerUsage,
    secretScopes: uniqueStrings([
      ...(callerUsage.secretScopes ?? []),
      ...(slotUsage.secretScopes ?? []),
    ]),
  };
}

function controlPlaneUsageForSlot(slot: Menu16Slot): ControlPlaneUsage | undefined {
  const secretScopes = uniqueStrings(secretScopesForSlot(slot));
  return secretScopes.length === 0 ? undefined : { secretScopes };
}

function secretScopesForSlot(slot: Menu16Slot): readonly string[] {
  if (slot.impl?.kind === "mcp") {
    return slot.impl.requiredSecretScopes ?? [];
  }
  if (slot.impl?.kind === "prompt_flow") {
    return slot.impl.request.toolInjections.flatMap((injection) => injection.requiredSecretScopes ?? []);
  }
  return [];
}

function activeMatchingFlags(input: EvaluateControlPlaneAccessInput): readonly ControlPlaneFlag[] {
  return input.flags.filter((flag) =>
    flag.organizationId === input.organizationId &&
    isActive(flag, input.evaluatedAt) &&
    flagMatchesScope(flag, input)
  );
}

function isActive(flag: ControlPlaneFlag, evaluatedAt: string): boolean {
  return flag.expiresAt === undefined || flag.expiresAt > evaluatedAt;
}

function flagMatchesScope(flag: ControlPlaneFlag, input: EvaluateControlPlaneAccessInput): boolean {
  return scopeMatchesInput(flag.scope, input);
}

function scopeMatchesInput(scope: ControlPlaneScope, input: EvaluateControlPlaneAccessInput): boolean {
  if (scope.kind === ControlPlaneScopeKind.Organization) return true;

  if (scope.kind === ControlPlaneScopeKind.Tenant) {
    return scope.tenantId === (input.tenantId ?? input.organizationId);
  }

  if (scope.kind === ControlPlaneScopeKind.Hat) {
    return input.actorHatId !== undefined && scope.hatId === input.actorHatId;
  }

  return input.providerId !== undefined && scope.providerId === input.providerId;
}

function collectFlagReasons(
  input: EvaluateControlPlaneAccessInput,
  flags: readonly ControlPlaneFlag[],
): readonly { flag: ControlPlaneFlag; reason: ControlPlaneDenialReason }[] {
  return flags.flatMap((flag): readonly { flag: ControlPlaneFlag; reason: ControlPlaneDenialReason }[] => {
    if (flag.flag === ControlPlaneFlagKind.Estop && flag.scope.kind === ControlPlaneScopeKind.Organization) {
      return [{ flag, reason: "estop" as const }];
    }

    if (flag.flag === ControlPlaneFlagKind.Freeze) {
      if (flag.scope.kind === ControlPlaneScopeKind.Organization) return [{ flag, reason: "organization_freeze" as const }];
      if (flag.scope.kind === ControlPlaneScopeKind.Tenant) return [{ flag, reason: "tenant_freeze" as const }];
      if (flag.scope.kind === ControlPlaneScopeKind.Hat) return [{ flag, reason: "hat_freeze" as const }];
    }

    if (
      flag.flag === ControlPlaneFlagKind.ProviderFreeze &&
      flag.scope.kind === ControlPlaneScopeKind.Provider &&
      input.providerId === flag.scope.providerId
    ) {
      return [{ flag, reason: "provider_freeze" as const }];
    }

    if (flag.flag === ControlPlaneFlagKind.BudgetFreeze) return [{ flag, reason: "budget_ceiling" as const }];
    if (flag.flag === ControlPlaneFlagKind.SimulatorRequired) return [{ flag, reason: "simulator_required" as const }];
    return [];
  });
}

function budgetCeilingExceeded(
  budgets: readonly ControlPlaneBudgetCeiling[],
  usage: ControlPlaneUsage | undefined,
): boolean {
  return budgets.some((budget) => budget.used + (budget.requested ?? usageCostForBudget(budget.kind, usage)) > budget.limit);
}

function usageCostForBudget(kind: ControlPlaneBudgetKind, usage: ControlPlaneUsage | undefined): number {
  if (usage === undefined) return 0;
  if (kind === "tokens") return usage.tokenCost ?? 0;
  if (kind === "tools") return usage.toolCallCost ?? 0;
  if (kind === "model_calls") return usage.modelCallCost ?? 0;
  if (kind === "external_provider_calls") return usage.externalProviderCallCost ?? 0;
  return usage.releaseActionCost ?? 0;
}

function exhaustedMatchingRateLimits(input: EvaluateControlPlaneAccessInput): readonly ControlPlaneRateLimit[] {
  return (input.rateLimits ?? []).filter((limit) =>
    limit.organizationId === input.organizationId &&
    scopeMatchesInput(limit.scope, input) &&
    limit.window.startedAt <= input.evaluatedAt &&
    input.evaluatedAt < limit.window.endsAt &&
    limit.used + (limit.requested ?? usageCostForRateLimit(limit.kind, input.usage)) > limit.limit
  );
}

function usageCostForRateLimit(kind: ControlPlaneRateLimitKind, usage: ControlPlaneUsage | undefined): number {
  return usageCostForBudget(kind, usage);
}

function missingSecretScopes(
  usage: ControlPlaneUsage | undefined,
  availableSecretScopes: readonly string[] | undefined,
): boolean {
  if (usage?.secretScopes === undefined || usage.secretScopes.length === 0) return false;
  const available = new Set(availableSecretScopes ?? []);
  return usage.secretScopes.some((scope) => !available.has(scope));
}

const DenialPriority: readonly ControlPlaneDenialReason[] = [
  "estop",
  "organization_freeze",
  "tenant_freeze",
  "hat_freeze",
  "provider_freeze",
  "budget_ceiling",
  "rate_limit_exceeded",
  "secret_scope_unavailable",
  "simulator_required",
];

function orderedUniqueReasons(reasons: readonly ControlPlaneDenialReason[]): readonly ControlPlaneDenialReason[] {
  const reasonSet = new Set(reasons);
  return DenialPriority.filter((reason) => reasonSet.has(reason));
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function createControlPlaneDenialMessage(
  input: EvaluateControlPlaneAccessInput,
  reasonCodes: readonly ControlPlaneDenialReason[],
  flags: readonly ControlPlaneFlag[],
): string {
  const flagReasons = flags.map((flag) => flag.reason).filter((reason) => reason.trim().length > 0);
  const suffix = flagReasons.length > 0 ? `: ${flagReasons.join("; ")}` : "";
  return `control-plane denied ${input.boundary}/${input.actionType} (${reasonCodes.join(", ")})${suffix}`;
}
