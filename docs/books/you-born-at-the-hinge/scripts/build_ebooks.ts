import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import epub from "epub-gen-memory";

const SITE_DIR = path.join(__dirname, "..", "site");
const DIST_DIR = path.join(__dirname, "..", "..", "..", "..", "dist", "books", "you-born-at-the-hinge");

async function buildPDF() {
  console.log("Generating PDF...");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const htmlPath = path.join(SITE_DIR, "index.en.html");
  await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle" });

  // Hide UI elements not meant for print
  await page.addStyleTag({
    content: `
      .langbar { display: none !important; }
      @media print {
        body { background: white !important; color: black !important; }
        .wrap { max-width: none !important; padding: 1in !important; }
        h2.chap-title { page-break-before: always; }
      }
    `,
  });

  const pdfPath = path.join(DIST_DIR, "you-born-at-the-hinge.pdf");
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "1in", bottom: "1in", left: "1in", right: "1in" },
  });

  await browser.close();
  console.log(`PDF saved to ${pdfPath}`);
}

async function buildEpub() {
  console.log("Generating ePub...");
  const htmlPath = path.join(SITE_DIR, "index.en.html");
  const content = fs.readFileSync(htmlPath, "utf-8");

  // Extremely basic parsing: split by chapters
  const pattern = /<article class="chap">(.*?)<\/article>/gs;
  const chapters: { title: string; content: string }[] = [];

  let match;
  let chapNum = 1;
  while ((match = pattern.exec(content)) !== null) {
    const chapContent = match[1];
    if (chapContent === undefined) continue;

    // Try to extract chapter title
    const titleMatch = /<h2 class="chap-title">(.*?)<\/h2>/.exec(chapContent);
    const title = titleMatch?.[1] ?? `Chapter ${chapNum}`;

    chapters.push({
      title: title,
      content: chapContent,
    });
    chapNum++;
  }

  const epubPath = path.join(DIST_DIR, "you-born-at-the-hinge.epub");
  const buffer = await epub(
    {
      title: "You, Born at the Hinge",
      author: "Zeta / Lior",
      publisher: "Zeta",
      description: "A mathematical framework for empowerment.",
    },
    chapters,
  );

  fs.writeFileSync(epubPath, buffer);
  console.log(`ePub saved to ${epubPath}`);
}

async function main() {
  await buildPDF();
  await buildEpub();
}

main().catch(console.error);
