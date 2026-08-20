// R2 upload — Shadowing MOTTO MP3 sync to jp-audio bucket.
//
// Per Frank #6429 (2026-08-20): sync the 80+80 MP3 pairs from
// shadowin-motto_all directories to the jp-audio R2 bucket, exposed
// via custom domain audio.frank2025.com.
//
// Paths are hardcoded with Unicode escapes (\uXXXX) to avoid the
// UTF-8 mojibake chain that hits when the script source / JSON
// config / PowerShell stdout all play together. The escapes decode
// at runtime to the correct Japanese characters.
//
// Re-run is idempotent (overwrites existing keys).
//
// Exit codes:
//   0 — all uploads succeeded
//   1 — api.txt missing/unreadable
//   2 — local directory missing
//   3 — some uploads failed

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const API_FILE = "F:/WebSite/Japanese-learning-compare/docs/api.txt";

// Japanese paths via Unicode escapes — pure ASCII source code, no
// encoding mangle possible. Decodes to:
//   F:\日语学习资料\shadowin-motto_all (2)
//   F:\日语学习资料\shadowin-motto_all（1）
// Per Frank #6442 (2026-08-20): the (2) set is actually nested one level
// deeper than the (1) set. Update SHADOWING_DIRS so the (2) entry points at
// the actual leaf dir that holds the 54 MP3s.
const SHADOWING_DIRS = [
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
const CONCURRENCY = 5;

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

async function listMp3s(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch (e) {
    throw new Error(`readdir failed: ${e.code ?? e.message}`);
  }
  return entries.filter((f) => f.toLowerCase().endsWith(".mp3")).sort();
}

async function uploadOne(s3, bucket, key, filePath, size) {
  const body = await readFile(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "audio/mpeg",
      ContentLength: size,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
}

async function main() {
  let raw;
  try {
    raw = await readFile(API_FILE, "utf-8");
  } catch (e) {
    console.error(`❌ ${API_FILE}: ${e.message}`);
    process.exit(1);
  }
  const cfg = parseApi(raw);
  for (const k of ["accessKeyId", "secretAccessKey", "bucket", "endpoint"]) {
    if (!cfg[k]) {
      console.error(`❌ api.txt missing field: ${k}`);
      process.exit(1);
    }
  }
  console.log(`Bucket:  ${cfg.bucket}`);
  console.log(`Endpoint: ${cfg.endpoint}`);

  for (const d of SHADOWING_DIRS) {
    console.log(`[${d.prefix}] ${d.dir}`);
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 10_000,
      requestTimeout: 60_000,
    }),
  });

  const t0 = Date.now();
  let uploaded = 0;
  let failed = 0;
  let totalBytes = 0;

  for (const { dir, prefix } of SHADOWING_DIRS) {
    let files;
    try {
      files = await listMp3s(dir);
    } catch (e) {
      console.error(`❌ ${e.message} — ${dir}`);
      process.exit(2);
    }
    if (files.length === 0) {
      console.error(`❌ No MP3 files in ${dir}`);
      process.exit(2);
    }
    console.log(`\n${files.length} MP3 files in ${dir}`);

    let dirDone = 0;
    const queue = files.slice();
    async function worker() {
      while (queue.length > 0) {
        const f = queue.shift();
        if (!f) return;
        const key = prefix + f;
        const filePath = join(dir, f);
        try {
          const size = (await stat(filePath)).size;
          await uploadOne(s3, cfg.bucket, key, filePath, size);
          uploaded++;
          dirDone++;
          totalBytes += size;
          if (dirDone % 10 === 0 || dirDone === files.length) {
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            console.log(`  ${dirDone}/${files.length} (${elapsed}s)`);
          }
        } catch (e) {
          failed++;
          console.error(`  ❌ ${key}: ${e.name} ${e.message}`);
        }
      }
    }
    await Promise.all(
      Array.from({ length: CONCURRENCY }, () => worker())
    );
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const mb = (totalBytes / 1024 / 1024).toFixed(1);
  console.log(
    `\n${failed === 0 ? "✅" : "⚠️"} Done in ${elapsed}s — ${uploaded} uploaded (${mb} MB), ${failed} failed`
  );
  process.exit(failed === 0 ? 0 : 3);
}

main().catch((e) => {
  console.error("Unhandled:", e);
  process.exit(99);
});
