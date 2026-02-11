const test = require('node:test');
const assert = require('node:assert/strict');

const { printSearchResultList } = require('../dist/utils/cliDisplay');

test('printSearchResultList shows full title (no ellipsis)', () => {
  const oldNoColor = process.env.NO_COLOR;
  process.env.NO_COLOR = '1';

  const logs = [];
  const oldLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  try {
    printSearchResultList('MIAA-710', [
      {
        javId: 'MIAA-710',
        source: 'Local',
        title: 'TITLE_' + 'X'.repeat(100) + '_END',
      },
    ]);
  } finally {
    console.log = oldLog;
    if (oldNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = oldNoColor;
  }

  const out = logs.join('\n');

  // Old behavior appended "..." when truncating.
  assert.equal(out.includes('...'), false);
  assert.equal((out.match(/X/g) || []).length, 100);
  assert.equal(out.includes('TITLE_'), true);
  assert.equal(out.includes('_END'), true);
});

