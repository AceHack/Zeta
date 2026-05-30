/**
 * HatDefinition — a hat is a persistent role: a bundle of authority, skills,
 * tools, scopes, supervisor-graph position, lifecycle timing, and succession
 * rules (DEPARTMENT_HAT_TOOL_INVENTORY.md + CLUSTER_NATIVE_HAT_SYSTEM.md).
 * Agents wear hats temporarily; the hat persists.
 *
 * The supervisor graph (`supervisesHatIds` / `reportsToHatIds`) is a DAG and is
 * validated acyclic at seed time.
 */

import type { DepartmentId } from "./department.ts";

/** The hierarchy tier — Executive Board → C-suite → Director → Manager → Lead → IC. */
export const HatLevel = {
  ExecutiveBoard: "executive_board",
  CSuite: "c_suite",
  Director: "director",
  Manager: "manager",
  Lead: "lead",
  IndividualContributor: "individual_contributor",
} as const;

export type HatLevel = (typeof HatLevel)[keyof typeof HatLevel];

/** Reusable MCP tool bundles (DEPARTMENT_HAT_TOOL_INVENTORY.md §Tool Bundles). */
export const ToolBundle = {
  GoalIntake: "goal_intake",
  Project: "project",
  PortfolioAndInitiative: "portfolio_and_initiative",
  HatAuthorization: "hat_authorization",
  AgentInsight: "agent_insight",
  Voting: "voting",
  TeamRuntime: "team_runtime",
  WorkRhythm: "work_rhythm",
  PromptFlow: "prompt_flow",
  UniversalActionGrammar: "universal_action_grammar",
  Task: "task",
  BacklogAndDefect: "backlog_and_defect",
  Messaging: "messaging",
  Meeting: "meeting",
  ArtifactAndEvidence: "artifact_and_evidence",
  Business: "business",
  Architecture: "architecture",
  ReviewAndGates: "review_and_gates",
  Memory: "memory",
  CredentialProxy: "credential_proxy",
  Qa: "qa",
  DevOps: "devops",
  Delivery: "delivery",
  Status: "status",
  Observability: "observability",
  AlwaysOnRuntime: "always_on_runtime",
  ScheduledReviews: "scheduled_reviews",
  DocumentationContext: "documentation_context",
  ProjectSkills: "project_skills",
  CapabilityExpansion: "capability_expansion",
  TemporalWorkflowRegistry: "temporal_workflow_registry",
  DaprActorRegistry: "dapr_actor_registry",
  NatsAndDlqOperations: "nats_and_dlq_operations",
  OzAndHermesRuntime: "oz_and_hermes_runtime",
  HumanOverride: "human_override",
} as const;

export type ToolBundle = (typeof ToolBundle)[keyof typeof ToolBundle];

/** How the next wearer of a hat is chosen when a binding ends. */
export const SuccessionPolicy = {
  Rotate: "rotate",
  Renew: "renew",
  Election: "election",
  DirectorAssigned: "director_assigned",
  ExecutiveVote: "executive_vote",
} as const;

export type SuccessionPolicy = (typeof SuccessionPolicy)[keyof typeof SuccessionPolicy];

export const RiskLevel = {
  Low: "low",
  Medium: "medium",
  High: "high",
  Critical: "critical",
} as const;

export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

/** Reputation accrues on the hat AND the pairings — never only the agent. */
export const ReputationScope = {
  Hat: "hat",
  AgentHat: "agent_hat",
  DepartmentHat: "department_hat",
  ProjectHat: "project_hat",
} as const;

export type ReputationScope = (typeof ReputationScope)[keyof typeof ReputationScope];

export type HatDefinition = {
  id: string;
  name: string;
  departmentId: DepartmentId;
  level: HatLevel;
  /** supervisor-graph edges (DAG): the hats this hat supervises and reports to */
  supervisesHatIds: readonly string[];
  reportsToHatIds: readonly string[];
  /** hats that cannot be co-held by the same wearer in overlapping scope */
  conflictsWithHatIds: readonly string[];
  /** hats with authority to assign this hat (empty → only by approved policy/executive) */
  assignableByHatIds: readonly string[];
  allowedToolBundles: readonly ToolBundle[];
  skills: readonly string[];
  approvalScopes: readonly string[];
  votingScopes: readonly string[];
  memoryScopes: readonly string[];
  credentialScopes: readonly string[];
  documentationScopes: readonly string[];
  /** work-item / gate transitions this hat may drive */
  lifecycleTransitions: readonly string[];
  requiredEvidence: readonly string[];
  maxConcurrentAssignments: number;
  tokenTtlSeconds: number;
  warmupSeconds: number;
  cooldownSeconds: number;
  successionPolicy: SuccessionPolicy;
  stickyAttribution: boolean;
  quorumSize?: number;
  reputationScope: readonly ReputationScope[];
  riskLevel: RiskLevel;
  requiresTwoPersonApproval: boolean;
  requiresHumanApproval: boolean;
};
