/*!
 * kImgMap v1.15.0
 * Visual HTML image map editor plugin
 * Part of the K-series by K Company
 * MIT License — https://github.com/KAStrack/kImgMap
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.kImgMap = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* =========================================================================
   * Constants & Defaults
   * ========================================================================= */

  const VERSION = '1.15.0';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const DEFAULTS = {
    /** Editor display mode: 'modal' | 'inline' */
    mode: 'modal',

    /** Enabled drawing tools. Any subset of ['rect', 'circle', 'poly'] */
    shapes: ['rect', 'circle', 'poly'],

    /** Which shape tool is active on open */
    defaultShape: 'rect',

    /** Output format: 'areas' (just <area> tags) | 'map' (full <map> wrapper) */
    output: 'areas',

    /** Name attribute for the <map> element (only used when output === 'map') */
    mapName: '',

    /**
     * Standard <area> attributes surfaced in the Properties panel.
     * Each entry is either a plain attribute name string, or an object
     * { attr, label } to show a custom display name in the panel.
     * Example: ['href', { attr: 'title', label: 'Tooltip' }, 'target']
     */
    attributes: ['href', 'alt', 'title', 'target'],

    /**
     * Custom attributes to expose in the Properties panel.
     * Each entry is either a plain string or { attr, label }.
     * Example: [{ attr: 'data-value', label: 'Value' }, 'data-category']
     */
    customAttributes: [],

    /** Show the Properties panel in the sidebar when an area is selected */
    showAttributePanel: true,

    /** Allow moving and resizing areas after they are drawn */
    editable: true,

    /**
     * When true, the Save button (modal mode) will refuse to close if any area
     * is missing a title. Areas without a title are highlighted with a visual
     * error cue and an error banner is shown. The cue clears automatically as
     * each title is filled in.
     */
    mandatoryTitles: false,

    /**
     * When true, closing the modal with unsaved changes via Escape, the ×
     * button or a backdrop click asks for confirmation first. The Cancel
     * button always discards without asking.
     */
    confirmDiscard: true,

    /**
     * Controls textarea visibility alongside the trigger button (modal mode only).
     *   false      — textarea is hidden entirely (default)
     *   true       — textarea is always visible below the trigger button
     *   'optional' — textarea is hidden initially; a "Show Code" toggle button
     *                appears to the right of the trigger button to show/hide it
     */
    showTextarea: false,

    /**
     * Controls which attributes are written to the <area> HTML output.
     * When null (default), every non-empty attribute stored on the area is
     * written (standard, custom, and any parsed from existing HTML).
     * Set to an explicit array to write exactly that set, always — e.g. include
     * 'alt' in the output without showing it in the UI. Hidden attrs will be
     * blank unless populated via onAttributeChange.
     */
    outputAttributes: null,

    /**
     * Colour theme of the editor (inline) or the modal:
     *   null    — leave it to your CSS (default)
     *   'light' | 'dark' — the built-in surface/text palette, over tokens set on
     *               :root (tokens set on the editor itself, e.g. via className, still win)
     *   'auto'  — follow the operating system's light/dark setting
     */
    theme: null,

    /**
     * Extra class name(s) for the editor (inline) or the modal overlay —
     * e.g. to scope a custom theme to one instance, modal included.
     */
    className: '',

    /** UI label overrides */
    labels: {
      openEditor:  'Edit Image Map',
      save:        'Save',
      cancel:      'Cancel',
      deleteArea:  'Delete Area',
      clearAll:    'Clear All',
      noAreas:     'No areas yet — select a shape tool and draw on the image.',
      modalTitle:  'Image Map Editor',
      select:      'Select',
      rect:        'Rectangle',
      circle:      'Circle',
      poly:        'Polygon',
      delete:      'Delete',
      clear:       'Clear All',
      showCode:    'Show Code',
      hideCode:    'Hide Code',
      errorMissingTitles: 'All areas must have a title before saving.',
      duplicate:   'Duplicate',
      undo:        'Undo',
      redo:        'Redo',
      areas:       'Areas',
      properties:  'Properties',
      shape:       'Shape',
      coords:      'Coords',
      close:       'Close',
      missingTitle: 'Missing title',
      confirmClear: 'Clear all areas?',
      discardPrompt:  'Discard your unsaved changes?',
      keepEditing:    'Keep editing',
      discardChanges: 'Discard',
      // Accessibility: names, hints and screen-reader announcements.
      // {shape} / {name} are replaced with the shape label / area name.
      toolbar:        'Tools',
      canvas:         'Image',
      canvasHint:     'Arrow keys move the selected area (Shift: 10px). Alt+arrow keys resize it. Enter adds an area with the active tool. Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z redoes.',
      drawHint:       '{shape}: drag on the image, or press Enter on it, to add one.',
      polyHint:       'Polygon: click to add points. Click the first or last point, double-click, or press Enter to finish. Escape cancels. (Enter on the image with no points adds a triangle.)',
      // The how-to line under the toolbar, per tool
      tipSelect:      'Click an area to select it, drag to move it, or drag a handle to resize it.',
      tipRect:        'Drag to draw a rectangle.',
      tipCircle:      'Drag out from the centre to draw a circle.',
      tipShift:       'Hold Shift to start on top of another area.',   // appended for rect/circle, except on touch
      tipPoly:        'Click to add points. Click the first point, double-click or press Enter to finish · Esc cancels · Ctrl/Cmd+Z removes the last point.',
      polyStarted:    'Polygon started.',
      polyCancelled:  'Polygon cancelled.',
      added:          '{shape} added.',
      deleted:        '{name} deleted.',
      duplicated:     '{name} duplicated.',
      cleared:        'All areas cleared.',
      undone:         'Undone.',
      redone:         'Redone.',
      coordsRect:     'Format: x1, y1, x2, y2',
      coordsCircle:   'Format: x, y, radius',
      coordsPoly:     'Format: x1, y1, x2, y2, … (at least 3 points)',
      invalidCoords:  'Invalid coordinates. {format}',
    },

    /** Called with (htmlString, areasArray) whenever areas change */
    onUpdate: null,

    /** Called with (htmlString, areasArray) when the modal Save button is clicked */
    onSave: null,

    /** Called when the modal is opened */
    onOpen: null,

    /** Called with (wasSaved) when the modal is closed */
    onClose: null,

    /**
     * Called whenever an attribute field changes in the Properties panel.
     * Receives the area object, the attribute name, and the new value.
     * Return a plain object of attribute key/value pairs to apply additional
     * changes to the area — e.g. mirroring a custom attribute into title/alt.
     *
     * Example — mirror data-value into title and alt:
     *   onAttributeChange(area, attr, value) {
     *     if (attr === 'data-value') return { title: value, alt: value };
     *   }
     */
    onAttributeChange: null,
  };

  /* =========================================================================
   * Utility helpers
   * ========================================================================= */

  let _seq = 0;
  const uid  = () => `kima-${++_seq}-${Math.random().toString(36).slice(2, 6)}`;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const hypot = (ax, ay, bx, by) => Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);

  /** True when the device's primary pointer is coarse (e.g. a phone/tablet) */
  const coarsePointer = () =>
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  /** Create an HTML element with optional shorthand props */
  function h(tag, props = {}) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if      (k === 'cls')  el.className   = v;
      else if (k === 'html') el.innerHTML   = v;
      else if (k === 'text') el.textContent = v;
      else                   el.setAttribute(k, v);
    }
    return el;
  }

  /** Create an SVG element */
  function s(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  /** Escape a string for use as an HTML attribute value */
  function escAttr(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  /** Escape a string for use as HTML text or attribute content */
  function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  /** Canonical shape names, including legacy HTML aliases */
  const SHAPE_ALIASES = {
    rect: 'rect', rectangle: 'rect',
    circle: 'circle', circ: 'circle',
    poly: 'poly', polygon: 'poly',
  };
  /** Map a shape name to 'rect' | 'circle' | 'poly', or undefined if unknown */
  const canonShape = name =>
    Object.prototype.hasOwnProperty.call(SHAPE_ALIASES, name) ? SHAPE_ALIASES[name] : undefined;

  /**
   * Can `name` be written as an <area> attribute? Rejects names that would
   * break out of the tag or into another attribute (spaces, quotes, =, >, /,
   * control characters), and shape/coords, which the editor writes itself.
   */
  // eslint-disable-next-line no-control-regex
  const ATTR_NAME = /^[^\s"'>/=\u0000-\u001f\u007f]+$/;
  const validAttr = name =>
    typeof name === 'string' && ATTR_NAME.test(name) && name !== 'shape' && name !== 'coords';

  /** Undo steps kept per editing session */
  const HISTORY_MAX = 100;

  /** Live instances by image (one editor per image) */
  const _instances = new WeakMap();

  /** responsive(): active image → its stop(); area → its original (natural-pixel) coords */
  const _responsive = new WeakMap();
  const _areaCoords = new WeakMap();

  /** Elements made inert by open modals → how many modals want them inert */
  const _inertRefs = new Map();

  /** Number of open modals across instances — body scroll is locked while > 0 */
  let _openModals = 0;
  let _bodyOverflow = '';

  /**
   * Normalise an entry from `attributes` or `customAttributes`.
   * Accepts either a plain string or { attr, label } object.
   * Returns { attr: string, label: string }.
   */
  function normalizeAttr(a) {
    if (typeof a === 'string') return { attr: a, label: a };
    return { attr: a.attr, label: a.label ?? a.attr };
  }

  /**
   * An image's coordinate space: its natural size. With w-descriptors
   * (srcset="a.jpg 800w, b.jpg 1600w") the reported natural size follows
   * `sizes` — i.e. the viewport — so use the largest candidate's declared pixel
   * width instead (keeping the aspect ratio of what loaded), which never changes.
   * `loaded` is the element whose pixels to measure (default: img itself).
   */
  function naturalSize(img, loaded = img) {
    const w = loaded?.naturalWidth || 0, h = loaded?.naturalHeight || 0;
    if (!w) return [0, 0];
    // The srcset in effect: the img's own, or (in a <picture>) the <source>'s
    // whose candidates include the image that actually loaded
    const sets = [img.getAttribute('srcset') || ''];
    if (img.parentElement?.tagName === 'PICTURE') {
      sets.unshift(...[...img.parentElement.querySelectorAll('source')].map(el => el.getAttribute('srcset') || ''));
    }
    const cur = img.currentSrc || '';
    const set = sets.find(x => cur && x.includes(cur)) ?? sets[sets.length - 1];
    const ws = [...set.matchAll(/\s(\d+)w\s*(?:,|$)/g)].map(m => +m[1]);
    if (ws.length) { const W = Math.max(...ws); return [W, Math.round(W * h / w)]; }
    return [w, h];
  }

  /** Clamp a move delta to [lo, hi] — but never force an already-outside area inward */
  const clampDelta = (d, lo, hi) => clamp(d, Math.min(0, lo), Math.max(0, hi));

  /** Fill {placeholders} in a label */
  const fmt = (str, vars) => String(str ?? '').replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

  /** Selector for elements that can take keyboard focus */
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /** Set an area attribute from a field value; an empty value removes it */
  function setAttr(area, name, value) {
    if (!validAttr(name)) return;
    if (value === '' || value == null) delete area.attrs[name];
    else area.attrs[name] = String(value);
  }

  /* =========================================================================
   * Parse / Serialize
   * ========================================================================= */

  /** Split a coords string into numbers; parseFloat per token tolerates trailing junk (e.g. "10px"), like browsers do */
  const parseCoords = str => String(str ?? '').split(/[\s,;]+/).filter(Boolean).map(parseFloat);

  /**
   * Normalise coords for `shape`: rect corners ordered, circle trimmed to
   * 3 values, poly to whole points. Null if not finite or too few.
   */
  function normCoords(shape, coords) {
    if (!coords.length || coords.some(n => typeof n !== 'number' || !isFinite(n))) return null;
    if (shape === 'rect') {
      if (coords.length < 4) return null;
      const [x1, y1, x2, y2] = coords;
      return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
    }
    if (shape === 'circle') return coords.length < 3 ? null : coords.slice(0, 3);
    return coords.length < 6 ? null : coords.slice(0, coords.length - (coords.length % 2));
  }

  /**
   * Validate and copy an area passed to setAreas(): a known shape, enough
   * finite coords (an array, or a string as in HTML), and attrs whose names
   * can be written. Other properties are kept. Null if it can't be used.
   */
  function normalizeArea(a) {
    if (!a || typeof a !== 'object') return null;
    const shape  = canonShape(String(a.shape ?? '').trim().toLowerCase());
    const coords = shape && normCoords(shape,
      Array.isArray(a.coords) ? a.coords.map(v => typeof v === 'string' ? parseFloat(v) : v) : parseCoords(a.coords));
    if (!coords) return null;
    const attrs = {};
    if (a.attrs && typeof a.attrs === 'object') {
      for (const [k, v] of Object.entries(a.attrs)) if (validAttr(k) && v != null) attrs[k] = String(v);
    }
    return { ...a, id: a.id == null || a.id === '' ? uid() : String(a.id), shape, coords, attrs };
  }

  /** An area's editable data as a string — for comparing undo steps (extra properties may not be serialisable) */
  const areaSig = a => JSON.stringify([a.id, a.shape, a.coords, a.attrs]);

  /** Deep copy of an area (what callbacks and getAreas() receive) */
  const copyArea = a => ({ ...a, coords: [...a.coords], attrs: { ...a.attrs } });

  /**
   * Parse an HTML string of <area> tags (bare, or inside a <map>).
   * Returns:
   *   areas  — editable area objects
   *   extras — <area> tags that can't be edited visually (shape="default",
   *            too few coords, …) as { shape, coords, attrs } with the raw
   *            strings, so saving never drops them
   *   name   — the name of the first <map> found, or ''
   */
  function parseMap(html) {
    const out = { areas: [], extras: [], name: '' };
    if (!html?.trim()) return out;
    // DOMParser documents are inert — no scripts run and no resources
    // (e.g. <img onerror>) load, unlike innerHTML on a live-document element.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    out.name = doc.querySelector('map[name]')?.getAttribute('name') || '';
    for (const node of doc.querySelectorAll('area')) {
      const area = parseArea(node);
      if (area) { out.areas.push(area); continue; }
      // Not editable — keep its shape/coords strings and attributes as-is
      const x = { shape: node.getAttribute('shape'), coords: node.getAttribute('coords'), attrs: {} };
      for (const a of node.attributes) if (a.name !== 'shape' && a.name !== 'coords') x.attrs[a.name] = a.value;
      out.extras.push(x);
    }
    return out;
  }

  /** Parse one <area> element, or return null if it can't be edited */
  function parseArea(node) {
    // Missing or invalid shapes default to rect, as in the HTML spec;
    // 'default' areas cover the whole image and have no geometry to edit.
    const raw = (node.getAttribute('shape') || '').trim().toLowerCase();
    if (raw === 'default') return null;
    const shape = canonShape(raw) || 'rect';
    const coords = normCoords(shape, parseCoords(node.getAttribute('coords')));
    if (!coords) return null;
    // Every attribute is kept as written — including empty ones like alt=""
    const attrs = {};
    for (const a of node.attributes) {
      if (a.name !== 'shape' && a.name !== 'coords') attrs[a.name] = a.value;
    }
    return { id: uid(), shape, coords, attrs };
  }

  /** Serialize a single area object to an <area> tag string */
  function serializeArea(area, opts) {
    const coords = area.coords.map(Math.round).join(',');
    return `<area shape="${area.shape}" coords="${coords}"` + serializeAttrs(area.attrs, opts) + '>';
  }

  /** Serialize a non-editable area (see parseMap) with its original shape/coords strings */
  function serializeExtra(x, opts) {
    let out = '<area';
    if (x.shape != null)  out += ` shape="${escAttr(x.shape)}"`;
    if (x.coords != null) out += ` coords="${escAttr(x.coords)}"`;
    return out + serializeAttrs(x.attrs, opts) + '>';
  }

  /** Serialize an attrs map, honouring opts.outputAttributes */
  function serializeAttrs(attrs, opts) {
    let out = '';

    // Determine the effective list of attributes to write.
    // If outputAttributes is set, use it explicitly; otherwise write every
    // attribute stored on the area. An attribute that is present but empty
    // (e.g. alt="" parsed from the textarea) is written as such; clearing a
    // field in the Properties panel removes the attribute instead.
    if (opts?.outputAttributes) {
      for (const item of opts.outputAttributes) {
        const attr = normalizeAttr(item).attr;
        if (!validAttr(attr)) continue;
        const val  = attrs[attr] ?? '';
        // When outputAttributes is explicit, always write the attr — even if
        // empty — because the caller has deliberately listed it.
        out += ` ${attr}="${escAttr(val)}"`;
      }
    } else {
      for (const [k, v] of Object.entries(attrs)) {
        if (v != null && validAttr(k)) out += ` ${k}="${escAttr(v)}"`;
      }
    }
    return out;
  }

  /**
   * Build the full output string from an areas array + options.
   * `extras` are non-editable areas to append (see parseMap); `parsedName`
   * is the <map name> read from the input, used when opts.mapName is empty.
   */
  function buildOutput(areas, opts, extras = [], parsedName = '') {
    const lines = [...areas.map(a => serializeArea(a, opts)), ...extras.map(x => serializeExtra(x, opts))].join('\n');
    if (opts.output === 'map') {
      const name = escAttr(opts.mapName || parsedName || 'imagemap');
      return `<map name="${name}">\n${lines}\n</map>`;
    }
    return lines;
  }

  /* =========================================================================
   * SVG shape helpers
   * ========================================================================= */

  /**
   * Return the SVG element tag and attributes for the given area.
   * Coords are stored in HTML imagemap convention (natural image pixels):
   *   rect:   [x1, y1, x2, y2]
   *   circle: [cx, cy, r]
   *   poly:   [x1, y1, x2, y2, ...]
   */
  function shapeAttrs(area) {
    if (area.shape === 'rect') {
      const [x1, y1, x2, y2] = area.coords;
      return {
        tag: 'rect',
        attrs: {
          x: Math.min(x1, x2), y: Math.min(y1, y2),
          width: Math.abs(x2 - x1), height: Math.abs(y2 - y1),
        },
      };
    }
    if (area.shape === 'circle') {
      const [cx, cy, r] = area.coords;
      return { tag: 'circle', attrs: { cx, cy, r: Math.max(0, r) } };
    }
    if (area.shape === 'poly') {
      const pts = [];
      for (let i = 0; i < area.coords.length; i += 2)
        pts.push(`${area.coords[i]},${area.coords[i + 1]}`);
      return { tag: 'polygon', attrs: { points: pts.join(' ') } };
    }
    return null;
  }

  /**
   * Return handle positions for the given area.
   * Each handle: { x, y, cur (CSS cursor), vi? (poly vertex index) }
   * Rect:   8 edge/corner handles (index 0–7: nw, n, ne, e, se, s, sw, w)
   * Circle: 1 handle on the east edge of the radius
   * Poly:   1 handle per vertex
   */
  function handlePositions(area) {
    if (area.shape === 'rect') {
      const [x1, y1, x2, y2] = area.coords;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      return [
        { x: x1, y: y1, cur: 'nwse-resize' },
        { x: mx, y: y1, cur: 'ns-resize'   },
        { x: x2, y: y1, cur: 'nesw-resize' },
        { x: x2, y: my, cur: 'ew-resize'   },
        { x: x2, y: y2, cur: 'nwse-resize' },
        { x: mx, y: y2, cur: 'ns-resize'   },
        { x: x1, y: y2, cur: 'nesw-resize' },
        { x: x1, y: my, cur: 'ew-resize'   },
      ];
    }
    if (area.shape === 'circle') {
      const [cx, cy, r] = area.coords;
      return [{ x: cx + r, y: cy, cur: 'ew-resize' }];
    }
    if (area.shape === 'poly') {
      const out = [];
      for (let i = 0; i < area.coords.length; i += 2)
        out.push({ x: area.coords[i], y: area.coords[i + 1], cur: 'move', vi: i });
      return out;
    }
    return [];
  }

  /* =========================================================================
   * kImgMap Class
   * ========================================================================= */

  class kImgMap {

    /**
     * @param {HTMLImageElement|string} imgEl  - The source <img> element (or CSS selector)
     * @param {object}                 options - Configuration options
     */
    constructor(imgEl, options = {}) {
      if (typeof imgEl === 'string') imgEl = document.querySelector(imgEl);
      if (!imgEl || imgEl.tagName !== 'IMG')
        throw new Error('kImgMap: first argument must be an <img> element or selector');
      if (_instances.has(imgEl))
        throw new Error('kImgMap: this image already has an editor — call destroy() on it first (kImgMap.get(img) returns it)');

      this.img  = imgEl;
      this.opts = this._mergeOpts(options);

      /** @type {Array<{id,shape,coords,attrs}>} */
      this.areas = [];
      this._extras  = [];   // non-editable <area> tags from the input (see parseMap)
      this._mapName = '';   // <map name> from the input

      // Editor state
      this._sel          = null;   // selected area id
      this._drawShape    = this.opts.shapes.includes(this.opts.defaultShape)
        ? this.opts.defaultShape
        : null;                  // active draw tool (null = select)
      this._mode         = null;   // null | 'drawing' | 'drag' | 'resize'
      this._drawing      = null;   // in-progress area object
      this._drawOrigin   = null;   // pointerdown point for rect/circle
      this._polyActive   = false;  // poly click-by-click in progress
      this._polyPreview  = null;   // last pointer position for poly preview line
      this._pointerId    = null;   // pointer driving the current draw/drag/resize
      this._pointerType  = null;   // its pointerType ('mouse' | 'touch' | 'pen')
      this._coarse       = coarsePointer(); // finger-sized targets? follows the input in use
      this._dragState    = null;
      this._resizeState  = null;

      // DOM refs (set during build)
      this._svg      = null;
      this._editorImg = null;
      this._toolbar  = null;
      this._sidebar  = null;
      this._overlay  = null;
      this._editorEl = null;
      this._openBtn  = null;
      this._banner   = null;   // validation error banner

      // Validation state
      this._errorIds = new Set();

      // Cleanup refs
      this._docMove   = null;
      this._docUp     = null;
      this._docCancel = null;
      this._onKeyDown = null;
      this._ro        = null;

      // Resolve the associated textarea
      this._ta = options.textarea
        ? (typeof options.textarea === 'string'
            ? document.querySelector(options.textarea)
            : options.textarea)
        : this._findTA();

      this._init();
      _instances.set(imgEl, this);
    }

    /* -----------------------------------------------------------------------
     * Options
     * ----------------------------------------------------------------------- */

    _mergeOpts(o) {
      // Ignore keys explicitly set to undefined so they don't wipe out defaults
      const defined = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
      const opts = { ...DEFAULTS, ...defined };
      opts.labels = { ...DEFAULTS.labels, ...o.labels };
      // Unknown shapes and unwritable attribute names are dropped (with a warning)
      const keep = (list, ok, what) => (Array.isArray(list) ? list : []).filter(x => {
        if (ok(x)) return true;
        console.warn(`kImgMap: ignoring ${what} ${JSON.stringify(x)}`);
        return false;
      });
      opts.shapes = keep(opts.shapes, x => ['rect', 'circle', 'poly'].includes(x), 'shape');
      const attrEntry = x => (typeof x === 'string' || (!!x && typeof x === 'object')) && validAttr(normalizeAttr(x).attr);
      for (const k of ['attributes', 'customAttributes', 'outputAttributes']) {
        if (opts[k] != null) opts[k] = keep(opts[k], attrEntry, `${k} entry`);
      }
      return opts;
    }

    _findTA() {
      const el0 = this.img.parentElement?.tagName === 'PICTURE' ? this.img.parentElement : this.img;
      if (!el0.parentElement) return null;
      for (const el of el0.parentElement.children) {
        if (el.tagName === 'TEXTAREA') return el;
      }
      return null;
    }

    /* -----------------------------------------------------------------------
     * Bootstrap
     * ----------------------------------------------------------------------- */

    /** Load areas (and pass-through extras / map name) from an HTML string */
    _load(html) {
      const m = parseMap(html);
      this.areas    = m.areas;
      this._extras  = m.extras;
      this._mapName = m.name;
    }

    _init() {
      // Remember the textarea's inline style so destroy() can restore it exactly
      this._taStyle = this._ta ? this._ta.getAttribute('style') : null;
      if (this._ta?.value.trim()) this._load(this._ta.value);
      // Hide textarea now only for showTextarea: false.
      // true  → kept visible, wrapper handles layout.
      // 'optional' → _buildModalTrigger hides it and wires the toggle.
      if (this._ta && !this.opts.showTextarea) this._ta.style.display = 'none';

      if (this.opts.mode === 'inline') {
        this._buildInline();
      } else {
        this._buildModalTrigger();
      }
    }

    /* -----------------------------------------------------------------------
     * Inline mode
     * ----------------------------------------------------------------------- */

    _buildInline() {
      // What moves into the editor: the image — or its <picture>, so the
      // <source>s keep applying. Remember where it was for destroy().
      const moved = this.img.parentElement?.tagName === 'PICTURE' ? this.img.parentElement : this.img;
      this._inlineMoved  = moved;
      this._inlinePrev   = moved.previousSibling;
      this._inlineParent = moved.parentNode;
      // Never put the editor inside a link/button/label (clicks would navigate
      // or activate it): insert it after that ancestor instead
      let host = null;   // the outermost one, so nested wrappers can't capture clicks either
      for (let el = moved.parentElement; el; el = el.parentElement) if (el.matches('a[href], button, label')) host = el;

      // Build editor DOM
      const { editor, toolbar, imgArea, sidebar } = this._buildEditorUI();
      editor.classList.add('kimgmap-editor--inline');
      this._applyTheme(editor);
      editor.setAttribute('role', 'region');   // a labelled landmark (and not [role=group], which CSS frameworks restyle)
      // Named after the image too, so several editors on a page are distinct landmarks
      const alt = (this.img.getAttribute('alt') || '').trim();
      editor.setAttribute('aria-label', alt ? `${this.opts.labels.modalTitle}: ${alt}` : this.opts.labels.modalTitle);
      // Focusable, so keyboard shortcuts can be scoped to this editor. Canvas
      // pointerdowns call preventDefault, which suppresses the compatibility
      // mousedown and its default focus change — so focus explicitly.
      editor.tabIndex = -1;
      editor.addEventListener('pointerdown', e => {
        if (e.target.closest('input,select,textarea,button')) return;
        // On touch, only the canvas takes focus — touching (or starting to
        // scroll) the sidebar must not blur a field and dismiss the keyboard
        if (e.pointerType === 'touch' && !e.target.closest('.kimgmap-svg')) return;
        if (e.target.closest('.kimgmap-img-area')) this._pointerFocusCanvas();
        else editor.focus({ preventScroll: true });
      }, true);

      // Image + SVG container
      const imgWrap = h('div', { cls: 'kimgmap-img-wrap' });
      const svg     = s('svg', { class: 'kimgmap-svg', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
      imgWrap.append(moved, svg); // move the real image into the editor
      imgArea.appendChild(imgWrap);

      this._svg      = svg;
      this._editorImg = this.img;
      this._toolbar  = toolbar;
      this._sidebar  = sidebar;
      this._editorEl = editor;

      // Insert editor where the image was (or after the link it was in)
      if (host) host.after(editor);
      else if (this._inlinePrev) this._inlinePrev.after(editor);
      else this._inlineParent.prepend(editor);

      this._setupEditor();
      this._resetHistory();
    }

    /** Apply opts.className and opts.theme to the editor root (inline) or the overlay (modal) */
    _applyTheme(el) {
      const cls = String(this.opts.className || '').split(/\s+/).filter(Boolean);
      if (cls.length) el.classList.add(...cls);
      const theme = this.opts.theme;
      if (theme === 'light' || theme === 'dark') el.dataset.theme = theme;
      else if (theme === 'auto' && typeof matchMedia === 'function') {
        const mq  = matchMedia('(prefers-color-scheme: dark)');
        const set = () => { el.dataset.theme = mq.matches ? 'dark' : 'light'; };
        set();
        mq.addEventListener('change', set);
        this._themeOff = () => mq.removeEventListener('change', set);
      }
    }

    /* -----------------------------------------------------------------------
     * Modal mode
     * ----------------------------------------------------------------------- */

    _buildModalTrigger() {
      const btn = h('button', {
        type: 'button',
        cls:  'kimgmap-open-btn',
        text: this.opts.labels.openEditor,
        'aria-haspopup': 'dialog',
      });
      btn.addEventListener('click', () => this.open());

      const st = this.opts.showTextarea;

      if (this._ta && st === true) {
        // Always visible — wrap button + textarea in a column container
        const wrap = h('div', { cls: 'kimgmap-trigger-wrap' });
        this._ta.insertAdjacentElement('beforebegin', wrap);
        wrap.append(btn, this._ta);
        this._triggerWrap = wrap;

      } else if (this._ta && st === 'optional') {
        // Toggle button to the right of the trigger; textarea hidden initially
        this._ta.style.display = 'none';

        if (!this._ta.id) { this._ta.id = `kimgmap-ta-${++_seq}`; this._taIdAssigned = true; }
        const toggleBtn = h('button', {
          type: 'button',
          cls:  'kimgmap-show-code-btn',
          text: this.opts.labels.showCode,
          'aria-expanded': 'false',
          'aria-controls': this._ta.id,
        });
        this._showCodeBtn = toggleBtn;

        toggleBtn.addEventListener('click', () => {
          const isHidden = this._ta.style.display === 'none';
          this._ta.style.display = isHidden ? '' : 'none';
          toggleBtn.textContent  = isHidden
            ? this.opts.labels.hideCode
            : this.opts.labels.showCode;
          toggleBtn.classList.toggle('is-active', isHidden);
          toggleBtn.setAttribute('aria-expanded', String(isHidden));
        });

        const btns = h('div', { cls: 'kimgmap-trigger-btns' });
        btns.append(btn, toggleBtn);

        const wrap = h('div', { cls: 'kimgmap-trigger-wrap' });
        this._ta.insertAdjacentElement('beforebegin', wrap);
        wrap.append(btns, this._ta);
        this._triggerWrap = wrap;

      } else {
        // Hidden entirely — insert button after textarea (or image)
        (this._ta || this.img).insertAdjacentElement('afterend', btn);
        this._triggerWrap = null;
      }

      this._openBtn = btn;
    }

    /** Open the modal editor (re-parses textarea first) */
    open() {
      if (this.opts.mode === 'inline' || this._overlay || this._destroyed) return;
      this._returnFocus = document.activeElement;   // restored on close
      if (this._ta) this._load(this._ta.value);
      this._sel = null;
      this._buildModal();
      this.opts.onOpen?.call(this);
      // Snapshot (after onOpen, which may load areas) so closing without
      // saving can discard edits made while the modal is open
      if (this._overlay) this._snapshot = {
        areas: this.getAreas(), extras: this._extras.map(x => ({ ...x, attrs: { ...x.attrs } })), mapName: this._mapName,
        value: this._ta?.value, html: this.getHTML(),
      };
      if (this._overlay) this._resetHistory();
    }

    _buildModal() {
      // Overlay backdrop
      const overlay = h('div', { cls: 'kimgmap-overlay' });
      this._applyTheme(overlay);
      const titleId = `kimgmap-title-${++_seq}`;
      const modal = h('div', { cls: 'kimgmap-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId });

      // ── Header ────────────────────────────────────────────────────────────
      const hdr      = h('div', { cls: 'kimgmap-modal-hdr' });
      const titleEl  = h('h2', { cls: 'kimgmap-modal-title', id: titleId, text: this.opts.labels.modalTitle });
      const closeBtn = h('button', { type: 'button', cls: 'kimgmap-modal-close', 'aria-label': this.opts.labels.close, html: '&times;' });
      hdr.append(titleEl, closeBtn);

      // ── Body ──────────────────────────────────────────────────────────────
      const body = h('div', { cls: 'kimgmap-modal-body' });
      const { editor, toolbar, imgArea, sidebar } = this._buildEditorUI();

      const imgWrap   = h('div', { cls: 'kimgmap-img-wrap' });
      const editorImg = h('img', { cls: 'kimgmap-editor-img', src: this.img.currentSrc || this.img.src, alt: this.img.alt || '' });
      editorImg.draggable = false;
      // preserveAspectRatio none: the overlay stretches exactly like the image
      // if CSS gives it a different aspect ratio than its natural one
      const svg = s('svg', { class: 'kimgmap-svg', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
      imgWrap.append(editorImg, svg);
      imgArea.prepend(imgWrap);
      body.appendChild(editor);

      this._svg      = svg;
      this._editorImg = editorImg;
      this._toolbar  = toolbar;
      this._sidebar  = sidebar;

      // ── Footer ────────────────────────────────────────────────────────────
      const ftr       = h('div', { cls: 'kimgmap-modal-ftr' });
      const cancelBtn = h('button', { type: 'button', cls: 'kimgmap-btn kimgmap-btn--ghost kimgmap-cancel', text: this.opts.labels.cancel });
      const saveBtn   = h('button', { type: 'button', cls: 'kimgmap-btn kimgmap-btn--primary kimgmap-save', text: this.opts.labels.save   });
      ftr.append(cancelBtn, saveBtn);

      // ── Unsaved-changes prompt (shown instead of closing) ─────────────────
      const L = this.opts.labels;
      const discard = h('div', { cls: 'kimgmap-discard', role: 'alertdialog', 'aria-label': L.discardPrompt });
      discard.hidden = true;
      discard.innerHTML = `<span class="kimgmap-discard-msg">${escHtml(L.discardPrompt)}</span>
        <button type="button" class="kimgmap-btn kimgmap-btn--ghost kimgmap-discard-keep">${escHtml(L.keepEditing)}</button>
        <button type="button" class="kimgmap-btn kimgmap-btn--danger kimgmap-discard-confirm">${escHtml(L.discardChanges)}</button>`;
      this._discard = discard;

      modal.append(hdr, body, discard, ftr);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      this._overlay = overlay;

      // Everything behind the dialog is inert (unreachable by Tab, pointer and
      // screen-reader virtual cursor) until it closes
      // (ref-counted, so modals can close in any order; elements the page had
      // already made inert are left alone)
      this._inerted = [...document.body.children].filter(el => el !== overlay && (!el.inert || _inertRefs.has(el)));
      this._inerted.forEach(el => { _inertRefs.set(el, (_inertRefs.get(el) || 0) + 1); el.inert = true; });

      // Events
      closeBtn.addEventListener('click',  () => this._requestClose());
      cancelBtn.addEventListener('click', () => this.close(false));      // explicit discard
      saveBtn.addEventListener('click',   () => this._save());
      discard.querySelector('.kimgmap-discard-keep').addEventListener('click', () => this._hideDiscard());
      discard.querySelector('.kimgmap-discard-confirm').addEventListener('click', () => this.close(false));
      // Close on a backdrop click — but only when the press also started on the
      // backdrop, so releasing a drag over it doesn't cancel the modal
      let downOnBackdrop = false;
      overlay.addEventListener('pointerdown', e => { downOnBackdrop = e.target === overlay; });
      overlay.addEventListener('click', e => {
        if (e.target === overlay && downOnBackdrop) this._requestClose();
        downOnBackdrop = false;
      });

      this._bindKeys();
      if (_openModals++ === 0) {
        _bodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }

      // Move focus into the dialog so Enter/Space can't re-trigger the open button
      modal.tabIndex = -1;
      modal.focus({ preventScroll: true });
      // Pointer use of the image focuses the canvas, so arrow keys act on it
      body.addEventListener('pointerdown', e => {
        if (e.target.closest('.kimgmap-img-area') && e.pointerType !== 'touch') this._pointerFocusCanvas();
      }, true);

      // Skip if the modal was closed before the first frame (it's already fading out)
      requestAnimationFrame(() => { if (this._overlay === overlay) overlay.classList.add('is-open'); });
      this._setupEditor();
    }

    /** Has anything changed since the modal opened? */
    _isDirty() {
      const polyInProgress = this._polyActive && this._drawing?.coords.length >= 6;
      return !!this._snapshot && (polyInProgress || this.getHTML() !== this._snapshot.html);
    }

    /** Close via Escape / × / backdrop: ask first if there are unsaved changes */
    _requestClose() {
      if (this.opts.confirmDiscard && this._isDirty()) this._showDiscard();
      else this.close(false);
    }

    _showDiscard() {
      this._discard.hidden = false;
      this._overlay.querySelector('.kimgmap-modal').classList.add('is-confirming');
      this._overlay.querySelector('.kimgmap-modal-body').inert = true;
      this._discard.querySelector('.kimgmap-discard-keep').focus();
    }

    _hideDiscard() {
      this._discard.hidden = true;
      this._overlay?.querySelector('.kimgmap-modal').classList.remove('is-confirming');
      const body = this._overlay?.querySelector('.kimgmap-modal-body');
      if (body) body.inert = false;
      this._focusEditor();
    }

    /** Return focus to the editor itself (so keyboard shortcuts keep working) */
    _focusEditor() {
      const el = this._overlay?.querySelector('.kimgmap-modal') || this._editorEl;
      el?.focus({ preventScroll: true });
    }

    /** Keyboard shortcuts (modal: whole document; inline: when the editor has focus) */
    _bindKeys() {
      this._onKeyDown = e => {
        const ae = document.activeElement;
        if (this.opts.mode === 'inline' && !this._editorEl?.contains(ae)) return;
        const tag       = ae?.tagName;
        const inField   = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
        const ctrlOrCmd = e.ctrlKey || e.metaKey;

        // Modal: Tab cycles within the dialog
        if (e.key === 'Tab' && this._overlay) { this._trapTab(e); return; }

        if (e.key === 'Escape') {
          // Innermost first: the discard prompt, then a focused field (Escape
          // leaves the field — it must never throw away the session), then an
          // in-progress polygon, and only then the modal itself.
          if (this._discard && !this._discard.hidden) this._hideDiscard();
          else if (this._confirming()) this._hideConfirm();
          else if (inField && (this._overlay || this._editorEl)?.contains(ae)) { ae.blur(); this._focusEditor(); }
          else if (this._polyActive) this._cancelPoly();
          else if (this._overlay) this._requestClose();
          return;
        }
        // While a prompt is up, the editor behind it is inert
        if ((this._discard && !this._discard.hidden) || this._confirming()) return;
        // Undo / redo (in a text field, the field's own undo applies)
        const k = e.key.toLowerCase();
        const inText = inField && tag !== 'SELECT';   // a <select> has no undo of its own
        if (ctrlOrCmd && !inText && !e.altKey && (k === 'z' || k === 'y')) {
          e.preventDefault();
          if (k === 'y' || e.shiftKey) this.redo(); else this.undo();
          return;
        }
        // The canvas: Enter adds an area, arrows move / Alt+arrows resize the selection
        if (ae && ae === this._canvas && this._canvasKey(e)) { e.preventDefault(); return; }
        if ((e.key === 'Delete' || e.key === 'Backspace') && this._sel && !inField) {
          e.preventDefault();
          this._deleteArea(this._sel);
        }
        if (ctrlOrCmd && e.key.toLowerCase() === 'd' && this._sel && !inField) {
          e.preventDefault();
          this._duplicateArea(this._sel);
        }
      };
      document.addEventListener('keydown', this._onKeyDown);
    }

    /** Keep Tab / Shift+Tab inside the modal dialog */
    _trapTab(e) {
      const modal = this._overlay.querySelector('.kimgmap-modal');
      const items = [...modal.querySelectorAll(FOCUSABLE)].filter(el => !el.closest('[hidden],[inert]') && el.getClientRects().length);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1], ae = document.activeElement;
      if (e.shiftKey && (ae === first || !modal.contains(ae) || ae === modal)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (ae === last || !modal.contains(ae))) { e.preventDefault(); first.focus(); }
    }

    /**
     * Keyboard editing on the focused canvas. Returns true if the key was used.
     *   Enter          add an area with the active tool, centred
     *   Arrows         move the selected area 1px (Shift: 10px)
     *   Alt+Arrows     resize it (rect: right/bottom edge; circle: radius)
     */
    _canvasKey(e) {
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (e.key !== 'Enter' && !dir) return false;
      this._canvas.classList.remove('is-pointer-focus');   // keyboard use: show the focus ring
      if (!this._W) return true;                           // image not loaded yet
      if (e.key === 'Enter') {
        // A polygon being drawn with the pointer: Enter finishes it
        if (this._polyActive) { if (this._drawing.coords.length >= 6) this._closePoly(); return true; }
        if (!this._drawShape) return false;
        this._addArea(this._drawShape, this._defaultShapeCoords(this._drawShape));
        return true;
      }
      const area = this.areas.find(a => a.id === this._sel);
      if (!area || !this.opts.editable) return false;      // leave the key to the page (e.g. scrolling)
      const step = e.shiftKey ? 10 : 1;
      const [dx, dy] = [dir[0] * step, dir[1] * step];
      const W = this._W, H = this._H, c = area.coords;
      if (e.altKey) {
        // Bounds are the image, widened to wherever the area already reaches
        if (area.shape === 'rect') area.coords = [c[0], c[1], clamp(c[2] + dx, c[0] + 1, Math.max(W, c[2])), clamp(c[3] + dy, c[1] + 1, Math.max(H, c[3]))];
        else if (area.shape === 'circle') area.coords = [c[0], c[1], clamp(c[2] + dx - dy, 1, Math.max(1, this._maxRadius(c[0], c[1]), c[2]))];
        else return true;   // polygons: edit vertices in the Coords field
      } else {
        area.coords = this._moveCoords(area.shape, c, dx, dy, W, H);
      }
      this._patchAreaEl(area);
      this._syncOutput(`key:${area.id}:${e.altKey ? 'size' : 'move'}`);   // a run of nudges is one undo step
      return true;
    }

    /** A sensible default shape centred on the image (used by keyboard add) */
    _defaultShapeCoords(shape) {
      const W = this._W, H = this._H, cx = Math.round(W / 2), cy = Math.round(H / 2);
      const s = Math.round(Math.min(W, H) / 8);
      if (shape === 'rect')   return [Math.round(W * 3 / 8), Math.round(H * 3 / 8), Math.round(W * 5 / 8), Math.round(H * 5 / 8)];
      if (shape === 'circle') return [cx, cy, s];
      return [cx, cy - s, cx + s, cy + s, cx - s, cy + s];
    }

    /** Add a finished area: render, select, sync and announce it */
    _addArea(shape, coords) {
      const area = { id: uid(), shape, coords, attrs: {} };
      this.areas.push(area);
      this._appendArea(area);
      this._select(area.id);
      this._syncOutput();
      this._announce(fmt(this.opts.labels.added, { shape: this._shapeLabel(shape) }));
      return area;
    }

    _shapeLabel(shape) { return this.opts.labels[shape] || shape; }

    /** Focus the canvas for a pointer user — no keyboard focus ring until a key is used */
    _pointerFocusCanvas() {
      this._canvas.classList.add('is-pointer-focus');
      this._canvas.focus({ preventScroll: true });
    }

    /** Name used in the list and in announcements: title, alt, href, or "Shape N" */
    _areaName(area) {
      const a = area.attrs;
      return a.title || a.alt || a.href || `${this._shapeLabel(area.shape)} ${this.areas.indexOf(area) + 1}`;
    }

    /** Speak a message via the editor's polite live region */
    _announce(msg) {
      const live = this._live;
      if (!live || !msg) return;
      // A repeated identical message is made distinct so it is announced again
      live.textContent = live.textContent === msg ? msg + '\u00a0' : msg;
    }

    /** Close the modal, optionally marking as saved. Cancelling discards edits. */
    close(saved = false) {
      if (!this._overlay) return;
      saved = saved || !!this._saving;   // closed or destroyed from inside onSave
      const overlay = this._overlay;
      this._overlay = null;
      overlay.classList.remove('is-open');
      overlay.style.pointerEvents = 'none'; // inert during the fade-out
      setTimeout(() => overlay.remove(), 300);
      if (--_openModals === 0) document.body.style.overflow = _bodyOverflow;
      this._inerted?.forEach(el => {
        const n = (_inertRefs.get(el) || 1) - 1;
        if (n > 0) { _inertRefs.set(el, n); return; }
        _inertRefs.delete(el);
        el.inert = false;
      });
      this._inerted = null;
      if (this._returnFocus?.isConnected) this._returnFocus.focus({ preventScroll: true });
      this._returnFocus = null;

      this._teardown();
      if (!saved && this._snapshot) {
        const before = this.getHTML();
        this.areas    = this._snapshot.areas;
        this._extras  = this._snapshot.extras;
        this._mapName = this._snapshot.mapName;
        if (this._ta) this._ta.value = this._snapshot.value;
        const after = this.getHTML();
        if (after !== before) this.opts.onUpdate?.call(this, this._ta ? this._ta.value : after, this.getAreas());
      }
      this._snapshot = null;
      this.opts.onClose?.call(this, saved);
    }

    _teardown() {
      if (this._docMove)   { window.removeEventListener('pointermove',   this._docMove,   true); this._docMove   = null; }
      if (this._docUp)     { window.removeEventListener('pointerup',     this._docUp,     true); this._docUp     = null; }
      if (this._docCancel) { window.removeEventListener('pointercancel', this._docCancel, true); this._docCancel = null; }
      this._pointerId  = null;
      if (this._onKeyDown) { document.removeEventListener('keydown',   this._onKeyDown); this._onKeyDown = null; }
      if (this._ro)        { this._ro.disconnect(); this._ro = null; }
      this._setupToken = null;
      this._mode       = null;
      this._drawing    = null;
      this._polyActive = false;
      this._errorIds.clear();
      this._banner     = null;
      this._discard    = null;
      this._live       = null;
      this._confirmBar = null;
      this._history    = null;
      this._themeOff?.();
      this._themeOff   = null;
    }

    /* -----------------------------------------------------------------------
     * Shared editor DOM construction
     * ----------------------------------------------------------------------- */

    _buildEditorUI() {
      const L = this.opts.labels;
      const editor  = h('div', { cls: 'kimgmap-editor' });
      const toolbar = this._buildToolbar();
      const banner  = h('div', { cls: 'kimgmap-validation-banner', role: 'alert' });
      banner.hidden = true;
      banner.innerHTML = `<span class="kimgmap-validation-icon" aria-hidden="true">⚠</span><span class="kimgmap-validation-msg"></span>`;
      // In-editor confirmation (Clear All) — replaces window.confirm(), which
      // sandboxed iframes block
      const confirmBar = h('div', { cls: 'kimgmap-confirm', role: 'alertdialog' });
      confirmBar.hidden = true;
      confirmBar.innerHTML = `<span class="kimgmap-confirm-msg"></span>
        <button type="button" class="kimgmap-btn kimgmap-btn--ghost kimgmap-confirm-no"></button>
        <button type="button" class="kimgmap-btn kimgmap-btn--danger kimgmap-confirm-yes"></button>`;
      // Visible how-to for the active tool (screen readers get it from the live region)
      const tip = h('div', { cls: 'kimgmap-tip', 'aria-hidden': 'true' });
      const canvas  = h('div', { cls: 'kimgmap-canvas' });
      // The image area is the keyboard "canvas" (see _canvasKey)
      const hintId  = `kimgmap-hint-${++_seq}`;
      const imgArea = h('div', { cls: 'kimgmap-img-area', tabindex: '0', role: 'application',
        'aria-label': L.canvas, 'aria-describedby': hintId });
      // Description-only texts are `hidden`: aria-describedby still reads them
      const hint = h('p', { id: hintId, text: L.canvasHint });
      hint.hidden = true;
      imgArea.appendChild(hint);
      const sidebar = this._buildSidebar();
      canvas.append(imgArea, sidebar);
      // Polite live region for announcements; static error text for aria-describedby
      const live = h('div', { cls: 'kimgmap-live kimgmap-sr', role: 'status', 'aria-live': 'polite' });
      this._errTextId = `kimgmap-err-${++_seq}`;
      const errText = h('p', { id: this._errTextId, text: L.errorMissingTitles });
      errText.hidden = true;
      editor.append(toolbar, confirmBar, banner, tip, canvas, live, errText);
      this._banner = banner;
      this._confirmBar = confirmBar;
      this._tip    = tip;
      this._canvas = imgArea;
      this._live   = live;
      return { editor, toolbar, banner, canvas, imgArea, sidebar };
    }

    _buildToolbar() {
      const icons = {
        select: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 3l14 9-7.5 1.8L8 21z" fill="currentColor"/></svg>`,
        rect:   `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="2"/></svg>`,
        circle: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>`,
        poly:   `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12,3 22,18.5 2,18.5"/></svg>`,
        copy:   `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
        trash:  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>`,
        undo:   `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></svg>`,
        redo:   `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/></svg>`,
        clear:  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><line x1="3" y1="3" x2="21" y2="21"/></svg>`,
      };

      const mkBtn = (tool, label, icon) => {
        const btn = h('button', { type: 'button', cls: 'kimgmap-tool', 'data-tool': tool, title: label, tabindex: '-1' });
        if (tool === 'select' || this.opts.shapes.includes(tool)) btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = icon + `<span>${escHtml(label)}</span>`;
        return btn;
      };

      const bar   = h('div', { cls: 'kimgmap-toolbar', role: 'toolbar', 'aria-label': this.opts.labels.toolbar });
      const left  = h('div', { cls: 'kimgmap-tool-group' });
      const mid   = h('div', { cls: 'kimgmap-tool-group' });
      const right = h('div', { cls: 'kimgmap-tool-group kimgmap-tool-group--end' });

      left.appendChild(mkBtn('select', this.opts.labels.select, icons.select));
      for (const shape of this.opts.shapes) {
        left.appendChild(mkBtn(shape, this.opts.labels[shape] || shape, icons[shape] || ''));
      }
      mid.append(
        mkBtn('undo',      this.opts.labels.undo,      icons.undo),
        mkBtn('redo',      this.opts.labels.redo,      icons.redo),
        mkBtn('duplicate', this.opts.labels.duplicate, icons.copy),
      );
      right.append(
        mkBtn('delete', this.opts.labels.delete, icons.trash),
        mkBtn('clear',  this.opts.labels.clear,  icons.clear),
      );
      bar.append(left, mid, right);
      return bar;
    }

    _buildSidebar() {
      const sb = h('div', { cls: 'kimgmap-sidebar' });
      sb.innerHTML = `
        <div class="kimgmap-list-wrap">
          <p class="kimgmap-section-title" id="${this._listLabelId = `kimgmap-areas-${++_seq}`}">${escHtml(this.opts.labels.areas)}</p>
          <div class="kimgmap-area-list" role="listbox" aria-labelledby="${this._listLabelId}" hidden></div>
          <p class="kimgmap-empty"></p>
        </div>
        <div class="kimgmap-props" hidden>
          <p class="kimgmap-section-title">${escHtml(this.opts.labels.properties)}</p>
          <div class="kimgmap-props-fields"></div>
          <button type="button" class="kimgmap-btn kimgmap-btn--danger kimgmap-del-btn">${escHtml(this.opts.labels.deleteArea)}</button>
        </div>
      `;
      return sb;
    }

    /* -----------------------------------------------------------------------
     * Editor setup (runs after DOM is ready and image is loaded)
     * ----------------------------------------------------------------------- */

    _setupEditor() {
      const token = this._setupToken = {};
      this._W = this._H = 0;   // measured once the image is ready (see _syncSVG)
      const go = () => {
        if (this._setupToken !== token) return; // closed/destroyed before the image loaded
        this._syncSVG();
        this._renderAll();
        this._bindToolbar();
        this._bindSidebar();
        this._bindSVG();
        if (this.opts.mode === 'inline') this._bindKeys();
        // Re-render on resize so handle radii and hit widths stay ~constant on screen
        this._ro = new ResizeObserver(() => {
          this._syncSVG();
          if (!this._mode && !this._polyActive) this._renderAll();
        });
        this._ro.observe(this._editorImg);
      };
      if (this._editorImg.complete && this._editorImg.naturalWidth) go();
      else this._editorImg.addEventListener('load', go, { once: true });
    }

    /* -----------------------------------------------------------------------
     * SVG synchronization
     * ----------------------------------------------------------------------- */

    /**
     * The coordinate space: the *page* image's natural size. For srcset images
     * that is density-corrected (a 2x candidate still reports 1x size), so the
     * modal clone — which loads a single candidate — mustn't be used for it.
     */
    _dims() {
      const src = this.img;
      return naturalSize(src, src.complete && src.naturalWidth ? src : this._editorImg);
    }

    /** Fix the coordinate space for this session and apply it as the SVG viewBox */
    _syncSVG() {
      if (!this._W) {
        const [W, H] = this._dims();
        if (!W) return;
        this._W = W; this._H = H;
      }
      this._svg.setAttribute('viewBox', `0 0 ${this._W} ${this._H}`);
    }

    /**
     * Convert a pointer/mouse event to SVG user-space coordinates — clamped to
     * the image, unless `inside` is false (moves and resizes use the raw
     * pointer for their delta and clamp the shape instead, so a handle grabbed
     * off-centre still reaches the edge).
     */
    _svgPt(e, inside = true) {
      const rect = this._svg.getBoundingClientRect();
      const vb   = this._svg.viewBox.baseVal;
      if (!rect.width || !vb.width) return { x: 0, y: 0 };
      const x = (e.clientX - rect.left) * (vb.width  / rect.width);
      const y = (e.clientY - rect.top)  * (vb.height / rect.height);
      return inside ? { x: clamp(x, 0, vb.width), y: clamp(y, 0, vb.height) } : { x, y };
    }

    /** Convert a length in screen pixels to SVG user units */
    _px(n) {
      const rect = this._svg.getBoundingClientRect();
      const vb   = this._svg.viewBox.baseVal;
      if (!rect.width || !vb.width) return n;
      return n * vb.width / rect.width;
    }

    /**
     * Handle radius (in SVG user units) that renders as ~6px on screen — or
     * ~11px for touch input — independent of image size.
     */
    _handleR() {
      return this._px(this._coarse ? 11 : 6);
    }

    /**
     * Stroke-width (in SVG user units) for invisible hit targets so they are
     * always ~12px (touch: ~24px) wide on screen regardless of image size.
     */
    _hitSW() {
      return this._px(this._coarse ? 24 : 12);
    }

    /** Resize all handles and hit targets in place (no DOM replacement) */
    _resizeTargets() {
      const r = this._handleR(), sw = this._hitSW();
      this._svg.querySelectorAll('.kimgmap-handle').forEach(el => el.setAttribute('r', r));
      this._svg.querySelectorAll('.kimgmap-hit').forEach(el => el.setAttribute('stroke-width', sw));
    }

    /**
     * Should this pointerdown start a draw/drag/resize? Only the primary
     * button (pen: tip contact, not barrel/eraser) of a primary pointer.
     * If an interaction is already in progress:
     *   - a touch never interrupts a mouse/pen interaction (palm rejection)
     *   - otherwise the new press takes over: for the same pointer type it
     *     means the old pointerup was lost (e.g. delivered to a removed node);
     *     a mouse/pen press is always deliberate. The old interaction is
     *     abandoned rather than left to lock the editor.
     * (A second finger is never primary, so it's rejected above.)
     */
    _acceptPointer(e) {
      if (!e.isPrimary || e.button !== 0) return false;
      if (this._pointerId === null) return true;
      if (e.pointerType === 'touch' && this._pointerType !== 'touch') return false;
      this._cancelInteraction();
      return true;
    }

    /** Begin tracking `e`'s pointer as the one driving the current interaction */
    _claimPointer(e) {
      this._pointerId   = e.pointerId;
      this._pointerType = e.pointerType;
    }

    /** Abandon an in-progress draw (discard) or drag/resize (revert) */
    _cancelInteraction() {
      this._pointerId = null;
      if (this._mode === 'drawing') {
        this._mode = null; this._drawing = null; this._drawOrigin = null;
        this._removePreview();
      } else if (this._mode === 'drag' || this._mode === 'resize') {
        const st   = this._dragState || this._resizeState;
        const area = this.areas.find(a => a.id === st?.areaId);
        if (area) { area.coords = [...st.orig]; this._patchAreaEl(area); }
        this._mode = null; this._dragState = null; this._resizeState = null;
      }
    }

    /* -----------------------------------------------------------------------
     * Rendering
     * ----------------------------------------------------------------------- */

    _renderAll() {
      if (!this._svg) return;
      this._svg.querySelectorAll('.kimgmap-ag').forEach(g => g.remove());
      this._removePreview();
      // Measure target sizes once: reading layout between DOM writes would
      // force a layout per area (slow with hundreds of areas)
      const sz = this._targetSizes();
      const frag = document.createDocumentFragment();
      this.areas.forEach(a => frag.appendChild(this._renderArea(a, sz)));
      this._svg.appendChild(frag);
      this._updateList();
    }

    /** Handle radius and hit-target width, in user units */
    _targetSizes() { return { r: this._handleR(), sw: this._hitSW() }; }

    /** Add one area's SVG group (after the others) without re-rendering the rest */
    _appendArea(area) {
      this._svg?.appendChild(this._renderArea(area, this._targetSizes()));
    }

    /** Build the SVG group for an area */
    _renderArea(area, sz = this._targetSizes()) {
      const info = shapeAttrs(area);
      const g = s('g', { class: 'kimgmap-ag', 'data-id': area.id });
      if (!info) return g;

      // Invisible wide hit target (easier clicking)
      const hit = s(info.tag, { ...info.attrs, class: 'kimgmap-hit' });
      hit.setAttribute('stroke-width', sz.sw);
      g.appendChild(hit);

      // Visible styled shape
      const shape = s(info.tag, { ...info.attrs, class: 'kimgmap-shape' });
      shape.setAttribute('vector-effect', 'non-scaling-stroke');
      g.appendChild(shape);

      if (area.id === this._sel)            g.classList.add('is-selected');
      if (this._errorIds.has(area.id))       g.classList.add('is-error');
      if (this.opts.editable)                this._addHandles(g, area, sz.r);

      // Pressing an existing area always selects it (and, when editable, starts
      // a drag), regardless of the active draw tool. Selecting on pointerdown
      // rather than click keeps taps reliable on touch screens.
      // stopPropagation() prevents the SVG-level pointerdown from starting a
      // new draw on top of the area.
      if (this.opts.editable) hit.style.cursor = 'move';
      hit.addEventListener('pointerdown', e => {
        if (this._drawThrough(e) || !this._acceptPointer(e)) return;
        e.preventDefault();
        e.stopPropagation();
        this._select(area.id);
        if (this.opts.editable) {
          this._claimPointer(e);
          this._mode      = 'drag';
          this._dragState = { areaId: area.id, start: this._svgPt(e, false), orig: [...area.coords] };
        }
      });
      hit.addEventListener('click', e => {
        // Stop propagation so the click doesn't add a polygon vertex or
        // deselect via the SVG-level click handler.
        if (!this._drawThrough(e)) e.stopPropagation();
      });

      return g;
    }

    /**
     * Should a press on an existing area (or its handle) go to the drawing
     * tool instead of selecting it? Yes while a polygon is being drawn (its
     * points can land on other areas), and with Shift held and a drawing
     * tool active (to draw a new shape on top of an area).
     */
    _drawThrough(e) {
      return this._polyActive || (e.shiftKey && !!this._drawShape);
    }

    _addHandles(g, area, r = this._handleR()) {
      handlePositions(area).forEach((hp, i) => {
        const hEl = s('circle', { class: 'kimgmap-handle', cx: hp.x, cy: hp.y, r, 'data-hi': i });
        hEl.setAttribute('vector-effect', 'non-scaling-stroke');
        hEl.style.cursor = hp.cur;
        hEl.addEventListener('pointerdown', e => {
          if (this._drawThrough(e) || !this._acceptPointer(e)) return;
          e.preventDefault();
          e.stopPropagation();
          if (this._sel !== area.id) this._select(area.id);
          this._claimPointer(e);
          this._mode        = 'resize';
          this._resizeState = { hi: i, hData: hp, areaId: area.id, start: this._svgPt(e, false), orig: [...area.coords] };
        });
        // Don't let the click bubble to the SVG (would start a polygon / deselect)
        hEl.addEventListener('click', e => { if (!this._drawThrough(e)) e.stopPropagation(); });
        g.appendChild(hEl);
      });
    }

    _removePreview() {
      this._svg.querySelectorAll('.kimgmap-preview,.kimgmap-preview-line,.kimgmap-preview-start').forEach(el => el.remove());
    }

    _renderPreview() {
      this._removePreview();
      const d = this._drawing;
      if (!d) return;

      const info = shapeAttrs(d);
      if (!info) return;

      const el = s(info.tag, { ...info.attrs, class: 'kimgmap-preview' });
      el.setAttribute('vector-effect', 'non-scaling-stroke');
      this._svg.appendChild(el);

      // Poly with 3+ points: mark the first one — clicking inside this ring finishes it
      if (d.shape === 'poly' && d.coords.length >= 6) {
        const ring = s('circle', { class: 'kimgmap-preview-start', cx: d.coords[0], cy: d.coords[1], r: this._handleR() * 2 });
        ring.setAttribute('vector-effect', 'non-scaling-stroke');
        this._svg.appendChild(ring);
      }

      // Poly: dashed preview line to current mouse position
      if (d.shape === 'poly' && this._polyPreview && d.coords.length >= 2) {
        const lx = d.coords[d.coords.length - 2];
        const ly = d.coords[d.coords.length - 1];
        const line = s('line', {
          class: 'kimgmap-preview-line',
          x1: lx, y1: ly,
          x2: this._polyPreview.x, y2: this._polyPreview.y,
        });
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        this._svg.appendChild(line);
      }
    }

    /* -----------------------------------------------------------------------
     * Toolbar events
     * ----------------------------------------------------------------------- */

    _bindToolbar() {
      // Roving tabindex: one Tab stop; arrows / Home / End move between tools
      this._toolbar.addEventListener('keydown', e => {
        const tools = [...this._toolbar.querySelectorAll('.kimgmap-tool:not(:disabled)')];
        const i = tools.indexOf(document.activeElement);
        if (i < 0) return;
        const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tools.length - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        this._focusTool(tools[(next + tools.length) % tools.length]);
      });
      this._toolbar.addEventListener('focusin', e => {
        if (e.target.classList?.contains('kimgmap-tool')) this._focusTool(e.target, false);
      });
      this._toolbar.querySelectorAll('.kimgmap-tool').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.tool;
          if (t === 'select') { this._setShape(null); return; }
          if (this.opts.shapes.includes(t)) {
            this._setShape(t);
            const L = this.opts.labels;
            this._announce(t === 'poly' ? L.polyHint : fmt(L.drawHint, { shape: this._shapeLabel(t) }));
            return;
          }
          if (t === 'undo') { this.undo(); return; }
          if (t === 'redo') { this.redo(); return; }
          if (t === 'duplicate') { this._duplicateArea(this._sel); return; }
          if (t === 'delete') { if (this._sel) this._deleteArea(this._sel); return; }
          if (t === 'clear') {
            if (!this.areas.length && !this._extras.length) return;
            const L = this.opts.labels;
            this._showConfirm(L.confirmClear, L.clearAll, () => this._clearAll());
          }
        });
      });
      this._setShape(this._drawShape); // apply initial cursor + active button
    }

    /** The how-to line for the active tool (no Shift hint while touch is in use) */
    _updateTip() {
      if (!this._tip) return;
      const L = this.opts.labels, t = this._drawShape;
      const text = { rect: L.tipRect, circle: L.tipCircle, poly: L.tipPoly }[t] ?? L.tipSelect;
      this._tip.textContent = (t === 'rect' || t === 'circle') && !this._coarse && L.tipShift ? `${text} ${L.tipShift}` : text;
    }

    _clearAll() {
      this.areas   = [];
      this._extras = [];
      this._clearValidationErrors();
      this._select(null);
      this._renderAll();
      this._syncOutput();
      this._announce(this.opts.labels.cleared);
    }

    /**
     * Ask before a destructive action, in the editor itself: `message` with
     * Cancel and a `yes` button that runs `onYes`. The rest of the editor is
     * inert until it's answered; Escape cancels.
     */
    _showConfirm(message, yes, onYes) {
      const bar = this._confirmBar;
      if (!bar) return;
      const L = this.opts.labels;
      bar.setAttribute('aria-label', message);
      bar.querySelector('.kimgmap-confirm-msg').textContent = message;
      const no = bar.querySelector('.kimgmap-confirm-no'), ok = bar.querySelector('.kimgmap-confirm-yes');
      no.textContent = L.cancel;
      ok.textContent = yes;
      this._confirmReturn = document.activeElement;
      this._confirmYes = onYes;
      bar.hidden = false;
      for (const el of bar.parentElement.children) if (el !== bar && el !== this._live) el.inert = true;
      no.focus();
      if (!bar._bound) {
        bar._bound = true;
        no.addEventListener('click', () => this._hideConfirm());
        ok.addEventListener('click', () => { const fn = this._confirmYes; this._hideConfirm(false); fn?.(); this._canvas?.focus({ preventScroll: true }); });
      }
    }

    /** Dismiss the confirmation (focus goes back where it was, unless `restore` is false) */
    _hideConfirm(restore = true) {
      const bar = this._confirmBar;
      if (!bar || bar.hidden) return;
      bar.hidden = true;
      this._confirmYes = null;
      for (const el of bar.parentElement.children) if (el !== bar && el !== this._live) el.inert = false;
      const back = this._confirmReturn;
      this._confirmReturn = null;
      if (restore) (back?.isConnected && !back.disabled ? back : this._canvas)?.focus({ preventScroll: true });
    }

    _confirming() { return !!this._confirmBar && !this._confirmBar.hidden; }

    _setShape(shape) {
      if (this._polyActive) this._cancelPoly();
      this._drawShape    = shape;
      this._svg.style.cursor = shape ? 'crosshair' : '';
      this._updateTip();
      this._refreshToolbar();
    }

    _refreshToolbar() {
      if (!this._toolbar) return;
      const ae = document.activeElement;
      let lostFocus = false;
      this._toolbar.querySelectorAll('.kimgmap-tool').forEach(btn => {
        const t = btn.dataset.tool;
        const on = this._drawShape ? t === this._drawShape : t === 'select';
        btn.classList.toggle('is-active', on);
        if (btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', String(on));
        // Nothing to act on → disabled
        const disabled = (t === 'duplicate' || t === 'delete') ? !this._sel
          : t === 'clear' ? !this.areas.length && !this._extras.length
          : t === 'undo'  ? !this._canUndo()
          : t === 'redo'  ? !this._canRedo() : false;
        if (disabled && btn === ae) lostFocus = true;
        btn.disabled = disabled;
      });
      // Keep exactly one Tab stop on an enabled tool (prefer the current one)
      const stop = this._toolbar.querySelector('.kimgmap-tool[tabindex="0"]:not(:disabled)')
        || this._toolbar.querySelector('.kimgmap-tool.is-active');
      this._focusTool(stop, false);
      // Focus was on a button that just became disabled → keep it in the editor
      if (lostFocus) this._canvas?.focus({ preventScroll: true });
    }

    /** Make `btn` the toolbar's Tab stop, and optionally focus it */
    _focusTool(btn, focus = true) {
      if (!btn) return;
      this._toolbar.querySelectorAll('.kimgmap-tool').forEach(b => b.setAttribute('tabindex', b === btn ? '0' : '-1'));
      if (focus) btn.focus();
    }

    /* -----------------------------------------------------------------------
     * Sidebar events
     * ----------------------------------------------------------------------- */

    _bindSidebar() {
      this._sidebar.querySelector('.kimgmap-del-btn')
        .addEventListener('click', () => { if (this._sel) this._deleteArea(this._sel); });
      // Listbox keyboard: arrows / Home / End move the selection; Enter / Space select
      const list = this._sidebar.querySelector('.kimgmap-area-list');
      list.addEventListener('click', e => {
        const item = e.target.closest('.kimgmap-list-item');
        if (item) this._select(item.dataset.id);
      });
      // Moving to another field (or the list) starts a new undo step
      this._sidebar.addEventListener('focusin', () => { if (this._history) this._history.key = null; });
      list.addEventListener('keydown', e => {
        const opts = [...list.querySelectorAll('[role="option"]')];
        const i = opts.indexOf(document.activeElement);
        if (i < 0) return;
        const next = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: opts.length - 1, Enter: i, ' ': i }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        const target = opts[clamp(next, 0, opts.length - 1)];
        this._select(target.dataset.id);   // the focused, aria-selected option is read by screen readers
      });
    }

    /* -----------------------------------------------------------------------
     * SVG interaction events
     * ----------------------------------------------------------------------- */

    _bindSVG() {
      const svg = this._svg;

      // Finger-sized targets for touch, precise ones for mouse/pen — switch in
      // place (capture phase, before area/handle handlers run)
      svg.addEventListener('pointerdown', e => {
        if (this._pointerId !== null) return; // e.g. a palm during a pen stroke
        const coarse = e.pointerType === 'touch';
        if (coarse !== this._coarse) { this._coarse = coarse; this._resizeTargets(); this._updateTip(); }
      }, true);

      // Rect / circle: draw on press-drag-release (mouse, touch, or pen)
      svg.addEventListener('pointerdown', e => {
        if (!this._acceptPointer(e) || !this._drawShape || this._drawShape === 'poly' || this._mode) return;
        e.preventDefault();
        this._claimPointer(e);
        this._mode       = 'drawing';
        this._drawOrigin = this._svgPt(e);
        this._drawing    = { shape: this._drawShape, coords: this._initCoords(this._drawShape, this._drawOrigin) };
        this._renderPreview();
      });

      // Poly: click to add points; background click = deselect in select mode
      svg.addEventListener('click', e => {
        if (this._drawShape === 'poly') {
          this._polyClick(this._svgPt(e));
        } else if (!this._drawShape && e.target === svg) {
          this._select(null);
        }
      });

      // Poly: double-click to close (the repeat click on the last vertex
      // usually closes it first — see _polyClick — so this is a fallback)
      svg.addEventListener('dblclick', e => {
        // With fewer than 3 points there's nothing to finish — keep drawing
        if (this._drawShape === 'poly' && this._polyActive && this._drawing.coords.length >= 6) {
          e.preventDefault();
          this._closePoly();
        }
      });

      // Events from a pointer other than the one driving the interaction
      // (e.g. a second finger) are ignored
      const foreign = e => this._pointerId !== null && e.pointerId !== this._pointerId;

      // Window-level, capture-phase listeners drive every live update and end
      // every interaction: they keep working when the pointer leaves the image,
      // and the host page can't swallow them with stopPropagation().
      window.addEventListener('pointermove', this._docMove = e => {
        if (foreign(e)) return;
        const pt = this._svgPt(e, this._mode !== 'drag' && this._mode !== 'resize');
        if      (this._mode === 'drawing') this._updateDraw(pt);
        else if (this._mode === 'drag')    this._doDrag(pt);
        else if (this._mode === 'resize')  this._doResize(pt);
        else if (this._polyActive) { this._polyPreview = pt; this._renderPreview(); }
      }, true);

      // Up: finish any in-progress interaction
      window.addEventListener('pointerup', this._docUp = e => {
        if (foreign(e)) return;
        this._pointerId = null;
        if      (this._mode === 'drawing') this._finishDraw();
        else if (this._mode === 'drag' || this._mode === 'resize') {
          this._mode        = null;
          this._dragState   = null;
          this._resizeState = null;
          this._syncOutput();
        }
      }, true);

      // Cancelled by the browser/OS (e.g. touch interrupted): undo the
      // in-progress interaction rather than committing it
      window.addEventListener('pointercancel', this._docCancel = e => {
        if (!foreign(e)) this._cancelInteraction();
      }, true);
    }

    /* -----------------------------------------------------------------------
     * Drawing: rect and circle
     * ----------------------------------------------------------------------- */

    _initCoords(shape, pt) {
      if (shape === 'rect')   return [pt.x, pt.y, pt.x, pt.y];
      if (shape === 'circle') return [pt.x, pt.y, 0];
      return [];
    }

    _updateDraw(pt) {
      if (!this._drawing) return;
      const o = this._drawOrigin;
      if (this._drawing.shape === 'rect') {
        this._drawing.coords = [
          Math.min(o.x, pt.x), Math.min(o.y, pt.y),
          Math.max(o.x, pt.x), Math.max(o.y, pt.y),
        ];
      } else if (this._drawing.shape === 'circle') {
        this._drawing.coords[2] = Math.min(hypot(o.x, o.y, pt.x, pt.y), this._maxRadius(o.x, o.y));
      }
      this._renderPreview();
    }

    _finishDraw() {
      const d = this._drawing;
      this._mode       = null;
      this._drawing    = null;
      this._drawOrigin = null;
      this._removePreview();
      if (!d) return;

      let valid = false;
      if (d.shape === 'rect') {
        const [x1, y1, x2, y2] = d.coords;
        const min = Math.max(1, this._px(4));   // 4 screen px, and never below 1 image px (output is rounded)
        valid = Math.abs(x2 - x1) > min && Math.abs(y2 - y1) > min;
      } else if (d.shape === 'circle') {
        valid = d.coords[2] > Math.max(1, this._px(4));
      }
      if (!valid) return;
      this._addArea(d.shape, d.coords);
    }

    /* -----------------------------------------------------------------------
     * Drawing: polygon (click-by-click)
     * ----------------------------------------------------------------------- */

    _polyClick(pt) {
      if (!this._polyActive) {
        // Start new polygon
        this._polyActive = true;
        this._drawing    = { shape: 'poly', coords: [pt.x, pt.y] };
        this._polyPreview = pt;
        this._renderPreview();
        this._announce(`${this.opts.labels.polyStarted} ${this.opts.labels.polyHint}`);
        this._refreshToolbar();   // Undo now removes points
        return;
      }
      // Clicking/tapping the last vertex again finishes the polygon. This is
      // also how double-click and double-tap close it: the second click lands
      // on the vertex the first one just placed (so no duplicate point).
      // With fewer than 3 points there's nothing to finish, so ignore it.
      const c = this._drawing.coords;
      if (hypot(pt.x, pt.y, c[c.length - 2], c[c.length - 1]) < this._handleR()) {
        if (c.length >= 6) this._closePoly();
        return;
      }

      // Check if clicking near the first vertex to close
      const [fx, fy] = this._drawing.coords;
      if (this._drawing.coords.length >= 6 && hypot(pt.x, pt.y, fx, fy) < this._handleR() * 2) {
        this._closePoly();
        return;
      }
      this._drawing.coords.push(pt.x, pt.y);
      this._polyPreview = pt;
      this._renderPreview();
    }

    _closePoly() {
      const d = this._drawing;
      this._polyActive  = false;
      this._polyPreview = null;
      this._drawing     = null;
      this._removePreview();
      if (!d || d.coords.length < 6) return; // need ≥ 3 points
      this._addArea('poly', d.coords);
    }

    _cancelPoly() {
      if (this._polyActive) this._announce(this.opts.labels.polyCancelled);
      this._polyActive  = false;
      this._polyPreview = null;
      this._drawing     = null;
      this._removePreview();
      this._refreshToolbar();
    }

    /* -----------------------------------------------------------------------
     * Drag (move)
     * ----------------------------------------------------------------------- */

    _doDrag(pt) {
      const st = this._dragState;
      if (!st) return;
      const area = this.areas.find(a => a.id === st.areaId);
      if (!area) return;

      const dx = pt.x - st.start.x;
      const dy = pt.y - st.start.y;
      const W  = this._W;
      const H  = this._H;

      area.coords = this._moveCoords(area.shape, st.orig, dx, dy, W, H);
      this._patchAreaEl(area);
    }

    /**
     * Translate coords by (dx, dy), clamped so the shape stays inside the
     * image. An area that already extends past an edge (e.g. imported) may
     * move further in, but isn't snapped inside on the first touch.
     */
    _moveCoords(shape, c, dx, dy, W, H) {
      if (shape === 'rect') {
        dx = clampDelta(dx, -c[0], W - c[2]); dy = clampDelta(dy, -c[1], H - c[3]);
        return [c[0] + dx, c[1] + dy, c[2] + dx, c[3] + dy];
      }
      if (shape === 'circle') {
        const r = c[2];
        dx = clampDelta(dx, r - c[0], W - r - c[0]); dy = clampDelta(dy, r - c[1], H - r - c[1]);
        return [c[0] + dx, c[1] + dy, r];
      }
      return this._shiftPoly(c, dx, dy, W, H);
    }

    /* -----------------------------------------------------------------------
     * Resize
     * ----------------------------------------------------------------------- */

    _doResize(pt) {
      const st = this._resizeState;
      if (!st) return;
      const area = this.areas.find(a => a.id === st.areaId);
      if (!area) return;

      const dx = pt.x - st.start.x;
      const dy = pt.y - st.start.y;
      const W  = this._W;
      const H  = this._H;
      const o  = st.orig;

      if (area.shape === 'rect') {
        let [x1, y1, x2, y2] = [...o];
        // Bounds are the image, widened to wherever an imported area already reaches
        const X0 = Math.min(0, o[0]), Y0 = Math.min(0, o[1]), X1 = Math.max(W, o[2]), Y1 = Math.max(H, o[3]);
        switch (st.hi) {
          case 0: x1 = clamp(x1+dx, X0, x2-1);  y1 = clamp(y1+dy, Y0, y2-1); break; // nw
          case 1:                                  y1 = clamp(y1+dy, Y0, y2-1); break; // n
          case 2: x2 = clamp(x2+dx, x1+1, X1);  y1 = clamp(y1+dy, Y0, y2-1); break; // ne
          case 3: x2 = clamp(x2+dx, x1+1, X1);                                break; // e
          case 4: x2 = clamp(x2+dx, x1+1, X1);  y2 = clamp(y2+dy, y1+1, Y1); break; // se
          case 5:                                  y2 = clamp(y2+dy, y1+1, Y1); break; // s
          case 6: x1 = clamp(x1+dx, X0, x2-1);  y2 = clamp(y2+dy, y1+1, Y1); break; // sw
          case 7: x1 = clamp(x1+dx, X0, x2-1);                                break; // w
        }
        area.coords = [x1, y1, x2, y2];
      } else if (area.shape === 'circle') {
        const [cx, cy] = o;
        // Use the change in distance from the centre, so the radius doesn't jump
        // by however far from the handle's centre it was grabbed
        const r = o[2] + hypot(cx, cy, pt.x, pt.y) - hypot(cx, cy, st.start.x, st.start.y);
        area.coords = [cx, cy, clamp(r, 1, Math.max(1, this._maxRadius(cx, cy), o[2]))];
      } else if (area.shape === 'poly') {
        const coords = [...o];
        const { vi } = st.hData;
        coords[vi]     = clamp(coords[vi]     + dx, Math.min(0, o[vi]),     Math.max(W, o[vi]));
        coords[vi + 1] = clamp(coords[vi + 1] + dy, Math.min(0, o[vi + 1]), Math.max(H, o[vi + 1]));
        area.coords = coords;
      }
      this._patchAreaEl(area);
    }

    /** Update the SVG element for `area` in-place (avoids full re-render during drag/resize) */
    _patchAreaEl(area) {
      const g = this._svg.querySelector(`[data-id="${CSS.escape(area.id)}"]`);
      if (!g) return;
      const info = shapeAttrs(area);
      if (!info) return;

      g.querySelectorAll('.kimgmap-hit,.kimgmap-shape').forEach(el => {
        for (const [k, v] of Object.entries(info.attrs)) el.setAttribute(k, v);
        if (el.classList.contains('kimgmap-hit')) el.setAttribute('stroke-width', this._hitSW());
      });

      // Move handles in place — the handle under the pointer must not be
      // replaced mid-gesture (touch events stay bound to the original node)
      const els = g.querySelectorAll('.kimgmap-handle');
      const hps = handlePositions(area);
      if (els.length === hps.length) {
        els.forEach((el, i) => { el.setAttribute('cx', hps[i].x); el.setAttribute('cy', hps[i].y); });
      } else {
        els.forEach(el => el.remove());
        this._addHandles(g, area);
      }

      // Live-update coords display in properties panel
      const cv = area.id === this._sel && this._sidebar?.querySelector('.kimgmap-coords-input');
      if (cv && cv !== document.activeElement) {
        cv.value = area.coords.map(Math.round).join(', ');
        cv.removeAttribute('aria-invalid');
        cv.classList.remove('is-error');
      }
    }

    /* -----------------------------------------------------------------------
     * Selection & deletion
     * ----------------------------------------------------------------------- */

    _select(id) {
      this._sel = id;
      if (!this._svg) return;
      this._svg.querySelectorAll('.kimgmap-ag').forEach(g => {
        g.classList.toggle('is-selected', g.dataset.id === id);
      });
      this._updateList();
      this._updateProps();
      this._refreshToolbar(); // update copy enabled/disabled state
    }

    _deleteArea(id) {
      const victim = this.areas.find(a => a.id === id);
      if (!victim) return;
      const name   = this._areaName(victim);
      const index  = this.areas.indexOf(victim);
      const list   = this._sidebar?.querySelector('.kimgmap-area-list');
      const inList = !!list?.contains(document.activeElement);
      const inEditor = !!(this._overlay || this._editorEl)?.contains(document.activeElement);
      this.areas = this.areas.filter(a => a.id !== id);
      if (this._sel === id) this._sel = null;
      this._errorIds.delete(id);
      if (this._errorIds.size === 0 && this._banner) this._banner.hidden = true;
      this._svg?.querySelector(`.kimgmap-ag[data-id="${CSS.escape(id)}"]`)?.remove();
      this._updateList();
      this._updateProps();
      this._refreshToolbar();
      this._syncOutput();
      this._announce(fmt(this.opts.labels.deleted, { name }));
      // Keep keyboard users in place: the next option in the list, or the canvas
      if (inList && this.areas.length) this._select(this.areas[Math.min(index, this.areas.length - 1)].id);
      else if (inEditor && !(this._overlay || this._editorEl).contains(document.activeElement)) this._canvas?.focus({ preventScroll: true });
    }

    _duplicateArea(id) {
      const area = this.areas.find(a => a.id === id);
      if (!area) return;
      const W = this._W;
      const H = this._H;
      const coords = this._offsetCoords(area.shape, area.coords, 10, W, H);
      const dupe = { id: uid(), shape: area.shape, coords, attrs: { ...area.attrs } };
      this.areas.push(dupe);
      this._appendArea(dupe);
      this._select(dupe.id);
      this._syncOutput();
      this._announce(fmt(this.opts.labels.duplicated, { name: this._areaName(area) }));
    }

    /** Offset a set of coords by (dx, dy), clamped to image bounds */
    _offsetCoords(shape, coords, d, W, H) {
      return this._moveCoords(shape, coords, d, d, W, H);
    }

    /** Translate polygon coords by (dx, dy), clamped so the whole shape stays in bounds */
    _shiftPoly(coords, dx, dy, W, H) {
      const xs = coords.filter((_, i) => i % 2 === 0);
      const ys = coords.filter((_, i) => i % 2 === 1);
      dx = clampDelta(dx, -Math.min(...xs), W - Math.max(...xs));
      dy = clampDelta(dy, -Math.min(...ys), H - Math.max(...ys));
      return coords.map((v, i) => v + (i % 2 === 0 ? dx : dy));
    }

    /** Largest circle radius at (cx, cy) that stays inside the image */
    _maxRadius(cx, cy) {
      const W = this._W;
      const H = this._H;
      return Math.min(cx, cy, W - cx, H - cy);
    }

    /* -----------------------------------------------------------------------
     * Sidebar: area list
     * ----------------------------------------------------------------------- */

    _updateList() {
      const list  = this._sidebar?.querySelector('.kimgmap-area-list');
      const empty = this._sidebar?.querySelector('.kimgmap-empty');
      if (!list) return;
      const hadFocus = list.contains(document.activeElement);

      list.hidden  = !this.areas.length;
      empty.hidden = !!this.areas.length;
      empty.textContent = this.opts.labels.noAreas;

      const stop = this.areas.some(a => a.id === this._sel) ? this._sel : this.areas[0]?.id;
      list.innerHTML = this.areas.map(area => {
        const label   = this._areaName(area);
        const isError = this._errorIds.has(area.id);
        const sel     = area.id === this._sel;
        return `<div class="kimgmap-list-item${sel ? ' is-active' : ''}${isError ? ' is-error' : ''}" data-id="${escHtml(area.id)}"
            role="option" aria-selected="${sel}" tabindex="${area.id === stop ? 0 : -1}">
          <span class="kimgmap-badge kimgmap-badge--${escHtml(area.shape)}" aria-hidden="true">${escHtml(area.shape[0].toUpperCase())}</span>
          <span class="kimgmap-list-label" title="${escHtml(label)}">${escHtml(label)}</span>
          ${isError ? `<span class="kimgmap-list-error-dot" aria-hidden="true" title="${escHtml(this.opts.labels.missingTitle)}">!</span><span class="kimgmap-sr">, ${escHtml(this.opts.labels.missingTitle)}</span>` : ''}
        </div>`;
      }).join('');

      // Re-rendering replaced the focused option — put focus back
      if (hadFocus) {
        const opt = list.querySelector('[tabindex="0"]');
        opt?.focus({ preventScroll: true });
        opt?.scrollIntoView({ block: 'nearest' });
      }
    }

    /* -----------------------------------------------------------------------
     * Sidebar: properties panel
     * ----------------------------------------------------------------------- */

    _updateProps() {
      const panel  = this._sidebar?.querySelector('.kimgmap-props');
      const fields = this._sidebar?.querySelector('.kimgmap-props-fields');
      if (!panel || !fields) return;

      const area = this.areas.find(a => a.id === this._sel);
      if (!area || !this.opts.showAttributePanel) { panel.hidden = true; return; }
      panel.hidden = false;

      const allAttrs = [
        ...this.opts.attributes,
        ...this.opts.customAttributes,
      ].map(normalizeAttr);

      fields.innerHTML = `
        ${allAttrs.map(({ attr, label }) => {
          const val = area.attrs[attr] ?? '';
          const fid = `kp-${area.id}-${attr}`;
          if (attr === 'target') {
            const targets = ['', '_blank', '_self', '_parent', '_top'];
            if (!targets.includes(val)) targets.push(val); // keep custom/parsed values
            const opts = targets
              .map(v => `<option value="${escHtml(v)}"${val === v ? ' selected' : ''}>${escHtml(v) || '—'}</option>`)
              .join('');
            return `<div class="kimgmap-prop-row">
              <label class="kimgmap-prop-label" for="${escHtml(fid)}" title="${escHtml(attr)}">${escHtml(label)}</label>
              <select class="kimgmap-prop-input" id="${escHtml(fid)}" data-attr="${escHtml(attr)}">${opts}</select>
            </div>`;
          }
          return `<div class="kimgmap-prop-row">
            <label class="kimgmap-prop-label" for="${escHtml(fid)}" title="${escHtml(attr)}">${escHtml(label)}</label>
            <input class="kimgmap-prop-input" id="${escHtml(fid)}" type="text" value="${escHtml(val)}" data-attr="${escHtml(attr)}" placeholder="${escHtml(label)}…">
          </div>`;
        }).join('')}
        <div class="kimgmap-prop-row">
          <span class="kimgmap-prop-label">${escHtml(this.opts.labels.shape)}</span>
          <span class="kimgmap-prop-val">${escHtml(area.shape)}</span>
        </div>
        <div class="kimgmap-prop-row">
          <label class="kimgmap-prop-label" for="kp-${escHtml(area.id)}-coords">${escHtml(this.opts.labels.coords)}</label>
          <input class="kimgmap-prop-input kimgmap-coords-input" id="kp-${escHtml(area.id)}-coords" type="text"
            value="${area.coords.map(Math.round).join(', ')}" spellcheck="false" autocomplete="off"
            aria-describedby="kp-${escHtml(area.id)}-coords-fmt"${this.opts.editable ? '' : ' readonly'}>
          <span id="kp-${escHtml(area.id)}-coords-fmt" hidden>${escHtml(this._coordsFormat(area.shape))}</span>
        </div>
      `;

      // Coords: typed values are applied on Enter / blur when valid for the shape
      const ci = fields.querySelector('.kimgmap-coords-input');
      const shown = () => area.coords.map(Math.round).join(', ');
      const commit = () => {
        if (!this.opts.editable || ci.value === shown()) return;
        const c = this._parseCoordsInput(area.shape, ci.value);
        if (!c) {
          ci.setAttribute('aria-invalid', 'true'); ci.classList.add('is-error');
          this._announce(fmt(this.opts.labels.invalidCoords, { format: this._coordsFormat(area.shape) }));
          return;
        }
        ci.removeAttribute('aria-invalid'); ci.classList.remove('is-error');
        area.coords = c;
        ci.value = c.map(Math.round).join(', ');
        this._patchAreaEl(area);
        this._syncOutput();
      };
      ci.addEventListener('change', commit);
      ci.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        // Escape abandons the typed value (the editor then moves focus out of the field)
        if (e.key === 'Escape') { ci.value = shown(); ci.removeAttribute('aria-invalid'); ci.classList.remove('is-error'); }
      });

      fields.querySelectorAll('[data-attr]').forEach(input => {
        const sync = () => {
          const attr  = input.dataset.attr;
          const value = input.value;
          // 'change' fires after 'input' with the same value (e.g. on blur) —
          // ignore it, so callbacks fire once per edit and the list isn't
          // re-rendered under a click that caused the blur
          if ((area.attrs[attr] ?? '') === value) return;
          setAttr(area, attr, value);

          // onAttributeChange: let the caller mirror values across attrs
          if (this.opts.onAttributeChange) {
            const overrides = this.opts.onAttributeChange.call(this, copyArea(area), attr, value);
            if (overrides && typeof overrides === 'object') {
              Object.entries(overrides).forEach(([k, v]) => {
                setAttr(area, k, v);
                // Update the input in the panel if it's visible
                const el = Array.from(fields.querySelectorAll('[data-attr]')).find(f => f.dataset.attr === k);
                if (el) el.value = area.attrs[k] ?? '';
              });
            }
          }

          // mandatoryTitles: re-check this area's title after any change — the
          // title may be edited directly or mirrored from another attribute via
          // onAttributeChange — and clear the error cue once it's populated.
          if (this.opts.mandatoryTitles && this._errorIds.has(area.id) &&
              String(area.attrs.title ?? '').trim()) {
            this._clearValidationError(area.id);
          }

          this._updateList();
          this._syncOutput(`attr:${area.id}:${attr}`);   // typing in one field is one undo step
        };
        input.addEventListener('input',  sync);
        input.addEventListener('change', sync);
        // Enter in a field must not submit a <form> the editor is embedded in
        input.addEventListener('keydown', e => { if (e.key === 'Enter' && input.tagName === 'INPUT') e.preventDefault(); });
      });

      // Highlight the field(s) for an area flagged by mandatoryTitles validation
      this._markPropErrors(fields, area);
    }

    _coordsFormat(shape) {
      const L = this.opts.labels;
      return shape === 'rect' ? L.coordsRect : shape === 'circle' ? L.coordsCircle : L.coordsPoly;
    }

    /** Parse typed coords for `shape`, clamped to the image; null if invalid */
    _parseCoordsInput(shape, text) {
      const n = text.split(/[\s,;]+/).filter(Boolean).map(Number);
      if (!n.length || n.some(v => !isFinite(v))) return null;
      const W = this._W, H = this._H;
      if (shape === 'rect') {
        if (n.length !== 4) return null;
        const xs = [clamp(n[0], 0, W), clamp(n[2], 0, W)].sort((a, b) => a - b);
        const ys = [clamp(n[1], 0, H), clamp(n[3], 0, H)].sort((a, b) => a - b);
        if (xs[1] - xs[0] < 1 || ys[1] - ys[0] < 1) return null;
        return [xs[0], ys[0], xs[1], ys[1]];
      }
      if (shape === 'circle') {
        if (n.length !== 3) return null;
        const cx = clamp(n[0], 0, W), cy = clamp(n[1], 0, H);
        return [cx, cy, clamp(n[2], 1, Math.max(1, this._maxRadius(cx, cy)))];
      }
      if (n.length < 6 || n.length % 2) return null;
      return n.map((v, i) => clamp(v, 0, i % 2 ? H : W));
    }

    /**
     * Apply (or remove) the error highlight on the Properties-panel inputs for
     * an area flagged by mandatoryTitles. When a `title` field is shown, that
     * field is highlighted; otherwise the title is being mirrored from another
     * attribute via onAttributeChange, so every empty field is highlighted to
     * show the user what still needs a value.
     */
    _markPropErrors(fields, area) {
      if (!fields || !area) return;
      this._unmarkPropErrors(fields);
      if (!this._errorIds.has(area.id)) return;

      const titleInput = fields.querySelector('[data-attr="title"]');
      const flagged = titleInput ? [titleInput]
        : [...fields.querySelectorAll('[data-attr]')].filter(el => !el.value.trim());
      for (const el of flagged) {
        el.classList.add('is-error');
        el.setAttribute('aria-invalid', 'true');
        el.setAttribute('aria-describedby', this._errTextId);
      }
    }

    _unmarkPropErrors(fields) {
      fields?.querySelectorAll('[data-attr].is-error').forEach(el => {
        el.classList.remove('is-error');
        el.removeAttribute('aria-invalid');
        el.removeAttribute('aria-describedby');
      });
    }

    /* -----------------------------------------------------------------------
     * Undo / redo
     * ----------------------------------------------------------------------- */

    /** Start a fresh undo history from the current areas */
    _resetHistory() {
      this._history = { stack: [this._state()], i: 0, key: null };
      this._refreshToolbar();
    }

    _state() {
      const areas  = this.getAreas();
      const extras = this._extras.map(x => ({ ...x, attrs: { ...x.attrs } }));
      return { areas, extras, sel: this._sel, sig: areas.map(areaSig).join('\n') + '\n' + JSON.stringify(extras) };
    }

    /**
     * Record the current areas as an undo step (if they changed). Steps with
     * the same `key` in a row — typing in one field, nudging one area with
     * the arrow keys — merge into one.
     */
    _record(key = null) {
      const H = this._history;
      if (!H || this._restoring) return;
      const st = this._state();
      if (st.sig === H.stack[H.i].sig) return;
      if (key && key === H.key && H.i === H.stack.length - 1) {
        // Merging into the top step; if that undoes it (typed, then deleted), drop it
        if (H.i > 0 && st.sig === H.stack[H.i - 1].sig) { H.stack.pop(); H.i--; H.key = null; this._refreshToolbar(); return; }
        H.stack[H.i] = st;
      } else {
        H.stack.length = H.i + 1;   // a new change discards the redo steps
        H.stack.push(st);
        if (H.stack.length > HISTORY_MAX) H.stack.shift();
        H.i = H.stack.length - 1;
      }
      H.key = key;
      this._refreshToolbar();
    }

    _canUndo() { return this._polyActive || (!!this._history && this._history.i > 0); }
    _canRedo() { return !this._polyActive && !!this._history && this._history.i < this._history.stack.length - 1; }

    /**
     * Put the areas back as they were in history step `st`, coming from step
     * `from`. The area the step changed is selected, so the user sees what
     * was undone or redone.
     */
    _applyState(st, from) {
      const before  = new Map(from.areas.map(a => [a.id, areaSig(a)]));
      const changed = st.areas.find(a => before.get(a.id) !== areaSig(a));
      this.areas   = st.areas.map(copyArea);
      this._extras = st.extras.map(x => ({ ...x, attrs: { ...x.attrs } }));
      for (const id of [...this._errorIds]) if (!this.areas.some(a => a.id === id)) this._errorIds.delete(id);
      if (!this._errorIds.size && this._banner) this._banner.hidden = true;
      this._history.key = null;
      this._renderAll();
      this._select(changed ? changed.id : this.areas.some(a => a.id === st.sel) ? st.sel : null);
      this._restoring = true;
      try { this._syncOutput(); } finally { this._restoring = false; }
    }

    /* -----------------------------------------------------------------------
     * Output
     * ----------------------------------------------------------------------- */

    /** A committed change: record it for undo (see _record for `key`) and write the output */
    _syncOutput(key) {
      this._record(key);
      const html = this.getHTML();
      if (this._ta) this._ta.value = html;
      if (this.opts.onUpdate) this.opts.onUpdate.call(this, html, this.getAreas());
    }

    _save() {
      if (!this._overlay) return; // modal already closing
      if (this.opts.mandatoryTitles) {
        const missing = this.areas.filter(a => !String(a.attrs.title ?? '').trim()).map(a => a.id);
        if (missing.length) {
          this._showValidationErrors(missing);
          return; // block save
        }
      }
      this._clearValidationErrors();
      this._syncOutput();
      // While onSave runs, a close() or destroy() from inside it counts as saved.
      // (The snapshot stays until close(true) — if onSave throws, the session is
      // still unsaved and Cancel / × can still revert it.)
      if (this._discard && !this._discard.hidden) this._hideDiscard();
      this._saving   = true;
      try {
        this.opts.onSave?.call(this, this.getHTML(), this.getAreas());
      } finally {
        this._saving = false;
      }
      this.close(true);   // no-op if onSave already closed it
    }

    /* -----------------------------------------------------------------------
     * Validation
     * ----------------------------------------------------------------------- */

    /** Mark a set of area ids as invalid, show the error banner */
    _showValidationErrors(ids) {
      this._errorIds = new Set(ids);

      // Update SVG groups
      this._svg?.querySelectorAll('.kimgmap-ag').forEach(g => {
        g.classList.toggle('is-error', this._errorIds.has(g.dataset.id));
      });

      // Update list (includes error dots)
      this._updateList();

      // Show banner with message. It's cleared first and filled a moment later,
      // so the alert is announced again on every failed Save.
      if (this._banner) {
        const msg = this._banner.querySelector('.kimgmap-validation-msg');
        msg.textContent = '';
        this._banner.hidden = false;
        setTimeout(() => { msg.textContent = this.opts.labels.errorMissingTitles; }, 50);
      }

      // Select the first errored area and focus the field that needs fixing
      if (ids.length) {
        this._select(ids[0]);
        this._sidebar?.querySelector('.kimgmap-props-fields .is-error')?.focus();
      }
    }

    /** Clear the error state for a single area (called as titles are filled) */
    _clearValidationError(id) {
      if (!this._errorIds.has(id)) return;
      this._errorIds.delete(id);

      const g  = this._svg?.querySelector(`.kimgmap-ag[data-id="${CSS.escape(id)}"]`);
      if (g) g.classList.remove('is-error');

      const li = this._sidebar?.querySelector(`.kimgmap-list-item[data-id="${CSS.escape(id)}"]`);
      if (li) {
        li.classList.remove('is-error');
        li.querySelector('.kimgmap-list-error-dot')?.remove();
        li.querySelector('.kimgmap-sr')?.remove();
      }

      // Clear the Properties-panel field highlight if this area is showing
      if (this._sel === id) this._unmarkPropErrors(this._sidebar?.querySelector('.kimgmap-props-fields'));

      // Hide banner once all errors are resolved
      if (this._errorIds.size === 0 && this._banner) this._banner.hidden = true;
    }

    /** Clear all validation error state */
    _clearValidationErrors() {
      this._errorIds.clear();
      this._svg?.querySelectorAll('.kimgmap-ag.is-error').forEach(g => g.classList.remove('is-error'));
      this._unmarkPropErrors(this._sidebar?.querySelector('.kimgmap-props-fields'));
      if (this._banner) this._banner.hidden = true;
      this._updateList();
    }

    /* =========================================================================
     * Public API
     * ========================================================================= */

    /** Return a deep copy of all area objects */
    getAreas() {
      return this.areas.map(copyArea);
    }

    /**
     * Replace all areas (re-renders, syncs output, and starts a new undo
     * history). Areas that can't be used — unknown shape, too few or
     * non-numeric coords — are skipped with a console warning.
     */
    setAreas(areas) {
      if (!Array.isArray(areas)) throw new TypeError('kImgMap: setAreas() expects an array of areas');
      const ids = new Set();
      const next = [];
      areas.forEach((a, i) => {
        const area = normalizeArea(a);
        if (!area) {
          console.warn(`kImgMap: setAreas() skipped area ${i} — it needs a shape ('rect', 'circle' or 'poly') and enough numeric coords`, a);
          return;
        }
        if (ids.has(area.id)) area.id = uid();   // ids must be unique
        ids.add(area.id);
        next.push(area);
      });
      this.areas = next;
      this._errorIds.clear();
      if (this._banner) this._banner.hidden = true;
      this._select(null);
      this._renderAll();
      this._syncOutput();
      if (this._history) this._resetHistory();
    }

    /** Undo the last change. While a polygon is being drawn, remove its last point instead. */
    undo() {
      if (this._mode || this._confirming()) return;   // mid-gesture, or a prompt is open
      if (this._polyActive) {
        const c = this._drawing.coords;
        if (c.length <= 2) this._cancelPoly();
        else { c.length -= 2; this._renderPreview(); }
        return;
      }
      const H = this._history;
      if (!H || H.i <= 0) return;
      H.i--;
      this._applyState(H.stack[H.i], H.stack[H.i + 1]);
      this._announce(this.opts.labels.undone);
    }

    /** Redo the last undone change */
    redo() {
      if (this._mode || this._polyActive || this._confirming()) return;
      const H = this._history;
      if (!H || H.i >= H.stack.length - 1) return;
      H.i++;
      this._applyState(H.stack[H.i], H.stack[H.i - 1]);
      this._announce(this.opts.labels.redone);
    }

    /** Get the current HTML output string */
    getHTML() { return buildOutput(this.areas, this.opts, this._extras, this._mapName); }

    /** Remove all editor UI and restore the original DOM */
    destroy() {
      this.close(false);
      this._teardown();
      this._destroyed = true;
      if (_instances.get(this.img) === this) _instances.delete(this.img);
      this._openBtn?.remove();
      this._showCodeBtn = null;
      if (this._taIdAssigned) { this._ta.removeAttribute('id'); this._taIdAssigned = false; }

      // Restore the textarea's inline style exactly as it was before init.
      // showTextarea: 'optional' → leave it as-is; if the user had it hidden
      //                           via the toggle, it stays hidden.
      if (this._ta && this.opts.showTextarea !== 'optional') {
        // Read it first: Blink/WebKit sync a CSSOM-modified style attribute
        // lazily, and an unsynced one reappears as style="" after removal
        this._ta.getAttribute('style');
        if (this._taStyle === null) this._ta.removeAttribute('style');
        else this._ta.setAttribute('style', this._taStyle);
      }

      // If we wrapped the textarea in a trigger container, move it back out
      if (this._triggerWrap) {
        this._triggerWrap.insertAdjacentElement('beforebegin', this._ta);
        this._triggerWrap.remove();
        this._triggerWrap = null;
      }

      if (this.opts.mode === 'inline' && this._editorEl) {
        // Move the image (or its <picture>) back to its original location
        if (this._inlinePrev) this._inlinePrev.after(this._inlineMoved);
        else this._inlineParent.prepend(this._inlineMoved);
        this._editorEl.remove();
        this._editorEl = null;
      }
    }

    /* =========================================================================
     * Static API
     * ========================================================================= */

    static get version() { return VERSION; }

    /** The editor attached to `img` (element or selector), or null */
    static get(img) {
      if (typeof img === 'string') img = document.querySelector(img);
      return (img && _instances.get(img)) || null;
    }

    /**
     * Keep a published image map lined up with its image at any display size.
     * Browsers apply <area coords> in the image's *rendered* CSS pixels, while
     * kImgMap writes natural pixels; this rescales the <map> the image's
     * `usemap` points to whenever the image is resized.
     *
     * @param {HTMLImageElement|string} img - The <img usemap="#name"> (or selector)
     * @returns {function} stop — disconnects and restores the original coords
     */
    static responsive(img) {
      if (typeof img === 'string') img = document.querySelector(img);
      if (!img) return () => {};
      if (_responsive.has(img)) return _responsive.get(img);   // already active: same stop()
      const name = (img.getAttribute('usemap') || '').replace(/^#/, '');
      const root = img.getRootNode?.() || document;
      const map  = name && root.querySelector(`map[name="${CSS.escape(name)}"], map#${CSS.escape(name)}`);
      if (!map) return () => {};
      const areas = [...map.querySelectorAll('area[coords]')];
      // Originals are kept per area, so a second image sharing the map (or a
      // second call) never scales already-scaled coords
      areas.forEach(a => { if (!_areaCoords.has(a)) _areaCoords.set(a, a.getAttribute('coords')); });
      const orig  = areas.map(a => _areaCoords.get(a));
      const apply = () => {
        const [W, H] = naturalSize(img);
        if (!W || !img.width) return;
        const sx = img.width / W, sy = img.height / H;
        areas.forEach((a, i) => {
          const n = orig[i].split(/[\s,;]+/).filter(Boolean).map(parseFloat);
          const shape = canonShape((a.getAttribute('shape') || '').trim().toLowerCase()) || 'rect';
          const out = shape === 'circle'
            ? [n[0] * sx, n[1] * sy, Math.max(1, n[2] * Math.min(sx, sy))]
            : n.map((v, j) => v * (j % 2 ? sy : sx));
          a.setAttribute('coords', out.map(Math.round).join(','));
        });
      };
      const ro = new ResizeObserver(apply);
      ro.observe(img);
      img.addEventListener('load', apply);
      apply();
      const stop = () => {
        ro.disconnect();
        img.removeEventListener('load', apply);
        _responsive.delete(img);
        areas.forEach((a, i) => a.setAttribute('coords', orig[i]));
      };
      _responsive.set(img, stop);
      return stop;
    }

    /**
     * Auto-initialise all containers matching `selector`.
     * Each container must contain an <img>; a <textarea> is optional.
     *
     * Supported data attributes on the container:
     *   data-kimgmap-mode    — 'modal' | 'inline'
     *   data-kimgmap-shape   — default active shape
     *   data-kimgmap-output  — 'areas' | 'map'
     *
     * @param {string} [selector='[data-kimgmap]']
     * @param {object} [options={}]
     * @returns {kImgMap[]}
     */
    static init(selector = '[data-kimgmap]', options = {}) {
      return Array.from(document.querySelectorAll(selector)).map(root => {
        const img = root.querySelector('img');
        const ta  = root.querySelector('textarea');
        if (!img) return null;
        if (_instances.has(img)) return _instances.get(img);   // already initialised
        return new kImgMap(img, {
          ...options,
          textarea:     ta,
          mode:         root.dataset.kimgmapMode   || options.mode,
          defaultShape: root.dataset.kimgmapShape  || options.defaultShape,
          output:       root.dataset.kimgmapOutput || options.output,
        });
      }).filter(Boolean);
    }
  }

  return kImgMap;

}));
