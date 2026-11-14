"use client";

import { create } from "zustand";

const KEY = "fieldshift.settings.v1";

interface SettingsState {
  hydrated: boolean;
  dataNoticeAcceptedAt: string | null;
  hydrate: () => void;
  acceptDataNotice: () => void;
}

const read = (): string | null => {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? "{}") as { dataNoticeAcceptedAt?: string }).dataNoticeAcceptedAt ?? null;
  } catch {
    return null;
  }
};

/** First-launch settings, kept on the device only. Storage can be blocked, so every access is guarded. */
export const useSettingsStore = create<SettingsState>()((set) => ({
  hydrated: false,
  dataNoticeAcceptedAt: null,
  hydrate: () => set({ hydrated: true, dataNoticeAcceptedAt: read() }),
  acceptDataNotice: () => {
    const at = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify({ dataNoticeAcceptedAt: at }));
    } catch {
      /* the choice still holds for this visit */
    }
    set({ dataNoticeAcceptedAt: at });
  },
}));
