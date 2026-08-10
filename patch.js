const fs = require('fs');
const file = 'src/Core.TypeScript/observe/observe.ts';
let data = fs.readFileSync(file, 'utf8');

// 1. Add cartography/time to World
data = data.replace(
  /readonly nodeSession\?: NodeSessionState;\n}/,
  'readonly nodeSession?: NodeSessionState;\n  /** Cartography state: current spatial focus and time-resolution. */\n  readonly cartography?: { readonly focusId?: string; readonly scopeLevel: number; readonly timeOffset: number };\n}'
);

// 2. Add to NextAction
data = data.replace(
  /  \| \{ kind: "edit_grammar"; reason: string; item\?: BacklogItem \};/,
  '  | { kind: "edit_grammar"; reason: string; item?: BacklogItem }\n  | { kind: "navigate_cartography"; direction: "up" | "down" | "left" | "right"; reason: string } // D-pad space navigation\n  | { kind: "scope_cartography"; direction: "in" | "out"; reason: string } // Bumper resolution zoom\n  | { kind: "retract_time"; reason: string } // Undo/retract event (LT)\n  | { kind: "replay_time"; reason: string }; // Redo/replay event (RT)'
);

// 3. Add to renderAction
data = data.replace(
  /    case "edit_grammar":\n      return `\[edit\]      \$\{a.reason\}`;\n  \}/,
  '    case "edit_grammar":\n      return `[edit]      ${a.reason}`;\n    case "navigate_cartography":\n      return `[navigate]  ${a.direction} — ${a.reason}`;\n    case "scope_cartography":\n      return `[scope]     ${a.direction} — ${a.reason}`;\n    case "retract_time":\n      return `[retract]   ${a.reason}`;\n    case "replay_time":\n      return `[replay]    ${a.reason}`;\n  }'
);

// 4. Add to actionLabel
data = data.replace(
  /    case "edit_grammar":\n      return `edit the action grammar \(\$\{a.reason\}\)`;\n  \}/,
  '    case "edit_grammar":\n      return `edit the action grammar (${a.reason})`;\n    case "navigate_cartography":\n      return `navigate cartography space ${a.direction} (${a.reason})`;\n    case "scope_cartography":\n      return `change resolution / scope ${a.direction} (${a.reason})`;\n    case "retract_time":\n      return `retract / undo back in time (${a.reason})`;\n    case "replay_time":\n      return `replay / redo forward in time (${a.reason})`;\n  }'
);

// 5. Add to buildMenu (offer these options always like free modes, since it's navigating the world)
data = data.replace(
  /    \{ kind: "free_time", reason: FREE_TIME_REASON \},\n  \);/,
  '    { kind: "free_time", reason: FREE_TIME_REASON },\n    // Cartography & Time navigation are freely available to change resolution or search space\n    { kind: "navigate_cartography", direction: "up", reason: "navigate search space up/category" },\n    { kind: "navigate_cartography", direction: "down", reason: "navigate search space down/category" },\n    { kind: "navigate_cartography", direction: "left", reason: "navigate search space left/sibling" },\n    { kind: "navigate_cartography", direction: "right", reason: "navigate search space right/sibling" },\n    { kind: "scope_cartography", direction: "in", reason: "improve resolution / finer view" },\n    { kind: "scope_cartography", direction: "out", reason: "coarser view / parent scope" },\n    { kind: "retract_time", reason: "navigate time backward (undo)" },\n    { kind: "replay_time", reason: "navigate time forward (redo)" },\n  );'
);

// 6. Update simulate to handle state mutations
const simulateAdditions = `
    case "navigate_cartography":
      return { ...world, cartography: { ...world.cartography, scopeLevel: world.cartography?.scopeLevel ?? 0, timeOffset: world.cartography?.timeOffset ?? 0 } };
    case "scope_cartography":
      return { 
        ...world, 
        cartography: { 
          ...world.cartography, 
          scopeLevel: (world.cartography?.scopeLevel ?? 0) + (action.direction === "in" ? 1 : -1),
          timeOffset: world.cartography?.timeOffset ?? 0 
        } 
      };
    case "retract_time":
      return { 
        ...world, 
        cartography: { 
          ...world.cartography, 
          scopeLevel: world.cartography?.scopeLevel ?? 0,
          timeOffset: (world.cartography?.timeOffset ?? 0) - 1 
        } 
      };
    case "replay_time":
      return { 
        ...world, 
        cartography: { 
          ...world.cartography, 
          scopeLevel: world.cartography?.scopeLevel ?? 0,
          timeOffset: (world.cartography?.timeOffset ?? 0) + 1 
        } 
      };`;

data = data.replace(
  /    case "free_time":\n      return \{ \.\.\.world, mode: "free_time" \};\n  \}/,
  '    case "free_time":\n      return { ...world, mode: "free_time" };' + simulateAdditions + '\n  }'
);

fs.writeFileSync(file, data);
