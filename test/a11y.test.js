/* Accessibility: keyboard operation, focus management, ARIA, contrast, motion */
'use strict';
const { test, IMG } = require('./harness');

const page = (ta = '') => `<div>${IMG}<textarea id="ta">${ta}</textarea></div>`;
const inline = (opts = {}) => `window.ed = new kImgMap('#img', ${JSON.stringify({ mode: 'inline', ...opts })})`;
const TWO = '<area shape="rect" coords="10,10,50,50" alt="A">\n<area shape="rect" coords="100,100,150,150" alt="B">';
const active = t => t.page.evaluate(() => {
  const e = document.activeElement;
  const known = ['kimgmap-save', 'kimgmap-cancel', 'kimgmap-img-area', 'kimgmap-open-btn', 'kimgmap-modal-close', 'kimgmap-coords-input'];
  return e?.dataset?.tool || e?.dataset?.attr || (e?.getAttribute('role') === 'option' ? 'option:' + e.textContent.replace(/\s+/g, '') : null) ||
    known.find(c => e?.classList.contains(c)) || [...(e?.classList || [])].find(c => c.startsWith('kimgmap-')) || e?.id || e?.tagName;
});
const announced = t => t.page.evaluate(() => [...document.querySelectorAll('.kimgmap-live')].map(l => l.textContent).join(' | '));

/* ── Automated scans ────────────────────────────────────────────────────── */

for (const theme of ['light', 'dark']) {
  test(`axe: open modal editor with a selected area has no violations (${theme})`, async t => {
    await t.setup(`<main><h1>Page</h1>${page(TWO)}</main>`, () => { window.ed = new kImgMap('#img'); });
    await t.openModal();
    if (theme === 'dark') await t.page.evaluate(() => document.querySelector('.kimgmap-overlay').setAttribute('data-theme', 'dark'));
    await t.page.locator('.kimgmap-list-item').nth(0).click();
    t.eq(await t.axe('.kimgmap-overlay'), []);
  });

  test(`axe: inline editor with a selected area has no violations (${theme})`, async t => {
    await t.setup(`<main><h1>Page</h1>${page(TWO)}</main>`, inline());
    if (theme === 'dark') await t.page.evaluate(() => document.querySelector('.kimgmap-editor').setAttribute('data-theme', 'dark'));
    await t.page.locator('.kimgmap-list-item').nth(0).click();
    t.eq(await t.axe('.kimgmap-editor'), []);
  });
}

test('axe: validation errors and the discard prompt have no violations', async t => {
  await t.setup(`<main><h1>Page</h1>${page(TWO)}</main>`, () => { window.ed = new kImgMap('#img', { mandatoryTitles: true }); });
  await t.openModal();
  await t.page.click('.kimgmap-save');
  t.eq(await t.axe('.kimgmap-overlay'), [], 'validation');
  await t.page.keyboard.press('Escape');                    // leave the focused field
  await t.page.locator('.kimgmap-list-item').nth(0).click(); await t.page.keyboard.press('Delete');
  await t.page.click('.kimgmap-modal-close');
  t.eq(await t.axe('.kimgmap-overlay'), [], 'discard prompt');
});

/* ── Modal dialog ───────────────────────────────────────────────────────── */

test('modal is a labelled dialog; the trigger says it opens one', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img'); });
  t.eq(await t.page.$eval('.kimgmap-open-btn', b => b.getAttribute('aria-haspopup')), 'dialog');
  await t.openModal();
  t.eq(await t.page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return [d?.classList.contains('kimgmap-modal'), d?.getAttribute('aria-modal'), document.getElementById(d?.getAttribute('aria-labelledby'))?.textContent];
  }), [true, 'true', 'Image Map Editor']);
});

