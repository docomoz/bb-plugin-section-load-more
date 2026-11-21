// bb-plugin-section-load-more — backend entry.
//
// The plugin is frontend-only; the server declares the settings the
// sidebar controller reads through useSettings().
import type { BbPluginApi } from "@get-bb/plugin-sdk";

export default async function plugin(bb: BbPluginApi) {
  bb.settings.define({
    visibleThreads: {
      type: "number",
      label: "Threads shown per section",
      description: "Top-level threads shown before Load more in Threads and custom sections.",
      default: 5,
    },
    loadMoreStep: {
      type: "number",
      label: "Threads per Load more",
      description: "Threads each Load more click reveals.",
      default: 5,
    },
    limitPinnedThreads: {
      type: "boolean",
      label: "Limit Pinned threads",
      description: "Show older pinned threads behind Load more.",
      default: true,
    },
    visiblePinnedThreads: {
      type: "number",
      label: "Pinned threads shown initially",
      description: "Top-level threads shown before Load more when the Pinned limit is enabled.",
      default: 8,
    },
  });
}
