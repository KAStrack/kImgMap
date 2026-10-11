/* Toolbar, sidebar, keyboard shortcuts, options, lifecycle */
'use strict';
const { test, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const inline = (opts = {}) => `window.ed = new kImgMap('#img', ${JSON.stringify({ mode: 'inline', ...opts })})`;

/* ── Toolbar & sidebar ───────────────────────────────────────────────────── */

test('duplicate, delete and clear all (toolbar)', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200" alt="x">'), inline());
  await t.page.click('.kimgmap-list-item');
  await t.tool('duplicate');
  t.eq(await t.html(), '<area shape="rect" coords="100,100,200,200" alt="x">\n<area shape="rect" coords="110,110,210,210" alt="x">');
  await t.tool('delete');
  t.eq(await t.html(), '<area shape="rect" coords="100,100,200,200" alt="x">');
  t.eq(await t.page.$eval('[data-tool=duplicate]', b => b.disabled), true, 'duplicate disabled with no selection');
  await t.tool('clear');
  await t.tapEl('.kimgmap-confirm-yes');
  t.eq(await t.html(), '');
});

test('clear all asks in the editor (no window.confirm); Cancel and Escape keep the areas', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  t.page.on('dialog', d => { throw new Error('a native dialog was opened: ' + d.message()); });
  await t.tool('clear');
  const bar = () => t.page.$eval('.kimgmap-confirm', b => [b.hidden, b.getAttribute('role'), b.textContent.replace(/\s+/g, ' ').trim()]);
  t.eq(await bar(), [false, 'alertdialog', 'Clear all areas? Cancel Clear All']);
  t.eq(await t.page.$$eval('.kimgmap-editor > *', els => els.filter(e => e.inert).map(e => e.className)),
    ['kimgmap-toolbar', 'kimgmap-validation-banner', 'kimgmap-tip', 'kimgmap-canvas', ''], 'the rest of the editor is inert (not the live region)');
  await t.tapEl('.kimgmap-confirm-no');
  t.eq((await bar())[0], true, 'Cancel hides it');
  t.eq(await t.html(), '<area shape="rect" coords="100,100,200,200">');
  t.eq(await t.page.$$eval('.kimgmap-editor [inert]', e => e.length), 0, 'nothing left inert');
  await t.tool('clear');
  await t.page.keyboard.press('Escape');
  t.eq((await bar())[0], true, 'Escape hides it');
  t.eq(await t.page.evaluate(() => document.activeElement.dataset.tool), 'clear', 'focus returns to Clear All');
  t.eq(await t.html(), '<area shape="rect" coords="100,100,200,200">');
});

test('sidebar Delete Area button removes the selected area', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  await t.page.click('.kimgmap-list-item');
  await t.page.click('.kimgmap-del-btn');
  t.eq(await t.html(), '');
  t.eq(await t.page.$eval('.kimgmap-props', p => p.hidden), true, 'props hidden');
});

test('shapes option limits the toolbar; invalid defaultShape falls back to select', async t => {
  await t.setup(page(), inline({ shapes: ['circle'], defaultShape: 'rect' }));
  t.eq(await t.page.$$eval('.kimgmap-tool', b => b.map(x => x.dataset.tool)), ['select', 'circle', 'undo', 'redo', 'duplicate', 'delete', 'clear']);
  t.eq(await t.page.$eval('.kimgmap-tool.is-active', b => b.dataset.tool), 'select');
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  t.eq(await t.html(), '', 'no rect drawn');
});

test('showAttributePanel: false hides the properties panel', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline({ showAttributePanel: false }));
  await t.page.click('.kimgmap-list-item');
  t.eq(await t.page.$eval('.kimgmap-props', p => p.hidden), true);
});

test('area list label falls back alt → href → "Shape N" (localised shape label)', async t => {
  await t.setup(page('<area shape="rect" coords="1,1,9,9" alt="A" href="/h">\n<area shape="rect" coords="1,1,9,9" href="/h">\n<area shape="circle" coords="50,50,5">'), inline());
  t.eq(await t.page.$$eval('.kimgmap-list-label', l => l.map(x => x.textContent)), ['A', '/h', 'Circle 3']);
});

