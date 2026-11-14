"use client";

import { useEffect, useRef, useState } from "react";
import { Button, ButtonRow } from "@/components/ui/button";
import { downloadJson } from "@/lib/download";
import { useFieldsStore } from "@/lib/store/fields-store";
import { useLocaleStore, type AreaUnit, type Locale } from "@/lib/store/locale-store";

const bilingual = {
  language: "Language / ဘာသာစကား",
  units: "Area unit / ဧရိယာယူနစ်",
  backup: "Backup and restore / သိမ်းဆည်းပြီး ပြန်ထည့်ရန်",
  privacy: "Privacy / ကိုယ်ရေးလုံခြုံမှု",
};

/** Device-only preferences and the existing repository backup workflow. */
export function SettingsView() {
  const locale = useLocaleStore((s) => s.locale);
  const areaUnit = useLocaleStore((s) => s.areaUnit);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const setAreaUnit = useLocaleStore((s) => s.setAreaUnit);
  const exportBackup = useFieldsStore((s) => s.exportBackup);
  const importBackup = useFieldsStore((s) => s.importBackup);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "restore" | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  useEffect(() => hydrateLocale(), [hydrateLocale]);

  const exportData = async () => {
    setBusy("export");
    setMessage(null);
    try {
      const backup = await exportBackup();
      downloadJson(`field-shift-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
      setMessage("Backup download started. Keep the file somewhere private.");
    } catch {
      setMessage("Could not create a backup. Check browser storage and try again.");
    } finally {
      setBusy(null);
    }
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setBusy("restore");
    setMessage(null);
    try {
      const result = await importBackup(JSON.parse(await file.text()));
      setMessage(`Restored ${result.fields} fields and ${result.rotations} rotations on this device.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not restore that backup. Choose a Field Shift JSON backup and try again.");
    } finally {
      setBusy(null);
      if (restoreInput.current) restoreInput.current.value = "";
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-7">
      <header className="flex flex-col gap-1">
        <h1 className="text-title text-ink sm:text-display">Settings</h1>
        <p className="max-w-measure text-body text-ink-muted">Choose how Field Shift is shown and keep a private copy of work saved in this browser.</p>
      </header>

      <section aria-labelledby="language-settings" className="flex flex-col gap-3 rounded-md border border-line bg-surface-raised p-4 sm:p-5">
        <h2 id="language-settings" className="text-headline text-ink">{bilingual.language}</h2>
        <OptionGroup<Locale> label="Display language" value={locale} options={[['en', 'English'], ['my', 'မြန်မာ']]} onChange={setLocale} />
        <p className="m-0 text-source text-ink-muted">Myanmar farmer-facing words need agricultural language review. English remains available if text is hard to read.</p>
      </section>

      <section aria-labelledby="unit-settings" className="flex flex-col gap-3 rounded-md border border-line bg-surface-raised p-4 sm:p-5">
        <h2 id="unit-settings" className="text-headline text-ink">{bilingual.units}</h2>
        <OptionGroup<AreaUnit> label="Show field area in" value={areaUnit} options={[['ha', 'Hectares'], ['acre', 'Acres']]} onChange={setAreaUnit} />
      </section>

      <section aria-labelledby="backup-settings" className="flex flex-col gap-3 rounded-md border border-line bg-surface-raised p-4 sm:p-5">
        <h2 id="backup-settings" className="text-headline text-ink">{bilingual.backup}</h2>
        <p className="m-0 max-w-measure text-body-sm text-ink-muted">Version 3 backups include fields, saved rotations and your Plan draft. Restore adds records and replaces matching IDs and the included Plan draft. Keep the file private.</p>
        <ButtonRow>
          <Button variant="secondary" onClick={() => void exportData()} disabled={busy !== null} icon="download">
            {busy === "export" ? "Preparing backup…" : "Export backup (JSON)"}
          </Button>
          <Button variant="secondary" onClick={() => restoreInput.current?.click()} disabled={busy !== null} icon="restore">
            {busy === "restore" ? "Restoring…" : "Restore backup"}
          </Button>
          <input ref={restoreInput} type="file" accept=".json,application/json" className="sr-only" aria-label="Choose a backup file" onChange={(event) => void restore(event.target.files?.[0])} />
        </ButtonRow>
        {message ? <p role="status" className="m-0 text-body-sm text-ink-muted">{message}</p> : null}
      </section>

      <section aria-labelledby="privacy-settings" className="flex flex-col gap-3 rounded-md bg-surface-sunken p-4 sm:p-5">
        <h2 id="privacy-settings" className="text-headline text-ink">{bilingual.privacy}</h2>
        <ul className="m-0 flex max-w-measure list-disc flex-col gap-1 pl-5 text-body-sm text-ink-muted">
          <li>Field names, crop history and preferences stay in this browser. Clearing browser data or using a shared device can expose or remove them.</li>
          <li>Location or field outlines may be sent to map and data providers only when a feature needs them. This settings page sends nothing.</li>
          <li>No account and no server backup are used. Export a backup before changing or clearing a device.</li>
        </ul>
      </section>
    </div>
  );
}

function OptionGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="text-body-sm text-ink-muted">{label}</legend>
      <ButtonRow layout="wrap">
        {options.map(([key, text]) => (
          <Button key={key} aria-pressed={value === key} onClick={() => onChange(key)} variant={value === key ? "primary" : "secondary"}>
            {text}
          </Button>
        ))}
      </ButtonRow>
    </fieldset>
  );
}
