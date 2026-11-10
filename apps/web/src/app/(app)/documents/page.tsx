import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentsPage } from "@/features/documents/documents-page";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

// Auth is client-side (see the (app) layout), so instant-navigation validation is switched off here.
export const instant = false;
export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return (
    <Suspense
      fallback={
        <LoadingRegion label="Loading documents" className="space-y-4">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-64" />
        </LoadingRegion>
      }
    >
      <DocumentsPage />
    </Suspense>
  );
}
