import OpenAI from "openai";
import { NextResponse } from "next/server";

// Force dynamic rendering — never evaluate at build time (env vars not available)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    return NextResponse.json({ text: transcription.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
