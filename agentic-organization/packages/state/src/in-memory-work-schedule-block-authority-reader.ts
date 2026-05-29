import type {
  WorkScheduleBlockAuthorityLookup,
  WorkScheduleBlockAuthorityReaderPort,
} from "../../application/src/ports.ts";
import { ScheduleBlockState, type WorkScheduleBlock } from "../../domain/src/index.ts";

export type CreateInMemoryWorkScheduleBlockAuthorityReaderInput = {
  getWorkScheduleBlocks: () => readonly WorkScheduleBlock[];
};

export function createInMemoryWorkScheduleBlockAuthorityReader(
  input: CreateInMemoryWorkScheduleBlockAuthorityReaderInput,
): WorkScheduleBlockAuthorityReaderPort {
  return {
    findAuthorizingScheduleBlocks: async (lookup) => findAuthorizingScheduleBlocks(input.getWorkScheduleBlocks(), lookup),
  };
}

function findAuthorizingScheduleBlocks(
  workScheduleBlocks: readonly WorkScheduleBlock[],
  lookup: WorkScheduleBlockAuthorityLookup,
): readonly WorkScheduleBlock[] {
  return workScheduleBlocks.filter((block) => isAuthorizingScheduleBlock(block, lookup)).map(cloneWorkScheduleBlock);
}

function isAuthorizingScheduleBlock(
  block: WorkScheduleBlock,
  lookup: WorkScheduleBlockAuthorityLookup,
): boolean {
  return (
    block.assignedAgentId === lookup.agentId &&
    block.assignedHatAssignmentId === lookup.hatAssignmentId &&
    isAuthorizingScheduleBlockState(block.state) &&
    block.startsAt <= lookup.evaluatedAt &&
    block.endsAt > lookup.evaluatedAt
  );
}

function isAuthorizingScheduleBlockState(state: WorkScheduleBlock["state"]): boolean {
  return state === ScheduleBlockState.Active || state === ScheduleBlockState.Scheduled;
}

function cloneWorkScheduleBlock(block: WorkScheduleBlock): WorkScheduleBlock {
  return {
    ...block,
    scheduledBy: {
      ...block.scheduledBy,
    },
    metadata: {
      ...block.metadata,
    },
  };
}
