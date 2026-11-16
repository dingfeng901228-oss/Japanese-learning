import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  listVocabularyItemsPaged,
  type VocabularyFilter,
  type VocabularySort,
  type VocabularyType,
} from "@/lib/vocabulary";
import { formatAccent } from "@/lib/vocabulary/accent";

/**
 * Export the user's vocabulary.
 *
 * Audit 2026-11-16 P1-9: "词汇页和进度页加'导出'按钮，支持按当前筛选
 * 导出为 CSV 和 Anki 可导入格式（含读音、释义、例句、等级字段）".
 *
 *   GET /api/export?format=csv&q=&type=&level=&sort=&filter=&tag=
 *   GET /api/export?format=anki&...
 *
 * The filters are the same ones the list page uses, so "导出" exports
 * what is on screen, not the whole collection.
 *
 * Paged on purpose: PostgREST caps a response at 1,000 rows, which is
 * exactly how /progress once showed 1,000 words instead of 3,347. The
 * loop below walks the whole result set.
 */

export const dynamic = "force-dynamic";

const PAGE_SIZE = 500;
const MAX_PAGES = 40; // 20,000 rows — more than enough for a personal deck

type ExportRow = {
  word: string;
  reading: string | null;
  accent: number | null;
  meaning: string;
  part_of_speech: string | null;
  level: string | null;
  type: string;
  freq_rank: number | null;
  mastery: number;
  example: string | null;
  example_reading: string | null;
  example_translation: string | null;
  tags: string[];
};

