/* Undo / redo */
'use strict';
const { test, forInputs, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const inline = (opts = {}) => `window.ed = new kImgMap('#img', ${JSON.stringify({ mode: 'inline', ...opts })})`;
const R = '<area shape="rect" coords="100,100,200,200">';
const mod = () => 'Control';
const disabled = t => t.page.$$eval('[data-tool=undo],[data-tool=redo]', b => b.map(x => x.disabled));

forInputs('undo and redo a draw, a move and a resize (toolbar buttons)', async t => {
  await t.setup(page(), inline());
  t.eq(await disabled(t), [true, true], 'nothing to undo yet');
  const b = await t.box();
  await t.drag(t.at(b, 100, 100), t.at(b, 300, 250));                 // draw
  await t.drag(t.at(b, 200, 150), t.at(b, 260, 190));                 // move by (60, 40)
  await t.drag(t.at(b, 360, 290), t.at(b, 400, 330));                 // se handle +(40, 40)
  await t.expectHTML('<area shape="rect" coords="160,140,400,330">');
  if (t.input === 'touch') await t.page.waitForTimeout(350);          // real Chromium drops a tap right after a fling
  t.eq(await disabled(t), [false, true]);
  await t.tool('undo');
  await t.expectHTML('<area shape="rect" coords="160,140,360,290">', 'resize undone');
  await t.tool('undo');
  await t.expectHTML('<area shape="rect" coords="100,100,300,250">', 'move undone');
  await t.tool('undo');
  t.eq(await t.html(), '', 'draw undone');
  t.eq(await disabled(t), [true, false]);
  await t.tool('redo'); await t.tool('redo'); await t.tool('redo');
  await t.expectHTML('<area shape="rect" coords="160,140,400,330">', 'all redone');
  t.eq(await disabled(t), [false, true]);
});

test('Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl+Y; a new change discards the redo steps', async t => {
  await t.setup(page(R), inline());
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.keyboard.press('Delete');
  t.eq(await t.html(), '');
  await t.page.keyboard.press(`${mod(t)}+z`);
  t.eq(await t.html(), R, 'delete undone');
  t.eq(await t.page.$$eval('.kimgmap-list-item.is-active', e => e.length), 1, 'the restored area is selected again');
  await t.page.keyboard.press('Meta+Shift+z');
  t.eq(await t.html(), '', 'redone with Cmd+Shift+Z');
  await t.page.keyboard.press(`${mod(t)}+z`);
  await t.page.keyboard.press('Control+y');
  t.eq(await t.html(), '', 'redone with Ctrl+Y');
  await t.page.keyboard.press(`${mod(t)}+z`);
  t.eq(await t.html(), R);
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.keyboard.press(`${mod(t)}+d`);                       // a new change
  t.eq(await disabled(t), [false, true], 'redo cleared by the new change');
  t.ok((await t.page.$eval('.kimgmap-live', l => l.textContent)).length > 0);
});

test('typing in a field is one undo step; Ctrl+Z inside a field is the field\'s own undo', async t => {
  await t.setup(page(R), inline());
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.locator('[data-attr="title"]').pressSequentially('Hello');
  await t.page.locator('[data-attr="alt"]').pressSequentially('Hi');
  t.eq(await t.html(), '<area shape="rect" coords="100,100,200,200" title="Hello" alt="Hi">');
  await t.page.keyboard.press(`${mod(t)}+z`);                       // in the alt field: the browser's own text undo
  t.ok((await t.html()).includes('title="Hello"'), 'areas not undone from inside a field');
  await t.page.keyboard.press('Escape');                            // leave the field
  await t.page.evaluate(() => { document.querySelector('[data-attr="alt"]').value = 'Hi'; document.querySelector('[data-attr="alt"]').dispatchEvent(new Event('input')); });
  await t.tool('undo');
  t.eq(await t.html(), '<area shape="rect" coords="100,100,200,200" title="Hello">', 'alt typing undone in one step');
  await t.tool('undo');
  t.eq(await t.html(), R, 'title typing undone in one step');
  t.eq(await t.page.$eval('[data-attr="title"]', i => i.value), '', 'the panel shows the restored value');
});

test('a run of arrow-key nudges is one undo step; the Coords field is undoable', async t => {
  await t.setup(page(R), inline());
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.focus('.kimgmap-img-area');
  // Ctrl+Z in a text field (with no typing to undo) leaves the areas alone
  await t.page.keyboard.press('ArrowRight');
  await t.page.focus('[data-attr="href"]');
  await t.page.keyboard.press(`${mod(t)}+z`);
  t.eq(await t.html(), '<area shape="rect" coords="101,100,201,200">', 'not undone from a field');
  await t.page.focus('.kimgmap-img-area');
  await t.page.keyboard.press(`${mod(t)}+z`);
  t.eq(await t.html(), R, 'undone from the canvas');
  for (let i = 0; i < 5; i++) await t.page.keyboard.press('ArrowRight');
  await t.page.keyboard.press('Alt+ArrowDown');
  t.eq(await t.html(), '<area shape="rect" coords="105,100,205,201">');
  await t.page.keyboard.press(`${mod(t)}+z`);
  t.eq(await t.html(), '<area shape="rect" coords="105,100,205,200">', 'resize step');
  await t.page.keyboard.press(`${mod(t)}+z`);
  t.eq(await t.html(), R, 'five nudges, one step');
  await t.page.fill('.kimgmap-coords-input', '1, 2, 30, 40');
  await t.page.keyboard.press('Enter');
  t.eq(await t.html(), '<area shape="rect" coords="1,2,30,40">');
  await t.tool('undo');
  t.eq(await t.html(), R);
});

test('Clear All (with non-editable areas) and duplicate are undoable; validation errors follow', async t => {
  await t.setup(page(R + '\n<area shape="default" href="#d">'), inline());
  await t.tool('clear');
  await t.tapEl('.kimgmap-confirm-yes');
  t.eq(await t.html(), '');
  await t.settled();   // the toolbar has just stopped being inert (Firefox can drop a click in the same frame)
  await t.tool('undo');
  t.eq(await t.html(), R + '\n<area shape="default" href="#d">', 'everything back, including the default area');
  await t.page.locator('.kimgmap-list-item').click();
  await t.tool('duplicate');
  t.eq(await t.page.$$eval('.kimgmap-ag', g => g.length), 2);
  await t.tool('undo');
  t.eq(await t.page.$$eval('.kimgmap-ag', g => g.length), 1, 'duplicate undone');
});

forInputs('while drawing a polygon, undo removes its last point (then cancels it)', async t => {
  await t.setup(page(), inline({ defaultShape: 'poly' }));
  const b = await t.box();
  const tap = async (x, y) => { await t.tap(t.at(b, x, y)); await t.page.waitForTimeout(350); };   // no double-tap
  for (const [x, y] of [[100, 100], [300, 100], [300, 300]]) await tap(x, y);
  t.eq(await disabled(t), [false, true], 'undo available mid-polygon');
  t.eq(await t.page.$$eval('.kimgmap-preview-start', e => e.length), 1, 'first point marked at 3 points');
  await t.tool('undo');
  const pts = (await t.page.$eval('.kimgmap-preview', p => p.getAttribute('points'))).split(/[ ,]/).map(Number);
  t.ok(pts.length === 4 && [100, 100, 300, 100].every((v, i) => Math.abs(v - pts[i]) <= 2), 'last point removed: ' + pts);
  t.eq(await t.page.$$eval('.kimgmap-preview-start', e => e.length), 0, 'marker gone below 3 points');
  await tap(200, 300);
  await tap(100, 100);                                              // close on the first point
  await t.expectHTML('<area shape="poly" coords="100,100,300,100,200,300">');
  await t.tool('undo');
  t.eq(await t.html(), '', 'the finished polygon is one undo step');
  // Undo with one point cancels the polygon
  await tap(100, 100);
  await t.tool('undo');
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 0);
  t.eq(await disabled(t), [true, false]);
});

