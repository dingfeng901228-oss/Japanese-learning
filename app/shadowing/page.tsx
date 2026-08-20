// Server wrapper for the Shadowing MOTTO page. Reads the static corpus
// (generated at build time by scripts/build-motto-sentences.mjs) and
// passes it down to the client component.

import { MOTTO_SENTENCES } from "@/lib/motto-sentences";
import ShadowingClient from "./ShadowingClient";

export const dynamic = "force-dynamic";

export default function ShadowingPage() {
  return <ShadowingClient sentences={MOTTO_SENTENCES} />;
}