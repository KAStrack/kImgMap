/* Paths that used to lose the user's work */
'use strict';
const { test, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const ORIG = '<area shape="rect" coords="10,10,50,50">';

/* ── Closing the modal ──────────────────────────────────────────────────── */

test('Escape in a property field leaves the field, not the modal', async t => {
  await t.setup(page(ORIG), () => { window.ed = new kImgMap('#img'); });
  await t.openModal();
  await t.page.click('.kimgmap-list-item');
  await t.page.fill('[data-attr="title"]', 'Typed');
  await t.page.keyboard.press('Escape');
  await t.settled();
  t.eq(await t.page.evaluate(() => [document.querySelectorAll('.kimgmap-overlay').length, document.activeElement?.dataset?.attr ?? null,
    !!document.activeElement?.closest('.kimgmap-modal'), document.querySelector('.kimgmap-discard').hidden]),
    [1, null, true, true], '[open, focused field, focus inside modal, no discard prompt]');
  t.eq(await t.html(), '<area shape="rect" coords="10,10,50,50" title="Typed">', 'edit kept');
});

test('Escape, × and backdrop ask before discarding unsaved changes', async t => {
  await t.setup(page(ORIG), () => { window.closes = []; window.ed = new kImgMap('#img', { onClose: s => closes.push(s) }); });
  const prompt = () => t.page.evaluate(() => { const p = document.querySelector('.kimgmap-discard'); return !!p && !p.hidden; });
  for (const how of ['Escape', '×', 'backdrop']) {
    await t.openModal();
    await t.page.click('.kimgmap-list-item'); await t.page.keyboard.press('Delete');   // an unsaved change
    if (how === 'Escape') await t.page.keyboard.press('Escape');
    else if (how === '×') await t.page.click('.kimgmap-modal-close');
    else await t.page.mouse.click(5, 5);
    t.eq(await prompt(), true, `${how}: prompt shown`);
    t.eq(await t.page.evaluate(() => document.activeElement?.classList.contains('kimgmap-discard-keep')), true, `${how}: focus on Keep editing`);
    await t.page.click('.kimgmap-discard-keep');
    t.eq(await t.page.evaluate(() => [document.querySelectorAll('.kimgmap-overlay').length, ed.areas.length]), [1, 0], `${how}: kept editing`);
    if (how === 'Escape') await t.page.keyboard.press('Escape');
    else if (how === '×') await t.page.click('.kimgmap-modal-close');
    else await t.page.mouse.click(5, 5);
    await t.page.click('.kimgmap-discard-confirm');
    await t.settled();
    t.eq(await t.html(), ORIG, `${how}: discarded`);
  }
  t.eq(await t.page.evaluate(() => closes), [false, false, false]);
});

test('Escape while the discard prompt is showing means "keep editing"', async t => {
  await t.setup(page(ORIG), () => { window.ed = new kImgMap('#img'); });
  await t.openModal();
  await t.page.click('.kimgmap-list-item'); await t.page.keyboard.press('Delete');
  await t.page.keyboard.press('Escape');
  await t.page.keyboard.press('Escape');
  await t.settled();
  t.eq(await t.page.evaluate(() => [document.querySelectorAll('.kimgmap-overlay').length, document.querySelector('.kimgmap-discard').hidden]), [1, true]);
});

test('closing without changes, or with Cancel, does not ask', async t => {
  await t.setup(page(ORIG), () => { window.closes = []; window.ed = new kImgMap('#img', { onClose: s => closes.push(s) }); });
  await t.openModal();
  await t.page.keyboard.press('Escape'); await t.settled();          // no changes
  await t.openModal();
  await t.page.click('.kimgmap-list-item'); await t.page.keyboard.press('Delete');
  await t.page.click('.kimgmap-cancel'); await t.settled();      // Cancel = explicit discard
  t.eq(await t.page.evaluate(() => [closes, document.querySelectorAll('.kimgmap-overlay').length]), [[false, false], 0]);
  t.eq(await t.html(), ORIG);
});

test('confirmDiscard: false closes without asking', async t => {
  await t.setup(page(ORIG), () => { window.ed = new kImgMap('#img', { confirmDiscard: false }); });
  await t.openModal();
  await t.page.click('.kimgmap-list-item'); await t.page.keyboard.press('Delete');
  await t.page.keyboard.press('Escape'); await t.settled();
  t.eq(await t.page.evaluate(() => document.querySelectorAll('.kimgmap-overlay').length), 0);
  t.eq(await t.html(), ORIG);
});

/* ── Saving ─────────────────────────────────────────────────────────────── */

test('calling destroy() or close() inside onSave keeps the save', async t => {
  for (const call of ['destroy', 'close']) {
    await t.setup(page(ORIG), `window.log = []; window.ed = new kImgMap('#img', { onSave() { log.push('save'); this.${call}(); }, onClose: s => log.push('close:' + s) });`);
    await t.openModal();
    await t.page.evaluate(() => ed.setAreas([...ed.getAreas(), { shape: 'rect', coords: [200, 200, 300, 300], attrs: {} }]));
    await t.page.click('.kimgmap-save'); await t.settled();
    t.eq(await t.page.evaluate(() => log), ['save', 'close:true'], call);
    t.eq(await t.html(), `${ORIG}\n<area shape="rect" coords="200,200,300,300">`, call);
  }
});

/* ── Round-trip fidelity ────────────────────────────────────────────────── */

test('saving without edits keeps empty attributes, nohref, and areas it cannot edit', async t => {
  const src = [
    '<area shape="rect" coords="10,10,50,50" href="/a" alt="">',
    '<area shape="rect" coords="60,10,90,50" nohref="" alt="dead">',
    '<area shape="rect" coords="1,2">',
    '<area shape="default" href="/elsewhere" alt="Everything else">',
  ];
  await t.setup(page(src.join('\n')), () => { window.ed = new kImgMap('#img'); });
  await t.openModal();
  await t.page.click('.kimgmap-save'); await t.settled();
  t.eq(await t.html(), src.join('\n'));
});

test('the <map name> from the textarea is kept when mapName is not set', async t => {
  await t.setup(page('<map name="floorplan"><area shape="rect" coords="10,10,50,50"></map>'),
    () => { window.ed = new kImgMap('#img', { mode: 'inline', output: 'map' }); });
  t.eq(await t.page.evaluate(() => ed.getHTML()), '<map name="floorplan">\n<area shape="rect" coords="10,10,50,50">\n</map>');
});

test('clearing a field removes the attribute; new areas carry no empty attributes', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50" href="/a" alt="A">'), () => { window.ed = new kImgMap('#img', { mode: 'inline' }); });
  await t.page.click('.kimgmap-list-item');
  await t.page.fill('[data-attr="href"]', '');
  t.eq(await t.html(), '<area shape="rect" coords="10,10,50,50" alt="A">');
  const b = await t.box();
  await t.drag(t.at(b, 200, 200), t.at(b, 300, 300));
  t.eq(await t.page.evaluate(() => ed.getAreas()[1].attrs), {});
});

