import type { BrowserContext, Page } from "@playwright/test";

/** Selector for the first table row expand button (works across Kibana versions) */
const EXPAND_BUTTON_SELECTOR = [
  'button[aria-label="Toggle row details"]',
  'button[aria-label="Expand"]',
  'button[data-test-subj="docTableExpandToggleColumn"]',
].join(", ");

/**
 * Navigate to Kibana/OSD Discover page with the time range pre-set in the URL.
 *
 * The `_g` hash param (global state) carries the time range so no UI clicks are
 * needed. Onboarding dialogs are dismissed automatically before returning.
 */
export async function navigateToDiscover(page: Page, baseUrl: string) {
  // _g rison-encodes the global state (time range + refresh interval).
  // Putting it in the URL avoids clicking through the date picker.
  await page.goto(`${baseUrl}/app/discover#/?_g=(time:(from:now-24h,to:now))`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });

  // Dismiss any onboarding/tour dialogs before the test interacts with results
  await dismissDialogs(page);

  // Wait until at least one result row is visible
  await page
    .locator(EXPAND_BUTTON_SELECTOR)
    .first()
    .waitFor({ state: "visible", timeout: 30_000 });
}

/**
 * Dismiss common Kibana onboarding dialogs by clicking known dismiss buttons.
 * Only targets elements that are specifically onboarding-related.
 */
export async function dismissDialogs(page: Page) {
  const dismissSelectors = [
    // Kibana tour/onboarding dismiss buttons
    '[data-test-subj="dismissTourButton"]',
    '[data-test-subj="skipWelcomeScreen"]',
    // "Skip" or "Dismiss" text in EUI modals (not generic "Close")
    '.euiModal button:has-text("Skip")',
    '.euiModal button:has-text("Dismiss")',
    '.euiTour button:has-text("Skip")',
    // Sample data prompt dismiss
    '[data-test-subj="skipSampleData"]',
  ];

  for (const selector of dismissSelectors) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
      await el.click().catch(() => {});
      await el.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {});
    }
  }
}

/**
 * Open the document viewer flyout by clicking the expand toggle on the first row.
 */
export async function openDocViewer(page: Page) {
  const btn = page.locator(EXPAND_BUTTON_SELECTOR).first();
  await btn.waitFor({ state: "visible", timeout: 30_000 });
  await btn.click();

  // Wait for the doc viewer panel to render
  await page
    .locator('[data-test-subj="kbnDocViewer"], .kbnDocViewer, .osdDocViewer')
    .first()
    .waitFor({ state: "visible", timeout: 10_000 })
    .catch(() => {});
}

/**
 * Count the number of kibana-clicker-link elements injected into the page.
 */
export async function countClickerLinks(page: Page) {
  await page
    .locator(".kibana-clicker-link")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
  return await page.locator(".kibana-clicker-link").count();
}

/**
 * Click a clicker link and return the new Discover page it opens.
 * Waits for the new tab to load and Kibana's query bar to become visible.
 * Returns { newPage, fieldName, fieldValue } for assertions.
 */
export async function clickLinkAndWaitForNewPage(
  context: BrowserContext,
  page: Page,
) {
  const link = page.locator(".kibana-clicker-link").first();
  await link.waitFor({ state: "visible", timeout: 10_000 });

  // Extract field name from parent row: data-test-subj="tableDocViewRow-<name>-value"
  const row = link.locator("xpath=..");
  const testSubj = await row.getAttribute("data-test-subj");
  const fieldName = testSubj?.match(/^tableDocViewRow-(.+)-value$/)?.[1] ?? null;

  const fieldValue = await link.textContent() ?? "";

  // Click the link (target="_blank") and capture the new tab
  const [newPage] = await Promise.all([
    context.waitForEvent("page"),
    link.click(),
  ]);
  await newPage.waitForLoadState("domcontentloaded");

  // Dismiss onboarding dialogs on the new page too
  await dismissDialogs(newPage);

  // Wait for Kibana to finish loading (query bar becomes visible)
  await newPage
    .locator('[data-test-subj="queryInput"]')
    .waitFor({ state: "visible", timeout: 30_000 });

  return { newPage, fieldName, fieldValue };
}

/**
 * Read the KQL query text from Kibana's query bar.
 * Handles both textarea (older Kibana) and contenteditable (newer) query inputs.
 */
export async function getQueryBarText(page: Page): Promise<string> {
  const queryInput = page.locator('[data-test-subj="queryInput"]');
  return await queryInput.evaluate((el) => {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      return el.value;
    }
    return el.textContent ?? "";
  });
}

/**
 * Open the extension popup in a new page by navigating to its chrome-extension URL.
 */
export async function openPopup(
  context: BrowserContext,
  extensionId: string,
): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForLoadState("domcontentloaded");
  return page;
}

/**
 * Reset all extension settings to defaults by clearing sync storage.
 */
export async function resetSettings(
  context: BrowserContext,
  extensionId: string,
) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForLoadState("domcontentloaded");
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      chrome.storage.sync.clear(() => resolve());
    });
  });
  await page.close();
}
