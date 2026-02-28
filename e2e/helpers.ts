import type { Page } from "@playwright/test";

/**
 * Navigate to Kibana/OSD Discover page and wait for it to load.
 * Sets time range to "Last 24 hours" to ensure seeded data is visible.
 */
export async function navigateToDiscover(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/app/discover`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  // Wait for Kibana app to render
  await page.waitForTimeout(5000);

  // Widen time range to "Last 24 hours" so seeded data is always visible
  await setTimeRangeLast24Hours(page);
  await page.waitForTimeout(3000);
}

/**
 * Set the time range to "Last 24 hours" via the date picker.
 */
async function setTimeRangeLast24Hours(page: Page) {
  // Click the date picker button to open the time range popover
  const datePickerBtn = page.locator(
    '[data-test-subj="superDatePickerToggleQuickMenuButton"], button[data-test-subj="superDatePickerShowDatesButton"]',
  );
  if (await datePickerBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await datePickerBtn.first().click();
    await page.waitForTimeout(1000);

    // Look for "Last 24 hours" in the quick select options
    const last24h = page.locator('button:has-text("Last 24 hours")');
    if (await last24h.isVisible({ timeout: 3000 }).catch(() => false)) {
      await last24h.click();
      await page.waitForTimeout(2000);
      return;
    }
  }

  // Fallback: click the time range text and change it via the quick select
  const timeRangeBtn = page.locator(
    'button:has-text("Last 15 minutes"), button:has-text("Last")',
  ).first();
  if (await timeRangeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await timeRangeBtn.click();
    await page.waitForTimeout(1000);

    const last24h = page.locator('button:has-text("Last 24 hours")');
    if (await last24h.isVisible({ timeout: 3000 }).catch(() => false)) {
      await last24h.click();
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * Create a data view (index pattern) for the test-logs index via the Kibana API.
 * This is more reliable than clicking through the UI.
 */
export async function createDataViewViaAPI(
  baseUrl: string,
  indexPattern: string,
) {
  // Try Kibana v8/v9 API
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "kbn-xsrf": "reporting",
    };
    const response = await fetch(`${baseUrl}/api/data_views/data_view`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        data_view: {
          title: indexPattern,
          timeFieldName: "@timestamp",
        },
      }),
    });
    if (response.ok || response.status === 409) return;
  } catch {
    // Kibana API not available, try OpenSearch
  }

  // Try OpenSearch Dashboards API
  try {
    const response = await fetch(
      `${baseUrl}/api/saved_objects/index-pattern/test-logs`,
      {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
          "osd-xsrf": "true",
        }),
        body: JSON.stringify({
          attributes: {
            title: indexPattern,
            timeFieldName: "@timestamp",
          },
        }),
      },
    );
    if (!response.ok && response.status !== 409) {
      console.warn(
        `Failed to create data view: ${response.status} ${await response.text()}`,
      );
    }
  } catch {
    // OpenSearch API not available either
  }
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
      await page.waitForTimeout(300);
    }
  }
}

/**
 * Open the document viewer flyout by clicking the expand toggle on the first row.
 */
export async function openDocViewer(page: Page) {
  // Wait for discover results to load
  await page.waitForTimeout(3000);

  // Try the expand/toggle button on first row
  const expandSelectors = [
    'button[aria-label="Toggle row details"]',
    'button[aria-label="Expand"]',
    'button[data-test-subj="docTableExpandToggleColumn"]',
  ];

  for (const selector of expandSelectors) {
    const btn = page.locator(selector).first();
    if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(5000);
      return;
    }
  }

  throw new Error("Could not find expand button to open doc viewer");
}

/**
 * Count the number of kibana-clicker-link elements injected into the page.
 */
export async function countClickerLinks(page: Page) {
  // Wait for the content script's MutationObserver to detect and process the doc viewer
  await page.waitForTimeout(5000);
  return await page.locator(".kibana-clicker-link").count();
}
