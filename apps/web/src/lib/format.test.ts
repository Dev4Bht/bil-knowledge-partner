import { describe, expect, it } from "vitest";
import { businessLineName, cn, fileExtension, formatBytes, formatDate, initials, isAdmin, isManager, relativeTime, roleOf } from "./format";
import { ADMIN, MANAGER, STAFF } from "@/test/fixtures";

describe("format helpers", () => {
  it("formats date-only values without shifting the day", () => {
    expect(formatDate("2024-01-01")).toBe("1 Jan 2024");
    expect(formatDate("2023-12-31")).toBe("31 Dec 2023");
    expect(formatDate(null)).toBe("Not set");
  });
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("describes elapsed time", () => {
    const now = Date.parse("2026-11-10T12:00:00Z");
    expect(relativeTime("2026-11-10T11:59:50Z", now)).toBe("just now");
    expect(relativeTime("2026-11-10T11:30:00Z", now)).toBe("30 min ago");
    expect(relativeTime("2026-11-10T09:00:00Z", now)).toBe("3 h ago");
    expect(relativeTime("2026-11-08T12:00:00Z", now)).toBe("2 d ago");
  });
  it("derives roles", () => {
    expect([roleOf(ADMIN), roleOf(MANAGER), roleOf(STAFF)]).toEqual(["admin", "manager", "staff"]);
    expect(isAdmin(ADMIN)).toBe(true);
    expect(isManager(MANAGER)).toBe(true);
    expect(isManager(STAFF)).toBe(false);
    expect(isManager(null)).toBe(false);
  });
  it("small helpers", () => {
    expect(fileExtension("Report.FINAL.PDF")).toBe("pdf");
    expect(fileExtension("noext")).toBe("");
    expect(initials("Demo Admin")).toBe("DA");
    expect(businessLineName("pf_gf")).toBe("PF/GF");
    expect(cn("a", false, "b", null)).toBe("a b");
  });
});
