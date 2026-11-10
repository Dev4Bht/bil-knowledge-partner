import type { ReactNode } from "react";
import { CLASSIFICATION_LABEL, STATUS_LABEL, cn } from "@/lib/format";
import type { AccessClassification, VersionStatus } from "@/lib/types";
import { IconArchive, IconCheck, IconClock, IconDocs, IconLock, IconBook } from "./icons";

export type Tone = "neutral" | "ok" | "warn" | "bad" | "info" | "gold";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-ink border-line",
  ok: "bg-ok-soft text-ok border-ok/30",
  warn: "bg-warn-soft text-warn border-warn/35",
  bad: "bg-bad-soft text-bad border-bad/35",
  info: "bg-info-soft text-info border-info/30",
  gold: "bg-gold-soft text-gold-ink border-gold/45",
};

export function Badge({ tone = "neutral", icon, children, className, title }: {
  tone?: Tone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] border px-1.5 py-px text-[12px] font-medium leading-5",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<VersionStatus, Tone> = { approved_current: "ok", draft: "warn", superseded: "neutral", archived: "neutral" };
const STATUS_ICON: Record<VersionStatus, ReactNode> = {
  approved_current: <IconCheck size={13} strokeWidth={2.4} />,
  draft: <IconClock size={13} />,
  superseded: <IconBook size={13} />,
  archived: <IconArchive size={13} />,
};

/** Status is never colour-only: every badge carries an icon and a text label. */
export function StatusBadge({ status }: { status: VersionStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} icon={STATUS_ICON[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function DemoBadge() {
  return (
    <Badge tone="gold" title="Fictional demo fixture. Not BIL policy." icon={<IconDocs size={13} />}>
      DEMO
    </Badge>
  );
}

export function ClassificationBadge({ value }: { value: AccessClassification }) {
  return (
    <Badge tone={value === "restricted" ? "bad" : value === "staff" ? "info" : "neutral"} icon={value === "restricted" ? <IconLock size={13} /> : undefined}>
      {CLASSIFICATION_LABEL[value]}
    </Badge>
  );
}

/** The normal state is shown quietly; only exceptions (draft, superseded, archived) get a tag. */
export function StatusMark({ status }: { status: VersionStatus }) {
  if (status !== "approved_current") return <StatusBadge status={status} />;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ok">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
      {STATUS_LABEL[status]}
    </span>
  );
}
