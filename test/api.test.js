/* Public API hardening: setAreas() validation, attribute names, one editor per image, callback copies, theme/className */
'use strict';
const { test, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const inline = (opts = {}) => `window.ed = new kImgMap('#img', ${JSON.stringify({ mode: 'inline', ...opts })})`;
const warnings = t => { const w = []; t.page.on('console', m => { if (m.type() === 'warning') w.push(m.text()); }); return w; };

/* ── setAreas() ─────────────────────────────────────────────────────────── */

test('setAreas() validates its input: bad areas are skipped with a warning, ids made unique strings', async t => {
  await t.setup(page(), inline());
  const warned = warnings(t);
  t.eq(await t.page.evaluate(() => { try { ed.setAreas('nope'); return 'no throw'; } catch (e) { return [e.constructor.name, /expects an array/.test(e.message)]; } }), ['TypeError', true], 'non-array throws a clear TypeError');
  await t.page.evaluate(() => ed.setAreas([
    { shape: 'rect', coords: [50, 60, 10, 20], id: 7, attrs: { title: 'A' }, note: 'kept' },   // reversed corners, numeric id
    { shape: 'circle', coords: '100,100,20', id: 7 },                                          // string coords, duplicate id
    { shape: 'polygon', coords: [1, 1, 50, 1, 25, 40, 99] },                                   // alias, odd count trimmed
    { shape: 'rect', coords: [1, 2, 3] },                                                       // too few
    { shape: 'star', coords: [1, 2, 3, 4] },                                                    // unknown shape
    { shape: 'rect' },                                                                          // no coords
    { shape: 'rect', coords: [1, 2, 'x', 4] },                                                  // non-numeric
    null, 42,
  ]));
  await t.expectHTML('<area shape="rect" coords="10,20,50,60" title="A">\n<area shape="circle" coords="100,100,20">\n<area shape="poly" coords="1,1,50,1,25,40">', 'valid areas only', { tol: 0 });
  t.eq(warned.filter(w => /setAreas\(\) skipped area/.test(w)).length, 6, 'one warning per skipped area: ' + warned.join(' / '));
  const areas = await t.page.evaluate(() => ed.getAreas());
  t.eq(areas[0].id, '7', 'numeric id became a string');
  t.ok(areas[1].id !== '7' && typeof areas[1].id === 'string', 'duplicate id replaced');
  t.eq(areas[0].note, 'kept', 'extra properties are kept');
  // Selecting works with the (formerly numeric) id
  await t.page.locator('.kimgmap-list-item').first().click();
  t.eq(await t.page.$eval('.kimgmap-ag.is-selected', g => g.dataset.id), '7');
});

/* ── Attribute names ────────────────────────────────────────────────────── */

test('attribute names that would break the <area> tag are never written', async t => {
  await t.setup(page(), inline({ customAttributes: ['data-ok', 'bad name', 'x"y'], outputAttributes: null }));
  const warned = warnings(t);
  await t.page.evaluate(() => ed.setAreas([{ shape: 'rect', coords: [1, 1, 20, 20], attrs: {
    'x onmouseover=alert(1) y': 'v', 'a>b': 'v', 'a/b': 'v', 'a=b': 'v', "a'b": 'v', '': 'v', shape: 'circle', coords: '9', 'data-ok': '1', nohref: '', title: null,
  } }]));
  await t.expectHTML('<area shape="rect" coords="1,1,20,20" data-ok="1" nohref="">', 'only writable names', { tol: 0 });
  t.eq(await t.page.evaluate(() => Object.keys(ed.getAreas()[0].attrs)), ['data-ok', 'nohref'], 'not stored either');
  // The panel only shows valid custom fields; the rejected ones were warned about at construction
  await t.page.locator('.kimgmap-list-item').first().click();
  t.eq(await t.page.$$eval('[data-attr]', f => f.map(x => x.dataset.attr)), ['href', 'alt', 'title', 'target', 'data-ok']);
  t.eq(warned.length, 0, 'warnings came at construction, before this listener: ' + warned);
});

test('the output never contains an unwritable name, even when areas or options are changed directly', async t => {
  await t.setup(page('<area shape="rect" coords="1,1,20,20" title="T">'), inline({ outputAttributes: null }));
  t.eq(await t.page.evaluate(() => {
    ed.areas[0].attrs['x onclick=alert(1) y'] = 'v';            // this.areas is public
    const a = ed.getHTML();
    ed.opts.outputAttributes = ['title', 'on click', 'alt'];    // and so are the options
    return [a, ed.getHTML()];
  }), ['<area shape="rect" coords="1,1,20,20" title="T">', '<area shape="rect" coords="1,1,20,20" title="T" alt="">']);
});

test('invalid attribute options are dropped with a warning; outputAttributes skips them too', async t => {
  const warned = [];
  t.page.on('console', m => { if (m.type() === 'warning') warned.push(m.text()); });
  await t.setup(page('<area shape="rect" coords="1,1,20,20" title="T">'), inline({
    customAttributes: [{ attr: 'bad name' }, { label: 'no attr' }, 'data-x'], outputAttributes: ['title', 'on click', 'alt'], shapes: ['rect', 'hexagon'],
  }));
  t.eq(await t.page.evaluate(() => ed.getHTML()), '<area shape="rect" coords="1,1,20,20" title="T" alt="">', 'invalid outputAttributes skipped');
  t.eq(await t.page.$$eval('.kimgmap-tool', b => b.map(x => x.dataset.tool)).then(x => x.includes('hexagon')), false, 'unknown shape tool dropped');
  t.eq(warned.length, 4, 'warned: ' + warned.join(' / '));
});

test('onAttributeChange overrides with unwritable names are ignored', async t => {
  await t.setup(page('<area shape="rect" coords="1,1,20,20">'), () => {
    window.ed = new kImgMap('#img', { mode: 'inline', onAttributeChange: (a, attr, v) => ({ 'x onclick=alert(1)': v, alt: v }) });
  });
  await t.page.locator('.kimgmap-list-item').first().click();
  await t.page.fill('[data-attr="title"]', 'Hi');
  await t.expectHTML('<area shape="rect" coords="1,1,20,20" title="Hi" alt="Hi">', 'valid override applied, invalid one dropped', { tol: 0 });
  t.eq(await t.page.evaluate(() => Object.keys(ed.getAreas()[0].attrs)), ['title', 'alt'], 'not stored either');
});

/* ── One editor per image ───────────────────────────────────────────────── */

test('an image can only have one editor; kImgMap.get() returns it; destroy() frees the image', async t => {
  await t.setup(page(), inline());
  const r = await t.page.evaluate(() => {
    const out = {};
    try { new kImgMap('#img', { mode: 'inline' }); out.second = 'created'; } catch (e) { out.second = e.message; }
    out.editors = document.querySelectorAll('.kimgmap-editor').length;
    out.get = kImgMap.get('#img') === ed && kImgMap.get(document.getElementById('img')) === ed;
    out.none = kImgMap.get('#nope');
    ed.destroy();
    out.afterDestroy = kImgMap.get('#img');
    window.ed2 = new kImgMap('#img', { mode: 'inline' });
    out.again = kImgMap.get('#img') === ed2;
    return out;
  });
  t.ok(/already has an editor/.test(r.second), r.second);
  t.eq([r.editors, r.get, r.none, r.afterDestroy, r.again], [1, true, null, null, true]);
});

test('kImgMap.init() twice does not add a second editor; open() after destroy() does nothing', async t => {
  await t.setup(`<div data-kimgmap>${IMG}<textarea id="ta"></textarea></div>`, () => { window.a = kImgMap.init(); });
  const r = await t.page.evaluate(() => {
    const b = kImgMap.init();
    const out = [b.length, b[0] === a[0], document.querySelectorAll('.kimgmap-open-btn').length];
    a[0].destroy();
    a[0].open();
    out.push(document.querySelectorAll('.kimgmap-overlay').length);
    return out;
  });
  t.eq(r, [1, true, 1, 0]);
});

/* ── Callbacks get copies ───────────────────────────────────────────────── */

test('callbacks receive copies: mutating them does not change the editor', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50" title="A">'), () => {
    window.seen = {};
    window.ed = new kImgMap('#img', {
      onUpdate(html, areas) { seen.update = areas !== ed.areas; areas[0].coords[0] = 999; areas.length = 0; },
      onAttributeChange(area) { seen.attr = !ed.areas.includes(area); area.coords[0] = 555; area.attrs.title = 'hacked'; },
      onSave(html, areas) { seen.save = areas !== ed.areas; areas[0].attrs.alt = 'hacked'; },
    });
  });
  await t.openModal();
  await t.page.locator('.kimgmap-list-item').first().click();
  await t.page.fill('[data-attr="alt"]', 'x');
  await t.page.click('.kimgmap-save');
  await t.settled();
  t.eq(await t.page.evaluate(() => [seen, ed.getAreas()[0].coords, ed.getAreas()[0].attrs]),
    [{ attr: true, update: true, save: true }, [10, 10, 50, 50], { title: 'A', alt: 'x' }]);
  await t.expectHTML('<area shape="rect" coords="10,10,50,50" title="A" alt="x">', 'output unaffected', { tol: 0 });
});

