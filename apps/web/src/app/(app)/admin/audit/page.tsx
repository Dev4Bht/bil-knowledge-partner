import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditPage } from "@/features/audit/audit-page";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

// Auth is client-side (see the (app) layout), so instant-navigation validation is switched off here.
export const instant = false;
export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingRegion label="Loading audit log" className="space-y-4"><Skeleton className="h-9 w-56" /><Skeleton className="h-64" /></LoadingRegion>}>
      <AuditPage />
    </Suspense>
  );
}