/* ── Geometry ───────────────────────────────────────────────────────────── */

for (const dpr of [1, 2]) {
  test(`srcset images: modal coords use the page image's natural size (DPR ${dpr})`, async t => {
    await t.setup('<div><img id="img" style="width:400px"><textarea id="ta"></textarea></div>');
    await t.page.evaluate(async () => {
      const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c.toDataURL(); };
      const img = document.getElementById('img');
      await new Promise(r => { img.onload = r; img.srcset = `${mk(400, 200)} 1x, ${mk(800, 400)} 2x`; });
      window.ed = new kImgMap(img); ed.open();
    });
    await t.settled();
    t.eq(await t.page.evaluate(() => [document.getElementById('img').naturalWidth, document.querySelector('.kimgmap-svg').getAttribute('viewBox')]), [400, '0 0 400 200']);
  }, { deviceScaleFactor: dpr });
}

/* ── Host page integration ──────────────────────────────────────────────── */

test('Enter in a property field does not submit the host page\'s form', async t => {
  await t.setup(`<form id="f">${page(ORIG)}<button>Publish</button></form>`, () => {
    window.submits = 0;
    document.getElementById('f').addEventListener('submit', e => { e.preventDefault(); submits++; });
    window.ed = new kImgMap('#img', { mode: 'inline' });
  });
  await t.page.click('.kimgmap-list-item');
  await t.page.fill('[data-attr="title"]', 'x');
  await t.page.keyboard.press('Enter');
  t.eq(await t.page.evaluate(() => submits), 0);
});

/* ── Follow-ups from review ─────────────────────────────────────────────── */

