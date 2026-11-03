// Caps every custom section of bb's built-in sidebar thread list at a number
// of top-level threads and adds a "Load more" footer inside the same section.
//
// It decorates the bundled thread-list plugin's DOM instead of replacing the
// list, so pinning, nesting, drag and drop, menus and status keep working.
// The DOM contract it relies on (bb 0.46):
//   [data-sidebar="content"]                  scroll root of the list
//     [data-sidebar-section-id="sec_…"]       one custom section, or
//     [data-sidebar-visibility-group="threads"]  the built-in Threads group
//       div                                   item container
//         [data-sidebar-windowed-item]        one top-level item; child threads
//                                             are nested windowed items
// Off-screen items are windowed placeholders whose thread ids live in
// data-sidebar-windowed-nav ("threadId:projectId …").

export const HIDDEN_ATTR = "data-section-load-more-hidden";
export const FOOTER_ATTR = "data-section-load-more";
const STYLE_ID = "section-load-more-style";
const ROOT_SELECTOR = '[data-sidebar="content"]';
const SECTION_SELECTOR = "[data-sidebar-section-id]";
// Custom sections, plus the built-in loose "Threads" group, which has no
// section id and is wrapped in a visibility group instead.
const GROUP_SELECTOR = `${SECTION_SELECTOR}, [data-sidebar-visibility-group="threads"]`;
const ITEM_SELECTOR = "[data-sidebar-windowed-item]";

export interface LoadMoreOptions {
  /** Top-level threads a section shows before "Load more". */
  visible: number;
  /** Threads each "Load more" click reveals. */
  step: number;
}

const CSS = `
[${HIDDEN_ATTR}] { display: none !important; }
[${FOOTER_ATTR}] {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: var(--bb-sidebar-row-height, 28px);
  padding-right: 4px;
}
[${FOOTER_ATTR}] button {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  padding: 4px 6px;
  border-radius: calc(var(--radius, 8px) - 2px);
  cursor: pointer;
  white-space: nowrap;
}
[${FOOTER_ATTR}] button:hover {
  background: var(--sidebar-accent);
  color: var(--sidebar-foreground);
}
[${FOOTER_ATTR}] button:focus-visible {
  outline: 2px solid var(--sidebar-ring);
  outline-offset: -2px;
}
`;

