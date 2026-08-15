import OpenAI from "openai";
import { NextResponse } from "next/server";

// Force dynamic rendering — never evaluate at build time (env vars not available)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// P1.A — server-side size guard.
// OpenAI gpt-4o-transcribe hard limit per audio file (per their API docs).
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// Vercel Hobby serverless body limit. Vercel docs say 4.5MB max body
// for Hobby; Pro goes to 4.5MB too unless explicitly raised via
// `export const maxDuration` etc. Body limit is set per-deployment.
// We surface a friendly 413 with `hint: "chunk-required"` so the
// client knows to either re-record shorter or chunk the audio.
const VERCEL_BODY_LIMIT = 4 * 1024 * 1024 + 512 * 1024; // ~4.5 MB

// Estimated webm/opus bitrate for MediaRecorder default in Chromium/Firefox.
// 64 kbps (mono speech codec) → bytes * 8 / 64000 ≈ seconds.
// This is a rough heuristic — actual bitrate varies (24k–128k). Good
// enough for an upper-bound sanity check, not for precise UI feedback.
const ESTIMATED_BITRATE_BPS = 64_000;

function estimateDurationSec(bytes: number): number {
  return Math.round((bytes * 8) / ESTIMATED_BITRATE_BPS);
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // P1.A — pre-flight size check via Content-Length.
    // We bail *before* calling req.formData() so we don't waste CPU on
    // parsing a multi-MB multipart body that we'll reject anyway.
    const contentLength = parseInt(
      req.headers.get("content-length") ?? "0",
      10
    );

    if (contentLength > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Audio too large. Max 25MB. Got ${(contentLength / 1024 / 1024).toFixed(1)}MB.`,
          maxBytes: MAX_BYTES,
        },
        { status: 413 }
      );
    }

    if (contentLength > VERCEL_BODY_LIMIT) {
      // Vercel serverless body limit — recommend client chunking.
      return NextResponse.json(
        {
          error: `Audio too large for current Vercel plan. Max ~4MB. Got ${(contentLength / 1024 / 1024).toFixed(1)}MB. Try shorter recording or chunk client-side.`,
          maxBytes: VERCEL_BODY_LIMIT,
          hint: "chunk-required",
        },
        { status: 413 }
      );
    }

    const form = await req.formData();
    const file = form.get("audio");

    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: "audio file is required (multipart field 'audio')" },
        { status: 400 }
      );
    }

    // `gpt-4o-transcribe` is OpenAI's Japanese-friendly STT model.
    // Browser MediaRecorder produces webm/opus — OpenAI SDK accepts any Blob-like.
    const transcription = await client.audio.transcriptions.create({
      file: file as unknown as File,
      model: "gpt-4o-transcribe",
      language: "ja",
      response_format: "json",
    });

    return NextResponse.json({
      text: transcription.text,
      durationSec: estimateDurationSec(file.size),
      modelUsed: "gpt-4o-transcribe",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
