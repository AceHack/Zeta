#!/usr/bin/env bun
// build-book.ts — assemble the shareable book draft and build an EPUB (iPhone/e-reader).
//
// Reproducible pipeline for "You, Born at the Hinge". pandoc is declared in
// tools/setup/manifests/{brew,apt} (all OS shields). TypeScript/Bun per the
// bash-retirement discipline (this is a build convenience, not a bootstrap/installer
// shell surface — so it is TS, not .sh).
//
// ── CONSENT SCOPE (load-bearing — do NOT widen without the per-file gates) ─────
// The book directory holds THREE kinds of file. This script ships only the first,
// and by default only the chapters + outline:
//   SHAREABLE  : OUTLINE.md, ch-NN-*.md  (the book proper; least sensitive)
//   COMPANIONS : ALL-CAPS-prefixed essays — carry third-party material (Addison,
//                parents, ...); included ONLY with --with-companions, because
//                sending them to an outside reader touches those people's pre-read
//                gates (see CONSENT-LEDGER.md). Off by default.
//   NEVER      : RAW-*.md (staging: CSAM allegation, self-disclosures, held sister
//                material), CONSENT-LEDGER.md, INTAKE-LOG.md, RESUME.md, READINESS.md
//                (internal ops). Hard-excluded below, always.
//
// Usage:
//   bun tools/book-build/build-book.ts
//   bun tools/book-build/build-book.ts --with-companions
//   bun tools/book-build/build-book.ts --src <dir> --lang zh-Hans   (translated source)

import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BOOK_DIR = join(REPO_ROOT, "docs", "books", "you-born-at-the-hinge");

const NEVER_SHIP = new Set([
	"CONSENT-LEDGER.md",
	"INTAKE-LOG.md",
	"RESUME.md",
	"READINESS.md",
	"OUTLINE.md",
]);
const isRaw = (f: string): boolean => f.startsWith("RAW-");

interface Opts {
	src: string;
	lang: string;
	withCompanions: boolean;
	title: string;
	out: string;
}

function parseArgs(argv: readonly string[]): Opts {
	const o: Opts = {
		src: BOOK_DIR,
		lang: "en",
		withCompanions: false,
		title: "You, Born at the Hinge",
		out: join(REPO_ROOT, "dist", "book"),
	};
	const next = (i: number): string => {
		const v = argv[i + 1];
		if (v === undefined) {
			console.error(`missing value for ${argv[i]}`);
			process.exit(2);
		}
		return v;
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--src") o.src = next(i++);
		else if (a === "--lang") o.lang = next(i++);
		else if (a === "--with-companions") o.withCompanions = true;
		else if (a === "--title") o.title = next(i++);
		else if (a === "--out") o.out = next(i++);
		else {
			console.error(`unknown arg: ${a}`);
			process.exit(2);
		}
	}
	return o;
}

function shareableFiles(srcDir: string, withCompanions: boolean): string[] {
	const all = readdirSync(srcDir).filter((f) => f.endsWith(".md"));
	const chapters = all.filter((f) => f.startsWith("ch-")).sort();
	const files = ["OUTLINE.md", ...chapters];
	if (withCompanions) {
		console.error(
			"⚠ including companions — confirm the third-party pre-read gates (CONSENT-LEDGER).",
		);
		const companions = all
			.filter((f) => /^[A-Z]/.test(f) && !isRaw(f) && !NEVER_SHIP.has(f))
			.sort();
		files.push(...companions);
	}
	// belt-and-suspenders: never ship RAW-* or ops docs regardless of the above.
	return files.filter(
		(f) => !isRaw(f) && (f === "OUTLINE.md" || !NEVER_SHIP.has(f)),
	);
}

function main(): void {
	const o = parseArgs(process.argv.slice(2));
	if (spawnSync("pandoc", ["--version"], { stdio: "ignore" }).status !== 0) {
		console.error(
			"pandoc not found — run tools/setup (manifests/{brew,apt} declare it)",
		);
		process.exit(1);
	}
	mkdirSync(o.out, { recursive: true });

	const parts: string[] = [];
	for (const f of shareableFiles(o.src, o.withCompanions)) {
		const p = join(o.src, f);
		if (existsSync(p)) parts.push(readFileSync(p, "utf8"), "\n\n");
	}
	const assembled = join(o.out, `book.${o.lang}.md`);
	writeFileSync(assembled, parts.join(""));

	const epub = join(o.out, `you-born-at-the-hinge.${o.lang}.epub`);
	const r = spawnSync(
		"pandoc",
		[
			assembled,
			"-o",
			epub,
			"--metadata",
			`title=${o.title}`,
			"--metadata",
			"author=Aaron Stainback",
			"--metadata",
			`lang=${o.lang}`,
			"--toc",
			"--toc-depth=1",
			"--split-level=1",
		],
		{ stdio: "inherit" },
	);
	if (r.status !== 0) process.exit(r.status ?? 1);

	console.log(`✅ assembled: ${assembled}`);
	console.log(`✅ EPUB:      ${epub}`);
	console.log(
		"\nTranslation: this script does not translate. Produce a translated copy of the " +
			"SHAREABLE files into a dir (same filenames), then re-run with --src <dir> --lang zh-Hans. " +
			"Full-book memoir translation should be reviewed before external sharing (meaning-drift).",
	);
}

main();