test('keyboard: Tab stays inside the modal, the page behind is inert, focus returns on close', async t => {
  await t.setup(`<a href="#" id="before">before</a>${page(TWO)}<a href="#" id="after">after</a>`, () => { window.ed = new kImgMap('#img'); });
  await t.page.focus('.kimgmap-open-btn');
  await t.page.keyboard.press('Enter');
  await t.settled();
  const inside = () => t.page.evaluate(() => !!document.activeElement?.closest('.kimgmap-modal'));
  for (let i = 0; i < 25; i++) { await t.page.keyboard.press('Tab'); t.eq(await inside(), true, `Tab #${i + 1} stays in the modal`); }
  for (let i = 0; i < 25; i++) { await t.page.keyboard.press('Shift+Tab'); t.eq(await inside(), true, `Shift+Tab #${i + 1} stays in the modal`); }
  t.eq(await t.page.evaluate(() => [document.getElementById('before').closest('[inert]') !== null, document.getElementById('after').closest('[inert]') !== null]), [true, true], 'background inert');
  await t.page.keyboard.press('Escape'); await t.settled();
  t.eq(await active(t), 'kimgmap-open-btn', 'focus back on the trigger');
  t.eq(await t.page.evaluate(() => document.querySelectorAll('[inert]').length), 0, 'inert removed');
});

/* ── Toolbar ────────────────────────────────────────────────────────────── */

test('toolbar: one Tab stop, arrow keys move between tools, aria-pressed shows the active tool', async t => {
  await t.setup(page(), inline());
  t.eq(await t.page.evaluate(() => [document.querySelector('.kimgmap-toolbar').getAttribute('role'),
    document.querySelectorAll('.kimgmap-tool[tabindex="0"]').length]), ['toolbar', 1]);
  const pressed = () => t.page.$$eval('.kimgmap-tool[aria-pressed]', b => b.map(x => x.dataset.tool + '=' + x.getAttribute('aria-pressed')).join(' '));
  t.eq(await pressed(), 'select=false rect=true circle=false poly=false');
  await t.page.focus('.kimgmap-tool[tabindex="0"]');
  t.eq(await active(t), 'rect', 'the active tool is the Tab stop');
  await t.page.keyboard.press('ArrowRight');
  t.eq(await active(t), 'circle');
  await t.page.keyboard.press('Enter');
  t.eq(await pressed(), 'select=false rect=false circle=true poly=false');
  await t.page.keyboard.press('Home');
  t.eq(await active(t), 'select');
  await t.page.keyboard.press('End');
  t.eq(await active(t), 'poly', 'End = last enabled tool (Duplicate/Delete/Clear are disabled)');
  await t.page.keyboard.press('ArrowRight');
  t.eq(await active(t), 'select', 'wraps');
});

test('toolbar: Delete and Clear All are disabled when there is nothing to act on; focus is not lost', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), inline());
  const dis = () => t.page.$$eval('.kimgmap-tool', b => b.filter(x => x.disabled).map(x => x.dataset.tool).join(','));
  t.eq(await dis(), 'undo,redo,duplicate,delete', 'nothing selected, nothing to undo');
  await t.page.click('.kimgmap-list-item');
  t.eq(await dis(), 'undo,redo', 'selected');
  await t.page.focus('[data-tool="delete"]');
  await t.page.keyboard.press('Enter');
  t.eq(await dis(), 'redo,duplicate,delete,clear', 'empty (the delete can be undone)');
  t.eq(await t.page.evaluate(() => !!document.activeElement?.closest('.kimgmap-editor') && document.activeElement !== document.body), true, 'focus stayed in the editor');
});

/* ── Canvas (keyboard drawing & editing) ────────────────────────────────── */

test('canvas: focusable; Enter adds an area with the active tool at the centre', async t => {
  await t.setup(page(), inline());
  const canvas = '.kimgmap-img-area';
  t.eq(await t.page.$eval(canvas, c => [c.tabIndex, !!c.getAttribute('aria-label'), !!c.getAttribute('aria-describedby')]), [0, true, true]);
  await t.page.focus(canvas);
  await t.page.keyboard.press('Enter');
  await t.expectHTML('<area shape="rect" coords="300,150,500,250">', 'rect', { tol: 0 });
  t.ok((await announced(t)).includes('Rectangle added'), 'announced: ' + await announced(t));
  for (const [tool, html] of [['circle', '<area shape="circle" coords="400,200,50">'], ['poly', '<area shape="poly" coords="400,150,450,250,350,250">']]) {
    await t.page.click(`[data-tool="${tool}"]`);
    await t.page.focus(canvas);
    await t.page.keyboard.press('Enter');
    t.ok((await t.html()).endsWith(html), `${tool}: ${await t.html()}`);
  }
});

