"use client";

import { useRef, useState } from "react";
import { Button, type ButtonVariant } from "./button";
import { IconCheck, IconCopy } from "./icons";
import { useToast } from "./toast";

export function CopyButton({ text, label = "Copy", variant = "secondary", disabled }: { text: string; label?: string; variant?: ButtonVariant; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ tone: "success", title: "Copied to clipboard" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ tone: "error", title: "Could not copy", description: "Select the text and copy it manually." });
    }
  };
  return (
    <Button variant={variant} size="sm" onClick={copy} disabled={disabled} icon={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}>
      {copied ? "Copied" : label}
    </Button>
  );
}
