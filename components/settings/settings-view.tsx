"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { downloadJson } from "@/lib/download";
import { useFieldsStore } from "@/lib/store/fields-store";
import { useAppCopy, useLocaleStore, type AreaUnit, type Locale } from "@/lib/store/locale-store";

const LAST_BACKUP_KEY = "farm_fields_last_backup_at";
const BACKUP_EVENT = "fieldshift-backup-recorded";

function subscribeBackupTime(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(BACKUP_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(BACKUP_EVENT, onChange);
  };
}

function readBackupTime(): string | null {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

/** Device-only preferences and the existing repository backup workflow. */
export function SettingsView() {
  const locale = useLocaleStore((s) => s.locale);
  const areaUnit = useLocaleStore((s) => s.areaUnit);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const setAreaUnit = useLocaleStore((s) => s.setAreaUnit);
  const exportBackup = useFieldsStore((s) => s.exportBackup);
  const importBackup = useFieldsStore((s) => s.importBackup);
  const t = useAppCopy();
  const [message, setMessage] = useState<string | null>(null);
  const lastBackupAt = useSyncExternalStore(subscribeBackupTime, readBackupTime, () => null);
  const [busy, setBusy] = useState<"export" | "restore" | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  useEffect(() => hydrateLocale(), [hydrateLocale]);

  const isMy = locale === "my";
  const sectionLabels = {
    language: isMy ? "ဘာသာစကား" : "Language",
    units: isMy ? "ဧရိယာယူနစ်" : "Area unit",
    backup: isMy ? "သိမ်းဆည်းပြီး ပြန်ထည့်ရန်" : "Backup and restore",
    privacy: isMy ? "ကိုယ်ရေးလုံခြုံမှု" : "Privacy",
  };

  const recordBackupTime = () => {
    const now = new Date().toISOString().slice(0, 10);
    try {
      window.localStorage.setItem(LAST_BACKUP_KEY, now);
      window.dispatchEvent(new Event(BACKUP_EVENT));
    } catch {
      // storage unavailable
    }
  };

  const exportData = async () => {
    setBusy("export");
    setMessage(null);
    try {
      const backup = await exportBackup();
      downloadJson(`field-shift-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
      recordBackupTime();
      setMessage(t.home.backupDownloaded);
    } catch {
      setMessage(t.home.backupExportError);
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
      recordBackupTime();
      setMessage(t.home.backupRestored(result.fields, result.rotations));
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
        <h1 className="text-balance text-title text-ink sm:text-display">{isMy ? "ဆက်တင်များ" : "Settings"}</h1>
        <p className="max-w-measure text-pretty text-body text-ink-muted">
          {isMy
            ? "Field Shift ဖော်ပြမှုပုံစံကို ရွေးချယ်ပြီး ဤဖုန်းတွင် သိမ်းထားသော အချက်အလက်များကို သီးသန့်သိမ်းယူပါ။"
            : "Choose how Field Shift is shown and keep a private copy of work saved on this phone."}
        </p>
      </header>

      <section aria-labelledby="language-settings" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="language-settings" className="flex items-center gap-2 text-headline text-ink text-balance"><Icon name="language" size={22} className="text-field" />{sectionLabels.language}</h2>
        <OptionGroup<Locale> label={isMy ? "ပြသလိုသော ဘာသာစကား" : "Display language"} value={locale} options={[['en', 'English'], ['my', 'မြန်မာ']]} onChange={setLocale} />
        <p className="m-0 text-pretty text-body-sm text-ink-muted">
          {isMy
            ? "မြန်မာစိုက်ပျိုးရေး ဝေါဟာရများကို စစ်ဆေးထားပါသည်။ လိုအပ်ပါက အင်္ဂလိပ်ဘာသာသို့လည်း ပြောင်းလဲနိုင်သည်။"
            : "Myanmar farmer-facing words need agricultural language review. English remains available if text is hard to read."}
        </p>
      </section>

      <section aria-labelledby="unit-settings" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="unit-settings" className="flex items-center gap-2 text-headline text-ink text-balance"><Icon name="stack" size={22} className="text-field" />{sectionLabels.units}</h2>
        <OptionGroup<AreaUnit> label={isMy ? "စိုက်ခင်းဧရိယာ ပြသလိုသော ယူနစ်" : "Show field area in"} value={areaUnit} options={[['ha', 'Hectares'], ['acre', 'Acres']]} onChange={setAreaUnit} />
      </section>

      <section aria-labelledby="backup-settings" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="backup-settings" className="flex items-center gap-2 text-headline text-ink text-balance"><Icon name="download" size={22} className="text-field" />{sectionLabels.backup}</h2>
        <p className="m-0 max-w-measure text-pretty text-body-sm text-ink-muted">
          {isMy
            ? "အရန်ဖိုင်တွင် သင့်စိုက်ခင်းများ၊ သိမ်းဆည်းထားသော သီးလှည့်များနှင့် အစီအစဉ်မူကြမ်း ပါဝင်သည်။ ပြန်ထည့်သောအခါ ၎င်းတို့ကို ပြန်လည်ဖြည့်သွင်းပေးမည်။ ဖိုင်ကို လုံခြုံစွာ သိမ်းထားပါ။"
            : "A backup has your fields, saved rotations and your Plan draft. Restoring adds them back and replaces any that match. Keep the file private."}
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void exportData()} disabled={busy !== null} icon="download" className="w-full sm:w-auto justify-center">
            {busy === "export" ? (isMy ? "အရန်ဖိုင် ပြင်ဆင်နေသည်…" : "Preparing backup…") : t.home.exportBackup}
          </Button>
          <Button variant="secondary" onClick={() => restoreInput.current?.click()} disabled={busy !== null} icon="restore" className="w-full sm:w-auto justify-center">
            {busy === "restore" ? (isMy ? "ပြန်လည်ထည့်သွင်းနေသည်…" : "Restoring…") : t.home.restoreBackup}
          </Button>
          <input ref={restoreInput} type="file" accept=".json,application/json" className="sr-only" aria-label={t.home.chooseBackup} onChange={(event) => void restore(event.target.files?.[0])} />
        </div>
        {lastBackupAt ? <p className="m-0 text-body-sm text-ink-muted tabular-nums">{t.home.lastBackupAt(lastBackupAt)}</p> : null}
        {message ? <p role="status" className="m-0 text-pretty text-body-sm text-ink-muted">{message}</p> : null}
      </section>

      <section aria-labelledby="privacy-settings" className="flex flex-col gap-3 border-t border-line pt-5">
        <h2 id="privacy-settings" className="flex items-center gap-2 text-headline text-ink text-balance"><Icon name="private" size={22} className="text-field" />{sectionLabels.privacy}</h2>
        <ul className="m-0 flex max-w-measure list-disc flex-col gap-1.5 pl-5 text-pretty text-body-sm text-ink-muted">
          <li>Field names, crop history and preferences stay on this phone. Clearing data on the phone, or sharing the phone, can expose or remove them.</li>
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
      <legend className="text-body-sm text-ink">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([key, text]) => (
          <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)} className={buttonClass(value === key ? "primary" : "secondary", "min-h-12")}>
            {value === key ? <Icon name="check" size={18} strokeWidth={2.8} /> : null}
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
