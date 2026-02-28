import { storage } from "wxt/utils/storage";

export interface Settings {
  preserveFilters: boolean;
  preserveDateRange: boolean;
  preserveColumns: boolean;
  preserveQuery: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  preserveFilters: false,
  preserveDateRange: true,
  preserveColumns: true,
  preserveQuery: false,
};

export const preserveFiltersItem = storage.defineItem<boolean>(
  "sync:preserveFilters",
  { fallback: DEFAULT_SETTINGS.preserveFilters },
);

export const preserveDateRangeItem = storage.defineItem<boolean>(
  "sync:preserveDateRange",
  { fallback: DEFAULT_SETTINGS.preserveDateRange },
);

export const preserveColumnsItem = storage.defineItem<boolean>(
  "sync:preserveColumns",
  { fallback: DEFAULT_SETTINGS.preserveColumns },
);

export const preserveQueryItem = storage.defineItem<boolean>(
  "sync:preserveQuery",
  { fallback: DEFAULT_SETTINGS.preserveQuery },
);

export async function loadSettings(): Promise<Settings> {
  const [preserveFilters, preserveDateRange, preserveColumns, preserveQuery] =
    await Promise.all([
      preserveFiltersItem.getValue(),
      preserveDateRangeItem.getValue(),
      preserveColumnsItem.getValue(),
      preserveQueryItem.getValue(),
    ]);
  return { preserveFilters, preserveDateRange, preserveColumns, preserveQuery };
}
