export interface Settings {
  notion: {
    token: string;
    databaseId: string;
  };
}

export const EMPTY_SETTINGS: Settings = {
  notion: { token: '', databaseId: '' },
};

const SETTINGS_KEY = 'settings';

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  const stored = result[SETTINGS_KEY] as Partial<Settings> | undefined;
  if (!stored) return EMPTY_SETTINGS;
  return { notion: { ...EMPTY_SETTINGS.notion, ...stored.notion } };
}

export async function setSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
}
