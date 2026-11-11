import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";
import { STATIC_SITE } from "@/lib/static-site";

export const metadata: Metadata = {
  title: { absolute: "BIL Knowledge Partner: sourced answers from approved documents" },
  description:
    "Six cooperating AI agents that answer staff questions only from approved BIL documents, with exact sources, version and conflict checks, and a draft reply for staff to review. Hackathon 2026 prototype.",
  // The public copy is a hackathon prototype using BIL's name: keep it out of search results unless its owners decide otherwise.
  robots: STATIC_SITE ? { index: false, follow: false } : undefined,
};

export default function Home() {
  return <LandingPage />;
}
