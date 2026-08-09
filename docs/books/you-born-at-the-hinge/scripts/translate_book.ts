import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const TARGET_DIR = path.join(__dirname, "..", "site");

const LANGUAGES: Record<string, string> = {
  zh: "Chinese (中文)",
  id: "Indonesian",
  vi: "Vietnamese",
  ko: "Korean",
  th: "Thai",
  ru: "Russian",
  ar: "Arabic",
};

const LANG_HTML_TAGS: Record<string, string> = {
  zh: '<html lang="zh-Hans">',
  id: '<html lang="id">',
  vi: '<html lang="vi">',
  ko: '<html lang="ko">',
  th: '<html lang="th">',
  ru: '<html lang="ru">',
  ar: '<html lang="ar" dir="rtl">',
};

const LANGBAR_MAP: Record<string, [string, string]> = {
  zh: ['<a href="../">中文</a>', '<span class="on">中文</span>'],
  en: ['<span class="on">English</span>', '<a href="../en/">English</a>'],
  id: ['<a href="../id/">Indonesia</a>', '<span class="on">Indonesia</span>'],
  vi: ['<a href="../vi/">Tiếng Việt</a>', '<span class="on">Tiếng Việt</span>'],
  ko: ['<a href="../ko/">한국어</a>', '<span class="on">한국어</span>'],
  th: ['<a href="../th/">ภาษาไทย</a>', '<span class="on">ภาษาไทย</span>'],
  ru: ['<a href="../ru/">Русский</a>', '<span class="on">Русский</span>'],
  ar: ['<a href="../ar/">العربية</a>', '<span class="on">العربية</span>'],
};

const PROMPT_TEMPLATE = (
  langName: string,
  htmlContent: string,
) => `You are an expert, native-level writer and editor in ${langName}.
The following HTML block is a literal translation of a book chapter. 
Your task is to REWRITE the text content within this HTML so that it flows completely naturally for a native ${langName} reader, as if the book were written in ${langName} originally.

CRITICAL RULES:
1. HTML STRUCTURE: You MUST preserve every single HTML tag exactly as it is (e.g., <p class="lead">, <span class="kicker">, <h3>). Do not add, remove, or modify any HTML tags.
2. CONSENT GATES (STRICT):
   - Mother's eating disorder: Must remain an oblique reference (e.g. "insecurity about her own body"). Do not use any clinical or medical terms.
   - CSAM / immutable-ledger: Must remain policy-point-only with zero operational detail. Keep the "refusal-is-the-point" passage intact. Do not add numbers, methods, or identifiers.
   - Anonymity: Keep all people anonymous if they are anonymous in the text. Do not introduce any names.
3. DIRECTNESS: Match the English tone's directness. Do not soften hard truths or add fluff.

Output ONLY the rewritten HTML block. Do not include markdown codeblocks (\`\`\`html) or any other text before or after the HTML.

Here is the HTML block to rewrite:

${htmlContent}
`;

function processChunk(langName: string, chunkHtml: string): string {
  if (!chunkHtml.trim()) return chunkHtml;

  const prompt = PROMPT_TEMPLATE(langName, chunkHtml);

  try {
    // We write the prompt to a temporary file to avoid ARG_MAX limits when calling agy
    const tmpPromptFile = path.join("/tmp", `agy_prompt_${Date.now()}.txt`);
    fs.writeFileSync(tmpPromptFile, prompt, "utf-8");

    const result = execSync(`agy -p "$(cat ${tmpPromptFile})" --model gemini-3.1-pro --effort high`, {
      encoding: "utf-8",
      maxBuffer: 1024 * 1024 * 10,
    });

    fs.unlinkSync(tmpPromptFile);

    let output = result.trim();
    if (output.startsWith("```html")) output = output.slice(7);
    if (output.startsWith("```")) output = output.slice(3);
    if (output.endsWith("```")) output = output.slice(0, -3);

    return output.trim() + "\\n\\n";
  } catch (error: unknown) {
    console.error(`Error processing chunk:`, error instanceof Error ? error.message : String(error));
    return chunkHtml;
  }
}

