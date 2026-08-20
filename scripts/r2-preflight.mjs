// R2 preflight — verify that the api.txt credentials can actually list
// objects in the named bucket. Run before any upload/shareing script.
//
// Per Frank #6429 (Japanese-learning R2 setup, 2026-08-20):
//   - Bucket: jp-audio (NOT faststudy — that was my earlier typo)
//   - Custom domain: audio.frank2025.com (already CNAMEd to R2 by Frank)
//   - Purpose: hosting shadowing-motto MP3 audio for Japanese-learning
//
// Exit codes:
//   0 — token + bucket OK
//   1 — credentials file missing or unreadable
//   2 — endpoint / config parse error
//   3 — ListObjectsV2 returned an error (bad token, no bucket access, etc.)

import { readFile } from "node:fs/promises";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const API_FILE = "F:/WebSite/Japanese-learning-compare/docs/api.txt";

function parseApi(text) {
  // api.txt format (note leading bullet on each label):
  //   • Access Key ID
  //   7998848e534aa1424631f985e5d80d2e
  //   <blank>
  //   • Secret Access Key
  //   b0f9…d5b3
  //   …
  const fields = {
    "Access Key ID": "accessKeyId",
    "Secret Access Key": "secretAccessKey",
    "Bucket name": "bucket",
    "Endpoint URL": "endpoint",
  };
  const out = {};
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    // Strip leading bullet / whitespace, then match label exactly.
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
  let raw;
  try {
    raw = await readFile(API_FILE, "utf-8");
  } catch (e) {
    console.error(`❌ Cannot read ${API_FILE}: ${e.message}`);
    process.exit(1);
  }
  const cfg = parseApi(raw);
  const missing = ["accessKeyId", "secretAccessKey", "bucket", "endpoint"].filter(
    (k) => !cfg[k]
  );
  if (missing.length) {
    console.error(`❌ api.txt missing fields: ${missing.join(", ")}`);
    console.error("Parsed:", Object.keys(cfg).map((k) => `${k}=${cfg[k] ? "✓" : "✗"}`).join(", "));
    process.exit(2);
  }
  console.log(`Bucket:  ${cfg.bucket}`);
  console.log(`Endpoint: ${cfg.endpoint}`);
  console.log(`Access Key: ${cfg.accessKeyId.slice(0, 8)}…`);

  const s3 = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    requestHandler: new NodeHttpHandler({ connectionTimeout: 10_000, requestTimeout: 30_000 }),
  });

  try {
    const cmd = new ListObjectsV2Command({
      Bucket: cfg.bucket,
      MaxKeys: 5,
    });
    const res = await s3.send(cmd);
    const n = res.KeyCount ?? (res.Contents?.length ?? 0);
    console.log(`✅ ListObjectsV2 OK (${n} objects, IsTruncated=${res.IsTruncated})`);
    if (n > 0) {
      for (const obj of res.Contents.slice(0, 5)) {
        console.log(`   • ${obj.Key} (${obj.Size} bytes)`);
      }
    } else {
      console.log("   (bucket is empty — ready for upload)");
    }
    process.exit(0);
  } catch (e) {
    console.error(`❌ ListObjectsV2 failed: ${e.name} ${e.$metadata?.httpStatusCode ?? ""}`);
    console.error(`   ${e.message}`);
    process.exit(3);
  }
}

main().catch((e) => {
  console.error("Unhandled:", e);
  process.exit(99);
});
