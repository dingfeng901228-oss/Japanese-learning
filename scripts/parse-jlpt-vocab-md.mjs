// Parse JLPT vocabulary markdown files (e.g. JLPT_N2-N1_词汇样本_200词.md)
// into structured JSON for bulk import into jp.frank2025.com/vocabulary.
//
// Input file format:
//   ## <category name>（<count>词）
//   1. **<word>（<reading>）** — <meaning>〔<level>〕
//      例：<sentence>
//      （<reading1>・<reading2>・...）
//      译：<translation>
//
// Output:
//   data/jlpt-vocab-<slug>.json
//   [
//     {
//       word, reading, meaning, level, category,
//       example: { sentence, reading, translation }
//     },
//     ...
//   ]
//
// Usage:
//   node scripts/parse-jlpt-vocab-md.mjs <md-path> [<output-json-path>]
//   node scripts/parse-jlpt-vocab-md.mjs --validate <json-path>
//
// Idempotent: re-running overwrites the output file. The output is
// consumed by app/admin/import-vocab/actions.ts on jp.frank2025.com.
//
// Per Frank #7631 (2026-09-02): parsing logic moved to lib/parse-jlpt-vocab-md.mjs
// so the same code powers both this CLI script and the server action
// `importPastedMdAction` on /admin/import-vocab (paste-MD direct import).

import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import {
  parseMd,
  validateBatch,
  formatReport,
} from "../lib/parse-jlpt-vocab-md.mjs";

const REPO = process.cwd();

// ---------- CLI arg parsing ----------
const args = process.argv.slice(2);
let validateOnly = false;
let mdPath = "";
let outPath = "";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--validate" && args[i + 1]) {
    validateOnly = true;
    outPath = args[i + 1];
    i++;
  } else if (args[i] === "--help" || args[i] === "-h") {
    printHelp();
    process.exit(0);
  } else if (!mdPath) {
    mdPath = args[i];
  } else if (!outPath) {
    outPath = args[i];
  }
}

if (validateOnly) {
  const j = await readFile(outPath, "utf-8");
  const arr = JSON.parse(j);
  const report = validateBatch(arr);
  console.log(formatReport(report, outPath));
  if (report.errors.length > 0) process.exit(1);
  process.exit(0);
}

if (!mdPath) {
  printHelp();
  process.exit(1);
}

const absMd = resolve(mdPath);
if (!outPath) {
  const slug = basename(absMd).replace(/\.md$/i, "").replace(/[^a-zA-Z0-9_一-鿿-]/g, "_");
  outPath = join(REPO, "data", `${slug}.json`);
}

const md = await readFile(absMd, "utf-8");
const items = parseMd(md);
await writeFile(outPath, JSON.stringify(items, null, 2) + "\n", "utf-8");

const report = validateBatch(items);
console.log(`✅ parsed ${items.length} entries → ${outPath}`);
console.log(formatReport(report, outPath));
if (report.errors.length > 0) process.exit(1);

function printHelp() {
  console.log(`Usage:
  node scripts/parse-jlpt-vocab-md.mjs <md-path> [<output-json-path>]
  node scripts/parse-jlpt-vocab-md.mjs --validate <json-path>

Examples:
  node scripts/parse-jlpt-vocab-md.mjs "F:\\\\日语学习资料\\\\JLPT_N2-N1_词汇样本_200词.md"
  node scripts/parse-jlpt-vocab-md.mjs "F:/日语学习资料/JLPT_N2-N1_词汇样本_200词.md" data/jlpt-vocab-200.json
  node scripts/parse-jlpt-vocab-md.mjs --validate data/jlpt-vocab-200.json`);
}