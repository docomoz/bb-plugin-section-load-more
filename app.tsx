// bb-plugin-section-load-more — frontend entry.
//
// An invisible app overlay owns the sidebar controller for this window, so
// it can read the plugin settings and dispose cleanly with the plugin.
import { useEffect, useRef } from "react";
import { definePluginApp, useSettings } from "@get-bb/plugin-sdk/app";
import { SectionLoadMore, type LoadMoreOptions } from "./controller";

function positiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? Math.floor(value) : Number.NaN;
  return Number.isFinite(n) && n >= 1 && n <= 1000 ? n : fallback;
}

function SidebarLoadMore() {
  const { values } = useSettings();
  const options: LoadMoreOptions = {
    visible: positiveInt(values?.visibleThreads, 10),
    step: positiveInt(values?.loadMoreStep, 10),
  };
  const controller = useRef<SectionLoadMore | null>(null);

  useEffect(() => {
    const instance = new SectionLoadMore(options);
    controller.current = instance;
    instance.start();
    return () => {
      instance.stop();
      controller.current = null;
    };
    // Options flow in through update() below; start once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    controller.current?.update(options);
  }, [options.visible, options.step]);

  return null;
}

export default definePluginApp((app) => {
  app.slots.experimental_appOverlay({ id: "sidebar-load-more", component: SidebarLoadMore });
});