/* ── Keyboard ────────────────────────────────────────────────────────────── */

test('inline: Delete and Ctrl/Cmd+D work while the editor has focus', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  await t.page.click('.kimgmap-list-item');
  await t.page.keyboard.press('Control+d');
  t.eq(await t.page.evaluate(() => ed.areas.length), 2, 'ctrl+d duplicated');
  await t.page.keyboard.press('Control+Shift+D');
  t.eq(await t.page.evaluate(() => ed.areas.length), 3, 'ctrl+shift+d duplicated');
  await t.page.keyboard.press('Delete');
  t.eq(await t.page.evaluate(() => ed.areas.length), 2, 'delete removed');
});

test('inline: shortcuts are ignored when focus is elsewhere or in a text field', async t => {
  await t.setup(`<input id="other">${page('<area shape="rect" coords="10,10,50,50">')}`, inline());
  await t.page.click('.kimgmap-list-item');
  await t.page.focus('#other');
  await t.page.keyboard.press('Delete');
  t.eq(await t.page.evaluate(() => ed.areas.length), 1, 'focus outside editor');
  await t.page.click('.kimgmap-list-item');
  await t.page.click('[data-attr="href"]');
  await t.page.keyboard.press('Backspace');
  t.eq(await t.page.evaluate(() => ed.areas.length), 1, 'focus in a property field');
});

test('inline: Escape cancels an in-progress polygon', async t => {
  await t.setup(page(), inline());
  await t.tool('poly');
  const b = await t.box();
  await t.page.mouse.click(...t.at(b, 100, 100)); await t.page.waitForTimeout(350);
  await t.page.mouse.click(...t.at(b, 300, 100));
  await t.page.keyboard.press('Escape');
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 0, 'preview removed');
  // The next clicks start a fresh polygon that doesn't include the cancelled points
  for (const [x, y] of [[500, 100], [700, 100], [600, 300], [500, 100]]) await t.page.mouse.click(...t.at(b, x, y));
  await t.expectHTML('<area shape="poly" coords="500,100,700,100,600,300">');
});

/* ── Lifecycle ───────────────────────────────────────────────────────────── */

test('destroy() restores inline DOM', async t => {
  await t.setup(`<div id="c"><p>before</p>${IMG}<textarea id="ta"></textarea></div>`, () => {
    window.before = document.getElementById('c').innerHTML;
    window.ed = new kImgMap('#img', { mode: 'inline' });
  });
  const r = await t.page.evaluate(() => { ed.destroy(); return [document.getElementById('c').innerHTML.replace(/ style="[^"]*"/g, ''), before.replace(/ style="[^"]*"/g, '')]; });
  t.eq(r[0], r[1]);
  t.eq(await t.page.$$eval('.kimgmap-editor', e => e.length), 0);
});

test('destroy() restores modal DOM (showTextarea variants)', async t => {
  for (const st of [false, true, 'optional']) {
    await t.setup(`<div id="c">${IMG}<textarea id="ta"></textarea></div>`, `window.ed = new kImgMap('#img', { showTextarea: ${JSON.stringify(st)} })`);
    const r = await t.page.evaluate(() => { ed.destroy(); return [document.querySelectorAll('.kimgmap-open-btn,.kimgmap-trigger-wrap,.kimgmap-show-code-btn').length, document.getElementById('ta').parentElement.id]; });
    t.eq(r, [0, 'c'], `showTextarea=${st}`);
  }
});

test('destroy() removes document listeners (no errors on later input)', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img', { mode: 'inline' }); ed.destroy(); });
  await t.page.mouse.move(10, 10); await t.page.mouse.down(); await t.page.mouse.move(50, 50); await t.page.mouse.up();
  await t.page.keyboard.press('Delete');
  t.eq(await t.errors(), []);
});

test('close() on an inline editor is a no-op and keeps it working', async t => {
  await t.setup(page(), () => { window.closeCount = 0; window.ed = new kImgMap('#img', { mode: 'inline', onClose: () => closeCount++ }); ed.close(); });
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  await t.expectHTML('<area shape="rect" coords="100,100,300,250">');
  t.eq(await t.page.evaluate(() => closeCount), 0, 'onClose not fired');
});

