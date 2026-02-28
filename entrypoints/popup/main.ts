import {
  preserveFiltersItem,
  preserveDateRangeItem,
  preserveColumnsItem,
  injectTableLinksItem,
} from "@/utils/settings";
import type { WxtStorageItem } from "wxt/utils/storage";

const items: Record<string, WxtStorageItem<boolean, {}>> = {
  preserveFilters: preserveFiltersItem,
  preserveDateRange: preserveDateRangeItem,
  preserveColumns: preserveColumnsItem,
  injectTableLinks: injectTableLinksItem,
};

async function init() {
  for (const [name, item] of Object.entries(items)) {
    const label = document.querySelector(`[data-setting="${name}"]`);
    if (!label) continue;

    const checkbox = label.querySelector("input") as HTMLInputElement;
    checkbox.checked = await item.getValue();

    checkbox.addEventListener("change", () => {
      item.setValue(checkbox.checked);
    });
  }
}

init();
