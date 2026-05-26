import type { AgenticEventType } from "../../domain/src/index.ts";

export const AgenticSubjectPrefix = {
  Root: "agentic-org",
} as const;

export type AgenticSubjectPrefix = (typeof AgenticSubjectPrefix)[keyof typeof AgenticSubjectPrefix];

export type AgenticEventSubjectInput = {
  environment: string;
  organizationId: string;
  domain: string;
  eventType: AgenticEventType;
};

export function buildAgenticEventSubject(input: AgenticEventSubjectInput): string {
  const segments = [
    AgenticSubjectPrefix.Root,
    input.environment,
    input.organizationId,
    input.domain,
    buildDomainRelativeEventName(input.domain, input.eventType),
  ];

  for (const segment of segments) {
    assertSubjectSegment(segment);
  }

  return segments.join(".");
}

function buildDomainRelativeEventName(domain: string, eventType: AgenticEventType): string {
  const domainPrefix = `${domain}.`;

  if (eventType.startsWith(domainPrefix)) {
    return eventType.slice(domainPrefix.length);
  }

  return eventType;
}

function assertSubjectSegment(segment: string): void {
  if (!/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(segment)) {
    throw new Error(`invalid NATS subject segment: ${segment}`);
  }
}