/* ── theme / className ──────────────────────────────────────────────────── */

const bg = (t, sel) => t.page.$eval(sel, el => getComputedStyle(el).getPropertyValue('--kimgmap-bg').trim());

test("theme: 'dark' / 'light' set the palette on the inline editor and on the modal", async t => {
  await t.setup(`<div>${IMG}<textarea id="ta"></textarea></div><div><img data-test id="img2" alt=""></div>`, () => {
    window.a = new kImgMap('#img', { mode: 'inline', theme: 'dark' });
    window.b = new kImgMap('#img2', { theme: 'dark' });
  });
  t.eq(await t.page.$eval('.kimgmap-editor', e => e.dataset.theme), 'dark');
  t.eq(await bg(t, '.kimgmap-editor'), '#0f172a');
  await t.openModal();
  t.eq(await t.page.$eval('.kimgmap-overlay', e => e.dataset.theme), 'dark');
  t.eq(await bg(t, '.kimgmap-modal'), '#0f172a', 'modal is dark from the first frame');
  // 'light' wins over a page that made its own tokens dark
  await t.page.keyboard.press('Escape'); await t.settled();
  await t.page.evaluate(() => {
    a.destroy();
    document.head.insertAdjacentHTML('beforeend', '<style>:root { --kimgmap-bg: #000000; }</style>');
    window.c = new kImgMap('#img', { mode: 'inline', theme: 'light' });
  });
  t.eq(await bg(t, '.kimgmap-editor'), '#ffffff');
});

