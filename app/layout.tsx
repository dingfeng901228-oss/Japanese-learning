import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FastStudy 2.0 — AI 日语口语教练",
  description: "Don't just study Japanese. Use Japanese.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen bg-gradient-to-b from-white to-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
