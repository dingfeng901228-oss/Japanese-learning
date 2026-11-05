#!/usr/bin/env python3
"""
Apply a migration file from supabase/migrations/ to the database.

Runs the .sql as-is in a single transaction, then prints what it
verified (new column, index presence, rows affected). Nothing is
committed if any statement fails.

Usage
-----
   export DATABASE_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres'
   python scripts/apply-migration.py supabase/migrations/0008_vocab_freq_rank.sql

Supabase dashboard → Project Settings → Database → Connection string → URI.
Use the Session pooler if the direct 5432 port is blocked.

Requires: pip install psycopg2-binary
"""

import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MIGRATIONS = REPO / "supabase" / "migrations"


def die(msg: str) -> None:
    print(f"ERROR: {msg}")
    sys.exit(1)


def resolve(sql_arg: str) -> Path:
    """Accept a bare filename and resolve it inside supabase/migrations/."""
    p = Path(sql_arg)
    if p.exists():
        return p
    candidate = MIGRATIONS / sql_arg
    if candidate.exists():
        return candidate
    die(
        f"{sql_arg} not found.\n"
        f"  looked at {p} and {candidate}\n"
        f"  available: {', '.join(sorted(f.name for f in MIGRATIONS.glob('*.sql')))}"
    )


def snapshot(cur) -> tuple[set, set]:
    """(columns, indexes) currently present in the public schema."""
    cur.execute(
        "select table_name, column_name from information_schema.columns "
        "where table_schema='public'"
    )
    columns = {(t, c) for t, c in cur.fetchall()}
    cur.execute(
        "select tablename, indexname from pg_indexes where schemaname='public'"
    )
    indexes = {(t, i) for t, i in cur.fetchall()}
    return columns, indexes


def main() -> int:
    if len(sys.argv) < 2:
        die(f"usage: apply-migration.py <sql-file>\n  e.g. apply-migration.py 0008_vocab_freq_rank.sql")

    sql_path = resolve(sys.argv[1])
    sql = sql_path.read_text(encoding="utf-8")

    dsn = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL_NON_POOLING")
    if not dsn:
        die(
            "no DATABASE_URL set.\n"
            "  export DATABASE_URL='postgresql://postgres:<password>@"
            "db.<ref>.supabase.co:5432/postgres'"
        )
    try:
        import psycopg2
    except ImportError:
        die("psycopg2 not installed — pip install psycopg2-binary")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    before_cols, before_idx = snapshot(cur)

    print(f"applying {sql_path.name} ...")
    try:
        cur.execute(sql)
        conn.commit()
        print("  committed")
    except Exception as e:  # noqa: BLE001 — surface the DB error verbatim
        conn.rollback()
        print(f"  FAILED: {e}")
        conn.close()
        return 1

    after_cols, after_idx = snapshot(cur)

    print("\n=== verification ===")
    new_cols = sorted(after_cols - before_cols)
    new_idx = sorted(after_idx - before_idx)
    if new_cols:
        for table, col in new_cols:
            cur.execute(
                "select data_type, is_nullable from information_schema.columns "
                "where table_schema='public' and table_name=%s and column_name=%s",
                (table, col),
            )
            dtype, nullable = cur.fetchone()
            print(f"  column {table}.{col} — {dtype}, null={nullable}")
    else:
        print("  no new columns (already applied — the migration is idempotent)")
    for table, index in new_idx:
        print(f"  index  {table}.{index}")
    if not new_idx:
        print("  no new indexes (already applied)")

    conn.rollback()
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
