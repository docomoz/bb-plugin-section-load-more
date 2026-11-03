---
name: section-load-more
description: Explain or configure the Section Load More plugin, which caps each custom sidebar section at N threads behind a Load more button.
---

# Section Load More

The plugin decorates bb's built-in sidebar thread list. Each custom section
(the ones in `bb thread section list`) and the built-in Threads group show their first N top-level threads in
the list's own order; the rest are hidden behind **Load more (k)** at the end
of the same section. **Show less** returns to N. Threads are never moved,
archived, or edited. Child threads stay under their parent, and the open
thread always stays visible.

Settings (Settings → Plugins → Section Load More, or the CLI):

```sh
bb plugin config section-load-more set visibleThreads 10   # threads shown per section
bb plugin config section-load-more set loadMoreStep 10     # threads each Load more reveals
```

The expanded state is per window and resets on reload. Pinned and
project groups are not capped.

It relies on the thread-list DOM (`[data-sidebar-section-id]`,
`[data-sidebar-windowed-item]`). If a bb update renames those, the plugin
silently does nothing; the sidebar keeps working.
