"use client";

// Login page. Two paths:
//   1. Continue with Google (OAuth via Supabase)
//   2. Magic link — enter an email, Supabase emails a single-use login
//      link, click it to land on the site already authenticated.
//
// Magic link is the fallback that doesn't depend on Google OAuth
// configuration. Same layout rules per docs/requirements2.docx §9.
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GoogleButton } from "@/components/GoogleButton";
import {
  signInWithGoogleAction,
  signInWithMagicLinkAction,
} from "@/app/auth/actions";

function LoginInner() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const successCode = searchParams.get("success");
  const sentEmail = searchParams.get("email");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <h1 className="text-3xl font-bold mb-2">FastStudy</h1>
        <p className="text-gray-600 mb-8">Learn smarter. Remember longer.</p>

        <form action={signInWithGoogleAction}>
          <GoogleButton />
        </form>

        <div className="relative my-6" aria-hidden="true">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-3 bg-white text-gray-500">或使用邮箱</span>
          </div>
        </div>

        <form action={signInWithMagicLinkAction} className="space-y-3">
          <label htmlFor="email" className="sr-only">
            邮箱地址
          </label>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            aria-label="邮箱地址"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center"
          />
          <button
            type="submit"
            className="w-full px-5 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all"
          >
            发送登录链接
          </button>
        </form>

        {successCode === "magic_link_sent" && sentEmail && (
          <p
            role="status"
            aria-live="polite"
            className="mt-4 text-sm text-green-600"
          >
            ✓ 登录链接已发送到 <strong>{sentEmail}</strong>。请检查邮箱（包括垃圾邮件）。
          </p>
        )}

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
      return "登录链接已过期或无效，请重新尝试。";
    case "access_denied":
      return "Google 登录被取消，请重新尝试。";
    case "oauth_failed":
      return "Google 登录未完成，请重新尝试。";
    case "signout_failed":
      return "退出失败，请重试。";
    case "magic_link_failed":
      return "发送登录链接失败，请检查邮箱或稍后再试。";
    case "invalid_email":
      return "邮箱地址格式不正确，请检查。";
    default:
      return "登录失败，请重新尝试。";
  }
}