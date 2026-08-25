import * as fs from 'fs';
import * as path from 'path';

const MONOREPO_ROOT = path.resolve(__dirname, '../../../..');
console.log(`Analyzing monorepo at: ${MONOREPO_ROOT}`);



const tsImportRegex = /import\s+(?:.*?\s+from\s+)?['"](.*?)['"]/g;
const csProjRefRegex = /<ProjectReference\s+Include=['"](.*?)['"]/g;
const yamlUsesRegex = /uses:\s*['"]?(\.\/.*?)['"]?\s*$/gm;
const yamlRunRegex = /run:\s*['"]?(?:\.\/)?(tools\/.*?|src\/.*?)['"]?\s/gm;

function getBoundary(relPath: string): string | null {
  if (relPath.startsWith('src/Core.TypeScript/ace')) return 'Ace';
  if (relPath.startsWith('src/Core.TypeScript/common')) return 'Common';
  if (relPath.startsWith('tools') || relPath.startsWith('.claude')) return 'Forge';
  if (relPath.startsWith('src')) return 'Zeta';
  if (relPath.startsWith('.github')) return 'GitHubActions';
  return null;
}

function analyzeFile(filePath: string, currentBoundary: string) {
  // One syscall, one answer. An existsSync/readFileSync pair is check-then-use
  // (CWE-367): the path can be created, deleted or replaced between the two, so
  // the check reads as defensive and prevents nothing.
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw e;
  }
  const ext = path.extname(filePath);
  
  if (ext === '.ts' || ext === '.tsx') {
    let match;
    while ((match = tsImportRegex.exec(content)) !== null) {
      const imp = match[1];
      if (!imp) continue;
      if (imp.startsWith('.')) {
        const resolvedPath = path.resolve(path.dirname(filePath), imp);
        const relativeToRoot = path.relative(MONOREPO_ROOT, resolvedPath);
        const targetBoundary = getBoundary(relativeToRoot);
        
        if (targetBoundary && targetBoundary !== currentBoundary) {
          console.warn(`[CROSS-BOUNDARY] ${currentBoundary} -> ${targetBoundary} : ${path.relative(MONOREPO_ROOT, filePath)} imports ${imp}`);
        }
      }
    }
  } else if (ext === '.csproj' || ext === '.fsproj') {
    let match;
    while ((match = csProjRefRegex.exec(content)) !== null) {
      const imp = match[1];
      if (!imp) continue;
      const resolvedPath = path.resolve(path.dirname(filePath), imp);
      const relativeToRoot = path.relative(MONOREPO_ROOT, resolvedPath);
      const targetBoundary = getBoundary(relativeToRoot);
      
      if (targetBoundary && targetBoundary !== currentBoundary) {
        console.warn(`[CROSS-BOUNDARY] ${currentBoundary} -> ${targetBoundary} : ${path.relative(MONOREPO_ROOT, filePath)} references ${imp}`);
      }
    }
  } else if (ext === '.yml' || ext === '.yaml') {
    let match;
    while ((match = yamlUsesRegex.exec(content)) !== null) {
      const imp = match[1];
      if (!imp) continue;
      const resolvedPath = path.resolve(path.dirname(filePath), imp);
      const relativeToRoot = path.relative(MONOREPO_ROOT, resolvedPath);
      const targetBoundary = getBoundary(relativeToRoot);
      if (targetBoundary && targetBoundary !== currentBoundary) {
        console.warn(`[CROSS-BOUNDARY] ${currentBoundary} -> ${targetBoundary} : ${path.relative(MONOREPO_ROOT, filePath)} uses ${imp}`);
      }
    }
    while ((match = yamlRunRegex.exec(content)) !== null) {
      const imp = match[1];
      if (!imp) continue; // e.g. tools/ace
      const targetBoundary = getBoundary(imp);
      if (targetBoundary && targetBoundary !== currentBoundary) {
        console.warn(`[CROSS-BOUNDARY] ${currentBoundary} -> ${targetBoundary} : ${path.relative(MONOREPO_ROOT, filePath)} runs ${imp}`);
      }
    }
  }
}

function walkDir(dir: string) {
  // `withFileTypes` carries each entry's kind along with the listing, so there is
  // no second statSync to race against (readdir-then-stat). ENOENT/ENOTDIR here
  // means the directory went away or was never one — the same answer the old
  // existsSync gate returned, without the window.
  let entries: import('fs').Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return;
    throw e;
  }
  for (const entry of entries) {
    const file = entry.name;
    const fullPath = path.join(dir, file);
    if (entry.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== 'bin' && file !== 'obj' && !file.startsWith('.')) {
        walkDir(fullPath);
      } else if (file === '.github') {
        walkDir(fullPath);
      }
    } else {
      const relPath = path.relative(MONOREPO_ROOT, fullPath);
      const currentBoundary = getBoundary(relPath);
      if (currentBoundary) {
        analyzeFile(fullPath, currentBoundary);
      }
    }
  }
}

console.log("\nStarting Analysis...");
walkDir(path.join(MONOREPO_ROOT, 'src'));
walkDir(path.join(MONOREPO_ROOT, 'tools'));
walkDir(path.join(MONOREPO_ROOT, '.github'));
console.log("\nAnalysis complete.");
