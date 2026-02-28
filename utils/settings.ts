import { storage } from "wxt/utils/storage";

export interface Settings {
  preserveFilters: boolean;
  preserveDateRange: boolean;
  injectTableLinks: boolean;
  preserveColumns: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  preserveFilters: false,
  preserveDateRange: true,
  injectTableLinks: false,
  preserveColumns: true,
};

export const preserveFiltersItem = storage.defineItem<boolean>(
  "sync:preserveFilters",
  { fallback: DEFAULT_SETTINGS.preserveFilters },
);

export const preserveDateRangeItem = storage.defineItem<boolean>(
  "sync:preserveDateRange",
  { fallback: DEFAULT_SETTINGS.preserveDateRange },
);

export const injectTableLinksItem = storage.defineItem<boolean>(
  "sync:injectTableLinks",
  { fallback: DEFAULT_SETTINGS.injectTableLinks },
);

export const preserveColumnsItem = storage.defineItem<boolean>(
  "sync:preserveColumns",
  { fallback: DEFAULT_SETTINGS.preserveColumns },
);

export async function loadSettings(): Promise<Settings> {
  const [preserveFilters, preserveDateRange, injectTableLinks, preserveColumns] =
    await Promise.all([
      preserveFiltersItem.getValue(),
      preserveDateRangeItem.getValue(),
      injectTableLinksItem.getValue(),
      preserveColumnsItem.getValue(),
    ]);
  return { preserveFilters, preserveDateRange, injectTableLinks, preserveColumns };
}
