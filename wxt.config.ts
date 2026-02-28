import { defineConfig } from "wxt";

export default defineConfig({
  modules: ['@wxt-dev/auto-icons'],
  manifest: {
    name: "Kibana Clicker",
    description: "Automation tool for Kibana",
    permissions: ["storage"],
    host_permissions: ["<all_urls>"],
    autoIcons: {
      baseIconPath: "assets/icon.png",
    },
    browser_specific_settings: {
      gecko: {
        id: "kibana-clicker@hyzyla.dev",
      },
    },
  },
});
