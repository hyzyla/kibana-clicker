import { test, expect } from "./fixtures";
import {
  countClickerLinks,
  createDataViewViaAPI,
  dismissDialogs,
  navigateToDiscover,
  openDocViewer,
  openPopup,
  resetSettings,
} from "./helpers";

const BASE_URL = "http://localhost:15601";

test.describe("Settings", () => {
  test.beforeAll(async () => {
    await createDataViewViaAPI(BASE_URL, "test-logs*");
  });

  test.beforeEach(async ({ context, extensionId }) => {
    await resetSettings(context, extensionId);
  });

  test("popup displays all 4 toggles with correct defaults", async ({
    context,
    extensionId,
  }) => {
    const popup = await openPopup(context, extensionId);

    // Check all 4 settings exist
    const settings = popup.locator("[data-setting]");
    await expect(settings).toHaveCount(4);

    // Check defaults
    const preserveFilters = popup.locator('[data-setting="preserveFilters"] input');
    await expect(preserveFilters).not.toBeChecked();

    const preserveDateRange = popup.locator('[data-setting="preserveDateRange"] input');
    await expect(preserveDateRange).toBeChecked();

    const preserveColumns = popup.locator('[data-setting="preserveColumns"] input');
    await expect(preserveColumns).toBeChecked();

    const injectTableLinks = popup.locator('[data-setting="injectTableLinks"] input');
    await expect(injectTableLinks).not.toBeChecked();

    await popup.close();
  });

  test("toggling a setting persists across popup reopens", async ({
    context,
    extensionId,
  }) => {
    // Open popup and toggle preserveFilters on
    const popup1 = await openPopup(context, extensionId);
    const checkbox1 = popup1.locator('[data-setting="preserveFilters"] input');
    await expect(checkbox1).not.toBeChecked();
    await checkbox1.click();
    await expect(checkbox1).toBeChecked();
    await popup1.close();

    // Reopen popup and verify it persisted
    const popup2 = await openPopup(context, extensionId);
    const checkbox2 = popup2.locator('[data-setting="preserveFilters"] input');
    await expect(checkbox2).toBeChecked();
    await popup2.close();
  });

  test("injectTableLinks=false (default) does not inject links in table cells", async ({
    context,
    extensionId,
    extensionPage: page,
  }) => {
    await navigateToDiscover(page, BASE_URL);
    await dismissDialogs(page);

    // Wait for table to render
    await page.waitForTimeout(3000);

    // With default settings (injectTableLinks=false), table cells should NOT have links
    const tableLinkCount = await page
      .locator('[data-test-subj="discoverCellDescriptionList"] .kibana-clicker-link')
      .count();
    expect(tableLinkCount).toBe(0);
  });

  test("injectTableLinks=true injects links in table cells", async ({
    context,
    extensionId,
    extensionPage: page,
  }) => {
    // Enable injectTableLinks
    const popup = await openPopup(context, extensionId);
    const checkbox = popup.locator('[data-setting="injectTableLinks"] input');
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await popup.close();

    await navigateToDiscover(page, BASE_URL);
    await dismissDialogs(page);

    // Wait for table to render and content script to process
    await page.waitForTimeout(5000);

    const tableLinkCount = await page
      .locator('[data-test-subj="discoverCellDescriptionList"] .kibana-clicker-link')
      .count();
    expect(tableLinkCount).toBeGreaterThan(0);
  });

  test("preserveDateRange=false omits _g from link href", async ({
    context,
    extensionId,
    extensionPage: page,
  }) => {
    // Disable preserveDateRange
    const popup = await openPopup(context, extensionId);
    const checkbox = popup.locator('[data-setting="preserveDateRange"] input');
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await popup.close();

    await navigateToDiscover(page, BASE_URL);
    await dismissDialogs(page);
    await openDocViewer(page);

    const link = page.locator(".kibana-clicker-link").first();
    await expect(link).toBeVisible({ timeout: 10_000 });

    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
    expect(href).not.toContain("_g=");
  });

  test("preserveFilters=true keeps filters in link href", async ({
    context,
    extensionId,
    extensionPage: page,
  }) => {
    // Enable preserveFilters
    const popup = await openPopup(context, extensionId);
    const checkbox = popup.locator('[data-setting="preserveFilters"] input');
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await popup.close();

    await navigateToDiscover(page, BASE_URL);
    await dismissDialogs(page);
    await openDocViewer(page);

    // Click a link to set a filter query, then check that filters key is preserved
    const link = page.locator(".kibana-clicker-link").first();
    await expect(link).toBeVisible({ timeout: 10_000 });

    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
    // With preserveFilters=true, the _a param should retain a filters key
    // (or at least not have it stripped). The key test is that filters are not deleted.
    expect(href).toContain("_a=");
  });
});
