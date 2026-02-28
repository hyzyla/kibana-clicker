import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Kibana Clicker",
    description: "Automation tool for Kibana",
    permissions: ["storage"],
    browser_specific_settings: {
      gecko: {
        id: "kibana-clicker@hyzyla.dev",
      },
    },
  },
});
