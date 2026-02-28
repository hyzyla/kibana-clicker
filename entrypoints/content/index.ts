import { KibanaURL } from "@/utils/kibana-url";
import { throttleDebounce } from "@/utils/lib";
import * as logging from "@/utils/logging";

import "./style.css";

class BaseDashboard {
  FIELD_NAME_REGEXP = /^tableDocViewRow-(?<fieldName>.*)-value$/;
  VIEWER_ROWS_SELECTOR = "[data-test-subj^='tableDocViewRow-'][data-test-subj$='-value']";

  constructor() {}

  getFieldName(element: Element): string | null {
    const subjectAttr = element.getAttribute("data-test-subj") ?? "";
    const search = subjectAttr.match(this.FIELD_NAME_REGEXP);
    if (search === null || !search.groups) {
      return null;
    }
    return search.groups.fieldName;
  }

  getFieldValue(element: Element): string | null {
    return element.textContent;
  }

  /**
   * Create new link element with URL to Kibana with query by given field name and value
   */
  createLink(name: string, value: string): Element {
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

  onViewerDetected(viewer: Element, waitedMs: number = 0) {
    // Viewer is already detected and links are already injected, not need to do it again
    if (viewer.attributes.getNamedItem("data-kibana-clicker-injected")) {
      return;
    }

    logging.log("Viewer is detected", viewer);

    // We waited 10 seconds and rows are still not rendered, so we give up here
    if (waitedMs > 10_000) {
      logging.log("More than expected iterations", waitedMs);
      return;
    }

    const rows = viewer.querySelectorAll(this.VIEWER_ROWS_SELECTOR);

    // If rows are not rendered yet, wait 100ms and try again
    if (rows.length === 0) {
      setTimeout(() => this.onViewerDetected(viewer, waitedMs + 100), 100);
      return;
    }

    logging.log("Injecting links...");
    rows.forEach((row) => {
      const fieldName = this.getFieldName(row);
      if (!fieldName) {
        return;
      }
      const fieldValue = this.getFieldValue(row);
      if (!fieldValue) {
        return;
      }
      const link = this.createLink(fieldName, fieldValue);
      row.replaceChildren(link);
    });

    viewer.setAttribute("data-kibana-clicker-injected", "true");
  }
}

class KibanaDashaborad extends BaseDashboard {
  constructor(readonly rootElement: Element) {
    super();
  }

  /**
   * Check if given node can be a indicator of Kibana dashboard
   */
  static detect(): KibanaDashaborad | null {
    const element = document.getElementById("kibana-body");
    if (element === null) return null;
    return new KibanaDashaborad(element);
  }

  detectViewers() {
    // It can be multiple viewers on the page and we need to inject links to all of them
    const nodeWithAttr = document.querySelectorAll(
      '[data-test-subj="kbnDocViewer"]:not([data-kibana-clicker-injected])',
    );
    for (const node of nodeWithAttr) {
      this.onViewerDetected(node);
    }

    const nodeWithClass = document.querySelectorAll(
      ".kbnDocViewer:not([data-kibana-clicker-injected])",
    );
    for (const node of nodeWithClass) {
      return this.onViewerDetected(node);
    }
  }
}

class OpenSearchDashaborad extends BaseDashboard {
  constructor(readonly rootElement: Element) {
    super();
  }

  static detect(): OpenSearchDashaborad | null {
    const element = document.getElementById("opensearch-dashboards-body");
    if (element === null) return null;
    return new OpenSearchDashaborad(element);
  }

  detectViewers(): void {
    // osdDocViewer
    const nodeWithClass = document.querySelectorAll(
      ".osdDocViewer:not([data-kibana-clicker-injected])",
    );
    for (const node of nodeWithClass) {
      return this.onViewerDetected(node);
    }
  }
}

/**
 * Class that detect Kibana or OpenSearch Dashboards
 */
class Detector {
  dashboard: KibanaDashaborad | OpenSearchDashaborad | null = null;
  state: "new" | "dashboard-detected" = "new";

  constructor() {}

  /**
   * Is Kibana or OpenSearch Dashboards is already detected
   */
  get isDetected(): boolean {
    return this.dashboard !== null;
  }

  detectDashbaord(): void {
    const dashboard = KibanaDashaborad.detect() || OpenSearchDashaborad.detect();
    if (dashboard) {
      logging.log("Dashboard detected", dashboard);
      this.dashboard = dashboard;
      this.state = "dashboard-detected";
    }
  }

  detectViewers() {
    this.dashboard?.detectViewers();
  }

  /**
   * Handle new DOM node
   */
  handleNewNode(): void {
    switch (this.state) {
      case "new":
        this.detectDashbaord();
        break;
      case "dashboard-detected":
        this.detectViewers();
        break;
    }
  }

  /**
   * Funciton that handle new DOM node. It's called in batched mode not more than
   * once per 100ms
   */
  handleNewNodeDebounced = throttleDebounce(this.handleNewNode, 100);

  /**
   * Start observing DOM changes to detect Kibana or OpenSearch Dashboards
   */
  watch() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (!mutation.addedNodes) return;

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          this.handleNewNodeDebounced();
        });
      });
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
