const fs = require('fs');
const file = 'src/Core.TypeScript/observe/observe.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /export async function observeWithLlm\(world: World, backend: ModelBackend\): Promise<NextAction> \{/,
  'export async function observeWithLlm(world: World, backend: ModelBackend, instructionOverride?: string): Promise<NextAction> {'
);

data = data.replace(
  /instruction: CHOOSER_INSTRUCTION,/,
  'instruction: instructionOverride ?? CHOOSER_INSTRUCTION,'
);

fs.writeFileSync(file, data);
