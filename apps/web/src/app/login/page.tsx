import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/features/auth/login-screen";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-navy" aria-busy="true" />}>
      <LoginScreen />
    </Suspense>
  );
}
