"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { ALLOWED_EXTENSIONS, cn, fileExtension, formatBytes } from "@/lib/format";
import { IconCheck, IconDocs, IconUpload, IconX } from "./icons";

export const SOFT_SIZE_LIMIT_MB = 25;

/** Client-side checks give instant feedback. The server repeats every check and is the authority. */
export function checkFile(file: File): { ok: boolean; problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!ALLOWED_EXTENSIONS.includes(fileExtension(file.name))) problems.push("Only PDF, DOCX and TXT files can be uploaded.");
  if (file.size === 0) problems.push("The file is empty.");
  if (file.size > SOFT_SIZE_LIMIT_MB * 1024 * 1024) warnings.push(`Files over ${SOFT_SIZE_LIMIT_MB} MB may be rejected by the server.`);
  return { ok: problems.length === 0, problems, warnings };
}

export function FileDropzone({ file, onFile, error, disabled }: { file: File | null; onFile: (file: File | null) => void; error?: string | null; disabled?: boolean }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const check = file ? checkFile(file) : null;

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-dragging={dragging || undefined}
        className={cn(
          "relative flex flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed px-4 py-7 text-center transition-colors focus-within:border-gold",
          dragging ? "border-gold bg-gold-soft" : "border-line-strong bg-surface-2",
          error && "border-bad",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-info-soft text-info">
          <IconUpload size={22} />
        </span>
        <p className="text-[15px] text-ink">
          <span className="font-semibold">Drag a file here</span>, or
        </p>
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-[8px] border border-line-strong bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-surface-3 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-gold md:min-h-10"
        >
          Browse files
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={disabled}
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="text-[13px] text-muted">PDF, DOCX or TXT. The server checks the file again.</p>
      </div>

      {file && check && (
        <div className={cn("mt-3 flex items-start gap-3 rounded-[10px] border p-3", check.ok ? "border-ok/40 bg-ok-soft" : "border-bad/45 bg-bad-soft")} aria-live="polite">
          <span className={check.ok ? "text-ok" : "text-bad"}>{check.ok ? <IconCheck size={20} /> : <IconDocs size={20} />}</span>
          <div className="min-w-0 flex-1 text-[14px]">
            <p className="truncate font-semibold text-heading">{file.name}</p>
            <p className="text-muted">
              {fileExtension(file.name).toUpperCase() || "Unknown type"}, {formatBytes(file.size)}
            </p>
            {check.problems.map((p) => (
              <p key={p} className="mt-1 font-medium text-bad">
                {p}
              </p>
            ))}
            {check.warnings.map((p) => (
              <p key={p} className="mt-1 font-medium text-warn">
                {p}
              </p>
            ))}
          </div>
          <button type="button" onClick={() => onFile(null)} aria-label="Remove file" className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-black/5">
            <IconX size={16} />
          </button>
        </div>
      )}
      {error && !file && (
        <p className="mt-2 text-[13px] font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
