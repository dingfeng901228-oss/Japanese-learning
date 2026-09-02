// parse-jlpt-vocab-md.mjs — pure parser for JLPT N2-N1 vocab MD files.
//
// Shared between:
//   - scripts/parse-jlpt-vocab-md.mjs (CLI: read file → write JSON)
//   - app/admin/import-vocab/actions.ts (server action: paste MD → import)
//
// Input MD format:
//   ## <category name>（<count>词）
//   1. **<word>（<reading>）** — <meaning>〔<level>〕
//      例：<sentence>
//      （<reading1>・<reading2>・...）
//      译：<translation>
//
// Output: array of
//   {
//     word, reading, meaning, level, category,
//     example: { sentence, reading, translation }
//   }
//
// All string fields are trimmed. reading/example.reading/example.translation
// may be null when absent from the source.

export function parseMd(md) {
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
    const itemMatch = line.match(
      /^\d+\.\s+\*\*(.+?)\*\*\s*[—\-:]\s*(.+?)\s*[\[〔【]([^\]〕】]+)[\]〕】]\s*$/
    );
    if (itemMatch) {
      let wordField = itemMatch[1].trim();
      const meaning = itemMatch[2].trim();
      const level = normalizeLevel(itemMatch[3].trim());

      // Split "word（reading）" — only when inner content is plausible kana.
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

export function normalizeLevel(raw) {
  // Accept "N1", "N2", "N 1", "n1", etc. — only N1/N2 are valid per DB
  // check constraint; others map to "" so they're skipped at import time.
  const m = raw.toUpperCase().match(/^N\s*([1-5])$/);
  return m ? `N${m[1]}` : "";
}

export function validateBatch(items) {
  const errors = [];
  const warnings = [];
  const byCategory = {};
  const byLevel = {};
  const seen = new Map();

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

export function formatReport(report, path) {
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