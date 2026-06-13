/**
 * AI-attribution footer for agent-posted GitHub comments.
 *
 * B-0126 Layer 4: when an AI agent posts a PR/issue comment via
 * `gh api` under a human's PAT identity, append a footer so readers
 * know the comment was agent-authored.
 */

const SEPARATOR = "\n\n---\n";

export interface AttributionOptions {
  /** Agent or tool name, e.g. "Claude Code", "batch-resolve-pr-threads" */
  readonly agent: string;
  /** GitHub username the PAT belongs to. Omit if running under a bot token. */
  readonly onBehalfOf?: string;
}

export function aiAttributionFooter(opts: AttributionOptions): string {
  const who = opts.onBehalfOf
    ? ` on behalf of @${opts.onBehalfOf}`
    : "";
  return `${SEPARATOR}🤖 *Posted by ${opts.agent}${who}*`;
}

export function appendAttribution(
  body: string,
  opts: AttributionOptions,
): string {
  return `${body}${aiAttributionFooter(opts)}`;
}
