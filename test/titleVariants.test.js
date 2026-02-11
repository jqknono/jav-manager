const test = require('node:test');
const assert = require('node:assert/strict');

const { splitTitleVariants } = require('../dist/utils/titleVariants');

test('splitTitleVariants splits zh + original title using marker', () => {
  const raw = '中文标题 顯示原標題 【FANZA限定】性欲が強すぎる僕の彼女がまさかの浮気！？';
  const v = splitTitleVariants(raw);
  assert.equal(v.titleZh, '中文标题');
  assert.equal(v.title, '【FANZA限定】性欲が強すぎる僕の彼女がまさかの浮気！？');
});

test('splitTitleVariants leaves untouched title without marker', () => {
  const raw = 'MIAA-710 性欲強過頭的我女友居然搞外遇！？';
  const v = splitTitleVariants(raw);
  assert.equal(v.title, raw);
  assert.equal(v.titleZh, undefined);
});

