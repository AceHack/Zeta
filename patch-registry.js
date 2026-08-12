const fs = require('fs');
const file = 'src/Core.TypeScript/service/persona-registry.ts';
let data = fs.readFileSync(file, 'utf8');

// 1. Update PersonaConfig interface
data = data.replace(
  /readonly defaultRef: string;\n  \/\*\* The persona's preferred model/,
  'readonly defaultRef: string;\n  /** Git author name for substrate-honest attribution (e.g. "Otto") */\n  readonly gitAuthorName?: string;\n  /** Git author email for substrate-honest attribution (e.g. "otto@zeta.lucent-financial-group.com") */\n  readonly gitAuthorEmail?: string;\n  /** The persona\'s preferred model'
);

// 2. Update all the personas in PERSONAS array
const updatePersona = (name, Title) => {
  const re = new RegExp(`name: "${name}", label: "com.lucent.zeta.${name}-loop",\\n    scheduleInterval: (\\d+), gateInterval: (\\d+), gateTimeout: (\\d+), defaultRef: "([^"]+)",`);
  data = data.replace(re, `name: "${name}", label: "com.lucent.zeta.${name}-loop",\n    scheduleInterval: $1, gateInterval: $2, gateTimeout: $3, defaultRef: "$4",\n    gitAuthorName: "${Title}", gitAuthorEmail: "${name}@zeta.lucent-financial-group.com",`);
};

updatePersona('otto', 'Otto');
updatePersona('kiro', 'Kiro');
updatePersona('codex', 'Codex');
updatePersona('riven', 'Riven');
updatePersona('soraya', 'Soraya');
updatePersona('lior', 'Lior');
updatePersona('tariq', 'Tariq');

fs.writeFileSync(file, data);
