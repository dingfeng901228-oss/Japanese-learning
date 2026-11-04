#!/usr/bin/env python3
"""Build the static dictionary index for FastStudy from Tomoshi's open data layer.

Source: https://github.com/tomoshi-app/tomoshi-dict-data
        (JMdict / KANJIDIC2 / KanjiVG derived, CC BY-SA 4.0 — see ATTRIBUTION)

The Tomoshi repo ships a single SQLite file as a GitHub Release asset:

    curl -L -o tomoshi-dict-open.db.zst \\
      https://github.com/tomoshi-app/tomoshi-dict-data/releases/download/v2026-10-13/tomoshi-dict-open.db.zst
    zstd -d tomoshi-dict-open.db.zst

Usage:

    python scripts/build-dict-index.py /path/to/tomoshi-dict-open.db

Outputs (all under public/dict/):

    lookup.json   word -> {r: reading, m: meaning, p: pos, e: example,
                           l: jlpt, f: freq_rank}
                  Top N words by JMdict frequency rank. Used by the
                  instant-lookup widget on /vocabulary/new.

    notes.json    JA word -> {cn: [...], rel: [...], vt: {...}}
                  Per-word Chinese analysis cards: 译法辨析 (zh/ja false
                  friends), 近义・语体辨析, 自他动词配对. Used on the
                  vocabulary detail page.

    strokes.json  kanji -> [svg path strings]
                  Stroke-order paths from KanjiVG (CC BY-SA 3.0). Used by
                  the stroke-order widget on the vocabulary detail page.

Nothing here is copied verbatim from a copyrighted work: the upstream data
is itself open-licensed (CC BY-SA), and the JSON keys are our own compact
encoding. See public/dict/ATTRIBUTION.md for the required attribution.
"""

from __future__ import annotations

import argparse
import gzip

import json
import os
import sqlite3
import sys
from pathlib import Path

# How many words to include in lookup.json. The Tomoshi freq_rank table
# has 30,164 rows; the join against `forms` expands it to ~36k surface
# forms. 30k covers essentially every word a learner meets in reading
# while keeping the payload around 1 MB gzipped.
LOOKUP_WORDS = 30000

# JLPT levels whose kanji we ship stroke order for. N5-N1 covers
# ~2,800 kanji total, which is everything a N2 learner will encounter.
STROKE_JLPT_LEVELS = ("N5", "N4", "N3", "N2", "N1")


def log(msg: str) -> None:
    print(f"  {msg}", flush=True)


def build_lookup(conn: sqlite3.Connection) -> dict:
    """word -> compact record, ordered by JMdict frequency rank."""
    rows = conn.execute(
        """
        SELECT f.text, e.id, e.data, fr.rank
        FROM freq_rank fr
        JOIN forms f ON f.entry_id = fr.entry_id AND f.is_kana = 0
        JOIN entries e ON e.id = fr.entry_id
        ORDER BY fr.rank
        """
    ).fetchall()

    # Pre-fetch zh_defs + vocab_jlpt in bulk — per-row SELECT would be
    # ~36k extra queries.
    zh_cache: dict[str, dict] = {}
    for eid, data in conn.execute("SELECT entry_id, data FROM zh_defs"):
        zh_cache[eid] = json.loads(data)

    jlpt_cache: dict[str, str] = dict(
        conn.execute("SELECT entry_id, level FROM vocab_jlpt")
    )

    lookup: dict[str, dict] = {}
    for text, eid, edata, rank in rows:
        if len(lookup) >= LOOKUP_WORDS:
            break
        if text in lookup:
            continue

        try:
            entry = json.loads(edata)
        except json.JSONDecodeError:
            continue

        kana = entry.get("kana") or []
        reading = kana[0].get("text", "") if kana else ""
        if not reading:
            continue

        meaning = ""
        pos = ""
        for sense in entry.get("senses") or []:
            if not pos:
                senses_pos = sense.get("pos") or []
                if senses_pos:
                    # "transitive verb" -> "transitive"; keep it short
                    pos = senses_pos[0].split(" (")[0]
            for gloss in sense.get("glosses") or []:
                if gloss.get("lang") == "zho" and not meaning:
                    meaning = gloss.get("text", "")
            if meaning and pos:
                break

        example = ""
        zh = zh_cache.get(eid)
        if zh:
            senses = zh.get("senses") or {}
            for key in sorted(senses, key=lambda x: int(x)):
                examples = senses[key].get("examples") or {}
                if examples:
                    example = next(iter(examples.values()))
                    break

        lookup[text] = {
            "r": reading,
            "m": meaning,
            "p": pos,
            "e": example,
            "l": jlpt_cache.get(eid, ""),
            "f": rank,
        }

    return lookup


