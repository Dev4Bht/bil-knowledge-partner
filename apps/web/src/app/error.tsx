"use client";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconAlert } from "@/components/ui/icons";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl items-center px-4">
      <EmptyState icon={<IconAlert size={24} />} title="Something went wrong" action={<Button variant="primary" onClick={reset}>Try again</Button>} className="w-full">
        The page hit an unexpected problem. Your work on the server is safe. Try again, or reload the page.
      </EmptyState>
    </main>
  );
}
