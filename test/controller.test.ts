// Runs the controller against a DOM shaped like bb's thread-list sidebar.
// node --test test/  (Node 22.18+ strips the types; needs jsdom)
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "https://bb.test/threads/thr_t30",
});
const win = dom.window as unknown as Window & typeof globalThis;
win.requestAnimationFrame = (cb: FrameRequestCallback) =>
  win.setTimeout(() => cb(0), 0);
win.cancelAnimationFrame = (id: number) => win.clearTimeout(id);
Object.assign(globalThis, {
  window: win,
  document: win.document,
  MutationObserver: win.MutationObserver,
  Element: win.Element,
});

const { SectionLoadMore, HIDDEN_ATTR, FOOTER_ATTR, topLevelItems } = await import(
  "../controller.ts"
);
const doc = win.document;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function row(threadId: string, child = ""): string {
  return `<div data-sidebar-windowed-item><a data-sidebar-thread-id="${threadId}"><span class="bb-thread-title">${threadId}</span></a>${child}</div>`;
}

/** A custom section; item 5 is an off-screen placeholder, item 0 has a child. */
function section(id: string, count: number): string {
  const items = Array.from({ length: count }, (_, i) => {
    const threadId = `thr_${id}${i}`;
    if (i === 5) {
      return `<div data-sidebar-windowed-item data-sidebar-windowed-nav="${threadId}:proj" style="height:28px"></div>`;
    }
    const child = i === 0 ? `<div class="relative space-y-px">${row("thr_child")}</div>` : "";
    return row(threadId, child);
  });
  return `<div data-sidebar-section-id="${id}"><div>${id}</div><div class="relative space-y-px">${items.join("")}</div></div>`;
}

function threadsGroup(count: number): string {
  const items = Array.from({ length: count }, (_, i) => row(`thr_l${i}`));
  return `<div data-sidebar-visibility-group="threads"><div><div>Threads</div><div class="relative space-y-px">${items.join("")}</div></div></div>`;
}

const hiddenCount = (group: Element) =>
  topLevelItems(group).filter((item: Element) => item.hasAttribute(HIDDEN_ATTR)).length;
const group = (selector: string) => doc.querySelector(selector)!;
const footer = (el: Element) => el.querySelector<HTMLElement>(`[${FOOTER_ATTR}]`);

let controller: InstanceType<typeof SectionLoadMore>;

before(async () => {
  doc.body.innerHTML = `<div data-sidebar="content">${section("a", 43)}${section("b", 7)}${section("t", 35)}${threadsGroup(30)}</div>`;
  controller = new SectionLoadMore({ visible: 10, step: 10 });
  controller.start();
  await settle();
});

after(() => controller.stop());

test("caps long sections and leaves short ones alone", () => {
  const a = group('[data-sidebar-section-id="a"]');
  assert.equal(topLevelItems(a).length, 43, "child threads are not counted");
  assert.equal(hiddenCount(a), 33);
  assert.equal(footer(a)!.textContent, "Load more (33)");
  assert.equal(footer(a)!.parentElement!.lastElementChild, footer(a));
  const b = group('[data-sidebar-section-id="b"]');
  assert.equal(hiddenCount(b), 0);
  assert.equal(footer(b), null);
});

test("caps the built-in Threads group", () => {
  const threads = group('[data-sidebar-visibility-group="threads"]');
  assert.equal(hiddenCount(threads), 20);
  assert.equal(footer(threads)!.textContent, "Load more (20)");
});

test("keeps the open thread visible", () => {
  const t = group('[data-sidebar-section-id="t"]');
  assert.equal(hiddenCount(t), 24);
  const open = doc.querySelector('a[data-sidebar-thread-id="thr_t30"]')!;
  assert.ok(!open.closest("[data-sidebar-windowed-item]")!.hasAttribute(HIDDEN_ATTR));
});

test("Load more, new rows, and Show less", async () => {
  const a = group('[data-sidebar-section-id="a"]');
  footer(a)!.querySelector("button")!.click();
  assert.equal(hiddenCount(a), 23);
  assert.equal(footer(a)!.textContent, "Load more (23)Show less");

  // React appends a row after the footer; the footer moves back to the end.
  const container = footer(a)!.parentElement!;
  container.insertAdjacentHTML("beforeend", row("thr_new"));
  await settle();
  assert.equal(container.lastElementChild, footer(a));
  assert.equal(hiddenCount(a), 24);

  footer(a)!.querySelectorAll("button")[1].click();
  assert.equal(hiddenCount(a), 34);
  assert.ok(topLevelItems(a)[5].hasAttribute("data-sidebar-windowed-nav"));
});

test("applies new settings", async () => {
  controller.update({ visible: 20, step: 5 });
  await settle();
  assert.equal(hiddenCount(group('[data-sidebar-section-id="a"]')), 24);
});

test("stop removes everything it added", () => {
  controller.stop();
  assert.equal(
    doc.querySelectorAll(`[${HIDDEN_ATTR}], [${FOOTER_ATTR}], #section-load-more-style`).length,
    0,
  );
});
