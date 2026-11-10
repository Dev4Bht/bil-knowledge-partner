import type { AccessClassification, BusinessLineCode, User, VersionStatus } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2024-01-01" or a full ISO timestamp becomes "1 Jan 2024". Date-only values are never shifted by time zone. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "Not set";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return `${Number(dateOnly[3])} ${MONTHS[Number(dateOnly[2]) - 1]} ${dateOnly[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${formatDate(value)}, ${time}`;
}

export function relativeTime(value: string, now: number = Date.now()): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return value;
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const shortHash = (hash: string) => hash.slice(0, 10);

export const BUSINESS_LINES: { code: BusinessLineCode; name: string; short: string }[] = [
  { code: "general_insurance", name: "General Insurance", short: "General Insurance" },
  { code: "credit", name: "Credit", short: "Credit" },
  { code: "pf_gf", name: "PF/GF", short: "PF/GF" },
  { code: "corporate", name: "Corporate", short: "Corporate" },
];

export const businessLineName = (code: string) => BUSINESS_LINES.find((b) => b.code === code)?.name ?? code;

export const STATUS_LABEL: Record<VersionStatus, string> = {
  draft: "Draft",
  approved_current: "Current",
  superseded: "Superseded",
  archived: "Archived",
};

export const CLASSIFICATION_LABEL: Record<AccessClassification, string> = {
  public: "Public",
  staff: "Staff",
  restricted: "Restricted",
};

export const roleOf = (user: User | null | undefined) =>
  user?.roles.includes("admin") ? "admin" : user?.roles.includes("manager") ? "manager" : "staff";
export const isAdmin = (user: User | null | undefined) => !!user?.roles.includes("admin");
export const isManager = (user: User | null | undefined) => !!user && (user.roles.includes("admin") || user.roles.includes("manager"));

export const ALLOWED_EXTENSIONS = ["pdf", "docx", "txt"];
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}
export const isPdf = (mime: string) => mime === "application/pdf";
export const isText = (mime: string) => mime.startsWith("text/");

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