def build_notes(conn: sqlite3.Connection) -> tuple[dict, dict]:
    """Two JA-word-keyed maps: zh/ja false friends, and synonym/register
    cards. Self-contained (transitive pairs live in `verb_pairs.json`).

    Both maps are keyed by the Japanese surface form so the detail page
    can look up by the word the user actually typed.
    """
    # entry_id -> canonical JA surface form
    form_by_entry: dict[str, str] = {}
    for text, eid in conn.execute(
        "SELECT text, entry_id FROM forms WHERE is_kana = 0"
    ):
        form_by_entry.setdefault(eid, text)

    cn_cards: dict[str, dict] = {}
    rel_cards: dict[str, dict] = {}

    # 译法辨析 — zh/ja false friends. The table is keyed by the Chinese
    # word; each item carries the Japanese rendering + a note. We file
    # the card under every Japanese rendering it mentions, so a lookup by
    # the Japanese word finds it.
    for cn, summary, items, locale in conn.execute(
        "SELECT cn, summary, items, locale FROM cn_contrast"
    ):
        if locale != "zh-CN":
            continue
        try:
            parsed = json.loads(items)
        except json.JSONDecodeError:
            continue
        # Drop entry_id — we key by the Japanese word, not the DB id.
        slim_items = [
            {k: v for k, v in item.items() if k in ("ja", "reading", "note")}
            for item in parsed
        ]
        card = {"summary": summary, "items": slim_items}
        for item in slim_items:
            ja = item.get("ja")
            if ja:
                cn_cards.setdefault(ja, card)

    # 近义・语体辨析 — synonym / register analysis cards.
    for eid, data, locale in conn.execute(
        "SELECT entry_id, data, locale FROM word_relations_analysis"
    ):
        if locale != "zh-CN":
            continue
        ja = form_by_entry.get(eid)
        if not ja:
            continue
        try:
            card = json.loads(data)
        except json.JSONDecodeError:
            continue
        # `note` is long-form prose; the (word, reading, rel, formality)
        # tuple is what the UI renders, so keep both but drop `hidden`.
        rel_cards.setdefault(
            ja,
            {
                "summary": card.get("summary", ""),
                "items": [
                    {
                        k: v
                        for k, v in item.items()
                        if k in ("word", "reading", "rel", "formality", "note")
                    }
                    for item in card.get("items", [])
                ],
            },
        )

    return cn_cards, rel_cards


def build_verb_pairs(conn: sqlite3.Connection) -> dict:
    """JA word -> {other, role, pattern} transitive/intransitive pair."""
    form_by_entry: dict[str, str] = {}
    for text, eid in conn.execute(
        "SELECT text, entry_id FROM forms WHERE is_kana = 0"
    ):
        form_by_entry.setdefault(eid, text)

    pairs: dict[str, dict] = {}
    for eid, counterpart_id, role, pattern in conn.execute(
        "SELECT entry_id, counterpart_entry_id, role, pattern FROM verb_pairs"
    ):
        ja = form_by_entry.get(eid)
        other = form_by_entry.get(counterpart_id)
        if not ja or not other:
            continue
        pairs.setdefault(ja, {"other": other, "role": role, "pattern": pattern})

    return pairs