test('canvas: arrows move the selected area (Shift = 10px), Alt+arrows resize it, all clamped', async t => {
  await t.setup(page('<area shape="rect" coords="100,100,200,200">\n<area shape="circle" coords="400,200,50">'), inline());
  await t.page.locator('.kimgmap-list-item').nth(0).click();
  await t.page.focus('.kimgmap-img-area');
  const k = async (key, n = 1) => { for (let i = 0; i < n; i++) await t.page.keyboard.press(key); };
  await k('ArrowRight', 3); await k('ArrowDown');
  await k('Shift+ArrowRight'); await k('Shift+ArrowUp', 2);
  await k('Alt+ArrowRight', 5); await k('Alt+ArrowDown', 2);
  t.ok((await t.html()).startsWith('<area shape="rect" coords="113,81,218,183">'), await t.html());
  await k('Shift+ArrowLeft', 30);
  t.ok((await t.html()).startsWith('<area shape="rect" coords="0,81,105,183">'), 'clamped at the edge: ' + await t.html());
  await t.page.locator('.kimgmap-list-item').nth(1).click();
  await t.page.focus('.kimgmap-img-area');
  await k('Alt+ArrowRight', 4); await k('Alt+ArrowLeft');
  t.ok((await t.html()).endsWith('<area shape="circle" coords="400,200,53">'), 'circle radius: ' + await t.html());
});

/* ── Area list ──────────────────────────────────────────────────────────── */

test('area list is a listbox: Tab to it, arrows select, Delete removes and keeps focus in the list', async t => {
  await t.setup(page(TWO + '\n<area shape="circle" coords="400,200,50" alt="C">'), inline());
  t.eq(await t.page.evaluate(() => [document.querySelector('.kimgmap-area-list').getAttribute('role'),
    document.querySelectorAll('[role="option"]').length, document.querySelectorAll('[role="option"][tabindex="0"]').length]), ['listbox', 3, 1]);
  await t.page.focus('[role="option"][tabindex="0"]');
  t.eq(await active(t), 'option:RA');
  await t.page.keyboard.press('ArrowDown');
  t.eq(await t.page.evaluate(() => [document.activeElement.textContent.replace(/\s+/g, ''), document.activeElement.getAttribute('aria-selected'),
    document.querySelector('.kimgmap-props').hidden]), ['RB', 'true', false], 'selection follows focus');
  await t.page.keyboard.press('End');
  t.eq(await active(t), 'option:CC');
  await t.page.keyboard.press('Delete');
  t.eq(await t.page.evaluate(() => [document.querySelectorAll('[role="option"]').length, document.activeElement.getAttribute('role'),
    document.activeElement.textContent.replace(/\s+/g, ''), document.activeElement.getAttribute('aria-selected')]), [2, 'option', 'RB', 'true'], 'focus and selection moved to the neighbour');
  t.ok((await announced(t)).includes('C deleted'), 'announced deletion');
});

test('list labels prefer title, then alt, then href', async t => {
  await t.setup(page('<area shape="rect" coords="1,1,9,9" title="T" alt="A">\n<area shape="rect" coords="1,1,9,9" alt="A" href="/h">\n<area shape="rect" coords="1,1,9,9" href="/h">'), inline());
  t.eq(await t.page.$$eval('.kimgmap-list-label', l => l.map(x => x.textContent)), ['T', 'A', '/h']);
});

/* ── Properties ─────────────────────────────────────────────────────────── */

test('coords are editable; invalid input is flagged and not applied', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), inline());
  await t.page.click('.kimgmap-list-item');
  const input = '.kimgmap-coords-input';
  t.eq(await t.page.$eval(input, i => [i.tagName, !!i.labels?.length, i.value]), ['INPUT', true, '10, 10, 50, 50']);
  await t.page.fill(input, '20, 30, 120, 90');
  await t.page.keyboard.press('Enter');
  await t.expectHTML('<area shape="rect" coords="20,30,120,90">', 'applied', { tol: 0 });
  t.eq(await t.page.evaluate(() => document.querySelector('.kimgmap-shape').getAttribute('width')), '100', 'SVG updated');
  await t.page.fill(input, '1, 2, 3');
  await t.page.keyboard.press('Enter');
  t.eq(await t.page.$eval(input, i => i.getAttribute('aria-invalid')), 'true');
  await t.expectHTML('<area shape="rect" coords="20,30,120,90">', 'not applied', { tol: 0 });
  await t.page.fill(input, '5,5,9000,9000');   // clamped to the image
  await t.page.keyboard.press('Tab');
  await t.expectHTML('<area shape="rect" coords="5,5,800,400">', 'clamped on blur', { tol: 0 });
  t.eq(await t.page.$eval(input, i => i.getAttribute('aria-invalid')), null);
});

