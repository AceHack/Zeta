import type {
  Clock,
  CommandEffects,
  ContextPackInboxAnchorStateReaderPort,
  DiscussionAnchorStateReaderPort,
  HatAssignmentAuthorityReaderPort,
  IdGenerator,
  QualityGateEvaluationStateReaderPort,
  SupervisorSignalStateReaderPort,
  WorkAnchorStateReaderPort,
} from "./ports.ts";

export type TypedCommand = {
  type: string;
};

export type CommandHandlerOutcome<Result = unknown> = {
  result: Result;
  effects: CommandEffects;
};

export type CommandExecutionContext = Clock &
  IdGenerator & {
    contextPackInboxAnchorStateReader?: ContextPackInboxAnchorStateReaderPort | undefined;
    discussionAnchorStateReader?: DiscussionAnchorStateReaderPort | undefined;
    hatAssignmentAuthorityReader?: HatAssignmentAuthorityReaderPort | undefined;
    qualityGateEvaluationStateReader?: QualityGateEvaluationStateReaderPort | undefined;
    supervisorSignalStateReader?: SupervisorSignalStateReaderPort | undefined;
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export type CommandHandler<Command extends TypedCommand = TypedCommand, Result = unknown> = {
  commandType: Command["type"];
  execute: (command: Command, context: CommandExecutionContext) => Promise<CommandHandlerOutcome<Result>>;
};

export type CommandHandlerRegistry<Command extends TypedCommand = TypedCommand, Result = unknown> = {
  resolveHandler: (commandType: Command["type"]) => CommandHandler<Command, Result> | undefined;
};

export type AnyCommandHandler<Command extends TypedCommand = TypedCommand, Result = unknown> = {
  [CommandType in Command["type"]]: CommandHandler<Extract<Command, { type: CommandType }>, Result>;
}[Command["type"]];

export function createCommandHandlerRegistry<Command extends TypedCommand, Result>(
  handlers: readonly AnyCommandHandler<Command, Result>[],
): CommandHandlerRegistry<Command, Result> {
  const handlersByCommandType = new Map<Command["type"], AnyCommandHandler<Command, Result>>();

  for (const handler of handlers) {
    if (handlersByCommandType.has(handler.commandType)) {
      throw new Error(`duplicate command handler for ${handler.commandType}`);
    }

    handlersByCommandType.set(handler.commandType, handler);
  }

  return {
    resolveHandler: (commandType) => handlersByCommandType.get(commandType) as CommandHandler<Command, Result> | undefined,
  };
}
