import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentDetailPage, DocumentDetailSkeleton } from "@/features/documents/document-detail";

// Auth is client-side (see the (app) layout), so instant-navigation validation is switched off here.
export const instant = false;
export const metadata: Metadata = { title: "Document" };

export default function Page({ params }: PageProps<"/documents/[documentId]">) {
  return (
    <Suspense fallback={<DocumentDetailSkeleton />}>
      {params.then(({ documentId }) => (
        <DocumentDetailPage documentId={documentId} />
      ))}
    </Suspense>
  );
}
