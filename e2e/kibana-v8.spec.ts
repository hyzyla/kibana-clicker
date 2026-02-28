import { test, expect } from "./fixtures";
import {
  clickLinkAndWaitForNewPage,
  countClickerLinks,
  getQueryBarText,
  navigateToDiscover,
  openDocViewer,
  openPopup,
  resetSettings,
} from "./helpers";

const BASE_URL = "http://localhost:15601";

test.describe("Kibana v8", () => {
  test("should inject clicker links into doc viewer", async ({
    extensionPage: page,
  }) => {
    await navigateToDiscover(page, BASE_URL);
    await openDocViewer(page);

    const linkCount = await countClickerLinks(page);
    expect(linkCount).toBeGreaterThan(0);
  });

  test("should have correct filter href on clicker links", async ({
    extensionPage: page,
  }) => {
    await navigateToDiscover(page, BASE_URL);
    await openDocViewer(page);

    const link = page.locator(".kibana-clicker-link").first();
    await expect(link).toBeVisible({ timeout: 10_000 });

    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
    // Links should contain RISON-encoded query parameters
    expect(href).toContain("_a=");
  });

  test("clicking a link opens Discover with the correct query", async ({
    context,
    extensionPage: page,
  }) => {
    await navigateToDiscover(page, BASE_URL);
    await openDocViewer(page);

    const { newPage, fieldName, fieldValue } =
      await clickLinkAndWaitForNewPage(context, page);

    expect(fieldName).toBeTruthy();
    expect(fieldValue).toBeTruthy();

    // Query bar should show the KQL query for the clicked field
    const queryText = await getQueryBarText(newPage);
    expect(queryText).toContain(`${fieldName}:"${fieldValue}"`);

    // No search error on the page
    await expect(
      newPage.locator('text="Cannot retrieve search results"'),
    ).not.toBeVisible();

    await newPage.close();
  });

  test("clicking a link preserves date range by default", async ({
    context,
    extensionPage: page,
  }) => {
    await navigateToDiscover(page, BASE_URL);
    await openDocViewer(page);

    const { newPage } = await clickLinkAndWaitForNewPage(context, page);

    // URL should contain _g= since preserveDateRange defaults to true
    expect(newPage.url()).toContain("_g=");

    // Page loads without search errors
    await expect(
      newPage.locator('text="Cannot retrieve search results"'),
    ).not.toBeVisible();

    await newPage.close();
  });

  test("clicking a link shows matching results on new page", async ({
    context,
    extensionPage: page,
  }) => {
    await navigateToDiscover(page, BASE_URL);
    await openDocViewer(page);

    const { newPage } = await clickLinkAndWaitForNewPage(context, page);

    // The opened Discover page should show results (expand button means rows exist)
    await newPage
      .locator(
        'button[aria-label="Toggle row details"], button[aria-label="Expand"], button[data-test-subj="docTableExpandToggleColumn"]',
      )
      .first()
      .waitFor({ state: "visible", timeout: 30_000 });

    await newPage.close();
  });

  test("clicking a link without date range omits _g", async ({
    context,
    extensionId,
    extensionPage: page,
  }) => {
    // Disable preserveDateRange
    await resetSettings(context, extensionId);
    const popup = await openPopup(context, extensionId);
    const checkbox = popup.locator('[data-setting="preserveDateRange"] input');
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await popup.close();

    await navigateToDiscover(page, BASE_URL);
    await openDocViewer(page);

    // Check the generated link href directly — Kibana may add default _g
    // to the URL when loading the page, so we verify what the extension produces
    const link = page.locator(".kibana-clicker-link").first();
    await expect(link).toBeVisible({ timeout: 10_000 });
    const href = await link.getAttribute("href");
    expect(href).not.toContain("_g=");

    const { newPage } = await clickLinkAndWaitForNewPage(context, page);

    // Page still loads without errors
    await expect(
      newPage.locator('text="Cannot retrieve search results"'),
    ).not.toBeVisible();

    await newPage.close();
  });
});
