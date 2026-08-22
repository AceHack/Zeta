import { CHOOSER_INSTRUCTION } from "../observe/observe";

export interface HatDefinition {
  name: string;
  personaName: string;
  instructionModifier: string;
  biasActions: string[];
  capabilities?: string[];
}

export const SWARM_HATS: HatDefinition[] = [
  {
    name: "Cartographer",
    personaName: "lior", // The mapping scout
    instructionModifier: `You are the Cartographer. Your hat is strictly to map the structural search space. You should almost exclusively choose 'navigate_cartography' or 'scope_cartography' unless absolutely necessary. Do not execute commands unless you are forced to. Leave execution to the Pilot.`,
    biasActions: ["navigate_cartography", "scope_cartography", "free_explore"],
  },
  {
    name: "Pilot",
    personaName: "riven", // The executor
    instructionModifier: `You are the Pilot. Your hat is to execute directly on the terrain provided by the Cartographer. Bias heavily toward 'shell_exec', 'file_edit', 'node_repl', 'read_memory_sector' and actual work items. Do not over-explore, let the Cartographer do that.`,
    biasActions: ["shell_exec", "file_edit", "node_repl", "read_memory_sector", "write_memory_sector", "start_backlog_item", "finish_backlog_item"],
    capabilities: ["ram_read_all", "ram_write", "controller_input"],
  },
  {
    name: "Recursive Composer",
    personaName: "codex", // The sieve
    instructionModifier: `You are the Recursive Composer. Your hat is to act as the sieve. When a problem is too big or blocked, you should 'decompose' it or 'drop' unworkable states. If the backlog is well-structured, you can defer to the Pilot.`,
    biasActions: ["decompose", "drop"],
  },
  {
    name: "Chronologist",
    personaName: "otto", // The overwatch
    instructionModifier: `You are the Chronologist. Look at the Event History. If a recent 'do_item' resulted in a severe KPI drop that you believe is a destructive dead-end, you may select 'navigate time backward (undo)'. If you believe the drop is a necessary valley for exploration, select a forward action instead.`,
    biasActions: ["retract_time", "replay_time"],
  }
];

export function buildHatInstruction(hat: HatDefinition): string {
  return `${CHOOSER_INSTRUCTION}\n\n[HAT OVERRIDE]\n${hat.instructionModifier}`;
}