test('setAreas() starts a new history; each modal session has its own, and Cancel still reverts', async t => {
  await t.setup(page(R), () => { window.ed = new kImgMap('#img'); });
  await t.openModal();
  t.eq(await disabled(t), [true, true], 'fresh history on open');
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.keyboard.press('Delete');
  await t.page.evaluate(() => ed.setAreas([{ shape: 'circle', coords: [50, 50, 10] }]));
  t.eq(await disabled(t), [true, true], 'setAreas resets the history');
  await t.page.click('.kimgmap-cancel'); await t.settled();
  t.eq(await t.html(), R, 'Cancel restores the textarea');
  await t.openModal();
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.keyboard.press('Delete');
  t.eq(await disabled(t), [false, true], 'modal edits are undoable');
  await t.page.keyboard.press('Control+z');
  t.eq(await t.page.$$eval('.kimgmap-list-item', i => i.length), 1, 'the area is back');
  await t.page.keyboard.press('Escape'); await t.settled();          // undone back to the start: nothing to discard
  t.eq(await t.page.$$eval('.kimgmap-overlay', o => o.length), 0, 'closed without the discard prompt');
  await t.openModal();
  t.eq(await disabled(t), [true, true], 'no history carried over');
});

test('undo history is capped at 100 steps', async t => {
  await t.setup(page(R), inline());
  await t.page.evaluate(() => {
    ed._select(ed.areas[0].id);
    for (let i = 0; i < 120; i++) { ed.areas[0].coords = [i, 0, i + 50, 50]; ed._syncOutput(); }
    window.n = 0;
    while (ed._canUndo()) { ed.undo(); n++; }
  });
  t.eq(await t.page.evaluate(() => n), 99, 'the oldest steps were dropped');
});

