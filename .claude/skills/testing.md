# Testing

This project uses **Playwright** for end-to-end browser extension testing. There are no unit tests.

## Prerequisites

Start Docker containers for the environments you want to test:

```
npm run docker:all        # start Kibana v8 + v9 + OpenSearch at once
npm run docker:v8         # Kibana v8 only  (Elasticsearch 8.17.0 + Kibana 8.17.0)
npm run docker:v9         # Kibana v9 only  (Elasticsearch 9.0.0 + Kibana 9.0.0)
npm run docker:opensearch # OpenSearch only (OpenSearch 2.19.0 + Dashboards 2.19.0)
```

No manual build or seeding is needed — the global setup step handles both automatically before tests run.

## Running tests

```
npm run test:e2e
```

That is the only test command. The global setup (`e2e/global-setup.ts`) runs first and:
1. Builds the extension if `.output/chrome-mv3/manifest.json` is missing
2. Seeds fresh test data (20 documents, timestamps in last 20 minutes) into every reachable Elasticsearch / OpenSearch instance
3. Creates the `test-logs*` data view on every reachable Kibana / OpenSearch Dashboards instance

Environments that are not running are skipped automatically.

### Run a single test by name

Use `--grep` to filter by test title (supports regex):

```
npm run test:e2e -- --grep "should inject clicker links"
npm run test:e2e -- --grep "correct filter href"
```

Or target a specific file directly:

```
npx playwright test e2e/settings.spec.ts --config e2e/playwright.config.ts
npx playwright test e2e/kibana-v8.spec.ts --config e2e/playwright.config.ts
```

### Run with visible browser

```
npm run test:e2e
```

## Test configuration

Config file: `e2e/playwright.config.ts`
- `globalSetup: "./global-setup.ts"` — build check + seed + data view creation
- `testDir: "."` — tests live in the `e2e/` folder
- `timeout: 120_000` — 2-minute timeout per test
- `retries: 1` — one retry on failure
- `workers: 1` — sequential execution (required for browser extension testing)

## Test file structure

```
e2e/
  playwright.config.ts    # Playwright config
  global-setup.ts         # Build check, seed data, create data views
  fixtures.ts             # Custom fixtures (browser context with extension loaded)
  helpers.ts              # Shared test helpers
  kibana-v8.spec.ts       # Kibana v8 tests
  kibana-v9.spec.ts       # Kibana v9 tests
  opensearch.spec.ts      # OpenSearch tests
  settings.spec.ts        # Extension settings tests
  docker-compose.yml      # Docker services for test environments
  seed-data.sh            # Seed script (legacy, now handled by global-setup.ts)
```

## Writing a new test

### 1. Import fixtures and helpers

```typescript
import { test, expect } from "./fixtures";
import { countClickerLinks, navigateToDiscover, openDocViewer } from "./helpers";
```

Always import `test` and `expect` from `./fixtures` (not from `@playwright/test`). The custom `test` fixture provides `extensionPage` — a page with the browser extension loaded.

### 2. Test structure

```typescript
const BASE_URL = "http://localhost:15601"; // v8=15601, v9=25601, opensearch=35601

test.describe("Feature name", () => {
  test("should do something", async ({ extensionPage: page }) => {
    await navigateToDiscover(page, BASE_URL);
    await openDocViewer(page);

    const linkCount = await countClickerLinks(page);
    expect(linkCount).toBeGreaterThan(0);
  });
});
```

No `beforeAll` setup needed — data views and seed data are prepared by global setup.

### 3. Key patterns

- **Use `extensionPage: page`** — destructure from test args to get a page with the extension loaded
- **`navigateToDiscover` handles dialogs** — it dismisses Kibana onboarding modals internally; no need to call `dismissDialogs` separately
- **Selectors** — prefer `data-test-subj` attributes (Kibana's test attributes) and `.kibana-clicker-link` for extension-injected elements

### 4. Available helpers (`e2e/helpers.ts`)

| Helper | Purpose |
|--------|---------|
| `navigateToDiscover(page, baseUrl)` | Navigate to Discover with `_g` time range pre-set in URL, dismiss dialogs, wait for results |
| `dismissDialogs(page)` | Dismiss onboarding/tour dialogs (called internally by `navigateToDiscover`) |
| `openDocViewer(page)` | Click expand toggle on first result row, wait for doc viewer panel |
| `countClickerLinks(page)` | Wait for and count `.kibana-clicker-link` elements |
| `openPopup(context, extensionId)` | Open the extension popup page |
| `resetSettings(context, extensionId)` | Clear all extension settings to defaults via storage API |

### 5. Port mapping

| Environment | UI Port | Elasticsearch/OpenSearch Port |
|-------------|---------|-------------------------------|
| Kibana v8   | 15601   | 19200                         |
| Kibana v9   | 25601   | 29200                         |
| OpenSearch  | 35601   | 39200                         |
