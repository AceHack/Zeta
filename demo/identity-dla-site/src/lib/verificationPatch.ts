import { isCommitSha } from "./passkeyProposal";

export const AUTOMATIC_VERIFICATION_PATH = "docs/automation/pages-operator-capability-verification.md";

export type QueueEnablement = {
  readonly capability: unknown;
  readonly registrySequence: number | null;
  readonly baseSha: string;
};

/**
 * Generated "queue harmless verification" is clickable after device authorize.
 * It must not wait on the advanced textarea — authorize never writes a payload.
 */
export function canQueueGeneratedVerification(input: QueueEnablement): boolean {
  return Boolean(input.capability) && input.registrySequence !== null && isCommitSha(input.baseSha);
}

/**
 * "queue supplied proposal" stays gated on a non-empty exact patch.
 * payload.trim() belongs here only.
 */
export function canQueueSuppliedProposal(input: QueueEnablement & { readonly payload: string }): boolean {
  return canQueueGeneratedVerification(input) && input.payload.trim().length > 0;
}

export async function queueHarmlessVerification(input: {
  readonly baseSha: string;
  readonly submit: (payload: string) => Promise<void> | void;
}): Promise<string> {
  const generated = createAutomaticVerificationPatch(input.baseSha);
  await input.submit(generated);
  return generated;
}

export function createAutomaticVerificationPatch(baseSha: string): string {
  if (!isCommitSha(baseSha)) throw new Error("verification proposals require a 40-character immutable base SHA");
  const lines = [
    "# Pages Operator Capability Verification",
    "",
    "This file records one bounded end-to-end Pages capability delivery test.",
    "",
    `- Immutable base: \`${baseSha.toLowerCase()}\``,
    "- Delivery: local Pages capability → verifier → scoped Action → gated review branch.",
    "- Direct writes to `main`: prohibited.",
  ];
  return [
    `diff --git a/${AUTOMATIC_VERIFICATION_PATH} b/${AUTOMATIC_VERIFICATION_PATH}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${AUTOMATIC_VERIFICATION_PATH}`,
    `@@ -0,0 +1,${lines.length.toString()} @@`,
    ...lines.map((line) => `+${line}`),
    "",
  ].join("\n");
}
