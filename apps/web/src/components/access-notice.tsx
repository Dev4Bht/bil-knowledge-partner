import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconLock } from "@/components/ui/icons";

/**
 * Shown for both "does not exist" and "not allowed", with identical wording,
 * so the page never reveals whether a document exists.
 */
export function NotAvailable({ what = "document" }: { what?: string }) {
  return (
    <div className="mx-auto max-w-xl py-10" data-testid="not-available">
      <EmptyState
        icon={<IconLock size={24} />}
        title={`This ${what} is not available`}
        action={
          <Link href="/documents" className={buttonClasses("primary")}>
            Back to documents
          </Link>
        }
      >
        You may not have access to this {what}, or it does not exist. If you think you should see it, ask your manager.
      </EmptyState>
    </div>
  );
}

export function AdminOnly() {
  return (
    <div className="mx-auto max-w-xl py-10" data-testid="admin-only">
      <EmptyState
        icon={<IconLock size={24} />}
        title="This page is not available to you"
        action={
          <Link href="/ask" className={buttonClasses("primary")}>
            Go to Ask
          </Link>
        }
      >
        You may not have access to this page, or it does not exist.
      </EmptyState>
    </div>
  );
}
