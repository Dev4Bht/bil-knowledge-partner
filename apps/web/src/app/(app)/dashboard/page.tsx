import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPage } from "@/features/dashboard/dashboard-page";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

// Auth is client-side (see the (app) layout), so instant-navigation validation is switched off here.
export const instant = false;
export const metadata: Metadata = { title: "Dashboard" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingRegion label="Loading dashboard" className="space-y-4"><Skeleton className="h-9 w-56" /><Skeleton className="h-40" /></LoadingRegion>}>
      <DashboardPage />
    </Suspense>
  );
}
