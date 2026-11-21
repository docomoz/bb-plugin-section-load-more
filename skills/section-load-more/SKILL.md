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

Open **Settings → Plugins → Section Load More [Fork]**, or use the CLI.

```sh
bb plugin config section-load-more-fork set visibleThreads 5   # threads shown per section
bb plugin config section-load-more-fork set loadMoreStep 5     # threads each Load more reveals
bb plugin config section-load-more-fork set limitPinnedThreads true
bb plugin config section-load-more-fork set visiblePinnedThreads 8
```

The expanded state is per window and resets on reload. **Limit Pinned threads**
is on by default. **Pinned threads shown initially** sets the initial Pinned
limit independently, with a default of 8. Pinned uses the shared Load more step.
Project groups are not capped.

It relies on the thread-list DOM (`[data-sidebar-section-id]`,
`[data-sidebar-windowed-item]`). If a bb update renames those, the plugin
silently does nothing; the sidebar keeps working.
