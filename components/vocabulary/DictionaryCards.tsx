"use client";

/**
 * DictionaryCards — the three linguistic analysis cards on the
 * vocabulary detail page.
 *
 *   1. 译法辨析 — zh/ja false friends. "手紙" as letter vs. toilet
 *      paper; "汽車" as train vs. car. These are the traps that actually
 *      bite a Chinese speaker, and no LLM can be trusted to catch them.
 *   2. 近义・语体辨析 — synonym + register analysis. Which of these
 *      near-synonyms is casual, which is formal, which one fits.
 *   3. 自他动词配对 — transitive / intransitive counterpart. 見える vs.
 *      観える, 会う vs. 逢う. Getting this wrong is a grammar error a
 *      reviewer notices immediately.
 *
 * All three come from Tomoshi's open data layer (CC BY-SA). The card
 * data is sharded by word hash so this component downloads only the
 * ~30 KB it needs.
 *
 * Attribution: public/dict/ATTRIBUTION.md
 */

import { useEffect, useState } from "react";
import {
  fetchCard,
  fetchVerbPairs,
  type CnCard,
  type RelCard,
  type VerbPair,
} from "@/lib/dict/client";

/**
 * Conjugation rule behind each 自他动词 pair, so the card teaches the
 * pattern instead of just listing two words.
 *
 * The keys are the upstream verb_pairs "pattern" ids. They name the
 * ending class of each side: "ru-su" = intransitive ends in 〜る,
 * transitive in 〜す. The spellings below are the real Japanese
 * endings of each class (the ids are romanised labels, not kana).
 *
 * Every example below was checked against the upstream data — the
 * pairs are listed as they appear in the table.
 *
 * Pairs with no regular ending rule (pattern is empty, ~10% of the
 * entries) get no hint at all.
 */
const PATTERN_HINTS: Record<string, string> = {
  "ru-su": "自动词「〜る」↔ 他动词「〜す」（如：返る ↔ 返す）",
  "reru-su": "自动词「〜れる」↔ 他动词「〜す」（如：剥がれる ↔ 剥がす）",
  "ru-seru": "自动词「〜る」↔ 他动词「〜せる」（如：乗る ↔ 乗せる）",
  "aru-eru": "自动词「〜まる」↔ 他动词「〜める」（如：収まる ↔ 収める）",
  "eru-u": "自动词「〜ける」↔ 他动词「〜く」（如：剥ける ↔ 剥く）",
  "eru-asu": "自动词「〜える」↔ 他动词「〜やす」（如：冷える ↔ 冷やす）",
  "aru-u": "自动词「〜がる」↔ 他动词「〜ぐ」（如：塞がる ↔ 塞ぐ）",
  "u-eru": "自动词「〜う」↔ 他动词「〜える」（如：向く ↔ 向ける）",
  "u-asu": "自动词「〜く」↔ 他动词「〜かす」（如：動く ↔ 動かす）",
  "u-aseru": "自动词「〜る」↔ 他动词「〜らせる」（如：詰まる ↔ 詰まらせる）",
  "iru-asu": "自动词「〜びる」↔ 他动词「〜ばす」（如：伸びる ↔ 伸ばす）",
  "iru-osu": "自动词「〜びる」↔ 他动词「〜ぼす」（如：滅びる ↔ 滅ぼす）",
  "irregular": "不规则对应，没有固定词尾规律（如：入る ↔ 入れる）",
};

interface DictionaryCardsProps {
  /** the vocabulary item's word (Japanese surface form) */
  word: string;
}

