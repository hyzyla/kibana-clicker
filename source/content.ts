const KIBANA_CLICKER_INJECTED_ATTRIBUTE = "kibana-clicker-injected";
const FIELD_NAME_REGEXP = /^tableDocViewRow-(?<fieldName>.*)-value$/;
let IS_KIBANA_DETECTED = false;

function getFieldName(element: Element): string | null {
    const subjectAttr = element.getAttribute("data-test-subj") ?? "";
    const search = subjectAttr.match(FIELD_NAME_REGEXP);
    if (search === null || !search.groups) {
        return;
    }
    return search.groups.fieldName;
}

function getFieldValue(element: Element): string {
    return element.textContent;
}

function createLink(name: string, value: string): Element {
    const link = document.createElement("a");
    const URL = `/app/discover#/?_a=(query:(language:kuery,query:'${name}:"${value}"'))`;
    link.setAttribute("href", URL);
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noreferrer noopener");
    link.classList.add("kibana-clicker-link");
    link.textContent = value;
    return link;
}

function handleKibanaDetected() {
    console.log("KibanaClicker: Kibana is detected");
    IS_KIBANA_DETECTED = true;
}

function handleDocumentViewer(viewer: Element, iteration = 0) {
    if (iteration > 10) {
        console.log("KibanaClicker: More than expected iterations");
        return;
    }
    if (viewer.getAttribute(KIBANA_CLICKER_INJECTED_ATTRIBUTE) != null) {
        return;
    }
    const rows = viewer.querySelectorAll("table div[data-test-subj^='tableDocViewRow-']");
    if (rows.length === 0) {
        setTimeout(
            () => handleDocumentViewer(viewer, iteration + 1),
            1000,
        );
        return;
    }
    rows.forEach((row) => {
        const fieldName = getFieldName(row);
        if (!fieldName) {
            return;
        }
        const fieldValue = getFieldValue(row);
        const link = createLink(fieldName, fieldValue);
        row.replaceChildren(link);
    });

    viewer.setAttribute(KIBANA_CLICKER_INJECTED_ATTRIBUTE, "1");
}

function handleNewNode(node: Node) {
    if (!(node instanceof Element)) {
        return;
    }

    if (node.id === "kibana-body") {
        return handleKibanaDetected();
    }

    if (!IS_KIBANA_DETECTED) {
        return;
    }

    if (node.attributes.getNamedItem("data-test-subj")?.value === "kbnDocViewer") {
        return handleDocumentViewer(node);
    }

    if (node.classList.contains("kbnDocViewer")) {
        return handleDocumentViewer(node);
    }

    const viewer = node.querySelector(".kbnDocViewer");
    if (viewer !== null) {
        return handleDocumentViewer(viewer);
    }

}


const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (!mutation.addedNodes) return;

        mutation.addedNodes.forEach((node) => {
            handleNewNode(node);
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false,
});
