import { test, expect } from "./fixtures";
import { countClickerLinks, navigateToDiscover, openDocViewer } from "./helpers";

const BASE_URL = "http://localhost:35601";

test.describe("OpenSearch Dashboards", () => {
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
    expect(href).toContain("_a=");
  });
});
