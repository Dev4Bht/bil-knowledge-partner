import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSearch } from "@/components/ui/icons";
import { LogoMark } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-4 py-10">
      <LogoMark size={44} />
      <EmptyState icon={<IconSearch size={24} />} title="Page not found" action={<Link href="/" className={buttonClasses("primary")}>Go to the start</Link>} className="w-full">
        The page you opened does not exist, or you may not have access to it.
      </EmptyState>
    </main>
  );
}