test("theme: 'auto' follows the OS setting, live", async t => {
  await t.page.emulateMedia({ colorScheme: 'light' });
  await t.setup(page(), inline({ theme: 'auto' }));
  t.eq(await t.page.$eval('.kimgmap-editor', e => e.dataset.theme), 'light');
  await t.page.emulateMedia({ colorScheme: 'dark' });
  await t.page.waitForFunction(() => document.querySelector('.kimgmap-editor').dataset.theme === 'dark', null, { timeout: 3000 });
  t.eq(await bg(t, '.kimgmap-editor'), '#0f172a');
  // destroy() removes the listener (a later change doesn't touch the removed editor)
  await t.page.evaluate(() => { window.gone = document.querySelector('.kimgmap-editor'); ed.destroy(); });
  await t.page.emulateMedia({ colorScheme: 'light' });
  await t.page.evaluate(() => new Promise(r => setTimeout(r, 100)));
  t.eq(await t.page.evaluate(() => gone.dataset.theme), 'dark');
});

test('className scopes a custom theme to one instance, modal included, and wins over theme: dark', async t => {
  await t.setup(`<style>.brand { --kimgmap-bg: #123456; --kimgmap-primary: #4f46e5; }</style>${page()}<div><img data-test id="img2" alt=""></div>`, () => {
    window.a = new kImgMap('#img', { mode: 'inline', className: 'brand extra', theme: 'dark' });
    window.b = new kImgMap('#img2', { className: 'brand', theme: 'dark' });
  });
  t.eq(await t.page.$eval('.kimgmap-editor', e => [e.classList.contains('brand'), e.classList.contains('extra')]), [true, true]);
  t.eq(await bg(t, '.kimgmap-editor'), '#123456', 'custom token beats the dark palette');
  t.eq(await t.page.$eval('.kimgmap-editor', e => getComputedStyle(e).getPropertyValue('--kimgmap-text').trim()), '#f1f5f9', 'other dark tokens still apply');
  await t.openModal();
  t.eq(await t.page.$eval('.kimgmap-overlay', e => e.classList.contains('brand')), true);
  t.eq(await bg(t, '.kimgmap-modal'), '#123456');
});

test('areas with extra properties that are not serialisable (e.g. cycles) still edit and undo', async t => {
  await t.setup(page(), inline());
  await t.page.evaluate(() => {
    const meta = {}; meta.self = meta;
    ed.setAreas([{ shape: 'rect', coords: [10, 10, 50, 50], meta }]);
  });
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.fill('[data-attr="title"]', 'T');
  await t.expectHTML('<area shape="rect" coords="10,10,50,50" title="T">', 'edits still sync', { tol: 0 });
  await t.tool('undo');
  await t.expectHTML('<area shape="rect" coords="10,10,50,50">', 'and undo', { tol: 0 });
});
