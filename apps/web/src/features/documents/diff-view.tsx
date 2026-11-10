import { cn } from "@/lib/format";
import type { DiffLine } from "@/lib/types";

const MARK: Record<DiffLine["kind"], string> = { add: "+", del: "-", ctx: " ", hunk: "@@" };
const KIND_LABEL: Record<DiffLine["kind"], string> = { add: "Added", del: "Removed", ctx: "Unchanged", hunk: "Section" };

export function summarizeDiff(lines: DiffLine[]) {
  return { added: lines.filter((l) => l.kind === "add").length, removed: lines.filter((l) => l.kind === "del").length };
}

/** A line diff. Added and removed lines carry +/- marks and screen reader labels, never colour alone. */
export function DiffView({ lines }: { lines: DiffLine[] }) {
  const { added, removed } = summarizeDiff(lines);
  if (added === 0 && removed === 0) {
    return <p className="rounded-[10px] border border-line bg-surface-2 p-4 text-[15px] text-ink">These two versions have identical text.</p>;
  }
  return (
    <div>
      <p className="mb-2 text-[14px] text-muted" aria-live="polite">
        <span className="font-semibold text-ok">{added} added</span>, <span className="font-semibold text-bad">{removed} removed</span>
      </p>
      <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
        <table className="w-full border-collapse font-mono text-[13px] leading-6">
          <caption className="sr-only">Line differences between the two versions</caption>
          <tbody>
            {lines.map((line, index) => (
              <tr
                key={index}
                data-kind={line.kind}
                className={cn(line.kind === "add" && "bg-[var(--diff-add)]", line.kind === "del" && "bg-[var(--diff-del)]", line.kind === "hunk" && "bg-info-soft text-info")}
              >
                <td aria-hidden="true" className="w-8 select-none px-2 text-center font-bold text-muted">
                  {MARK[line.kind]}
                </td>
                <td className={cn("whitespace-pre-wrap break-words px-2 py-px", line.kind === "del" && "line-through decoration-bad/50")}>
                  <span className="sr-only">{KIND_LABEL[line.kind]}: </span>
                  {line.text || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