test('showTextarea: "optional" toggles the textarea', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img', { showTextarea: 'optional' }); });
  const vis = () => t.page.$eval('#ta', e => getComputedStyle(e).display !== 'none');
  t.eq(await vis(), false, 'hidden initially');
  await t.page.click('.kimgmap-show-code-btn');
  t.eq(await vis(), true, 'shown');
  t.eq(await t.page.$eval('.kimgmap-show-code-btn', b => b.textContent), 'Hide Code');
});

test('auto-init respects default shape when no data attr given', async t => {
  await t.setup(`<div data-kimgmap data-kimgmap-mode="inline">${IMG}<textarea id="ta"></textarea></div>`, () => { window.eds = kImgMap.init(); });
  t.eq(await t.page.evaluate(() => [eds.length, eds[0].opts.defaultShape, eds[0].opts.output, document.querySelector('.kimgmap-tool.is-active')?.dataset.tool]), [1, 'rect', 'areas', 'rect']);
});

test('auto-init reads data-kimgmap-shape / -output', async t => {
  await t.setup(`<div data-kimgmap data-kimgmap-mode="inline" data-kimgmap-shape="circle" data-kimgmap-output="map">${IMG}<textarea id="ta"></textarea></div>`, () => { window.eds = kImgMap.init(); });
  t.eq(await t.page.evaluate(() => [document.querySelector('.kimgmap-tool.is-active')?.dataset.tool, eds[0].getHTML()]), ['circle', '<map name="imagemap">\n\n</map>']);
});

test('image not yet loaded at construction (inline)', async t => {
  await t.page.setContent(`<!doctype html><html><head><style>${t.CSS}</style></head><body><div><img id="img" style="width:400px;height:200px;display:block"><textarea id="ta"><area shape="rect" coords="10,10,50,50"></textarea></div></body></html>`);
  await t.page.addScriptTag({ content: t.JS });
  await t.page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 400;
    window.ed = new kImgMap('#img', { mode: 'inline' });
    document.getElementById('img').src = c.toDataURL();
  });
  await t.page.waitForTimeout(200);
  t.eq(await t.page.evaluate(() => [document.querySelector('.kimgmap-svg').getAttribute('viewBox'), document.querySelectorAll('.kimgmap-ag').length]), ['0 0 800 400', 1]);
});

test('handles keep a constant on-screen size after the editor is resized', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">'), inline());
  const r1 = await t.page.evaluate(() => { const h = document.querySelector('.kimgmap-handle'); return h.getBoundingClientRect().width; });
  await t.page.evaluate(() => { document.getElementById('img').style.width = '800px'; document.getElementById('img').style.height = '400px'; });
  await t.page.waitForTimeout(200);
  const r2 = await t.page.evaluate(() => document.querySelector('.kimgmap-handle').getBoundingClientRect().width);
  t.ok(Math.abs(r1 - r2) <= 2, `handle size ${r1} → ${r2}`);
});

/* ── Properties panel ───────────────────────────────────────────────────── */

test('after typing in a field, one click on another list item selects it', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50" alt="A">\n<area shape="rect" coords="100,100,150,150" alt="B">'), inline());
  await t.page.locator('.kimgmap-list-item').nth(0).click();
  await t.page.fill('[data-attr="title"]', 'typed');
  await t.page.locator('.kimgmap-list-item').nth(1).click();   // blurs the field first
  t.eq(await t.page.$eval('.kimgmap-list-item.is-active .kimgmap-list-label', l => l.textContent), 'B');
});

test('onUpdate and onAttributeChange fire once per edit (not again on blur)', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'),
    () => { window.n = { update: 0, attr: 0 }; window.ed = new kImgMap('#img', { mode: 'inline', onUpdate: () => n.update++, onAttributeChange: () => { n.attr++; } }); });
  await t.page.click('.kimgmap-list-item');
  await t.page.click('[data-attr="href"]');
  await t.page.keyboard.type('ab');
  await t.page.click('.kimgmap-section-title');   // blur → 'change'
  await t.page.selectOption('[data-attr="target"]', '_blank');
  t.eq(await t.page.evaluate(() => n), { update: 3, attr: 3 });
});