export function DictionaryCards({ word }: DictionaryCardsProps) {
  const [cn, setCn] = useState<CnCard | null>(null);
  const [rel, setRel] = useState<RelCard | null>(null);
  const [pair, setPair] = useState<VerbPair | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setCn(null);
    setRel(null);
    setPair(null);

    Promise.all([
      fetchCard<CnCard>("notes-cn", word),
      fetchCard<RelCard>("notes-rel", word),
      fetchVerbPairs(),
    ]).then(([c, r, pairs]) => {
      if (cancelled) return;
      setCn(c);
      setRel(r);
      setPair(pairs[word] ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [word]);

  if (loading) return null;

  const hasAnything = cn || rel || pair;
  if (!hasAnything) return null;

  return (
    <div className="space-y-4">
      {cn && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-900 mb-2">
            ⚠️ 译法辨析
            <span className="font-normal text-amber-700 ml-2 text-xs">
              中文与日语的同形异义陷阱
            </span>
          </h3>
          {cn.summary && (
            <p className="text-sm text-amber-900 mb-3 leading-relaxed">
              {cn.summary}
            </p>
          )}
          <ul className="space-y-2">
            {cn.items.map((it, i) => (
              <li key={i} className="text-sm">
                <span className="font-jp font-semibold text-gray-900">
                  {it.ja}
                </span>
                {it.reading && (
                  <span className="font-jp text-gray-500 ml-2 text-xs">
                    {it.reading}
                  </span>
                )}
                {it.note && (
                  <p className="text-gray-700 mt-0.5 leading-relaxed">
                    {it.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {pair && (
        <section className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-blue-900 mb-2">
            ↔ 自他动词配对
            <span className="font-normal text-blue-700 ml-2 text-xs">
              {pair.role === "vt" ? "他动词" : "自动词"}
            </span>
          </h3>
          <p className="text-sm text-gray-800">
            对应的形式：
            <span className="font-jp font-semibold text-gray-900 ml-1">
              {pair.other}
            </span>
            <span className="text-gray-500 ml-2 text-xs">
              （{pair.role === "vt" ? "他动词" : "自动词"}）
            </span>
          </p>

          <div className="mt-3 space-y-2 text-sm leading-relaxed">
            {pair.role === "vt" ? (
              <p className="text-gray-800">
                <span className="font-jp font-semibold text-gray-900">
                  {word}
                </span>{" "}
                是<strong className="text-blue-800">他动词</strong>，必须带宾语：
                <span className="font-jp">〜を{word}</span>。
                <br />
                <span className="font-jp font-semibold text-gray-900">
                  {pair.other}
                </span>{" "}
                是<strong className="text-blue-800">自动词</strong>，不带宾语，
                表示同一件事自然发生或状态成立。
              </p>
            ) : (
              <p className="text-gray-800">
                <span className="font-jp font-semibold text-gray-900">
                  {word}
                </span>{" "}
                是<strong className="text-blue-800">自动词</strong>，不能带宾语，
                表示事情自然发生或状态成立。
                <br />
                <span className="font-jp font-semibold text-gray-900">
                  {pair.other}
                </span>{" "}
                是<strong className="text-blue-800">他动词</strong>，必须带宾语：
                <span className="font-jp">〜を{pair.other}</span>。
              </p>
            )}
            {PATTERN_HINTS[pair.pattern] && (
              <p className="text-xs text-blue-800 bg-white/60 rounded-lg px-3 py-2">
                记忆规律：{PATTERN_HINTS[pair.pattern]}
              </p>
            )}
          </div>
        </section>
      )}

      {rel && rel.items.length > 0 && (
        <section className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-purple-900 mb-2">
            ≡ 近义・语体辨析
            <span className="font-normal text-purple-700 ml-2 text-xs">
              哪个更自然？用哪个场合？
            </span>
          </h3>
          {rel.summary && (
            <p className="text-sm text-purple-900 mb-3 leading-relaxed">
              {rel.summary}
            </p>
          )}
          <ul className="space-y-3">
            {rel.items.map((it, i) => (
              <li key={i}>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-jp font-semibold text-gray-900">
                    {it.word}
                  </span>
                  {it.reading && (
                    <span className="font-jp text-gray-500 text-xs">
                      {it.reading}
                    </span>
                  )}
                  {it.formality && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-white text-purple-700">
                      {it.formality}
                    </span>
                  )}
                  {it.rel && (
                    <span className="text-[11px] text-purple-500">
                      {it.rel}
                    </span>
                  )}
                </div>
                {it.note && (
                  <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">
                    {it.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
