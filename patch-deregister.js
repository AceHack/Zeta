const fs = require('fs');
const file = 'src/Core.TypeScript/cluster/deregister-node.ts';
let data = fs.readFileSync(file, 'utf8');

// We will inject the persona logic right before Step 6: commit
const inject = `
  // Determine author from ZETA_PERSONA if present
  let gitAuthorFlag = null;
  const activePersonaName = process.env.ZETA_PERSONA;
  if (activePersonaName) {
    // We can require the registry here to look up the persona
    try {
      const { getPersona } = require("../service/persona-registry");
      const p = getPersona(activePersonaName);
      if (p && p.gitAuthorName && p.gitAuthorEmail) {
        gitAuthorFlag = \`--author=\${p.gitAuthorName} <\${p.gitAuthorEmail}>\`;
      }
    } catch (e) {
      // ignore
    }
  }

`;

data = data.replace(
  /\/\/ Step 6: commit\n  const commitMsg =/,
  inject + '  // Step 6: commit\n  const commitMsg ='
);

data = data.replace(
  /const commit = run\("git", \["commit", "-m", commitMsg\], wt\);/,
  'const commitArgs = ["commit", "-m", commitMsg];\n  if (gitAuthorFlag) commitArgs.push(gitAuthorFlag);\n  const commit = run("git", commitArgs, wt);'
);

data = data.replace(
  /Co-Authored-By: Claude <noreply@anthropic.com>/,
  'Co-Authored-By: Zeta Universal Grammar <noreply@zeta.lucent-financial-group.com>'
);

fs.writeFileSync(file, data);