function csvCell(value: string | number | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Tabs and newlines would break the TSV; HTML-ify the rest. */
function tsvCell(value: string | null): string {
  if (!value) return "";
  return value.replace(/\t/g, " ").replace(/\r?\n/g, "<br>");
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const format = sp.get("format") === "anki" ? "anki" : "csv";

  const q = sp.get("q")?.trim() || undefined;
  const typeRaw = sp.get("type") || undefined;
  const type =
    typeRaw === "word" ||
    typeRaw === "phrase" ||
    typeRaw === "grammar" ||
    typeRaw === "sentence"
      ? (typeRaw as VocabularyType)
      : undefined;
  const level = sp.get("level") || undefined;
  const sortRaw = sp.get("sort") || undefined;
  const sort: VocabularySort =
    sortRaw === "oldest" || sortRaw === "word" || sortRaw === "freq"
      ? sortRaw
      : "newest";
  const filterRaw = sp.get("filter") || undefined;
  const filter: VocabularyFilter | undefined =
    filterRaw === "due" || filterRaw === "mastered" || filterRaw === "weak"
      ? filterRaw
      : undefined;
  const tag = sp.get("tag")?.trim() || undefined;
  // P1-10: the 掌握度区间 filter ("20-49").
  const masteryRaw = sp.get("mastery")?.trim() || "";
  let masteryMin: number | undefined;
  let masteryMax: number | undefined;
  if (masteryRaw) {
    const m = /^(\d+)-(\d+)$/.exec(masteryRaw);
    if (m) {
      masteryMin = Number(m[1]);
      masteryMax = Number(m[2]);
    }
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (err) {
    if ((err as Error).message !== "supabase_env_missing") {
      console.error("[export] createClient failed:", err);
    }
    return new NextResponse("导出不可用", { status: 503 });
  }
  if (!supabase) return new NextResponse("导出不可用", { status: 503 });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return new NextResponse("请先登录", { status: 401 });
  }

  // ---- walk the whole result set ----
  const items: Awaited<
    ReturnType<typeof listVocabularyItemsPaged>
  >["items"] = [];
  let totalPages = 1;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await listVocabularyItemsPaged({
      search: q,
      type,
      level,
      sort,
      filter,
      tag,
      masteryMin,
      masteryMax,
      page,
      pageSize: PAGE_SIZE,
    });
    items.push(...res.items);
    totalPages = res.totalPages;
    if (page >= totalPages || res.items.length === 0) break;
  }

  const ids = items.map((i) => i.id);

  // ---- examples ----
  const exampleByVocab = new Map<
    string,
    { sentence: string; reading: string | null; translation: string | null }
  >();
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { data: exRows } = await supabase
        .from("vocabulary_examples")
        .select("vocabulary_id, sentence, reading, translation, is_primary")
        .eq("user_id", user.id)
        .in("vocabulary_id", chunk)
        .order("is_primary", { ascending: false });
      for (const ex of exRows ?? []) {
        if (!exampleByVocab.has(ex.vocabulary_id)) {
          exampleByVocab.set(ex.vocabulary_id, {
            sentence: ex.sentence ?? "",
            reading: ex.reading ?? null,
            translation: ex.translation ?? null,
          });
        }
      }
    }
  }

  // ---- tags ----
  const tagsByVocab = new Map<string, string[]>();
  if (ids.length > 0) {
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const { data: tagRows } = await supabase
        .from("vocabulary_tags")
        .select("vocabulary_id, tag")
        .eq("user_id", user.id)
        .in("vocabulary_id", chunk);
      for (const row of tagRows ?? []) {
        const list = tagsByVocab.get(row.vocabulary_id) ?? [];
        list.push(row.tag);
        tagsByVocab.set(row.vocabulary_id, list);
      }
    }
  }

  const rows: ExportRow[] = items.map((item) => {
    const ex = exampleByVocab.get(item.id);
    return {
      word: item.word,
      reading: item.reading,
      accent: item.accent ?? null,
      meaning: item.meaning,
      part_of_speech: item.part_of_speech,
      level: item.level,
      type: item.type,
      freq_rank: item.freq_rank ?? null,
      mastery: item.mastery,
      example: ex?.sentence ?? null,
      example_reading: ex?.reading ?? null,
      example_translation: ex?.translation ?? null,
      tags: tagsByVocab.get(item.id) ?? [],
    };
  });

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "anki") {
    // Anki text import: tab-separated, HTML allowed in the fields.
    const lines = rows.map((r) => {
      const front = [
        `<b>${tsvCell(r.word)}</b>`,
        r.reading ? tsvCell(r.reading) : "",
        r.accent != null ? formatAccent(r.accent) : "",
      ]
        .filter(Boolean)
        .join("<br>");
      const back = [
        tsvCell(r.meaning),
        [r.part_of_speech, r.level].filter(Boolean).join(" · "),
      ]
        .filter(Boolean)
        .join("<br>");
      const extra = [
        tsvCell(r.example),
        r.example_reading ? tsvCell(r.example_reading) : "",
        r.example_translation ? tsvCell(r.example_translation) : "",
        r.tags.length ? tsvCell(r.tags.join(" ")) : "",
      ]
        .filter(Boolean)
        .join("<br>");
      return [front, back, extra].join("\t");
    });
    const body = lines.join("\n");
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="faststudy-${stamp}.tsv"`,
      },
    });
  }

  const header = [
    "单词",
    "读音",
    "アクセント",
    "释义",
    "词性",
    "等级",
    "类型",
    "常用度排名",
    "掌握度",
    "例句",
    "例句读音",
    "例句翻译",
    "主题",
  ];
  const csv = [
    header.map(csvCell).join(","),
    ...rows.map((r) =>
      [
        r.word,
        r.reading,
        r.accent != null ? formatAccent(r.accent) : "",
        r.meaning,
        r.part_of_speech ?? "",
        r.level ?? "",
        r.type,
        r.freq_rank ?? "",
        r.mastery,
        r.example ?? "",
        r.example_reading ?? "",
        r.example_translation ?? "",
        r.tags.join(" "),
      ]
        .map(csvCell)
        .join(",")
    ),
  ].join("\n");

  // A BOM so Excel opens the UTF-8 Chinese/Japanese correctly.
  return new NextResponse("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="faststudy-${stamp}.csv"`,
    },
  });
}
