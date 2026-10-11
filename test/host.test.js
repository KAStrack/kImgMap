/*
 * Living on someone else's page: CSS frameworks, event handlers that stop
 * propagation, touch-screen form zoom — and the drawing UX polish (polygon
 * how-to, drawing over existing areas).
 */
'use strict';
const fs   = require('fs');
const { test, forInputs, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const inline = (opts = {}) => `window.ed = new kImgMap('#img', ${JSON.stringify({ mode: 'inline', ...opts })})`;
const R = '<area shape="rect" coords="100,100,300,250" title="T">';

/* ── CSS frameworks ─────────────────────────────────────────────────────── */

const PICO = fs.readFileSync(require.resolve('@picocss/pico/css/pico.min.css'), 'utf8');
/* The patterns resets like Tailwind's preflight and Bootstrap's reboot use, turned up */
const HOSTILE = `
  *, ::before, ::after { box-sizing: content-box; }
  button, input, select, label, p, h2 { margin: 0 0 24px; padding: 14px; width: 100%; height: 50px; font: 20px/2 serif;
    text-transform: uppercase; letter-spacing: 3px; border: 3px solid red; border-radius: 20px; box-shadow: 0 0 0 5px pink; background: yellow; color: green; }
  input:not([type=checkbox],[type=radio]), select { appearance: none; min-height: 60px; }
  button:focus, input:focus { outline: 0; }
  svg:not(:root) { overflow: hidden; }
  [role=group] { display: inline-block; padding: 30px; }`;

const LAYOUT = ['.kimgmap-open-btn', '.kimgmap-show-code-btn', '.kimgmap-svg', '.kimgmap-toolbar', '.kimgmap-tool[data-tool=rect]', '.kimgmap-tool[data-tool=clear]', '.kimgmap-img-wrap',
  '.kimgmap-sidebar', '.kimgmap-list-item', '[data-attr=title]', 'select.kimgmap-prop-input', '.kimgmap-coords-input', '.kimgmap-prop-label',
  '.kimgmap-del-btn', '.kimgmap-section-title', '.kimgmap-modal-hdr', '.kimgmap-modal-title', '.kimgmap-modal-close', '.kimgmap-save', '.kimgmap-cancel'];
const PROPS = ['fontSize', 'fontFamily', 'textTransform', 'letterSpacing', 'marginBottom', 'boxShadow', 'backgroundColor', 'overflow'];

async function layout(t, hostCSS, mode, order) {
  await t.setup(`<style>*, ::before, ::after { transition: none !important; }</style>${page(R)}`, () => {});
  await t.page.evaluate(([css, order]) => {
    const st = document.createElement('style'); st.textContent = css;
    const plugin = document.querySelector('style');
    if (order === 'after') document.head.append(st); else document.head.insertBefore(st, plugin);
  }, [hostCSS, order]);
  await t.page.evaluate(mode => {
    window.ed = new kImgMap('#img', { mode, showTextarea: 'optional' });
    if (mode === 'modal') ed.open();
  }, mode);
  if (mode === 'modal') await t.settled();
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.focus('[data-attr=title]');   // focus styles too
  return t.page.evaluate(([sel, props]) => Object.fromEntries(sel.map(s => {
    const e = document.querySelector(s);
    if (!e) return [s, null];
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return [s, { w: Math.round(r.width), h: Math.round(r.height), ...Object.fromEntries(props.map(p => [p, cs[p]])),
      ...(s.includes('title]') ? { outline: cs.outlineStyle } : {}), ...(s.startsWith('select') ? { appearance: cs.appearance } : {}) }];
  })), [LAYOUT, PROPS]);
}

for (const mode of ['inline', 'modal']) {
  for (const [name, css] of [['Pico CSS', PICO], ['a hostile reset', HOSTILE]]) {
    test(`${mode}: ${name} on the page does not restyle the editor's controls (loaded before or after kImgMap.css)`, async t => {
      const base = await layout(t, '', mode, 'after');
      // The baseline itself must be the plugin's own styling (the reset mustn't flatten it)
      t.eq(await t.page.evaluate(() => {
        const cs = sel => getComputedStyle(document.querySelector(sel));
        const i = cs('[data-attr=title]'), h = cs('.kimgmap-section-title'), b = cs('.kimgmap-tool[data-tool=rect]');
        return [i.paddingLeft, i.borderTopWidth, h.marginBottom, b.paddingLeft, b.borderTopWidth];
      }), ['8px', '1px', '10px', '9px', '1px'], 'plugin styles win over its own reset');
      for (const order of ['before', 'after']) {
        const got = await layout(t, css, mode, order);
        const diffs = [];
        for (const s of LAYOUT) {
          if (!base[s]) continue;
          for (const [k, v] of Object.entries(base[s])) {
            // The host page's container may change the editor's overall width; nothing else should move
            if (s === '.kimgmap-toolbar' && k === 'w') continue;
            if (s === '.kimgmap-img-wrap' && (k === 'w' || k === 'h')) continue;
            const bad = typeof v === 'number' ? Math.abs(v - got[s][k]) > 1 : v !== got[s][k];
            if (bad) diffs.push(`${s} ${k}: ${v} → ${got[s][k]}`);
          }
        }
        t.eq(diffs, [], `${name} loaded ${order}`);
      }
    }, { timeout: 60000 });
  }
}

test('inline editor is a labelled region (not role=group, which frameworks restyle)', async t => {
  await t.setup(page(), inline());
  t.eq(await t.page.$eval('.kimgmap-editor', e => [e.getAttribute('role'), e.getAttribute('aria-label')]), ['region', 'Image Map Editor']);
  // Several editors are told apart by their image's alt text
  await t.setup(`<div>${IMG.replace('alt=""', 'alt="Floor 1"')}</div><div><img data-test id="img2" alt="Floor 2"></div>`,
    () => { new kImgMap('#img', { mode: 'inline' }); new kImgMap('#img2', { mode: 'inline' }); });
  t.eq(await t.page.$$eval('.kimgmap-editor', e => e.map(x => x.getAttribute('aria-label'))), ['Image Map Editor: Floor 1', 'Image Map Editor: Floor 2']);
  await t.settled();   // no colour transitions mid-flight for the contrast check
  t.eq(await t.axe('body'), []);
});

/* ── Host event handlers ────────────────────────────────────────────────── */

forInputs('a page that stops pointer events from bubbling cannot leave a drag stuck', async t => {
  await t.setup(page(R), inline());
  await t.page.evaluate(() => {
    for (const type of ['pointermove', 'pointerup', 'pointercancel']) {
      document.body.addEventListener(type, e => e.stopPropagation());
      document.addEventListener(type, e => e.stopImmediatePropagation(), true);
    }
  });
  const b = await t.box();
  await t.drag(t.at(b, 200, 175), t.at(b, 260, 215));
  await t.expectHTML('<area shape="rect" coords="160,140,360,290" title="T">', 'the drag moved and ended');
  await t.drag(t.at(b, 500, 300), t.at(b, 600, 380));
  await t.expectHTML('<area shape="rect" coords="160,140,360,290" title="T">\n<area shape="rect" coords="500,300,600,380">', 'the next drag draws normally');
});

/* ── Touch screens ──────────────────────────────────────────────────────── */

test('[touch] property fields use 16px text on touch screens (no iOS zoom on focus)', async t => {
  await t.setup(page(R), inline());
  await t.page.locator('.kimgmap-list-item').click();
  t.eq(await t.page.$$eval('.kimgmap-prop-input', i => [...new Set(i.map(x => getComputedStyle(x).fontSize))]), ['16px']);
}, { input: 'touch' });

test('[mouse] property fields keep compact text with a mouse', async t => {
  await t.setup(page(R), inline());
  await t.page.locator('.kimgmap-list-item').click();
  t.eq(await t.page.$eval('[data-attr=title]', i => getComputedStyle(i).fontSize), '12px');
});

/* ── Polygon how-to ─────────────────────────────────────────────────────── */

test('a how-to line explains the active tool, without moving the image when the tool changes', async t => {
  await t.setup(page(), inline());
  const tip = () => t.page.$eval('.kimgmap-tip', e => [e.getAttribute('aria-hidden'), e.textContent]);
  const top = () => t.page.$eval('.kimgmap-svg', e => e.getBoundingClientRect().top);
  const y0 = await top();
  t.eq(await tip(), ['true', 'Drag to draw a rectangle. Hold Shift to start on top of another area.'], 'rect (hidden from screen readers, which get the live-region hint)');
  // Touch has no Shift: the hint goes while touch is in use
  await t.page.evaluate(() => { ed._coarse = true; ed._updateTip(); });
  t.eq((await tip())[1], 'Drag to draw a rectangle.');
  await t.page.evaluate(() => { ed._coarse = false; ed._updateTip(); });
  await t.tool('poly');
  const text = (await tip())[1];
  t.ok(/first point/i.test(text) && /Enter/.test(text) && /Esc/.test(text), text);
  t.eq(await top(), y0, 'the image did not move');
  await t.tool('circle');
  t.ok(/centre/.test((await tip())[1]));
  await t.tool('select');
  t.ok(/select/i.test((await tip())[1]));
  await t.setup(page(), inline({ labels: { tipRect: 'Custom', tipShift: '' } }));
  t.eq((await tip())[1], 'Custom', 'localisable');
});

forInputs('clicking inside the first-point ring closes the polygon', async t => {
  await t.setup(page(), inline({ defaultShape: 'poly' }));
  const b = await t.box();
  for (const [x, y] of [[100, 100], [300, 100], [200, 300]]) { await t.tap(t.at(b, x, y)); await t.page.waitForTimeout(350); }
  const ring = await t.page.$eval('.kimgmap-preview-start', c => c.getBoundingClientRect().width / 2);
  const dist = ring * 0.8;   // inside the drawn ring, in screen px
  await t.tap([t.at(b, 100, 100)[0] + dist * 0.7, t.at(b, 100, 100)[1] + dist * 0.7]);
  await t.expectHTML('<area shape="poly" coords="100,100,300,100,200,300">', 'closed');
});

/* ── Drawing over existing areas ────────────────────────────────────────── */

forInputs('polygon points can land on existing areas (and their handles)', async t => {
  await t.setup(page(R), inline({ defaultShape: 'poly' }));
  const b = await t.box();
  // first point on empty image, the next two on the rect (one on its se handle)
  for (const [x, y] of [[50, 50], [200, 170], [300, 250], [50, 300]]) { await t.tap(t.at(b, x, y)); await t.page.waitForTimeout(350); }
  await t.tap(t.at(b, 50, 50));
  await t.expectHTML(R + '\n<area shape="poly" coords="50,50,200,170,300,250,50,300">');
});

test('[mouse] Shift+drag on an existing area draws a new shape on top of it', async t => {
  await t.setup(page(R), inline());
  const b = await t.box();
  await t.page.keyboard.down('Shift');
  await t.drag(t.at(b, 150, 150), t.at(b, 250, 220));
  await t.page.keyboard.up('Shift');
  await t.expectHTML(R + '\n<area shape="rect" coords="150,150,250,220">');
  // Without Shift, a drag still moves the area
  await t.drag(t.at(b, 120, 110), t.at(b, 130, 110));
  await t.expectHTML('<area shape="rect" coords="110,100,310,250" title="T">\n<area shape="rect" coords="150,150,250,220">', 'moved');
});

test('[mouse] Shift+click with the polygon tool starts a polygon on an existing area', async t => {
  await t.setup(page(R), inline({ defaultShape: 'poly' }));
  const b = await t.box();
  await t.page.keyboard.down('Shift');
  await t.page.mouse.click(...t.at(b, 150, 150));
  await t.page.keyboard.up('Shift');
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 1, 'polygon started');
  t.eq(await t.page.$$eval('.kimgmap-ag.is-selected', e => e.length), 0, 'the area was not selected');
});