/** Thread id of the open thread, read from the route (…/thr_xxx). */
export function activeThreadIdFromPath(pathname: string): string | null {
  const match = /\/(thr_[A-Za-z0-9]+)(?:[/?#]|$)/.exec(pathname);
  return match ? match[1] : null;
}

/** Top-level windowed items of one section or group, in display order. */
export function topLevelItems(section: Element): HTMLElement[] {
  const items: HTMLElement[] = [];
  for (const item of section.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) {
    if (item.closest(GROUP_SELECTOR) !== section) continue;
    const outer = item.parentElement?.closest(ITEM_SELECTOR);
    if (outer && section.contains(outer)) continue;
    items.push(item);
  }
  return items;
}

function itemHasThread(item: Element, threadId: string): boolean {
  if (item.querySelector(`a[data-sidebar-thread-id="${threadId}"]`)) return true;
  const nav = item.getAttribute("data-sidebar-windowed-nav") ?? "";
  return nav.split(" ").some((entry) => entry.startsWith(`${threadId}:`));
}

export class SectionLoadMore {
  private readonly shown = new Map<string, number>();
  private root: Element | null = null;
  private observer: MutationObserver | null = null;
  private frame = 0;
  private poll = 0;
  private lastPath = "";
  private options: LoadMoreOptions;
  private readonly doc: Document;

  constructor(options: LoadMoreOptions, doc: Document = document) {
    this.options = options;
    this.doc = doc;
  }

  start(): void {
    if (!this.doc.getElementById(STYLE_ID)) {
      const style = this.doc.createElement("style");
      style.id = STYLE_ID;
      style.textContent = CSS;
      this.doc.head.appendChild(style);
    }
    this.observer = new MutationObserver((records) => {
      if (records.every((r) => this.isOwnMutation(r))) return;
      this.schedule();
    });
    // The list root is remounted on some navigations; re-attach when it is.
    const view = this.doc.defaultView ?? window;
    this.poll = view.setInterval(() => this.tick(), 500);
    this.tick();
  }

  update(options: LoadMoreOptions): void {
    this.options = options;
    this.schedule();
  }

  stop(): void {
    const view = this.doc.defaultView ?? window;
    view.clearInterval(this.poll);
    view.cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.observer = null;
    this.root = null;
    for (const el of this.doc.querySelectorAll(`[${HIDDEN_ATTR}]`)) {
      el.removeAttribute(HIDDEN_ATTR);
    }
    for (const el of this.doc.querySelectorAll(`[${FOOTER_ATTR}]`)) el.remove();
    this.doc.getElementById(STYLE_ID)?.remove();
  }

  /** Re-attach to a remounted root, and re-apply when the open thread changes. */
  private tick(): void {
    // Fall back to the whole document if the host renames the scroll root.
    const root =
      this.doc.querySelector(ROOT_SELECTOR) ??
      (this.doc.querySelector(GROUP_SELECTOR) ? this.doc.body : null);
    if (root !== this.root) {
      this.observer?.disconnect();
      this.root = root;
      if (root) {
        this.observer?.observe(root, { childList: true, subtree: true });
      }
      this.schedule();
    }
    const path = (this.doc.defaultView ?? window).location.pathname;
    if (path !== this.lastPath) {
      this.lastPath = path;
      this.schedule();
    }
  }

  private isOwnMutation(record: MutationRecord): boolean {
    const nodes = [...record.addedNodes, ...record.removedNodes];
    return (
      nodes.length > 0 &&
      nodes.every(
        (n) =>
          n instanceof Element &&
          (n.hasAttribute(FOOTER_ATTR) || n.closest(`[${FOOTER_ATTR}]`) !== null),
      )
    );
  }

  private schedule(): void {
    if (this.frame) return;
    const view = this.doc.defaultView ?? window;
    this.frame = view.requestAnimationFrame(() => {
      this.frame = 0;
      this.apply();
    });
  }

  apply(): void {
    if (!this.root) return;
    const activeId = activeThreadIdFromPath(
      (this.doc.defaultView ?? window).location.pathname,
    );
    for (const section of this.root.querySelectorAll(GROUP_SELECTOR)) {
      const id =
        section.getAttribute("data-sidebar-section-id") ??
        section.getAttribute("data-sidebar-visibility-group");
      if (id) this.applySection(section, id, activeId);
    }
  }

  private applySection(section: Element, id: string, activeId: string | null): void {
    const items = topLevelItems(section);
    const container = items[0]?.parentElement ?? null;
    const { visible, step } = this.options;
    const limit = Math.max(visible, this.shown.get(id) ?? visible);
    let hidden = 0;
    items.forEach((item, index) => {
      const hide =
        index >= limit && !(activeId !== null && itemHasThread(item, activeId));
      if (hide) hidden += 1;
      if (hide !== item.hasAttribute(HIDDEN_ATTR)) {
        if (hide) item.setAttribute(HIDDEN_ATTR, "");
        else item.removeAttribute(HIDDEN_ATTR);
      }
    });

    let footer = section.querySelector<HTMLElement>(`[${FOOTER_ATTR}]`);
    if (!container || items.length <= visible) {
      footer?.remove();
      if (items.length <= visible) this.shown.delete(id);
      return;
    }
    if (!footer || footer.parentElement !== container) {
      footer?.remove();
      footer = this.doc.createElement("div");
      footer.setAttribute(FOOTER_ATTR, id);
    }
    if (container.lastElementChild !== footer) container.appendChild(footer);
    this.renderFooter(footer, id, items, hidden, limit, step, visible);
  }

  private renderFooter(
    footer: HTMLElement,
    id: string,
    items: HTMLElement[],
    hidden: number,
    limit: number,
    step: number,
    visible: number,
  ): void {
    const signature = `${hidden}|${limit > visible}`;
    // Align the labels with the thread titles above them.
    const title = items[0]?.querySelector(".bb-thread-title");
    if (title) {
      const inset =
        title.getBoundingClientRect().left - footer.getBoundingClientRect().left;
      if (inset > 0) footer.style.paddingLeft = `${Math.round(inset) - 6}px`;
    }
    if (footer.dataset.signature === signature) return;
    footer.dataset.signature = signature;
    footer.replaceChildren();
    if (hidden > 0) {
      footer.appendChild(
        this.button(`Load more (${hidden})`, `Show ${Math.min(step, hidden)} more threads`, () => {
          this.shown.set(id, limit + step);
          this.apply();
        }),
      );
    }
    if (limit > visible) {
      footer.appendChild(
        this.button("Show less", "Show fewer threads", () => {
          this.shown.delete(id);
          this.apply();
        }),
      );
    }
  }

  private button(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const button = this.doc.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return button;
  }
}
