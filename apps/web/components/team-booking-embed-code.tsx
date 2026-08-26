"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Check, Copy, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

export function TeamBookingEmbedCode({
  appUrl,
  teamSlug,
}: {
  appUrl: string;
  teamSlug: string;
}) {
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");
  const [primaryColor, setPrimaryColor] = useState("");
  const [copied, setCopied] = useState(false);
  const embedPath = useMemo(() => {
    const query = new URLSearchParams({ theme });
    if (/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
      query.set("primaryColor", primaryColor.slice(1));
    }
    return `/embed/team/${teamSlug}?${query}`;
  }, [primaryColor, teamSlug, theme]);
  const snippet = `<script src="${appUrl}/embed.js" async></script>
<div data-dayotter-embed data-url="${embedPath}" data-height="900"></div>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      window.prompt("Copy this embed code", snippet);
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="team-embed-theme">Theme</Label>
          <Select
            id="team-embed-theme"
            value={theme}
            onChange={(event) => setTheme(event.target.value as typeof theme)}
          >
            <option value="auto">Match visitor device</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="team-embed-color">Accent colour (optional)</Label>
          <Input
            id="team-embed-color"
            value={primaryColor}
            onChange={(event) => setPrimaryColor(event.target.value)}
            placeholder="#6743e6"
            pattern="#[0-9a-fA-F]{6}"
          />
        </div>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-xs text-[var(--color-muted)]">
        {snippet}
      </pre>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy embed code"}
        </Button>
        <Link
          href={embedPath}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          Preview embed <ExternalLink size={13} />
        </Link>
      </div>
      <p className="text-xs text-[var(--color-faint)]">
        Paste this into your website. It creates a borderless iframe and resizes it as the booking
        flow changes.
      </p>
    </div>
  );
}
