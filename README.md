# kImgMap

> Visual HTML image map editor plugin — part of the K series.

A zero-dependency JavaScript plugin that replaces a plain `<textarea>` with a
fully interactive SVG-based imagemap editor. Draw, move, resize, and configure
`<area>` elements visually, then get clean HTML output.

**[Live demo](https://kastrack.github.io/kImgMap/)** ·
**[Documentation](https://kastrack.github.io/kImgMap/docs.html)** ·
**[GitHub](https://github.com/KAStrack/kImgMap)**

---

## Features

- **Two modes** — modal overlay or embedded inline editor
- **Three shapes** — rectangle, circle, polygon (all configurable)
- **Mouse, touch & pen** — built on Pointer Events; larger handles on touch screens
- **Move & resize** — 8-handle rects, 1-handle circles, per-vertex polygon handles
- **Undo / redo** — toolbar buttons and `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`
- **Keyboard & screen-reader accessible** — WCAG 2.2 AA
- **Parse existing areas** — opens with pre-loaded areas from the textarea
- **Configurable attributes** — any subset of standard attrs + unlimited custom attrs (e.g. `data-value`)
- **Output formats** — bare `<area>` tags or full `<map name="…">` wrapper
- **CSS-variable theming** — every colour is a variable; light, dark and auto themes built in
- **Works anywhere** — plain `<script>` (UMD), ES module, CommonJS or AMD; resists host-page CSS frameworks
- **Auto-init** — `data-kimgmap` attribute + `kImgMap.init()`
- Zero dependencies, ~20 kB gzipped (JS + CSS)

---

## Files

| File | Purpose |
|---|---|
| `kImgMap.js` | Plugin source — the only script needed |
| `kImgMap.css` | Plugin styles — required alongside the JS |
| `docs/kImgMap.min.js` | Minified build of `kImgMap.js` |
| `docs/kImgMap.mjs` / `docs/kImgMap.min.mjs` | ES module build (and minified) |
| `docs/kImgMap.min.css` | Minified build of `kImgMap.css` |
| `docs/index.html` | Live examples page ([view online](https://kastrack.github.io/kImgMap/)) |
| `docs/docs.html` | Full API & theming documentation ([view online](https://kastrack.github.io/kImgMap/docs.html)) |
| `docs/shared.css` | Shared styles for the examples/docs site |
| `test/` | Playwright browser test suite (`npm test`) |
| `scripts/build.js` | Generates the builds in `docs/` (`npm run build`) |
| `package.json` | Dev tooling only — the plugin itself has no dependencies |
| `LICENSE` | MIT licence |

The `docs/` folder is published with GitHub Pages.

---

## Installation

Download `kImgMap.js` and `kImgMap.css` (or the minified builds in `docs/`)
from the [GitHub repository](https://github.com/KAStrack/kImgMap), or load
them straight from the jsDelivr CDN:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/KAStrack/kImgMap/docs/kImgMap.min.css">
<script src="https://cdn.jsdelivr.net/gh/KAStrack/kImgMap/docs/kImgMap.min.js"></script>
```

For production, pin a release tag, e.g. `.../gh/KAStrack/kImgMap@v1.15.0/docs/kImgMap.min.js`.

### As a module

`docs/kImgMap.mjs` (minified: `docs/kImgMap.min.mjs`) is an ES module with a
default and a named export; `kImgMap.js` is UMD. Installed as a package (e.g.
`npm install github:KAStrack/kImgMap`), `import` picks the ES module and
`require` the UMD build:

```js
import kImgMap from 'kimgmap';           // bundlers (Vite, webpack, Rollup, esbuild) and Node
import 'kimgmap/kImgMap.css';

import kImgMap from 'https://cdn.jsdelivr.net/gh/KAStrack/kImgMap@v1.15.0/docs/kImgMap.min.mjs';  // native modules

const kImgMap = require('kimgmap');      // CommonJS
```

**AMD:** if the page has an AMD loader such as RequireJS, the UMD build registers
itself as an anonymous AMD module instead of setting `window.kImgMap` — load it
through the loader, or use the ES module build.

Load it one way per page: an app
that both `import`s and `require`s it gets two separate copies, which don't know
about each other's editors.

### Browser support

Current Chrome, Edge, Firefox and Safari, desktop and mobile — the test suite runs
in Chromium, Firefox and WebKit. The code uses ES2020 and Pointer Events, so the
practical minimum is Chrome/Edge 90, Firefox 90 and Safari 14.1 (iOS 14.5).
Browsers without the `inert` attribute (before Chrome 102, Firefox 112, Safari
15.5) still trap `Tab` inside the modal, but a screen reader's virtual cursor can
reach the page behind it.

---

## Quick Start

Point `new kImgMap()` at an `<img>` and pass the textarea via the `textarea`
option. The textarea can be **anywhere in the document** — no shared container required.

```html
<link rel="stylesheet" href="kImgMap.css">
<script src="kImgMap.js"></script>

<img id="my-image" src="photo.jpg" alt="">
<textarea id="my-map"></textarea>

<script>
  new kImgMap(
    document.getElementById('my-image'),
    {
      textarea: '#my-map',  // CSS selector string, or pass the element directly
      mode:     'modal',    // or 'inline'
    }
  );
</script>
```

### Auto-init

```html
<div data-kimgmap data-kimgmap-mode="modal">
  <img src="photo.jpg" alt="">
  <textarea></textarea>
</div>

<script>
  kImgMap.init(); // finds all [data-kimgmap] containers
</script>
```

---

## Options

| Option | Default | Description |
|---|---|---|
| `mode` | `'modal'` | `'modal'` or `'inline'` |
| `shapes` | `['rect','circle','poly']` | Enabled drawing tools |
| `defaultShape` | `'rect'` | Active tool on open |
| `output` | `'areas'` | `'areas'` or `'map'` |
| `mapName` | `''` | `<map name>` when `output: 'map'` |
| `attributes` | `['href','alt','title','target']` | Standard attrs in the Properties panel. Each entry is a plain string or `{ attr, label }` for a custom display name. |
| `customAttributes` | `[]` | Extra attrs to expose. Each entry is a plain string or `{ attr, label }`. E.g. `[{ attr: 'data-value', label: 'Value' }]`. |
| `onAttributeChange` | `null` | Called as `(area, attr, value)` when any attribute field changes. Return an object of overrides to apply — e.g. `{ title: value, alt: value }`. Applied to the area and reflected in visible panel inputs. |
| `outputAttributes` | `null` | Explicit list of attributes written to `<area>` output. When `null`, every attribute stored on the area is written — standard, custom, and any parsed from existing HTML (attributes that were present but empty, like `alt=""`, are kept; clearing a field in the panel removes its attribute). When set explicitly, **only** the listed attributes are written, and **all of them are always written** — even if empty — so attrs with no UI field (e.g. `alt`, `target`) are never silently dropped. |
| `confirmDiscard` | `true` | When closing the modal with unsaved changes via `Escape`, the × button or a backdrop click, ask "Discard your unsaved changes?" first. The Cancel button always discards without asking. Labels via `labels.discardPrompt`, `labels.keepEditing`, `labels.discardChanges`. |
| `mandatoryTitles` | `false` | When `true`, Save is blocked if any area is missing a title. Missing areas pulse red on the canvas and show a `!` in the sidebar list. Errors clear as titles are filled. Label via `labels.errorMissingTitles`. |
| `showTextarea` | `false` | `false` — textarea hidden. `true` — always visible below trigger. `'optional'` — hidden initially, with a **Show Code** toggle button to the right of the trigger (modal mode only). |
| `showAttributePanel` | `true` | Show Properties panel on selection |
| `editable` | `true` | Allow move/resize after drawing |
| `theme` | `null` | `'light'`, `'dark'` or `'auto'` (follows the OS setting, live) for the inline editor or the modal; `null` leaves it to your CSS |
| `className` | `''` | Extra class name(s) for the editor (inline) or the modal overlay — e.g. to scope a custom theme to one instance |
| `textarea` | auto | The textarea to read/write. Accepts a CSS selector string or DOM element. Can be **anywhere in the document** — no shared container needed. If omitted, looks for a sibling `<textarea>` in the same parent as the image. |
| `labels` | `{…}` | UI string overrides for localisation — see the [full key list](https://kastrack.github.io/kImgMap/docs.html#options) |
| `onUpdate(html, areas)` | `null` | Fired on every change. Callbacks receive copies of the areas — changing them doesn't change the editor (use `setAreas()`) |
| `onSave(html, areas)` | `null` | Fired on modal Save |
| `onOpen()` | `null` | Fired when modal opens |
| `onClose(saved)` | `null` | Fired when modal closes |

---

## Instance API

```js
const editor = new kImgMap(img, opts);

editor.open();               // open modal (modal mode only)
editor.close(saved?);        // close modal
editor.getAreas();           // → deep copy of areas array
editor.setAreas(areas);      // replace areas, re-render, sync output, start a new undo history
editor.undo(); editor.redo(); // also Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and the toolbar
editor.getHTML();            // → current HTML output string
editor.destroy();            // remove editor, restore DOM
```

`setAreas()` validates its input: each area needs a known `shape` and enough
numeric `coords` (an array, or a string as in HTML) — others are skipped with a
console warning — ids are made unique strings, and attribute names that can't be
written to a tag are dropped. A non-array throws a `TypeError`.

### Static

```js
kImgMap.init('[data-kimgmap]', opts); // → kImgMap[] (containers that already have an editor return it)
kImgMap.get(img);                     // → the editor attached to img, or null
kImgMap.responsive(img);              // scale a published <map> to the displayed image → stop()
kImgMap.version;                      // → '1.15.0'
```

An image has at most one editor: `new kImgMap()` on an image that already has
one throws — `destroy()` it first.

---

## Theming

Every visual aspect is a CSS custom property. Override them on `:root` or
any ancestor element for scoped theming. Inline editors live where the image
was, so a wrapper selector works; the modal is appended to `<body>`, so scope
modal themes to `:root` or `.kimgmap-overlay` — or give one instance its own
class with the `className` option, which works in both modes:

```js
new kImgMap(img, { className: 'my-theme', theme: 'dark' });
```

```css
/* Custom indigo theme for that instance (inline editor or modal) */
.my-theme {
  --kimgmap-primary:       #4f46e5;
  --kimgmap-primary-dark:  #4338ca;
  --kimgmap-bg:            #1e1b4b;
  --kimgmap-surface:       #312e81;
  --kimgmap-border:        #4338ca;
  --kimgmap-text:          #e0e7ff;
  --kimgmap-text-muted:    #a5b4fc;
  --kimgmap-area-fill:     rgba(129,140,248,0.2);
  --kimgmap-area-stroke:   #818cf8;
  --kimgmap-sel-stroke:    #a78bfa;
}
```

### Dark theme

Use the `theme` option — `'dark'`, `'light'`, or `'auto'` to follow the
operating system's setting live:

```js
new kImgMap(img, { theme: 'auto' });
```

You can also set `data-theme="dark"` on an inline `.kimgmap-editor` yourself, or
override the surface variables via `prefers-color-scheme`. The theme rules have no
specificity, so your own token overrides still win inside them:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --kimgmap-bg:             #0f172a;
    --kimgmap-surface:        #1e293b;
    --kimgmap-surface-raised: #2d3d52;
    --kimgmap-border:         #334155;
    --kimgmap-text:           #f1f5f9;
    --kimgmap-text-muted:     #94a3b8;
  }
}
```

See the [documentation](https://kastrack.github.io/kImgMap/docs.html#css-vars) for the full list of CSS variables.

The editor uses border-box sizing throughout and resets its own controls, so CSS
frameworks that style bare `button` / `input` / `select` elements (Pico,
Bootstrap, Tailwind's preflight, …) don't restyle it. The how-to line under the
toolbar can be hidden with `.kimgmap-tip { display: none }`. To override a component
style rather than a token, match that scoping, e.g.
`.kimgmap-editor .kimgmap-tool { border-radius: 0; }`.

---

## Keyboard Shortcuts

Everything can be done without a pointer. In modal mode shortcuts are active
while the modal is open; in inline mode, while the editor has focus.

| Where | Key | Action |
|---|---|---|
| Anywhere | `Escape` | Leave a focused field · cancel an in-progress polygon · close the modal (asks first if there are unsaved changes) |
| Anywhere | `Delete` / `Backspace` | Delete the selected area (when no text field is focused) |
| Anywhere | `Ctrl/Cmd + D` | Duplicate the selected area (offset by 10px) |
| Anywhere | `Ctrl/Cmd + Z` | Undo (while drawing a polygon: remove its last point). In a text field, the field's own undo applies |
| Anywhere | `Ctrl/Cmd + Shift + Z`, `Ctrl + Y` | Redo |
| Modal | `Tab` / `Shift+Tab` | Move between controls; focus stays inside the dialog |
| Toolbar | `←` `→` `Home` `End` | Move between tools (the toolbar is a single Tab stop) |
| Image | `Enter` | Add an area with the active tool, centred on the image |
| Image | Arrow keys | Move the selected area 1px (`Shift`: 10px) |
| Image | `Alt` + arrow keys | Resize the selected area (rect: right/bottom edge; circle: radius) |
| Area list | `↑` `↓` `Home` `End` | Select another area |
| Properties | Coords field | Type exact coordinates; applied on `Enter` or when leaving the field |
| Image | Double-click / double-tap | Close an in-progress polygon (or click/tap the last or first point again — a ring marks the first point's closing zone) |
| Image | `Shift` + drag / click | With a drawing tool, start a new shape on top of an existing area instead of selecting it (polygon points always land on areas once a polygon is started) |

---

## Accessibility

kImgMap aims for WCAG 2.2 AA:

- **Keyboard** — every action is available without a pointer (see the table above); polygon vertices and exact sizes can be typed into the Coords field.
- **Screen readers** — the modal is a labelled dialog (background made `inert`, focus trapped and returned to the trigger on close); the toolbar is an ARIA toolbar with pressed states; the area list is a listbox; a polite live region announces additions, deletions, selection and polygon progress; validation errors mark fields `aria-invalid` and move focus to them.
- **Visual** — default colours meet 4.5:1 text and 3:1 field-border contrast in light and dark themes; selection is shown by stroke weight and a list marker, not colour alone; forced-colours (High Contrast) and `prefers-reduced-motion` are supported.

If you override the colour tokens, keep their contrast — e.g. white on `--kimgmap-primary` should stay ≥ 4.5:1.
For a custom **dark** palette, also use `theme: 'dark'`, so the danger,
error-text and field-border tokens are the dark-background versions.

## Touch & Pen

All drawing and editing works with touch and pen input as well as a mouse.
Dragging on the image draws or edits instead of scrolling the page (the overlay
sets `touch-action: none`), so on small screens scroll using the area outside
the image. Handles and hit targets are finger-sized while you use touch and
shrink back when you use a mouse or pen (phones and tablets start large). Only the first finger is tracked — extra touches are ignored, and
an interrupted touch (`pointercancel`) undoes the in-progress change.

With a pen, only tip contact draws or edits (barrel and eraser buttons are
ignored), hovering shows the polygon preview line, and touches that land while
the pen is drawing — e.g. a resting palm — are ignored.

---

## Coordinate Format

Coordinates are stored in standard HTML imagemap convention — natural image
pixels from the top-left corner. For `srcset` images with `w` descriptors, the
largest candidate's declared width (and the image's aspect ratio) defines the
coordinate space:

| Shape | Format |
|---|---|
| rect | `x1,y1,x2,y2` |
| circle | `cx,cy,r` |
| poly | `x1,y1,x2,y2,…` (flat pairs) |

The editor maps the pointer to natural pixels via SVG `viewBox`, so you can
edit at any display size. Browsers, however, apply `<area>` coords to the image
*as rendered*: the published map lines up when the image is shown at its natural
size, and needs scaling otherwise — see below.

---

## Publishing the Map

Connect the image to the map with `usemap`, using `output: 'map'` (or your own
`<map>` wrapper around the `<area>` output):

```html
<img src="floorplan.jpg" usemap="#floorplan" alt="Floor plan">
<map name="floorplan">
  <area shape="rect" coords="60,50,280,200" href="/north" alt="North wing">
</map>
```

If the image is displayed at any size other than its natural size (e.g.
`max-width: 100%` on a responsive page), scale the map to fit — kImgMap
includes a tiny helper you can use on the public page:

```html
<script src="kImgMap.min.js"></script>
<script>
  const stop = kImgMap.responsive('img[usemap="#floorplan"]');  // keeps the map in sync on resize
  // stop() disconnects and restores the original coords
</script>
```

`responsive()` only needs the JavaScript file (no CSS). Notes:

- The map's coords must be in the image's **natural** pixels (what kImgMap writes).
- Don't put padding or a border on the mapped image — browsers differ on where
  they measure area coords from in that case.
- The map is found by `name` or `id`. Calling `responsive()` again for the same
  image returns the same `stop()`; one map can't serve two images shown at
  different sizes.

**Untrusted editors:** kImgMap escapes attribute values and never writes an
attribute name that could break out of the tag, but it keeps whatever attributes
the input has — including event handlers such as `onclick` and `javascript:` URLs.
If people you don't trust can edit maps, sanitise the saved HTML on the server.

---

## Changelog

### v1.15.0
- **Undo / redo** — toolbar buttons, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` / `Ctrl+Y`, and `undo()` / `redo()`. Typing in one field, or a run of arrow-key nudges, is one step; while a polygon is being drawn, undo removes its last point. Up to 100 steps per modal session; `setAreas()` starts a new history
- **ES module build** — `docs/kImgMap.mjs` and `docs/kImgMap.min.mjs` with default and named exports, and a `package.json` `exports` map (`import` → ES module, `require` → UMD). The earlier "import as an ES module" example only worked through a bundler's CommonJS interop
- **`theme` option** (`'light'` | `'dark'` | `'auto'`) — applies to the modal from its first frame (no `onOpen` workaround), and `'auto'` follows the OS setting live. The theme rules no longer outrank your own token overrides
- **`className` option** — scope a custom theme to one instance, modal included
- **Clear All asks inside the editor** instead of with `window.confirm()`, which sandboxed iframes block. Cancel or `Escape` keeps the areas; the confirm button uses `labels.clearAll`
- **Drawing over existing areas** — once a polygon is started its points can land on other areas, and `Shift` + drag/click starts a new shape on top of an area
- **How-to line** under the toolbar for the active tool (labels `tipSelect`, `tipRect`, `tipCircle`, `tipShift`, `tipPoly`; hide it with `.kimgmap-tip { display: none }`), and a ring marking where clicking finishes a polygon
- **API hardening:** `setAreas()` validates its input — unusable areas are skipped with a console warning, ids become unique strings, and a non-array throws a `TypeError`. Attribute names that would break out of the `<area>` tag (spaces, quotes, `=`, `>`, `/`) are never written, whether they come from `setAreas()`, `onAttributeChange` or the options; unknown shapes and invalid attribute options are dropped with a warning. An image can have only one editor: a second `new kImgMap()` throws and `kImgMap.init()` returns the existing one. New `kImgMap.get(img)`. `open()` after `destroy()` does nothing
- **Breaking (CSS):** the plugin's control rules are now two-class selectors such as `:is(.kimgmap-editor, .kimgmap-modal) .kimgmap-tool`, so an override written as `.kimgmap-tool { … }` no longer applies — prefix it with `.kimgmap-editor` (or `.kimgmap-modal`), or use the `--kimgmap-*` tokens
- **Breaking:** callbacks (`onUpdate`, `onSave`, `onAttributeChange`) now receive copies of the areas, so changing them no longer changes the editor — use `setAreas()`
- Fixed: a page that stopped `pointerup` from bubbling could leave a drag stuck; the listeners are now capture-phase on `window`
- Fixed: CSS frameworks such as Pico restyled the editor's buttons, fields and labels, and the Edit Image Map / Show Code buttons. The plugin now uses border-box sizing throughout and resets its controls with selectors that outrank framework rules. The inline editor is a labelled `region` named after the image's `alt`, instead of a `group`
- Property fields use 16px text on touch screens, so iOS doesn't zoom the page when one is focused
- Faster with many areas: adding, duplicating and deleting no longer re-render every area, and rendering reads layout once rather than twice per area (with 1,000 areas, about 100 ms → under 20 ms per change)
- `LICENSE` file; GitHub Actions test workflow; `npm run build` now runs `scripts/build.js` (and `npm run check-build` checks the builds are current); browser support is documented
- Docs site: no sideways scrolling on phones, navigation on small screens, AA contrast in both themes, underlined links in running text, and an `<h1>` on the docs page

### v1.14.0
- **New: `kImgMap.responsive(img)`** — keeps a published `<map>` lined up with its image at any display size (browsers apply `<area>` coords in rendered pixels, while kImgMap writes natural pixels); returns a `stop()` function. Works with any image map
- Fixed: in inline mode, an image wider than the editor lost its left edge (it was centred with no way to scroll back); images now fit the editor's width, and very tall ones scroll inside the image area (capped at `--kimgmap-inline-max-height`, default `80vh`)
- Fixed: host-page `img` styles (padding, borders, `object-fit`, `width: 100%`) and width/height attributes could misalign or distort the image under the overlay; the editor image now ignores them, and the overlay stretches with the image if CSS changes its aspect ratio
- Inline mode supports images inside `<picture>` (the `<source>`s keep applying) and inside links, buttons or labels (the editor is placed after the link, so clicks don't navigate); both are restored by `destroy()`
- Areas that already extend past the image (e.g. from an imported map) no longer jump inside when first moved, resized or nudged
- The minimum shape size and the handle / hit-target sizes are now measured in screen pixels: no more junk areas from a tiny jitter on very large photos, or oversized handles on small upscaled images

### v1.13.0
- **Keyboard operation** — the image area is a focusable canvas: `Enter` adds an area with the active tool, arrow keys move the selection (`Shift`: 10px) and `Alt`+arrows resize it; the Coords field is now editable (validated and clamped); the toolbar is a single Tab stop with arrow-key navigation; the area list is a keyboard-operable listbox
- **Modal dialog semantics** — `role="dialog"` with a labelled `<h2>` title, the rest of the page is made `inert`, `Tab` stays inside the dialog, and focus returns to the trigger on close
- **Screen reader support** — tool buttons expose `aria-pressed`; a live region announces additions, deletions, duplicates, Clear All, selection and polygon progress; validation errors set `aria-invalid`, describe the problem and move focus to the first invalid field, and are re-announced on every failed Save; decorative SVGs are hidden
- **Contrast** — default `--kimgmap-primary` is now `#2563eb` and `--kimgmap-danger` `#dc2626` (AA with white text); new tokens `--kimgmap-input-border`, `--kimgmap-danger-text`, `--kimgmap-text-on-danger`; dark theme overrides for danger and field borders; shape badges use the theme's text colour
- The selected area has a thicker stroke and the selected list row a marker, so selection doesn't rely on colour; forced-colours (High Contrast) rules; `prefers-reduced-motion` turns off the error pulse and modal animation
- Delete and Clear All are disabled when there is nothing to act on
- `Enter` on the image finishes a polygon being drawn; with `editable: false` the keyboard and Coords field can't change geometry; modals inert the page in any open/close order
- List labels prefer `title`, then `alt`, then `href`, then the localised shape name ("Circle 3")
- New label keys: `toolbar`, `canvas`, `canvasHint`, `drawHint`, `polyHint`, `polyStarted`, `polyCancelled`, `added`, `deleted`, `duplicated`, `cleared`, `coordsRect`, `coordsCircle`, `coordsPoly`, `invalidCoords`
- Test suite: axe-core scans, keyboard-only end-to-end session, contrast checks in both themes; failed tests are retried once and reported as flaky if they then pass

### v1.12.0
- **Unsaved changes are protected** — `Escape`, the × button and backdrop clicks now ask before discarding edits (new `confirmDiscard` option, default `true`; labels `discardPrompt`, `keepEditing`, `discardChanges`). Cancel still discards immediately
- **Escape in a property field** now just leaves the field instead of closing the modal and discarding the session
- Fixed: calling `destroy()` or `close()` from inside `onSave` restored the pre-edit state and reported `onClose(false)` — the save is now kept and `onClose(true)` fires
- **Lossless round trips** — saving no longer drops data: attributes that are present but empty (`alt=""`, `nohref`) are kept; `<area>` tags that can't be edited visually (`shape="default"`, too few coords) are preserved and appended to the output (filtered by `outputAttributes` like any other area; kept by `setAreas()`, removed by Clear All); the `<map name>` from the textarea is reused when `mapName` isn't set
- **Breaking:** an area's `attrs` now only contains attributes that are actually set. Newly drawn areas start with `attrs: {}` and clearing a field in the Properties panel deletes that key — code that read e.g. `area.attrs.title.trim()` should use `(area.attrs.title ?? '')`
- Fixed: for `srcset` images the modal used the pixel size of whichever candidate loaded, so coordinates could be 2× off depending on the device. Coordinates now use the page image's natural size; with `w` descriptors (`800w, 1600w`), whose natural size follows the viewport, they use the largest candidate's declared width. The coordinate space is fixed for the whole editing session
- Fixed: pressing Enter in a property field submitted a `<form>` the editor was embedded in
- The discard prompt makes the editor behind it inert; an in-progress polygon counts as an unsaved change; areas loaded in `onOpen` don't; if `onSave` throws, the session stays unsaved
- Fixed: after typing in a property field, the first click on another area in the list was lost (and the delete button could then remove the wrong area); `onUpdate` / `onAttributeChange` no longer fire a second time when a field loses focus
- Fixed: `destroy()` now restores the textarea's original inline style exactly (it previously un-hid textareas the page had hidden)
- The modal's Cancel and Save buttons have dedicated `kimgmap-cancel` / `kimgmap-save` classes
- Test suite: fails on uncaught page errors, per-test timeouts, exact coordinate checks for clamped values, more faithful simulated input, and ~30 new tests for previously untested behaviour

### v1.11.1
- **Palm rejection** — a touch that lands while a pen (or mouse) interaction is in progress is ignored, and no longer switches handles to finger size mid-stroke; a pen or mouse press always takes over from a touch interaction that never ended
- Fixed: closing the modal before its first animation frame could leave the closing overlay fully visible during its fade-out
- Test suite now runs in Chromium, Firefox and WebKit, with mouse, touch and pen input, and checks that the minified builds are up to date

### v1.11.0
- **Touch and pen support** — all interaction now uses Pointer Events, so drawing, moving, resizing and selecting work with fingers and styluses as well as a mouse
- Handles (~11px) and hit targets (~24px) are enlarged while touch is in use, and return to mouse sizes for mouse/pen input — so touch-screen laptops stay precise with a mouse
- Dragging on the image no longer scrolls or zooms the page on touch devices (`touch-action: none` on the overlay)
- Multi-touch: only the first finger drives an interaction; additional fingers are ignored
- An interrupted touch (`pointercancel`) now discards an in-progress draw and reverts an in-progress move/resize
- Polygons: clicking or tapping the last point again finishes the polygon (this is how double-click and double-tap close it, so no duplicate vertex); with fewer than 3 points such a click is ignored rather than discarding the polygon
- Areas are selected on press rather than on click, including with `editable: false` — taps register reliably, and pressing an area never starts a new shape on top of it
- An interaction whose release was lost (e.g. the touch ended outside the browser) no longer locks the editor — the next press of the same input takes over
- Handles are moved in place during a resize instead of being rebuilt, so the element under the finger is never removed mid-gesture (fixes stalled resizes on iOS)
- Fixed: releasing a drag over the modal backdrop cancelled the modal and discarded all edits; only a press *and* release on the backdrop closes it now
- Touching the sidebar on a touch device no longer pulls focus away from a property field mid-scroll
- Added an automated browser test suite (`npm test`, Playwright) covering mouse and touch input against both the source and minified builds

### v1.10.0
- **Security:** textarea content is now parsed with an inert `DOMParser` (markup such as `<img onerror>` no longer executes), and all attribute values, shapes, and labels are HTML-escaped before rendering
- **Cancel now discards edits** — closing the modal without saving restores the textarea and areas to their state when the modal opened (`onUpdate` fires with the restored HTML)
- Keyboard shortcuts (`Delete`, `Ctrl/Cmd+D`, `Escape`) now also work in inline mode while the editor has focus; `Ctrl/Cmd+D` works with Shift/Caps Lock
- Parser accepts legacy shape aliases (`circ`, `polygon`, `rectangle`) and space/semicolon-separated coords, tolerates unit suffixes like `10px`, treats missing or invalid shapes as `rect` (per the HTML spec), normalises reversed rect coords, and skips areas with too few coords instead of rendering `NaN`
- Fixed: closing a polygon with a double-click added a duplicate final vertex
- Fixed: with the Polygon tool active, clicking a resize handle started a new polygon
- Fixed: `kImgMap.init()` without `data-kimgmap-shape` started in Select mode instead of `defaultShape` (options explicitly set to `undefined` no longer override defaults)
- Fixed: `open()` while already open (e.g. pressing Enter on the trigger) stacked a second overlay; reopening within 300 ms of closing removed the new modal
- Fixed: `setAreas()` threw on a modal instance before its first `open()`
- Fixed: `close()` on an inline editor disabled it; `destroy()` no longer fires `onClose` when no modal was open
- Fixed: dragging a polygon against an image edge squashed it — it now moves as a whole; circles stay inside the image while drawing/resizing
- Fixed: right-click no longer starts a draw, drag or resize
- Fixed: resizing an unselected area showed its coords in the selected area's panel; it is now selected on resize
- Fixed: Duplicate stayed enabled after deleting the selected area; Clear All now clears validation errors
- Handles on areas touching the image edge are no longer clipped; handle size refreshes when the editor is resized
- Modal clone uses `currentSrc` (supports `srcset`-only images); the page's own `body` overflow style is restored on close
- New label keys: `areas`, `properties`, `shape`, `coords`, `close`, `missingTitle`, `confirmClear`
- CSS: toolbar wraps on narrow widths; below 640px tool labels hide and the sidebar stacks under the image; dark theme sets `color-scheme: dark`
- Repository layout: demo, docs, and minified builds now live in `docs/` (GitHub Pages)

### v1.9.2
- With `mandatoryTitles`, the Properties-panel field for a flagged area is now highlighted (red border) alongside the shape, list, and banner cues. When the title is mirrored from another attribute via `onAttributeChange` (so no `title` field is shown), each empty field is highlighted instead
- The field highlight and error state now clear live as the title is filled in, even when the title is populated indirectly through `onAttributeChange`

### v1.9.1
- Properties panel: user-fillable attribute fields now appear above the read-only Shape and Coords rows

### v1.9.0
- Both `attributes` and `customAttributes` now accept `{ attr, label }` objects for custom display names in the Properties panel (e.g. `{ attr: 'data-value', label: 'Value' }`). Plain strings still work — fully backwards compatible. The real attribute name is shown as a tooltip on the label.

### v1.8.0
- Added `onAttributeChange(area, attr, value)` callback — return an object of attr overrides to mirror values across fields (replaces `fillAltWithTitle`)
- Removed `fillAltWithTitle` option

### v1.7.1
- Replaced separate Copy and Paste buttons with a single **Duplicate** button (`Ctrl/Cmd+D`) — copies and immediately pastes the selected area, offset by 10px

### v1.7.0
- Added copy/paste for areas — toolbar Copy/Paste buttons and `Ctrl/Cmd+C` / `Ctrl/Cmd+V` keyboard shortcuts. Pasted area is offset by 10px and immediately selected. Buttons are disabled when there is nothing to act on.

### v1.6.1
- Fixed: validation error banner was incorrectly visible on open — CSS `display: flex` was overriding the `hidden` attribute

### v1.6.0
- Added `mandatoryTitles` option — Save is blocked if any area is missing a title. Missing areas pulse red on the canvas and show a `!` badge in the sidebar list. Errors clear automatically as each title is filled in.

### v1.5.0
- Fixed: clicking or dragging an existing area while a draw tool is active now correctly moves the area rather than drawing a new one on top of it

### v1.4.1
- Fixed `destroy()` with `showTextarea: 'optional'` — textarea now preserves its visibility state at the time of destroy rather than always being restored to visible

### v1.4.0
- Added `showTextarea: 'optional'` — a Show Code / Hide Code toggle button appears beside the trigger button to show or hide the textarea on demand. Labels customisable via `labels.showCode` / `labels.hideCode`.

### v1.3.0
- Fixed `outputAttributes` — all listed attributes now always appear in output, even if empty, fixing attrs like `alt` and `target` being silently dropped when they had no UI field
- Added `showTextarea` option — keeps the textarea visible below the trigger button

### v1.2.0
- Added `outputAttributes` option — explicit control over which attributes are written to `<area>` output, independent of the UI
- Fixed `fillAltWithTitle` — now works even when `alt` is not in `attributes`

### v1.1.0
- Added `fillAltWithTitle` option — mirrors the `title` field into `alt` as you type

### v1.0.0
- Initial release

## Development

```bash
npm install
npx playwright install chromium firefox webkit   # one-time browser download
npm test                 # every browser × both builds (source and minified)
npm run test:chromium    # quick run: Chromium, source build only
npm run build            # regenerates the builds in docs/ (scripts/build.js)
npm run check-build      # fails if they are out of date
```

GitHub Actions runs `check-build` and the full test suite on every push and pull
request (`.github/workflows/test.yml`).

`GREP=pattern npm test` runs a subset (e.g. `GREP=pen`); `VERBOSE=1` lists every
test. Interaction tests run once each with mouse, touch and pen. In Chromium all
three are real input; in Firefox and WebKit, mouse and touch taps are real while
touch drags and pen are simulated with dispatched Pointer Events (the few tests
that need real browser gestures, like scroll blocking, are skipped there). See
`test/harness.js`.

## License

MIT © 2026 K Company — see [LICENSE](LICENSE)
