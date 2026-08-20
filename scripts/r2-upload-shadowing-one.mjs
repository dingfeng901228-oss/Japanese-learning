// Single-directory variant of r2-upload-shadowing.mjs.
// Used when one of the two motto dirs is empty (e.g. only the (1) set
// is ready, the (2) set hasn't been staged yet). Re-run is idempotent.

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const API_FILE = "F:/WebSite/Japanese-learning-compare/docs/api.txt";
// Hardcoded one entry, Unicode-escaped to avoid mojibake:
//   F:\日语学习资料\shadowin-motto_all（1）
const TARGET = {
  dir:
    "F:\\" +
    "\u65e5\u8bed\u5b66\u4e60\u8d44\u6599" +
    "\\shadowin-motto_all\uff081\uff09",
  prefix: "shadowing/motto-2/",
};
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

async function main() {
  const cfg = parseApi(await readFile(API_FILE, "utf-8"));
  for (const k of ["accessKeyId", "secretAccessKey", "bucket", "endpoint"]) {
    if (!cfg[k]) {
      console.error(`❌ api.txt missing field: ${k}`);
      process.exit(1);
    }
  }
  console.log(`Bucket:  ${cfg.bucket}`);
  console.log(`Source:  ${TARGET.dir}`);
  console.log(`Prefix:  ${TARGET.prefix}`);

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

  let files;
  try {
    files = (await readdir(TARGET.dir))
      .filter((f) => f.toLowerCase().endsWith(".mp3"))
      .sort();
  } catch (e) {
    console.error(`❌ readdir failed: ${e.message} — ${TARGET.dir}`);
    process.exit(2);
  }
  if (files.length === 0) {
    console.error(`❌ No MP3 files in ${TARGET.dir}`);
    process.exit(2);
  }
  console.log(`${files.length} MP3 files to upload`);

  const t0 = Date.now();
  let uploaded = 0;
  let failed = 0;
  let totalBytes = 0;
  const queue = files.slice();

  async function uploadOne(f) {
    const key = TARGET.prefix + f;
    const filePath = join(TARGET.dir, f);
    try {
      const size = (await stat(filePath)).size;
      const body = await readFile(filePath);
      await s3.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: key,
          Body: body,
          ContentType: "audio/mpeg",
          ContentLength: size,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      uploaded++;
      totalBytes += size;
    } catch (e) {
      failed++;
      console.error(`  ❌ ${key}: ${e.name} ${e.message}`);
    }
  }

  async function worker() {
    while (queue.length > 0) {
      const f = queue.shift();
      if (!f) return;
      await uploadOne(f);
      if (uploaded % 10 === 0 || queue.length === 0) {
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        const mb = (totalBytes / 1024 / 1024).toFixed(1);
        console.log(
          `  ${uploaded + failed}/${files.length} (${elapsed}s, ${mb} MB)`
        );
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

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
