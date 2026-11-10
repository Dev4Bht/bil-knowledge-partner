"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type CrumbApi = { label: string | null; setLabel: (label: string | null) => void };
const CrumbContext = createContext<CrumbApi>({ label: null, setLabel: () => {} });

export function CrumbProvider({ children }: { children: ReactNode }) {
  const [label, setLabel] = useState<string | null>(null);
  return <CrumbContext.Provider value={{ label, setLabel }}>{children}</CrumbContext.Provider>;
}

export const useCrumb = () => useContext(CrumbContext).label;

/** A page renders <Crumb label="Motor Handbook" /> to name itself in the top bar breadcrumb. */
export function Crumb({ label }: { label: string }) {
  const { setLabel } = useContext(CrumbContext);
  useEffect(() => {
    setLabel(label);
    return () => setLabel(null);
  }, [label, setLabel]);
  return null;
}
