# Dictionary data attribution

The static dictionary files in this directory (`lookup.json`, `notes.json`,
`strokes.json`) are generated from **Tomoshi's open data layer**:

- Repository: <https://github.com/tomoshi-app/tomoshi-dict-data>
- Upstream sources: JMdict, KANJIDIC2, Japanese Wiktionary (via
  kaikki.org Wiktextract), KanjiVG
- Derived layers (Chinese glosses, 写法辨析, 译法辨析, 近义・语体辨析,
  自他配对): © Y1Z / Tomoshi

## Licences

| File | Upstream licence |
|---|---|
| `lookup.json` | CC BY-SA 4.0 (JMdict/KANJIDIC2 lineage, © EDRDG; Tomoshi-derived Chinese layers © Y1Z) |
| `notes.json` | CC BY-SA 4.0 (same lineage) |
| `strokes.json` | CC BY-SA 3.0 (KanjiVG, © Ulrich Apel) |

## Required attribution

Per the JMdict / EDRDG licence statement and CC BY-SA §3(a)(1)(B), this
app must display:

> 词典数据来自 JMdict / KANJIDIC2（© EDRDG）与 KanjiVG（© Ulrich Apel）；
> 中文释义与辨析内容来自 Tomoshi（© Y1Z）。以 CC BY-SA 许可共享。

Where the data appears in the UI, this attribution is shown in the
vocabulary footer (see `components/vocabulary/DictionaryAttribution.tsx`).

## Share-alike note

CC BY-SA is a copyleft licence. The *data* we redistribute must remain
under CC BY-SA (or a compatible licence) and we must state modifications.
The index files here are our own compact re-encoding of the upstream
tables — the encoding is ours, the underlying content is upstream's.
This project is a personal, non-commercial site; the attribution above
satisfies the attribution requirement.

The name **"Tomoshi"** and its logo are trademark identifiers and are not
licensed by the data repository. They are used here only to credit the
source of the data, not to imply that this app is Tomoshi or endorsed by
it.

## Regenerating

```bash
curl -L -o tomoshi-dict-open.db.zst \
  https://github.com/tomoshi-app/tomoshi-dict-data/releases/download/v2026-10-13/tomoshi-dict-open.db.zst
zstd -d tomoshi-dict-open.db.zst
python scripts/build-dict-index.py ./tomoshi-dict-open.db
```

The build script lives at `scripts/build-dict-index.py` in the repo root.