test('typing then deleting it leaves no empty undo step; Ctrl+Z on a <select> undoes areas', async t => {
  await t.setup(page(R), inline());
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.locator('[data-attr="title"]').pressSequentially('x');
  await t.page.keyboard.press('Backspace');
  t.eq(await disabled(t), [true, true], 'back where it started: nothing to undo');
  await t.page.selectOption('[data-attr="target"]', '_blank');
  await t.page.focus('[data-attr="target"]');
  await t.page.keyboard.press('Control+z');
  t.eq(await t.html(), R, 'undone from the select');
});

test('undo is ignored mid-drag; keys are inert while the Clear All confirmation is open', async t => {
  await t.setup(page(R), inline());
  const b = await t.box();
  await t.drag(t.at(b, 150, 150), t.at(b, 170, 150));
  await t.page.mouse.move(...t.at(b, 160, 150)); await t.page.mouse.down();
  await t.page.mouse.move(...t.at(b, 200, 150), { steps: 3 });
  await t.page.evaluate(() => ed.undo());
  await t.page.mouse.up();
  await t.expectHTML('<area shape="rect" coords="160,100,260,200">', 'drag finished normally');
  await t.tool('undo');
  await t.expectHTML('<area shape="rect" coords="120,100,220,200">', 'the first drag is still in the history');
  await t.page.locator('.kimgmap-list-item').click();
  await t.tool('clear');
  for (const k of ['Delete', 'Control+d', 'Control+z']) await t.page.keyboard.press(k);
  await t.expectHTML('<area shape="rect" coords="120,100,220,200">', 'nothing happened behind the confirmation');
});

test('undo prunes validation errors for areas that no longer exist; changing field starts a new step', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img', { mode: 'inline', mandatoryTitles: true }); });
  await t.page.focus('.kimgmap-img-area');
  await t.page.keyboard.press('Enter');                              // add an untitled area
  await t.page.evaluate(() => ed._showValidationErrors(ed.areas.map(a => a.id)));
  t.eq(await t.page.$eval('.kimgmap-validation-banner', b => b.hidden), false);
  await t.tool('undo');
  t.eq(await t.page.evaluate(() => [ed._errorIds.size, document.querySelector('.kimgmap-validation-banner').hidden]), [0, true]);
  // two separate edits of the same field, with a focus change between them, are two steps
  await t.page.setContent('');
  await t.setup(page(R), inline());
  await t.page.locator('.kimgmap-list-item').click();
  await t.page.locator('[data-attr="title"]').pressSequentially('A');
  await t.page.focus('[data-attr="alt"]');
  await t.page.focus('[data-attr="title"]');
  await t.page.locator('[data-attr="title"]').pressSequentially('B');
  await t.tool('undo');
  t.eq(await t.html(), '<area shape="rect" coords="100,100,200,200" title="A">');
});
