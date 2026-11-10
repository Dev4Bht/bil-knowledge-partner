import type { Metadata } from "next";
import { Suspense } from "react";
import { AskPage } from "@/features/ask/ask-page";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

// Auth is client-side (see the (app) layout), so instant-navigation validation is switched off here.
export const instant = false;
export const metadata: Metadata = { title: "Ask" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingRegion label="Loading Ask" className="space-y-4"><Skeleton className="h-9 w-72" /><Skeleton className="h-48" /></LoadingRegion>}>
      <AskPage />
    </Suspense>
  );
}
