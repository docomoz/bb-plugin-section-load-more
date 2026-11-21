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
  assert.equal(win.getComputedStyle(footer(a)!.querySelector("button")!).opacity, "0.8");
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

test("a step-only settings change immediately applies to existing buttons", async () => {
  const threads = group('[data-sidebar-visibility-group="threads"]');
  controller.update({ visible: 5, step: 10 });
  await settle();
  assert.equal(hiddenCount(threads), 25);

  controller.update({ visible: 5, step: 5 });
  await settle();
  for (const remaining of [20, 15, 10, 5, 0]) {
    const loadMore = footer(threads)!.querySelector("button")!;
    assert.equal(loadMore.title, "Show 5 more threads");
    loadMore.click();
    assert.equal(hiddenCount(threads), remaining);
  }
  assert.equal(footer(threads)!.textContent, "Show less");
});

test("a thread kept visible does not count toward the next batch", async () => {
  const section = group('[data-sidebar-section-id="t"]');
  controller.update({ visible: 5, step: 5 });
  win.history.replaceState(null, "", "/threads/thr_t13");
  await settle();
  assert.equal(hiddenCount(section), 29);
  for (const remaining of [24, 19, 14, 9, 4, 0]) {
    const loadMore = footer(section)!.querySelector("button")!;
    assert.equal(loadMore.title, `Show ${Math.min(5, hiddenCount(section))} more threads`);
    loadMore.click();
    assert.equal(hiddenCount(section), remaining);
  }
});

test("Pinned uses its own initial limit and the shared step", async () => {
  const standalone = Array.from({ length: 13 }, (_, i) =>
    `<div data-sidebar-sticky-group><div data-sidebar-rename-row><a data-sidebar-thread-id="thr_p${i}"></a></div>${
      i === 0 ? `<div>${row("thr_pchild")}</div>` : ""
    }</div>`,
  );
  const environment = `<div data-sidebar-sticky-group><div data-sidebar-rename-row>Worktree</div><div>
    ${row("thr_env0")}<div data-sidebar-windowed-item data-sidebar-windowed-nav="thr_env1:proj"></div>
  </div></div>`;
  doc.querySelector('[data-sidebar="content"]')!.insertAdjacentHTML("beforeend", `
    <div data-sidebar-sticky-group data-sidebar-sticky-header="false">
      <div data-sidebar="group-label">Pinned</div>
      <div><div data-sidebar-sticky-section>${standalone.slice(0, 6).join("")}${environment}${standalone.slice(6).join("")}</div></div>
    </div>`);
  const pinned = group('[data-sidebar-sticky-header="false"] [data-sidebar-sticky-section]');
  const regularSection = group('[data-sidebar-section-id="a"]');
  const pinnedHidden = () => pinned.querySelectorAll(`[${HIDDEN_ATTR}]`).length;
  controller.update({ visible: 5, step: 5 });
  await settle();
  assert.equal(pinnedHidden(), 0);
  assert.equal(footer(pinned), null);

  controller.update({ visible: 5, step: 5, pinnedVisible: 8 });
  await settle();
  assert.equal(pinnedHidden(), 7);
  assert.equal(hiddenCount(regularSection), topLevelItems(regularSection).length - 5);
  assert.equal(footer(pinned)?.textContent, "Load more (7)");
  assert.equal(footer(pinned)?.parentElement, pinned);
  assert.equal(pinned.querySelector('[data-sidebar-thread-id="thr_pchild"]')?.closest(`[${HIDDEN_ATTR}]`), null);
  footer(pinned)!.querySelector("button")!.click();
  assert.equal(pinnedHidden(), 2);
  assert.equal(footer(pinned)?.textContent, "Load more (2)Show less");
  assert.equal(pinned.querySelector('[data-sidebar-thread-id="thr_env0"]')?.closest(`[${HIDDEN_ATTR}]`), null);
  footer(pinned)!.querySelectorAll("button")[1].click();
  assert.equal(pinnedHidden(), 7);
  footer(pinned)!.querySelector("button")!.click();

  controller.update({ visible: 5, step: 5, pinnedVisible: 6 });
  await settle();
  assert.equal(pinnedHidden(), 9);

  controller.update({ visible: 5, step: 5 });
  await settle();
  assert.equal(pinnedHidden(), 0);
  assert.equal(footer(pinned), null);

  controller.update({ visible: 5, step: 2, pinnedVisible: 3 });
  win.history.replaceState(null, "", "/threads/thr_p12");
  await settle();
  assert.equal(pinnedHidden(), 11);
  assert.equal(pinned.querySelector('[data-sidebar-thread-id="thr_p12"]')?.closest(`[${HIDDEN_ATTR}]`), null);
  footer(pinned)!.querySelector("button")!.click();
  assert.equal(pinnedHidden(), 9);
});

test("stop removes everything it added", () => {
  controller.stop();
  assert.equal(
    doc.querySelectorAll(`[${HIDDEN_ATTR}], [${FOOTER_ATTR}], #section-load-more-style`).length,
    0,
  );
});
