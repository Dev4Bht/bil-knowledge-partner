import { Suspense } from "react";
import { AuthGate, ShellSkeleton } from "@/components/shell/app-shell";

// Sign-in state lives in an httpOnly cookie issued by the API on another origin, so the server cannot know who
// is signed in. The shell therefore renders a skeleton until the client has asked /auth/me, and pages cannot be
// validated as "instant". This is deliberate; each page still streams behind its own <Suspense> skeleton.
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
