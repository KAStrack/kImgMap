/* Modal lifecycle: open, save, cancel, validation */
'use strict';
const { test, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const openModal = t => t.openModal();

test('Save writes textarea, fires onSave, removes overlay', async t => {
  await t.setup(page(), () => { window.saved = null; window.ed = new kImgMap('#img', { onSave: h => (window.saved = h) }); });
  await openModal(t);
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  await t.page.click('.kimgmap-save');
  await t.settled();
  await t.expectHTML('<area shape="rect" coords="100,100,300,250">');
  t.ok(t.htmlNear(await t.page.evaluate(() => window.saved), '<area shape="rect" coords="100,100,300,250">'), 'onSave html');
  t.eq(await t.page.$$eval('.kimgmap-overlay', o => o.length), 0, 'overlay removed');
});

test('Cancel discards changes', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), () => { window.ed = new kImgMap('#img'); });
  await openModal(t);
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));
  await t.page.click('.kimgmap-cancel');
  await t.settled();
  t.eq(await t.html(), '<area shape="rect" coords="10,10,50,50">', 'textarea after cancel');
  t.eq(await t.page.evaluate(() => ed.areas.length), 1, 'areas after cancel');
});

test('× button and backdrop click also cancel (after confirming)', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), () => { window.closes = []; window.ed = new kImgMap('#img', { onClose: s => closes.push(s) }); });
  for (const sel of ['.kimgmap-modal-close', '.kimgmap-overlay']) {
    await openModal(t);
    await t.page.click('.kimgmap-list-item'); await t.page.keyboard.press('Delete');
    if (sel === '.kimgmap-overlay') await t.page.mouse.click(5, 5); else await t.page.click(sel);
    await t.page.click('.kimgmap-discard-confirm');
    await t.settled();
    t.eq(await t.html(), '<area shape="rect" coords="10,10,50,50">', sel);
  }
  t.eq(await t.page.evaluate(() => closes), [false, false]);
});

test('Cancel restores state and onUpdate reports the restored HTML', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), () => { window.last = null; window.ed = new kImgMap('#img', { onUpdate: h => (window.last = h) }); });
  await openModal(t);
  await t.page.click('.kimgmap-list-item'); await t.page.keyboard.press('Delete');
  t.eq(await t.page.evaluate(() => last), '', 'live update after delete');
  await t.page.keyboard.press('Escape');
  await t.page.click('.kimgmap-discard-confirm'); await t.settled();
  t.eq(await t.page.evaluate(() => [last, document.getElementById('ta').value, ed.areas.length]), ['<area shape="rect" coords="10,10,50,50">', '<area shape="rect" coords="10,10,50,50">', 1]);
});

test('Cancel with no changes fires no onUpdate; Save during fade-out is ignored', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'),
    () => { window.calls = []; window.ed = new kImgMap('#img', { onUpdate: () => calls.push('update'), onSave: () => calls.push('save'), onClose: s => calls.push('close:' + s) }); });
  await openModal(t);
  await t.page.evaluate(() => { document.querySelector('.kimgmap-cancel').click(); document.querySelector('.kimgmap-save').click(); });
  await t.settled();
  t.eq(await t.page.evaluate(() => [calls, document.body.style.overflow]), [['close:false'], '']);
});

test('Escape closes; reopening within 300ms keeps the new modal', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img'); });
  await openModal(t);
  await t.page.keyboard.press('Escape');
  await t.page.evaluate(() => ed.open());
  await t.settled();
  t.eq(await t.page.evaluate(() => [document.querySelectorAll('.kimgmap-overlay').length, document.querySelectorAll('.kimgmap-overlay.is-open').length]), [1, 1]);
});

test('opening twice (or Enter on the trigger) does not stack overlays', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img'); });
  await openModal(t);
  t.eq(await t.page.evaluate(() => !!document.activeElement?.closest('.kimgmap-modal')), true, 'focus moved into the modal');
  await t.page.keyboard.press('Enter');
  await t.page.evaluate(() => ed.open());
  await t.page.waitForTimeout(100);
  t.eq(await t.page.$$eval('.kimgmap-overlay', o => o.length), 1);
});

test('Ctrl/Cmd+D and Delete work in the modal', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), () => { window.ed = new kImgMap('#img'); });
  await openModal(t);
  await t.page.click('.kimgmap-list-item');
  await t.page.keyboard.press('Control+d');
  t.eq(await t.page.evaluate(() => ed.areas.length), 2);
  await t.page.keyboard.press('Delete');
  t.eq(await t.page.evaluate(() => ed.areas.length), 1);
});

test('mandatoryTitles blocks Save until titled', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), () => { window.ed = new kImgMap('#img', { mandatoryTitles: true }); });
  await openModal(t);
  await t.page.click('.kimgmap-save');
  await t.settled();
  t.eq(await t.page.$$eval('.kimgmap-overlay', o => o.length), 1, 'still open');
  t.ok(await t.page.$eval('.kimgmap-validation-banner', b => !b.hidden && getComputedStyle(b).display !== 'none'), 'banner visible');
  t.ok(await t.page.$('.kimgmap-ag.is-error'), 'shape flagged');
  t.ok(await t.page.$('[data-attr="title"].is-error'), 'title field flagged');
  await t.page.fill('[data-attr="title"]', 'Hello');
  t.ok(await t.page.$eval('.kimgmap-validation-banner', b => b.hidden), 'banner cleared');
  await t.page.click('.kimgmap-save');
  await t.settled();
  t.eq(await t.html(), '<area shape="rect" coords="10,10,50,50" title="Hello">');
});

test('mandatoryTitles works with a title mirrored via onAttributeChange', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), () => {
    window.ed = new kImgMap('#img', { mandatoryTitles: true, attributes: ['href'], customAttributes: ['data-value'],
      outputAttributes: ['href', 'title', 'data-value'],
      onAttributeChange: (a, attr, v) => attr === 'data-value' ? { title: v } : undefined });
  });
  await openModal(t);
  await t.page.click('.kimgmap-save');
  t.ok(await t.page.$('[data-attr="data-value"].is-error'), 'empty fields flagged');
  await t.page.fill('[data-attr="data-value"]', 'v1');
  t.ok(await t.page.$eval('.kimgmap-validation-banner', b => b.hidden), 'banner cleared');
  await t.page.click('.kimgmap-save');
  await t.settled();
  t.eq(await t.html(), '<area shape="rect" coords="10,10,50,50" href="" title="v1" data-value="v1">');
});

test('two modals open at once: body scroll restored after both close', async t => {
  await t.setup(`${page()}<div><img data-test id="img2"><textarea id="ta2"></textarea></div>`,
    () => { document.body.style.overflow = 'auto'; window.a = new kImgMap('#img'); window.b = new kImgMap('#img2'); a.open(); b.open(); a.close(); });
  t.eq(await t.page.evaluate(() => document.body.style.overflow), 'hidden', 'still locked while b open');
  t.eq(await t.page.evaluate(() => { b.close(); return document.body.style.overflow; }), 'auto');
});
