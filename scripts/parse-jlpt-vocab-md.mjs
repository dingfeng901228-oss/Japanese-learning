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

import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

const REPO = "F:/WebSite/Japanese-learning-compare";

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

const absMd = resolveMdPath(mdPath);
if (!outPath) {
  // Auto: data/jlpt-vocab-<slug>.json
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

// Accept either backslash (Windows) or forward-slash paths.
function resolveMdPath(p) {
  return resolve(p);
}

// ---------- Parser ----------
//
// State machine over lines:
//   - ## <category>  → switch currentCategory (and consume the count suffix)
//   - <num>. **<word>（<reading>）** — <meaning>〔<level>〕  → push new item
//   - 例：<sentence>  → fill example.sentence
//   - （<reading1>・<reading2>）  → fill example.reading (full-width parens)
//   - 译：<translation>  → fill example.translation
//   - blank line / other  → ignore
//
// Note: example reading uses ・ (katakana middle dot) as the word separator.
// Word+reading uses full-width （）.
function parseMd(md) {
  const items = [];
  let currentCategory = null;
  let current = null;

  const lines = md.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Category header: ## 一、工作・职场（25词）
    const catMatch = line.match(/^##\s+(.+)$/);
    if (catMatch) {
      // Strip trailing "（NN词）" suffix + leading ordinal ("一、" "二、" …).
      currentCategory = catMatch[1]
        .trim()
        .replace(/（\s*\d+\s*词\s*[（(]?[^）)]*[）)]?\s*）?$/u, "")
        .replace(/^[一二三四五六七八九十]+、\s*/u, "")
        .trim();
      continue;
    }

    // Item header: 1. **契約（けいやく）** — 合同，契约〔N2〕
    // Accept either full-width （） or half-width () around reading.
    // Tolerate 〔〕 / [] / 【】 around level.
    const itemMatch = line.match(
      /^\d+\.\s+\*\*(.+?)\*\*\s*[—\-:]\s*(.+?)\s*[\[〔【]([^\]〕】]+)[\]〕】]\s*$/
    );
    if (itemMatch) {
      let wordField = itemMatch[1].trim();
      const meaning = itemMatch[2].trim();
      const level = normalizeLevel(itemMatch[3].trim());

      // Split "word（reading）" / "word(reading)" — only when the inner
      // content is plausible kana (hiragana + katakana). Some words
      // don't have a reading (rare — katakana loanwords with no kanji).
      let word = wordField;
      let reading = null;
      const wordReading = wordField.match(/^(.+?)[\(（]([ぁ-んァ-ヶー・]+)[\)）]$/);
      if (wordReading) {
        word = wordReading[1].trim();
        reading = wordReading[2].trim();
      }

      current = {
        word,
        reading,
        meaning,
        level,
        category: currentCategory,
        example: { sentence: null, reading: null, translation: null },
      };
      items.push(current);
      continue;
    }

    if (!current) continue;

    if (line.startsWith("例：") || line.startsWith("例:")) {
      current.example.sentence = line.replace(/^例[：:]/u, "").trim();
      continue;
    }
    if (line.startsWith("译：") || line.startsWith("译:")) {
      current.example.translation = line.replace(/^译[：:]/u, "").trim();
      continue;
    }
    // Example reading: full-width （...） or half-width (...)
    const readingMatch = line.match(/^[\(（](.+?)[\)）]$/);
    if (readingMatch) {
      current.example.reading = readingMatch[1].trim();
      continue;
    }
  }

  return items;
}

function normalizeLevel(raw) {
  // Accept "N1", "N2", "N 1", "n1", etc. — only N1/N2 are valid per DB
  // check constraint; others map to "" so they're skipped at import time.
  const m = raw.toUpperCase().match(/^N\s*([1-5])$/);
  return m ? `N${m[1]}` : "";
}

// ---------- Validator ----------
function validateBatch(items) {
  const errors = [];
  const warnings = [];
  const byCategory = {};
  const byLevel = {};
  const seen = new Map(); // word+reading → count

  if (!Array.isArray(items)) {
    errors.push({ at: "root", msg: "expected JSON array" });
    return { errors, warnings, byCategory, byLevel, total: 0 };
  }

  items.forEach((it, i) => {
    const at = `#${i + 1}`;
    if (!it || typeof it !== "object") {
      errors.push({ at, msg: "not an object" });
      return;
    }
    if (!it.word || typeof it.word !== "string") {
      errors.push({ at, msg: "missing or invalid word" });
    }
    if (it.reading != null && typeof it.reading !== "string") {
      errors.push({ at, msg: "reading not a string" });
    }
    if (!it.meaning || typeof it.meaning !== "string") {
      errors.push({ at, msg: "missing or invalid meaning" });
    }
    if (!it.level) {
      errors.push({ at, msg: "missing or invalid level", word: it.word });
    }
    if (!it.category) {
      warnings.push({ at, msg: "missing category", word: it.word });
    }
    if (!it.example || !it.example.sentence) {
      errors.push({ at, msg: "missing example.sentence", word: it.word });
    }
    const key = `${it.word}::${it.reading ?? ""}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);

    byCategory[it.category ?? "(uncategorized)"] =
      (byCategory[it.category ?? "(uncategorized)"] ?? 0) + 1;
    byLevel[it.level ?? "(no level)"] = (byLevel[it.level ?? "(no level)"] ?? 0) + 1;
  });

  for (const [key, count] of seen) {
    if (count > 1) {
      warnings.push({ at: key, msg: `duplicated ${count}×` });
    }
  }

  return {
    errors,
    warnings,
    byCategory,
    byLevel,
    total: items.length,
  };
}

function formatReport(report, path) {
  const lines = [];
  lines.push(`📊 ${path}`);
  lines.push(`   total:    ${report.total}`);
  if (report.errors.length > 0) {
    lines.push(`   errors:   ${report.errors.length}`);
    for (const e of report.errors.slice(0, 20)) {
      lines.push(`     - [${e.at}] ${e.msg}${e.word ? ` (${e.word})` : ""}`);
    }
    if (report.errors.length > 20) {
      lines.push(`     … ${report.errors.length - 20} more`);
    }
  } else {
    lines.push(`   errors:   0 ✅`);
  }
  if (report.warnings.length > 0) {
    lines.push(`   warnings: ${report.warnings.length}`);
    for (const w of report.warnings.slice(0, 10)) {
      lines.push(`     - [${w.at}] ${w.msg}${w.word ? ` (${w.word})` : ""}`);
    }
    if (report.warnings.length > 10) {
      lines.push(`     … ${report.warnings.length - 10} more`);
    }
  } else {
    lines.push(`   warnings: 0`);
  }
  lines.push(`   by level:`);
  for (const [lvl, n] of Object.entries(report.byLevel)) {
    lines.push(`     - ${lvl}: ${n}`);
  }
  lines.push(`   by category:`);
  for (const [cat, n] of Object.entries(report.byCategory)) {
    lines.push(`     - ${cat}: ${n}`);
  }
  return lines.join("\n");
}