test('validation: invalid fields are marked, described and focused; list rows say why', async t => {
  await t.setup(page(TWO), () => { window.ed = new kImgMap('#img', { mandatoryTitles: true }); });
  await t.openModal();
  await t.page.click('.kimgmap-save');
  t.eq(await t.page.evaluate(() => {
    const f = document.activeElement;
    const desc = (f.getAttribute('aria-describedby') || '').split(' ').map(id => document.getElementById(id)?.textContent).join(' ');
    return [f.dataset.attr, f.getAttribute('aria-invalid'), desc.includes('must have a title'),
      [...document.querySelectorAll('[role="option"]')].map(o => o.textContent.includes('Missing title'))];
  }), ['title', 'true', true, [true, true]]);
  await t.page.fill('[data-attr="title"]', 'ok');
  t.eq(await t.page.$eval('[data-attr="title"]', f => f.getAttribute('aria-invalid')), null, 'cleared when fixed');
});

test('validation: a repeated failed Save is announced again', async t => {
  await t.setup(page(TWO), () => { window.ed = new kImgMap('#img', { mandatoryTitles: true }); });
  await t.openModal();
  await t.page.click('.kimgmap-save');
  await t.page.waitForFunction(() => document.querySelector('.kimgmap-validation-msg').textContent.includes('must have a title'));
  await t.page.evaluate(() => {
    const msg = document.querySelector('.kimgmap-validation-msg');
    window.seen = [];
    new MutationObserver(() => seen.push(msg.textContent)).observe(msg, { childList: true, characterData: true, subtree: true });
  });
  await t.page.click('.kimgmap-save');
  await t.page.waitForFunction(() => window.seen.at(-1)?.includes('must have a title'), null, { timeout: 5000 });
  // Identical text isn't re-announced reliably — the message must be cleared, then set again
  const seen = await t.page.evaluate(() => window.seen);
  t.ok(seen.includes('') && seen[seen.length - 1].includes('must have a title'), JSON.stringify(seen));
});

/* ── Announcements ──────────────────────────────────────────────────────── */

test('live region announces duplicate, clear and polygon progress', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50" alt="A">'), inline());
  t.eq(await t.page.$eval('.kimgmap-live', l => [l.getAttribute('aria-live'), l.getAttribute('role')]), ['polite', 'status']);
  await t.page.click('.kimgmap-list-item');
  await t.tool('duplicate');
  t.ok((await announced(t)).includes('A duplicated'), await announced(t));
  await t.tool('poly');
  t.ok(/finish/i.test(await announced(t)), 'poly tool hint: ' + await announced(t));
  const b = await t.box();
  await t.page.mouse.click(...t.at(b, 400, 100));
  t.ok(/started/i.test(await announced(t)), 'started: ' + await announced(t));
  await t.page.keyboard.press('Escape');
  t.ok(/cancel/i.test(await announced(t)), 'cancelled: ' + await announced(t));
  await t.tool('clear');
  await t.tapEl('.kimgmap-confirm-yes');
  t.ok(/cleared/i.test(await announced(t)), 'cleared: ' + await announced(t));
});

/* ── Visual cues ────────────────────────────────────────────────────────── */

test('the selected area is distinguishable without colour (thicker stroke)', async t => {
  await t.setup(page(TWO), inline());
  await t.page.locator('.kimgmap-list-item').nth(0).click();
  const w = await t.page.$$eval('.kimgmap-ag .kimgmap-shape', s => s.map(e => parseFloat(getComputedStyle(e).strokeWidth)));
  t.ok(w[0] >= w[1] + 1, `stroke widths ${w}`);
});

