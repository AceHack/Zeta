/**
 * Our from-scratch online-learning model — another Harny model, not a vendor LLM.
 *
 * Vendor adapters (`openAiCompatBackend`, device-code logins) stay for grok /
 * claude / openai / … This is the local inference cell we already have:
 * `MinimalBnn` (F#, Gaussian factor-graph, online IV) and `student-t-bnn.ts`
 * (ADF / Minka 2001). It supports **online learning** (`update` is a +1 absorb).
 * It is **not** chat-completions and it is **not** a login-provider roster row
 * (those are paid accounts). Retracting an observation is a generator-reinterpret
 * of the evidence set; EP/ADF re-normalisation is not Z-set minus (see
 * `FourCornerTrace` honesty — inverse-free corners do not instantiate the trace).
 *
 * Clifford / C₄: the +1/−1 ping-return on the ℤ ring is the same *shape* as
 * generators squaring to ±1; that is "consistent with", not an identification.
 */

export const OWN_MODEL = {
  id: "zeta-bnn",
  displayName: "Zeta BNN (online)",
  kind: "online-learner",
  execution: "local",
  chatCompletions: false,
  surfaces: {
    fsharpMinimal: "src/Bayesian/MinimalBnn.fs",
    fsharpFactorGraph: "src/Bayesian/FactorGraph.fs",
    fsharpMultilayer: "src/Bayesian/MultilayerBnn.fs",
    tsStudentT: "src/Core.TypeScript/planning/student-t-bnn.ts",
    tsSociety: "src/Core.TypeScript/bayesian/bnn-key-predictor.ts",
  },
  notes:
    "Online +1 absorb of observations. Plug in as a DU chooser (ActionGrid / NextAction), not as a chat vendor.",
} as const;

export type OwnModel = typeof OWN_MODEL;
