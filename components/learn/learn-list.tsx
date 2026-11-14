"use client";

import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import { useMemo, useState } from "react";
import { Button, Pressable } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { copy } from "@/lib/copy/en";

interface Entry {
  term: string;
  body: string;
}

/** Short text for the sheet: the first sentences, up to 40 words. The full text opens on "More". */
export function shortOf(body: string, max = 40): string {
  const words = body.split(/\s+/);
  if (words.length <= max) return body;
  const sentences = body.match(/[^.]+\.?/g) ?? [body];
  let out = "";
  for (const s of sentences) {
    if ((out + s).split(/\s+/).filter(Boolean).length > max) break;
    out += s;
  }
  return (out || words.slice(0, max).join(" ")).trim();
}

/** Learn (S15) with Explain-a-term (S13) as a bottom sheet. Read aloud only where the browser can speak. */
export function LearnList({ sections }: { sections: Array<{ title: string; items: readonly Entry[] }> }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Entry | null>(null);
  const [more, setMore] = useState(false);
  // only read inside the sheet, which opens after a tap, so it never renders on the server
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

  const shown = useMemo(
    () => sections.map((s) => ({ ...s, items: s.items.filter((i) => `${i.term} ${i.body}`.toLowerCase().includes(q.trim().toLowerCase())) })).filter((s) => s.items.length),
    [sections, q],
  );

  return (
    <>
      <TextField
        type="search"
        label="Search Learn"
        placeholder="Search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        size="small"
        fullWidth
        slotProps={{ htmlInput: { "aria-label": "Search Learn" } }}
      />
      {shown.length === 0 ? <p className="text-body text-ink-muted">No topics match &ldquo;{q}&rdquo;.</p> : null}
      {shown.map((s) => (
        <section key={s.title} aria-label={s.title} className="flex flex-col gap-2">
          <h2 className="text-source text-ink-muted">{s.title}</h2>
          <Panel as="div" className="divide-y divide-line">
            {s.items.map((item) => (
              <Pressable
                key={item.term}
                onClick={() => { setMore(false); setOpen(item); }}
                className="flex min-h-tap w-full items-center justify-between gap-3 px-4 py-2 text-left text-label text-ink"
              >
                {item.term}
                <span aria-hidden className="text-ink-muted">›</span>
              </Pressable>
            ))}
          </Panel>
        </section>
      ))}

      <Dialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { position: "fixed", bottom: 0, m: 0, width: "100%", maxWidth: "100%", borderRadius: "var(--radius-lg) var(--radius-lg) 0 0" } } }}
        aria-labelledby="term-title"
      >
        {open ? (
          <div className="flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div aria-hidden className="mx-auto h-1 w-10 rounded-pill bg-line-strong" />
            <div className="flex items-start justify-between gap-3">
              <h2 id="term-title" className="m-0 text-title text-ink">{open.term}</h2>
              <Button variant="quiet" onClick={() => setOpen(null)}>Done</Button>
            </div>
            <p className="m-0 text-callout text-ink">{more ? open.body : shortOf(open.body)}</p>
            {canSpeak ? (
              <Button
                variant="secondary"
                onClick={() => {
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(new SpeechSynthesisUtterance(more ? open.body : shortOf(open.body)));
                }}
              >
                Read aloud
              </Button>
            ) : null}
            {open.body !== shortOf(open.body) && !more ? <Button variant="quiet" onClick={() => setMore(true)}>More</Button> : null}
            <p className="m-0 text-source text-ink-tertiary">Where it comes from: {copy.app.name} glossary, written for this app.</p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