for (const theme of ['light', 'dark']) {
  test(`contrast: text ≥ 4.5:1 and field borders ≥ 3:1 (${theme})`, async t => {
    await t.setup(page('<area shape="rect" coords="10,10,50,50">\n<area shape="circle" coords="200,200,20">\n<area shape="poly" coords="1,1,50,1,25,40">'), () => { window.ed = new kImgMap('#img', { mandatoryTitles: true }); });
    await t.openModal();
    if (theme === 'dark') await t.page.evaluate(() => document.querySelector('.kimgmap-overlay').setAttribute('data-theme', 'dark'));
    await t.page.click('.kimgmap-save');                     // shows the banner, selects an area
    const r = await t.page.evaluate(() => {
      const rgba = s => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
      const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
        .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const over = (fg, bg) => fg.map((v, i) => i < 3 ? v * fg[3] + bg[i] * (1 - fg[3]) : 1);
      // effective background: composite ancestors' backgrounds
      const bgOf = el => {
        const layers = [];
        for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = rgba(getComputedStyle(n).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] === 1) break; }
        return layers.reverse().reduce((acc, c) => over(c, acc), [255, 255, 255, 1]);
      };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
      const text = (sel, pseudo) => { const el = document.querySelector(sel); const bg = bgOf(el); return ratio(over(rgba(getComputedStyle(el, pseudo).color), bg), bg); };
      const border = sel => { const el = document.querySelector(sel); const bg = bgOf(el.parentElement); return ratio(over(rgba(getComputedStyle(el).borderTopColor), bg), bg); };
      return {
        save: text('.kimgmap-save'), activeTool: text('.kimgmap-tool.is-active'), deleteArea: text('.kimgmap-del-btn'),
        banner: text('.kimgmap-validation-msg'), badgeR: text('.kimgmap-badge--rect'), badgeC: text('.kimgmap-badge--circle'),
        badgeP: text('.kimgmap-badge--poly'), placeholder: text('[data-attr="href"]', '::placeholder'), muted: text('.kimgmap-section-title'),
        fieldBorder: border('[data-attr="href"]'),
      };
    });
    const low = Object.entries(r).filter(([k, v]) => v < (k === 'fieldBorder' ? 3 : 4.5));
    t.eq(low, [], JSON.stringify(r));
  });
}

test('forced colours: the active tool and selected list row remain visible', async t => {
  await t.page.emulateMedia({ forcedColors: 'active' });
  await t.setup(page(TWO), inline());
  await t.page.locator('.kimgmap-list-item').nth(0).click();
  // Colours are replaced by the system palette, so state needs a non-colour cue: an outline
  const r = await t.page.evaluate(() => ['.kimgmap-tool.is-active', '.kimgmap-list-item.is-active', '.kimgmap-tool:not(.is-active)', '.kimgmap-list-item:not(.is-active)']
    .map(sel => { const c = getComputedStyle(document.querySelector(sel)); return c.outlineStyle !== 'none' && parseFloat(c.outlineWidth) >= 2; }));
  t.eq(r, [true, true, false, false], '[active tool, selected row, inactive tool, other row] have an outline');
}, { browsers: ['chromium'] });

test('reduced motion: no error pulse and no modal animation', async t => {
  await t.page.emulateMedia({ reducedMotion: 'reduce' });
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), () => { window.ed = new kImgMap('#img', { mandatoryTitles: true }); });
  await t.openModal();
  await t.page.click('.kimgmap-save');
  t.eq(await t.page.evaluate(() => [getComputedStyle(document.querySelector('.kimgmap-ag.is-error .kimgmap-shape')).animationName,
    getComputedStyle(document.querySelector('.kimgmap-modal')).transitionDuration.split(',').every(d => parseFloat(d) === 0)]), ['none', true]);
  // …and no hover/press transitions on the controls (they're styled with two-class selectors)
  t.eq(await t.page.$$eval('.kimgmap-tool, .kimgmap-btn', els => els.filter(e => getComputedStyle(e).transitionDuration.split(',').some(d => parseFloat(d) > 0)).map(e => e.className)), []);
});

/* ── Misc semantics ─────────────────────────────────────────────────────── */

test('decorative SVGs are hidden from assistive tech; Show Code exposes its state', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img', { showTextarea: 'optional' }); });
  const btn = '.kimgmap-show-code-btn';
  t.eq(await t.page.$eval(btn, b => [b.getAttribute('aria-expanded'), document.getElementById(b.getAttribute('aria-controls'))?.tagName]), ['false', 'TEXTAREA']);
  await t.page.click(btn);
  t.eq(await t.page.$eval(btn, b => b.getAttribute('aria-expanded')), 'true');
  await t.openModal();
  t.eq(await t.page.evaluate(() => [[...document.querySelectorAll('.kimgmap-tool svg')].every(s => s.getAttribute('aria-hidden') === 'true'),
    document.querySelector('.kimgmap-svg').getAttribute('aria-hidden')]), [true, 'true']);
});

