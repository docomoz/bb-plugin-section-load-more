# bb-plugin-section-load-more

A [bb](https://getbb.app) plugin that keeps long sidebar sections short.
Each custom section, and the built-in **Threads** group, shows its newest
10 top-level threads. The rest wait behind a **Load more (n)** button at the
end of the same section; **Show less** collapses it again. Several sections
can stay open without one pushing the others out of view.

Nothing is archived, moved, or edited. The open thread always stays visible,
child threads stay under their parent, and Pinned is never capped.

## Install

```sh
bb plugin install https://github.com/siluthfi/bb-plugin-section-load-more
```

Reload the bb window if the button does not appear right away.

## Settings

Settings → Plugins → Section Load More, or:

```sh
bb plugin config section-load-more set visibleThreads 10   # threads shown per section
bb plugin config section-load-more set loadMoreStep 10     # threads each Load more reveals
```

How far a section is expanded is kept per window and resets on reload.

## How it works

The plugin registers an invisible app overlay
(`app.slots.experimental_appOverlay`) that decorates the built-in thread-list
plugin's DOM instead of replacing the list, so pinning, nesting, drag and
drop, menus, and status indicators keep working. `controller.ts` documents
the DOM it relies on (`[data-sidebar-section-id]`,
`[data-sidebar-visibility-group="threads"]`, `[data-sidebar-windowed-item]`).
If a bb update changes that markup, the plugin stops capping and the sidebar
behaves as it does without it.

Tested with bb 0.46.

## Development

```sh
bb plugin build
npm test        # node:test + jsdom, Node 22.18 or newer
```

## License

MIT
