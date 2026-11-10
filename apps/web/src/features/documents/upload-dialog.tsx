"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ApiError, uploadDocument, uploadVersion } from "@/lib/api";
import { BUSINESS_LINES, fileExtension } from "@/lib/format";
import type { AccessClassification, BusinessLineCode, DocumentDetail, DocVersion, Folder } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Field, Select, TextArea, TextInput } from "@/components/ui/fields";
import { checkFile, FileDropzone } from "@/components/ui/file-dropzone";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";

export type UploadTarget =
  | { kind: "document"; folders: Folder[]; defaultBusinessLine?: BusinessLineCode | null; defaultFolderId?: string | null }
  | { kind: "version"; documentId: string; documentTitle: string };

const NO_FOLDERS: Folder[] = [];
const ROLE_CHOICES = ["manager", "staff"];

export function UploadDialog({ open, onClose, target, onDone }: {
  open: boolean;
  onClose: () => void;
  target: UploadTarget;
  onDone: (result: DocumentDetail | DocVersion) => void;
}) {
  // Remount the form each time the dialog opens so it always starts clean.
  if (!open) return null;
  return <UploadForm onClose={onClose} target={target} onDone={onDone} />;
}

function UploadForm({ onClose, target, onDone }: { onClose: () => void; target: UploadTarget; onDone: (r: DocumentDetail | DocVersion) => void }) {
  const toast = useToast();
  const isDocument = target.kind === "document";
  const folders = target.kind === "document" ? target.folders : NO_FOLDERS;
  const initialLine: BusinessLineCode = isDocument
    ? (target.defaultBusinessLine ??
        folders.find((f) => f.id === target.defaultFolderId)?.business_line ??
        "general_insurance")
    : "general_insurance";

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [line, setLine] = useState<BusinessLineCode>(initialLine);
  const [folderId, setFolderId] = useState(isDocument ? (target.defaultFolderId ?? "") : "");
  const [classification, setClassification] = useState<AccessClassification>("staff");
  const [roles, setRoles] = useState<string[]>(["manager"]);
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const lineFolders = useMemo(() => folders.filter((f) => f.business_line === line), [folders, line]);
  const effectiveFolderId = lineFolders.some((f) => f.id === folderId) ? folderId : "";
  const dirty = !!file || title.trim() !== "" || description.trim() !== "";
  const fileCheck = file ? checkFile(file) : null;

  const requestClose = () => {
    if (busy) return;
    if (dirty && !confirmDiscard) setConfirmDiscard(true);
    else onClose();
  };

  const handleFile = (next: File | null) => {
    setFile(next);
    setError(null);
    if (next && !titleTouched && isDocument) setTitle(next.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim());
  };

  const fieldErrors = {
    file: !file ? "Choose a file to upload." : fileCheck && !fileCheck.ok ? fileCheck.problems[0] : null,
    title: isDocument && !title.trim() ? "Give the document a title." : null,
    folder: isDocument && !effectiveFolderId ? "Choose a folder." : null,
    roles: isDocument && classification === "restricted" && roles.length === 0 ? "A restricted document needs at least one role that may read it." : null,
    dates: from && to && to < from ? "The end date is before the start date." : null,
  };
  const invalid = Object.values(fieldErrors).some(Boolean);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setShowErrors(true);
    if (invalid || !file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    if (label.trim()) form.append("version_label", label.trim());
    if (from) form.append("effective_from", from);
    if (to) form.append("effective_to", to);
    form.append("language", language);
    try {
      if (isDocument) {
        form.append("title", title.trim());
        form.append("description", description.trim());
        form.append("business_line", line);
        form.append("folder_id", effectiveFolderId);
        form.append("access_classification", classification);
        if (classification === "restricted") form.append("access_roles", roles.join(","));
        const created = await uploadDocument(form);
        toast({ tone: "success", title: "Document uploaded as a draft", description: "A manager or admin must approve it before it becomes current." });
        onDone(created);
      } else {
        const created = await uploadVersion(target.documentId, form);
        toast({ tone: "success", title: `${created.version_label} uploaded as a draft`, description: "Approve it to make it the current version." });
        onDone(created);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The upload failed. Please try again.");
      setBusy(false);
    }
  };

  const formId = "upload-form";
  return (
    <Dialog
      open
      onClose={requestClose}
      size="lg"
      title={isDocument ? "Upload a document" : `Upload a new version`}
      description={isDocument ? "The file becomes version 1 as a draft. It is not visible to staff until approved." : `For ${target.documentTitle}. It starts as a draft and does not replace the current version until approved.`}
      footer={
        confirmDiscard ? (
          <>
            <p className="mr-auto text-[14px] font-medium text-heading">Discard this upload? The file and details will be lost.</p>
            <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
            <Button variant="danger" onClick={onClose}>
              Discard
            </Button>
          </>
        ) : (
          <>
            <Button onClick={requestClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" form={formId} variant="primary" loading={busy}>
              {busy ? "Uploading…" : "Upload as draft"}
            </Button>
          </>
        )
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
        <Callout kind="info" title="Only unclassified, public-facing documents">
          Do not upload customer personal data. Files containing national ID style numbers are rejected.
        </Callout>
        {error && (
          <Callout kind="error" title="The upload was not accepted">
            {error}
          </Callout>
        )}

        <Field label="File">
          <FileDropzone file={file} onFile={handleFile} disabled={busy} error={showErrors ? fieldErrors.file : null} />
        </Field>

        {isDocument && (
          <>
            <Field label="Title" htmlFor="up-title" error={showErrors ? fieldErrors.title : null}>
              <TextInput
                id="up-title"
                value={title}
                maxLength={300}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                aria-invalid={!!(showErrors && fieldErrors.title) || undefined}
              />
            </Field>
            <Field label="Description" htmlFor="up-desc" optional>
              <TextArea id="up-desc" value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business line" htmlFor="up-line">
                <Select id="up-line" value={line} onChange={(e) => setLine(e.target.value as BusinessLineCode)}>
                  {BUSINESS_LINES.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Folder" htmlFor="up-folder" error={showErrors ? fieldErrors.folder : null}>
                <Select id="up-folder" value={effectiveFolderId} onChange={(e) => setFolderId(e.target.value)} aria-invalid={!!(showErrors && fieldErrors.folder) || undefined}>
                  <option value="">Choose a folder</option>
                  {lineFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.path}
                      {f.required_role ? ` (${f.required_role} only)` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Who can read it" htmlFor="up-class" hint={classification === "public" ? "Any signed-in user." : classification === "staff" ? "Staff, managers and admins." : "Only the roles you pick, plus admins."}>
                <Select id="up-class" value={classification} onChange={(e) => setClassification(e.target.value as AccessClassification)}>
                  <option value="public">Public (any signed-in user)</option>
                  <option value="staff">Staff</option>
                  <option value="restricted">Restricted</option>
                </Select>
              </Field>
              {classification === "restricted" && (
                <fieldset>
                  <legend className="mb-1.5 text-[14px] font-semibold text-heading">Roles allowed</legend>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_CHOICES.map((role) => (
                      <label key={role} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[6px] border border-line-strong bg-surface px-3 text-[15px] capitalize has-[:checked]:border-gold has-[:checked]:bg-gold-soft md:min-h-10">
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--navy-soft)]"
                          checked={roles.includes(role)}
                          onChange={(e) => setRoles((cur) => (e.target.checked ? [...cur, role] : cur.filter((r) => r !== role)))}
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                  {showErrors && fieldErrors.roles && (
                    <p className="mt-1.5 text-[13px] font-medium text-bad" role="alert">
                      {fieldErrors.roles}
                    </p>
                  )}
                </fieldset>
              )}
            </div>
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Version label" htmlFor="up-label" optional hint="Leave blank to number it automatically.">
            <TextInput id="up-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="v2" />
          </Field>
          <Field label="Language" htmlFor="up-lang">
            <Select id="up-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="en">English</option>
              <option value="dz">Dzongkha</option>
            </Select>
          </Field>
          <Field label="Effective from" htmlFor="up-from" optional>
            <TextInput id="up-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Effective to" htmlFor="up-to" optional error={showErrors ? fieldErrors.dates : null}>
            <TextInput id="up-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-invalid={!!(showErrors && fieldErrors.dates) || undefined} />
          </Field>
        </div>
        {file && fileExtension(file.name) === "txt" && <p className="text-[13px] text-muted">Text files can be compared line by line against other versions.</p>}
      </form>
    </Dialog>
  );
}
