# Testing

This project uses **Playwright** for end-to-end browser extension testing. There are no unit tests.

## Prerequisites

1. **Build the extension** before running tests (tests load from `.output/chrome-mv3`):
   ```
   npm run build
   ```

2. **Start Docker containers** for the target environment:
   ```
   npm run docker:v8          # Kibana v8 (Elasticsearch 8.17.0 + Kibana 8.17.0)
   npm run docker:v9          # Kibana v9 (Elasticsearch 9.0.0 + Kibana 9.0.0)
   npm run docker:opensearch   # OpenSearch 2.19.0 + OpenSearch Dashboards 2.19.0
   ```

3. **Seed test data** once containers are healthy:
   ```
   npm run seed            # seed all running instances
   npm run seed -- v8      # seed only Kibana v8
   npm run seed -- v9      # seed only Kibana v9
   npm run seed -- opensearch  # seed only OpenSearch
   ```

## Running tests

```
npm run test:e2e              # run all E2E tests
npm run test:e2e:v8           # run only Kibana v8 tests
npm run test:e2e:v9           # run only Kibana v9 tests
npm run test:e2e:opensearch   # run only OpenSearch tests
```

Under the hood these run `playwright test --config e2e/playwright.config.ts`.

## Test configuration

Config file: `e2e/playwright.config.ts`
- `testDir: "."` — tests live in the `e2e/` folder
- `timeout: 120_000` — 2-minute timeout per test
- `retries: 1` — one retry on failure
- `workers: 1` — sequential execution (required for browser extension testing)

## Test file structure

All test files live in `e2e/` with the `.spec.ts` extension:

```
e2e/
  playwright.config.ts    # Playwright config
  fixtures.ts             # Custom fixtures (browser context with extension loaded)
  helpers.ts              # Shared test helpers
  kibana-v8.spec.ts       # Kibana v8 tests
  kibana-v9.spec.ts       # Kibana v9 tests
  opensearch.spec.ts      # OpenSearch tests
  docker-compose.yml      # Docker services for test environments
  seed-data.sh            # Test data seeding script
```

## Writing a new test

### 1. Import fixtures and helpers

```typescript
import { test, expect } from "./fixtures";
import {
  countClickerLinks,
  createDataViewViaAPI,
  dismissDialogs,
  navigateToDiscover,
  openDocViewer,
} from "./helpers";
```

Always import `test` and `expect` from `./fixtures` (not from `@playwright/test`). The custom `test` fixture provides an `extensionPage` that has the browser extension loaded.

### 2. Test structure

```typescript
const BASE_URL = "http://localhost:15601"; // v8=15601, v9=25601, opensearch=35601

test.describe("Feature name", () => {
  test.beforeAll(async () => {
    await createDataViewViaAPI(BASE_URL, "test-logs*");
  });

  test("should do something", async ({ extensionPage: page }) => {
    await navigateToDiscover(page, BASE_URL);
    await dismissDialogs(page);
    await openDocViewer(page);

    // Your assertions here
    const linkCount = await countClickerLinks(page);
    expect(linkCount).toBeGreaterThan(0);
  });
});
```

### 3. Key patterns

- **Use `extensionPage: page`** — destructure from test args to get a page with the extension loaded
- **Call `dismissDialogs(page)`** — after navigation to clear Kibana onboarding modals
- **Use `createDataViewViaAPI()`** in `beforeAll` — to set up data views via API rather than UI
- **Selectors** — prefer `data-test-subj` attributes (Kibana's test attributes) and `.kibana-clicker-link` for extension-injected elements

### 4. Available helpers (`e2e/helpers.ts`)

| Helper | Purpose |
|--------|---------|
| `navigateToDiscover(page, baseUrl)` | Navigate to Discover page and set time range to last 24 hours |
| `createDataViewViaAPI(baseUrl, pattern)` | Create data view via API (works for Kibana and OpenSearch) |
| `dismissDialogs(page)` | Dismiss onboarding/tour dialogs |
| `openDocViewer(page)` | Click expand toggle on first result row |
| `countClickerLinks(page)` | Count `.kibana-clicker-link` elements on page |

### 5. Port mapping

| Environment | UI Port | Elasticsearch/OpenSearch Port |
|-------------|---------|-------------------------------|
| Kibana v8   | 15601   | 19200                         |
| Kibana v9   | 25601   | 29200                         |
| OpenSearch   | 35601   | 39200                         |

## Custom fixtures (`e2e/fixtures.ts`)

The fixtures launch Chromium with a persistent context that loads the extension from `.output/chrome-mv3`. Each test gets an isolated temporary user data directory. The browser runs in headless mode with `--headless=new`.