test('keyboard-only session: create, name and save an area without a pointer', async t => {
  await t.setup(page(), () => { window.ed = new kImgMap('#img'); });
  await t.page.focus('.kimgmap-open-btn');
  await t.page.keyboard.press('Enter'); await t.settled();
  // Tab to the canvas, add a rectangle, nudge it, then Tab to the title field
  for (let i = 0; i < 10 && await active(t) !== 'kimgmap-img-area'; i++) await t.page.keyboard.press('Tab');
  t.eq(await active(t), 'kimgmap-img-area', 'reached the canvas');
  await t.page.keyboard.press('Enter');
  await t.page.keyboard.press('Shift+ArrowRight');
  for (let i = 0; i < 10 && await active(t) !== 'title'; i++) await t.page.keyboard.press('Tab');
  await t.page.keyboard.type('Keyboard area');
  for (let i = 0; i < 20 && await active(t) !== 'kimgmap-save'; i++) await t.page.keyboard.press('Tab');
  await t.page.keyboard.press('Enter'); await t.settled();
  await t.expectHTML('<area shape="rect" coords="310,150,510,250" title="Keyboard area">', '', { tol: 0 });
});

/* ── Review follow-ups ──────────────────────────────────────────────────── */

test('Enter on the canvas finishes a mouse-drawn polygon instead of adding a shape', async t => {
  await t.setup(page(), inline({ defaultShape: 'poly' }));
  const b = await t.box();
  await t.page.mouse.click(...t.at(b, 100, 100));
  await t.page.keyboard.press('Enter');                      // 1 point: nothing to finish
  t.eq(await t.html(), '', 'ignored with one point');
  for (const [x, y] of [[300, 100], [200, 300]]) await t.page.mouse.click(...t.at(b, x, y));
  await t.page.keyboard.press('Enter');
  await t.expectHTML('<area shape="poly" coords="100,100,300,100,200,300">');
  t.eq(await t.page.$$eval('.kimgmap-preview', e => e.length), 0, 'polygon finished');
});

test('editable: false — keyboard and the Coords field cannot change geometry', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), inline({ editable: false }));
  await t.page.click('.kimgmap-list-item');
  await t.page.focus('.kimgmap-img-area');
  for (const k of ['ArrowRight', 'Shift+ArrowDown', 'Alt+ArrowRight']) await t.page.keyboard.press(k);
  t.eq(await t.page.$eval('.kimgmap-coords-input', i => i.readOnly), true, 'coords read-only');
  await t.expectHTML('<area shape="rect" coords="10,10,50,50">', '', { tol: 0 });
});

test('arrowing through a long area list keeps the focused option in view', async t => {
  const many = Array.from({ length: 30 }, (_, i) => `<area shape="rect" coords="${i},0,${i + 10},10" alt="A${i}">`).join('\n');
  await t.setup(page(many), () => { window.ed = new kImgMap('#img'); });
  await t.openModal();
  await t.page.focus('[role="option"][tabindex="0"]');
  for (let i = 0; i < 20; i++) await t.page.keyboard.press('ArrowDown');
  t.ok(await t.page.evaluate(() => {
    const o = document.activeElement.getBoundingClientRect(), w = document.querySelector('.kimgmap-list-wrap').getBoundingClientRect();
    return o.top >= w.top - 1 && o.bottom <= w.bottom + 1;
  }), 'focused option visible');
});

test('pointer use of the canvas does not show a keyboard focus ring', async t => {
  await t.setup(page(), inline());
  const b = await t.box();
  await t.page.mouse.click(...t.at(b, 400, 200));
  t.eq(await t.page.$eval('.kimgmap-img-area', c => [document.activeElement === c, getComputedStyle(c).outlineStyle]), [true, 'none']);
  await t.page.keyboard.press('ArrowRight');                // keyboard use brings the ring back
  t.ok(await t.page.$eval('.kimgmap-img-area', c => getComputedStyle(c).outlineStyle !== 'none'), 'ring after keyboard use');
});

test('description-only texts are hidden from the reading order', async t => {
  await t.setup(page(), inline());
  t.eq(await t.page.evaluate(() => [document.querySelector('[id^="kimgmap-err-"]').hidden, document.getElementById(document.querySelector('.kimgmap-img-area').getAttribute('aria-describedby')).hidden]), [true, true]);
});