function prepareFile(langCode: string): boolean {
  const enFilepath = path.join(TARGET_DIR, "index.en.html");
  const targetFilepath = path.join(TARGET_DIR, `index.${langCode}.html`);

  if (!fs.existsSync(enFilepath)) {
    console.error(`English source file ${enFilepath} not found.`);
    return false;
  }

  let content = fs.readFileSync(enFilepath, "utf-8");
  const htmlTag = LANG_HTML_TAGS[langCode];
  const englishLink = LANGBAR_MAP.en;
  const languageLink = LANGBAR_MAP[langCode];
  if (!htmlTag || !englishLink || !languageLink) {
    console.error(`Unsupported language code: ${langCode}`);
    return false;
  }

  // Replace html lang tag
  content = content.replace('<html lang="en">', htmlTag);

  // Replace langbar links
  content = content.replace(englishLink[0], englishLink[1]);
  content = content.replace(languageLink[0], languageLink[1]);

  if (langCode === "zh") {
    content = content.replace(/href="\.\.\//g, 'href="./');
    content = content.replace(
      '<nav class="langbar">',
      '<nav style="text-align:center;font-family:var(--sans);font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;color:var(--meta);padding:.9rem 0 0">',
    );
    content = content.replace(
      '<a href="./en/">English</a>',
      '<a href="en/" style="color:var(--seal);text-decoration:none">English</a>',
    );
    content = content.replace(
      '<a href="./id/">Indonesia</a>',
      '<a href="id/" style="color:var(--seal);text-decoration:none">Indonesia</a>',
    );
    content = content.replace(
      '<a href="./vi/">Tiếng Việt</a>',
      '<a href="vi/" style="color:var(--seal);text-decoration:none">Tiếng Việt</a>',
    );
    content = content.replace(
      '<a href="./ko/">한국어</a>',
      '<a href="ko/" style="color:var(--seal);text-decoration:none">한국어</a>',
    );
    content = content.replace(
      '<a href="./th/">ภาษาไทย</a>',
      '<a href="th/" style="color:var(--seal);text-decoration:none">ภาษาไทย</a>',
    );
    content = content.replace(
      '<a href="./ru/">Русский</a>',
      '<a href="ru/" style="color:var(--seal);text-decoration:none">Русский</a>',
    );
    content = content.replace(
      '<a href="./ar/">العربية</a>',
      '<a href="ar/" style="color:var(--seal);text-decoration:none">العربية</a>',
    );
  }

  fs.writeFileSync(targetFilepath, content, "utf-8");
  console.log(`Prepared ${targetFilepath} from English source.`);
  return true;
}

function rewriteFile(langCode: string, langName: string) {
  if (!prepareFile(langCode)) return;

  const filepath = path.join(TARGET_DIR, `index.${langCode}.html`);
  console.log(`Processing ${langName} (${langCode})...`);

  const content = fs.readFileSync(filepath, "utf-8");

  // Split based on header, aside, article
  const pattern =
    /(<header class="title">.*?<\/header>|<aside class="note">.*?<\/aside>|<article class="chap">.*?<\/article>)/gs;
  const parts = content.split(pattern);

  let newContent = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    // Even indices are boilerplate/glue text, odd indices are the captured groups
    if (i % 2 === 0) {
      newContent += part;
    } else {
      console.log(`Rewriting block ${Math.floor(i / 2) + 1} for ${langCode}...`);
      newContent += processChunk(langName, part);
    }
  }

  fs.writeFileSync(filepath, newContent, "utf-8");
  console.log(`Finished ${langName} (${langCode}).`);
}

function main() {
  const args = process.argv.slice(2);
  const langsToRun = args.length > 0 ? args : Object.keys(LANGUAGES);

  for (const langCode of langsToRun) {
    const langName = LANGUAGES[langCode];
    if (langName !== undefined) {
      rewriteFile(langCode, langName);
    } else {
      console.error(`Unknown lang code: ${langCode}`);
    }
  }
}

if (import.meta.main) main();