def build_strokes(conn: sqlite3.Connection) -> dict:
    """kanji -> [svg path strings], limited to JLPT-relevant kanji."""
    wanted: set[str] = set()
    for (data,) in conn.execute("SELECT data FROM kanji"):
        try:
            k = json.loads(data)
        except json.JSONDecodeError:
            continue
        level = k.get("jlpt")
        if level in STROKE_JLPT_LEVELS:
            wanted.add(k.get("literal"))

    strokes: dict[str, list] = {}
    for literal, paths in conn.execute("SELECT literal, paths FROM kanji_strokes"):
        if literal not in wanted:
            continue
        try:
            strokes[literal] = json.loads(paths)
        except json.JSONDecodeError:
            continue

    return strokes


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    path.write_bytes(raw)
    gz = gzip.compress(raw, 9)
    log(
        f"{path.name}: {len(raw) / 1e6:.2f} MB raw "
        f"-> {len(gz) / 1e6:.2f} MB gzipped ({len(data)} entries)"
    )


def shard_key(word: str) -> str:
    """Stable bucket for a word — same input always lands in the same file.

    Uses FNV-1a (32-bit) rather than md5 so the browser can reproduce the
    exact same bucket without pulling in a crypto library. The low byte
    gives 256 buckets, one per possible 2-hex prefix.

    FNV-1a 32-bit constants:
        offset basis = 0x811c9dc5
        prime        = 0x01000193

    Mirrored in lib/dict/client.ts — keep the two in sync.
    """
    h = 0x811C9DC5
    for byte in word.encode("utf-8"):
        h ^= byte
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h & 0xFF:02x}"


def write_shards(out_dir: Path, name: str, data: dict, buckets: int = 256) -> None:
    """Split a word-keyed map into `buckets` files by md5 prefix.

    The detail page only needs the cards for one word, so it fetches one
    (or two, when the word's kanji hash elsewhere) small file instead of
    the whole multi-megabyte map. 256 buckets (one per possible 2-hex
    prefix) keeps the per-file payload in the single-digit-KB range.
    """
    shard_dir = out_dir / name
    shard_dir.mkdir(parents=True, exist_ok=True)
    # Clean stale shards from a previous run (bucket count may have changed).
    for old in shard_dir.glob("*.json"):
        old.unlink()

    groups: dict[str, dict] = {f"{i:02x}": {} for i in range(buckets)}
    for word, value in data.items():
        groups[shard_key(word)][word] = value

    total_raw = 0
    total_gz = 0
    non_empty = 0
    for bucket, items in groups.items():
        if not items:
            continue
        raw = json.dumps(items, ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
        (shard_dir / f"{bucket}.json").write_bytes(raw)
        total_raw += len(raw)
        total_gz += len(gzip.compress(raw, 9))
        non_empty += 1

    avg_kb = (total_gz / max(1, non_empty)) / 1024
    log(
        f"{name}/: {len(data)} entries in {non_empty} shards "
        f"({total_raw / 1e6:.2f} MB raw -> {total_gz / 1e6:.2f} MB gz, "
        f"avg {avg_kb:.0f} KB/shard)"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("db", help="path to tomoshi-dict-open.db (unzipped)")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent.parent / "public" / "dict"),
        help="output directory (default: public/dict)",
    )
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"error: database not found: {db_path}", file=sys.stderr)
        print(
            "Download it from:\n"
            "  https://github.com/tomoshi-app/tomoshi-dict-data/releases\n",
            file=sys.stderr,
        )
        return 1

    out_dir = Path(args.out)
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)

    print("building lookup index ...")
    lookup = build_lookup(conn)
    write_json(out_dir / "lookup.json", lookup)

    print("building analysis cards ...")
    cn_cards, rel_cards = build_notes(conn)
    write_shards(out_dir, "notes-cn", cn_cards)
    write_shards(out_dir, "notes-rel", rel_cards)

    print("building transitive/intransitive pairs ...")
    write_json(out_dir / "verb_pairs.json", build_verb_pairs(conn))

    print("building stroke-order data ...")
    write_shards(out_dir, "strokes", build_strokes(conn))

    conn.close()
    print(f"\ndone -> {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