test('keys on the canvas do nothing before the image has loaded', async t => {
  await t.page.route('**/slow.png', () => {});               // never responds
  await t.setup(`<div><img id="img" src="slow.png"><textarea id="ta"></textarea></div>`, () => { window.ed = new kImgMap('#img'); ed.open(); });
  await t.page.focus('.kimgmap-img-area');
  await t.page.keyboard.press('Enter'); await t.page.keyboard.press('Enter');
  t.eq(await t.html(), '');
}, { allowErrors: [/slow\.png|Failed to load/] });

test('arrow keys are not swallowed on the canvas when nothing is selected', async t => {
  await t.setup(page(), inline());
  await t.page.focus('.kimgmap-img-area');
  t.eq(await t.page.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }); document.activeElement.dispatchEvent(e); return e.defaultPrevented; }), false);
});

test('Coords field: Escape restores the committed value; errors clear on later edits; invalid input is announced', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), inline());
  await t.page.click('.kimgmap-list-item');
  const ci = '.kimgmap-coords-input';
  await t.page.fill(ci, '100,100,200,200');
  await t.page.keyboard.press('Escape');
  t.eq(await t.page.$eval(ci, i => i.value), '10, 10, 50, 50', 'restored');
  await t.expectHTML('<area shape="rect" coords="10,10,50,50">', 'not applied', { tol: 0 });
  await t.page.fill(ci, 'nope'); await t.page.keyboard.press('Enter');
  t.ok(/coordinates/i.test(await announced(t)), 'announced: ' + await announced(t));
  t.ok(await t.page.$eval(ci, i => !!i.getAttribute('aria-describedby')), 'format hint described');
  await t.page.focus('.kimgmap-img-area'); await t.page.keyboard.press('ArrowRight');
  t.eq(await t.page.$eval(ci, i => [i.value, i.getAttribute('aria-invalid'), i.classList.contains('is-error')]), ['11, 10, 51, 50', null, false]);
});

test('two modals closed out of order: the page stays inert until the last one closes', async t => {
  await t.setup(`<a href="#" id="link">link</a>${page()}<div><img data-test id="img2"><textarea id="ta2"></textarea></div>`,
    () => { window.a = new kImgMap('#img'); window.b = new kImgMap('#img2'); a.open(); b.open(); a.close(); });
  t.eq(await t.page.evaluate(() => document.getElementById('link').closest('[inert]') !== null), true, 'still inert while b is open');
  t.eq(await t.page.evaluate(() => { b.close(); return document.getElementById('link').closest('[inert]') !== null; }), false);
});

test('the modal title resists host-page heading styles; the list error dot keeps its tooltip', async t => {
  await t.setup(`<style>h2 { padding: 20px; border-bottom: 5px solid red; text-transform: uppercase; } h2::before { content: '#'; }</style>${page('<area shape="rect" coords="10,10,50,50">')}`,
    () => { window.ed = new kImgMap('#img', { mandatoryTitles: true }); });
  await t.openModal();
  t.eq(await t.page.$eval('.kimgmap-modal-title', h => { const c = getComputedStyle(h); return [c.paddingTop, c.borderBottomWidth, c.textTransform, getComputedStyle(h, '::before').content]; }), ['0px', '0px', 'none', 'none']);
  await t.page.click('.kimgmap-save');
  t.eq(await t.page.$eval('.kimgmap-list-error-dot', d => d.getAttribute('title')), 'Missing title');
});

test('Clear All via the keyboard keeps focus in the editor when its button becomes disabled', async t => {
  await t.setup(page('<area shape="rect" coords="10,10,50,50">'), inline());
  await t.page.locator('[data-tool="clear"]').focus();
  await t.page.keyboard.press('Enter');
  t.eq(await t.page.evaluate(() => document.activeElement.className), 'kimgmap-btn kimgmap-btn--ghost kimgmap-confirm-no', 'the confirmation takes focus (on Cancel)');
  await t.page.keyboard.press('Tab');
  await t.page.keyboard.press('Enter');
  t.eq(await t.page.evaluate(() => [document.querySelector('[data-tool="clear"]').disabled, !!document.activeElement?.closest('.kimgmap-editor') && document.activeElement !== document.body]), [true, true]);
});
