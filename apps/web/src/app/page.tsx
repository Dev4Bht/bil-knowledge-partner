import type { Metadata } from "next";
import { LandingPage } from "@/features/landing/landing-page";

export const metadata: Metadata = {
  title: { absolute: "BIL Knowledge Partner: sourced answers from approved documents" },
  description:
    "Six cooperating AI agents that answer staff questions only from approved BIL documents, with exact sources, version and conflict checks, and a draft reply for staff to review. Hackathon 2026 prototype.",
};

export default function Home() {
  return <LandingPage />;
}
