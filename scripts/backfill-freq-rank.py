#!/usr/bin/env python3
"""
Backfill vocabulary_items.freq_rank for words that were saved before the
dictionary lookup existed.

The 「按常用度」 sort and the 常用/次常用/少用 badge both read freq_rank.
Words saved before the lookup widget (or words the dictionary doesn't
cover) have no rank, so they'd sort last and show no badge. This script
fills them in from the dictionary data.

Requires
--------
1. Migration 0008_vocab_freq_rank.sql applied (the script says so and
   stops if the column is missing).
2. A direct Postgres connection string:

       export DATABASE_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres'

   Supabase dashboard → Project Settings → Database → Connection string
   → URI (use the "Session pooler" only if the direct port is blocked).

3. pip install psycopg2-binary

Usage
-----
   python scripts/backfill-freq-rank.py              # dry run
   python scripts/backfill-freq-rank.py --apply      # write

Data source
-----------
Prefers the upstream Tomoshi SQLite (25,307 surface forms with a
measured rank) when it is available, because it covers 138 more of
Frank's words than the 30,000-word lookup index does. Falls back to
public/dict/lookup.json so the script still works without the 634 MB
download.

    export TOMOSHI_DICT_DB='C:/Users/Frank/AppData/Local/Temp/tomoshi-dict.db'

The script is idempotent — it only touches rows where freq_rank is
null, and it prints a rollback list of every word it changed.
"""

import json
import os
import sqlite3
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LOOKUP = REPO / "public" / "dict" / "lookup.json"
DEFAULT_TOMOSHI_DB = "C:/Users/Frank/AppData/Local/Temp/tomoshi-dict.db"


def die(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)


def load_ranks() -> tuple[dict, str]:
    """Japanese surface form -> frequency rank. Returns (map, source)."""
    db_path = os.environ.get("TOMOSHI_DICT_DB", DEFAULT_TOMOSHI_DB)
    if Path(db_path).exists():
        try:
            c = sqlite3.connect(db_path)
            forms: dict[str, str] = {}
            for text, eid in c.execute(
                "SELECT text, entry_id FROM forms WHERE is_kana = 0"
            ):
                forms.setdefault(eid, text)
            ranks: dict[str, int] = {}
            for eid, rank in c.execute("SELECT entry_id, rank FROM freq_rank"):
                w = forms.get(eid)
                if w and w not in ranks:
                    ranks[w] = rank
            c.close()
            print(f"source: upstream Tomoshi DB ({len(ranks)} ranked words)")
            return ranks, db_path
        except sqlite3.Error as e:
            print(f"  upstream DB unreadable ({e}); falling back to lookup.json")

    if not LOOKUP.exists():
        die(f"neither {db_path} nor {LOOKUP} exists")
    lookup = json.loads(LOOKUP.read_text(encoding="utf-8"))
    ranks = {
        w: e["f"]
        for w, e in lookup.items()
        if isinstance(e.get("f"), int) and e["f"] > 0
    }
    print(f"source: public/dict/lookup.json ({len(ranks)} ranked words)")
    return ranks, str(LOOKUP)


def main() -> int:
    apply = "--apply" in sys.argv

    dsn = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL_NON_POOLING")
    if not dsn:
        die(
            "no DATABASE_URL set.\n"
            "  export DATABASE_URL='postgresql://postgres:<password>@"
            "db.<ref>.supabase.co:5432/postgres'\n"
            "  (Supabase dashboard → Project Settings → Database → "
            "Connection string → URI)"
        )
    try:
        import psycopg2
    except ImportError:
        die("psycopg2 not installed — pip install psycopg2-binary")

    ranks, source = load_ranks()
    print(f"  database: {dsn.split('@')[-1].split('/')[0]}  (host only)")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    # Does the column exist?
    cur.execute(
        "select count(*) from information_schema.columns "
        "where table_schema='public' and table_name='vocabulary_items' "
        "and column_name='freq_rank'"
    )
    if cur.fetchone()[0] == 0:
        die(
            "vocabulary_items.freq_rank does not exist yet.\n"
            "  Apply supabase/migrations/0008_vocab_freq_rank.sql first "
            "(Supabase dashboard → SQL Editor)."
        )

    cur.execute(
        "select id, word from public.vocabulary_items where freq_rank is null"
    )
    pending = cur.fetchall()
    cur.execute("select count(*) from public.vocabulary_items")
    total = cur.fetchone()[0]
    print(f"vocabulary_items: {total} rows, {len(pending)} without a rank")

    matched = [(i, w, ranks[w]) for i, w in pending if w in ranks]
    skipped = [w for _, w in pending if w not in ranks]
    print(f"  rank available : {len(matched)}")
    print(f"  no rank       : {len(skipped)}  (phrases / outside the frequency table)")
    if skipped:
        print(f"    e.g. {'、'.join(skipped[:6])}")

    if not matched:
        print("nothing to backfill")
        conn.rollback()
        conn.close()
        return 0

    if not apply:
        print("\ndry run — first 12 that would be set:")
        for _, w, r in matched[:12]:
            print(f"  {w:<16} rank {r}")
        print("\nRe-run with --apply to write.")
        conn.rollback()
        conn.close()
        return 0

    values = ", ".join(f"(%s, %s)" for _ in matched)
    params: list = []
    for _, w, r in matched:
        params.extend([w, r])
    cur.execute(
        "update public.vocabulary_items v "
        "set freq_rank = s.rank, updated_at = now() "
        "from (values " + values + ") as s(word, rank) "
        "where v.word = s.word",
        params,
    )
    print(f"\nupdated {cur.rowcount} rows in one statement")
    conn.commit()

    cur.execute(
        "select count(*) from public.vocabulary_items where freq_rank is not null"
    )
    print("  rows with a rank now:", cur.fetchone()[0])

    # Rollback list.
    snap = Path(__file__).resolve().parent.parent / "data" / "freq-rank-backfill.json"
    snap.parent.mkdir(exist_ok=True)
    snap.write_text(
        json.dumps(
            [
                {"id": str(i), "word": w, "freq_rank": r}
                for i, w, r in matched
            ],
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"  rollback list -> {snap}")

    conn.rollback()
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
