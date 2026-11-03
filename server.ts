// bb-plugin-section-load-more — backend entry.
//
// The plugin is frontend-only; the server declares the two settings the
// sidebar controller reads through useSettings().
import type { BbPluginApi } from "@get-bb/plugin-sdk";

export default async function plugin(bb: BbPluginApi) {
  bb.settings.define({
    visibleThreads: {
      type: "number",
      label: "Threads shown per section",
      description: "Top-level threads a custom section shows before Load more.",
      default: 10,
    },
    loadMoreStep: {
      type: "number",
      label: "Threads per Load more",
      description: "Threads each Load more click reveals.",
      default: 10,
    },
  });
}
