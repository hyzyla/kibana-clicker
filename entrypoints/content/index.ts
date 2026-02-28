import { KibanaURL } from "@/utils/kibana-url";
import { throttleDebounce } from "@/utils/lib";
import * as logging from "@/utils/logging";

import "./style.css";

const FIELD_NAME_REGEXP = /^tableDocViewRow-(?<fieldName>.*)-value$/;
const VIEWER_ROWS_SELECTOR = "[data-test-subj^='tableDocViewRow-'][data-test-subj$='-value']";

function getViewerRowFieldName(element: Element): string | null {
  const subjectAttr = element.getAttribute("data-test-subj") ?? "";
  const search = subjectAttr.match(FIELD_NAME_REGEXP);
  if (search === null || !search.groups) {
    return null;
  }
  return search.groups.fieldName;
}

function createLink(name: string, value: string): Element {
  const link = document.createElement("a");

  const kibanaURL = KibanaURL.fromCurrentURL();
  const url = kibanaURL.withQuery({ name, value });

  link.setAttribute("href", url);
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noreferrer noopener");
  link.classList.add("kibana-clicker-link");
  link.textContent = value;
  return link;
}

/**
 * Inject links into doc viewer rows within the given element.
 * Only processes rows that don't already have a link (idempotent).
 */
function injectViewerLinks(root: Element | Document) {
  const rows = root.querySelectorAll(VIEWER_ROWS_SELECTOR);
  for (const row of rows) {
    if (row.querySelector(".kibana-clicker-link")) continue;

    const fieldName = getViewerRowFieldName(row);
    if (!fieldName) continue;

    const fieldValue = row.textContent;
    if (!fieldValue) continue;

    const link = createLink(fieldName, fieldValue);
    row.replaceChildren(link);
  }
}

/**
 * Try to inject links into a viewer element. If rows aren't rendered yet,
 * poll until they appear (up to 10 seconds).
 */
function injectIntoViewer(viewer: Element, waitedMs: number = 0) {
  if (waitedMs > 10_000) {
    logging.log("Viewer polling timed out", waitedMs);
    return;
  }

  const rows = viewer.querySelectorAll(VIEWER_ROWS_SELECTOR);

  if (rows.length === 0) {
    setTimeout(() => injectIntoViewer(viewer, waitedMs + 100), 100);
    return;
  }

  injectViewerLinks(viewer);
}

/**
 * Inject links into the Discover table's description list cells.
 * The _source column renders field/value pairs as <dt>/<dd> inside a <dl>.
 * We wrap the text inside each <dd> with a link, preserving the <dd> element
 * so React's reconciliation is not disrupted.
 */
function injectGridLinks() {
  const lists = document.querySelectorAll(
    '[data-test-subj="discoverCellDescriptionList"]',
  );

  for (const list of lists) {
    const items = list.querySelectorAll("dt, dd");
    for (let i = 0; i < items.length - 1; i += 2) {
      const dt = items[i];
      const dd = items[i + 1];

      if (dt.tagName !== "DT" || dd.tagName !== "DD") continue;
      if (dd.querySelector(".kibana-clicker-link")) continue;

      const fieldName = dt.textContent?.trim();
      const fieldValue = dd.textContent?.trim();
      if (!fieldName || !fieldValue || fieldValue === "-") continue;

      const textNode = dd.firstChild;
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue;

      const link = createLink(fieldName, fieldValue);
      dd.replaceChild(link, textNode);
    }
  }
}

const KIBANA_VIEWER_SELECTORS = [
  '[data-test-subj="kbnDocViewer"]',
  ".kbnDocViewer",
];

const OPENSEARCH_VIEWER_SELECTORS = [".osdDocViewer"];

class KibanaDashboard {
  private knownViewers = new WeakSet<Element>();

  constructor(readonly rootElement: Element) {}

  static detect(): KibanaDashboard | null {
    const element = document.getElementById("kibana-body");
    if (element === null) return null;
    return new KibanaDashboard(element);
  }

  injectLinks() {
    // Detect viewer containers and poll for rows within them.
    // Search entire document because Kibana renders flyouts as portals
    // outside the main app container.
    for (const selector of KIBANA_VIEWER_SELECTORS) {
      const viewers = document.querySelectorAll(selector);
      for (const viewer of viewers) {
        if (!this.knownViewers.has(viewer)) {
          this.knownViewers.add(viewer);
          logging.log("Viewer detected", viewer);
          injectIntoViewer(viewer);
        } else {
          // Re-inject into known viewers (handles pagination/content changes)
          injectViewerLinks(viewer);
        }
      }
    }

    // Also scan entire document for rows outside viewers (single doc page)
    injectViewerLinks(document);

    // Inject into Discover table description list cells
    injectGridLinks();
  }
}

class OpenSearchDashboard {
  private knownViewers = new WeakSet<Element>();

  constructor(readonly rootElement: Element) {}

  static detect(): OpenSearchDashboard | null {
    const element = document.getElementById("opensearch-dashboards-body");
    if (element === null) return null;
    return new OpenSearchDashboard(element);
  }

  injectLinks() {
    for (const selector of OPENSEARCH_VIEWER_SELECTORS) {
      const viewers = document.querySelectorAll(selector);
      for (const viewer of viewers) {
        if (!this.knownViewers.has(viewer)) {
          this.knownViewers.add(viewer);
          logging.log("Viewer detected", viewer);
          injectIntoViewer(viewer);
        } else {
          injectViewerLinks(viewer);
        }
      }
    }

    injectViewerLinks(document);
    injectGridLinks();
  }
}

/**
 * Class that detects Kibana or OpenSearch Dashboards and injects links
 */
class Detector {
  dashboard: KibanaDashboard | OpenSearchDashboard | null = null;
  state: "new" | "dashboard-detected" = "new";

  get isDetected(): boolean {
    return this.dashboard !== null;
  }

  detectDashboard(): void {
    const dashboard = KibanaDashboard.detect() || OpenSearchDashboard.detect();
    if (dashboard) {
      logging.log("Dashboard detected", dashboard);
      this.dashboard = dashboard;
      this.state = "dashboard-detected";
    }
  }

  injectLinks() {
    this.dashboard?.injectLinks();
  }

  handleMutation(): void {
    switch (this.state) {
      case "new":
        this.detectDashboard();
        break;
      case "dashboard-detected":
        this.injectLinks();
        break;
    }
  }

  handleMutationDebounced = throttleDebounce(this.handleMutation, 100);

  watch() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (!mutation.addedNodes) continue;
        for (const node of mutation.addedNodes) {
          if (!(node instanceof Element)) continue;
          this.handleMutationDebounced();
          return;
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
    });
    logging.log("Mutation observer is started");
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],

  main() {
    const detector = new Detector();
    detector.watch();

    logging.log("Content script is injected", detector);
  },
});
