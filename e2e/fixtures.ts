import { test as base, chromium, type BrowserContext, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const extensionPath = path.resolve(__dirname, "..", ".output", "chrome-mv3");

/**
 * Custom test fixture that launches Chromium with a persistent context
 * so that the browser extension is loaded properly.
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionPage: Page;
}>({
  // biome-ignore lint: Playwright fixture pattern requires destructuring
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pw-ext-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        "--headless=new",
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--no-sandbox",
        "--disable-gpu",
      ],
    });
    await use(context);
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },

  extensionPage: async ({ context }, use) => {
    const page = context.pages()[0] || await context.newPage();
    await use(page);
  },
});

export { expect } from "@playwright/test";
