import type { Clock, CommandStateStore, IdGenerator } from "./ports.ts";

export type TypedCommand = {
  type: string;
};

export type CommandExecutionContext<Result = unknown> = Clock &
  IdGenerator & {
    store: CommandStateStore<Result>;
  };

export type CommandHandler<Command extends TypedCommand = TypedCommand, Result = unknown> = {
  commandType: Command["type"];
  execute: (command: Command, context: CommandExecutionContext<Result>) => Promise<Result>;
};

export type CommandHandlerRegistry<Command extends TypedCommand = TypedCommand, Result = unknown> = {
  resolveHandler: (commandType: Command["type"]) => CommandHandler<Command, Result> | undefined;
};

export function createCommandHandlerRegistry<Command extends TypedCommand, Result>(
  handlers: readonly CommandHandler<Command, Result>[],
): CommandHandlerRegistry<Command, Result> {
  const handlersByCommandType = new Map<Command["type"], CommandHandler<Command, Result>>();

  for (const handler of handlers) {
    if (handlersByCommandType.has(handler.commandType)) {
      throw new Error(`duplicate command handler for ${handler.commandType}`);
    }

    handlersByCommandType.set(handler.commandType, handler);
  }

  return {
    resolveHandler: (commandType) => handlersByCommandType.get(commandType),
  };
}
