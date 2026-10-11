#!/usr/bin/env node
/*
 * kImgMap test runner.
 *
 *   node test/run.js [--browser=chromium,firefox,webkit] [--build=src,min]
 *
 * Defaults to every browser and both builds.
 *
 * Environment:
 *   GREP=regex        only run tests whose name matches
 *   VERBOSE=1         list passing and skipped tests too
 *   CONCURRENCY=n     parallel browser contexts per browser (default 4)
 *   RETRIES=n         retry a failed test n times (default 1); a test that then
 *                     passes is reported as flaky, not as a plain pass
 *   CHROME_PATH=path  use a specific Chromium binary instead of Playwright's
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { run } = require('./harness');

const arg = (name, def) => {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1].split(',').filter(Boolean) : def;
};
const browsers = arg('browser', ['chromium', 'firefox', 'webkit']);
const builds   = arg('build',   ['src', 'min']);

for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js')).sort()) {
  require(path.join(__dirname, f));
}

run({ browsers, builds }).then(fail => process.exit(fail ? 1 : 0), err => { console.error(err); process.exit(1); });
