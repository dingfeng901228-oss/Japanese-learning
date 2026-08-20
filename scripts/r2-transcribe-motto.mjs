// Batch STT transcription for motto MP3s already uploaded to R2 bucket jp-audio.
//
// Per Frank #6429/#6442 (2026-08-20):
//   - 80 (motto-2) + 54 (motto-1) = 134 MP3 shadowing-motto recordings
//   - Transcribe via OpenAI gpt-4o-transcribe (Japanese)
//   - Persist to lib/motto-sentences.ts as the new shadowing corpus
//   - Expose via custom domain audio.frank2025.com
//
// Process:
//   1) For each MP3 in (1) and (2): fetch via audio.frank2025.com URL
//   2) POST to OpenAI /v1/audio/transcriptions (model=gpt-4o-transcribe)
//   3) Build JSON {id, ja, audioUrl, prefix, idx, transcript}
//   4) Write data/motto-transcripts.json (raw STT output for review)
//   5) Once happy, hand off to lib/motto-sentences.ts (the script does NOT
//      edit source — just persists the JSON dump)
//
// Idempotent: re-running resumes via checkpoint file (data/.motto-stt.json).

import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const API_FILE = "F:/WebSite/Japanese-learning-compare/docs/api.txt";
const ENV_FILE = "F:/WebSite/Japanese-learning-compare/.env.local";
const CHECKPOINT = "F:/WebSite/Japanese-learning-compare/data/.motto-stt.json";
const OUTPUT = "F:/WebSite/Japanese-learning-compare/data/motto-transcripts.json";

// Japanese paths via Unicode escapes (avoids UTF-8 mojibake).
const SOURCES = [
  {
    dir:
      "F:\\" +
      "\u65e5\u8bed\u5b66\u4e60\u8d44\u6599" +
      "\\shadowin-motto_all (2)\\shadowin-motto_all",
    prefix: "shadowing/motto-1/",
  },
  {
    dir:
      "F:\\" +
      "\u65e5\u8bed\u5b66\u4e60\u8d44\u6599" +
      "\\shadowin-motto_all\uff081\uff09",
    prefix: "shadowing/motto-2/",
  },
];
const PUBLIC_BASE = "https://audio.frank2025.com";

function parseApi(text) {
  const fields = {
    "Access Key ID": "accessKeyId",
    "Secret Access Key": "secretAccessKey",
    "Bucket name": "bucket",
    "Endpoint URL": "endpoint",
  };
  const out = {};
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const cleaned = line.replace(/^[•\s]+/, "").trim();
    const label = Object.keys(fields).find((l) => cleaned === l);
    if (label) {
      cur = fields[label];
      out[cur] = "";
    } else if (cur && line.trim()) {
      out[cur] = (out[cur] || "") + line.trim();
    }
  }
  return out;
}

async function readEnv() {
  try {
    const raw = await readFile(ENV_FILE, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^OPENAI_API_KEY=(.+)$/);
      if (m) return m[1].trim();
    }
  } catch {}
  return process.env.OPENAI_API_KEY || "";
}

async function loadCheckpoint() {
  try {
    return JSON.parse(await readFile(CHECKPOINT, "utf-8"));
  } catch {
    return { done: [], failed: [] };
  }
}
async function saveCheckpoint(cp) {
  await writeFile(CHECKPOINT, JSON.stringify(cp, null, 2), "utf-8");
}

async function fetchBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url} → HTTP ${r.status}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab);
}

async function transcribe(apiKey, audioBuf, filename) {
  // Node 18+ FormData + Blob support
  const form = new FormData();
  form.append(
    "file",
    new Blob([audioBuf], { type: "audio/mpeg" }),
    filename
  );
  form.append("model", "gpt-4o-transcribe");
  form.append("language", "ja");
  form.append("response_format", "json");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  return j.text;
}

async function main() {
  const apiText = await readFile(API_FILE, "utf-8");
  const cfg = parseApi(apiText);
  for (const k of ["accessKeyId", "secretAccessKey", "bucket", "endpoint"]) {
    if (!cfg[k]) {
      console.error(`❌ api.txt missing ${k}`);
      process.exit(1);
    }
  }
  const apiKey = await readEnv();
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY not set in .env.local or env");
    process.exit(1);
  }
  console.log(`OpenAI key: ${apiKey.slice(0, 12)}…`);
  console.log(`Bucket:     ${cfg.bucket}`);

  // Probe the public domain first — fail fast if custom domain not live.
  const probe = await fetch(`${PUBLIC_BASE}/shadowing/motto-2/01.mp3`);
  if (!probe.ok) {
    console.error(`❌ ${PUBLIC_BASE}/shadowing/motto-2/01.mp3 → ${probe.status}`);
    process.exit(2);
  }
  await probe.arrayBuffer(); // drain
  console.log(`✅ ${PUBLIC_BASE} reachable\n`);

  const cp = await loadCheckpoint();
  const results = [];
  let totalOk = 0;
  let totalFail = 0;

  for (const { dir, prefix } of SOURCES) {
    const files = (await readdir(dir))
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .sort();
    console.log(`\n[${prefix}] ${files.length} files`);
    let dirOk = 0;
    for (const f of files) {
      const key = prefix + f;
      const id = `${prefix.endsWith("1/") ? "m1" : "m2"}-${f.replace(/\.mp3$/, "")}`;
      if (cp.done.includes(id)) {
        dirOk++;
        continue;
      }
      const url = `${PUBLIC_BASE}/${key}`;
      try {
        const buf = await fetchBuffer(url);
        const text = await transcribe(apiKey, buf, f);
        results.push({ id, prefix, filename: f, url, ja: text });
        cp.done.push(id);
        dirOk++;
        totalOk++;
        if (dirOk % 10 === 0) {
          console.log(`  ${dirOk}/${files.length}`);
          await saveCheckpoint(cp);
        }
      } catch (e) {
        totalFail++;
        cp.failed.push({ id, error: e.message });
        console.error(`  ❌ ${id}: ${e.message}`);
      }
      // gentle pacing — OpenAI rate limit
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`  ${dirOk}/${files.length}`);
    await saveCheckpoint(cp);
  }

  await writeFile(OUTPUT, JSON.stringify(results, null, 2), "utf-8");
  console.log(
    `\n${totalFail === 0 ? "✅" : "⚠️"} Done — ${totalOk} ok, ${totalFail} failed → ${OUTPUT}`
  );
  process.exit(totalFail === 0 ? 0 : 3);
}

main().catch((e) => {
  console.error("Unhandled:", e);
  process.exit(99);
});