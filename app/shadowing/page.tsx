// Frank #6643: /shadowing was merged into /listening as the "真人发音"
// mode (accessed via ?mode=realShadow). This page now server-redirects
// so old bookmarks, external links, and any in-flight references still
// land on the new location.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ShadowingPage() {
  redirect("/listening?mode=realShadow");
}