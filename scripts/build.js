#!/usr/bin/env node
/*
 * Generates the builds in docs/ from kImgMap.js and kImgMap.css (npm run build):
 *
 *   docs/kImgMap.min.js    UMD, minified (terser)
 *   docs/kImgMap.mjs       ES module — the UMD factory's body + `export`
 *   docs/kImgMap.min.mjs   ES module, minified
 *   docs/kImgMap.min.css   minified (clean-css)
 *
 * `node scripts/build.js --check` writes nothing and exits 1 if any is stale.
 * test/demo.test.js runs the same check.
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS   = require('clean-css');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const OPEN  = "function () {\n  'use strict';\n";
const CLOSE = '\n  return kImgMap;\n';

/** kImgMap.js (UMD) → an ES module with the same code and a default + named export */
function toESM(src) {
  const start = src.indexOf(OPEN), end = src.lastIndexOf(CLOSE);
  if (start < 0 || end < start) throw new Error('scripts/build.js: UMD wrapper not found in kImgMap.js');
  const header = src.slice(0, src.indexOf('*/') + 2)
    .replace(' * MIT License', ' * ES module build, generated from kImgMap.js by `npm run build` (do not edit)\n * MIT License');
  return `${header}\n${src.slice(start + OPEN.length, end)}\n\nexport default kImgMap;\nexport { kImgMap };\n`;
}

/** Every generated file → its expected content */
async function build() {
  const js = read('kImgMap.js'), esm = toESM(js);
  return {
    'docs/kImgMap.min.js':  (await minify(js,  { compress: true, mangle: true })).code,
    'docs/kImgMap.mjs':     esm,
    'docs/kImgMap.min.mjs': (await minify(esm, { compress: true, mangle: true, module: true })).code,
    'docs/kImgMap.min.css': new CleanCSS().minify(read('kImgMap.css')).styles,
  };
}

/** The generated files that differ from a fresh build */
async function stale() {
  const out = await build();
  return Object.keys(out).filter(f => !fs.existsSync(path.join(ROOT, f)) || read(f) !== out[f]);
}

module.exports = { build, stale, toESM };

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--check')) {
      const s = await stale();
      if (s.length) { console.error(`Stale: ${s.join(', ')} — run npm run build`); process.exit(1); }
      console.log('Builds are up to date');
      return;
    }
    for (const [f, code] of Object.entries(await build())) {
      fs.writeFileSync(path.join(ROOT, f), code);
      console.log(`  ${f}  ${(code.length / 1024).toFixed(1)} kB`);
    }
  })().catch(e => { console.error(e); process.exit(1); });
}