for (const mode of ['modal', 'inline']) {
  test(`w-descriptor srcset (${mode}): coordinate space is the largest candidate, stable across resizes`, async t => {
    await t.setup(`<div><img id="img" sizes="50vw" style="width:400px"><textarea id="ta"></textarea></div>`);
    await t.page.evaluate(async m => {
      const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c.toDataURL(); };
      const img = document.getElementById('img');
      await new Promise(r => { img.onload = r; img.srcset = `${mk(800, 400)} 800w, ${mk(1600, 800)} 1600w`; });
      window.ed = new kImgMap(img, { mode: m }); if (m === 'modal') ed.open();
    }, mode);
    await t.settled();
    const vb = () => t.page.$eval('.kimgmap-svg', s => s.getAttribute('viewBox'));
    t.eq(await vb(), '0 0 1600 800', 'initial');
    await t.page.setViewportSize({ width: 700, height: 900 });
    await t.page.waitForTimeout(200);
    t.eq(await vb(), '0 0 1600 800', 'after resize');
  });
}

test('if onSave throws, the session is still unsaved (× asks, Discard restores)', async t => {
  await t.setup(page(ORIG), () => { window.ed = new kImgMap('#img', { onSave() { throw new Error('save failed'); } }); });
  await t.openModal();
  await t.page.click('.kimgmap-list-item'); await t.page.keyboard.press('Delete');
  await t.page.click('.kimgmap-save');
  await t.page.click('.kimgmap-modal-close');
  t.eq(await t.page.evaluate(() => !document.querySelector('.kimgmap-discard').hidden), true, 'prompt shown');
  await t.page.click('.kimgmap-discard-confirm'); await t.settled();
  t.eq(await t.html(), ORIG);
}, { allowErrors: [/save failed/] });

test('non-editable areas follow outputAttributes and survive setAreas(getAreas())', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50" href="#a" onclick="x()">\n<area shape="default" href="#d" onclick="track()" data-secret="2">'),
    () => { window.ed = new kImgMap('#img', { mode: 'inline', outputAttributes: ['href', 'alt'] }); });
  const expected = '<area shape="rect" coords="10,10,50,50" href="#a" alt="">\n<area shape="default" href="#d" alt="">';
  t.eq(await t.page.evaluate(() => ed.getHTML()), expected, 'allowlist applied to both');
  t.eq(await t.page.evaluate(() => { ed.setAreas(ed.getAreas()); return ed.getHTML(); }), expected, 'kept by setAreas');
});

test('areas loaded in onOpen do not count as unsaved changes', async t => {
  await t.setup(page(ORIG), () => { window.ed = new kImgMap('#img', { onOpen() { this.setAreas([{ shape: 'circle', coords: [100, 100, 20], attrs: {} }]); } }); });
  await t.openModal();
  await t.page.click('.kimgmap-modal-close'); await t.settled();
  t.eq(await t.page.evaluate(() => document.querySelectorAll('.kimgmap-overlay').length), 0, 'closed without asking');
});

test('while the discard prompt is showing, the editor behind it is inert', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">\n<area shape="rect" coords="100,100,150,150">'), () => { window.ed = new kImgMap('#img'); });
  await t.openModal();
  await t.page.locator('.kimgmap-list-item').nth(0).click(); await t.page.keyboard.press('Delete');   // unsaved change
  await t.page.locator('.kimgmap-list-item').nth(0).click();
  await t.page.click('.kimgmap-modal-close');
  const n = () => t.page.$$eval('.kimgmap-list-item', e => e.length);
  await t.page.keyboard.press('Delete');
  t.eq(await n(), 1, 'Delete ignored');
  await t.page.keyboard.press('Control+d');
  t.eq(await n(), 1, 'Ctrl+D ignored');
  const b = await t.box();
  await t.page.mouse.move(...t.at(b, 400, 200)); await t.page.mouse.down(); await t.page.mouse.move(...t.at(b, 600, 350), { steps: 3 }); await t.page.mouse.up();
  t.eq(await n(), 1, 'canvas ignored');
});

test('an in-progress polygon counts as unsaved', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img'); });
  await t.openModal();
  await t.tool('poly');
  const b = await t.box();
  for (const [x, y] of [[100, 100], [300, 100], [200, 300]]) await t.page.mouse.click(...t.at(b, x, y));
  await t.page.click('.kimgmap-modal-close');
  t.eq(await t.page.evaluate(() => !document.querySelector('.kimgmap-discard').hidden), true);
});

test('Clear All removes non-editable areas too, even when they are all that is left', async t => {
  await t.setup(page('<area shape="default" href="#d">'), () => { window.ed = new kImgMap('#img', { mode: 'inline' }); });
  await t.tool('clear');
  await t.tapEl('.kimgmap-confirm-yes');
  t.eq(await t.html(), '');
});
