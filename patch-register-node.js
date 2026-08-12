const fs = require('fs');
const file = 'src/Core.TypeScript/cluster/register-node.ts';
let data = fs.readFileSync(file, 'utf8');

// Replace deregister to register globally
data = data.replace(/deregister-node\.ts/g, 'register-node.ts');
data = data.replace(/deregister/g, 'register');
data = data.replace(/Deregister/g, 'Register');

// Change behavior: we want to create a node.yaml, not git rm
// Step 2: instead of nodeExistsOnMain returning true to exit, we want it to exit if it EXISTS (or maybe allow overwrite, but let's say "register" overwrites).
data = data.replace(
  /if \(\!nodeExistsOnMain\(maintainer, host\)\) \{\n    process\.stderr\.write\(\n      \`register-node: maintainers\/\$\{maintainer\}\/cluster-nodes\/\$\{host\}\/ not found on origin\/main; \` \+\n        \`nothing to register\.\\n\`,\n    \);\n    return 2;\n  \}/,
  ''
);

// We need to import `mkdirSync, writeFileSync`
data = data.replace(/import { mkdtempSync, rmSync } from "node:fs";/, 'import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";');
data = data.replace(/import { spawnSync } from "node:child_process";/, 'import { spawnSync, execFileSync } from "node:child_process";');

// Step 5: Instead of `git rm`, we want to create the directory and `node.yaml`
const injectYaml = `
  // Step 5: Generate and write node.yaml
  const dir = \`maintainers/\${maintainer}/cluster-nodes/\${host}\`;
  const absDir = join(wt, dir);
  mkdirSync(absDir, { recursive: true });

  // Gather basic hardware info (simplified version if zeta-hardware-detect is not run natively)
  let gpu = "none";
  let cpu = "unknown";
  let memory = "unknown";
  try {
     const lspci = spawnSync("lspci", [], {encoding: "utf8"});
     if (lspci.stdout) {
         if (lspci.stdout.toLowerCase().match(/(vga|3d|display).*nvidia/)) gpu = "nvidia";
         else if (lspci.stdout.toLowerCase().match(/(vga|3d|display).*(amd|advanced micro devices)/)) gpu = "amd";
         else if (lspci.stdout.toLowerCase().match(/(vga|3d|display).*intel.*arc/)) gpu = "intel-arc";
     }
  } catch(e) {}
  
  const isoTime = new Date().toISOString();
  const yaml = \`apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: \${host}
  namespace: zeta-cluster
  annotations:
    zeta.lucent-financial-group.com/registered-at: "\${isoTime}"
    zeta.lucent-financial-group.com/registered-via: "register-node.ts-cli"
  labels:
    zeta.lucent-financial-group.com/maintainer: "\${maintainer}"
spec:
  hostname: \${host}
  registration:
    maintainer: \${maintainer}
    timestamp: "\${isoTime}"
    via: register-node.ts-cli
  hardware:
    cpu: "\${cpu}"
    memory: "\${memory}"
    gpu: "\${gpu}"
\`;

  writeFileSync(join(absDir, "node.yaml"), yaml);

  const add = run("git", ["add", dir], wt);
  if (!add.ok) {
    process.stderr.write(\`register-node: git add failed:\\n\${add.stderr}\\n\`);
    run("git", ["worktree", "remove", "--force", wt]);
    rmSync(wt, { recursive: true, force: true });
    return 3;
  }
`;

data = data.replace(
  /\/\/ Step 5: git rm -r the cluster-nodes\/<host>\/ subtree\n  const dir = `maintainers\/\$\{maintainer\}\/cluster-nodes\/\$\{host\}`;\n  const rm = run\("git", \["rm", "-r", dir\], wt\);\n  if \(\!rm\.ok\) \{\n    process\.stderr\.write\(`register-node: git rm -r \$\{dir\} failed:\\n\$\{rm\.stderr\}\\n`\);\n    run\("git", \["worktree", "remove", "--force", wt\]\);\n    rmSync\(wt, \{ recursive: true, force: true \}\);\n    return 3;\n  \}/,
  injectYaml
);

data = data.replace(/Removes maintainers/g, 'Creates maintainers');
data = data.replace(/Removes `maintainers/g, 'Creates `maintainers');

fs.writeFileSync(file, data);
