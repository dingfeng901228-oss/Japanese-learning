import type { MetadataRoute } from "next";

const SITE_URL = "https://jp.frank2025.com";

// Public-facing routes that should be indexed by Google. User-specific or
// auth-gated routes are intentionally excluded (/login, /vocabulary/[id],
// /vocabulary/new, /api/*, /auth/*) — Google doesn't need to crawl them and
// indexing them adds noise to Search Console.
const ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/",            changeFrequency: "daily",   priority: 1.0 },
  // Frank #6671 (UI优化.docx): /today removed. Frank #6767 cleanup
  // — drop the stale sitemap entry (it would 404 anyway).
  { path: "/listening",   changeFrequency: "weekly",  priority: 0.8 },
  { path: "/speaking",    changeFrequency: "weekly",  priority: 0.8 },
  { path: "/vocabulary",  changeFrequency: "daily",   priority: 0.8 },
  { path: "/review",      changeFrequency: "weekly",  priority: 0.7 },
  { path: "/progress",    changeFrequency: "weekly",  priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
