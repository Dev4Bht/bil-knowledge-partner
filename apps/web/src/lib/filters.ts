import { debounce, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";

export const BUSINESS_LINE_VALUES = ["general_insurance", "credit", "pf_gf", "corporate"] as const;
export const STATUS_VALUES = ["approved_current", "draft", "superseded", "archived"] as const;
export const SORT_VALUES = ["updated", "title", "effective"] as const;
export const LANGUAGE_VALUES = ["en", "dz"] as const;

/** URL state for /documents. Every view is linkable and survives refresh. */
export const documentFilters = {
  q: parseAsString.withDefault("").withOptions({ limitUrlUpdates: debounce(300), history: "replace" }),
  businessLine: parseAsStringLiteral(BUSINESS_LINE_VALUES),
  status: parseAsStringLiteral(STATUS_VALUES),
  folder: parseAsString,
  page: parseAsInteger.withDefault(1),
  sort: parseAsStringLiteral(SORT_VALUES).withDefault("updated"),
};

/** URL state for /ask. */
export const askFilters = {
  q: parseAsString.withDefault(""),
  businessLine: parseAsStringLiteral(BUSINESS_LINE_VALUES),
  language: parseAsStringLiteral(LANGUAGE_VALUES).withDefault("en"),
  status: parseAsStringLiteral(STATUS_VALUES),
  /** The open saved chat, so a refresh or a bookmark returns to it. */
  chat: parseAsString,
};

export const DASHBOARD_DAYS = ["7", "14", "30", "90"] as const;

/** URL state for /dashboard: the time window. */
export const dashboardFilters = {
  days: parseAsStringLiteral(DASHBOARD_DAYS).withDefault("14"),
};

export type StatusValue = (typeof STATUS_VALUES)[number];
