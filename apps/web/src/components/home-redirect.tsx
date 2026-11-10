"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/session";
import { LoadingRegion, Skeleton } from "@/components/ui/skeleton";

/** "/" sends signed-in users to /ask and everyone else to /login. */
export function HomeRedirect() {
  const { state } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "authenticated") router.replace("/ask");
    else if (state.status === "anonymous") router.replace("/login");
  }, [state.status, router]);
  return (
    <LoadingRegion label="Loading BIL Knowledge Partner" className="mx-auto max-w-md space-y-3 p-10">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24" />
    </LoadingRegion>
  );
}
