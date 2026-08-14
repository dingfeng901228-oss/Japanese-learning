"use client";

// Login page. Single action: "Continue with Google".
// Layout per docs/requirements2.docx §9 — header, tagline, button only.
// Loads the official-ish Google "G" colour logo inline (no external
// network call from the page itself).
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GoogleButton } from "@/components/GoogleButton";
import { signInWithGoogleAction } from "@/app/auth/actions";

function LoginInner() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-2">FastStudy</h1>
        <p className="text-gray-600 mb-8">Learn smarter. Remember longer.</p>

        <form action={signInWithGoogleAction}>
          <GoogleButton />
        </form>

        {errorCode && (
          <p
            role="alert"
            aria-live="polite"
            className="mt-4 text-sm text-red-600"
          >
            {humanizeError(errorCode)}
          </p>
        )}

        <p className="mt-12 text-xs text-gray-400">
          Your personal AI study assistant
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams() in Next.js 15 must be wrapped in a Suspense boundary.
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center text-gray-400">
        加载中…
      </main>
    }>
      <LoginInner />
    </Suspense>
  );
}

// Per requirements2.docx §13 — clear, human-readable messages — not
// "Something went wrong".  Codes:
function humanizeError(code: string): string {
  switch (code) {
    case "auth-callback-failed":
      return "Google 登录回调失败，请重新尝试。";
    case "access_denied":
      return "Google 登录被取消，请重新尝试。";
    case "oauth_failed":
      return "Google 登录未完成，请重新尝试。";
    case "signout_failed":
      return "退出失败，请重试。";
    default:
      return "登录失败，请重新尝试。";
  }
}
